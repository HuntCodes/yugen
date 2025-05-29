import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Platform, AppState } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
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
import { v4 } from 'uuid';

import { environment } from '../../config/environment';
import { OnboardingProfile as Profile } from '../../types/onboarding';
import { TrainingSession } from '../../screens/main/training/components/types';
import { PlanUpdate } from '../../types/planUpdate';
import { saveMessage } from '../../services/chat/chatService';
import * as planService from '../../services/plan/planService';
import * as feedbackService from '../../services/feedback/feedbackService';

// Import the new hooks and types
import { ChatMessage as CoreChatMessage, MessageHandlerParams } from '../../hooks/chat/useMessageTypes'; // Renamed to avoid conflict
import { useMessageFormatting } from '../../hooks/chat/useMessageFormatting'; // Import for system prompt
import { MinimalSpinner } from '../ui/MinimalSpinner';

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
interface TimestampedChatMessage extends CoreChatMessage {
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
  onSessionComplete: (conversationHistory: CoreChatMessage[], confirmedPlanUpdate?: PlanUpdate) => void;
  onError: (error: string) => void;
  onClose: () => void;
  onSpeakingStateChange?: (isSpeaking: boolean, speaker?: 'user' | 'coach') => void;
  isVisible: boolean;
  refreshHomeScreen?: () => void;
}

// Add explicit types for WebRTC message events
interface RTCMessageEvent {
  data: string;
  target: RTCDataChannel;
}

interface RTCErrorEvent {
  error: Error;
  target: RTCDataChannel;
}

