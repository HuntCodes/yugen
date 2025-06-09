import { Feather, FontAwesome } from '@expo/vector-icons';
import { encode as encodeBase64 } from 'base-64'; // For ArrayBuffer to base64
import { Audio } from 'expo-av';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  AppState,
  Dimensions,
  NativeModules,
} from 'react-native';
import * as Animatable from 'react-native-animatable'; // Added for animations
import InCallManager from 'react-native-incall-manager';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { v4 } from 'uuid';
// Add navigation imports
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { environment } from '../../config/environment';
import { useAuth } from '../../context/AuthContext';
import { useMessageFormatting } from '../../hooks/chat/useMessageFormatting';
import {
  ChatMessage as CoreChatMessage,
  MessageHandlerParams,
} from '../../hooks/chat/useMessageTypes'; // Renamed to avoid conflict
import { supabase } from '../../lib/supabase';
import { TrainingSession } from '../../screens/main/training/components/types';
import { saveMessage, fetchChatHistory } from '../../services/chat/chatService';
import * as feedbackService from '../../services/feedback/feedbackService';
import * as planService from '../../services/plan/planService';
import { WeatherForecast } from '../../services/weather/weatherService';
import { OnboardingProfile as Profile } from '../../types/onboarding';
import { PlanUpdate } from '../../types/planUpdate';
import { MinimalSpinner } from '../ui/MinimalSpinner';

// Import the new hooks and types
// Import voice session manager for conflict prevention
import { voiceSessionManager } from '../../lib/voice/voiceSessionManager';

// Constants
const SUPABASE_URL = environment.supabaseUrl; // Ensure this is correctly configured in your environment
const EPHEMERAL_KEY_ENDPOINT = `${SUPABASE_URL}/functions/v1/ephemeral-key`;
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]; // Basic STUN server
const MAX_CONVERSATION_HISTORY_MESSAGES = 10; // Same as ChatMini - last 10 messages for AI context

// Copied from VoiceOnboarding.tsx
const glowAnimation = {
  0: { opacity: 0.3, borderWidth: 2 },
  0.5: { opacity: 1, borderWidth: 5 },
  1: { opacity: 0.3, borderWidth: 2 },
};

// Extended ChatMessage interface with id
interface TimestampedChatMessage extends CoreChatMessage {
  // sender, message, and timestamp are inherited from CoreChatMessage
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
  weatherData?: WeatherForecast | null;
  onSessionComplete: (
    conversationHistory: CoreChatMessage[],
    confirmedPlanUpdate?: PlanUpdate
  ) => void;
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
  weatherData,
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
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [volume, setVolume] = useState(0.8); // Volume state (0.0 to 1.0)
  const [showVolumeControls, setShowVolumeControls] = useState(false);
  const [lastCleanupTime, setLastCleanupTime] = useState<number | null>(null);

  // NEW: State for previous chat history (same as ChatMini)
  const [previousChatHistory, setPreviousChatHistory] = useState<CoreChatMessage[]>([]);

  // NEW: State for remote audio stream
  const [remoteAudioStream, setRemoteAudioStream] = useState<MediaStream | null>(null);

  // NEW: Reference to prevent expo-av from interfering
  const audioSessionProtectionRef = useRef<boolean>(false);

  // State for tracking speech timing
  const [userSpeechStartTime, setUserSpeechStartTime] = useState<number | null>(null);
  const [coachSpeechStartTime, setCoachSpeechStartTime] = useState<number | null>(null);

  // Track accumulated function call arguments
  const [pendingFunctionArgs, setPendingFunctionArgs] = useState<{ [callId: string]: string }>({});
  const pendingFunctionArgsRef = useRef<{ [callId: string]: string }>({});

  // Track function names by call_id
  const [functionNameMap, setFunctionNameMap] = useState<{ [callId: string]: string }>({});
  const functionNameMapRef = useRef<{ [callId: string]: string }>({});

