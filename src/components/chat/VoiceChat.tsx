import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, Alert, Platform, NativeModules, LogBox } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
// Import WebRTC correctly
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';

// Import InCallManager for speaker control
import InCallManager from 'react-native-incall-manager';

import { useAuth } from '../../hooks/useAuth';
import { checkMicrophonePermission, processVoiceInput } from '../../lib/voice/voiceUtils';
import { voiceSessionManager } from '../../lib/voice/voiceSessionManager';
// Import the coach styles for the prompts
import { coachStyles } from '../../config/coachingGuidelines';

// Import the saveMessage function
import { saveMessage } from '../../services/chat/chatService';
import * as Animatable from 'react-native-animatable'; // Import Animatable
import { MinimalSpinner } from '../ui/MinimalSpinner';

// Create a Logger helper for debugging audio issues
const AudioDebugLogger = {
  log: (message: string, data?: any) => {
    // No-op: Disabled to reduce noise in logs
  },
  error: (message: string, error?: any) => {
    // Only log critical errors
    if (error instanceof Error && error.message.includes('critical')) {
      console.error(`[VOICE_CHAT] Critical error: ${message}`);
    }
  }
};

// Define types for data received from WebRTC
interface TranscriptData {
  text: string;
}

interface MessageData {
  text: string;
}

interface VoiceChatProps {
  isVisible: boolean;
  onClose: () => void;
  coachId: string;
  apiKey: string;
  onError?: (error: string) => void;
  onboardingMode?: boolean;
  onTranscriptComplete?: (userTranscript: string, coachResponse: string, isComplete: boolean, conversationHistory: {role: 'user' | 'coach'; content: string}[]) => void;
  onSpeakingStateChange?: (isSpeaking: boolean, speaker?: 'user' | 'coach') => void;
  useModal?: boolean;
}

