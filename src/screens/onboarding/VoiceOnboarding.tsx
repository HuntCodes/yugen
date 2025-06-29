import { FontAwesome } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Video, ResizeMode } from 'expo-av';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import * as Animatable from 'react-native-animatable';

import { CompletionOverlay } from './components/CompletionOverlay';
import VoiceChat from '../../components/chat/VoiceChat';
import { LoadingOverlay } from '../../components/ui/LoadingOverlay';
import { coachStyles } from '../../config/coachingGuidelines';
import { environment } from '../../config/environment';
import { useOnboardingConversation } from '../../hooks/useOnboardingConversation';
import { useVoiceChat } from '../../hooks/useVoiceChat';
import { COACHES } from '../../lib/constants/coaches';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { debugEnvironment } from '../../debug-env.js';
import { useAuth } from '../../hooks/useAuth';

// Glow animation definition (copied from DailyVoiceChat)
const glowAnimation = {
  0: { opacity: 0.3, borderWidth: 2 },
  0.5: { opacity: 1, borderWidth: 5 },
  1: { opacity: 0.3, borderWidth: 2 },
};

// Avatar videos by coach
const COACH_AVATAR_VIDEOS = {
  craig: {
    listening: require('../../../assets/avatars/Craig_Listening_Loop_Final.mp4'),
    talking: require('../../../assets/avatars/Craig_Talking_Loop_Final.mp4'),
    waving: require('../../../assets/avatars/Craig_Wave_Loop_Final.mp4'),
  },
  dathan: {
    listening: require('../../../assets/avatars/Dathan_Listening_Loop_Final.mp4'),
    talking: require('../../../assets/avatars/Dathan_Talking_Loop_Final.mp4'),
    waving: require('../../../assets/avatars/Dathan_Wave_Loop_Final.mp4'),
  },
};

// Default to Dathan for backwards compatibility
const DEFAULT_AVATAR_VIDEOS = COACH_AVATAR_VIDEOS.dathan;

// Image mapping for coaches
const imageMap: Record<string, any> = {
  craig: require('../../assets/Craig_Avatar.png'),
  thomas: require('../../assets/thomas.jpg'),
  dathan: require('../../assets/Dathan_Avatar.png'),
};

type VoiceOnboardingNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'VoiceOnboarding'
>;
type VoiceOnboardingRouteProp = RouteProp<RootStackParamList, 'VoiceOnboarding'>;