// Provide dummy event handlers with arguments for TypeScript 
interface DummyRTCCallbacks {
  onopen?: (event: Event) => void;
  onmessage?: (event: RTCMessageEvent) => void;
  onerror?: (event: RTCErrorEvent) => void;
  onclose?: (event: Event) => void;
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
  // --- STATE ---
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isCoachSpeakingTTS, setIsCoachSpeakingTTS] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<TimestampedChatMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [pendingCoachResponse, setPendingCoachResponse] = useState('');
  const [error, setErrorState] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [conversationComplete, setConversationComplete] = useState(false);
  const [userIsActuallySpeaking, setUserIsActuallySpeaking] = useState(false);
  const [isReceivingCoachMessage, setIsReceivingCoachMessage] = useState(false);
  const [showAnimatedCoachView, setShowAnimatedCoachView] = useState(false);
  const [userTranscriptJustReceived, setUserTranscriptJustReceived] = useState(false);
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [isInitializedThisSession, setIsInitializedThisSession] = useState(false);
  const [userFeedback, setUserFeedback] = useState<any>(null);
  
  // Track accumulated function call arguments
  const [pendingFunctionArgs, setPendingFunctionArgs] = useState<{[callId: string]: string}>({});
  const pendingFunctionArgsRef = useRef<{[callId: string]: string}>({});
  
  // Track function names by call_id
  const [functionNameMap, setFunctionNameMap] = useState<{[callId: string]: string}>({});
  const functionNameMapRef = useRef<{[callId: string]: string}>({});

  // --- REFS ---
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
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const wasVisibleRef = useRef(isVisible);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  // --- HOOKS ---
  const { buildSystemPrompt, getToolsDefinitionForRealtimeAPI, buildUserContextString } = useMessageFormatting();

  // --- EFFECT: Show/hide animated coach view based on state ---
  useEffect(() => {
    const pc = peerConnectionRef.current;
    const isConnected = pc?.connectionState === 'connected';
    
    // Show the animated coach view if:
    // 1. Connection is established OR
    // 2. Not loading and not connecting and no errors and has permission and is visible OR
    // 3. The coach is speaking/responding
    const shouldShowCoach = 
      isConnected ||
      (!isLoading && !isConnecting && !error && hasPermission && isVisible) ||
      isCoachSpeakingTTS || 
      isReceivingCoachMessage;
    
    console.log('[DailyVoiceChat] Setting coach visibility to:', shouldShowCoach, 
      'connection state:', pc?.connectionState || 'no connection');
      
    setShowAnimatedCoachView(shouldShowCoach);
    
    // If showAnimatedCoachView is being enabled, also ensure loading is set to false
    if (shouldShowCoach && isLoading) {
      setIsLoading(false);
    }
  }, [isLoading, isConnecting, error, hasPermission, isVisible, isCoachSpeakingTTS, isReceivingCoachMessage]);

  // --- EFFECT: Fetch user feedback when component initializes ---
  useEffect(() => {
    if (userId && isVisible) {
      // Fetch user training feedback
      const fetchFeedback = async () => {
        try {
          const result = await feedbackService.fetchUserTrainingFeedback(userId);
          if (result.data) {
            console.log('[DailyVoiceChat] User feedback loaded:', result.data.feedback_summary || 'No summary');
            setUserFeedback(result.data);
          }
        } catch (err) {
          console.error('[DailyVoiceChat] Error fetching user feedback:', err);
        }
      };
      
      fetchFeedback();
    }
  }, [userId, isVisible]);

  // --- HANDLERS & UTILITY FUNCTIONS ---
  const handleError = useCallback((errorMessage: string, critical = false) => {
    console.error(`[DailyVoiceChat] Error: ${errorMessage}`);
    setErrorState(errorMessage);
    if (onError) {
      onError(errorMessage);
    }
    if (critical) {
      console.log("[DailyVoiceChat] Critical error, potentially closing or fallback.");
      
      // For critical API errors, enable fallback mode
      if (errorMessage.includes('API') || 
          errorMessage.includes('OpenAI') || 
          errorMessage.includes('404') ||
          errorMessage.includes('key')) {
        console.log("[DailyVoiceChat] API-related error, enabling fallback mode");
        setFallbackMode(true);
      }
    }
  }, [onError]);

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
    setIsInitializedThisSession(false);
  }, [stopAudioProcessing]);
  
  const fullCleanupAndClose = useCallback(() => {
    if (cleanupScheduledRef.current) return;
    cleanupScheduledRef.current = true;
    console.log('[DailyVoiceChat] Performing full cleanup and close...');

    fullCleanup();
    onClose(); 
    
    setTimeout(() => {
        cleanupScheduledRef.current = false;
    }, 100);
  }, [fullCleanup, onClose]);

  const handleSwitchToTextChat = useCallback(() => {
    console.log('[DailyVoiceChat] Switching to text chat');
    
    // Clean up all voice resources
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
    
    // Clean up audio resources
    InCallManager.setForceSpeakerphoneOn(false);
    InCallManager.stop();
    
    // Reset state
    setFallbackMode(false);
    setIsInitializedThisSession(false);
    
    // Clean up TTS if active
    if (ttsPlayerRef.current) {
      ttsPlayerRef.current.unloadAsync().catch(e => 
        console.warn('[DailyVoiceChat] Error unloading TTS player:', e)
      );
      ttsPlayerRef.current = null;
    }
    
    // Call onClose to let parent handle switching to text chat
    if (onClose) {
      onClose();
    }
  }, [onClose, stopAudioProcessing]);

  const startAudioProcessing = useCallback(async () => {
    if (!localStreamRef.current || !peerConnectionRef.current || isListening) {
        console.log('[DailyVoiceChat] Cannot start audio processing: stream/PC not ready or already listening.');
        return;
    }
    console.log('[DailyVoiceChat] Starting audio processing / listening...');
    setIsListening(true); 
    if (onSpeakingStateChange) onSpeakingStateChange(true, 'user');
  }, [isListening, onSpeakingStateChange]);

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

  // --- AI CONFIGURATION ---
  const configureAIInstructions = useCallback((dc: any) => { 
    if (dc && dc.readyState === 'open') {
        // Get basic system instructions with today's and tomorrow's training and coach information
        const systemInstructions = buildSystemPrompt(currentTrainingPlan || undefined, coachId);
        
        // Get tools definition
        const toolsDefinition = getToolsDefinitionForRealtimeAPI();
        
        // Build user context if profile exists
        let userContext = '';
        if (profile && currentTrainingPlan) {
          try {
            // Use the same context building function as regular chat for consistency
            userContext = buildUserContextString(
              profile,
              currentTrainingPlan,
              conversationHistory, // Use the conversationHistory state variable
              userFeedback // User feedback if available
            );
            
            console.log('[DailyVoiceChat] User context prepared, includes training plan with workouts:', 
              currentTrainingPlan?.length || 0);
          } catch (err) {
            console.error('[DailyVoiceChat] Error building user context:', err);
            userContext = `## Your Profile:\n- Name: ${profile?.nickname || 'Athlete'}\n- Coach: ${coachName}\n`;
          }
        }
        
        // Combine system instructions and user context
        const fullPrompt = systemInstructions + '\n\n' + userContext;
        
        // Log the full prompt for debugging
        console.log('[DailyVoiceChat] Full prompt being sent to AI:');
        console.log('=====================================');
        console.log(fullPrompt);
        console.log('=====================================');
        
        // Send the basic update event first
        const basicSessionUpdateEvent = {
          type: 'session.update',
          session: {
            instructions: fullPrompt,
            input_audio_transcription: { // Enable user input transcription
              model: 'whisper-1' 
            },
            input_audio_noise_reduction: {
              type: "near_field"
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.8,
              prefix_padding_ms: 800,
              silence_duration_ms: 800,
              create_response: true,
              interrupt_response: true
            }
          }
        };
        
        dc.send(JSON.stringify(basicSessionUpdateEvent));
        console.log('[DailyVoiceChat] Sent basic session.update event with AI configuration.');
        
        // Log the exact structure of tools for debugging
        console.log('[DailyVoiceChat] Tools structure:', JSON.stringify(toolsDefinition));
        
        // Now send the tools configuration separately with reduced delay (1000ms → 800ms)
        setTimeout(() => {
          if (dc.readyState === 'open') {
            try {
              // Send the tools configuration separately
              const toolsUpdateEvent = {
                type: 'session.update',
                session: {
                  tools: toolsDefinition
                }
              };
              
              console.log('[DailyVoiceChat] Full tools update event:', JSON.stringify(toolsUpdateEvent));
              dc.send(JSON.stringify(toolsUpdateEvent));
              console.log('[DailyVoiceChat] Sent tools configuration separately.');
              
              // Make coach speak first with a friendly greeting after a short delay
              // We'll rely on the system prompt to guide the initial message
              // Reduced delay (1000ms → 700ms)
              setTimeout(() => {
                if (dc.readyState === 'open') {
                  // Simply use response.create - this is the safe approach that won't break the connection
                  const responseCreateEvent = {
                    type: 'response.create'
                  };
                  dc.send(JSON.stringify(responseCreateEvent));
                  console.log('[DailyVoiceChat] Sent response.create event to make coach speak first');
                  setIsReceivingCoachMessage(true);
                }
              }, 700);
            } catch (e) {
              console.error('[DailyVoiceChat] Error sending tools configuration:', e);
            }
          }
        }, 800);
        
    } else {
        console.error('[DailyVoiceChat] Cannot configure AI: DataChannel not open or not available.');
        handleError('Failed to configure AI: DataChannel not ready.', true);
        setFallbackMode(true);
    }
  }, [buildSystemPrompt, getToolsDefinitionForRealtimeAPI, handleError, profile, currentTrainingPlan, conversationHistory, userFeedback, coachId]);

  // --- NETWORK OPERATIONS ---
  const getEphemeralKey = useCallback(async () => {
    if (!isVisible) {
      console.log('[DailyVoiceChat] Not visible, skipping ephemeral key request');
      return;
    }
    
    try {
    console.log('[DailyVoiceChat] Requesting ephemeral key...');
    setIsConnecting(true);
      
      // Use direct Supabase URL
      const supabaseUrl = "https://tdwtacijcmpfnwlovlxh.supabase.co";
      
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }
      
      // Add timeout to the fetch for better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/ephemeral-key`, {
        method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini-realtime-preview-2024-12-17',
            voice: 'verse'
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
      if (!response.ok) {
          throw new Error(`Failed to get ephemeral key: ${response.status}`);
      }
        
      const data = await response.json();
        console.log('[DailyVoiceChat] Ephemeral key received successfully.');
        
      const key = data.client_secret?.value; 
        
      if (!key) {
          throw new Error('No ephemeral key received from OpenAI');
      }
        
      ephemeralKeyRef.current = key;
        
        // Initialize WebRTC only if we're still visible and we have the initializeWebRTC function
        if (isVisible && initializeWebRTCRef.current) {
          console.log('[DailyVoiceChat] Calling initializeWebRTC with ephemeral key');
        initializeWebRTCRef.current(key);
      } else {
          console.log('[DailyVoiceChat] Got key but component state changed, not initializing WebRTC');
      setIsConnecting(false);
    }
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    } catch (err) {
      console.error('[DailyVoiceChat] Error getting ephemeral key:', err);
      handleError(`Failed to get ephemeral key: ${err instanceof Error ? err.message : 'Unknown error'}`, true);
      setIsConnecting(false);
      setIsLoading(false);
      
      // Consider fallback mode for API-related errors
      if (err instanceof Error && 
         (err.message.includes('API') || err.message.includes('key') || err.message.includes('ephemeral'))) {
        setFallbackMode(true);
    }
    }
  }, [isVisible, handleError]);

  const initializeWebRTC = useCallback(async (token: string) => {
    try {
      if (!isVisible) {
        console.log('[DailyVoiceChat] Component not visible, skipping WebRTC initialization');
        return;
    }
      
      console.log('[DailyVoiceChat] Initializing WebRTC with OpenAI Realtime API...');
      
      // Create a session ID for tracking conversation
      const sessionId = v4(); // Assuming UUID is used
      
      // Set up WebRTC connection
      const configuration = { 
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };
      
      // Create peer connection
      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;
      
      // Create data channel for sending/receiving events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      // Set up event handlers for the data channel
      // @ts-ignore - Using onopen instead of addEventListener for compatibility
      dc.onopen = () => {
        console.log('[DailyVoiceChat] Data channel opened');
        
        // Don't send instructions if component isn't visible anymore
        if (!isVisible) {
          console.log('[DailyVoiceChat] Component not visible, skipping AI instructions');
          return;
        }
        
        // Send instructions when data channel opens
        if (dc.readyState === 'open') {
          configureAIInstructions(dc);
        }
      };
      
      // @ts-ignore - Using onmessage instead of addEventListener for compatibility
      dc.onmessage = (event: RTCMessageEvent) => {
        console.log('[DailyVoiceChat] Data channel message:', 
          typeof event.data === 'string' ? event.data.substring(0, 100) + '...' : 'Non-string data');
        try {
          const data = JSON.parse(event.data);
          
          // Log message type for debugging
          console.log('[DailyVoiceChat] Message type:', data.type);
          
          // Handle error messages
          if (data.type === 'error') {
            console.error('[DailyVoiceChat] API ERROR:', JSON.stringify(data.error || data));
            handleError(`OpenAI API error: ${data.error?.message || 'Unknown error'}`, false);
          }
          
          // Handle specific events
          else if (data.type === 'session.created' || data.type === 'session.updated') {
            // Session is ready, ensure we're not in loading state
            console.log('[DailyVoiceChat] Session is ready:', data.type);
            setIsLoading(false);
            setIsConnecting(false);
          }
          
          // Handle speech created event (coach is speaking)
          else if (data.type === 'speech.created') {
            console.log('[DailyVoiceChat] Speech created event received');
            setIsCoachSpeakingTTS(true);
            setShowAnimatedCoachView(true); // Ensure coach is visible when speaking
            
            // If there's audio data, play it
            if (data.speech && data.speech.chunk) {
              playTTSAudio(data.speech.chunk);
            }
          }
          
          // Handle speech completed event
          else if (data.type === 'speech.completed') {
            console.log('[DailyVoiceChat] Speech completed event received');
            setIsCoachSpeakingTTS(false);
          }
          
          // Process response.created event (a new coach response is starting)
          else if (data.type === 'response.created') {
            console.log('[DailyVoiceChat] New response is being created');
            setIsReceivingCoachMessage(true);
            setShowAnimatedCoachView(true); // Ensure coach is visible when responding
          }
          
          // Process response.done event (coach has completed response)
          else if (data.type === 'response.done') {
            console.log('[DailyVoiceChat] Response completed');
            setIsReceivingCoachMessage(false);
          }
          
          // Handle response.audio_transcript.done for coach messages
          else if (data.type === 'response.audio_transcript.done') {
            console.log('[DailyVoiceChat] Coach audio transcript completed:', JSON.stringify(data));
            
            try {
              const transcript = data.transcript;
              const responseId = data.response_id;
              
              if (transcript && transcript.trim()) {
                // Clean up the transcript - trim whitespace and normalize spaces
                const cleanedTranscript = transcript.trim().replace(/\s+/g, ' ');
                console.log(`[DailyVoiceChat] Coach said: "${cleanedTranscript}"`);
                
                // Update UI with coach message
                setPendingCoachResponse(cleanedTranscript);
                
                // Add to conversation history
                const newCoachMessage: TimestampedChatMessage = {
                  sender: 'coach',
                  message: cleanedTranscript,
                  timestamp: Date.now(),
                  id: v4()
                };
                
                setConversationHistory(prev => [...prev, newCoachMessage]);
              } else {
                console.log('[DailyVoiceChat] Empty or invalid coach transcript received');
              }
            } catch (e) {
              console.error('[DailyVoiceChat] Error processing coach transcript:', e);
            }
          }
          
          // Handle output audio buffer events for coach audio playback
          else if (data.type === 'output_audio_buffer.started') {
            console.log('[DailyVoiceChat] Output audio buffer started');
            setIsCoachSpeakingTTS(true);
            setShowAnimatedCoachView(true);
            if (onSpeakingStateChange) onSpeakingStateChange(true, 'coach');
          }
          
          else if (data.type === 'output_audio_buffer.stopped') {
            console.log('[DailyVoiceChat] Output audio buffer stopped');
            setIsCoachSpeakingTTS(false);
            if (onSpeakingStateChange) onSpeakingStateChange(false, 'coach');
          }
          
          // Handle AI response audio parts (base64 audio chunks)
          else if (data.type === 'ai_response_audio_part') {
            console.log('[DailyVoiceChat] AI response audio part received');
            const audioBase64 = data.audio;
            if (audioBase64) {
              if (!isCoachSpeakingTTS) {
                setIsCoachSpeakingTTS(true);
                setShowAnimatedCoachView(true);
                if (onSpeakingStateChange) onSpeakingStateChange(true, 'coach');
              }
              playTTSAudio(audioBase64);
            }
          }
          
          // Handle conversation.item.created which may have undefined content
          else if (data.type === 'conversation.item.created') {
            console.log('[DailyVoiceChat] Conversation item created with type:', 
              data.item?.type || 'unknown type', 'data:', JSON.stringify(data.item || {}));
              
            // Check item type and process appropriately
            if (data.item?.type === 'transcript' && data.item.transcript?.speaker === 'user') {
              // Clean up the transcript - trim whitespace and normalize spaces
              const cleanedTranscript = data.item.transcript.text.trim().replace(/\s+/g, ' ');
              console.log('[DailyVoiceChat] User transcript received:', cleanedTranscript);
              
              // Update UI with transcript
              setCurrentTranscript(cleanedTranscript);
              setUserTranscriptJustReceived(true);
              
              // Add message to conversation history
              const newUserMessage: TimestampedChatMessage = { 
                sender: 'user', 
                message: cleanedTranscript,
                timestamp: Date.now(),
                id: v4()
              };
              
              setConversationHistory(prev => [...prev, newUserMessage]);
              
              // Set temporary flag to show user is speaking
              setUserIsActuallySpeaking(true);
              
              // Clear any existing speaking timer
              if (userSpeakingTimerRef.current) {
                clearTimeout(userSpeakingTimerRef.current);
              }
              
              // Set timer to turn off speaking indicator after a delay
              userSpeakingTimerRef.current = setTimeout(() => {
                setUserIsActuallySpeaking(false);
              }, 1000);
            }
            else if (data.item?.type === 'message' && data.item.role === 'assistant') {
              // Handle different types of content structure
              let messageContent = '';
              
              // Check for string content
              if (typeof data.item.content === 'string') {
                messageContent = data.item.content;
                console.log('[DailyVoiceChat] Assistant message received (string content):', 
                  messageContent.substring(0, 100) + '...');
              } 
              // Check for array of content items
              else if (Array.isArray(data.item.content)) {
                // Try to extract text from content array
                for (const contentItem of data.item.content) {
                  if (contentItem.type === 'text' && contentItem.text) {
                    messageContent += contentItem.text;
                  }
                }
                console.log('[DailyVoiceChat] Assistant message received (array content):', 
                  messageContent ? (messageContent.substring(0, 100) + '...') : 'No text content found');
              }
              
              // Only update UI if there's content
              if (messageContent) {
                // Clean up the message content - trim whitespace and normalize spaces
                const cleanedContent = messageContent.trim().replace(/\s+/g, ' ');
                
                // Update UI with coach message
                setPendingCoachResponse(cleanedContent);
                
                // Add to conversation
                const newCoachMessage: TimestampedChatMessage = {
                  sender: 'coach',
                  message: cleanedContent,
                  timestamp: Date.now(),
                  id: v4()
                };
                
                setConversationHistory(prev => [...prev, newCoachMessage]);
              }
            }
            // Handle function calls
            else if (data.item?.type === 'function_call') {
              console.log('[DailyVoiceChat] Function call item created:', JSON.stringify(data.item));
              
              // Store the function name for later use
              if (data.item.call_id && data.item.name) {
                console.log(`[DailyVoiceChat] Storing function name for call ${data.item.call_id}: ${data.item.name}`);
                functionNameMapRef.current[data.item.call_id] = data.item.name;
                setFunctionNameMap({...functionNameMapRef.current});
              }
              
              // This will be handled separately by the function call handler
            }
            // Handle other item types
            else {
              console.log('[DailyVoiceChat] Unhandled conversation item type:', 
                data.item?.type || 'unknown', JSON.stringify(data.item || {}));
            }
          }
          
          // Handle response.function_call_arguments.delta events for accumulating function arguments
          else if (data.type === 'response.function_call_arguments.delta') {
            try {
              // Extract the response_id and function call ID from the data
              const responseId = data.response_id;
              const callId = data.call_id;
              
              if (callId && data.delta) {
                console.log(`[DailyVoiceChat] Function call args delta for ${callId}:`, data.delta);
                
                // Initialize the arguments string if it doesn't exist
                if (!pendingFunctionArgsRef.current[callId]) {
                  pendingFunctionArgsRef.current[callId] = '';
                }
                
                // Append the delta to the arguments string
                pendingFunctionArgsRef.current[callId] += data.delta;
                
                // Update the state for components that need it
                setPendingFunctionArgs({...pendingFunctionArgsRef.current});
                
                console.log(`[DailyVoiceChat] Current accumulated args for ${callId}:`, 
                  pendingFunctionArgsRef.current[callId].length > 100 ? 
                  pendingFunctionArgsRef.current[callId].substring(0, 100) + '...' : 
                  pendingFunctionArgsRef.current[callId]);
              }
            } catch (e) {
              console.error('[DailyVoiceChat] Error processing function call arguments delta:', e);
            }
          }
          
          // Handle response.function_call_arguments.done events
          else if (data.type === 'response.function_call_arguments.done') {
            try {
              const responseId = data.response_id;
              const callId = data.call_id;
              
              if (callId && pendingFunctionArgsRef.current[callId]) {
                console.log(`[DailyVoiceChat] Function call args complete for ${callId}:`, 
                  pendingFunctionArgsRef.current[callId].length > 100 ? 
                  pendingFunctionArgsRef.current[callId].substring(0, 100) + '...' : 
                  pendingFunctionArgsRef.current[callId]);
                
                // Parse the arguments
                let functionArgs = {};
                try {
                  functionArgs = JSON.parse(pendingFunctionArgsRef.current[callId]);
                } catch (e) {
                  console.error(`[DailyVoiceChat] Error parsing function arguments for ${callId}:`, e);
                  functionArgs = {};
                }
                
                // Execute the function using the accumulated arguments
                executeFunctionCall(callId, functionArgs);
                
                // Clear the accumulated arguments
                delete pendingFunctionArgsRef.current[callId];
                setPendingFunctionArgs({...pendingFunctionArgsRef.current});
              }
            } catch (e) {
              console.error('[DailyVoiceChat] Error processing function call arguments done:', e);
            }
          }
          
          // Handle input audio transcription events for user speech
          else if (data.type === 'conversation.item.input_audio_transcription.completed') {
            console.log('[DailyVoiceChat] User input audio transcription completed:', JSON.stringify(data));
            
            try {
              const transcript = data.transcript;
              const itemId = data.item_id;
              
              if (transcript && transcript.trim()) {
                // Clean up the transcript - trim whitespace and normalize spaces
                const cleanedTranscript = transcript.trim().replace(/\s+/g, ' ');
                console.log(`[DailyVoiceChat] User said: "${cleanedTranscript}"`);
                
                // Update UI with transcript
                setCurrentTranscript(cleanedTranscript);
                setUserTranscriptJustReceived(true);
                
                // Add user message to conversation history
                const newUserMessage: TimestampedChatMessage = { 
                  sender: 'user', 
                  message: cleanedTranscript,
                  timestamp: Date.now(),
                  id: v4()
                };
                
                setConversationHistory(prev => [...prev, newUserMessage]);
                
                // Set temporary flag to show user is speaking
                setUserIsActuallySpeaking(true);
                
                // Clear any existing speaking timer
                if (userSpeakingTimerRef.current) {
                  clearTimeout(userSpeakingTimerRef.current);
                }
                
                // Set timer to turn off speaking indicator after a delay
                userSpeakingTimerRef.current = setTimeout(() => {
                  setUserIsActuallySpeaking(false);
                }, 1000);
              } else {
                console.log('[DailyVoiceChat] Empty or invalid transcript received');
              }
            } catch (e) {
              console.error('[DailyVoiceChat] Error processing user transcription:', e);
            }
          }
        } catch (error) {
          console.error('[DailyVoiceChat] Error processing data channel message:', error);
        }
      };
      
      // @ts-ignore - Using onerror instead of addEventListener for compatibility
      dc.onerror = (event: RTCErrorEvent) => {
        console.error('[DailyVoiceChat] Data channel error:', event);
        handleError('WebRTC data channel error', false);
      };
      
      // @ts-ignore - Using onclose instead of addEventListener for compatibility
      // @ts-expect-error - Argument is optional in our implementation
      dc.onclose = () => {
        console.log('[DailyVoiceChat] Data channel closed');
      };
      
      // Setup ICE handling
      // @ts-ignore - Using onicecandidate instead of addEventListener for compatibility
      pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          console.log('[DailyVoiceChat] ICE candidate:', event.candidate);
        }
      };
      
      // @ts-expect-error - Argument is optional in our implementation
      pc.onconnectionstatechange = () => {
        console.log(`[DailyVoiceChat] Connection state changed to: ${pc.connectionState}`);
        
        // Handle different connection states
        switch (pc.connectionState) {
          case 'connected':
            console.log('[DailyVoiceChat] WebRTC connection established');
            setIsConnecting(false);
            setIsLoading(false); // Ensure loading is set to false when connection is established
            // Ensure coach animation is shown once connected
            setShowAnimatedCoachView(true);
            startAudioProcessing();
            break;

          case 'connecting':
            // Update UI while connecting is in progress
            console.log('[DailyVoiceChat] WebRTC connection in progress');
            if (isLoading && !isConnecting) {
              setIsConnecting(true);
            }
            break;

          case 'disconnected':
            console.log('[DailyVoiceChat] WebRTC connection disconnected');
            if (!conversationComplete) {
              handleError('Voice connection disconnected. You can try again or use text chat.', false);
            }
            setIsConnecting(false);
            setIsLoading(false);
            break;
                
          case 'failed':
            console.error('[DailyVoiceChat] WebRTC connection failed');
            handleError('Voice connection failed. You can try again or use text chat.', true);
            setIsConnecting(false);
            setIsLoading(false);
            // Show fallback mode after connection failure
            setFallbackMode(true);
            break;
                
          case 'closed':
            console.log('[DailyVoiceChat] WebRTC connection closed');
            setIsLoading(false);
            break;

          default:
            // Other states: 'new', 'connecting', 'checking' - no action needed
            break;
        }
      };
      
      // @ts-ignore 
      pc.ontrack = (event: any) => {
        console.log('[DailyVoiceChat] Received track:', event.track.kind);
        if (event.track.kind === 'audio' && event.streams && event.streams[0]) {
            console.log('[DailyVoiceChat] Audio track received via ontrack. This is unexpected if TTS is purely via data channel.');
        }
      };
      
      // @ts-ignore - Using onstatechange instead of addEventListener for compatibility
      dc.onstatechange = () => {
        console.log(`[DailyVoiceChat] Data channel state changed to: ${dc.readyState}`);
        
        // Handle data channel state changes
        if (dc.readyState === 'closed') {
          console.log('[DailyVoiceChat] Data channel closed');
          
          // If this happens right after sending session.update, it's likely a configuration error
          if (isConnecting) {
            handleError('Connection to AI coach was lost. There might be an issue with the OpenAI service.', true);
            setFallbackMode(true);
          }
        }
      };
      
      // Get local media stream
      try {
        console.log('[DailyVoiceChat] Getting user media...');
        const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
        console.log('[DailyVoiceChat] Got local media stream');
        
      localStreamRef.current = stream;
        
        // Add tracks from local stream to peer connection
        stream.getTracks().forEach(track => {
          if (peerConnectionRef.current) {
            peerConnectionRef.current.addTrack(track, stream);
            console.log('[DailyVoiceChat] Added track to peer connection:', track.kind);
          }
        });
        
        // Create and send offer
      const offer = await pc.createOffer({}); 
      await pc.setLocalDescription(offer);
        console.log('[DailyVoiceChat] Created and set local offer');

        // Send offer to OpenAI Realtime API - Updated to match VoiceChat.tsx implementation
        console.log('[DailyVoiceChat] Sending SDP offer to OpenAI...');
      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17`, { 
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${token}`, 
              'Content-Type': 'application/sdp'
          },
          body: pc.localDescription?.sdp
      });

      if (!sdpResponse.ok) {
          const errorText = await sdpResponse.text().catch(() => '');
          console.error(`[DailyVoiceChat] API response error: ${sdpResponse.status} - ${errorText}`);
          throw new Error(`Failed to send SDP: ${sdpResponse.status}${errorText ? ' - ' + errorText : ''}`);
        }
        
        // Get the answer SDP from OpenAI
        console.log('[DailyVoiceChat] Received SDP answer from OpenAI');
      const answerSdp = await sdpResponse.text();
        
        // Set the remote description with the answer from OpenAI
        console.log('[DailyVoiceChat] Setting remote description...');
        const answer = new RTCSessionDescription({
          type: 'answer',
          sdp: answerSdp
        });
        
      await pc.setRemoteDescription(answer);
        console.log('[DailyVoiceChat] Set remote description');
        
        // Connection should now proceed
        console.log('[DailyVoiceChat] WebRTC setup complete, waiting for connection...');
      } catch (error) {
        console.error('[DailyVoiceChat] Error setting up media or signaling:', error);
        throw error; // Rethrow to be caught by the outer try/catch
      }
      
    } catch (err) {
      console.error('[DailyVoiceChat] WebRTC initialization error:', err);
      handleError(`Failed to set up WebRTC connection: ${err instanceof Error ? err.message : 'Unknown error'}`, true);
      setIsConnecting(false);
      setIsLoading(false);
      
      // Consider fallback mode
      if (err instanceof Error && 
          (err.message.includes('API') || 
           err.message.includes('key') || 
           err.message.includes('model'))) {
        setFallbackMode(true);
      }
    }
  }, [isVisible, configureAIInstructions, handleError, playTTSAudio, startAudioProcessing, userId, userFeedback]);

  // --- EFFECT: Fix circular reference issue by assigning initializeWebRTC to ref ---
  useEffect(() => {
    initializeWebRTCRef.current = initializeWebRTC;
    return () => {
      // Optional cleanup
    };
  }, [initializeWebRTC]);

  // Update checkMicrophonePermissions to correctly reference getEphemeralKey
  const finalCheckMicrophonePermissions = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      setHasPermission(permission.granted);
      if (permission.granted) {
        console.log('[DailyVoiceChat] Microphone permission granted.');
        // Set initialized BEFORE calling getEphemeralKey to ensure the flag is set
        setIsInitializedThisSession(true);
        getEphemeralKey();
      } else {
        handleError('Microphone permission not granted.', true);
        setFallbackMode(true);
        setIsLoading(false);
      }
    } catch (err: any) {
      handleError(`Permission check error: ${err.message}`, true);
      setFallbackMode(true);
      setIsLoading(false);
    }
  }, [getEphemeralKey, handleError]);

  // --- EFFECT: MAIN SETUP EFFECT ---
  useEffect(() => {
    // Clear retry counter when component mounts or becomes visible
    if (isVisible && !wasVisibleRef.current) {
      retryCountRef.current = 0;
    }

    const configureAudioAndPermissions = async () => {
      // Only run full initialization when becoming visible, not on every re-render while visible
      const becameVisible = isVisible && !wasVisibleRef.current;
      const stillVisible = isVisible && wasVisibleRef.current;
      const becameInvisible = !isVisible && wasVisibleRef.current;
      
      // Update the ref to track the current visibility state for the next render
      wasVisibleRef.current = isVisible;

      if (becameVisible || (isVisible && !isInitializedThisSession)) {
        // If we have retried too many times and failed, don't keep trying
        if (retryCountRef.current >= maxRetries) {
          console.log(`[DailyVoiceChat] Already tried ${maxRetries} times, stopping initialization attempts`);
          setIsLoading(false);
          setErrorState(`Failed to initialize after ${maxRetries} attempts. Please switch to text chat.`);
          setFallbackMode(true);
          return;
        }

        console.log('[DailyVoiceChat] Session not initialized or becoming visible, performing setup.');
        setIsLoading(true);
        setConversationHistory([]); 
        setConversationComplete(false);
        setFallbackMode(false);
        setErrorState(null);
        
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
          setIsLoading(false);
          return; 
        }
        
        try {
          // Use finalCheckMicrophonePermissions instead of checkMicrophonePermissions
          // Do NOT set isInitializedThisSession here, that's now done in finalCheckMicrophonePermissions
          await finalCheckMicrophonePermissions();
          // Successfully initialized
          retryCountRef.current = 0;
        } catch (e) {
          // Increment retry counter on failure
          retryCountRef.current++;
          
          // Implement exponential backoff for retries
          const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 10000);
          console.log(`[DailyVoiceChat] Initialization attempt ${retryCountRef.current} failed. Retrying in ${retryDelay}ms...`);
          
          // Schedule retry after delay if we haven't exceeded max retries
          if (retryCountRef.current < maxRetries) {
            setTimeout(() => {
              console.log(`[DailyVoiceChat] Retrying initialization (attempt ${retryCountRef.current + 1}/${maxRetries})...`);
              setIsInitializedThisSession(false);
            }, retryDelay);
      } else {
            console.log(`[DailyVoiceChat] Max retries (${maxRetries}) reached. Giving up on initialization.`);
            setErrorState(`Failed to initialize after ${maxRetries} attempts. Please switch to text chat.`);
            setFallbackMode(true);
          }
          
          setIsLoading(false);
          return;
        }
      } else if (stillVisible) {
        // Already initialized and still visible - do nothing
        console.log('[DailyVoiceChat] Session already initialized, still visible, no action needed.');
      } else if (becameInvisible) {
        // Cleanup when becoming invisible
        console.log('[DailyVoiceChat] Became invisible, performing cleanup and resetting init flag.');
        fullCleanup(); 
        // Reset for next time it becomes visible
        setIsInitializedThisSession(false);
        retryCountRef.current = 0;
      }
    };

    // Execute the configuration function
    configureAudioAndPermissions();

    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
        if (nextAppState !== 'active' && isVisible && !cleanupScheduledRef.current) {
            console.log('[DailyVoiceChat] App became inactive, performing full cleanup and closing.');
        fullCleanupAndClose(); 
        }
    });

    return () => {
      console.log('[DailyVoiceChat] Main useEffect cleanup triggered.');
      appStateSubscription.remove();
      
      // Only clean up if we're not already handling cleanup elsewhere
      if (!cleanupScheduledRef.current) {
        stopAudioProcessing();
      }
    };
  }, [isVisible, isInitializedThisSession, finalCheckMicrophonePermissions, fullCleanupAndClose, fullCleanup, handleError, stopAudioProcessing]);

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
    if (refreshHomeScreen && needsRefresh) {
      console.log('[DailyVoiceChat] Refreshing home screen...');
      refreshHomeScreen();
      setNeedsRefresh(false);
    }

    // Call the onClose prop to notify parent (e.g., HomeScreen)
    if (onClose) {
      onClose(); 
    }
    
    console.log('[DailyVoiceChat] Session cleanup complete.');
  };

  const reconnect = useCallback(() => {
    console.log('[DailyVoiceChat] Attempting to reconnect...');
    
    // First, clean up existing connections/resources
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
      ttsPlayerRef.current.unloadAsync().catch(e => console.warn('[DailyVoiceChat] Error unloading TTS player:', e));
      ttsPlayerRef.current = null;
    }
    
    // Release audio resources before reinitializing
    InCallManager.setForceSpeakerphoneOn(false);
    InCallManager.stop();
    
    // Reset all state variables
    setIsInitializedThisSession(false);
    setErrorState(null);
    setIsConnecting(false);
    setIsLoading(true);
    setConversationHistory([]);
    setCurrentTranscript('');
    setPendingCoachResponse('');
    setShowAnimatedCoachView(false);
    setHasPermission(null);
    setUserIsActuallySpeaking(false);
    setIsCoachSpeakingTTS(false);
    setFallbackMode(false);
    ephemeralKeyRef.current = null;
    retryCountRef.current = 0;
    
    // Allow a small delay before restarting the initialization process
    setTimeout(() => {
      if (isVisible) {
        console.log('[DailyVoiceChat] Restarting initialization process after cleanup...');
        
        // Reset audio mode and InCallManager
        InCallManager.start({ media: 'audio' });
        InCallManager.setForceSpeakerphoneOn(true);
        Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: 1,
          interruptionModeAndroid: 1,
          playThroughEarpieceAndroid: false,
          shouldDuckAndroid: true,
        }).catch(e => console.warn('[DailyVoiceChat] Error setting audio mode on reconnect:', e));
        
        // Directly start the permission check to trigger the initialization process
        finalCheckMicrophonePermissions().catch(e => {
          console.error('[DailyVoiceChat] Error checking permissions on reconnect:', e);
          handleError('Failed to reconnect: ' + (e instanceof Error ? e.message : 'Unknown error'));
        });
      } else {
        console.log('[DailyVoiceChat] Component not visible, waiting for visibility change to reinitialize.');
        setIsLoading(false);
      }
    }, 1000);
  }, [isVisible, finalCheckMicrophonePermissions, handleError]);

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
          const messagePayload: CoreChatMessage = {
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

  // Helper function to execute function calls
  const executeFunctionCall = useCallback((callId: string, functionArgs: any) => {
    console.log(`[DailyVoiceChat] Executing function call ${callId} with args:`, functionArgs);
    
    setIsExecutingTool(true);
    
    try {
      // Get the function name from our map instead of from arguments
      const functionName = functionNameMapRef.current[callId];
      
      if (!functionName) {
        console.error(`[DailyVoiceChat] No function name found in map for call ${callId}`);
        setIsExecutingTool(false);
        return;
      }
      
      console.log(`[DailyVoiceChat] Executing function ${functionName} with call_id ${callId}`);
      
      // Execute functions based on name
      if (functionName === 'execute_workout_adjustment') {
        // Handle workout adjustment
        if (functionArgs.adjustment_details) {
          try {
            const sessionId = functionArgs.session_id;
            const details = functionArgs.adjustment_details;
            
            console.log('[DailyVoiceChat] Executing workout adjustment:', {
              sessionId,
              details
            });
            
            // Use executeWorkoutAdjustment
            planService.executeWorkoutAdjustment(userId, {
              session_id: sessionId,
              adjustment_details: {
                action: details.action || 'update',
                new_date: details.new_date,
                new_distance: details.new_distance,
                new_duration_minutes: details.new_duration_minutes,
                reason: details.reason,
                ...(details.user_query ? { user_query: details.user_query } : { user_query: 'Voice command' })
              } as any
            }).then(result => {
              console.log(`[DailyVoiceChat] Workout adjustment result:`, result);
              
              // Add a confirmation message back to the conversation
              if (dataChannelRef.current?.readyState === 'open') {
                try {
                  // Based on OpenAI community forums, directly send the function output first
                  const functionOutputEvent = {
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: JSON.stringify({status: 'success', message: 'Workout adjustment saved successfully'})
                    }
                  };
                  console.log('[DailyVoiceChat] Sending direct function output result:', JSON.stringify(functionOutputEvent));
                  dataChannelRef.current.send(JSON.stringify(functionOutputEvent));
                  
                  // Set flag to refresh after chat ends
                  if (refreshHomeScreen) {
                    setNeedsRefresh(true);
                    console.log('[DailyVoiceChat] Training plan updated. Will refresh after chat ends.');
                  }
                  
                  // Let AI handle natural conversation flow after function execution
                  setTimeout(() => {
                    if (dataChannelRef.current?.readyState === 'open') {
                      console.log('[DailyVoiceChat] Requesting new response after function output');
                      dataChannelRef.current.send(JSON.stringify({
                        type: 'response.create'
                      }));
                    }
                  }, 50);
                } catch (e) {
                  console.error('[DailyVoiceChat] Error sending function result:', e);
                }
              }
            }).catch(e => {
              console.error('[DailyVoiceChat] Error executing workout adjustment:', e);
            });
          } catch (e) {
            console.error('[DailyVoiceChat] Error executing workout adjustment:', e);
          }
        } else {
          console.error('[DailyVoiceChat] Missing adjustment_details in function args');
        }
      }
      // Handle feedback collection
      else if (functionName === 'add_user_training_feedback') {
        // Similar handling for feedback
        try {
          console.log('[DailyVoiceChat] Adding user training feedback:', functionArgs);
          
          // Use the feedback service
          feedbackService.addOrUpdateUserTrainingFeedback(userId, {
            week_start_date: functionArgs.week_start_date || null,
            prefers: functionArgs.prefers || {},
            struggling_with: functionArgs.struggling_with || {},
            feedback_summary: functionArgs.feedback_summary,
            raw_data: functionArgs.raw_data || {}
          }).then(result => {
            console.log('[DailyVoiceChat] Feedback saved:', result.data ? 'success' : 'failed');
            
            // Send result back to conversation
            if (dataChannelRef.current?.readyState === 'open') {
              try {
                // Based on OpenAI community forums, directly send the function output first
                const functionOutputEvent = {
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: JSON.stringify({status: 'success', message: 'Training feedback saved successfully'})
                  }
                };
                console.log('[DailyVoiceChat] Sending direct function output result:', JSON.stringify(functionOutputEvent));
                dataChannelRef.current.send(JSON.stringify(functionOutputEvent));
                
                // Set flag to refresh after chat ends
                if (refreshHomeScreen) {
                  setNeedsRefresh(true);
                  console.log('[DailyVoiceChat] Training plan updated. Will refresh after chat ends.');
                }
                
                // Let AI handle natural conversation flow after function execution
                setTimeout(() => {
                  if (dataChannelRef.current?.readyState === 'open') {
                    console.log('[DailyVoiceChat] Requesting new response after function output');
                    dataChannelRef.current.send(JSON.stringify({
                      type: 'response.create'
                    }));
                  }
                }, 50);
              } catch (e) {
                console.error('[DailyVoiceChat] Error sending function result:', e);
              }
            }
          });
        } catch (e) {
          console.error('[DailyVoiceChat] Error executing function call:', e);
        }
      } else {
        console.error(`[DailyVoiceChat] Unknown function name: ${functionName}`);
      }
    } catch (e) {
      console.error('[DailyVoiceChat] Error executing function call:', e);
    }
    
    // Turn off the tool execution indicator after a delay
    setTimeout(() => {
      setIsExecutingTool(false);
    }, 2000);
  }, [userId, refreshHomeScreen]);

  if (!isVisible) return null;

  const renderContent = () => {
      return (
      <View className="flex-1 flex-col">
        {/* Error State */}
        {error ? (
          <View className="items-center justify-center py-4">
            <Text className="text-red-500 mb-3 text-center">{error}</Text>
            <View className="flex-row">
              <TouchableOpacity 
                className="bg-purple-500 px-4 py-2 rounded-lg mr-2" 
                onPress={fallbackMode ? handleSwitchToTextChat : onClose}
              >
                <Text className="text-white font-semibold">
                  {fallbackMode ? "Switch to Text Chat" : "Close"}
                </Text>
            </TouchableOpacity>
              
            {!fallbackMode && (
                <TouchableOpacity 
                  className="bg-green-500 px-4 py-2 rounded-lg" 
                  onPress={() => {
                    // Reset retry counter and attempt reconnection
                    retryCountRef.current = 0;
                    setIsInitializedThisSession(false); // Force complete re-initialization
                    reconnect();
                  }}
                >
                  <Text className="text-white font-semibold">Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        ) : isLoading || isConnecting ? (
          /* Loading State */
          <View className="items-center justify-center py-8">
          <MinimalSpinner size={48} color="#8B5CF6" thickness={3} />
            <Text className="mt-4 text-gray-600 text-center">
              {isConnecting ? "Connecting to coach..." : "Setting up voice chat..."}
          </Text>
            
            {/* Cancel button during loading */}
            <TouchableOpacity 
              className="bg-gray-300 px-4 py-2 rounded-lg mt-4" 
              onPress={onClose}
            >
              <Text className="text-gray-800 font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : fallbackMode ? (
          /* Fallback Mode */
          <View className="items-center justify-center py-8">
            <FontAwesome name="comment-o" size={40} color="#8B5CF6" />
            <Text className="text-gray-800 mb-4 mt-4 text-center">
              Voice chat is currently unavailable.{"\n"}Would you like to switch to text chat instead?
            </Text>
            <View className="flex-row">
              <TouchableOpacity 
                className="bg-purple-500 px-4 py-2 rounded-lg mr-2" 
                onPress={handleSwitchToTextChat}
              >
                <Text className="text-white font-semibold">Switch to Text Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="bg-gray-300 px-4 py-2 rounded-lg" 
                onPress={onClose}
              >
                <Text className="text-gray-800 font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Connected/Ready State - Coach Animation */
          renderConnectedState()
        )}
      </View>
    );
  };

  /* Connected/Ready State - Coach Animation */
  const renderConnectedState = () => (
    <View className="items-center justify-center">
      {showAnimatedCoachView && (
        <View className="items-center mb-4">
          <View style={styles.animatedCoachContainer}>
            <View
              style={[
                styles.coachImageWrapper,
                styles.coachImageWrapperActive // Always use active style during conversation
              ]}
            >
              <Animatable.Image
                source={coachAvatar}
                animation="pulse"
                iterationCount="infinite"
                duration={1000}
                easing="ease-in-out"
                style={styles.coachImage}
                resizeMode="cover"
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
                    duration={1000}
                    style={styles.speakingDot}
                  />
                </View>
              )}
            </View>
          </View>
          
          <Text style={styles.coachNameText}>
            {coachName}
          </Text>
          

        </View>
      )}
      
      {/* Transcripts are captured in background but not displayed during conversation */}

      {/* Tool Execution Indicator */}
      {isExecutingTool && (
        <View style={styles.toolExecutionIndicator}>
          <MinimalSpinner size={20} color="#8B5CF6" thickness={2} />
          <Text style={styles.toolExecutionText}>Processing request...</Text>
        </View>
      )}
      
      {/* End Chat Button */}
      <TouchableOpacity 
          className="bg-purple-500 px-4 py-2 rounded-lg mt-4" 
        onPress={handleEndSession} 
      >
          <Text className="text-white font-semibold">End Chat</Text>
      </TouchableOpacity>
    </View>
  );

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
    borderWidth: 2,
    borderColor: '#F5F5F5',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  coachImageWrapperActive: {
    borderWidth: 4,
    borderColor: '#8B5CF6',
    ...Platform.select({
      ios: {
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
        borderColor: '#8B5CF6',
      },
    }),
  },
  coachImage: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  animatedBorder: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: '#8B5CF6',
  },
  glowOverlay: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 100,
    backgroundColor: 'transparent',
    borderWidth: 5,
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  speakingIndicator: {
    position: 'absolute',
    bottom: 5,
    right: 5,
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
    width: 12,
    height: 12,
    borderRadius: 6,
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
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
  toolExecutionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  toolExecutionText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#555',
  },
});

export default DailyVoiceChat; 