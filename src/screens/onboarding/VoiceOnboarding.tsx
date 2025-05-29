import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { COACHES } from '../../lib/constants/coaches';
import VoiceChat from '../../components/chat/VoiceChat';
import { useVoiceChat } from '../../hooks/useVoiceChat';
import { environment } from '../../config/environment';
import { useOnboardingConversation } from '../../hooks/useOnboardingConversation';
import { FontAwesome } from '@expo/vector-icons';
import { LoadingOverlay } from '../../components/ui/LoadingOverlay';
import { CompletionOverlay } from './components/CompletionOverlay';
import { debugEnvironment } from '../../debug-env.js';
import * as Animatable from 'react-native-animatable';
import { useAuth } from '../../hooks/useAuth';
import { coachStyles } from '../../config/coachingGuidelines';

// Glow animation definition (copied from DailyVoiceChat)
const glowAnimation = {
  0: { opacity: 0.3, borderWidth: 2 },
  0.5: { opacity: 1, borderWidth: 5 },
  1: { opacity: 0.3, borderWidth: 2 },
};

// Image mapping for coaches
const imageMap: Record<string, any> = {
  craig: require('../../assets/craig.jpg'),
  thomas: require('../../assets/thomas.jpg'),
  dathan: require('../../assets/dathan.jpg'),
};

