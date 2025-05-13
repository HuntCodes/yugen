import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { onboardingService } from '../services';
import { generateAndSavePlan } from '../services/plan/planService';
import { useAuth } from '../context/AuthContext';
import { OnboardingData } from '../types/training';
import { COACHES } from '../lib/constants/coaches';
import { supabase } from '../lib/supabase';
import { OnboardingProfile } from '../types/onboarding';

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
  const completeConversation = useCallback(async (
    providedHistory?: {role: 'user' | 'coach'; content: string}[]
  ) => {
    if (!session || isProcessing) return { success: false, error: 'Session not active or already processing.' };
    
    setIsProcessing(true);
    setProcessingStep('extracting');
    
    try {
      console.log('[ONBOARDING_CONVERSATION] ✅ Starting completion process...');
      
      // Use the provided history if available, otherwise use the current conversation history
      const historyToProcess = providedHistory || conversationHistory;
      
      console.log('[ONBOARDING_CONVERSATION] Conversation history for extraction:', 
        JSON.stringify(historyToProcess, null, 2));
      
      // Extract data from conversation
      const { extractedProfile } = await onboardingService.processOnboardingTranscript(
        historyToProcess,
        initialCoachId
      );
      
      console.log('[ONBOARDING_CONVERSATION] Extracted profile:', extractedProfile);
      
      // Ensure extractedProfile is not null or undefined
      if (!extractedProfile) {
        throw new Error("Extracted profile is null or undefined");
      }

      // Prepare the profile for saving, mapping fields and ensuring type correctness
      const profileToSave: Partial<OnboardingProfile> = {};

      // Map known fields from extractedProfile to profileToSave
      // This also filters out any unexpected fields from extractedProfile
      const knownKeys: (keyof OnboardingProfile)[] = [
        'nickname', 'units', 'current_mileage', 'current_frequency', 
        'goal_type', 'experience_level', 'schedule_constraints', 
        'race_distance', 'race_date', 'injury_history', 
        'shoe_size', 'clothing_size', 'onboarding_completed', 'coach_id'
        // Add any other valid OnboardingProfile keys here
      ];

      for (const key of knownKeys) {
        if (key in extractedProfile && extractedProfile[key] !== undefined) {
          (profileToSave as any)[key] = extractedProfile[key];
        }
      }
      
      // Handle specific mappings: name -> nickname
      if ((extractedProfile as any).name && !profileToSave.nickname) {
        profileToSave.nickname = (extractedProfile as any).name;
      }
      if (profileToSave.nickname === '' || profileToSave.nickname === null) {
        profileToSave.nickname = undefined;
      }

      // Handle specific mappings: goal -> goal_type
      if ((extractedProfile as any).goal && !profileToSave.goal_type) {
        profileToSave.goal_type = (extractedProfile as any).goal;
      }
      if (!profileToSave.goal_type) { // Default if still no goal_type
        profileToSave.goal_type = 'General fitness';
      }
      
      // Ensure race_date is undefined or a valid string
      if (profileToSave.race_date && String(profileToSave.race_date).trim() === '') {
        profileToSave.race_date = undefined;
      } else if (profileToSave.race_date) {
        profileToSave.race_date = String(profileToSave.race_date).trim();
      } else {
        profileToSave.race_date = undefined;
      }

      profileToSave.coach_id = initialCoachId;

      console.log('[ONBOARDING_CONVERSATION] Profile to save to database:', profileToSave);

      // Save to the user profile in Supabase
      setProcessingStep('saving');
      
      // Make sure session.user is not null before using it
      if (!session.user) {
        throw new Error("User is not authenticated");
      }
      
      // Save extracted profile to database
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          ...profileToSave, // Use the cleaned and mapped profile
          onboarding_completed: true, // Ensure this is set
          updated_at: new Date().toISOString()
        })
        .eq('id', session.user.id);
      
      if (profileUpdateError) {
        console.error('Error updating profile:', profileUpdateError);
        throw new Error(`Error updating profile: ${JSON.stringify(profileUpdateError)}`);
      }
      
      console.log('[ONBOARDING_CONVERSATION] Profile saved successfully.');

      // Generate and save training plan
      console.log('[ONBOARDING_CONVERSATION] Generating training plan...');
      setProcessingStep('generating_plan');
      
      // Construct OnboardingData from profileToSave. This might need adjustment based on OnboardingData definition.
      // For now, assume profileToSave is compatible or contains enough info.
      // Critical: Ensure all fields required by `OnboardingData` are present in `profileToSave` or mapped correctly.
      const onboardingDataForPlan: OnboardingData = {
        // Map fields from profileToSave to OnboardingData structure
        nickname: profileToSave.nickname || session.user.email || 'Athlete',
        units: profileToSave.units || 'km',
        current_mileage: String(profileToSave.current_mileage ? parseFloat(String(profileToSave.current_mileage)) : 0),
        trainingFrequency: String(profileToSave.current_frequency ? parseInt(String(profileToSave.current_frequency), 10) : 0),
        goalType: profileToSave.goal_type || 'General fitness',
        experienceLevel: profileToSave.experience_level || 'beginner',
        schedule_constraints: profileToSave.schedule_constraints || 'none',
        raceDistance: profileToSave.race_distance || undefined,
        raceDate: profileToSave.race_date || undefined,
        injury_history: profileToSave.injury_history || 'none',
        shoe_size: profileToSave.shoe_size || undefined,
        clothing_size: profileToSave.clothing_size || undefined,
      };

      try {
        await generateAndSavePlan(session.user.id, onboardingDataForPlan);
        console.log('[ONBOARDING_CONVERSATION] Training plan generated and saved successfully.');
      } catch (planError) {
        console.error('[ONBOARDING_CONVERSATION] Error generating/saving training plan:', planError);
        // Decide on handling: either throw to make completeConversation fail, 
        // or allow completion but log/notify about plan failure.
        // For now, let's throw to indicate the whole process wasn't successful.
        throw new Error(`Training plan generation failed: ${planError instanceof Error ? planError.message : String(planError)}`);
      }
      
      setIsComplete(true);
      setProcessingStep('complete');
      setIsProcessing(false);
      console.log('[ONBOARDING_CONVERSATION] ✅ Completion process finished successfully.');
      return { success: true };
    } catch (error) {
      console.error('[ONBOARDING_CONVERSATION] Error processing conversation:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'An unknown error occurred during onboarding completion.');
      setIsProcessing(false);
      setProcessingStep('idle');
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }, [session, isProcessing, conversationHistory, initialCoachId]);
  
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