export function VoiceOnboarding() {
  const [voiceChatUIVisible, setVoiceChatUIVisible] = useState(false);
  const [voiceChatError, setVoiceChatError] = useState<string | null>(null);
  const [showTextChat, setShowTextChat] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isCoachSpeaking, setIsCoachSpeaking] = useState(false);
  const [voiceChatManuallyClosed, setVoiceChatManuallyClosed] = useState(false);
  const [voiceConversationActuallyCompleted, setVoiceConversationActuallyCompleted] =
    useState(false);
  const [showCompletionOverlay, setShowCompletionOverlay] = useState(false);
  const [finalVoiceHistory, setFinalVoiceHistory] = useState<
    { role: 'user' | 'coach'; content: string }[]
  >([]);
  const [isContinueClicked, setIsContinueClicked] = useState(false); // Track continue button click for immediate feedback

  // Avatar video state - START WITH WAVING for initial greeting
  const [currentAvatarState, setCurrentAvatarState] = useState<'listening' | 'talking' | 'waving'>('waving');
  const [previousAvatarState, setPreviousAvatarState] = useState<'listening' | 'talking' | 'waving'>('listening');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [shouldShowWavingOnLoad, setShouldShowWavingOnLoad] = useState(true); // New flag to control initial waving
  const [wavingVideoLoaded, setWavingVideoLoaded] = useState(false); // Track if waving video is loaded for fade-in
  const [showAnimatedCoachView, setShowAnimatedCoachView] = useState(false);

  // Granular speaking state management (like DailyVoiceChat)
  const [isCoachSpeakingTTS, setIsCoachSpeakingTTS] = useState(false);
  const [isReceivingCoachMessage, setIsReceivingCoachMessage] = useState(false);

  const route = useRoute<VoiceOnboardingRouteProp>();
  const navigation = useNavigation<VoiceOnboardingNavigationProp>();
  const { session } = useAuth();
  const appState = useRef(AppState.currentState);

  // Multiple video refs for seamless transitions
  const listeningVideoRef = useRef<any>(null);
  const talkingVideoRef = useRef<any>(null);
  const wavingVideoRef = useRef<any>(null);

  const initialCoachId = route.params?.coachId || 'dathan';
  const [currentCoachId, setCurrentCoachId] = useState(initialCoachId);

  // Corrected coach object creation
  const coachDataFromStyles = coachStyles[currentCoachId];
  const coachDataFromConstants = COACHES.find((c) => c.id === currentCoachId);

  const coachName = coachDataFromStyles?.name || coachDataFromConstants?.name || 'Coach';
  // Ensure avatar is always sourced from imageMap for require() compatibility
  const coachAvatar = imageMap[currentCoachId] || imageMap['dathan'];

  const coach = {
    id: currentCoachId,
    name: coachName,
    avatar: coachAvatar, // This is now consistently from imageMap
  };

  // Available videos helper - select based on coach or use provided videos
  const getAvailableVideos = () => {
    // Get coach-specific videos based on coachId
    const normalizedCoachId = currentCoachId.toLowerCase();
    if (COACH_AVATAR_VIDEOS[normalizedCoachId as keyof typeof COACH_AVATAR_VIDEOS]) {
      return COACH_AVATAR_VIDEOS[normalizedCoachId as keyof typeof COACH_AVATAR_VIDEOS];
    }
    
    // Fallback to default (Dathan)
    return DEFAULT_AVATAR_VIDEOS;
  };
  
  const availableVideos = getAvailableVideos();

  // Determine team region label for welcome header
  const teamRegionLabel =
    currentCoachId === 'craig'
      ? 'OAC Oceania'
      : currentCoachId === 'thomas'
      ? 'OAC Europe'
      : 'OAC Global';

  const { isVoiceChatAvailable, checkVoiceChatAvailability } = useVoiceChat();

  const {
    isProcessing,
    isComplete: isHookProcessingComplete,
    processingStep,
    processingMessage,
    isRestoringState,
    completeConversation,
    processFinalTranscriptForToolCall,
  } = useOnboardingConversation(currentCoachId, false);

  useEffect(() => {
    console.log('[VOICE_ONBOARDING] Voice chat active:', voiceChatUIVisible);
  }, [voiceChatUIVisible]);

  // --- EFFECT: Show/hide animated coach view based on state ---
  useEffect(() => {
    // Always show the coach when the component is visible and voice chat is active
    const shouldShowCoach = voiceChatUIVisible;

    console.log(
      '[VoiceOnboarding] Setting coach visibility to:',
      shouldShowCoach,
      'voiceChatUIVisible:',
      voiceChatUIVisible
    );

    setShowAnimatedCoachView(shouldShowCoach);
  }, [voiceChatUIVisible]);

  // --- EFFECT: Manage avatar video state based on conversation state ---
  useEffect(() => {
    if (!availableVideos) return;

    let newState: 'listening' | 'talking' | 'waving' = 'listening';

    // PRIORITY 1: Initial waving greeting (only when component first becomes visible)
    if (shouldShowWavingOnLoad && voiceChatUIVisible) {
      newState = 'waving';
      console.log('[VoiceOnboarding] Setting avatar to waving for initial greeting');
    }
    // PRIORITY 2: Coach is speaking/responding - show talking video (using granular states like DailyVoiceChat)
    else if (isCoachSpeakingTTS || isReceivingCoachMessage) {
      newState = 'talking';
      console.log('[VoiceOnboarding] Setting avatar to talking (coach speaking - TTS:', isCoachSpeakingTTS, 'Receiving:', isReceivingCoachMessage, ')');
    }
    // PRIORITY 3: Default to listening state when waiting
    else {
      newState = 'listening';
      console.log('[VoiceOnboarding] Setting avatar to listening (default/waiting)');
    }

    // Only update if state actually changed to prevent unnecessary re-renders
    if (currentAvatarState !== newState) {
      console.log('[VoiceOnboarding] Avatar state changing from', currentAvatarState, 'to', newState);
      setPreviousAvatarState(currentAvatarState);
      setCurrentAvatarState(newState);
    }
  }, [
    availableVideos,
    shouldShowWavingOnLoad,
    voiceChatUIVisible,
    isCoachSpeakingTTS,
    isReceivingCoachMessage,
    currentAvatarState
  ]);

  const handleSpeakingStateChange = useCallback(
    (speaking: boolean, speaker?: 'user' | 'coach') => {
      console.log(
        '[VOICE_ONBOARDING] Speaking state changed to:',
        speaking,
        'Speaker:',
        speaker || 'unknown'
      );

      // Set granular speaking states like DailyVoiceChat
      if (speaker === 'coach') {
        setIsCoachSpeakingTTS(speaking);
        setIsReceivingCoachMessage(speaking);
        console.log('[VOICE_ONBOARDING] Coach TTS speaking state:', speaking);
      }

      // Keep the original simple state for backward compatibility
      setIsCoachSpeaking(speaking && speaker === 'coach');

      // If conversation is complete and coach just finished speaking, show completion overlay immediately
      if (voiceConversationActuallyCompleted && !speaking && speaker === 'coach') {
        console.log(
          '[VOICE_ONBOARDING] Coach finished speaking after conversation completion. Showing overlay immediately...'
        );
        setVoiceChatUIVisible(false); // Hide the VoiceChat UI
        setShowCompletionOverlay(true); // Show completion overlay immediately
      }
    },
    [voiceConversationActuallyCompleted]
  );

  useEffect(() => {
    const setup = async () => {
      debugEnvironment();
      await checkVoiceChatAvailability();
      setInitialLoadComplete(true);
    };
    setup();
  }, [checkVoiceChatAvailability]);

  useEffect(() => {
    if (
      initialLoadComplete &&
      isVoiceChatAvailable &&
      !voiceChatUIVisible &&
      !showTextChat &&
      !isHookProcessingComplete &&
      !voiceChatManuallyClosed
    ) {
      // Auto-start logic is intentionally kept commented or removed
    }
  }, [
    initialLoadComplete,
    isVoiceChatAvailable,
    voiceChatUIVisible,
    showTextChat,
    isHookProcessingComplete,
    voiceChatManuallyClosed,
  ]);

  const handleCloseVoiceChat = useCallback(() => {
    console.log('[VOICE ONBOARDING] Voice chat closed');
    setVoiceChatUIVisible(false);
    setIsReconnecting(false);
    setVoiceChatManuallyClosed(true);
    setIsCoachSpeaking(false);
    setShowCompletionOverlay(false);
    
    // Reset granular speaking states
    setIsCoachSpeakingTTS(false);
    setIsReceivingCoachMessage(false);
    setShouldShowWavingOnLoad(true); // Reset for next session
    setWavingVideoLoaded(false); // Reset fade-in state for next session
  }, []);

  const handleVoiceChatError = useCallback(
    (error: string) => {
      console.log('[VOICE ONBOARDING] Voice chat error:', error);
      setVoiceChatError(error);
      if (
        error.includes('Connection failed') &&
        reconnectAttempts < 2 &&
        !isHookProcessingComplete
      ) {
        console.log(`[VOICE ONBOARDING] Attempting reconnect (${reconnectAttempts + 1}/3)...`);
        setIsReconnecting(true);
        setVoiceChatUIVisible(false);
        setTimeout(() => {
          if (!isHookProcessingComplete) {
            setVoiceChatUIVisible(true);
            setReconnectAttempts((prev) => prev + 1);
          }
        }, 2000);
      } else {
        if (!showTextChat && !isHookProcessingComplete) {
          console.log(
            '[VOICE ONBOARDING] Too many reconnect attempts or non-connection error. Suggesting text chat.'
          );
          setVoiceChatUIVisible(false);
          setIsReconnecting(false);
        }
      }
    },
    [reconnectAttempts, showTextChat, isHookProcessingComplete]
  );

  const handleVoiceTranscriptComplete = useCallback(
    async (
      _userTranscript: string, // Mark as unused if not needed directly here
      _coachResponse: string, // Mark as unused
      isVoiceChatDone: boolean,
      fullVoiceChatHistory: { role: 'user' | 'coach'; content: string }[]
    ) => {
      console.log('[VOICE_ONBOARDING] Transcript received from VoiceChat:', { isVoiceChatDone });

      if (isVoiceChatDone) {
        console.log(
          '[VOICE_ONBOARDING] Voice chat is DONE. Full History:',
          JSON.stringify(fullVoiceChatHistory, null, 2)
        );
        setFinalVoiceHistory(fullVoiceChatHistory);
        setVoiceConversationActuallyCompleted(true);

        // Check if coach is still speaking
        if (isCoachSpeaking) {
          console.log(
            '[VOICE_ONBOARDING] Coach is still speaking. Will show overlay when they finish...'
          );
          // The overlay will be shown when handleSpeakingStateChange detects coach stops speaking
        } else {
          console.log('[VOICE_ONBOARDING] Coach is not speaking. Showing overlay immediately...');
          // Coach is already done speaking, show overlay immediately
          setVoiceChatUIVisible(false);
          setShowCompletionOverlay(true);
        }
      } else {
        // This is an intermediate transcript update from VoiceChat.tsx (e.g., after each AI turn that's not the *final* one)
        // VoiceChat.tsx is still active and managing its UI and TTS.
        // We should not hide it here.
        console.log(
          '[VOICE_ONBOARDING] Intermediate transcript segment received. VoiceChat UI remains visible.'
        );
        // We could update a running history here if needed, but VoiceChat.tsx passes the full history when done.
      }
    },
    [isCoachSpeaking]
  ); // Updated dependencies

  const handleSwitchToTextChat = () => {
    setShowTextChat(true);
    setVoiceChatUIVisible(false);
    setIsReconnecting(false);
    setIsCoachSpeaking(false);
    
    // Reset granular speaking states
    setIsCoachSpeakingTTS(false);
    setIsReceivingCoachMessage(false);
    
    // Navigation to 'Onboarding' (which is OnboardingChat) is fine as it's in RootStackParamList
    navigation.navigate('Onboarding', { coachId: currentCoachId });
  };

  const handleStartVoiceChat = () => {
    setVoiceChatUIVisible(true);
    setVoiceChatManuallyClosed(false);
    setReconnectAttempts(0);
    setShowCompletionOverlay(false); // Reset overlay state
    setVoiceConversationActuallyCompleted(false); // Reset completion state
  };

  const getProgressValue = () => {
    switch (processingStep) {
      case 'extracting':
        return 0.1;
      case 'saving':
        return 0.2;
      case 'generating_plan':
        return 0.5;
      case 'complete':
        return 1;
      default:
        return 0;
    }
  };

  const handleContinueAfterVoice = async () => {
    console.log('[VOICE_ONBOARDING] Continue button clicked. Processing voice conversation...');

    // Set immediate feedback state
    setIsContinueClicked(true);

    if (isProcessing) {
      console.log('[VOICE_ONBOARDING] Already processing, skipping new request.');
      setIsContinueClicked(false); // Reset if already processing
      return;
    }

    try {
      if (finalVoiceHistory && finalVoiceHistory.length > 0) {
        // Step 1: Let the hook process the final transcript for a potential tool call.
        // This will set internal state in the hook (isComplete, extractedProfileFromTool) AND return args.
        const toolArgs = await processFinalTranscriptForToolCall(finalVoiceHistory);

        // Step 2: Call completeConversation. Pass the returned toolArgs directly.
        // It will use the tool-extracted data if available (from toolArgs),
        // or fall back to the old transcript processing otherwise.
        await completeConversation(finalVoiceHistory, toolArgs);
      } else {
        console.warn(
          '[VOICE_ONBOARDING] Attempted to continue without voice history. Calling completeConversation with default hook history.'
        );
        await completeConversation(); // Pass no history and no direct args
      }
    } catch (error) {
      console.error('[VOICE_ONBOARDING] Error in handleContinueAfterVoice:', error);
      // Reset continue clicked state on error
      setIsContinueClicked(false);
    }
  };

  useEffect(() => {
    if (route.params?.coachId && route.params.coachId !== currentCoachId) {
      console.log(
        `[VOICE_ONBOARDING] coachId in route params (${route.params.coachId}) differs from current state (${currentCoachId}). Updating.`
      );
      setCurrentCoachId(route.params.coachId);
    }
  }, [route.params?.coachId, currentCoachId]); // Added currentCoachId to dep array

  // API Key Check
  const apiKey = environment.openAIApiKey;
  useEffect(() => {
    if (!apiKey) {
      console.error(
        'CRITICAL: OpenAI API Key (EXPO_PUBLIC_OPENAI_API_KEY from environment) is not configured. Voice chat will not function.'
      );
      // Potentially set an error state here to inform the user on the UI
    }
  }, [apiKey]);

  // Automatic navigation on full completion
  useEffect(() => {
    if (isHookProcessingComplete && processingStep === 'complete') {
      console.log(
        '[VOICE_ONBOARDING] Full onboarding process complete. Cleaning up voice chat before navigation...'
      );
      
      // CRITICAL FIX: Force cleanup of VoiceChat before navigation
      if (voiceChatUIVisible) {
        console.log('[VOICE_ONBOARDING] Hiding VoiceChat before navigation to ensure proper cleanup');
        setVoiceChatUIVisible(false);
        
        // Allow cleanup to complete before navigation
        setTimeout(() => {
          console.log('[VOICE_ONBOARDING] VoiceChat cleanup complete. Navigating to MainApp/HomeScreen...');
          // Hide the completion overlay before navigation
          setShowCompletionOverlay(false);
          // Reset stack to MainApp, initial screen HomeScreen if TabNavigator is configured for that
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainApp', params: { screen: 'HomeScreen' } }],
          });
        }, 500); // Brief delay to ensure VoiceChat cleanup completes
      } else {
        // No voice chat active, navigate immediately
        console.log('[VOICE_ONBOARDING] No active VoiceChat. Navigating to MainApp/HomeScreen...');
        // Hide the completion overlay before navigation
        setShowCompletionOverlay(false);
        // Reset stack to MainApp, initial screen HomeScreen if TabNavigator is configured for that
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainApp', params: { screen: 'HomeScreen' } }],
        });
      }
    }
  }, [isHookProcessingComplete, processingStep, navigation, voiceChatUIVisible]);

  // AppState listener to reload screen when app comes back from background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('[VoiceOnboarding] AppState changed from', appState.current, 'to', nextAppState);

      if (nextAppState === 'active' && appState.current !== 'active') {
        console.log(
          '[VoiceOnboarding] App came back from background - resetting voice chat state and reloading'
        );

        // Reset all voice chat state to handle expired sessions
        setVoiceChatUIVisible(false);
        setVoiceChatError(null);
        setIsReconnecting(false);
        setVoiceChatManuallyClosed(false);
        setIsCoachSpeaking(false);
        setVoiceConversationActuallyCompleted(false);
        setShowCompletionOverlay(false);
        setReconnectAttempts(0);
        
        // Reset granular speaking states
        setIsCoachSpeakingTTS(false);
        setIsReceivingCoachMessage(false);
        setShouldShowWavingOnLoad(true);
        setWavingVideoLoaded(false);

        // Reload the screen
        navigation.reset({
          index: 0,
          routes: [{ name: 'VoiceOnboarding', params: { coachId: currentCoachId } }],
        });
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    console.log('[VoiceOnboarding] AppState listener added, current state:', AppState.currentState);

    return () => {
      console.log('[VoiceOnboarding] AppState listener removed');
      subscription?.remove();
    };
  }, [navigation, currentCoachId]);

  // Reset continue clicked state when processing actually starts or overlay is hidden
  useEffect(() => {
    if (isProcessing || !showCompletionOverlay) {
      setIsContinueClicked(false);
    }
  }, [isProcessing, showCompletionOverlay]);

  if (!coach || !coach.avatar) {
    // Added check for coach.avatar just in case imageMap lookup fails
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>
          Coach data or avatar not found for ID: {currentCoachId}.
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('CoachSelect')} style={styles.button}>
          <Text style={styles.buttonText}>Select Coach</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.welcomeContainer}>
        <Text style={styles.welcomeHeader}>{`Welcome to ${teamRegionLabel}`}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          {voiceChatUIVisible && showAnimatedCoachView ? (
            // Avatar videos during voice chat
            <View style={styles.animatedCoachContainer}>
              <View style={styles.coachWrapper}>
                {availableVideos ? (
                  <View style={styles.videoContainer}>
                    {/* Listening Video */}
                    <Video
                      ref={listeningVideoRef}
                      style={[
                        styles.coachVideo,
                        { opacity: currentAvatarState === 'listening' ? 1 : 0 }
                      ]}
                      source={availableVideos.listening}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={currentAvatarState === 'listening'}
                      isLooping={true}
                      isMuted={true}
                      useNativeControls={false}
                      onLoad={() => {
                        console.log('[VoiceOnboarding] Listening video loaded and ready');
                      }}
                    />
                    
                    {/* Talking Video */}
                    <Video
                      ref={talkingVideoRef}
                      style={[
                        styles.coachVideo,
                        styles.overlayVideo,
                        { opacity: currentAvatarState === 'talking' ? 1 : 0 }
                      ]}
                      source={availableVideos.talking}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={currentAvatarState === 'talking'}
                      isLooping={true}
                      isMuted={true}
                      useNativeControls={false}
                    />
                    
                    {/* Waving Video */}
                    <Animatable.View
                      animation={currentAvatarState === 'waving' ? 'fadeIn' : undefined}
                      duration={800}
                      style={[
                        styles.coachVideo,
                        styles.overlayVideo,
                        { 
                          opacity: currentAvatarState === 'waving' ? 1 : 0
                        }
                      ]}
                    >
                      <Video
                        ref={wavingVideoRef}
                        style={styles.coachVideo}
                        source={availableVideos.waving}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={currentAvatarState === 'waving'}
                        isLooping={false}
                        isMuted={true}
                        useNativeControls={false}
                        onLoad={() => {
                          console.log('[VoiceOnboarding] Waving video loaded and ready');
                          setWavingVideoLoaded(true);
                        }}
                        onPlaybackStatusUpdate={(status) => {
                          // Log key status changes for debugging
                          if (status.isLoaded && !status.isPlaying && status.didJustFinish && currentAvatarState === 'waving') {
                            console.log('[VoiceOnboarding] Waving video completed, transitioning to listening');
                            
                            // Disable the waving flag so it won't play again
                            setShouldShowWavingOnLoad(false);
                            
                            // The avatar state effect will handle the transition to listening
                            // due to shouldShowWavingOnLoad becoming false
                          }
                        }}
                      />
                    </Animatable.View>
                  </View>
                ) : (
                  <Image
                    source={coach.avatar}
                    style={styles.coachImage}
                    resizeMode="cover"
                  />
                )}
              </View>
            </View>
          ) : (
            // Static coach image when not in voice chat
            <Image source={coach.avatar} style={styles.coachImage} />
          )}
          <Text style={styles.coachName}>AI Coach {coach.name.split(' ')[0]}</Text>
        </View>

        {/* Always render VoiceChat to allow proper cleanup via isVisible prop */}
        {apiKey && (
          <View style={styles.voiceChatContainer}>
            <VoiceChat
              isVisible={voiceChatUIVisible}
              onClose={handleCloseVoiceChat}
              coachId={currentCoachId}
              apiKey={apiKey}
              onError={handleVoiceChatError}
              onboardingMode
              onTranscriptComplete={handleVoiceTranscriptComplete}
              onSpeakingStateChange={handleSpeakingStateChange}
              useModal={false}
            />

            {/* Only show End Chat Button when voice chat is visible */}
            {voiceChatUIVisible && (
              <TouchableOpacity style={styles.endChatButton} onPress={handleCloseVoiceChat}>
                <Text style={styles.endChatButtonText}>End Chat</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {/* Inform user if API key is missing and trying to show voice chat */}
        {voiceChatUIVisible && !apiKey && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              OpenAI API Key not configured. Voice chat cannot start.
            </Text>
          </View>
        )}

        <View style={styles.actionContainer}>
          {/* Show "Talk to coach" button when voice chat is NOT visible, hook is NOT complete, and NOT reconnecting */}
          {!voiceChatUIVisible &&
            !isHookProcessingComplete &&
            !isReconnecting &&
            !showCompletionOverlay && (
              <>
                <Animatable.View animation="pulse" iterationCount={3} duration={1000}>
                  <TouchableOpacity
                    style={[
                      styles.talkButton,
                      (!isVoiceChatAvailable || isProcessing) && styles.talkButtonDisabled,
                    ]}
                    onPress={handleStartVoiceChat}
                    disabled={!isVoiceChatAvailable || isProcessing}
                    activeOpacity={0.7}>
                    <FontAwesome name="microphone" size={24} color="#fff" style={styles.micIcon} />
                    <Text style={styles.talkButtonText}>Talk to your coach</Text>
                  </TouchableOpacity>
                </Animatable.View>
                {/* Ensure this button is shown if the parent conditional block is active */}
                <TouchableOpacity style={styles.textChatButton} onPress={handleSwitchToTextChat}>
                  <Text style={styles.textChatButtonText}>Message your coach instead</Text>
                </TouchableOpacity>
              </>
            )}

          {isReconnecting && (
            <View style={styles.reconnectingContainer}>
              <Text style={styles.reconnectingText}>Reconnecting to your coach...</Text>
            </View>
          )}

          {voiceChatError && !isReconnecting && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{voiceChatError}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Completion Overlay */}
      <CompletionOverlay
        visible={showCompletionOverlay}
        coachName={coach.name}
        coachAvatar={coach.avatar}
        onContinue={handleContinueAfterVoice}
        isProcessing={isContinueClicked || isProcessing}
      />

      <LoadingOverlay
        visible={isContinueClicked || isProcessing} // Show immediately when continue clicked or processing
        message={isContinueClicked && !isProcessing ? 'Starting...' : processingMessage}
        progress={getProgressValue()}
      />

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center', // Center vertically
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  coachImage: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  coachName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 16,
  },
  welcomeHeader: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    alignSelf: 'center',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  voiceChatContainer: {
    marginTop: 30,
    marginBottom: 20,
    width: '100%',
    paddingHorizontal: 5,
  },
  actionContainer: {
    marginBottom: 40,
    // Added to ensure it doesn't overlap other elements if content is too tall
    // alignItems: 'center', // if you want buttons centered
  },
  talkButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 30,
    minWidth: 250,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  talkButtonDisabled: {
    backgroundColor: '#BDA3FF',
    opacity: 0.7,
    borderRadius: 999,
  },
  micIcon: {
    marginRight: 10,
  },
  talkButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  textChatButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  textChatButtonText: {
    color: '#757575',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  errorContainer: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FFEBEE',
    width: '100%', // Ensure it takes full width for better visibility if error occurs in main flow
    alignItems: 'center', // Center text
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
  },
  reconnectingContainer: {
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  reconnectingText: {
    color: '#8B5CF6',
    fontSize: 16,
  },
  button: {
    // General button style, e.g., for error screen
    backgroundColor: '#7C3AED',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  animatedCoachContainer: {
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
  endChatButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    backgroundColor: '#E53935',
    borderRadius: 999,
    marginTop: 16,
  },
  endChatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  coachWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    overflow: 'hidden', // Ensure videos stay within rounded corners
  },
  videoContainer: {
    position: 'relative',
    width: 216,
    height: 288,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff', // White background for smooth fade-in
  },
  coachVideo: {
    width: 216,
    height: 288,
    borderRadius: 12,
  },
  overlayVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