type VoiceOnboardingNavigationProp = NativeStackNavigationProp<RootStackParamList, 'VoiceOnboarding'>;
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
  const [voiceConversationActuallyCompleted, setVoiceConversationActuallyCompleted] = useState(false);
  const [showCompletionOverlay, setShowCompletionOverlay] = useState(false);
  const [finalVoiceHistory, setFinalVoiceHistory] = useState<{role: 'user' | 'coach'; content: string}[]>([]);
  
  const route = useRoute<VoiceOnboardingRouteProp>();
  const navigation = useNavigation<VoiceOnboardingNavigationProp>();
  const { session } = useAuth();
  
  const initialCoachId = route.params?.coachId || 'dathan';
  const [currentCoachId, setCurrentCoachId] = useState(initialCoachId);
  
  // Corrected coach object creation
  const coachDataFromStyles = coachStyles[currentCoachId];
  const coachDataFromConstants = COACHES.find(c => c.id === currentCoachId);

  const coachName = coachDataFromStyles?.name || coachDataFromConstants?.name || 'Coach';
  // Ensure avatar is always sourced from imageMap for require() compatibility
  const coachAvatar = imageMap[currentCoachId] || imageMap['dathan']; 

  const coach = {
    id: currentCoachId,
    name: coachName,
    avatar: coachAvatar, // This is now consistently from imageMap
  };
  
  const { 
    isVoiceChatAvailable, 
    checkVoiceChatAvailability 
  } = useVoiceChat();
  
  const {
    isProcessing,
    isComplete: isHookProcessingComplete,
    processingStep,
    processingMessage,
    completeConversation,
    processFinalTranscriptForToolCall
  } = useOnboardingConversation(currentCoachId);
  
  useEffect(() => {
    console.log('[VOICE_ONBOARDING] Voice chat active:', voiceChatUIVisible);
  }, [voiceChatUIVisible]);
  
  const handleSpeakingStateChange = useCallback((speaking: boolean, speaker?: 'user' | 'coach') => {
    console.log('[VOICE_ONBOARDING] Speaking state changed to:', speaking, 'Speaker:', speaker || 'unknown');
    setIsCoachSpeaking(speaking);
    
    // If conversation is complete and coach just finished speaking, show completion overlay immediately
    if (voiceConversationActuallyCompleted && !speaking && speaker === 'coach') {
      console.log('[VOICE_ONBOARDING] Coach finished speaking after conversation completion. Showing overlay immediately...');
      setVoiceChatUIVisible(false); // Hide the VoiceChat UI
      setShowCompletionOverlay(true); // Show completion overlay immediately
    }
  }, [voiceConversationActuallyCompleted]);
  
  useEffect(() => {
    const setup = async () => {
      debugEnvironment();
      await checkVoiceChatAvailability();
      setInitialLoadComplete(true);
    };
    setup();
  }, [checkVoiceChatAvailability]);
  
  useEffect(() => {
    if (initialLoadComplete && isVoiceChatAvailable && !voiceChatUIVisible && !showTextChat && !isHookProcessingComplete && !voiceChatManuallyClosed) {
      // Auto-start logic is intentionally kept commented or removed
    }
  }, [initialLoadComplete, isVoiceChatAvailable, voiceChatUIVisible, showTextChat, isHookProcessingComplete, voiceChatManuallyClosed]);
  
  const handleCloseVoiceChat = useCallback(() => {
    console.log('[VOICE ONBOARDING] Voice chat closed');
    setVoiceChatUIVisible(false);
    setIsReconnecting(false);
    setVoiceChatManuallyClosed(true); 
    setIsCoachSpeaking(false);
    setShowCompletionOverlay(false);
  }, []);
  
  const handleVoiceChatError = useCallback((error: string) => {
    console.log('[VOICE ONBOARDING] Voice chat error:', error);
    setVoiceChatError(error);
    if (error.includes('Connection failed') && reconnectAttempts < 2 && !isHookProcessingComplete) {
      console.log(`[VOICE ONBOARDING] Attempting reconnect (${reconnectAttempts + 1}/3)...`);
      setIsReconnecting(true);
      setVoiceChatUIVisible(false);
      setTimeout(() => {
        if (!isHookProcessingComplete) {
          setVoiceChatUIVisible(true);
          setReconnectAttempts(prev => prev + 1);
        }
      }, 2000);
    } else {
      if (!showTextChat && !isHookProcessingComplete) {
        console.log('[VOICE ONBOARDING] Too many reconnect attempts or non-connection error. Suggesting text chat.');
        setVoiceChatUIVisible(false);
        setIsReconnecting(false);
      }
    }
  }, [reconnectAttempts, showTextChat, isHookProcessingComplete]);
  
  const handleVoiceTranscriptComplete = useCallback(async (
    _userTranscript: string, // Mark as unused if not needed directly here
    _coachResponse: string, // Mark as unused
    isVoiceChatDone: boolean,
    fullVoiceChatHistory: {role: 'user' | 'coach'; content: string}[]
  ) => {
    console.log('[VOICE_ONBOARDING] Transcript received from VoiceChat:', { isVoiceChatDone });
    
    if (isVoiceChatDone) {
      console.log('[VOICE_ONBOARDING] Voice chat is DONE. Full History:', JSON.stringify(fullVoiceChatHistory, null, 2));
      setFinalVoiceHistory(fullVoiceChatHistory);
      setVoiceConversationActuallyCompleted(true);
      
      // Check if coach is still speaking
      if (isCoachSpeaking) {
        console.log('[VOICE_ONBOARDING] Coach is still speaking. Will show overlay when they finish...');
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
      console.log('[VOICE_ONBOARDING] Intermediate transcript segment received. VoiceChat UI remains visible.');
      // We could update a running history here if needed, but VoiceChat.tsx passes the full history when done.
    }
  }, [isCoachSpeaking]); // Updated dependencies
  
  const handleSwitchToTextChat = () => {
    setShowTextChat(true);
    setVoiceChatUIVisible(false);
    setIsReconnecting(false);
    setIsCoachSpeaking(false);
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
      case 'extracting': return 0.1;
      case 'saving': return 0.2;
      case 'generating_plan': return 0.5;
      case 'complete': return 1;
      default: return 0;
    }
  };
  
  const handleContinueAfterVoice = async () => {
    console.log('[VOICE_ONBOARDING] Continue button clicked. Processing voice conversation...');
    
    if (isProcessing) {
      console.log('[VOICE_ONBOARDING] Already processing, skipping new request.');
      return;
    }

    if (finalVoiceHistory && finalVoiceHistory.length > 0) {
      // Step 1: Let the hook process the final transcript for a potential tool call.
      // This will set internal state in the hook (isComplete, extractedProfileFromTool) AND return args.
      const toolArgs = await processFinalTranscriptForToolCall(finalVoiceHistory);
      
      // Step 2: Call completeConversation. Pass the returned toolArgs directly.
      // It will use the tool-extracted data if available (from toolArgs),
      // or fall back to the old transcript processing otherwise.
      await completeConversation(finalVoiceHistory, toolArgs);
    } else {
      console.warn('[VOICE_ONBOARDING] Attempted to continue without voice history. Calling completeConversation with default hook history.');
      await completeConversation(); // Pass no history and no direct args
    }
  };
  
  useEffect(() => {
    if (route.params?.coachId && route.params.coachId !== currentCoachId) {
      console.log(`[VOICE_ONBOARDING] coachId in route params (${route.params.coachId}) differs from current state (${currentCoachId}). Updating.`);
      setCurrentCoachId(route.params.coachId);
    }
  }, [route.params?.coachId, currentCoachId]); // Added currentCoachId to dep array
  
  // API Key Check
  const apiKey = environment.openAIApiKey;
  useEffect(() => {
    if (!apiKey) {
        console.error("CRITICAL: OpenAI API Key (EXPO_PUBLIC_OPENAI_API_KEY from environment) is not configured. Voice chat will not function.");
        // Potentially set an error state here to inform the user on the UI
    }
  }, [apiKey]);

  // Automatic navigation on full completion
  useEffect(() => {
    if (isHookProcessingComplete && processingStep === 'complete') {
      console.log('[VOICE_ONBOARDING] Full onboarding process complete. Navigating to MainApp/HomeScreen...');
      // Hide the completion overlay before navigation
      setShowCompletionOverlay(false);
      // Reset stack to MainApp, initial screen HomeScreen if TabNavigator is configured for that
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainApp', params: { screen: 'HomeScreen' } }], 
      });
      // Or if MainApp directly shows tabs and HomeScreen is a tab name:
      // navigation.navigate('MainApp', { screen: 'HomeScreen' }); 
    }
  }, [isHookProcessingComplete, processingStep, navigation]);

  if (!coach || !coach.avatar) { // Added check for coach.avatar just in case imageMap lookup fails
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Coach data or avatar not found for ID: {currentCoachId}.</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CoachSelect')} style={styles.button}>
          <Text style={styles.buttonText}>Select Coach</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          {voiceChatUIVisible ? (
            // Animated coach head during voice chat
            <View style={styles.animatedCoachContainer}>
              <View
                style={[
                  styles.coachImageWrapper,
                  styles.coachImageWrapperActive
                ]}
              >
                <Animatable.Image
                  source={coach.avatar}
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
                
                {isCoachSpeaking && (
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
          ) : (
            // Static coach image when not in voice chat
            <Image source={coach.avatar} style={styles.coachImage} />
          )}
          <Text style={styles.coachName}>{coach.name}</Text>
        </View>
        
        {voiceChatUIVisible && apiKey && (
          <View style={styles.voiceChatContainer}>
            <VoiceChat
              isVisible={true} // voiceChatUIVisible controls this block
              onClose={handleCloseVoiceChat}
              coachId={currentCoachId}
              apiKey={apiKey} // Pass the checked apiKey
              onError={handleVoiceChatError}
              onboardingMode={true}
              onTranscriptComplete={handleVoiceTranscriptComplete}
              onSpeakingStateChange={handleSpeakingStateChange}
              useModal={false} // Render inline as per existing logic
            />
          </View>
        )}
        {/* Inform user if API key is missing and trying to show voice chat */}
        {voiceChatUIVisible && !apiKey && (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>OpenAI API Key not configured. Voice chat cannot start.</Text>
            </View>
        )}
        
        <View style={styles.actionContainer}>
          {/* Show "Talk to coach" button when voice chat is NOT visible, hook is NOT complete, and NOT reconnecting */}
          {!voiceChatUIVisible && !isHookProcessingComplete && !isReconnecting && !showCompletionOverlay && (
            <>
              <Animatable.View animation="pulse" iterationCount={3} duration={1000}>
                <TouchableOpacity 
                  style={[styles.talkButton, (!isVoiceChatAvailable || isProcessing) && styles.talkButtonDisabled]}
                  onPress={handleStartVoiceChat}
                  disabled={!isVoiceChatAvailable || isProcessing}
                  activeOpacity={0.7}
                >
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
        isProcessing={isProcessing}
      />
      
      <LoadingOverlay 
        visible={isProcessing} // Correct prop name is 'visible'
        message={processingMessage}
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
    backgroundColor: '#000000',
    borderRadius: 12,
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
    backgroundColor: '#888888',
    opacity: 0.7,
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
  button: { // General button style, e.g., for error screen
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
}); 