  // --- USER INPUT QUEUING SYSTEM ---
  const [userInputQueue, setUserInputQueue] = useState<string[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // --- REFS ---
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<any | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<Audio.Sound | null>(null);
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
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // NEW: Store speech start times by response ID to avoid race conditions
  const speechStartTimesRef = useRef<{ [responseId: string]: number }>({});
  const currentResponseIdRef = useRef<string | null>(null);

  // NEW: Store user speech start times by item ID to avoid race conditions
  const userSpeechStartTimesRef = useRef<{ [itemId: string]: number }>({});

  // Function call timeout tracking
  const functionCallTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // --- HOOKS ---
  const {
    buildSystemPrompt,
    getToolsDefinitionForRealtimeAPI,
    buildUserContextString,
    getGearRecommendations,
  } = useMessageFormatting();

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

    console.log(
      '[DailyVoiceChat] Setting coach visibility to:',
      shouldShowCoach,
      'connection state:',
      pc?.connectionState || 'no connection'
    );

    setShowAnimatedCoachView(shouldShowCoach);

    // If showAnimatedCoachView is being enabled, also ensure loading is set to false
    if (shouldShowCoach && isLoading) {
      setIsLoading(false);
    }
  }, [
    isLoading,
    isConnecting,
    error,
    hasPermission,
    isVisible,
    isCoachSpeakingTTS,
    isReceivingCoachMessage,
  ]);

  // --- EFFECT: Fetch user feedback when component initializes ---
  useEffect(() => {
    if (userId && isVisible) {
      // Fetch user training feedback
      const fetchFeedback = async () => {
        try {
          const result = await feedbackService.fetchUserTrainingFeedback(userId);
          if (result.data) {
            console.log(
              '[DailyVoiceChat] User feedback loaded:',
              result.data.feedback_summary || 'No summary'
            );
            setUserFeedback(result.data);
          }
        } catch (err) {
          console.error('[DailyVoiceChat] Error fetching user feedback:', err);
        }
      };

      fetchFeedback();
    }
  }, [userId, isVisible]);

  // --- EFFECT: Load previous chat history when component initializes ---
  useEffect(() => {
    if (userId && isVisible) {
      const loadChatHistory = async () => {
        try {
          console.log('[DailyVoiceChat] Loading previous chat history for context...');
          const history = await fetchChatHistory(userId, 50); // Load up to 50 messages like ChatMini
          if (history && history.length > 0) {
            console.log(
              '[DailyVoiceChat] Loaded',
              history.length,
              'previous chat messages for context.'
            );
            setPreviousChatHistory(history);
          } else {
            console.log('[DailyVoiceChat] No previous chat history found.');
            setPreviousChatHistory([]);
          }
        } catch (error) {
          console.error('[DailyVoiceChat] Error loading chat history:', error);
          setPreviousChatHistory([]); // Continue without history on error
        }
      };

      loadChatHistory();
    }
  }, [userId, isVisible]);

  // --- HANDLERS & UTILITY FUNCTIONS ---
  const handleError = useCallback(
    (errorMessage: string, critical = false) => {
      console.error(`[DailyVoiceChat] Error: ${errorMessage}`);
      setErrorState(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
      if (critical) {
        console.log('[DailyVoiceChat] Critical error, potentially closing or fallback.');

        // For critical API errors, enable fallback mode
        if (
          errorMessage.includes('API') ||
          errorMessage.includes('OpenAI') ||
          errorMessage.includes('404') ||
          errorMessage.includes('key')
        ) {
          console.log('[DailyVoiceChat] API-related error, enabling fallback mode');
          setFallbackMode(true);
        }
      }
    },
    [onError]
  );

  const stopAudioProcessing = useCallback(() => {
    console.log('[DailyVoiceChat] Stopping audio processing...');
    setIsListening(false);
    if (onSpeakingStateChange) onSpeakingStateChange(false, 'user');
    if (userSpeakingTimerRef.current) clearTimeout(userSpeakingTimerRef.current);
    userSpeakingTimerRef.current = null;
  }, [onSpeakingStateChange]);

  const fullCleanup = useCallback(() => {
    console.log('[DailyVoiceChat] Performing full cleanup...');
    console.log('[DailyVoiceChat] Pre-cleanup state:', {
      hasLocalStream: !!localStreamRef.current,
      hasDataChannel: !!dataChannelRef.current,
      hasPeerConnection: !!peerConnectionRef.current,
      connectionState: peerConnectionRef.current?.connectionState,
      isListening,
      isCoachSpeakingTTS,
      sessionStartTime,
    });
    
    stopAudioProcessing();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
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
      ttsPlayerRef.current
        .unloadAsync()
        .catch((e) => console.error('Error unloading TTS player:', e));
      ttsPlayerRef.current = null;
    }

    // Clear DataChannel
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    // CRITICAL: Proper RTCAudioSession cleanup when navigating away
    if (Platform.OS === 'ios') {
      const { RTCAudioSession } = NativeModules;
      if (RTCAudioSession) {
        try {
          console.log('[AUDIO_FIX] Deactivating RTCAudioSession during cleanup');
          // STEP 1: Disable audio management
          RTCAudioSession.isAudioEnabled = false;
          console.log('[AUDIO_FIX] ✅ RTCAudioSession audio disabled');
          
          // STEP 2: Deactivate the session
          RTCAudioSession.deactivate();
          console.log('[AUDIO_FIX] ✅ RTCAudioSession deactivated successfully');
        } catch (cleanupError) {
          console.error('[AUDIO_FIX] RTCAudioSession cleanup error (non-critical):', cleanupError);
        }
      }
    }

    // Clean up InCallManager routing only (no session management)
    InCallManager.setForceSpeakerphoneOn(false);
    InCallManager.stop();
    console.log('[AUDIO_FIX] ✅ InCallManager routing cleaned up');

    // End voice session manager session
    voiceSessionManager.endSession();

    ephemeralKeyRef.current = null;
    setIsConnecting(false);
    setIsListening(false);
    setIsCoachSpeakingTTS(false);
    setCurrentTranscript('');
    setPendingCoachResponse('');
    setErrorState(null);
    setIsInitializedThisSession(false);

    // Clear session timeout
    setSessionStartTime(null);
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }

    // Clear remote audio stream
    setRemoteAudioStream(null);

    // CLEANUP VERIFICATION LOGGING
    console.log('[DailyVoiceChat] Post-cleanup verification:', {
      hasLocalStream: !!localStreamRef.current,
      hasDataChannel: !!dataChannelRef.current,
      hasPeerConnection: !!peerConnectionRef.current,
      hasEphemeralKey: !!ephemeralKeyRef.current,
      sessionManagerActive: voiceSessionManager.isSessionActive(),
      activeComponent: voiceSessionManager.getActiveComponent(),
      isListening,
      isCoachSpeakingTTS,
      isInitialized: isInitializedThisSession,
    });
    console.log('[DailyVoiceChat] Full cleanup completed successfully');
    
    // Track cleanup time to prevent rapid re-initialization
    setLastCleanupTime(Date.now());
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
      localStreamRef.current.getTracks().forEach((track) => track.stop());
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
      ttsPlayerRef.current
        .unloadAsync()
        .catch((e) => console.warn('[DailyVoiceChat] Error unloading TTS player:', e));
      ttsPlayerRef.current = null;
    }

    // Call onClose to let parent handle switching to text chat
    if (onClose) {
      onClose();
    }
  }, [onClose, stopAudioProcessing]);

  const startAudioProcessing = useCallback(async () => {
    if (!localStreamRef.current || !peerConnectionRef.current || isListening) {
      console.log(
        '[DailyVoiceChat] Cannot start audio processing: stream/PC not ready or already listening.'
      );
      return;
    }
    console.log('[DailyVoiceChat] Starting audio processing / listening...');
    setIsListening(true);
    if (onSpeakingStateChange) onSpeakingStateChange(true, 'user');
  }, [isListening, onSpeakingStateChange]);

  const playTTSAudio = useCallback(
    async (base64Audio: string) => {
      try {
        if (ttsPlayerRef.current) {
          await ttsPlayerRef.current.unloadAsync();
        }
        console.log('[DailyVoiceChat] Playing TTS audio chunk...');

        // CRITICAL: Ensure speaker mode and audio session are correct before TTS playback
        console.log('[DailyVoiceChat] Ensuring audio session is ready for TTS...');

        // Force speaker mode when starting TTS playback
        InCallManager.setForceSpeakerphoneOn(true);

        // SKIP EXPO-AV - it interferes with WebRTC audio sessions
        // Research shows expo-av deactivates audio sessions, killing WebRTC
        console.log('[AUDIO_FIX] Skipping expo-av configuration for TTS to prevent WebRTC interference');

        console.log('[DailyVoiceChat] Audio session confirmed for TTS playback.');

        const { sound } = await Audio.Sound.createAsync(
          { uri: `data:audio/mp3;base64,${base64Audio}` },
          {
            shouldPlay: true,
            volume,
            // Force TTS to use speaker/external audio route
            progressUpdateIntervalMillis: 100,
          }
        );
        ttsPlayerRef.current = sound;

        // Add status update listener to ensure audio plays
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.isPlaying) {
            console.log('[DailyVoiceChat] TTS audio is playing successfully');
          } else if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
            console.log('[DailyVoiceChat] TTS audio playback completed');
          } else if (!status.isLoaded) {
            console.log('[DailyVoiceChat] TTS audio failed to load');
          }
        });

        await sound.playAsync();
        console.log('[DailyVoiceChat] TTS audio chunk playback started.');
      } catch (e: any) {
        console.error('[DailyVoiceChat] TTS playback error:', e);
        handleError(`TTS playback error: ${e.message}`);
      }
    },
    [handleError, volume]
  );

  // Volume control functions
  const adjustVolume = useCallback((delta: number) => {
    setVolume((prevVolume) => {
      const newVolume = Math.max(0, Math.min(1, prevVolume + delta));
      console.log(`[DailyVoiceChat] Volume adjusted to: ${Math.round(newVolume * 100)}%`);

      // Update current TTS player volume if playing
      if (ttsPlayerRef.current) {
        ttsPlayerRef.current
          .setVolumeAsync(newVolume)
          .catch((e) => console.warn('[DailyVoiceChat] Error setting TTS volume:', e));
      }

      return newVolume;
    });
  }, []);

  const increaseVolume = useCallback(() => adjustVolume(0.1), [adjustVolume]);
  const decreaseVolume = useCallback(() => adjustVolume(-0.1), [adjustVolume]);

  const toggleVolumeControls = useCallback(() => {
    setShowVolumeControls((prev) => !prev);
  }, []);

  // --- USER INPUT QUEUING FUNCTIONS ---
  const queueUserInput = useCallback(
    (transcript: string) => {
      if (isCoachSpeakingTTS || isExecutingTool) {
        setUserInputQueue((prev) => [...prev, transcript]);
        console.log(
          '[QUEUE] User input queued during coach speech/function:',
          transcript.substring(0, 50) + '...'
        );
        return true; // Indicates input was queued
      }
      return false; // Indicates input should be processed immediately
    },
    [isCoachSpeakingTTS, isExecutingTool]
  );

  const processQueuedInputs = useCallback(() => {
    if (
      userInputQueue.length > 0 &&
      !isCoachSpeakingTTS &&
      !isExecutingTool &&
      !isProcessingQueue
    ) {
      setIsProcessingQueue(true);
      const nextInput = userInputQueue[0];
      setUserInputQueue((prev) => prev.slice(1));

      console.log('[QUEUE] Processing queued input:', nextInput.substring(0, 50) + '...');

      // Process the queued input by adding it to conversation history
      const messageTimestamp = Date.now();
      const newUserMessage: TimestampedChatMessage = {
        sender: 'user',
        message: nextInput,
        timestamp: messageTimestamp,
        id: v4(),
      };

      setConversationHistory((prev) => {
        const newHistory = [...prev, newUserMessage];
        // Sort by timestamp to maintain proper ordering
        const sortedHistory = newHistory.sort((a, b) => {
          const timeA = a.timestamp || 0;
          const timeB = b.timestamp || 0;
          return timeA - timeB;
        });
        console.log(
          '[DailyVoiceChat] Added queued user message to sorted history, count:',
          sortedHistory.length
        );
        return sortedHistory;
      });
      setCurrentTranscript(nextInput);

      // Trigger coach response if not already responding
      if (dataChannelRef.current?.readyState === 'open') {
        const responseCreateEvent = { type: 'response.create' };
        dataChannelRef.current.send(JSON.stringify(responseCreateEvent));
        setIsReceivingCoachMessage(true);
      }

      setTimeout(() => {
        setIsProcessingQueue(false);
        // Process next item in queue if any
        if (userInputQueue.length > 0) {
          processQueuedInputs();
        }
      }, 1000); // Small delay between processing queued items
    }
  }, [userInputQueue, isCoachSpeakingTTS, isExecutingTool, isProcessingQueue]);

  // Effect to process queue when conditions change
  useEffect(() => {
    processQueuedInputs();
  }, [processQueuedInputs]);

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
    const commonWords = words1.filter((word) => words2.includes(word));
    const similarityRatio = commonWords.length / Math.min(words1.length, words2.length);
    console.log(
      `[DailyVoiceChat] Word similarity: ${commonWords.length}/${Math.min(words1.length, words2.length)} = ${similarityRatio * 100}%`
    );

    if (similarityRatio >= 0.9) {
      console.log('[DailyVoiceChat] MATCH: Word similarity >= 90%');
      return true;
    }

    console.log('[DailyVoiceChat] NO MATCH: Texts not similar enough');
    return false;
  };

  // --- AI CONFIGURATION ---
  const configureAIInstructions = useCallback(
    async (dc: any) => {
      if (dc && dc.readyState === 'open') {
        // Get basic system instructions with today's and tomorrow's training, coach information, weather data, and location context
        const systemInstructions = await buildSystemPrompt(
          currentTrainingPlan || undefined,
          coachId,
          weatherData
        );

        // Get tools definition
        const toolsDefinition = getToolsDefinitionForRealtimeAPI();

        // Build user context if profile exists
        let userContext = '';
        if (profile && currentTrainingPlan) {
          try {
            // Use the same context building function as regular chat for consistency
            // Use the last 10 messages from previous chat history (same as ChatMini)
            const recentChatHistory = previousChatHistory.slice(-MAX_CONVERSATION_HISTORY_MESSAGES);
            userContext = buildUserContextString(
              profile,
              currentTrainingPlan,
              recentChatHistory, // Use previous chat history instead of current session
              userFeedback // User feedback if available
            );

            console.log('[DailyVoiceChat] User context prepared with:', {
              trainingPlanWorkouts: currentTrainingPlan?.length || 0,
              recentChatMessages: recentChatHistory.length,
              hasFeedback: !!userFeedback,
            });
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
            input_audio_transcription: {
              // Enable user input transcription
              model: 'whisper-1',
            },
            input_audio_noise_reduction: {
              type: 'near_field',
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.8,
              prefix_padding_ms: 800,
              silence_duration_ms: 1500, // Changed from 800 to 1000
              create_response: true,
              interrupt_response: true,
            },
          },
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
                  tools: toolsDefinition,
                },
              };

              console.log(
                '[DailyVoiceChat] Full tools update event:',
                JSON.stringify(toolsUpdateEvent)
              );
              dc.send(JSON.stringify(toolsUpdateEvent));
              console.log('[DailyVoiceChat] Sent tools configuration separately.');

              // Make coach speak first with a friendly greeting after a short delay
              // We'll rely on the system prompt to guide the initial message
              // Reduced delay (1000ms → 700ms)
              setTimeout(() => {
                if (dc.readyState === 'open' && !isCoachSpeakingTTS && !isReceivingCoachMessage) {
                  // Simply use response.create - this is the safe approach that won't break the connection
                  const responseCreateEvent = {
                    type: 'response.create',
                  };
                  dc.send(JSON.stringify(responseCreateEvent));
                  console.log(
                    '[DailyVoiceChat] Sent response.create event to make coach speak first'
                  );
                  setIsReceivingCoachMessage(true);
                } else {
                  console.log(
                    '[DailyVoiceChat] Skipping initial greeting - DataChannel state:',
                    dc.readyState,
                    'isCoachSpeakingTTS:',
                    isCoachSpeakingTTS,
                    'isReceivingCoachMessage:',
                    isReceivingCoachMessage
                  );
                }
              }, 700);
            } catch (e) {
              console.error('[DailyVoiceChat] Error sending tools configuration:', e);
            }
          }
        }, 800);
      } else {
        console.error(
          '[DailyVoiceChat] Cannot configure AI: DataChannel not open or not available.'
        );
        handleError('Failed to configure AI: DataChannel not ready.', true);
        setFallbackMode(true);
      }
    },
    [
      buildSystemPrompt,
      getToolsDefinitionForRealtimeAPI,
      handleError,
      profile,
      currentTrainingPlan,
      previousChatHistory,
      userFeedback,
      coachId,
      weatherData,
    ]
  );

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
      const supabaseUrl = 'https://tdwtacijcmpfnwlovlxh.supabase.co';

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
            Accept: 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini-realtime-preview',
            voice: 'verse',
          }),
          signal: controller.signal,
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
          console.log(
            '[DailyVoiceChat] Got key but component state changed, not initializing WebRTC'
          );
          setIsConnecting(false);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    } catch (err) {
      console.error('[DailyVoiceChat] Error getting ephemeral key:', err);
      handleError(
        `Failed to get ephemeral key: ${err instanceof Error ? err.message : 'Unknown error'}`,
        true
      );
      setIsConnecting(false);
      setIsLoading(false);

      // Consider fallback mode for API-related errors
      if (
        err instanceof Error &&
        (err.message.includes('API') ||
          err.message.includes('key') ||
          err.message.includes('ephemeral'))
      ) {
        setFallbackMode(true);
      }
    }
  }, [isVisible, handleError]);

  const initializeWebRTC = useCallback(
    async (ephemeralKey: string) => {
      try {
        // DEBUG FIX: Force reset voice session manager to clear any stale state from hot reloading
        console.log('[DailyVoiceChat] DEBUG: Checking voice session manager state');
        console.log('[DailyVoiceChat] Pre-start state:', voiceSessionManager.getDebugState());
        
        // If there's stale state, reset it
        if (voiceSessionManager.isSessionActive()) {
          console.warn('[DailyVoiceChat] Found stale session state, resetting...');
          voiceSessionManager.debugReset();
          console.log('[DailyVoiceChat] Post-reset state:', voiceSessionManager.getDebugState());
        }

        // Check if we can start a session before proceeding
        if (!voiceSessionManager.canStartSession('daily')) {
          throw new Error('Another voice session is active. Please wait for it to complete.');
        }

        console.log('[DailyVoiceChat] Initializing WebRTC with OpenAI Realtime API...');

        // Create a session ID for tracking conversation
        const sessionId = voiceSessionManager.startSession(coachId, 'daily');

        // Set up WebRTC connection
        const configuration = {
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        };

        // Create peer connection
        const pc = new RTCPeerConnection(configuration);
        peerConnectionRef.current = pc;

        // Create data channel for sending/receiving events
        const dc = pc.createDataChannel('oai-events');
        dataChannelRef.current = dc;

        // Set up event handlers for the data channel
        // @ts-ignore - Using onopen instead of addEventListener for compatibility
        dc.onopen = async () => {
          console.log('[DailyVoiceChat] Data channel opened');

          // Don't send instructions if component isn't visible anymore
          if (!isVisible) {
            console.log('[DailyVoiceChat] Component not visible, skipping AI instructions');
            return;
          }

          // Send instructions when data channel opens
          if (dc.readyState === 'open') {
            await configureAIInstructions(dc);
          }
        };

        // @ts-ignore - Using onmessage instead of addEventListener for compatibility
        dc.onmessage = (event: RTCMessageEvent) => {
          // Removed verbose logging to clean up console output

          try {
            const data = JSON.parse(event.data);

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

            // Process response.content_part.added first (coach message streaming)
            else if (data.type === 'response.content_part.added') {
              console.log('[DailyVoiceChat] Response content part added:', JSON.stringify(data));
              // This is handled by the standard content streaming logic below
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

              // Store the current response ID for tracking speech start times
              if (data.response && data.response.id) {
                currentResponseIdRef.current = data.response.id;
                console.log(`[TIMESTAMP_DEBUG] Set current response ID: ${data.response.id}`);
              }

              setIsReceivingCoachMessage(true);
              setShowAnimatedCoachView(true); // Ensure coach is visible when responding
            }

            // Process response.done event (coach has completed response)
            else if (data.type === 'response.done') {
              console.log('[DailyVoiceChat] Response completed');

              // Clear the current response ID since this response is complete
              if (currentResponseIdRef.current) {
                console.log(
                  `[TIMESTAMP_DEBUG] Clearing current response ID: ${currentResponseIdRef.current}`
                );
                currentResponseIdRef.current = null;
              }

              setIsReceivingCoachMessage(false);
            }

            // Handle response.audio_transcript.done for coach messages
            else if (data.type === 'response.audio_transcript.done') {
              console.log(
                '[DailyVoiceChat] Coach audio transcript completed:',
                JSON.stringify(data)
              );

              try {
                const transcript = data.transcript;
                const responseId = data.response_id;

                if (transcript && transcript.trim()) {
                  // Clean up the transcript - trim whitespace and normalize spaces
                  const cleanedTranscript = transcript.trim().replace(/\s+/g, ' ');
                  console.log(`[DailyVoiceChat] Coach said: "${cleanedTranscript}"`);

                  // Update UI with coach message
                  setPendingCoachResponse(cleanedTranscript);

                  // **FIXED: Use speech start time for proper chronological ordering**
                  // This ensures messages are ordered by when speech STARTED, not when it finished
                  // Get speech start time from stored ref or fallback to current time
                  const storedStartTime = speechStartTimesRef.current[responseId];
                  const messageTimestamp = storedStartTime || coachSpeechStartTime || Date.now();
                  console.log(
                    `[TIMESTAMP_DEBUG] Coach message - ResponseID: ${responseId}, Stored: ${storedStartTime}, State: ${coachSpeechStartTime}, Using: ${messageTimestamp}, Completion: ${Date.now()}`
                  );

                  // Clean up the stored start time for this response
                  if (storedStartTime) {
                    delete speechStartTimesRef.current[responseId];
                  }

                  const newCoachMessage: TimestampedChatMessage = {
                    sender: 'coach',
                    message: cleanedTranscript,
                    timestamp: messageTimestamp,
                    id: v4(),
                  };

                  setConversationHistory((prev) => {
                    const newHistory = [...prev, newCoachMessage];
                    // Sort by timestamp to maintain proper ordering
                    const sortedHistory = newHistory.sort((a, b) => {
                      const timeA = a.timestamp || 0;
                      const timeB = b.timestamp || 0;
                      return timeA - timeB;
                    });
                    console.log(
                      '[DailyVoiceChat] Added coach message to sorted history, count:',
                      sortedHistory.length
                    );
                    console.log(
                      `[TIMESTAMP_DEBUG] Coach message added with timestamp: ${messageTimestamp}`
                    );
                    return sortedHistory;
                  });

                  // Don't clear speech start time here - let output_audio_buffer.stopped handle it
                } else {
                  console.log('[DailyVoiceChat] Empty or invalid coach transcript received');
                }
              } catch (e) {
                console.error('[DailyVoiceChat] Error processing coach transcript:', e);
              }
            }

            // Handle output audio buffer events for coach audio playback
            else if (data.type === 'output_audio_buffer.started') {
              const speechStartTime = Date.now();
              console.log('[DailyVoiceChat] Output audio buffer started');
              console.log(`[TIMESTAMP_DEBUG] Coach speech buffer started at: ${speechStartTime}`);

              // Store start time by current response ID if available
              if (currentResponseIdRef.current) {
                speechStartTimesRef.current[currentResponseIdRef.current] = speechStartTime;
                console.log(
                  `[TIMESTAMP_DEBUG] Stored start time ${speechStartTime} for response ${currentResponseIdRef.current}`
                );
              }

              setCoachSpeechStartTime(speechStartTime); // Keep for backward compatibility
              setIsCoachSpeakingTTS(true);
              setShowAnimatedCoachView(true);
              if (onSpeakingStateChange) onSpeakingStateChange(true, 'coach');
              console.log(`[INPUT_BLOCK] Setting input block at ${Date.now()} (coach started speaking)`);
              console.log(`[MIC_BLOCK] Muting microphone at ${Date.now()} (coach started speaking)`);
              if (localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach(track => track.enabled = false);
              }
              if (micMuteTimeoutRef.current) clearTimeout(micMuteTimeoutRef.current);
              micMuteTimeoutRef.current = setTimeout(() => {
                console.log(`[MIC_BLOCK] Unmuting microphone at ${Date.now()} (3s elapsed)`);
                if (localStreamRef.current) {
                  localStreamRef.current.getAudioTracks().forEach(track => track.enabled = true);
                }
              }, 3000);
            } else if (data.type === 'output_audio_buffer.stopped') {
              console.log('[DailyVoiceChat] Output audio buffer stopped');
              console.log(
                `[TIMESTAMP_DEBUG] Coach speech buffer stopped, clearing start time: ${coachSpeechStartTime}`
              );

              // Clean up any leftover speech start times for the current response
              if (
                currentResponseIdRef.current &&
                speechStartTimesRef.current[currentResponseIdRef.current]
              ) {
                console.log(
                  `[TIMESTAMP_DEBUG] Cleaning up leftover speech start time for response: ${currentResponseIdRef.current}`
                );
                delete speechStartTimesRef.current[currentResponseIdRef.current];
              }

              setIsCoachSpeakingTTS(false);
              setCoachSpeechStartTime(null); // Clear the speech start time when audio stops
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
              console.log(
                '[DailyVoiceChat] Conversation item created with type:',
                data.item?.type || 'unknown type',
                'data:',
                JSON.stringify(data.item || {})
              );

              // Check item type and process appropriately
              if (data.item?.type === 'transcript' && data.item.transcript?.speaker === 'user') {
                console.log(`[INPUT_BLOCK] User transcript event (item.created) received at ${Date.now()} (blocked: state=${isInputBlocked}, ref=${isInputBlockedRef.current})`, data.item.transcript.text);
                if (isInputBlockedRef.current) {
                  console.log(`[INPUT_BLOCK] Ignoring user input (item.created) due to input block window at ${Date.now()}. Transcript:`, data.item.transcript.text);
                  return;
                } else {
                  console.log(`[INPUT_BLOCK] Processing user input (item.created, not blocked) at ${Date.now()}. Transcript:`, data.item.transcript.text);
                  // Clean up the transcript - trim whitespace and normalize spaces
                  const cleanedTranscript = data.item.transcript.text.trim().replace(/\s+/g, ' ');
                  console.log('[DailyVoiceChat] User transcript received:', cleanedTranscript);

                  // **DETAILED INTERRUPTION LOGGING**
                  console.log('[INTERRUPTION_DEBUG] User transcript detected:');
                  console.log('  - Transcript:', cleanedTranscript);
                  console.log('  - isCoachSpeakingTTS:', isCoachSpeakingTTS);
                  console.log('  - isReceivingCoachMessage:', isReceivingCoachMessage);
                  console.log('  - coachSpeechStartTime:', coachSpeechStartTime);
                  console.log('  - userSpeechStartTime:', userSpeechStartTime);
                  console.log('  - Current time:', Date.now());

                  // Additional check: If coach was speaking recently, this might be an erroneous interruption
                  const now = Date.now();
                  const coachSpeechRecent = coachSpeechStartTime && now - coachSpeechStartTime < 5000; // Within 5 seconds
                  const transcriptLooksLikeCoach =
                    cleanedTranscript.length > 50 &&
                    !cleanedTranscript.toLowerCase().includes('okay') &&
                    !cleanedTranscript.toLowerCase().includes('yes') &&
                    !cleanedTranscript.toLowerCase().includes('no');

                  if (coachSpeechRecent && transcriptLooksLikeCoach) {
                    console.log('[INTERRUPTION_DEBUG] ⚠️ POTENTIAL ERRONEOUS INTERRUPTION DETECTED:');
                    console.log('  - Coach was speaking recently:', coachSpeechRecent);
                    console.log('  - Transcript looks like coach speech:', transcriptLooksLikeCoach);
                    console.log('  - Transcript:', cleanedTranscript);
                    console.log('  - This might be coach speech wrongly attributed to user');
                  }

                  // Update UI with transcript
                  setCurrentTranscript(cleanedTranscript);
                  setUserTranscriptJustReceived(true);

                  // **ENHANCED: Use most recent user speech start time or reasonable fallback**
                  let messageTimestamp;
                  let usedBackup = false;

                  if (userSpeechStartTime) {
                    messageTimestamp = userSpeechStartTime;
                    console.log(
                      `[TIMESTAMP_DEBUG] ✅ Using captured user speech start time: ${userSpeechStartTime}`
                    );
                  } else if (userSpeechStartTimesRef.current['latest']) {
                    messageTimestamp = userSpeechStartTimesRef.current['latest'];
                    usedBackup = true;
                    console.log(
                      `[TIMESTAMP_DEBUG] ✅ Using backup user speech start time: ${messageTimestamp} (state was null)`
                    );
                  } else {
                    // Fallback: estimate speech start time based on transcript length and speaking rate
                    const wordCount = cleanedTranscript.split(' ').length;
                    const estimatedDurationMs = Math.max(1000, (wordCount / 2.5) * 1000); // At least 1 second
                    messageTimestamp = now - estimatedDurationMs;
                    console.log(
                      `[TIMESTAMP_DEBUG] ⚠️ FALLBACK: Estimated user speech start time: ${messageTimestamp} (${estimatedDurationMs}ms ago for ${wordCount} words)`
                    );
                  }

                  console.log(
                    `[TIMESTAMP_DEBUG] User message - Start: ${userSpeechStartTime}, Backup: ${userSpeechStartTimesRef.current['latest']}, Using: ${messageTimestamp}, Completion: ${Date.now()}`
                  );

                  const newUserMessage: TimestampedChatMessage = {
                    sender: 'user',
                    message: cleanedTranscript,
                    timestamp: messageTimestamp,
                    id: v4(),
                  };

                  setConversationHistory((prev) => {
                    const newHistory = [...prev, newUserMessage];
                    // Sort by timestamp to maintain proper ordering
                    const sortedHistory = newHistory.sort((a, b) => {
                      const timeA = a.timestamp || 0;
                      const timeB = b.timestamp || 0;
                      return timeA - timeB;
                    });
                    console.log(
                      '[DailyVoiceChat] Added user message (transcription) to sorted history, count:',
                      sortedHistory.length
                    );
                    console.log(
                      `[TIMESTAMP_DEBUG] User message added with timestamp: ${messageTimestamp}`
                    );

                    // Log the current order after adding this message
                    console.log(
                      `[TIMESTAMP_DEBUG] Current conversation order after adding user message:`
                    );
                    sortedHistory.forEach((msg, index) => {
                      console.log(
                        `[TIMESTAMP_DEBUG] [${index}] ${msg.sender}: "${msg.message.substring(0, 30)}..." (${msg.timestamp})`
                      );
                    });

                    return sortedHistory;
                  });

                  // Clear the speech start time after using it and add debugging
                  if (userSpeechStartTime) {
                    setUserSpeechStartTime(null);
                    console.log(
                      `[TIMESTAMP_DEBUG] User speech start time cleared after using: ${messageTimestamp}`
                    );
                  } else {
                    console.log(
                      `[TIMESTAMP_DEBUG] No user speech start time to clear (was already null)`
                    );
                  }

                  // Clear backup after successful use
                  if (usedBackup) {
                    delete userSpeechStartTimesRef.current['latest'];
                    console.log(
                      `[TIMESTAMP_DEBUG] Cleared backup speech start time after using: ${messageTimestamp}`
                    );
                  }

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
              }
              // Handle different types of content structure
              else if (data.item?.type === 'message' && data.item.role === 'assistant') {
                // Handle different types of content structure
                let messageContent = '';

                // Check for string content
                if (typeof data.item.content === 'string') {
                  messageContent = data.item.content;
                  console.log(
                    '[DailyVoiceChat] Assistant message received (string content):',
                    messageContent.substring(0, 100) + '...'
                  );
                }
                // Check for array of content items
                else if (Array.isArray(data.item.content)) {
                  // Try to extract text from content array
                  for (const contentItem of data.item.content) {
                    if (contentItem.type === 'text' && contentItem.text) {
                      messageContent += contentItem.text;
                    }
                  }
                  console.log(
                    '[DailyVoiceChat] Assistant message received (array content):',
                    messageContent
                      ? messageContent.substring(0, 100) + '...'
                      : 'No text content found'
                  );
                }

                // Only update UI if there's content
                if (messageContent) {
                  // Clean up the message content - trim whitespace and normalize spaces
                  const cleanedContent = messageContent.trim().replace(/\s+/g, ' ');

                  // Update UI with coach message
                  setPendingCoachResponse(cleanedContent);

                  // **FIXED: Use speech start time for proper chronological ordering**
                  // This ensures messages are ordered by when speech STARTED, not when it finished
                  // Get speech start time from stored ref or fallback to current time
                  const currentResponseId = currentResponseIdRef.current;
                  const storedStartTime = currentResponseId
                    ? speechStartTimesRef.current[currentResponseId]
                    : null;
                  const messageTimestamp = storedStartTime || coachSpeechStartTime || Date.now();
                  console.log(
                    `[TIMESTAMP_DEBUG] Coach assistant message - ResponseID: ${currentResponseId}, Stored: ${storedStartTime}, State: ${coachSpeechStartTime}, Using: ${messageTimestamp}, Completion: ${Date.now()}`
                  );

                  // Clean up the stored start time for this response if used
                  if (storedStartTime && currentResponseId) {
                    delete speechStartTimesRef.current[currentResponseId];
                  }

                  const newCoachMessage: TimestampedChatMessage = {
                    sender: 'coach',
                    message: cleanedContent,
                    timestamp: messageTimestamp,
                    id: v4(),
                  };

                  setConversationHistory((prev) => {
                    const newHistory = [...prev, newCoachMessage];
                    // Sort by timestamp to maintain proper ordering
                    const sortedHistory = newHistory.sort((a, b) => {
                      const timeA = a.timestamp || 0;
                      const timeB = b.timestamp || 0;
                      return timeA - timeB;
                    });
                    console.log(
                      '[DailyVoiceChat] Added coach message (assistant) to sorted history, count:',
                      sortedHistory.length
                    );
                    console.log(
                      `[TIMESTAMP_DEBUG] Coach assistant message added with timestamp: ${messageTimestamp}`
                    );
                    return sortedHistory;
                  });

                  // Don't clear speech start time here - let output_audio_buffer.stopped handle it
                }
              }
              // Handle function calls
              else if (data.item?.type === 'function_call') {
                console.log(
                  '[DailyVoiceChat] Function call item created:',
                  JSON.stringify(data.item)
                );

                // Store the function name for later use
                if (data.item.call_id && data.item.name) {
                  console.log(
                    `[DailyVoiceChat] Storing function name for call ${data.item.call_id}: ${data.item.name}`
                  );
                  functionNameMapRef.current[data.item.call_id] = data.item.name;
                  setFunctionNameMap({ ...functionNameMapRef.current });
                }

                // This will be handled separately by the function call handler
              }
              // Handle other item types
              else {
                console.log(
                  '[DailyVoiceChat] Unhandled conversation item type:',
                  data.item?.type || 'unknown',
                  JSON.stringify(data.item || {})
                );
              }
            }

            // Handle input audio transcription events for user speech
            else if (data.type === 'conversation.item.input_audio_transcription.completed') {
              console.log(`[INPUT_BLOCK] User transcript event received at ${Date.now()} (blocked: state=${isInputBlocked}, ref=${isInputBlockedRef.current})`, data.transcript);
              if (isInputBlockedRef.current) {
                console.log(`[INPUT_BLOCK] Ignoring user input due to input block window at ${Date.now()}. Transcript:`, data.transcript);
                return;
              } else {
                console.log(`[INPUT_BLOCK] Processing user input (not blocked) at ${Date.now()}. Transcript:`, data.transcript);
                console.log(
                  '[DailyVoiceChat] User input audio transcription completed:',
                  JSON.stringify(data)
                );

                try {
                  const transcript = data.transcript;
                  const itemId = data.item_id;

                  if (transcript && transcript.trim()) {
                    // Clean up the transcript - trim whitespace and normalize spaces
                    const cleanedTranscript = transcript.trim().replace(/\s+/g, ' ');
                    console.log(`[DailyVoiceChat] User said: "${cleanedTranscript}"`);

                    // **DETAILED INTERRUPTION LOGGING**
                    console.log('[INTERRUPTION_DEBUG] User transcription completed:');
                    console.log('  - Transcript:', cleanedTranscript);
                    console.log('  - isCoachSpeakingTTS:', isCoachSpeakingTTS);
                    console.log('  - isReceivingCoachMessage:', isReceivingCoachMessage);
                    console.log('  - coachSpeechStartTime:', coachSpeechStartTime);
                    console.log('  - userSpeechStartTime:', userSpeechStartTime);
                    console.log('  - Current time:', Date.now());

                    // Additional check: If coach was speaking recently, this might be an erroneous interruption
                    const now = Date.now();
                    const coachSpeechRecent =
                      coachSpeechStartTime && now - coachSpeechStartTime < 5000; // Within 5 seconds
                    const transcriptLooksLikeCoach =
                      cleanedTranscript.length > 50 &&
                      !cleanedTranscript.toLowerCase().includes('okay') &&
                      !cleanedTranscript.toLowerCase().includes('yes') &&
                      !cleanedTranscript.toLowerCase().includes('no');

                    if (coachSpeechRecent && transcriptLooksLikeCoach) {
                      console.log(
                        '[INTERRUPTION_DEBUG] ⚠️ POTENTIAL ERRONEOUS INTERRUPTION DETECTED:'
                      );
                      console.log('  - Coach was speaking recently:', coachSpeechRecent);
                      console.log(
                        '  - Transcript looks like coach speech:',
                        transcriptLooksLikeCoach
                      );
                      console.log('  - Transcript:', cleanedTranscript);
                      console.log('  - This might be coach speech wrongly attributed to user');

                      // For now, we'll still process it but with extra logging
                      console.log('[INTERRUPTION_DEBUG] Processing anyway but flagged for review');
                    }

                    // Check if input should be queued due to coach speaking or function execution
                    const wasQueued = queueUserInput(cleanedTranscript);

                    if (wasQueued) {
                      console.log(
                        `[QUEUE] User input "${cleanedTranscript.substring(0, 30)}..." queued for later processing`
                      );
                      // Still update UI with transcript for user feedback
                      setCurrentTranscript(cleanedTranscript);
                      setUserTranscriptJustReceived(true);
                      return; // Exit early - input was queued
                    }

                    // Process input immediately if not queued
                    // Update UI with transcript
                    setCurrentTranscript(cleanedTranscript);
                    setUserTranscriptJustReceived(true);

                    // **ENHANCED: Use most recent user speech start time or reasonable fallback**
                    let messageTimestamp;
                    let usedBackup = false;

                    if (userSpeechStartTime) {
                      messageTimestamp = userSpeechStartTime;
                      console.log(
                        `[TIMESTAMP_DEBUG] ✅ Using captured user speech start time: ${userSpeechStartTime}`
                      );
                    } else if (userSpeechStartTimesRef.current['latest']) {
                      messageTimestamp = userSpeechStartTimesRef.current['latest'];
                      usedBackup = true;
                      console.log(
                        `[TIMESTAMP_DEBUG] ✅ Using backup user speech start time: ${messageTimestamp} (state was null)`
                      );
                    } else {
                      // Fallback: estimate speech start time based on transcript length and speaking rate
                      // Average speaking rate is ~150 words per minute = 2.5 words per second
                      const wordCount = cleanedTranscript.split(' ').length;
                      const estimatedDurationMs = Math.max(1000, (wordCount / 2.5) * 1000); // At least 1 second
                      messageTimestamp = now - estimatedDurationMs;
                      console.log(
                        `[TIMESTAMP_DEBUG] ⚠️ FALLBACK: Estimated user speech start time: ${messageTimestamp} (${estimatedDurationMs}ms ago for ${wordCount} words)`
                      );
                    }

                    console.log(
                      `[TIMESTAMP_DEBUG] User message - Start: ${userSpeechStartTime}, Backup: ${userSpeechStartTimesRef.current['latest']}, Using: ${messageTimestamp}, Completion: ${Date.now()}`
                    );

                    const newUserMessage: TimestampedChatMessage = {
                      sender: 'user',
                      message: cleanedTranscript,
                      timestamp: messageTimestamp,
                      id: v4(),
                    };

                    setConversationHistory((prev) => {
                      const newHistory = [...prev, newUserMessage];
                      // Sort by timestamp to maintain proper ordering
                      const sortedHistory = newHistory.sort((a, b) => {
                        const timeA = a.timestamp || 0;
                        const timeB = b.timestamp || 0;
                        return timeA - timeB;
                      });
                      console.log(
                        '[DailyVoiceChat] Added user message (transcription) to sorted history, count:',
                        sortedHistory.length
                      );
                      console.log(
                        `[TIMESTAMP_DEBUG] User message added with timestamp: ${messageTimestamp}`
                      );

                      // Log the current order after adding this message
                      console.log(
                        `[TIMESTAMP_DEBUG] Current conversation order after adding user message:`
                      );
                      sortedHistory.forEach((msg, index) => {
                        console.log(
                          `[TIMESTAMP_DEBUG] [${index}] ${msg.sender}: "${msg.message.substring(0, 30)}..." (${msg.timestamp})`
                        );
                      });

                      return sortedHistory;
                    });

                    // Clear the speech start time after using it and add debugging
                    if (userSpeechStartTime) {
                      setUserSpeechStartTime(null);
                      console.log(
                        `[TIMESTAMP_DEBUG] User speech start time cleared after using: ${messageTimestamp}`
                      );
                    } else {
                      console.log(
                        `[TIMESTAMP_DEBUG] No user speech start time to clear (was already null)`
                      );
                    }

                    // Clear backup after successful use
                    if (usedBackup) {
                      delete userSpeechStartTimesRef.current['latest'];
                      console.log(
                        `[TIMESTAMP_DEBUG] Cleared backup speech start time after using: ${messageTimestamp}`
                      );
                    }

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
            }

            // Handle input audio buffer events for user speech timing
            else if (data.type === 'input_audio_buffer.speech_started') {
              console.log('[DailyVoiceChat] User speech started');
              const speechStartTime = Date.now();
              console.log('[INTERRUPTION_DEBUG] User speech started event:');
              console.log('  - isCoachSpeakingTTS:', isCoachSpeakingTTS);
              console.log('  - isReceivingCoachMessage:', isReceivingCoachMessage);
              console.log('  - coachSpeechStartTime:', coachSpeechStartTime);
              console.log('  - speechStartTime captured:', speechStartTime);
              console.log('  - Current time:', Date.now());

              // Check if this is potentially an erroneous detection while coach is speaking
              if (isCoachSpeakingTTS || isReceivingCoachMessage) {
                console.log(
                  '[INTERRUPTION_DEBUG] ⚠️ User speech detected while coach is speaking/responding - potential erroneous interruption'
                );
              }

              setUserSpeechStartTime(speechStartTime); // Keep for backward compatibility
              console.log(`[TIMESTAMP_DEBUG] User speech start time set to: ${speechStartTime}`);
              console.log(
                `[TIMESTAMP_DEBUG] Will store speech start time for next incoming user message`
              );

              // Store in ref as backup to prevent race conditions
              userSpeechStartTimesRef.current['latest'] = speechStartTime;
              console.log(`[TIMESTAMP_DEBUG] Stored backup speech start time: ${speechStartTime}`);
            } else if (data.type === 'input_audio_buffer.speech_stopped') {
              console.log('[DailyVoiceChat] User speech stopped');
              console.log('[INTERRUPTION_DEBUG] User speech stopped event');
              // Keep the start time until we get the transcript
            }

            // Handle response.function_call_arguments.delta events for accumulating function arguments
            else if (data.type === 'response.function_call_arguments.delta') {
              try {
                // Extract the response_id and function call ID from the data
                const responseId = data.response_id;
                const callId = data.call_id;

                if (callId && data.delta) {
                  console.log(
                    `[DailyVoiceChat] Function call args delta for ${callId}:`,
                    data.delta
                  );

                  // Initialize the arguments string if it doesn't exist
                  if (!pendingFunctionArgsRef.current[callId]) {
                    pendingFunctionArgsRef.current[callId] = '';
                  }

                  // Append the delta to the arguments string
                  pendingFunctionArgsRef.current[callId] += data.delta;

                  // Update the state for components that need it
                  setPendingFunctionArgs({ ...pendingFunctionArgsRef.current });

                  console.log(
                    `[DailyVoiceChat] Current accumulated args for ${callId}:`,
                    pendingFunctionArgsRef.current[callId].length > 100
                      ? pendingFunctionArgsRef.current[callId].substring(0, 100) + '...'
                      : pendingFunctionArgsRef.current[callId]
                  );
                }
              } catch (e) {
                console.error(
                  '[DailyVoiceChat] Error processing function call arguments delta:',
                  e
                );
              }
            }

            // Handle response.function_call_arguments.done events
            else if (data.type === 'response.function_call_arguments.done') {
              try {
                const responseId = data.response_id;
                const callId = data.call_id;

                if (callId && pendingFunctionArgsRef.current[callId]) {
                  console.log(
                    `[DailyVoiceChat] Function call args complete for ${callId}:`,
                    pendingFunctionArgsRef.current[callId].length > 100
                      ? pendingFunctionArgsRef.current[callId].substring(0, 100) + '...'
                      : pendingFunctionArgsRef.current[callId]
                  );

                  // Parse the arguments
                  let functionArgs = {};
                  try {
                    functionArgs = JSON.parse(pendingFunctionArgsRef.current[callId]);
                  } catch (e) {
                    console.error(
                      `[DailyVoiceChat] Error parsing function arguments for ${callId}:`,
                      e
                    );
                    functionArgs = {};
                  }

                  // Execute the function using the accumulated arguments
                  executeFunctionCall(callId, functionArgs);

                  // Clear the accumulated arguments
                  delete pendingFunctionArgsRef.current[callId];
                  setPendingFunctionArgs({ ...pendingFunctionArgsRef.current });
                }
              } catch (e) {
                console.error('[DailyVoiceChat] Error processing function call arguments done:', e);
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
          if (!peerConnectionRef.current) return;

          const connectionState = peerConnectionRef.current.connectionState;
          console.log(`[DailyVoiceChat] Connection state changed to: ${connectionState}`);

          switch (connectionState) {
            case 'connecting':
              console.log('[DailyVoiceChat] WebRTC connection in progress');
              setIsConnecting(true);
              break;
            case 'connected':
              console.log('[DailyVoiceChat] WebRTC connection established');
              setIsConnecting(false);
              setIsLoading(false); // Ensure loading is false once connected
              // Start the session timeout timer
              setSessionStartTime(Date.now());
              if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
              sessionTimeoutRef.current = setTimeout(
                () => {
                  console.log(
                    '[DailyVoiceChat] Session timeout reached (25 minutes), ending session.'
                  );
                  handleEndSession(); // Corrected: No argument
                },
                25 * 60 * 1000
              ); // 25 minutes

              // Start audio processing if not already started (e.g., if permissions were delayed)
              if (!isListening && localStreamRef.current) {
                startAudioProcessing();
              }
              break;
            case 'disconnected':
            case 'failed':
            case 'closed':
              console.log(`[DailyVoiceChat] WebRTC connection ${connectionState}`);
              setIsConnecting(false);
              // Clear the session timeout timer
              if (sessionTimeoutRef.current) {
                clearTimeout(sessionTimeoutRef.current);
                sessionTimeoutRef.current = null;
              }
              setSessionStartTime(null);

              // Only call fullCleanupAndClose if the session wasn't intentionally ended by the user
              // and we are not in fallback mode already trying to switch
              if (!conversationComplete && !fallbackMode) {
                // If the state is 'failed', it suggests an unexpected drop.
                // If it's 'closed' or 'disconnected', it might be from cleanup,
                // but we should ensure cleanup runs if not already.
                // Consider a more robust error or reconnection logic for 'failed' if desired.
                handleError(`WebRTC connection ${connectionState}.`, connectionState === 'failed');
                // If connection failed, consider fallback or attempt re-initialization after cleanup
                if (connectionState === 'failed' && !cleanupScheduledRef.current) {
                  console.log(
                    '[DailyVoiceChat] Connection failed, attempting cleanup and possibly retry or fallback.'
                  );
                  // Fallback or retry logic could be triggered here after cleanup
                }
                // Ensure cleanup happens if connection drops unexpectedly
                if (!cleanupScheduledRef.current) {
                  fullCleanupAndClose();
                }
              }
              break;
          }
        };

        // Handle incoming remote audio tracks
        // @ts-ignore
        pc.ontrack = (event: any) => {
          console.log(`[DailyVoiceChat] Received track: ${event.track.kind}`);
          if (event.track.kind === 'audio') {
            console.log('[DailyVoiceChat] Audio track received - setting up for automatic playback');
            
            // COMPREHENSIVE AUDIO DEBUG LOGGING
            console.log('[AUDIO_DEBUG] Track details:', {
              enabled: event.track.enabled,
              readyState: event.track.readyState,
              id: event.track.id,
              kind: event.track.kind,
              label: event.track.label
            });
            
            // Create MediaStream with the received audio track
            const audioStream = new MediaStream([event.track]);
            setRemoteAudioStream(audioStream);
            
            console.log('[AUDIO_DEBUG] MediaStream created with tracks:', audioStream.getTracks().length);
            console.log('[AUDIO_DEBUG] Audio track enabled after MediaStream creation:', event.track.enabled);
            
            console.log('[DailyVoiceChat] Remote audio stream created and stored');

            // REAL SOLUTION: Use only InCallManager for WebRTC audio routing
            // Avoid all expo-av audio session manipulation which kills WebRTC audio
            console.log('[AUDIO_FIX] Setting up WebRTC audio routing with InCallManager only');
            
            // Simple, clean speaker configuration through InCallManager
            InCallManager.setForceSpeakerphoneOn(true);
            console.log('[AUDIO_FIX] Speaker mode configured through InCallManager');

            // Store the remote audio stream
            setRemoteAudioStream(audioStream);
            console.log('[DailyVoiceChat] Remote audio stream configured for playback');

            // Additional speaker mode reinforcement after a delay
            setTimeout(() => {
              console.log('[DailyVoiceChat] Re-applying speaker mode after delay');
              InCallManager.setForceSpeakerphoneOn(true);
              
              // VERIFY TRACK IS STILL ACTIVE
              console.log('[AUDIO_DEBUG] Track status after 500ms:', {
                enabled: event.track.enabled,
                readyState: event.track.readyState
              });
            }, 500);
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
              handleError(
                'Connection to AI coach was lost. There might be an issue with the OpenAI service.',
                true
              );
              setFallbackMode(true);
            }
          }
        };

        // Get local media stream
        try {
          console.log('[DailyVoiceChat] Getting user media...');
          const stream = await mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            } as any,
            video: false,
          });
          console.log('[DailyVoiceChat] Got local media stream');

          localStreamRef.current = stream;

          // Add tracks from local stream to peer connection
          stream.getTracks().forEach((track) => {
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
          const sdpResponse = await fetch(
            `https://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${ephemeralKey}`,
                'Content-Type': 'application/sdp',
              },
              body: pc.localDescription?.sdp,
            }
          );

          if (!sdpResponse.ok) {
            const errorText = await sdpResponse.text().catch(() => '');
            console.error(
              `[DailyVoiceChat] API response error: ${sdpResponse.status} - ${errorText}`
            );
            throw new Error(
              `Failed to send SDP: ${sdpResponse.status}${errorText ? ' - ' + errorText : ''}`
            );
          }

          // Get the answer SDP from OpenAI
          console.log('[DailyVoiceChat] Received SDP answer from OpenAI');
          const answerSdp = await sdpResponse.text();

          // Set the remote description with the answer from OpenAI
          console.log('[DailyVoiceChat] Setting remote description...');
          const answer = new RTCSessionDescription({
            type: 'answer',
            sdp: answerSdp,
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
        handleError(
          `Failed to set up WebRTC connection: ${err instanceof Error ? err.message : 'Unknown error'}`,
          true
        );
        setIsConnecting(false);
        setIsLoading(false);

        // Consider fallback mode
        if (
          err instanceof Error &&
          (err.message.includes('API') ||
            err.message.includes('key') ||
            err.message.includes('model'))
        ) {
          setFallbackMode(true);
        }
      }
    },
    [
      isVisible,
      configureAIInstructions,
      handleError,
      playTTSAudio,
      startAudioProcessing,
      userId,
      userFeedback,
    ]
  );

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
          console.log(
            `[DailyVoiceChat] Already tried ${maxRetries} times, stopping initialization attempts`
          );
          setIsLoading(false);
          setErrorState(
            `Failed to initialize after ${maxRetries} attempts. Please switch to text chat.`
          );
          setFallbackMode(true);
          return;
        }

        console.log(
          '[DailyVoiceChat] Session not initialized or becoming visible, performing setup.'
        );
        
        // PREVENT RAPID RE-INITIALIZATION - Check if enough time has passed since last cleanup
        if (lastCleanupTime) {
          const timeSinceCleanup = Date.now() - lastCleanupTime;
          const MIN_DELAY_AFTER_CLEANUP = 2000; // 2 seconds minimum delay
          
          if (timeSinceCleanup < MIN_DELAY_AFTER_CLEANUP) {
            console.log(
              `[DailyVoiceChat] Delaying initialization - only ${timeSinceCleanup}ms since last cleanup (minimum ${MIN_DELAY_AFTER_CLEANUP}ms)`
            );
            setTimeout(() => {
              setIsInitializedThisSession(false); // Trigger re-attempt
            }, MIN_DELAY_AFTER_CLEANUP - timeSinceCleanup);
            return;
          }
        }
        
        setIsLoading(true);
        setConversationHistory([]);
        setConversationComplete(false);
        setFallbackMode(false);
        setErrorState(null);

        try {
          console.log('[DailyVoiceChat] Configuring audio and InCallManager...');

          // REAL SOLUTION: Use RTCAudioSession instead of expo-av
          // Research shows expo-av.setAudioModeAsync() deactivates AVAudioSession, killing WebRTC audio
          // RTCAudioSession is designed specifically to work with WebRTC without conflicts
          console.log('[AUDIO_FIX] Implementing RTCAudioSession-based solution');
          
          try {
            // CORE FIX: Use only InCallManager for speaker routing, NOT session activation
            // This prevents interference with RTCAudioSession's manual audio management
            console.log('[AUDIO_FIX] Configuring speaker routing with InCallManager only (no session activation)');
            
            // STEP 1: Only stop existing InCallManager routing (do NOT start new sessions)
            InCallManager.stop();
            console.log('[AUDIO_FIX] Stopped existing InCallManager routing');
            
            // STEP 2: Brief pause to ensure clean state
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // STEP 3: Configure speaker routing ONLY (let RTCAudioSession handle session management)
            InCallManager.setForceSpeakerphoneOn(true);
            console.log('[AUDIO_FIX] ✅ Speaker routing configured (RTCAudioSession handles session management)');
            
            // STEP 4: Verify RTCAudioSession is managing the audio session
            const { RTCAudioSession } = NativeModules;
            if (RTCAudioSession && Platform.OS === 'ios') {
              try {
                // Ensure RTCAudioSession is active and managing audio
                await RTCAudioSession.setActive(true);
                console.log('[AUDIO_FIX] ✅ RTCAudioSession is actively managing audio session');
              } catch (sessionError) {
                console.log('[AUDIO_FIX] RTCAudioSession activation handled automatically');
              }
            }
            
          } catch (audioConfigError) {
            console.error('[AUDIO_FIX] Audio configuration failed:', audioConfigError);
            console.log('[AUDIO_FIX] Attempting fallback speaker configuration');
            
            // Fallback: Basic speaker routing only
            try {
              InCallManager.setForceSpeakerphoneOn(true);
              console.log('[AUDIO_FIX] Fallback speaker configuration successful');
            } catch (fallbackError) {
              console.error('[AUDIO_FIX] Fallback configuration also failed:', fallbackError);
            }
          }

          console.log('[DailyVoiceChat] Audio session configured for WebRTC with RTCAudioSession.');

          console.log('[DailyVoiceChat] Microphone permission granted.');
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
          console.log(
            `[DailyVoiceChat] Initialization attempt ${retryCountRef.current} failed. Retrying in ${retryDelay}ms...`
          );

          // Schedule retry after delay if we haven't exceeded max retries
          if (retryCountRef.current < maxRetries) {
            setTimeout(() => {
              console.log(
                `[DailyVoiceChat] Retrying initialization (attempt ${retryCountRef.current + 1}/${maxRetries})...`
              );
              setIsInitializedThisSession(false);
            }, retryDelay);
          } else {
            console.log(
              `[DailyVoiceChat] Max retries (${maxRetries}) reached. Giving up on initialization.`
            );
            setErrorState(
              `Failed to initialize after ${maxRetries} attempts. Please switch to text chat.`
            );
            setFallbackMode(true);
          }

          setIsLoading(false);
        }
      } else if (stillVisible) {
        // Already initialized and still visible - do nothing
        console.log(
          '[DailyVoiceChat] Session already initialized, still visible, no action needed.'
        );
      } else if (becameInvisible) {
        // Cleanup when becoming invisible
        console.log(
          '[DailyVoiceChat] Became invisible, performing cleanup and resetting init flag.'
        );
        fullCleanup();
        // Reset for next time it becomes visible
        setIsInitializedThisSession(false);
        retryCountRef.current = 0;
      }
    };

    // Execute the configuration function
    configureAudioAndPermissions();

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
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
  }, [
    isVisible,
    isInitializedThisSession,
    finalCheckMicrophonePermissions,
    fullCleanupAndClose,
    fullCleanup,
    handleError,
    stopAudioProcessing,
  ]);

  // --- EFFECT: Navigation and App State Cleanup ---
  const navigation = useNavigation();
  
  // Handle navigation away from screen
  useFocusEffect(
    useCallback(() => {
      // When screen loses focus (user navigates away), clean up voice chat
      return () => {
        if (isVisible && !cleanupScheduledRef.current) {
          console.log('[DailyVoiceChat] Screen lost focus, performing cleanup...');
          fullCleanupAndClose();
        }
      };
    }, [isVisible, fullCleanupAndClose])
  );

  // Enhanced app state handling
  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('[DailyVoiceChat] App state changed to:', nextAppState);
      
      if (nextAppState !== 'active' && isVisible && !cleanupScheduledRef.current) {
        console.log('[DailyVoiceChat] App became inactive, performing full cleanup...');
        fullCleanupAndClose();
      }
      
      // Handle returning to foreground - reset if necessary
      if (nextAppState === 'active' && peerConnectionRef.current?.connectionState === 'failed') {
        console.log('[DailyVoiceChat] App became active with failed connection, triggering cleanup...');
        fullCleanupAndClose();
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [isVisible, fullCleanupAndClose]);

  // --- EFFECT: Session timeout detection (proactive reset before 30min OpenAI timeout) ---
  useEffect(() => {
    const pc = peerConnectionRef.current;
    const isConnected = pc?.connectionState === 'connected';

    if (isConnected && !sessionStartTime) {
      // Session just connected, start the timer
      const startTime = Date.now();
      setSessionStartTime(startTime);
      console.log('[DailyVoiceChat] Session connected, starting 25-minute timeout timer');

      // Set timeout for 25 minutes (5 minutes before OpenAI's 30min limit)
      sessionTimeoutRef.current = setTimeout(
        () => {
          console.log('[DailyVoiceChat] Proactive session reset - approaching 30min timeout');

          // Show a brief message to user about session refresh
          setErrorState('Refreshing session...');

          // Reset the session after a brief delay
          setTimeout(() => {
            setSessionStartTime(null);
            setErrorState(null);

            // Trigger a clean restart by resetting initialization flag
            setIsInitializedThisSession(false);
            setNeedsRefresh(true);
          }, 1000);
        },
        1 * 60 * 1000
      ); // 1 minute for testing
    } else if (!isConnected && sessionStartTime) {
      // Session disconnected, clear the timer
      console.log('[DailyVoiceChat] Session disconnected, clearing timeout timer');
      setSessionStartTime(null);
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
        sessionTimeoutRef.current = null;
      }
    }

    // Cleanup timeout on unmount
    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
        sessionTimeoutRef.current = null;
      }
    };
  }, [peerConnectionRef.current?.connectionState, sessionStartTime]);

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
      console.log(
        `[DailyVoiceChat] [${index}] ${msg.sender}: "${msg.message.substring(0, 40)}..." (timestamp: ${msg.timestamp || 'missing'})`
      );
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
      localStreamRef.current.getTracks().forEach((track) => track.stop());
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
      // SKIP EXPO-AV - prevent interference with WebRTC audio session
      console.log('[AUDIO_FIX] Skipping expo-av on session end to prevent WebRTC interference');
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
      console.log(
        '[DailyVoiceChat] Calling onSessionComplete with',
        sortedHistory.length,
        'messages'
      );
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

    // ENHANCED ERROR RECOVERY - Check current state before reconnecting
    const currentState = {
      isVisible,
      hasPermission,
      sessionManagerActive: voiceSessionManager.isSessionActive(),
      activeComponent: voiceSessionManager.getActiveComponent(),
      timeSinceLastCleanup: lastCleanupTime ? Date.now() - lastCleanupTime : null,
    };
    
    console.log('[DailyVoiceChat] Pre-reconnect state:', currentState);
    
    // Don't attempt reconnect if conditions aren't right
    if (!isVisible) {
      console.log('[DailyVoiceChat] Cannot reconnect - component not visible');
      return;
    }
    
    if (currentState.sessionManagerActive && currentState.activeComponent !== 'daily') {
      console.log('[DailyVoiceChat] Cannot reconnect - another session type is active');
      setFallbackMode(true);
      return;
    }
    
    // Ensure minimum time since last cleanup
    if (currentState.timeSinceLastCleanup && currentState.timeSinceLastCleanup < 3000) {
      console.log('[DailyVoiceChat] Delaying reconnect - too soon after cleanup');
      setTimeout(() => reconnect(), 3000 - currentState.timeSinceLastCleanup);
      return;
    }

    // First, clean up existing connections/resources
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
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
      ttsPlayerRef.current
        .unloadAsync()
        .catch((e) => console.warn('[DailyVoiceChat] Error unloading TTS player:', e));
      ttsPlayerRef.current = null;
    }

    // Force end any active session
    voiceSessionManager.forceEndSession();

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

    // Mark cleanup time
    setLastCleanupTime(Date.now());

    // Allow a small delay before restarting the initialization process
    setTimeout(() => {
      if (isVisible) {
        console.log('[DailyVoiceChat] Restarting initialization process after cleanup...');

        // Configure speaker routing only (let RTCAudioSession handle session management)
        InCallManager.setForceSpeakerphoneOn(true);
        console.log('[AUDIO_FIX] ✅ Speaker routing configured on reconnect (RTCAudioSession handles session management)');

        // Directly start the permission check to trigger the initialization process
        finalCheckMicrophonePermissions().catch((e) => {
          console.error('[DailyVoiceChat] Error checking permissions on reconnect:', e);
          handleError('Failed to reconnect: ' + (e instanceof Error ? e.message : 'Unknown error'));
        });
      } else {
        console.log(
          '[DailyVoiceChat] Component not visible, waiting for visibility change to reinitialize.'
        );
        setIsLoading(false);
      }
    }, 2000); // Increased delay for more stable reconnection
  }, [isVisible, finalCheckMicrophonePermissions, handleError, lastCleanupTime]);

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
      // Filter out empty messages and sort by timestamp BEFORE saving
      const filteredMessages = history
        .filter((chatMessage) => chatMessage.message.trim() !== '')
        .sort((a, b) => {
          const timeA = a.timestamp || 0;
          const timeB = b.timestamp || 0;
          return timeA - timeB;
        });

      console.log('[DailyVoiceChat] Saving messages in sorted order...');

      // Save messages sequentially to preserve order
      for (const chatMessage of filteredMessages) {
        const messageSender: 'user' | 'coach' = chatMessage.sender === 'user' ? 'user' : 'coach';
        const messagePayload: CoreChatMessage = {
          sender: messageSender,
          message: chatMessage.message,
        };
        console.log(
          '[DailyVoiceChat] Saving message:',
          messagePayload.sender,
          messagePayload.message.substring(0, 30) +
            (messagePayload.message.length > 30 ? '...' : ''),
          'timestamp:',
          chatMessage.timestamp
        );

        // Save each message with its original timestamp (sequential to preserve order)
        await saveMessage(messagePayload, userId, chatMessage.timestamp);
      }

      console.log('[DailyVoiceChat] All messages saved successfully with correct timestamps.');

      // No need to call onSessionComplete here - it's now called in handleEndSession
      // to ensure better sequencing of operations
    } catch (e: any) {
      console.error('[DailyVoiceChat] Error saving conversation to Supabase:', e);
      throw e; // Re-throw so the calling function can handle it
    }
  };

  // Helper function to execute function calls
  const executeFunctionCall = useCallback(
    (callId: string, functionArgs: any) => {
      console.log(`[DailyVoiceChat] Executing function call ${callId} with args:`, functionArgs);

      setIsExecutingTool(true);

      // Set up 10-second timeout for function call
      const timeoutId = setTimeout(() => {
        console.error(`[TIMEOUT] Function call ${callId} timed out after 10 seconds`);

        // Clean up and send error response
        functionCallTimeouts.current.delete(callId);
        setIsExecutingTool(false);

        // Send timeout error back to conversation
        if (dataChannelRef.current?.readyState === 'open') {
          try {
            const functionOutputEvent = {
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify({
                  status: 'error',
                  message: 'Function call timed out after 10 seconds',
                }),
              },
            };
            dataChannelRef.current.send(JSON.stringify(functionOutputEvent));
          } catch (e) {
            console.error('[DailyVoiceChat] Error sending timeout response:', e);
          }
        }

        handleError('Function call timed out');
      }, 10000);

      functionCallTimeouts.current.set(callId, timeoutId);

      // Helper function to clear timeout and finish function call
      const finishFunctionCall = (callId: string) => {
        const timeoutId = functionCallTimeouts.current.get(callId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          functionCallTimeouts.current.delete(callId);
        }

        // Turn off the tool execution indicator after a delay
        setTimeout(() => {
          setIsExecutingTool(false);
        }, 2000);
      };

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
          // Handle workout adjustment - be flexible with argument structure
          let sessionId, adjustmentDetails;

          if (functionArgs.adjustment_details) {
            // Correct format: arguments wrapped in adjustment_details
            sessionId = functionArgs.session_id;
            adjustmentDetails = functionArgs.adjustment_details;
            console.log('[DailyVoiceChat] Using correct format with adjustment_details wrapper');
          } else {
            // AI sent arguments at top level - restructure them
            sessionId = functionArgs.session_id;
            adjustmentDetails = {
              new_date: functionArgs.new_date,
              new_distance: functionArgs.new_distance,
              new_duration_minutes: functionArgs.new_duration_minutes,
              new_suggested_location: functionArgs.new_suggested_location,
              intensity_change: functionArgs.intensity_change,
              action: functionArgs.action || 'update',
              reason: functionArgs.reason,
              user_query: functionArgs.user_query || 'Voice command',
            };
            console.log(
              '[DailyVoiceChat] AI sent flat structure, restructured into adjustment_details:',
              adjustmentDetails
            );
          }

          if (adjustmentDetails && (sessionId || functionArgs.original_date)) {
            try {
              console.log('[DailyVoiceChat] Executing workout adjustment:', {
                sessionId,
                adjustmentDetails,
              });

              // Use executeWorkoutAdjustment
              planService
                .executeWorkoutAdjustment(userId, {
                  session_id: sessionId,
                  original_date: functionArgs.original_date,
                  workout_type: functionArgs.workout_type,
                  adjustment_details: {
                    action: adjustmentDetails.action || 'update',
                    new_date: adjustmentDetails.new_date,
                    new_distance: adjustmentDetails.new_distance,
                    new_duration_minutes: adjustmentDetails.new_duration_minutes,
                    new_suggested_location: adjustmentDetails.new_suggested_location,
                    intensity_change: adjustmentDetails.intensity_change,
                    reason: adjustmentDetails.reason,
                    user_query: adjustmentDetails.user_query || 'Voice command',
                  } as any,
                })
                .then((result) => {
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
                          output: JSON.stringify({
                            status: 'success',
                            message: 'Workout adjustment saved successfully',
                          }),
                        },
                      };
                      console.log(
                        '[DailyVoiceChat] Sending direct function output result:',
                        JSON.stringify(functionOutputEvent)
                      );
                      dataChannelRef.current.send(JSON.stringify(functionOutputEvent));

                      // Set flag to refresh after chat ends
                      if (refreshHomeScreen) {
                        setNeedsRefresh(true);
                        console.log(
                          '[DailyVoiceChat] Training plan updated. Will refresh after chat ends.'
                        );
                      }

                      // Let AI handle natural conversation flow after function execution
                      setTimeout(() => {
                        if (
                          dataChannelRef.current?.readyState === 'open' &&
                          !isCoachSpeakingTTS &&
                          !isReceivingCoachMessage
                        ) {
                          console.log(
                            '[DailyVoiceChat] Requesting new response after function output'
                          );
                          dataChannelRef.current.send(
                            JSON.stringify({
                              type: 'response.create',
                            })
                          );
                          setIsReceivingCoachMessage(true);
                        } else {
                          console.log(
                            '[DailyVoiceChat] Skipping post-function response - DataChannel state:',
                            dataChannelRef.current?.readyState,
                            'isCoachSpeakingTTS:',
                            isCoachSpeakingTTS,
                            'isReceivingCoachMessage:',
                            isReceivingCoachMessage
                          );
                        }
                      }, 50);
                    } catch (e) {
                      console.error('[DailyVoiceChat] Error sending function result:', e);
                    }
                  }

                  // Clear timeout and finish function call
                  finishFunctionCall(callId);
                })
                .catch((e) => {
                  console.error('[DailyVoiceChat] Error executing workout adjustment:', e);
                  finishFunctionCall(callId);
                });
            } catch (e) {
              console.error('[DailyVoiceChat] Error executing workout adjustment:', e);
              finishFunctionCall(callId);
            }
          } else {
            console.error('[DailyVoiceChat] Missing adjustment_details in function args');
            finishFunctionCall(callId);
          }
        }
        // Handle feedback collection
        else if (functionName === 'add_user_training_feedback') {
          // Similar handling for feedback
          try {
            console.log('📝 [DailyVoiceChat] AI CALLING add_user_training_feedback');
            console.log('📝 [DailyVoiceChat] FUNCTION CALL DETAILS:', {
              callId,
              functionName,
              userId
            });
            console.log('📝 [DailyVoiceChat] RAW FUNCTION ARGUMENTS:');
            console.log('=====================================');
            console.log(JSON.stringify(functionArgs, null, 2));
            console.log('=====================================');

            const feedbackData = {
              week_start_date: functionArgs.week_start_date || null,
              prefers: functionArgs.prefers || {},
              struggling_with: functionArgs.struggling_with || {},
              feedback_summary: functionArgs.feedback_summary,
              raw_data: functionArgs.raw_data || {},
            };

            console.log('📝 [DailyVoiceChat] FORMATTED FEEDBACK DATA:');
            console.log('=====================================');
            console.log(JSON.stringify(feedbackData, null, 2));
            console.log('=====================================');

            console.log('📝 [DailyVoiceChat] CALLING addOrUpdateUserTrainingFeedback...');
            // Use the feedback service
            feedbackService
              .addOrUpdateUserTrainingFeedback(userId, feedbackData)
              .then((result) => {
                console.log('📝 [DailyVoiceChat] FEEDBACK SERVICE RESULT:', {
                  hasError: !!result.error,
                  hasData: !!result.data,
                  errorMessage: result.error?.message || null,
                  resultDataId: result.data?.id || null,
                  resultWeekStart: result.data?.week_start_date || null,
                  success: result.data ? true : false
                });

                const functionResultPayload = {
                  status: result.error ? 'error' : 'success',
                  message: result.error ? `Error: ${result.error.message}` : 'Training feedback saved successfully',
                  data: result.data || null
                };

                console.log('📝 [DailyVoiceChat] FUNCTION RESULT PAYLOAD:');
                console.log('=====================================');
                console.log(JSON.stringify(functionResultPayload, null, 2));
                console.log('=====================================');

                // Send result back to conversation
                if (dataChannelRef.current?.readyState === 'open') {
                  try {
                    // Based on OpenAI community forums, directly send the function output first
                    const functionOutputEvent = {
                      type: 'conversation.item.create',
                      item: {
                        type: 'function_call_output',
                        call_id: callId,
                        output: JSON.stringify(functionResultPayload),
                      },
                    };
                    console.log('📝 [DailyVoiceChat] SENDING FUNCTION OUTPUT TO OPENAI:');
                    console.log('=====================================');
                    console.log(JSON.stringify(functionOutputEvent, null, 2));
                    console.log('=====================================');
                    dataChannelRef.current.send(JSON.stringify(functionOutputEvent));

                    // Set flag to refresh after chat ends
                    if (refreshHomeScreen) {
                      setNeedsRefresh(true);
                      console.log(
                        '📝 [DailyVoiceChat] Training plan updated. Will refresh after chat ends.'
                      );
                    }

                    // Let AI handle natural conversation flow after function execution
                    setTimeout(() => {
                      if (
                        dataChannelRef.current?.readyState === 'open' &&
                        !isCoachSpeakingTTS &&
                        !isReceivingCoachMessage
                      ) {
                        console.log(
                          '📝 [DailyVoiceChat] Requesting new response after function output'
                        );
                        dataChannelRef.current.send(
                          JSON.stringify({
                            type: 'response.create',
                          })
                        );
                        setIsReceivingCoachMessage(true);
                      } else {
                        console.log(
                          '📝 [DailyVoiceChat] Skipping post-function response - DataChannel state:',
                          dataChannelRef.current?.readyState,
                          'isCoachSpeakingTTS:',
                          isCoachSpeakingTTS,
                          'isReceivingCoachMessage:',
                          isReceivingCoachMessage
                        );
                      }
                    }, 50);
                  } catch (e) {
                    console.error('[DailyVoiceChat] Error sending function result:', e);
                  }
                }
              })
              .catch((error) => {
                console.error('📝 [DailyVoiceChat] ERROR in addOrUpdateUserTrainingFeedback:', error);
                finishFunctionCall(callId);
              });
          } catch (e) {
            console.error('[DailyVoiceChat] Error executing function call:', e);
            finishFunctionCall(callId);
          }
        }
        // Handle gear recommendations
        else if (functionName === 'get_gear_recommendations') {
          try {
            console.log('[DailyVoiceChat] Getting gear recommendations:', functionArgs);

            // Use the gear recommendations function from useMessageFormatting
            const gearResult = getGearRecommendations(
              functionArgs.category,
              functionArgs.weather_context,
              functionArgs.activity_type
            );

            console.log('[DailyVoiceChat] Gear recommendations retrieved:', gearResult);

            // Send result back to conversation
            if (dataChannelRef.current?.readyState === 'open') {
              try {
                // Send the gear recommendations as function output
                const functionOutputEvent = {
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: JSON.stringify({
                      status: 'success',
                      message: 'Gear recommendations retrieved successfully',
                      data: gearResult,
                    }),
                  },
                };
                console.log(
                  '[DailyVoiceChat] Sending gear recommendations result:',
                  JSON.stringify(functionOutputEvent)
                );
                dataChannelRef.current.send(JSON.stringify(functionOutputEvent));

                // Let AI handle natural conversation flow after function execution
                setTimeout(() => {
                  if (
                    dataChannelRef.current?.readyState === 'open' &&
                    !isCoachSpeakingTTS &&
                    !isReceivingCoachMessage
                  ) {
                    console.log(
                      '[DailyVoiceChat] Requesting new response after gear recommendations'
                    );
                    dataChannelRef.current.send(
                      JSON.stringify({
                        type: 'response.create',
                      })
                    );
                    setIsReceivingCoachMessage(true);
                  } else {
                    console.log(
                      '[DailyVoiceChat] Skipping post-function response - DataChannel state:',
                      dataChannelRef.current?.readyState,
                      'isCoachSpeakingTTS:',
                      isCoachSpeakingTTS,
                      'isReceivingCoachMessage:',
                      isReceivingCoachMessage
                    );
                  }
                }, 50);
              } catch (e) {
                console.error('[DailyVoiceChat] Error sending gear recommendations result:', e);
              }
            }

            finishFunctionCall(callId);
          } catch (e) {
            console.error('[DailyVoiceChat] Error getting gear recommendations:', e);
            finishFunctionCall(callId);
          }
        } else {
          console.error(`[DailyVoiceChat] Unknown function name: ${functionName}`);
          finishFunctionCall(callId);
        }
      } catch (e) {
        console.error('[DailyVoiceChat] Error executing function call:', e);
        finishFunctionCall(callId);
      }

      // Turn off the tool execution indicator after a delay
      setTimeout(() => {
        setIsExecutingTool(false);
      }, 2000);
    },
    [userId, refreshHomeScreen]
  );

  const [isInputBlocked, setIsInputBlocked] = useState(false);
  const isInputBlockedRef = useRef(false);
  const inputBlockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (inputBlockTimeoutRef.current) clearTimeout(inputBlockTimeoutRef.current);
    };
  }, []);

  // Add mic mute timer ref
  const micMuteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (micMuteTimeoutRef.current) clearTimeout(micMuteTimeoutRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => track.enabled = true);
      }
    };
  }, []);

  if (!isVisible) return null;

  const renderContent = () => {
    return (
      <View className="flex-1 flex-col">
        {/* Error State */}
        {error ? (
          <View className="flex-1 items-center justify-center py-4">
            <Text className="mb-3 text-center text-red-500">{error}</Text>
            <View className="flex-row">
              <TouchableOpacity
                className="mr-2 rounded-lg bg-purple-500 px-4 py-2"
                onPress={fallbackMode ? handleSwitchToTextChat : onClose}>
                <Text className="font-semibold text-white">
                  {fallbackMode ? 'Switch to Text Chat' : 'Close'}
                </Text>
              </TouchableOpacity>

              {!fallbackMode && (
                <TouchableOpacity
                  className="rounded-lg bg-green-500 px-4 py-2"
                  onPress={() => {
                    // Reset retry counter and attempt reconnection
                    retryCountRef.current = 0;
                    setIsInitializedThisSession(false); // Force complete re-initialization
                    reconnect();
                  }}>
                  <Text className="font-semibold text-white">Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : isLoading || isConnecting ? (
          /* Loading State */
          <View className="flex-1 items-center justify-center py-8">
            <MinimalSpinner size={48} color="#8B5CF6" thickness={3} />
            <Text className="mt-4 text-center text-gray-600">
              {isConnecting ? 'Connecting to coach...' : 'Setting up voice chat...'}
            </Text>

            {/* Cancel button during loading */}
            <TouchableOpacity className="mt-4 rounded-lg bg-gray-300 px-4 py-2" onPress={onClose}>
              <Text className="font-semibold text-gray-800">Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : fallbackMode ? (
          /* Fallback Mode */
          <View className="flex-1 items-center justify-center py-8">
            <FontAwesome name="comment-o" size={40} color="#8B5CF6" />
            <Text className="mb-4 mt-4 text-center text-gray-800">
              Voice chat is currently unavailable.{'\n'}Would you like to switch to text chat
              instead?
            </Text>
            <View className="flex-row">
              <TouchableOpacity
                className="mr-2 rounded-lg bg-purple-500 px-4 py-2"
                onPress={handleSwitchToTextChat}>
                <Text className="font-semibold text-white">Switch to Text Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity className="rounded-lg bg-gray-300 px-4 py-2" onPress={onClose}>
                <Text className="font-semibold text-gray-800">Cancel</Text>
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
    <View className="flex-1 items-center justify-center px-4">
      {showAnimatedCoachView && (
        <View className="mb-4 flex-1 items-center justify-center">
          <View style={styles.animatedCoachContainer}>
            <View
              style={[
                styles.coachImageWrapper,
                styles.coachImageWrapperActive, // Always use active style during conversation
              ]}>
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

          <Text style={styles.coachNameText}>{coachName}</Text>
        </View>
      )}

      {/* Tool Execution Indicator */}
      {isExecutingTool && (
        <View style={styles.toolExecutionIndicator}>
          <MinimalSpinner size={20} color="#8B5CF6" thickness={2} />
          <Text style={styles.toolExecutionText}>Processing request...</Text>
        </View>
      )}

      {/* End Chat Button - positioned at bottom */}
      <View className="items-center pb-4">
        <TouchableOpacity className="rounded-lg bg-purple-500 px-6 py-3" onPress={handleEndSession}>
          <Text className="font-semibold text-white">End Chat</Text>
        </TouchableOpacity>
      </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  coachImageWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
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
    borderWidth: 3,
    borderColor: '#8B5CF6',
    ...Platform.select({
      ios: {
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 15,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  coachImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  animatedBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  glowOverlay: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 70,
    backgroundColor: 'transparent',
    borderWidth: 3,
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
    marginTop: 12,
    fontSize: 16,
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
