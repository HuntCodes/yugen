import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Platform, AppState } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import { encode as encodeBase64 } from 'base-64'; // For ArrayBuffer to base64
import * as Animatable from 'react-native-animatable'; // Added for animations

import { environment } from '../../config/environment';
import { ChatMessage } from '../../hooks/useChatFlow';
import { OnboardingProfile as Profile } from '../../types/onboarding';
import { TrainingSession } from '../../screens/main/training/components/types';
import { PlanUpdate } from '../../types/planUpdate';
import { saveMessage } from '../../services/chat/chatService';

// Constants
const SUPABASE_URL = environment.supabaseUrl; // Ensure this is correctly configured in your environment
const EPHEMERAL_KEY_ENDPOINT = `${SUPABASE_URL}/functions/v1/ephemeral-key`;
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]; // Basic STUN server

// Copied from VoiceOnboarding.tsx
const glowAnimation = {
  0: { opacity: 0.3, borderWidth: 2 },
  0.5: { opacity: 1, borderWidth: 5 },
  1: { opacity: 0.3, borderWidth: 2 },
};

interface DailyVoiceChatProps {
  coachId: string;
  coachName: string;
  coachAvatar: any;
  coachVibe?: string;
  coachPhilosophy?: string;
  coachPersonalityBlurb?: string;
  userId: string;
  profile: Profile | null;
  currentTrainingPlan: TrainingSession[] | null;
  onSessionComplete: (conversationHistory: ChatMessage[], confirmedPlanUpdate?: PlanUpdate) => void;
  onError: (error: string) => void;
  onClose: () => void;
  onSpeakingStateChange?: (isSpeaking: boolean, speaker?: 'user' | 'coach') => void;
  isVisible: boolean;
}

