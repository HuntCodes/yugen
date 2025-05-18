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

// Extended ChatMessage interface with timestamp
interface TimestampedChatMessage extends ChatMessage {
  timestamp?: number;
  id?: string;
}

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
  refreshHomeScreen?: () => void;
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
  refreshHomeScreen,
}) => {
  const [isLoading, setIsLoading] = useState(true); // Initial loading/setup phase
  const [isConnecting, setIsConnecting] = useState(false); // Connecting to WebRTC/Deepgram
  const [isListening, setIsListening] = useState(false); // Actively listening for user speech
  const [isCoachSpeakingTTS, setIsCoachSpeakingTTS] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<TimestampedChatMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState(''); // Real-time transcript from STT
  const [pendingCoachResponse, setPendingCoachResponse] = useState(''); // Accumulates coach TTS text
  const [error, setErrorState] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [conversationComplete, setConversationComplete] = useState(false);
  const [userIsActuallySpeaking, setUserIsActuallySpeaking] = useState(false);
  const [isReceivingCoachMessage, setIsReceivingCoachMessage] = useState(false);
  const [showAnimatedCoachView, setShowAnimatedCoachView] = useState(false); // New state for animation
  const [userTranscriptJustReceived, setUserTranscriptJustReceived] = useState(false); // Added to track new user input

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
    let prompt = `
    You are ${coachName}, a friendly and supportive running coach. You are speaking with your athlete, ${profile?.nickname || 'the athlete'}.

    🚫 You must NEVER speak as ${profile?.nickname || 'the athlete'} or describe things from their perspective.
    🚫 You must never say "I felt tired yesterday", "My tempo run was hard", or similar — that would be ${profile?.nickname || 'the athlete'} speaking, and you are NOT them.
    ✅ Always speak from YOUR perspective — as a coach.

    You are here to help, guide, listen, and encourage.

    Your role is fixed. You are ${coachName}, their coach, at all times.

    Have a natural, turn-by-turn voice conversation. Ask ONE clear question at a time. Wait for ${profile?.nickname || 'the athlete'} to answer before proceeding.

    IMPORTANT: Wait for the user to respond after each statement or question you make.
    Do not continue speaking or ask multiple questions without user input.
    NEVER continue the conversation without waiting for the user to respond first.

    Start with: "Hey, how are you feeling today?"

    Then:
    - Ask how training has been going in general
    - Then ask if they'd like to adjust anything in the plan

    If they suggest changes, you must get explicit verbal confirmation before making them.
    Ask clearly: "Just to confirm, would you like to change [original workout] to [new workout]?"

    ✅ If they say yes, acknowledge and confirm the change.
    ❌ If they say no or are unsure, do not change the plan.

    If they say no, ask if they'd like to adjust anything in the plan.

    If they say yes, ask them what they'd like to change.

    If they say no, ask if they'd like to adjust anything in the plan.

      `;

      if (coachPersonalityBlurb) {
        prompt += `Your personality is: ${coachPersonalityBlurb}\n`;
      }
      if (coachVibe) {
        prompt += `Your vibe is: ${coachVibe}\n`;
      }
      if (coachPhilosophy) {
        prompt += `Your coaching philosophy is: ${coachPhilosophy}\n`;
      }

      if (currentTrainingPlan && currentTrainingPlan.length > 0) {
        prompt += `Here is ${profile?.nickname || 'the athlete'}'s upcoming plan:\n`;
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

  // Helper function to determine if two text strings are similar
  const isSimilarText = (text1: string, text2: string): boolean => {
    // Convert to lowercase for case-insensitive comparison
    const normalizedText1 = text1.toLowerCase().trim();
    const normalizedText2 = text2.toLowerCase().trim();
    
    console.log('[DailyVoiceChat] Comparing similarity between:');
    console.log(`[DailyVoiceChat] Text1: "${normalizedText1}"`);
    console.log(`[DailyVoiceChat] Text2: "${normalizedText2}"`);
    
    // If the strings are mostly the same, consider them similar
    if (normalizedText1 === normalizedText2) {
      console.log('[DailyVoiceChat] MATCH: Exact match');
      return true;
    }
    
    // Check if one string contains the other or is a significant substring
    if (normalizedText1.includes(normalizedText2) || normalizedText2.includes(normalizedText1)) {
      console.log('[DailyVoiceChat] MATCH: One string contains the other');
      return true;
    }
    
    // Check for similarity by comparing individual words
    const words1 = normalizedText1.split(/\s+/);
    const words2 = normalizedText2.split(/\s+/);
    
    // If more than 90% of words match, consider them similar
    const commonWords = words1.filter(word => words2.includes(word));
    const similarityRatio = commonWords.length / Math.min(words1.length, words2.length);
    console.log(`[DailyVoiceChat] Word similarity: ${commonWords.length}/${Math.min(words1.length, words2.length)} = ${similarityRatio * 100}%`);
    if (similarityRatio >= 0.9) {
      console.log('[DailyVoiceChat] MATCH: Word similarity >= 90%');
      return true;
    }
    
    console.log('[DailyVoiceChat] NO MATCH: Texts not similar enough');
    return false;
  };

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
                    "prefix_padding_ms": 800,
                    "silence_duration_ms": 800,
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
                        
                        // Check if this transcript closely matches the coach's last message
                        const lastCoachMessage = conversationHistory.findLast(msg => msg.sender === 'coach')?.message || '';
                        if (lastCoachMessage && isSimilarText(finalTranscript, lastCoachMessage)) {
                            console.log('[DailyVoiceChat] Ignoring transcript that closely matches coach\'s last message');
                            setCurrentTranscript('');
                            break;
                        }

                        // Create a timestamp for ordering
                        const messageTimestamp = Date.now();
                        const newUserMessage: TimestampedChatMessage = { 
                            sender: 'user', 
                            message: finalTranscript,
                            timestamp: messageTimestamp 
                        };
                        console.log('[DailyVoiceChat] Adding user message to history:', finalTranscript);
                        
                        // Add the message and sort conversation history by timestamp to ensure correct ordering
                        setConversationHistory(prev => {
                            const updated = [...prev, newUserMessage];
                            // Sort by timestamp if available, otherwise maintain insertion order
                            return updated.sort((a, b) => {
                                const timeA = a.timestamp || 0;
                                const timeB = b.timestamp || 0;
                                return timeA - timeB;
                            });
                        });
                        
                        // Set flag that we've received a valid user transcript
                        setUserTranscriptJustReceived(true);
                        
                        if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
                            if (!isReceivingCoachMessage && !isCoachSpeakingTTS && userTranscriptJustReceived) {
                                console.log('[DailyVoiceChat] User transcript processed. Requesting AI response.');
                                const responseCreateEvent = {
                                    type: 'response.create'
                                };
                                dataChannelRef.current.send(JSON.stringify(responseCreateEvent));
                                setIsReceivingCoachMessage(true); // Expecting the coach to speak
                                setUserTranscriptJustReceived(false); // Clear flag after use
                            } else {
                                console.log('[DailyVoiceChat] User transcript processed, but coach is already active or no valid user input. Not sending response.create.');
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
                    
                    // Instead of immediately setting isReceivingCoachMessage to false, add a cooldown period
                    // This prevents the AI from immediately responding to its own transcripts
                    // AND requires new user input before coach responds again
                    setTimeout(() => {
                        console.log('[DailyVoiceChat] Coach response cooldown period ended, now ready for user input');
                        setIsReceivingCoachMessage(false); // Now it's safe to accept new user input
                        // Do NOT automatically trigger a new coach response here
                    }, 2000); // 2-second cooldown after coach finishes

                    if (messageData.response?.status === 'completed') {
                        const outputItem = messageData.response.output?.[0];
                        const contentItem = outputItem?.content?.[0];
                        let finalTranscriptFromDone = contentItem?.transcript?.trim();

                        if (finalTranscriptFromDone) {
                            console.log('[DailyVoiceChat] Coach Utterance (via response.done):', finalTranscriptFromDone);
                            // Create a timestamp for ordering
                            const messageTimestamp = Date.now();
                            // Prefer response.done transcript as it's authoritative
                            setConversationHistory(prev => {
                                // Avoid duplicates if ai_response_ended already added a very similar message
                                const lastMessage = prev[prev.length -1];
                                if (lastMessage && lastMessage.sender === 'coach' && lastMessage.message === finalTranscriptFromDone) {
                                    console.log("[DailyVoiceChat] response.done transcript matches last message from ai_response_ended. Skipping duplicate.");
                                    return prev;
                                }
                                console.log('[DailyVoiceChat] Adding coach message to history:', finalTranscriptFromDone);
                                const newCoachMessage: TimestampedChatMessage = { 
                                    sender: 'coach', 
                                    message: finalTranscriptFromDone, 
                                    id: Date.now().toString() + 'coach_respdone',
                                    timestamp: messageTimestamp
                                };
                                const updated = [...prev, newCoachMessage];
                                // Sort by timestamp if available, otherwise maintain insertion order
                                return updated.sort((a, b) => {
                                    const timeA = a.timestamp || 0;
                                    const timeB = b.timestamp || 0;
                                    return timeA - timeB;
                                });
                            });
                            setPendingCoachResponse(finalTranscriptFromDone); // Ensure UI shows the most complete version
                        } else if (pendingCoachResponse.trim()) {
                            // Fallback to pendingCoachResponse if response.done had no transcript but we accumulated something
                            console.warn('[DailyVoiceChat] response.done was completed but no transcript. Using accumulated pendingCoachResponse.');
                            const messageTimestamp = Date.now();
                            setConversationHistory(prev => {
                                const newCoachMessage: TimestampedChatMessage = { 
                                    sender: 'coach', 
                                    message: pendingCoachResponse.trim(), 
                                    id: Date.now().toString() + 'coach_pending_fallback',
                                    timestamp: messageTimestamp
                                };
                                const updated = [...prev, newCoachMessage];
                                return updated.sort((a, b) => {
                                    const timeA = a.timestamp || 0;
                                    const timeB = b.timestamp || 0;
                                    return timeA - timeB;
                                });
                            });
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
                        
                        // Add a delay to ensure conversation history state is updated before ending
                        setTimeout(() => {
                            console.log('[DailyVoiceChat] Conversation complete, calling handleEndSession');
                            handleEndSession();
                        }, 500);
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
      
      const stream = await mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } as any, 
        video: false 
      });
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
    
    // Sort the conversation history one final time by timestamp before saving
    const sortedHistory = [...conversationHistory].sort((a, b) => {
      const timeA = a.timestamp || 0;
      const timeB = b.timestamp || 0;
      return timeA - timeB;
    });
    
    // Log the final conversation history with timestamps for debugging
    console.log('[DailyVoiceChat] Final sorted conversation history:');
    sortedHistory.forEach((msg, index) => {
      console.log(`[DailyVoiceChat] [${index}] ${msg.sender}: "${msg.message.substring(0, 40)}..." (timestamp: ${msg.timestamp || 'missing'})`);
    });
    
    // Update the conversation history with the sorted version
    setConversationHistory(sortedHistory);
    
    // Log the final conversation history
    console.log('[DailyVoiceChat] Final conversation history:', JSON.stringify(sortedHistory));
    
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

    // IMPORTANT: Save conversation to Supabase BEFORE closing
    // This ensures the messages are saved properly
    if (sortedHistory.length > 0) {
      try {
        console.log('[DailyVoiceChat] Saving final conversation before closing...');
        await saveConversationToSupabase(sortedHistory);
        console.log('[DailyVoiceChat] Final conversation saved successfully.');
      } catch (e) {
        console.error('[DailyVoiceChat] Error saving final conversation:', e);
      }
    }
    
    // After saving, call onSessionComplete to pass conversation to parent
    if (onSessionComplete) {
      console.log('[DailyVoiceChat] Calling onSessionComplete with', sortedHistory.length, 'messages');
      onSessionComplete(sortedHistory);
    }
    
    // Refresh the home screen to show updated messages
    if (refreshHomeScreen) {
      console.log('[DailyVoiceChat] Refreshing home screen...');
      refreshHomeScreen();
    }

    // Call the onClose prop to notify parent (e.g., HomeScreen)
    if (onClose) {
      onClose(); 
    }
    
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
  const saveConversationToSupabase = async (history: TimestampedChatMessage[]) => {
    console.log('[DailyVoiceChat] Saving conversation to Supabase...', history.length, 'messages');
    if (!userId) {
      console.error('[DailyVoiceChat] Cannot save conversation: User ID is missing.');
      return;
    }
    
    if (history.length === 0) {
      console.log('[DailyVoiceChat] No messages to save.');
      return;
    }
    
    try {
      // Filter out empty messages and create an array of save operations
      const savePromises = history
        .filter(chatMessage => chatMessage.message.trim() !== '') 
        .map(chatMessage => {
          const messageSender: 'user' | 'coach' = chatMessage.sender === 'user' ? 'user' : 'coach';
          const messagePayload: ChatMessage = {
            sender: messageSender,
            message: chatMessage.message,
          };
          console.log('[DailyVoiceChat] Saving message:', messagePayload.sender, messagePayload.message.substring(0, 30) + (messagePayload.message.length > 30 ? '...' : ''));
          return saveMessage(messagePayload, userId);
        });
      
      // Wait for all save operations to complete
      await Promise.all(savePromises);
      console.log('[DailyVoiceChat] All messages saved successfully.');
      
      // No need to call onSessionComplete here - it's now called in handleEndSession
      // to ensure better sequencing of operations
    } catch (e: any) {
      console.error('[DailyVoiceChat] Error saving conversation to Supabase:', e);
      throw e; // Re-throw so the calling function can handle it
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