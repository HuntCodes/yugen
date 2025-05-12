import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { COACHES } from '../../lib/constants/coaches';
import VoiceChat from '../../components/chat/VoiceChat';
import { useVoiceChat } from '../../hooks/useVoiceChat';
import { environment } from '../../config/environment';
import { useOnboardingConversation } from '../../hooks/useOnboardingConversation';
import { FontAwesome } from '@expo/vector-icons';
import { LoadingOverlay } from '../../components/ui/LoadingOverlay';
import { debugEnvironment } from '../../debug-env.js';

// Image mapping for coaches
const imageMap: Record<string, any> = {
  craig: require('../../assets/craig.jpg'),
  thomas: require('../../assets/thomas.jpg'),
  dathan: require('../../assets/dathan.jpg'),
};

// Use 'Onboarding' as the navigation type since 'VoiceOnboarding' isn't in RootStackParamList
type VoiceOnboardingNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

export function VoiceOnboarding() {
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [voiceChatError, setVoiceChatError] = useState<string | null>(null);
  const [showTextChat, setShowTextChat] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  const route = useRoute();
  const navigation = useNavigation<VoiceOnboardingNavigationProp>();
  
  // Get coachId from route params or use default
  const coachId = (route.params as any)?.coachId || 'dathan';
  
  // Find coach data
  const coach = COACHES.find(c => c.id === coachId) || { id: coachId, name: 'Coach' };
  
  // Use voice chat hook for availability check
  const { 
    isVoiceChatAvailable, 
    checkVoiceChatAvailability 
  } = useVoiceChat();
  
  // Use our custom hook to manage the conversation
  const {
    isTyping,
    isProcessing,
    isComplete,
    processingStep,
    processingMessage,
    markOnboardingComplete,
    completeConversation
  } = useOnboardingConversation(coachId);
  
  // Check if voice chat is available on component mount
  useEffect(() => {
    const setup = async () => {
      // Debug environment variables
      debugEnvironment();
      
      await checkVoiceChatAvailability();
      setInitialLoadComplete(true);
    };
    
    setup();
  }, [checkVoiceChatAvailability]);
  
  // Start voice chat automatically once loaded
  useEffect(() => {
    if (initialLoadComplete && isVoiceChatAvailable && !showVoiceChat && !showTextChat && !isComplete) {
      console.log('[VOICE ONBOARDING] Auto-starting voice chat');
      setShowVoiceChat(true);
    }
  }, [initialLoadComplete, isVoiceChatAvailable, showVoiceChat, showTextChat, isComplete]);
  
  // Handle voice chat close
  const handleCloseVoiceChat = useCallback(() => {
    console.log('[VOICE ONBOARDING] Voice chat closed');
    setShowVoiceChat(false);
    setIsReconnecting(false);
  }, []);
  
  // Handle voice chat error with reconnect logic
  const handleVoiceChatError = useCallback((error: string) => {
    console.log('[VOICE ONBOARDING] Voice chat error:', error);
    setVoiceChatError(error);
    
    // Only try to reconnect if it's a connection error and we haven't tried too many times
    if (error.includes('Connection failed') && reconnectAttempts < 2 && !isComplete) {
      console.log(`[VOICE ONBOARDING] Attempting reconnect (${reconnectAttempts + 1}/3)...`);
      setIsReconnecting(true);
      setShowVoiceChat(false);
      
      // Wait a moment before reconnecting
      setTimeout(() => {
        if (!isComplete) {
          setShowVoiceChat(true);
          setReconnectAttempts(prev => prev + 1);
        }
      }, 2000);
    } else {
      // If we've tried reconnecting too many times or it's another type of error,
      // offer the text chat option
      if (!showTextChat && !isComplete) {
        console.log('[VOICE ONBOARDING] Too many reconnect attempts or non-connection error. Suggesting text chat.');
        setShowVoiceChat(false);
        setIsReconnecting(false);
      }
    }
  }, [reconnectAttempts, showTextChat, isComplete]);
  
  // Handle voice chat transcript completion
  const handleVoiceTranscriptComplete = useCallback((
    userTranscript: string, 
    coachResponse: string, 
    isComplete: boolean
  ) => {
    console.log('[VOICE ONBOARDING] Voice transcript received:', { 
      transcriptLength: userTranscript.length,
      isComplete
    });
    
    // If the conversation is complete, start the completion process
    if (isComplete) {
      console.log('[VOICE ONBOARDING] Voice conversation is COMPLETE - starting completion process');
      // Turn off voice chat first
      setShowVoiceChat(false);
      // Then mark as complete to show the continue button
      markOnboardingComplete();
      // Reset reconnect attempts
      setReconnectAttempts(0);
      setIsReconnecting(false);
    }
  }, [markOnboardingComplete]);
  
  // Switch to text-based chat
  const handleSwitchToTextChat = () => {
    setShowTextChat(true);
    setShowVoiceChat(false);
    setIsReconnecting(false);
    navigation.navigate('Onboarding', { coachId });
  };
  
  // Start voice chat
  const handleStartVoiceChat = () => {
    setShowVoiceChat(true);
    setReconnectAttempts(0);
  };
  
  // Calculate progress based on processing step
  const getProgressValue = () => {
    switch (processingStep) {
      case 'extracting': return 0.33;
      case 'saving': return 0.66;
      case 'generating_plan': return 0.9;
      case 'complete': return 1;
      default: return 0;
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.coachImageContainer}>
          <Image
            source={imageMap[coach.id]}
            style={styles.coachImage}
          />
          <View style={styles.coachNameContainer}>
            <Text style={styles.coachName}>Coach {coach.name}</Text>
          </View>
        </View>
        
        <View style={styles.actionContainer}>
          {!showVoiceChat && !isComplete && !isReconnecting && (
            <TouchableOpacity 
              style={styles.talkButton}
              onPress={handleStartVoiceChat}
              disabled={!isVoiceChatAvailable || isProcessing}
            >
              <FontAwesome name="microphone" size={24} color="#fff" style={styles.micIcon} />
              <Text style={styles.talkButtonText}>Talk to your coach</Text>
            </TouchableOpacity>
          )}
          
          {isReconnecting && (
            <View style={styles.reconnectingContainer}>
              <Text style={styles.reconnectingText}>Reconnecting to voice service...</Text>
            </View>
          )}
          
          {!showVoiceChat && !isComplete && (
            <TouchableOpacity 
              style={styles.textChatButton}
              onPress={handleSwitchToTextChat}
            >
              <Text style={styles.textChatButtonText}>or use chat messaging instead</Text>
            </TouchableOpacity>
          )}
          
          {isComplete && !isProcessing && (
            <TouchableOpacity
              style={styles.continueButton}
              onPress={completeConversation}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          )}
          
          {voiceChatError && !isReconnecting && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{voiceChatError}</Text>
            </View>
          )}
        </View>
      </View>
      
      <LoadingOverlay 
        visible={isProcessing}
        message={processingMessage}
        progress={getProgressValue()}
      />
      
      {/* Voice Chat */}
      <VoiceChat
        isVisible={showVoiceChat}
        onClose={handleCloseVoiceChat}
        coachId={coachId}
        apiKey={environment.openAIApiKey}
        onError={handleVoiceChatError}
        onboardingMode={true}
        onTranscriptComplete={handleVoiceTranscriptComplete}
      />
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
    justifyContent: 'space-between',
  },
  coachImageContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  coachImage: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: '#F5F5F5',
  },
  coachNameContainer: {
    marginTop: 16,
  },
  coachName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  actionContainer: {
    marginBottom: 40,
  },
  talkButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
  },
  continueButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  errorContainer: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FFEBEE',
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
    color: '#2196F3',
    fontSize: 16,
  },
}); 