const DailyVoiceChat: React.FC<DailyVoiceChatProps> = ({
  coachId,
  coachName,
  coachAvatar,
  coachVibe,
  coachPhilosophy,
  coachPersonalityBlurb,
  userId,
  profile,
  currentTrainingPlan,
  onSessionComplete,
  onError,
  onClose,
  onSpeakingStateChange,
  isVisible,
}) => {
  const [isLoading, setIsLoading] = useState(true); // Initial loading/setup phase
  const [isConnecting, setIsConnecting] = useState(false); // Connecting to WebRTC/Deepgram
  const [isListening, setIsListening] = useState(false); // Actively listening for user speech
  const [isCoachSpeakingTTS, setIsCoachSpeakingTTS] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState(''); // Real-time transcript from STT
  const [pendingCoachResponse, setPendingCoachResponse] = useState(''); // Accumulates coach TTS text
  const [error, setErrorState] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [conversationComplete, setConversationComplete] = useState(false);
  const [userIsActuallySpeaking, setUserIsActuallySpeaking] = useState(false);
  const [isReceivingCoachMessage, setIsReceivingCoachMessage] = useState(false);
  const [showAnimatedCoachView, setShowAnimatedCoachView] = useState(false); // New state for animation

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<any | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const ttsPlayerRef = useRef<Audio.Sound | null>(null);
  
  const ephemeralKeyRef = useRef<string | null>(null);
  const userSpeakingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const coachResponseCompleterTimerRef = useRef<NodeJS.Timeout | null>(null);
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanupScheduledRef = useRef(false);
  const initializeWebRTCRef = useRef<((token: string) => Promise<void>) | null>(null);

  useEffect(() => {
    // Determine when to show the animated coach view
    if (!isLoading && !isConnecting && !error && hasPermission && isVisible) {
      setShowAnimatedCoachView(true);
    } else {
      setShowAnimatedCoachView(false);
    }
  }, [isLoading, isConnecting, error, hasPermission, isVisible]);

  const handleError = useCallback((errorMessage: string, critical = false) => {
    console.error(`[DailyVoiceChat] Error: ${errorMessage}`);
    setErrorState(errorMessage);
    if (onError) {
      onError(errorMessage);
    }
    if (critical) {
      console.log("[DailyVoiceChat] Critical error, potentially closing or fallback.");
      // Consider calling fullCleanupAndClose() or setFallbackMode(true) here if always desired on critical
    }
  }, [onError]);

  const buildDailyCheckInPrompt = useCallback(() => {
    let prompt = `You are ${coachName}, a friendly and supportive running coach, having a daily voice check-in with ${profile?.nickname || 'the athlete'}.\n`;
    
    // Add personality details if available
    if (coachPersonalityBlurb) {
      prompt += `Your personality is: ${coachPersonalityBlurb}\n`;
    }
    if (coachVibe) {
      prompt += `Your vibe is: ${coachVibe}\n`;
    }
    if (coachPhilosophy) {
      prompt += `Your coaching philosophy is: ${coachPhilosophy}\n`;
    }

    prompt += `\nYour goal is to have a natural, turn-by-turn conversation. Ask one main question at a time and wait for their response before asking another or moving to a new topic.\n`;
    prompt += `Start by asking how they are feeling today.\n`;
    prompt += `Based on their response, you can then inquire about how their training is going generally, and then if they need any adjustments to their plan for the upcoming days or week.\n`;
    prompt += `When discussing plan adjustments, be specific. For example: "I see you have a 10km tempo run on Thursday. How are you feeling about that?"\n`;
    prompt += `If the athlete suggests a change or you propose one (e.g., "Maybe we should shorten that to 7km or make it an easy run if you're feeling tired."), you MUST get explicit verbal confirmation before considering it final.\n`;
    prompt += `Ask clearly: "So, to confirm, you'd like to change [original workout details] to [new workout details]. Is that correct?" or "Shall I make that change to [new workout details]?"\n`;
    prompt += `Listen carefully for a "yes" or "no" (or similar explicit confirmation/rejection). If they confirm, acknowledge it, for example: "Okay, consider it done! I've updated your plan." If they reject or are unsure, acknowledge that and do not proceed with the change, e.g., "No problem, we'll stick to the current plan then."\n`;
    prompt += `If multiple adjustments are discussed and confirmed, try to summarize them at the end if natural.\n`;
    if (currentTrainingPlan && currentTrainingPlan.length > 0) {
       prompt += `\n\nHere is their upcoming plan for reference (first few sessions):\n`;
       currentTrainingPlan.slice(0, 3).forEach(s => {
         prompt += `- ${s.date}: ${s.session_type} - ${s.distance} ${profile?.units || 'km'}\n`;
       });
     }
    return prompt;
  }, [coachName, profile, currentTrainingPlan, coachPersonalityBlurb, coachVibe, coachPhilosophy]);

  const startAudioProcessing = useCallback(async () => {
    if (!localStreamRef.current || !peerConnectionRef.current || isListening) {
        console.log('[DailyVoiceChat] Cannot start audio processing: stream/PC not ready or already listening.');
        return;
    }
    console.log('[DailyVoiceChat] Starting audio processing / listening...');
    setIsListening(true); 
    if (onSpeakingStateChange) onSpeakingStateChange(true, 'user');

  }, [handleError, onSpeakingStateChange]);

  const playTTSAudio = useCallback(async (base64Audio: string) => {
    try {
      if (ttsPlayerRef.current) {
        await ttsPlayerRef.current.unloadAsync();
      }
      console.log('[DailyVoiceChat] Playing TTS audio chunk...');
      const { sound } = await Audio.Sound.createAsync(
         { uri: `data:audio/mp3;base64,${base64Audio}` },
         { shouldPlay: true }
      );
      ttsPlayerRef.current = sound;
      await sound.playAsync();
      console.log('[DailyVoiceChat] TTS audio chunk playback started.');
    } catch (e: any) {
      handleError(`TTS playback error: ${e.message}`);
    }
  }, [handleError]);

  // Memoize configureAIInstructions - MOVED EARLIER
  const configureAIInstructions = useCallback((dc: any) => { 
    if (dc && dc.readyState === 'open') {
        const dailyCheckInPrompt = buildDailyCheckInPrompt();
        const sessionUpdateEvent = {
            type: 'session.update',
            session: {
                instructions: dailyCheckInPrompt, 
                input_audio_transcription: {
                    model: "whisper-1" 
                },
                input_audio_noise_reduction: {
                    "type": "near_field"
                },
                turn_detection: {
                    "type": "server_vad",
                    "threshold": 0.8,
                    "prefix_padding_ms": 500,
                    "silence_duration_ms": 500,
                    "create_response": true,
                    "interrupt_response": true
                }
            }
        };
        dc.send(JSON.stringify(sessionUpdateEvent));
        console.log('[DailyVoiceChat] Sent session.update event with AI configuration including input_audio_transcription.');

        setTimeout(() => {
            if (dc.readyState === 'open') {
                const responseCreateEvent = {
                    type: 'response.create'
                };
                dc.send(JSON.stringify(responseCreateEvent));
                console.log('[DailyVoiceChat] Sent response.create event to make coach speak first');
                setIsReceivingCoachMessage(true);
            } else {
                 console.warn('[DailyVoiceChat] DataChannel closed before response.create could be sent.');
            }
        }, 1000);

    } else {
        console.error('[DailyVoiceChat] Cannot configure AI: DataChannel not open or not available.');
        handleError('Failed to configure AI: DataChannel not ready.', true);
        setFallbackMode(true);
    }
  }, [buildDailyCheckInPrompt, handleError, setFallbackMode, setIsReceivingCoachMessage]);

  const getEphemeralKey = useCallback(async () => {
    console.log('[DailyVoiceChat] Requesting ephemeral key...');
    setIsConnecting(true);
    setErrorState(null); 
    setFallbackMode(false);
    try {
      const response = await fetch(EPHEMERAL_KEY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini-realtime-preview-2024-12-17', voice: 'verse' }), 
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ephemeral key fetch failed: ${response.status} ${errorText}`);
      }
      const data = await response.json();
      const key = data.client_secret?.value; 
      if (!key) {
        console.error('[DailyVoiceChat] No client_secret.value in ephemeral key response. Response data:', data);
        throw new Error('No ephemeral key (client_secret.value) received from backend');
      }
      ephemeralKeyRef.current = key;
      console.log('[DailyVoiceChat] Ephemeral key received successfully.');
      if (initializeWebRTCRef.current) {
        initializeWebRTCRef.current(key);
      } else {
        console.error("[DailyVoiceChat] initializeWebRTC is not assigned to ref yet");
        handleError("Internal error: WebRTC initializer not ready", true);
      }
    } catch (err: any) {
      handleError(`Failed to get ephemeral key: ${err.message}`, true);
      setFallbackMode(true); 
      setIsConnecting(false);
    }
  }, [handleError]);

  const checkMicrophonePermissions = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync(); // Using Audio.requestPermissionsAsync directly
      setHasPermission(permission.granted);
      if (permission.granted) {
        console.log('[DailyVoiceChat] Microphone permission granted.');
        getEphemeralKey(); // Call getEphemeralKey which is now defined above
      } else {
        handleError('Microphone permission not granted.', true);
        setFallbackMode(true); // Also set fallback if permissions are denied
        setIsLoading(false); // Stop loading if permissions are denied
      }
    } catch (err: any) {
      handleError(`Permission check error: ${err.message}`, true);
      setFallbackMode(true);
      setIsLoading(false);
    }
  }, [getEphemeralKey, handleError]);

  const initializeWebRTC = useCallback(async (token: string) => {
    console.log('[DailyVoiceChat] Initializing WebRTC with OpenAI Realtime API...');
    if (!token) {
        handleError("Cannot initialize WebRTC without an ephemeral key.", true);
        setFallbackMode(true);
        return;
    }
    setIsConnecting(true); 
    try {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionRef.current = pc;

      // @ts-ignore 
      pc.onicecandidate = (event: any) => {
        if (event.candidate) {
          console.log('[DailyVoiceChat] ICE candidate:', event.candidate); 
        }
      };

      // @ts-ignore 
      pc.onconnectionstatechange = () => {
        if (!peerConnectionRef.current) return;
        const connectionState = peerConnectionRef.current.connectionState;
        console.log(`[DailyVoiceChat] PeerConnection state: ${connectionState}`);
        if (connectionState === 'connected' && dataChannelRef.current?.readyState === 'open') {
            // setIsConnecting(false); // Moved to dc.onopen for more precise timing
            // setIsLoading(false); 
            console.log('[DailyVoiceChat] WebRTC peer connection connected. DataChannel state:', dataChannelRef.current?.readyState);
        } else if (connectionState === 'failed' || connectionState === 'disconnected' || connectionState === 'closed') {
          handleError('WebRTC connection failed or disconnected.', false); 
          setIsConnecting(false);
          setIsLoading(false); 
        }
      };

      // @ts-ignore 
      pc.ontrack = (event: any) => {
        console.log('[DailyVoiceChat] Received track:', event.track.kind);
        if (event.track.kind === 'audio' && event.streams && event.streams[0]) {
            console.log('[DailyVoiceChat] Audio track received via ontrack. This is unexpected if TTS is purely via data channel.');
        }
      };
      
      const dc = pc.createDataChannel('oai-events', { ordered: true }); 
      dataChannelRef.current = dc;

      // @ts-ignore 
      dc.onopen = () => {
        console.log('[DailyVoiceChat] DataChannel open.');
        if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
          configureAIInstructions(dataChannelRef.current); 
          setIsConnecting(false); 
          setIsLoading(false);
          startAudioProcessing(); 
          console.log('[DailyVoiceChat] AI configured and audio processing started.');
        } else {
          console.warn('[DailyVoiceChat] DataChannel opened, but ref is not ready or state is not open.');
          handleError('DataChannel opened but was not ready for configuration.', true);
          setFallbackMode(true);
        }
      };

      // @ts-ignore 
      dc.onclose = () => console.log('[DailyVoiceChat] DataChannel closed.');
      
      // @ts-ignore 
      dc.onerror = (error: any) => { 
          handleError(`DataChannel error: ${error?.message || 'Unknown DataChannel error'}`, true);
          setFallbackMode(true);
      };
      
      // @ts-ignore 
      dc.onmessage = (event: any) => { 
        console.log('[DailyVoiceChat] RAW DataChannel Message Received:', event.data); 
        try {
            const messageData = JSON.parse(event.data as string);
            let unhandled = false;
            console.log('[DailyVoiceChat] Parsed DataChannel Message Type:', messageData.type); 

            switch (messageData.type) {
                case 'final_transcript': // User's final speech-to-text
                case 'conversation.item.input_audio_transcription.completed': 
                    if (isCoachSpeakingTTS) {
                        console.log('[DailyVoiceChat] Ignoring user transcript as coach is speaking TTS.');
                        break;
                    }
                    const transcriptText = messageData.text || messageData.transcript;
                    const finalTranscript = transcriptText?.trim();
                    if (finalTranscript) {
                        console.log('[DailyVoiceChat] User Utterance (final):', finalTranscript);
                        // setCurrentTranscript(''); // Moved down

                        const newUserMessage: ChatMessage = { sender: 'user', message: finalTranscript };
                        setConversationHistory(prev => [...prev, newUserMessage]);
                        
                        if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
                            if (!isReceivingCoachMessage && !isCoachSpeakingTTS) {
                                console.log('[DailyVoiceChat] User transcript processed in onmessage. Requesting AI response.');
                                const responseCreateEvent = {
                                    type: 'response.create'
                                };
                                dataChannelRef.current.send(JSON.stringify(responseCreateEvent));
                                setIsReceivingCoachMessage(true); // Expecting the coach to speak
                            } else {
                                console.log('[DailyVoiceChat] User transcript processed in onmessage, but coach is already active. Not sending response.create.');
                            }
                        } else {
                            handleError("Cannot request AI response: DataChannel not open.");
                        }
                    }
                    setCurrentTranscript(''); 
                    break;
                case 'partial_transcript': // User's partial speech-to-text (not used by OpenAI Realtime API)
                    setCurrentTranscript(messageData.text);
                    break;
                case 'response.audio_transcript.delta': // Coach speech delta
                    if (messageData.delta) {
                        if (!isCoachSpeakingTTS) {
                            setIsCoachSpeakingTTS(true);
                            setPendingCoachResponse(''); // Clear for new utterance
                            if (onSpeakingStateChange) onSpeakingStateChange(true, 'coach');
                        }
                        setPendingCoachResponse(prev => prev + messageData.delta);
                    }
                    break;
                case 'response.audio_transcript.done': // Coach speech segment done
                    if (messageData.transcript) {
                        // This event provides the full transcript for the segment.
                        // We can use it to ensure pendingCoachResponse is accurate
                        // if deltas were missed or if it's a more reliable source.
                        // However, typically deltas should have built this up already.
                        // For safety, let's log if it significantly differs from pending.
                        const segmentTranscript = messageData.transcript.trim();
                        if (segmentTranscript && pendingCoachResponse.trim() !== segmentTranscript) {
                            console.warn(`[DailyVoiceChat] response.audio_transcript.done ('${segmentTranscript}') differs from accumulated pending ('${pendingCoachResponse.trim()}'). Using event transcript.`);
                            // setPendingCoachResponse(segmentTranscript); // Decided against this to trust deltas primarily
                        }
                        // No specific action needed here if deltas are reliable and ai_response_ended / response.done is used for finalization.
                    }
                    // This event doesn't mean the entire AI turn is over, just a segment of audio.
                    break;

                case 'speech_started': // User started speaking (VAD event)
                    if(userSpeakingTimerRef.current) clearTimeout(userSpeakingTimerRef.current);
                    setUserIsActuallySpeaking(true);
                    if (onSpeakingStateChange) onSpeakingStateChange(true, 'user');
                    break;
                case 'speech_ended': // User stopped speaking (VAD event)
                case 'vad_speech_end': // User stopped speaking (OpenAI VAD)
                    setUserIsActuallySpeaking(false);
                    if (onSpeakingStateChange) onSpeakingStateChange(false, 'user');
                    break;
                
                // OpenAI Realtime API specific events for coach's turn
                case 'ai_response_started': 
                    console.log('[DailyVoiceChat] DC Event: ai_response_started');
                    if (!isCoachSpeakingTTS) {
                        setIsCoachSpeakingTTS(true);
                        setPendingCoachResponse(''); // Ensure fresh start for coach's response
                        if (onSpeakingStateChange) onSpeakingStateChange(true, 'coach');
                        if(coachResponseCompleterTimerRef.current) clearTimeout(coachResponseCompleterTimerRef.current);
                    }
                    setIsReceivingCoachMessage(true); // Explicitly set as we are now sure coach is starting
                    break;

                case 'ai_response_text_part': // Deprecated by OpenAI, but handle if it appears
                     console.log('[DailyVoiceChat] DC Event: ai_response_text_part - text:', messageData.text);
                     if (messageData.text) {
                        if (!isCoachSpeakingTTS) {
                            setIsCoachSpeakingTTS(true);
                            setPendingCoachResponse('');
                            if (onSpeakingStateChange) onSpeakingStateChange(true, 'coach');
                        }
                        setPendingCoachResponse(prev => prev + messageData.text);
                     }
                    break;

                case 'ai_response_audio_part': // Base64 audio chunks from coach
                    console.log('[DailyVoiceChat] DC Event: ai_response_audio_part');
                    const audioBase64 = messageData.audio; 
                    if (audioBase64) {
                        if (!isCoachSpeakingTTS) { // Should be true if ai_response_started fired
                           setIsCoachSpeakingTTS(true);
                           if (onSpeakingStateChange) onSpeakingStateChange(true, 'coach');
                        }
                        playTTSAudio(audioBase64);
                    }
                    break;

                case 'ai_response_ended': 
                    console.log('[DailyVoiceChat] DC Event: ai_response_ended');
                    if (isCoachSpeakingTTS) {
                        setIsCoachSpeakingTTS(false);
                        if (onSpeakingStateChange) onSpeakingStateChange(false, 'coach');
                        const finalResponseFromEnded = pendingCoachResponse.trim();
                        if (finalResponseFromEnded) {
                           console.log('[DailyVoiceChat] Coach Utterance (via ai_response_ended):', finalResponseFromEnded);
                           setConversationHistory(prev => [...prev, { sender: 'coach', message: finalResponseFromEnded, id: Date.now().toString() + 'coach_airend'}]);
                        }
                        // Don't clear pendingCoachResponse here, response.done might have more complete info or be the sole source.
                    }
                    // setIsReceivingCoachMessage(false); // Defer this to response.done for robustness
                    break;

                case 'response.done': // Definitive end of the AI's response for the current turn.
                    console.log('[DailyVoiceChat] DC Event: response.done - status:', messageData.response?.status);
                    setIsCoachSpeakingTTS(false);
                    if (onSpeakingStateChange) onSpeakingStateChange(false, 'coach');
                    setIsReceivingCoachMessage(false); // Coach's turn is definitively over.

                    if (messageData.response?.status === 'completed') {
                        const outputItem = messageData.response.output?.[0];
                        const contentItem = outputItem?.content?.[0];
                        let finalTranscriptFromDone = contentItem?.transcript?.trim();

                        if (finalTranscriptFromDone) {
                            console.log('[DailyVoiceChat] Coach Utterance (via response.done):', finalTranscriptFromDone);
                             // Prefer response.done transcript as it's authoritative
                            setConversationHistory(prev => {
                                // Avoid duplicates if ai_response_ended already added a very similar message
                                const lastMessage = prev[prev.length -1];
                                if (lastMessage && lastMessage.sender === 'coach' && lastMessage.message === finalTranscriptFromDone) {
                                    console.log("[DailyVoiceChat] response.done transcript matches last message from ai_response_ended. Skipping duplicate.");
                                    return prev;
                                }
                                return [...prev, { sender: 'coach', message: finalTranscriptFromDone, id: Date.now().toString() + 'coach_respdone'}];
                            });
                            setPendingCoachResponse(finalTranscriptFromDone); // Ensure UI shows the most complete version
                        } else if (pendingCoachResponse.trim()) {
                            // Fallback to pendingCoachResponse if response.done had no transcript but we accumulated something
                            console.warn('[DailyVoiceChat] response.done was completed but no transcript. Using accumulated pendingCoachResponse.');
                            setConversationHistory(prev => [...prev, { sender: 'coach', message: pendingCoachResponse.trim(), id: Date.now().toString() + 'coach_pending_fallback'}]);
                        }
                    } else if (messageData.response?.status === 'cancelled') {
                        console.log('[DailyVoiceChat] Coach response cancelled (e.g., user barge-in). Reason:', messageData.response?.status_details?.reason);
                        // If cancelled, the pendingCoachResponse might be incomplete or irrelevant.
                        // Clear it to avoid showing a half-uttered phrase.
                    }
                    setPendingCoachResponse(''); // Always clear pending after response.done

                    if (messageData.response?.conversation_is_complete || messageData.conversation_is_complete) { // Check both places
                        console.log('[DailyVoiceChat] Conversation marked as complete by AI.');
                        setConversationComplete(true);
                    }
                    break;

                // Deprecated 'message' event structure (for older API or custom setups)
                // Keep for robustness but prioritize newer events.
                case 'message':
                    console.log('[DailyVoiceChat] DC Event: message - role:', messageData.role, 'done:', messageData.done);
                    if (messageData.role === 'assistant') {
                        if (messageData.message) { // Assuming 'message' contains text part
                            if (!isCoachSpeakingTTS) {
                                setIsCoachSpeakingTTS(true);
                                setPendingCoachResponse(''); // Clear for new utterance
                                if (onSpeakingStateChange) onSpeakingStateChange(true, 'coach');
                            }
                            setPendingCoachResponse(prev => prev + messageData.message);
                        }
                        if (messageData.done) {
                            setIsCoachSpeakingTTS(false);
                            if (onSpeakingStateChange) onSpeakingStateChange(false, 'coach');
                            const completeResponse = pendingCoachResponse.trim();
                            if (completeResponse) {
                                console.log('[DailyVoiceChat] Coach Utterance (complete, via legacy message event):', completeResponse);
                                setConversationHistory(prev => [...prev, { sender: 'coach', message: completeResponse, id: Date.now().toString() + 'coach_legacy'}]);
                            }
                            // setPendingCoachResponse(''); // Cleared by response.done or next ai_response_started
                            setIsReceivingCoachMessage(false); // Coach is done for this turn.

                            if (messageData.conversation_is_complete) {
                                setConversationComplete(true);
                            }
                        } else if (!messageData.done && !isCoachSpeakingTTS) { // If not done, but TTS not active, start it
                            setIsCoachSpeakingTTS(true);
                            // setPendingCoachResponse(''); // Should be handled by first message part
                            if (onSpeakingStateChange) onSpeakingStateChange(true, 'coach');
                        }
                    }
                    break;
                
                case 'error':
                    const errorMessage = messageData.message || messageData.error?.message || 'Unknown voice backend error';
                    console.error('[DailyVoiceChat] DC Event: error from voice backend:', errorMessage, messageData);
                    handleError(`Voice backend error: ${errorMessage}`, true);
                    setFallbackMode(true);
                    setIsCoachSpeakingTTS(false);
                    setIsReceivingCoachMessage(false);
                    break;
                
                // Unhandled cases from logs / potentially useful events
                case 'conversation.item.created': // Logs show this, usually informational
                case 'response.created': // Logs show this, usually informational
                case 'rate_limits.updated': // Logs show this, informational
                case 'response.output_item.added': // Logs show this
                case 'response.output_item.done': // Logs show this
                case 'conversation.item.truncated': // Logs show this
                case 'input_audio_buffer.speech_started': // Not VAD event ('speech_started')
                case 'input_audio_buffer.speech_stopped':
                case 'input_audio_buffer.committed':
                case 'output_audio_buffer.started':
                case 'output_audio_buffer.cleared':
                case 'output_audio_buffer.stopped':
                case 'response.content_part.added': // Should be handled by audio_transcript.delta for text
                case 'response.content_part.done': // Should be handled by audio_transcript.done for text
                    // console.log('[DailyVoiceChat] Informational/Handled elsewhere DC Message Type:', messageData.type, messageData);
                    unhandled = false; // Mark as handled as these are expected but don't require direct action here
                    break;

                default:
                    unhandled = true;
                    console.log('[DailyVoiceChat] Unhandled DC Message Type:', messageData.type, messageData);
                    break;
            }
            if (unhandled) {
                 // console.log('[DailyVoiceChat] Unhandled DC Message Type:', messageData.type, messageData);
            } else {
                 // console.log('[DailyVoiceChat] DC Message Handled:', messageData.type);
            }

        } catch (err: any) {
            console.error('[DailyVoiceChat] Error processing DataChannel message:', err);
        }
      };
      
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer({}); 
      await pc.setLocalDescription(offer);

      console.log('[DailyVoiceChat] Sending SDP offer to OpenAI Realtime API...');
      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17`, { 
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${token}`, 
              'Content-Type': 'application/sdp'
          },
          body: pc.localDescription?.sdp
      });

      if (!sdpResponse.ok) {
          const errorBody = await sdpResponse.text();
          console.error('[DailyVoiceChat] SDP offer to OpenAI failed:', sdpResponse.status, errorBody);
          throw new Error(`Failed to send SDP offer to OpenAI: ${sdpResponse.status} ${errorBody}`);
      }
      
      const answerSdp = await sdpResponse.text();
      console.log('[DailyVoiceChat] Received SDP answer from OpenAI.');
      
      const answer = new RTCSessionDescription({ type: 'answer', sdp: answerSdp });
      await pc.setRemoteDescription(answer);
      
      console.log('[DailyVoiceChat] WebRTC setup with OpenAI Realtime API complete.');
      
    } catch (err: any) {
      handleError(`WebRTC Initialization failed: ${err.message}`, true);
      setFallbackMode(true); 
      setIsConnecting(false);
      setIsLoading(false);
    }
  }, [handleError, buildDailyCheckInPrompt, userId, onSpeakingStateChange, playTTSAudio, startAudioProcessing, configureAIInstructions]);

  const stopAudioProcessing = useCallback(() => {
    console.log('[DailyVoiceChat] Stopping audio processing...');
    setIsListening(false);
    if (onSpeakingStateChange) onSpeakingStateChange(false, 'user');
    if(userSpeakingTimerRef.current) clearTimeout(userSpeakingTimerRef.current);
    userSpeakingTimerRef.current = null;

  }, [onSpeakingStateChange]);

  const fullCleanup = useCallback(() => {
    console.log('[DailyVoiceChat] Performing full cleanup...');
    stopAudioProcessing();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (ttsPlayerRef.current) {
      ttsPlayerRef.current.unloadAsync().catch(e => console.error("Error unloading TTS player:", e));
      ttsPlayerRef.current = null;
    }
    
    ephemeralKeyRef.current = null;
    setIsConnecting(false);
    setIsListening(false);
    setIsCoachSpeakingTTS(false);
    setCurrentTranscript('');
    setPendingCoachResponse('');
    setErrorState(null);
    // Don't reset conversationHistory here, it's needed for onSessionComplete
  }, [stopAudioProcessing]);
  
  const fullCleanupAndClose = useCallback(() => {
    if (cleanupScheduledRef.current) return;
    cleanupScheduledRef.current = true;

    fullCleanup();
    onClose(); // Call the original onClose from props
    
    // Reset after a short delay to ensure onClose has propagated
    setTimeout(() => {
        cleanupScheduledRef.current = false;
    }, 100);
  }, [fullCleanup, onClose]);


  // --- Main Setup Effect for Visibility Change ---
  useEffect(() => {
    initializeWebRTCRef.current = initializeWebRTC;

    // Consolidating audio setup and permission logic based on isVisible, similar to VoiceChat.tsx
    const configureAudioAndPermissions = async () => {
      if (isVisible) {
        setIsLoading(true);
        setConversationHistory([]); // Reset history for new session
        setConversationComplete(false);
        setFallbackMode(false);
        setErrorState(null);
        
        // Configure InCallManager and Audio Mode
        try {
          console.log('[DailyVoiceChat] Configuring audio and InCallManager...');
          InCallManager.start({ media: 'audio' });
          InCallManager.setForceSpeakerphoneOn(true);
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: true,
            interruptionModeIOS: 1, 
            interruptionModeAndroid: 1, 
            playThroughEarpieceAndroid: false, shouldDuckAndroid: true,
          });
          console.log('[DailyVoiceChat] Audio mode configured.');
        } catch (e) {
          handleError(`Audio system configuration failed: ${(e as Error).message}`, true);
          return; // Stop if audio system fails
        }
        
        // Check permissions (which then calls getEphemeralKey -> initializeWebRTC)
        await checkMicrophonePermissions(); // Ensure this is robust
        // setIsLoading will be set to false within initializeWebRTC or its error handling

      } else {
        // Cleanup when not visible
        fullCleanup(); 
        console.log('[DailyVoiceChat] Cleaning up InCallManager and audio mode...');
        InCallManager.setForceSpeakerphoneOn(false); // Attempt to turn off speaker
        InCallManager.stop();
        Audio.setAudioModeAsync({ // Reset audio mode
            allowsRecordingIOS: false, playsInSilentModeIOS: false, staysActiveInBackground: false,
            interruptionModeIOS: 1, 
            interruptionModeAndroid: 1, 
        }).catch(e => console.warn("Failed to reset audio mode on hiding:", (e as Error).message));
      }
    };

    configureAudioAndPermissions();

    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
        if (nextAppState !== 'active' && isVisible && !cleanupScheduledRef.current) {
            console.log('[DailyVoiceChat] App became inactive, performing full cleanup and closing.');
            fullCleanupAndClose(); // Ensures modal closes etc.
        }
    });

    return () => {
      console.log('[DailyVoiceChat] Cleanup on unmount / isVisible change.');
      appStateSubscription.remove();
      if (!isVisible || cleanupScheduledRef.current) { // Ensure cleanup runs if component unmounts while visible
        fullCleanup();
        console.log('[DailyVoiceChat] Unmount: Cleaning up InCallManager and audio mode...');
        InCallManager.setForceSpeakerphoneOn(false);
        InCallManager.stop();
        Audio.setAudioModeAsync({
            allowsRecordingIOS: false, playsInSilentModeIOS: false, staysActiveInBackground: false,
            interruptionModeIOS: 1,
            interruptionModeAndroid: 1,
        }).catch(e => console.warn("Failed to reset audio mode on unmount:", (e as Error).message));
      }
    };
  }, [isVisible, checkMicrophonePermissions, initializeWebRTC, fullCleanup, fullCleanupAndClose, handleError]); // Added handleError


  const handleEndSession = async () => {
    console.log('[DailyVoiceChat] Ending session manually or on completion.');
    setConversationComplete(true); // Mark as complete
    
    // Stop any TTS playback
    if (ttsPlayerRef.current) {
      await ttsPlayerRef.current.stopAsync();
      await ttsPlayerRef.current.unloadAsync();
      ttsPlayerRef.current = null;
    }

    // Stop local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close PeerConnection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Clear DataChannel
    if (dataChannelRef.current) {
        dataChannelRef.current.close();
        dataChannelRef.current = null;
    }

    // Release audio focus
    if (Platform.OS !== 'web') {
      InCallManager.stop();
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        // playsInSilentModeIOS: false, // Keep true if background audio needed
      }).catch(e => console.warn("Error setting audio mode on end:", e));
    }
    
    setIsListening(false);
    setIsConnecting(false);
    setIsLoading(false);
    setUserIsActuallySpeaking(false);
    setIsCoachSpeakingTTS(false);
    setShowAnimatedCoachView(false);

    // Call the onClose prop to notify parent (e.g., HomeScreen)
    if (onClose) {
      onClose(); 
    }
    
    // Persist conversation if needed (already called by Deepgram handlers on specific events)
    // but can be called here as a final safeguard if the session ends abruptly.
    // await saveConversationToSupabase(conversationHistory);
    // onSessionComplete(conversationHistory, undefined); // Example: no plan update here
    console.log('[DailyVoiceChat] Session cleanup complete.');
  };

  const reconnect = () => {
    console.log('[DailyVoiceChat] Attempting to reconnect...');
    // Reset crucial states before attempting to get a new key and initialize
    setErrorState(null);
    setIsConnecting(false); // Will be set true by getEphemeralKey
    setIsLoading(true); // Show loading state
    setConversationHistory([]); // Clear previous history
    setCurrentTranscript('');
    setPendingCoachResponse('');
    setShowAnimatedCoachView(false);
    setHasPermission(null); // Re-check permissions

    // Clean up existing resources before reconnecting
    if (ttsPlayerRef.current) {
      ttsPlayerRef.current.unloadAsync();
      ttsPlayerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    
    // Restart the connection process
    checkMicrophonePermissions(); // This function should encapsulate permission check & getEphemeralKey
  };

  // Function to save conversation to Supabase
  const saveConversationToSupabase = async (history: ChatMessage[]) => {
    console.log('[DailyVoiceChat] Saving conversation to Supabase...');
    if (!userId) {
      console.error('[DailyVoiceChat] Cannot save conversation: User ID is missing.');
      return;
    }
    try {
      for (const chatMessage of history) {
        if (chatMessage.message.trim() === '') continue; 
        
        const messageSender: 'user' | 'coach' = chatMessage.sender === 'user' ? 'user' : 'coach';

        // Corrected call to saveMessage
        const messagePayload: ChatMessage = {
          sender: messageSender,
          message: chatMessage.message,
          // timestamp is optional in ChatMessage and saveMessage creates its own created_at
        };
        await saveMessage(messagePayload, userId); // Pass userId as the second argument

      }
      console.log('[DailyVoiceChat] Conversation saved successfully.');
    } catch (e: any) {
      console.error('[DailyVoiceChat] Error saving conversation to Supabase:', e);
      // Notify user or log to a monitoring service if needed
      // Not calling handleError here to avoid UI error message for background save failure
    }
  };

  if (!isVisible) return null;

  const renderContent = () => {
    if (error) {
      return (
        <View style={styles.centeredContent}>
          <Text style={styles.errorText}>{error}</Text>
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <TouchableOpacity onPress={handleEndSession} style={[styles.buttonBase, { marginRight: 10, backgroundColor: '#FF6347'}]}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
            {!fallbackMode && (
              <TouchableOpacity onPress={reconnect} style={[styles.buttonBase, {backgroundColor: '#4CAF50'}]}>
                <Text style={styles.buttonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    if (isLoading || isConnecting) {
      return (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.infoText}>
            {isLoading ? 'Initializing...' : 'Connecting to your coach...'}
          </Text>
        </View>
      );
    }

    if (showAnimatedCoachView) {
      // This is the new animated view
      return (
        <View style={styles.animatedCoachContainer}>
          <View style={styles.coachImageWrapper}>
            <Animatable.Image
              source={coachAvatar}
              animation="pulse"
              iterationCount="infinite"
              duration={1000}
              easing="ease-in-out"
              style={styles.coachImage}
            />
            <Animatable.View 
              animation="pulse" 
              iterationCount="infinite" 
              duration={1500}
              style={styles.animatedBorder}
            />
            <Animatable.View 
              animation={glowAnimation} 
              iterationCount="infinite" 
              duration={1200}
              style={styles.glowOverlay}
            />
            {isCoachSpeakingTTS && (
                 <View style={styles.speakingIndicator}>
                   <Animatable.View 
                     animation="pulse" 
                     iterationCount="infinite" 
                     duration={700}
                     style={styles.speakingDot}
                   />
                 </View>
            )}
          </View>
          <Text style={styles.coachNameText}>{isListening ? `Listening to you...` : (isCoachSpeakingTTS ? `${coachName} is speaking...` : `Connected to ${coachName}`)}</Text>
          {currentTranscript && !isCoachSpeakingTTS && (
            <Text style={styles.transcriptText}>You: {currentTranscript}</Text>
          )}
          <TouchableOpacity 
            onPress={handleEndSession} 
            style={[styles.buttonBase, styles.endCheckInButton]}
          >
            <Text style={styles.buttonText}>End Check-in</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Fallback or other states (though showAnimatedCoachView should cover the main "active" state)
    return (
      <View style={styles.centeredContent}>
        <Text style={styles.infoText}>Waiting for voice interaction...</Text>
      </View>
    );
  };
  return renderContent();
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    width: '100%',
  },
  centeredContent: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  infoText: {
    marginTop: 15,
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  buttonBase: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  endCheckInButton: {
    backgroundColor: '#FF6347',
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 25,
  },
  closeButtonContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  closeButton: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 8,
    borderRadius: 15,
  },
  animatedCoachContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  coachImageWrapper: {
    position: 'relative',
    width: 170,
    height: 170,
    borderRadius: 85, 
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#8B5CF6',
    ...Platform.select({
      ios: {
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 15,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  coachImage: {
    width: 150,
    height: 150,
    borderRadius: 75, 
  },
  animatedBorder: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 91,
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  glowOverlay: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 95,
    backgroundColor: 'transparent',
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  speakingIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  speakingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
  },
  coachNameText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  transcriptText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  }
});

export default DailyVoiceChat; 