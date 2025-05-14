import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Platform, TouchableOpacity } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { OnboardingHeader } from './components/OnboardingHeader';
import { ChatMessageList } from './components/ChatMessageList';
import { OnboardingInput } from './components/OnboardingInput';
import { ContinueButton } from './components/ContinueButton';
import { LoadingOverlay } from '../../components/ui/LoadingOverlay';
import { useOnboardingConversation } from '../../hooks/useOnboardingConversation';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ChatMessage } from '../../types/chat';
import { COACHES } from '../../lib/constants/coaches';
import { VoiceChat } from '../../components/chat';
import { FontAwesome } from '@expo/vector-icons';
import { environment } from '../../config/environment';
import { useVoiceChat } from '../../hooks/useVoiceChat';

// Image mapping for coaches
const imageMap: Record<string, any> = {
  craig: require('../../assets/craig.jpg'),
  thomas: require('../../assets/thomas.jpg'),
  dathan: require('../../assets/dathan.jpg'),
};

export function OnboardingChat() {
  const [input, setInput] = useState('');
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [voiceChatError, setVoiceChatError] = useState<string | null>(null);
  const [voiceChatAvailable, setVoiceChatAvailable] = useState<boolean | null>(null);
  
  const route = useRoute();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  // Get coachId from route params or use default
  const coachId = (route.params as any)?.coachId || 'dathan';
  
  // Find coach data
  const coach = COACHES.find(c => c.id === coachId) || { id: coachId, name: 'Coach' };
  
  // Use voice chat hook for availability check
  const { 
    isVoiceChatAvailable, 
    checkVoiceChatAvailability 
  } = useVoiceChat();
  
  // Check if voice chat is available on component mount
  useEffect(() => {
    checkVoiceChatAvailability();
  }, [checkVoiceChatAvailability]);
  
  // Update local state when hook state changes
  useEffect(() => {
    setVoiceChatAvailable(isVoiceChatAvailable);
  }, [isVoiceChatAvailable]);
  
  // Use our custom hook to manage the conversation
  const {
    conversationHistory,
    isTyping,
    isProcessing,
    isComplete: isHookProcessingComplete,
    message,
    processingStep,
    processingMessage,
    sendMessage,
    completeConversation,
    markOnboardingComplete
  } = useOnboardingConversation(coachId);
  
  // Format conversation history for display
  const messages: ChatMessage[] = conversationHistory.map(msg => ({
    sender: msg.role === 'user' ? 'user' : 'coach',
    message: msg.content
  }));
  
  // Handle sending a message
  const handleSend = () => {
    if (!input.trim() || isTyping || isProcessing || isHookProcessingComplete) return;
    
    const userMessage = input.trim();
    setInput('');
    sendMessage(userMessage);
  };
  
  // Toggle voice chat modal
  const toggleVoiceChat = () => {
    setShowVoiceChat(!showVoiceChat);
  };
  
  // Close voice chat modal
  const handleCloseVoiceChat = useCallback(() => {
    console.log('[ONBOARDING] Voice chat modal closed');
    setShowVoiceChat(false);
  }, []);
  
  // Handle voice chat error
  const handleVoiceChatError = useCallback((error: string) => {
    console.log('[ONBOARDING] Voice chat error:', error);
    setVoiceChatError(error);
    setVoiceChatAvailable(false);
  }, []);
  
  // Handle voice chat transcript completion
  const handleVoiceTranscriptComplete = useCallback((
    userTranscript: string, 
    coachResponse: string, 
    isConversationComplete: boolean
  ) => {
    console.log('[ONBOARDING] Voice transcript received:', { 
      transcriptLength: userTranscript.length,
      isComplete: isConversationComplete 
    });
    
    // Don't process if already complete or processing
    if (isHookProcessingComplete || isProcessing) {
      console.log('[ONBOARDING] Ignoring transcript - already complete or processing');
      return;
    }
    
    // Add user transcript to conversation
    sendMessage(userTranscript);
    
    // If the conversation is complete, start the completion process
    if (isConversationComplete) {
      console.log('[ONBOARDING] Voice conversation is COMPLETE - starting completion process');
      markOnboardingComplete();
      
      // Start processing immediately
      setTimeout(() => {
        console.log('[ONBOARDING] Starting onboarding completion process');
        completeConversation();
      }, 500);
    }
  }, [isHookProcessingComplete, isProcessing, sendMessage, markOnboardingComplete, completeConversation]);
  
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
  
  // Handle the Continue button press
  const handleContinue = () => {
    if (isProcessing) return;
    completeConversation();
  };
  
  // Determine keyboard offset - needed for proper keyboard avoidance
  const keyboardOffset = 0;
  
  // Automatic navigation on full completion
  useEffect(() => {
    if (isHookProcessingComplete && processingStep === 'complete') {
      console.log('[ONBOARDING_CHAT] Full onboarding process complete. Navigating to MainApp/HomeScreen...');
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainApp', params: { screen: 'HomeScreen' } }], 
      });
    }
  }, [isHookProcessingComplete, processingStep, navigation]);
  
  return (
    <Screen keyboardVerticalOffset={keyboardOffset}>
      <OnboardingHeader 
        coachId={coachId} 
        coachName={coach.name}
        imageMap={imageMap}
      />
      
      <View className="flex-1">
        <ChatMessageList 
          messages={messages} 
          isTyping={isTyping}
          coach={coach}
          imageMap={imageMap}
        />
      </View>
      
      <View className="pb-0">
        <View className="flex-row items-center">
          <View className="flex-1">
            <OnboardingInput
              value={input}
              onChangeText={setInput}
              onSend={handleSend}
              disabled={isTyping || isProcessing || isHookProcessingComplete}
              isTyping={isTyping}
              planLoading={isProcessing}
            />
          </View>
        </View>
        
        {voiceChatError && (
          <View className="mt-2 px-4">
            <Text className="text-red-500 text-xs">{voiceChatError}</Text>
          </View>
        )}
        
        {isHookProcessingComplete && !isProcessing && (
          <View className="mt-4 px-4">
            <ContinueButton 
              onContinue={handleContinue}
              isLoading={isProcessing}
            />
          </View>
        )}
      </View>
      
      <LoadingOverlay 
        visible={isProcessing}
        message={processingMessage}
        progress={getProgressValue()}
      />
      
      {/* Voice Chat Modal - hide from text chat flow */}
      {false && showVoiceChat && environment.openAIApiKey && (
      <VoiceChat
        isVisible={showVoiceChat}
        onClose={handleCloseVoiceChat}
        coachId={coachId}
        apiKey={environment.openAIApiKey}
        onError={handleVoiceChatError}
        onboardingMode={true}
        onTranscriptComplete={handleVoiceTranscriptComplete}
      />
      )}
    </Screen>
  );
}
