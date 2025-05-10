import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { onboardingService } from '../services';
import { updateProfile } from '../services/profile/profileService';
import { generateAndSavePlan } from '../services/plan/planService';
import { useAuth } from '../context/AuthContext';
import { OnboardingData } from '../types/training';
import { COACHES } from '../lib/constants/coaches';

// Define the navigation type
type OnboardingNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

export function useOnboardingConversation(initialCoachId: string) {
  const navigation = useNavigation<OnboardingNavigationProp>();
  const { session } = useAuth();
  
  // Conversation state
  const [conversationHistory, setConversationHistory] = useState<{role: 'user' | 'coach'; content: string}[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [message, setMessage] = useState<string>('');
  
  // Conversation processing state
  const [processingStep, setProcessingStep] = useState<'idle' | 'extracting' | 'saving' | 'generating_plan' | 'complete'>('idle');
  
  // Initialize conversation
  useEffect(() => {
    // Only start conversation when component mounts and we have a user
    if (session && conversationHistory.length === 0) {
      startConversation();
    }
  }, [session]);
  
  // Start conversation with initial greeting
  const startConversation = useCallback(async () => {
    if (!session) return;
    
    setIsTyping(true);
    
    try {
      // Pass null instead of 'START_CONVERSATION' to get initial greeting without a user message
      const result = await onboardingService.handleOnboardingConversation(null, {
        coachId: initialCoachId,
        userProfile: {},
        conversationHistory: []
      });
      
      setMessage(result.message);
      setConversationHistory(result.conversationHistory);
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start the conversation. Please try again.');
    } finally {
      setIsTyping(false);
    }
  }, [session, initialCoachId]);
  
  // Send user message to conversation
  const sendMessage = useCallback(async (userMessage: string) => {
    if (!session || isTyping || isProcessing || isComplete) return;
    
    setIsTyping(true);
    
    // Add user message to conversation
    const updatedHistory = [
      ...conversationHistory,
      { role: 'user' as const, content: userMessage }
    ];
    
    setConversationHistory(updatedHistory);
    
    try {
      const result = await onboardingService.handleOnboardingConversation(userMessage, {
        coachId: initialCoachId,
        userProfile: {},
        conversationHistory
      });
      
      setMessage(result.message);
      setConversationHistory(result.conversationHistory);
      
      // Check if conversation is complete
      if (result.isComplete) {
        setIsComplete(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send your message. Please try again.');
    } finally {
      setIsTyping(false);
    }
  }, [session, initialCoachId, conversationHistory, isTyping, isProcessing, isComplete]);
  
  // Function to manually complete the conversation and process results
  const completeConversation = useCallback(async () => {
    if (!session || isProcessing) return;
    
    setIsProcessing(true);
    setProcessingStep('extracting');
    
    try {
      // Extract data from conversation
      const { extractedProfile } = await onboardingService.processOnboardingTranscript(
        conversationHistory,
        initialCoachId
      );
      
      // Update processing step
      setProcessingStep('saving');
      
      // Ensure race_date is null rather than empty string for SQL date column
      const safeProfile = {
        ...extractedProfile,
        // Ensure race_date is null rather than empty string for SQL date column
        race_date: extractedProfile.race_date && extractedProfile.race_date.trim() 
          ? extractedProfile.race_date 
          : null
      };
      
      // Make sure session.user is not null before using it
      if (!session.user) {
        throw new Error("User is not authenticated");
      }
      
      // Save extracted profile to Supabase
      await updateProfile(session.user.id, safeProfile);
      
      // Update processing step
      setProcessingStep('generating_plan');
      
      // Convert to OnboardingData format for plan generation
      const planData: OnboardingData = {
        goalType: safeProfile.goal_type || 'General fitness',
        raceDate: safeProfile.race_date || undefined,
        raceDistance: safeProfile.race_distance,
        experienceLevel: safeProfile.experience_level || 'beginner',
        trainingFrequency: safeProfile.current_frequency || '3 days per week',
        trainingPreferences: safeProfile.injury_history || '',
        nickname: safeProfile.nickname,
        current_mileage: safeProfile.current_mileage,
        injury_history: safeProfile.injury_history || '',
        shoe_size: safeProfile.shoe_size,
        clothing_size: safeProfile.clothing_size,
        schedule_constraints: safeProfile.schedule_constraints || '',
        units: safeProfile.units
      };
      
      // Make sure user is still authenticated before generating plan
      if (!session.user) {
        throw new Error("User is not authenticated");
      }
      
      // Generate and save training plan
      await generateAndSavePlan(session.user.id, planData);
      
      // Complete processing
      setProcessingStep('complete');
      
      // Navigate to MainApp screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainApp' }],
      });
    } catch (error) {
      console.error('Error processing conversation:', error);
      Alert.alert(
        'Error', 
        'We encountered an issue processing your information. Please try again.',
        [{ text: 'OK', onPress: () => {
          setProcessingStep('idle');
          setIsProcessing(false);
        }}]
      );
    }
  }, [session, conversationHistory, initialCoachId, navigation]);
  
  // Compute loading message based on current processing step
  const getProcessingMessage = useCallback(() => {
    switch (processingStep) {
      case 'extracting':
        return 'Analyzing conversation...';
      case 'saving':
        return 'Saving your profile...';
      case 'generating_plan':
        return 'Creating your training plan...';
      default:
        return 'Processing...';
    }
  }, [processingStep]);
  
  // Function to mark the onboarding as complete without processing yet
  const markOnboardingComplete = useCallback(() => {
    setIsComplete(true);
  }, []);
  
  return {
    conversationHistory,
    isTyping,
    isProcessing,
    isComplete,
    message,
    processingStep,
    processingMessage: getProcessingMessage(),
    sendMessage,
    completeConversation,
    markOnboardingComplete
  };
} 