const VoiceChat = ({ isVisible, onClose, coachId, apiKey, onError, onboardingMode = false, onTranscriptComplete, onSpeakingStateChange, useModal = true }: VoiceChatProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [responseText, setResponseText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [dataChannel, setDataChannel] = useState<any>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioOutput, setAudioOutput] = useState<MediaStream | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ephemeralKey, setEphemeralKey] = useState<string | null>(null);
  const [conversationComplete, setConversationComplete] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userIsSpeaking, setUserIsSpeaking] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<{role: 'user' | 'coach'; content: string}[]>([]);
  const [finalUserUtterance, setFinalUserUtterance] = useState<string | null>(null);
  
  const userSpeakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const auth = useAuth();
  const userId = auth.session?.user?.id;

  // Add state to track complete coach sentences
  const [isReceivingCoachMessage, setIsReceivingCoachMessage] = useState(false);
  const [pendingTranscript, setPendingTranscript] = useState('');
  const [userHasResponded, setUserHasResponded] = useState(false);
  const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add a function to stop listening and related activities
  const stopListening = () => {
    AudioDebugLogger.log('Stopping listening and audio streams');
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      // setStream(null); // Optionally nullify, but tracks are stopped
    }
    // if (audioOutput) { // AudioOutput is for received audio, not sending
    //   audioOutput.getTracks().forEach(track => track.stop());
    // }
    setIsListening(false);
    setUserIsSpeaking(false);
    setIsSpeaking(false); // Coach is also stopped
    if (userSpeakingTimeoutRef.current) {
      clearTimeout(userSpeakingTimeoutRef.current);
      userSpeakingTimeoutRef.current = null;
    }
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
    if (onSpeakingStateChange) {
      onSpeakingStateChange(false); // General speaking state off
    }
    // Consider if dataChannel or peerConnection should be closed here or in main cleanup
  };

  // Configure audio to use speaker and initialize InCallManager
  useEffect(() => {
    const configureAudio = async () => {
      try {
        AudioDebugLogger.log(`Starting audio configuration. Platform: ${Platform.OS}`);
        
        // Initialize InCallManager
        AudioDebugLogger.log('Initializing InCallManager...');
        InCallManager.start({media: 'audio'});
        
        // Force speaker mode on
        AudioDebugLogger.log('Forcing speaker mode ON with InCallManager');
        InCallManager.setForceSpeakerphoneOn(true);
        
        // Configure expo-av audio mode
        AudioDebugLogger.log('Setting audio mode with expo-av...');
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true, // Keep audio session active in background
          interruptionModeIOS: 1, // Do not mix with other apps' audio
          interruptionModeAndroid: 1, // Do not mix with other apps' audio
          playThroughEarpieceAndroid: false, // Use speaker, not earpiece
          shouldDuckAndroid: true,
        });
        
        // Log permission status for debugging
        try {
          const permissionStatus = await Audio.getPermissionsAsync();
          AudioDebugLogger.log('Audio permission status:', permissionStatus);
        } catch (routeErr) {
          AudioDebugLogger.error('Failed to get permission status', routeErr);
        }
        
        AudioDebugLogger.log('Audio mode configured for speaker output');
      } catch (err) {
        AudioDebugLogger.error('Failed to configure audio mode:', err);
      }
    };

    if (isVisible) {
      configureAudio();
    }

    return () => {
      // Reset audio mode when component unmounts
      AudioDebugLogger.log('Stopping InCallManager and resetting audio mode...');
      
      // Disable speaker mode and stop InCallManager
      InCallManager.setForceSpeakerphoneOn(false);
      InCallManager.stop();
      
      // Reset expo-av audio mode
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        interruptionModeIOS: 1, // Do not mix with other apps' audio
        interruptionModeAndroid: 1, // Do not mix with other apps' audio
        playThroughEarpieceAndroid: true, // Reset to default
        shouldDuckAndroid: true,
      }).catch(err => AudioDebugLogger.error('Failed to reset audio mode:', err));
      
      AudioDebugLogger.log('Audio mode reset');
    };
  }, [isVisible]);

  // Update error state and notify parent component
  const setErrorWithNotification = (errorMessage: string) => {
    setError(errorMessage);
    if (onError) {
      onError(errorMessage);
    }
  };

  // Check microphone permissions when the component mounts
  useEffect(() => {
    if (isVisible) {
      checkMicrophonePermissions();
    }
  }, [isVisible]);

  // Check and request microphone permissions
  const checkMicrophonePermissions = async () => {
    try {
      const permissionGranted = await checkMicrophonePermission();
      setHasPermission(permissionGranted);
      
      if (!permissionGranted) {
        setErrorWithNotification('Microphone permission is required for voice chat.');
      } else {
        // Permissions granted, get ephemeral key
        getEphemeralKey();
      }
    } catch (err) {
      console.error('Error checking permissions:', err);
      setErrorWithNotification('Failed to check microphone permissions.');
    }
  };

  // Get an ephemeral key from OpenAI to use for WebRTC connection
  const getEphemeralKey = async () => {
    try {
      setIsConnecting(true);
      
      // Use direct Supabase URL instead of environment variables
      const supabaseUrl = "https://tdwtacijcmpfnwlovlxh.supabase.co";
      
      console.log('Using direct Supabase URL for ephemeral key request:', supabaseUrl);
      
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }
      
      console.log('Requesting ephemeral key from edge function...');
      
      // Add timeout to the fetch for better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${supabaseUrl}/functions/v1/ephemeral-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini-realtime-preview-2024-12-17',
          voice: 'verse' // Updated from alloy to verse
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to get ephemeral key: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received response:', data ? 'Got data' : 'No data');
      
      const key = data.client_secret?.value;
      
      if (!key) {
        throw new Error('No ephemeral key received from OpenAI');
      }
      
      console.log('Successfully obtained ephemeral key');
      setEphemeralKey(key);
      
      // Initialize WebRTC with the ephemeral key
      initializeWebRTC(key);
    } catch (err) {
      console.error('Error getting ephemeral key:', err);
      setErrorWithNotification(`Failed to initialize OpenAI voice session: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsConnecting(false);
    }
  };

  // Initialize WebRTC connection with OpenAI
  const initializeWebRTC = async (ephemeralKey: string) => {
    try {
      // Create a session ID for tracking conversation
      const newSessionId = voiceSessionManager.startSession(coachId);
      setSessionId(newSessionId);
      
      // Set up WebRTC connection
      AudioDebugLogger.log('Creating RTCPeerConnection...');
      const configuration = { 
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };
      
      // Create peer connection
      const pc = new RTCPeerConnection(configuration);
      AudioDebugLogger.log('RTCPeerConnection created');
      setPeerConnection(pc);
      
      // Create data channel for sending/receiving events
      AudioDebugLogger.log('Creating data channel...');
      const dc = pc.createDataChannel('oai-events');
      setDataChannel(dc);
      
      // Set up event handlers for the data channel
      // Use direct property assignment for event handlers
      // @ts-ignore - WebRTC TypeScript definitions don't match exactly
      dc.onopen = () => {
        AudioDebugLogger.log('Data channel opened');
        
        // Update the session with instructions once connected
        if (dc.readyState === 'open') {
          configureAIInstructions(dc);
        }
      };
      
      // @ts-ignore - WebRTC TypeScript definitions don't match exactly
      dc.onmessage = (event: any) => {
        try {
          const message = JSON.parse(event.data);
          
          // Global event logging for debugging
          const relevantEventTypes = [
            'transcript', // Old event, maybe keep for other uses or remove if fully replaced
            'message', 
            'response.content_part.added', 
            'response.audio_transcript.delta', 
            'response.audio_transcript.done',
            'conversation.item.input_audio_transcription.completed', // New user transcript event
            'error' // Always log errors
          ];

          if (relevantEventTypes.includes(message.type) || (message.type?.includes('response') && message.transcript)) {
            console.log(`[VOICE_EVENT] Received: ${message.type}`, 
                        message.transcript ? { transcriptPreview: String(message.transcript).substring(0,50) + '...' } : 
                        message.delta ? { deltaPreview: String(message.delta).substring(0,50) + '...' } : 
                        message.part ? { partPreview: String(message.part.transcript).substring(0,50) + '...' } : 
                        message.error ? { error: message.error } : {});
          }
          
          // Handle different types of messages
          if (message.type === 'conversation.item.input_audio_transcription.completed') { // Updated event type for user transcript
            handleUserTranscriptComplete(message); // New handler for this specific event
          } else if (message.type === 'message') {
            handleMessage(message);
          } else if (message.type === 'response.content_part.added') {
            handleContentPartAdded(message);
          } else if (message.type === 'response.audio_transcript.delta') {
            handleTranscriptDelta(message);
          } else if (message.type === 'response.audio_transcript.done') {
            handleTranscriptDone(message);
          } else if (message.type === 'error') {
            console.error('[VOICE_CHAT] OpenAI Realtime API Error:', message.error);
            setErrorWithNotification(`OpenAI API Error: ${message.error?.message || 'Unknown error'}`);
          }
        } catch (err) {
          console.error('Error parsing data channel message:', err);
        }
      };
      
      // Handle ICE candidates
      // @ts-ignore - WebRTC TypeScript definitions don't match exactly
      pc.onicecandidate = (event: any) => {
        if (event.candidate) {
          AudioDebugLogger.log('ICE candidate:', event.candidate);
        }
      };
      
      // Handle connection state changes
      // @ts-ignore - WebRTC TypeScript definitions don't match exactly
      pc.onconnectionstatechange = () => {
        AudioDebugLogger.log('Connection state changed:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          AudioDebugLogger.log('WebRTC connection established successfully');
          setIsConnecting(false);
          setIsListening(true);
          
          // Notify parent about speaking state as soon as connection is established
          if (onSpeakingStateChange) {
            onSpeakingStateChange(true, 'coach');
          }
          
          // Ensure speaker mode is on once connection is established
          AudioDebugLogger.log('Re-applying speaker mode when WebRTC connection is established');
          InCallManager.setForceSpeakerphoneOn(true);
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          AudioDebugLogger.error('WebRTC connection failed or disconnected');
          setErrorWithNotification('Connection failed or disconnected');
          setIsConnecting(false);
          setIsListening(false);
          
          // Notify parent about speaking state ended
          if (onSpeakingStateChange) {
            onSpeakingStateChange(false);
          }
        }
      };
      
      // Handle incoming audio tracks
      // @ts-ignore - WebRTC TypeScript definitions don't match exactly
      pc.ontrack = (event: any) => {
        AudioDebugLogger.log('Received track:', event.track.kind);
        if (event.track.kind === 'audio') {
          // Check if track is enabled and active
          AudioDebugLogger.log('Audio track enabled:', event.track.enabled);
          AudioDebugLogger.log('Audio track readyState:', event.track.readyState);
          
          // Create a new MediaStream with the received audio track
          const audioStream = new MediaStream([event.track]);
          setAudioOutput(audioStream);
          
          AudioDebugLogger.log('Audio output stream created');
          
          // Critical timing: Force speaker mode when audio track is received
          AudioDebugLogger.log('Forcing speaker mode ON immediately after receiving audio track');
          InCallManager.setForceSpeakerphoneOn(true);
          
          // Set a timeout to force speaker mode again after a short delay
          // This helps address timing issues where WebRTC might override our settings
          setTimeout(() => {
            AudioDebugLogger.log('Re-applying speaker mode after delay');
            InCallManager.setForceSpeakerphoneOn(true);
          }, 500);
        }
      };
      
      // Get access to the microphone
      AudioDebugLogger.log('Requesting user media for microphone...');
      const userMedia = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } as any,
        video: false
      });
      
      AudioDebugLogger.log('Microphone access granted');
      setStream(userMedia);
      
      // Check if streams are active
      const audioTracks = userMedia.getAudioTracks();
      for (const track of audioTracks) {
        AudioDebugLogger.log(`Audio track "${track.label}" enabled:`, track.enabled);
        AudioDebugLogger.log(`Audio track "${track.label}" readyState:`, track.readyState);
      }
      
      // Add local audio track to the peer connection
      AudioDebugLogger.log('Adding local audio tracks to peer connection...');
      userMedia.getTracks().forEach(track => {
        pc.addTrack(track, userMedia);
      });
      
      // Create and set local description (offer)
      AudioDebugLogger.log('Creating offer...');
      const offer = await pc.createOffer({});
      AudioDebugLogger.log('Setting local description...');
      await pc.setLocalDescription(offer);
      
      // Send the offer to OpenAI's realtime API
      AudioDebugLogger.log('Sending SDP offer to OpenAI...');
      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        },
        body: pc.localDescription?.sdp
      });
      
      if (!sdpResponse.ok) {
        throw new Error(`Failed to send SDP: ${sdpResponse.status}`);
      }
      
      // Get the answer SDP from OpenAI
      AudioDebugLogger.log('Received SDP answer from OpenAI');
      const answerSdp = await sdpResponse.text();
      
      // Set the remote description with the answer from OpenAI
      AudioDebugLogger.log('Setting remote description...');
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp
      });
      
      await pc.setRemoteDescription(answer);
      
      AudioDebugLogger.log('WebRTC setup complete');
      setIsConnecting(false);
      setIsListening(true);
      
    } catch (err) {
      AudioDebugLogger.error('WebRTC setup error:', err);
      setErrorWithNotification(`Failed to set up voice chat: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsConnecting(false);
      
      // Check if error is related to API access or model availability
      if (err instanceof Error && 
          (err.message.includes('API') || 
           err.message.includes('key') || 
           err.message.includes('model'))) {
        setFallbackMode(true);
      }
    }
  };

  // Configure AI with appropriate instructions based on coach style and mode
  const configureAIInstructions = (dc: any) => {
    try {
      // Get coach-specific data
      const coachStyle = coachStyles[coachId];
      
      if (!coachStyle) {
        console.error(`[VOICE_CHAT] Critical: Coach style not found for coachId: ${coachId}. Defaulting instructions.`);
        // Fallback instructions or error handling might be needed here
        // For now, log and proceed with potentially generic instructions
      } else {
        console.log(`[VOICE_CHAT] Configuring AI for coachId: ${coachId}, Name: ${coachStyle.name}`);
      }
      
      // Generate a prompt similar to what we use in onboardingInterview.ts
      let instructions = '';
      
      if (onboardingMode) {
        instructions = `You are ${coachStyle.name}, a running coach having your first conversation with a new athlete.
  
PERSONALITY: ${coachStyle.personality.join(', ')}
COMMUNICATION STYLE: ${coachStyle.communicationStyle.join(', ')}

MODE: INFORMATION_GATHERING

Start the conversation by warmly greeting the user and introducing yourself. Immediately ask your first question to get started.

Conduct a natural, friendly conversation to collect the following information:
- name
- weekly mileage (km or miles)
- how often they run (days per week)
- any past injuries
- shoe size
- clothing size
- schedule constraints
- preferred unit system (km or miles)
- how long they've been running
- target race distance (if any)
- upcoming race date (if any)
- running goals

IMPORTANT: Ask ONLY ONE question at a time and wait for the user to respond. 
Acknowledge their answer before asking the next question.
Make sure to always complete your full thought or question - don't stop mid-sentence.
Keep your responses friendly and encouraging but concise.

When you have collected ALL required information, end by saying "Perfect! I've got all the information I need."
Your final message MUST include the exact phrase "Perfect! I've got all the information I need." for the system to recognize completion.`;
      } else {
        instructions = `You are ${coachStyle.name}, a running coach chatting with an athlete.
  
PERSONALITY: ${coachStyle.personality.join(', ')}
COMMUNICATION STYLE: ${coachStyle.communicationStyle.join(', ')}

Start the conversation with a greeting and introduce yourself.

Keep your responses concise and direct. Answer questions about running, training, and fitness.
Provide specific, actionable advice tailored to the athlete's needs.`;
      }
        
      const event = {
        type: 'session.update',
        session: {
          instructions: instructions,
          input_audio_transcription: { // Enable user input transcription
            model: 'whisper-1' 
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
      
      dc.send(JSON.stringify(event));
      console.log('AI instructions configured');
      
      // Send a response.create event to make the coach speak first
      // This follows OpenAI's documented approach for making the assistant speak first
      setTimeout(() => {
        if (dc.readyState === 'open') {
          const responseCreateEvent = {
            type: 'response.create'
          };
          
          dc.send(JSON.stringify(responseCreateEvent));
          console.log('Sent response.create event to make coach speak first');
          setIsReceivingCoachMessage(true);
        }
      }, 1000);
    } catch (err) {
      console.error('Error configuring AI instructions:', err);
    }
  };

  // Add a periodic check to ensure speaker mode stays on
  useEffect(() => {
    if (!isListening) return;
    
    // Set up a periodic check to ensure speaker is still active
    const interval = setInterval(() => {
      if (isListening) {
        AudioDebugLogger.log('Periodic check: Re-applying speaker mode with InCallManager');
        InCallManager.setForceSpeakerphoneOn(true);
      }
    }, 1000); // Check every second
    
    return () => clearInterval(interval);
  }, [isListening]);

  // Helper function to save messages to Supabase
  const saveMessageToSupabase = async (
    sender: 'coach' | 'user',
    message: string,
    source: string,
    userId: string,
    metadata?: any
  ) => {
    try {
      await saveMessage({
        sender,
        message,
        timestamp: new Date().toISOString()
      }, userId);
    } catch (err) {
      console.error('Error saving message to Supabase:', err);
    }
  };

  // Handle transcript messages - Update to detect when user is speaking
  // This function will now be SPECIFICALLY for USER'S completed transcript
  const handleUserTranscriptComplete = (message: any) => {
    if (message.transcript) {
      const userText = processVoiceInput(String(message.transcript).trim());
      console.log('[VOICE_CHAT] User transcript received (input_audio_transcription.completed):', userText);

      if (!userText) return;

      // User has spoken. Set their final utterance.
      // The useEffect for finalUserUtterance will add it to history.
      setFinalUserUtterance(userText);
      setTranscript(userText); // Keep a copy for potential immediate use if needed, though history is primary

      setUserIsSpeaking(false); // User has finished this utterance
      if (onSpeakingStateChange && !isSpeaking) { // If coach isn't also speaking
        onSpeakingStateChange(false);
      }
      
      // Trigger coach response if in onboarding mode and conditions met
      if (onboardingMode && dataChannel && dataChannel.readyState === 'open' && !conversationComplete) {
        // Delay slightly to allow state updates and simulate natural turn-taking
        setTimeout(() => {
          // Check if it's appropriate for the coach to respond
          // isReceivingCoachMessage should be false
          if (!isReceivingCoachMessage) { 
            console.log('[VOICE_CHAT] User turn complete. Sending response.create for coach.');
            const responseCreateEvent = {
              type: 'response.create'
            };
            dataChannel.send(JSON.stringify(responseCreateEvent));
            setIsReceivingCoachMessage(true); // Coach is about to speak
            setUserHasResponded(false); // Reset for the next user turn (though setUserHasResponded might be redundant now)
      }
        }, 1000); // Adjust delay as needed
      }
    } else {
      console.log('[VOICE_CHAT] Received conversation.item.input_audio_transcription.completed but no transcript content.', message);
    }
  };

  // Handle message data - add check for connection initialization message
  const handleMessage = (message: any) => {
    if (message.text) {
      const messageText = String(message.text).trim();
      if (!messageText) return;

      console.log('[VOICE_CHAT_EVENT] Received RAW MESSAGE event:', messageText);
      setIsSpeaking(true);
      if (onSpeakingStateChange) onSpeakingStateChange(true, 'coach');

      // Accumulate message parts
      setPendingTranscript(prev => (prev ? `${prev} ${messageText}` : messageText).trim());
      setIsReceivingCoachMessage(true);

      // Check if the current accumulated pendingTranscript ends with punctuation
      // This is a more reliable way to detect a complete thought from the coach
      if (pendingTranscript.match(/[.!?]$/)) {
        console.log('[VOICE_CHAT_HISTORY_DEBUG] Coach message complete (punctuation). Pending transcript:', pendingTranscript);
        const coachMessageEntry = { role: 'coach' as const, content: pendingTranscript };
        
        console.log('[VOICE_CHAT_HISTORY_DEBUG] Attempting to add COACH message (from handleMessage). Current history size:', conversationHistory.length);
        setConversationHistory(prev => {
          const newHistory = [...prev, coachMessageEntry];
          console.log('[VOICE_CHAT_HISTORY_DEBUG] After adding COACH message (from handleMessage). New history size:', newHistory.length);
          console.log('[VOICE_CHAT_HISTORY_DEBUG] COACH History (handleMessage) Details:', JSON.stringify(newHistory, null, 2));
          return newHistory;
        });
        
        setResponseText(pendingTranscript); // Update UI with complete message
        setPendingTranscript(''); // Clear pending for next message
        setIsReceivingCoachMessage(false);
        setIsSpeaking(false); // Coach has finished this turn
        if (onSpeakingStateChange) onSpeakingStateChange(false); // Notify parent

        // Reset user response tracking
        setUserHasResponded(false);
        if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = setTimeout(() => {
          if (!userHasResponded) {
            console.log('[VOICE_CHAT] No user response detected after coach message timeout');
      }
        }, 5000);
      }
      // Fallback timeout if punctuation is missed but there's a pause
      if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = setTimeout(() => {
        if (isReceivingCoachMessage && pendingTranscript) { // If still receiving and there's content
            console.log('[VOICE_CHAT_HISTORY_DEBUG] Coach message complete (timeout). Pending transcript:', pendingTranscript);
            const coachMessageEntry = { role: 'coach' as const, content: pendingTranscript };
            
            console.log('[VOICE_CHAT_HISTORY_DEBUG] Attempting to add COACH message (timeout in handleMessage). Current history size:', conversationHistory.length);
            setConversationHistory(prev => {
              const newHistory = [...prev, coachMessageEntry];
              console.log('[VOICE_CHAT_HISTORY_DEBUG] After adding COACH message (timeout in handleMessage). New history size:', newHistory.length);
              console.log('[VOICE_CHAT_HISTORY_DEBUG] COACH History (timeout in handleMessage) Details:', JSON.stringify(newHistory, null, 2));
              return newHistory;
            });

            setResponseText(pendingTranscript);
            setPendingTranscript('');
            setIsReceivingCoachMessage(false);
            setIsSpeaking(false); // Coach has finished this turn
            if (onSpeakingStateChange) onSpeakingStateChange(false); // Notify parent
        }
      }, 1200); // Consider message complete after 1.2s of no new parts

    }
  };

  // Handle completed transcript (typically from audio_transcript.done)
  const handleTranscriptDone = (message: any) => {
    if (message.transcript) {
      const transcriptText = String(message.transcript).trim();
      if (!transcriptText) return;

      console.log('[VOICE_CHAT_EVENT] Received TRANSCRIPT.DONE event:', transcriptText);

      // If there was a pending message (from handleMessage), that should be considered the full message.
      // transcript.done might sometimes be partial or just the last segment.
      const finalCoachMessage = pendingTranscript ? pendingTranscript : transcriptText;
      setPendingTranscript(''); // Clear pending as we are finalizing
      // setIsReceivingCoachMessage(false); // Moved down

      const coachMessageEntry = { role: 'coach' as const, content: finalCoachMessage };
      console.log('[VOICE_CHAT_HISTORY_DEBUG] Attempting to add COACH message (from transcript.done). Current history size:', conversationHistory.length);
      
      // This will be the setConversationHistory that calls onTranscriptComplete
      let historyForCallback: {role: 'user' | 'coach'; content: string}[] = [];

      setConversationHistory(prev => {
        // Avoid duplicates if handleMessage already added this exact message via timeout/punctuation
        if (prev.length > 0 && prev[prev.length - 1].role === 'coach' && prev[prev.length - 1].content === finalCoachMessage) {
          console.log('[VOICE_CHAT_HISTORY_DEBUG] COACH message (transcript.done) is a duplicate of last message. Skipping add.');
          historyForCallback = prev;
          return prev;
        }
        const newHistory = [...prev, coachMessageEntry];
        console.log('[VOICE_CHAT_HISTORY_DEBUG] After adding COACH message (from transcript.done). New history size:', newHistory.length);
        console.log('[VOICE_CHAT_HISTORY_DEBUG] COACH History (transcript.done) Details:', JSON.stringify(newHistory, null, 2));
        historyForCallback = newHistory;
        return newHistory;
      });
      setResponseText(finalCoachMessage);

      const completionPhrases = [
        "i've got everything i need",
        "i've got all the information i need",
        "got all the information i need"
      ];
      const lowerTranscript = finalCoachMessage.toLowerCase();
      const matchedPhrase = completionPhrases.find(phrase => lowerTranscript.includes(phrase));

      if (matchedPhrase) {
        console.log('[VOICE_COMPLETION] ✅ Completion phrase in transcript.done message:', finalCoachMessage);
        
        // Wait for TTS to finish before finalizing the conversation
        // Estimate time based on message length (about 2.5 words per second for TTS)
        const wordCount = finalCoachMessage.split(/\s+/).length;
        const estimatedSeconds = Math.max(3, Math.min(10, wordCount / 2.5)); // Between 3-10 seconds
        
        console.log(`[VOICE_COMPLETION] Waiting ${estimatedSeconds.toFixed(1)} seconds for final TTS to complete before finishing conversation`);
        
        // Don't immediately set conversation as complete - let TTS finish playing
        // Instead, wait for the estimated time before triggering the completion
        setTimeout(() => {
          setConversationComplete(true); // Mark as complete
          
          // Use another small timeout to ensure state updates flush before calling stopListening and onTranscriptComplete
          setTimeout(() => {
            // Access the latest history via the variable populated by setConversationHistory's callback
            console.log('[VOICE_COMPLETION] FINAL HISTORY (transcript.done):', JSON.stringify(historyForCallback, null, 2));
            if (onTranscriptComplete) {
              const lastUserTranscript = transcript || ''; // `transcript` state holds the last user utterance
              onTranscriptComplete(lastUserTranscript, finalCoachMessage, true, historyForCallback);
            }
            stopListening(); // This will set isSpeaking to false and clean up
            setIsReceivingCoachMessage(false); 
          }, 100); // Short delay
        }, estimatedSeconds * 1000); // Delay based on estimated TTS duration
      } else {
        // If not a completion phrase, coach's turn is still over
        setIsReceivingCoachMessage(false);
        setIsSpeaking(false);
        if (onSpeakingStateChange) onSpeakingStateChange(false);
      }
    }
  };

  // Handle content part added from OpenAI's streaming API
  const handleContentPartAdded = (message: any) => {
    if (message.part && message.part.transcript) {
      const contentPart = String(message.part.transcript).trim();
      if (!contentPart) return;

      console.log('[VOICE_CHAT_EVENT] Received CONTENT_PART.ADDED event:', contentPart);
      
      // Append to pending transcript
      setPendingTranscript(prev => (prev ? `${prev} ${contentPart}` : contentPart).trim());
      setIsReceivingCoachMessage(true);

      // No history addition here; wait for handleMessage logic (punctuation/timeout) or handleTranscriptDone
      // However, we can check for completion phrase in the accumulating pendingTranscript

      const currentAccumulated = pendingTranscript + contentPart; // Approx current full message being built
      const completionPhrases = [
        "i've got everything i need",
        "i've got all the information i need",
        "got all the information i need"
      ];
      const lowerAccumulated = currentAccumulated.toLowerCase();
      const matchedPhrase = completionPhrases.find(phrase => lowerAccumulated.includes(phrase));

      if (matchedPhrase && !conversationComplete) { // Check !conversationComplete to avoid multiple triggers
        const finalMessageForCompletion = currentAccumulated.trim();
        console.log('[VOICE_COMPLETION] ✅ Completion phrase in content_part.added (accumulated):', finalMessageForCompletion);
        
        // Wait for TTS to finish before finalizing the conversation
        // Estimate time based on message length (about 2.5 words per second for TTS)
        const wordCount = finalMessageForCompletion.split(/\s+/).length;
        const estimatedSeconds = Math.max(3, Math.min(10, wordCount / 2.5)); // Between 3-10 seconds
        
        console.log(`[VOICE_COMPLETION] Waiting ${estimatedSeconds.toFixed(1)} seconds for final TTS to complete before finishing conversation`);
        
        // Flag as complete, but wait before triggering completion callbacks
        setConversationComplete(true);

        setTimeout(() => {
          if (dataChannel) {
            const coachFinalMessageEntry = { role: 'coach' as const, content: finalMessageForCompletion };
            setConversationHistory(prevHistory => {
              if (prevHistory.length > 0 && prevHistory[prevHistory.length - 1].role === 'coach' && prevHistory[prevHistory.length - 1].content === finalMessageForCompletion) {
                 console.log('[VOICE_CHAT_HISTORY_DEBUG] COACH message (content_part) is a duplicate. Skipping add.');
                 return prevHistory;
              }
              const newHistory = [...prevHistory, coachFinalMessageEntry];
              console.log('[VOICE_COMPLETION] FINAL HISTORY (content_part.added):', JSON.stringify(newHistory, null, 2));
              if (onTranscriptComplete) {
                const lastUserTranscript = transcript || '';
                onTranscriptComplete(lastUserTranscript, finalMessageForCompletion, true, newHistory);
              }
              stopListening();
              setPendingTranscript('');
              setIsReceivingCoachMessage(false);
              return newHistory;
            });
          }
        }, estimatedSeconds * 1000); // Delay based on estimated TTS duration
      }
    }
  };
  
  // Handle transcript delta events - use these to track completion phrase
  const handleTranscriptDelta = (message: any) => {
    if (message.delta) {
      const delta = message.delta;
      
      // Only log deltas that might be part of our completion phrase for cleaner logs
      if (delta.toLowerCase().includes("got") || 
          delta.toLowerCase().includes("need") || 
          delta.toLowerCase().includes("information") ||
          delta.toLowerCase().includes("everything") || 
          delta.toLowerCase().includes("perfect")) {
            
        console.log('[VOICE_COMPLETION] Interesting transcript delta:', { 
          delta,
          fullDelta: message
        });
      }
    }
  };

  // useEffect to add final user utterance to history
  useEffect(() => {
    if (finalUserUtterance) { // Simplified condition: if there's a final user utterance, add it.
      const userMessageEntry = { role: 'user' as const, content: finalUserUtterance };
      console.log('[VOICE_CHAT_HISTORY_DEBUG] Attempting to add USER message (from finalUserUtterance effect). Content:', finalUserUtterance);
      setConversationHistory(prev => {
        // Prevent adding empty or duplicate consecutive user messages if any race condition led to that
        if (finalUserUtterance.trim() && 
            (prev.length === 0 || 
             prev[prev.length -1].role !== 'user' || 
             prev[prev.length -1].content !== finalUserUtterance)) {
          const newHistory = [...prev, userMessageEntry];
          console.log('[VOICE_CHAT_HISTORY_DEBUG] After adding USER message (from finalUserUtterance effect). New history size:', newHistory.length);
          console.log('[VOICE_CHAT_HISTORY_DEBUG] USER History (from finalUserUtterance effect) Details:', JSON.stringify(newHistory, null, 2));
          return newHistory;
        }
        console.log('[VOICE_CHAT_HISTORY_DEBUG] Skipping add USER message (empty or duplicate).');
        return prev;
      });
      setTranscript(''); // Clear live transcript state after adding to history
      setFinalUserUtterance(null); // Reset for next utterance
      }
  }, [finalUserUtterance]); // Removed isSpeaking from dependencies

  // Clean up when component unmounts or modal closes
  useEffect(() => {
    return () => {
      // Clear any pending timeout
      if (userSpeakingTimeoutRef.current) {
        clearTimeout(userSpeakingTimeoutRef.current);
        userSpeakingTimeoutRef.current = null;
      }
      
      // Clear response timeout
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = null;
      }
      
      // Reset speaking state when component unmounts
      if (isSpeaking || userIsSpeaking) {
        setIsSpeaking(false);
        setUserIsSpeaking(false);
        if (onSpeakingStateChange) {
          onSpeakingStateChange(false);
        }
      }
      cleanupResources();
    };
  }, [isSpeaking, userIsSpeaking, onSpeakingStateChange]);

  const cleanupResources = useCallback(() => {
    AudioDebugLogger.log('Cleaning up voice chat resources');
    if (stream) {
      stream.getTracks().forEach(track => {
        AudioDebugLogger.log(`Stopping track: ${track.kind}`);
        track.stop();
      });
      setStream(null);
    }
    
    if (audioOutput) {
      audioOutput.getTracks().forEach(track => {
        AudioDebugLogger.log(`Stopping audio output track: ${track.kind}`);
        track.stop();
      });
      setAudioOutput(null);
    }
    
    if (dataChannel) {
      AudioDebugLogger.log('Closing data channel');
      dataChannel.close();
      setDataChannel(null);
    }
    
    if (peerConnection) {
      AudioDebugLogger.log('Closing peer connection');
      peerConnection.close();
      setPeerConnection(null);
    }
    
    if (sessionId) {
      voiceSessionManager.endSession();
      setSessionId(null);
    }
    
    // Stop InCallManager
    AudioDebugLogger.log('Stopping InCallManager');
    InCallManager.setForceSpeakerphoneOn(false);
    InCallManager.stop();
    
    // Clear any pending timeouts
    if (userSpeakingTimeoutRef.current) {
      clearTimeout(userSpeakingTimeoutRef.current);
      userSpeakingTimeoutRef.current = null;
    }
    
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
    
    // Reset state
    setTranscript('');
    setResponseText('');
    setPendingTranscript('');
    setConversationComplete(false);
    setIsReceivingCoachMessage(false);
    setUserHasResponded(false);
    
    AudioDebugLogger.log('All resources cleaned up');
  }, [stream, audioOutput, dataChannel, peerConnection, sessionId]);

  const handleCloseModal = useCallback(() => {
    console.log('Closing voice chat modal');
    
    // Notify parent that speaking state has ended
    if (onSpeakingStateChange) {
      onSpeakingStateChange(false);
    }
    
    cleanupResources();
    onClose();
  }, [cleanupResources, onClose, onSpeakingStateChange]);
  
  const reconnect = () => {
    cleanupResources();
    setError(null);
    setIsConnecting(false);
    setIsListening(false);
    checkMicrophonePermissions(); // Start the connection process again
  };

  // Handle fallback to text chat
  const handleFallbackToText = () => {
    setFallbackMode(false);
    onClose();
  };

  // Effect to handle auto-closing when conversation is complete
  useEffect(() => {
    if (conversationComplete && onboardingMode) {
      console.log('Conversation complete state changed to true');
    }
  }, [conversationComplete, onboardingMode]);

  // Extract the inner content of the component
  const renderContent = () => {
  return (
      <>
          {error ? (
            <View className="items-center justify-center py-4">
              <Text className="text-red-500 mb-3">{error}</Text>
              <View className="flex-row">
                <TouchableOpacity 
                className="bg-purple-500 px-4 py-2 rounded-lg mr-2" 
                  onPress={fallbackMode ? handleFallbackToText : onClose}
                >
                  <Text className="text-white font-semibold">
                    {fallbackMode ? "Use Text Chat" : "Switch to Text"}
                  </Text>
                </TouchableOpacity>
                
                {!fallbackMode && (
                  <TouchableOpacity 
                    className="bg-green-500 px-4 py-2 rounded-lg" 
                    onPress={reconnect}
                  >
                    <Text className="text-white font-semibold">Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <>
            <View className="items-center justify-center my-2">
                {isConnecting ? (
                  <>
                  <MinimalSpinner size={48} color="#8B5CF6" thickness={3} />
                  <Text className="mt-2 text-gray-600">Connecting to your coach...</Text>
                  </>
                ) : isListening ? (
                  <>
                  {/* Microphone icon removed when connected to coach */}
                  </>
                ) : null}
              </View>

            {/* Remove ALL message displays - both user and coach */}
            </>
          )}
      </>
    );
  };

  // Only render the component when it's visible
  if (!isVisible) {
    return null;
  }

  // Render with or without modal based on the useModal prop
  if (useModal) {
    return (
      <Modal
        visible={isVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="w-4/5 bg-white rounded-xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold">Voice Coach</Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <FontAwesome name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            {renderContent()}
        </View>
      </View>
    </Modal>
  );
  } else {
    // Render inline without modal - with improved styling
    return (
      <View className="bg-transparent w-full">
        {/* Close button for inline mode */}
        <View className="items-end mb-2">
          <TouchableOpacity 
            onPress={handleCloseModal}
            className="bg-gray-200 rounded-full w-8 h-8 items-center justify-center"
          >
            <FontAwesome name="close" size={16} color="#000" />
          </TouchableOpacity>
        </View>
        
        {renderContent()}
      </View>
    );
  }
};

export default VoiceChat; 