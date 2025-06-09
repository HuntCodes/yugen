import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { COACHES } from '../lib/constants/coaches';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/AppNavigator';
import { onboardingService } from '../services';
import { usePersistedOnboardingState } from './usePersistedOnboardingState';
import { generateAndSavePlan } from '../services/plan/planService';
import { OnboardingProfile } from '../types/onboarding';
import { OnboardingData } from '../types/training';

// Define the navigation type
type OnboardingNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

export function useOnboardingConversation(
  initialCoachId: string,
  enablePersistence: boolean = true
) {
  const navigation = useNavigation<OnboardingNavigationProp>();
  const { session } = useAuth();

  // Conversation state
  const [conversationHistory, setConversationHistory] = useState<
    { role: 'user' | 'coach'; content: string }[]
  >([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [extractedProfileFromTool, setExtractedProfileFromTool] =
    useState<Partial<OnboardingProfile> | null>(null);
  const [isRestoringState, setIsRestoringState] = useState(enablePersistence); // Only restore if persistence enabled

  // Conversation processing state
  const [processingStep, setProcessingStep] = useState<
    'idle' | 'extracting' | 'saving' | 'generating_plan' | 'complete'
  >('idle');

  // Persistence hook (only initialize if persistence is enabled)
  const persistenceHook = usePersistedOnboardingState(
    enablePersistence ? session?.user?.id || '' : '',
    enablePersistence ? initialCoachId : ''
  );
  const { saveConversationState, loadConversationState, clearSavedState, hasSavedState } =
    enablePersistence
      ? persistenceHook
      : {
          saveConversationState: async () => {},
          loadConversationState: async () => null,
          clearSavedState: async () => {},
          hasSavedState: async () => false,
        };

  // Initialize conversation with persistence (only if enabled)
  useEffect(() => {
    const initializeConversation = async () => {
      if (!session?.user?.id) {
        setIsRestoringState(false);
        return;
      }

      try {
        // Try to load saved state first (only if persistence enabled)
        if (enablePersistence) {
          const savedState = await loadConversationState();
          if (savedState && savedState.conversationHistory.length > 0) {
            console.log(
              `[ONBOARDING_CONVERSATION] Restoring saved conversation with ${savedState.conversationHistory.length} messages`
            );
            setConversationHistory(savedState.conversationHistory);
            setMessage(savedState.currentMessage);
            setIsComplete(savedState.isComplete);
            setExtractedProfileFromTool(savedState.extractedProfile);
            setIsRestoringState(false);
            return; // Exit early, don't start fresh conversation
          }
        }

        // Start fresh conversation if no saved state or persistence disabled
        if (conversationHistory.length === 0) {
          console.log(
            '[ONBOARDING_CONVERSATION] No saved state found or persistence disabled, starting fresh conversation'
          );
          await startConversation();
        }
      } catch (error) {
        console.error('[ONBOARDING_CONVERSATION] Error during initialization:', error);
        // Fall back to starting fresh conversation
        await startConversation();
      } finally {
        setIsRestoringState(false);
      }
    };

    initializeConversation();
  }, [session?.user?.id, initialCoachId, enablePersistence]);

  // Auto-save state on changes (but not during restoration and only if persistence enabled)
  useEffect(() => {
    if (!enablePersistence) return; // Skip if persistence disabled

    const saveState = async () => {
      if (!session?.user?.id || isRestoringState) return;

      // Only save if we have actual conversation content
      if (conversationHistory.length > 0 || message) {
        try {
          await saveConversationState({
            conversationHistory,
            currentMessage: message,
            isComplete,
            extractedProfile: extractedProfileFromTool,
          });
        } catch (error) {
          console.error('[ONBOARDING_CONVERSATION] Failed to save state:', error);
        }
      }
    };

    // Debounce saves slightly to avoid too frequent writes
    const timeoutId = setTimeout(saveState, 500);
    return () => clearTimeout(timeoutId);
  }, [
    conversationHistory,
    message,
    isComplete,
    extractedProfileFromTool,
    session?.user?.id,
    isRestoringState,
    saveConversationState,
    enablePersistence,
  ]);

  // Clear saved state on completion (only if persistence enabled)
  useEffect(() => {
    if (enablePersistence && isComplete && processingStep === 'complete') {
      console.log('[ONBOARDING_CONVERSATION] Onboarding complete, clearing saved state');
      clearSavedState().catch((error) =>
        console.error('[ONBOARDING_CONVERSATION] Failed to clear saved state:', error)
      );
    }
  }, [isComplete, processingStep, clearSavedState, enablePersistence]);

  // Start conversation with initial greeting
  const startConversation = useCallback(async () => {
    if (!session) return;

    setIsTyping(true);

    try {
      // Pass null instead of 'START_CONVERSATION' to get initial greeting without a user message
      const result = await onboardingService.handleOnboardingConversation(null, {
        coachId: initialCoachId,
        userProfile: {},
        conversationHistory: [],
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
  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!session || isTyping || isProcessing || isComplete) return;

      setIsTyping(true);

      // Add user message to conversation
      const currentHistory = [
        ...conversationHistory,
        { role: 'user' as const, content: userMessage },
      ];
      setConversationHistory(currentHistory);
      setMessage(''); // Clear previous coach message while waiting for new one

      try {
        const result = await onboardingService.handleOnboardingConversation(userMessage, {
          coachId: initialCoachId,
          userProfile: {}, // Current userProfile state could be passed here if needed by prompt
          conversationHistory, // Pass the history *before* adding the current user message for the AI call
        });

        setMessage(result.message);
        setConversationHistory(result.conversationHistory);

        if (result.toolCallArguments) {
          console.log(
            '[useOnboardingConversation] Received tool call arguments:',
            result.toolCallArguments
          );
          setExtractedProfileFromTool(result.toolCallArguments);
          if (result.isComplete) {
            console.log(
              '[useOnboardingConversation] Onboarding reported as complete along with tool call.'
            );
          }
        }

        if (result.isComplete) {
          setIsComplete(true);
          // Potentially call completeConversation directly if toolCallArguments are present and that's the desired flow
          // However, typically completeConversation is triggered separately or after a final user action.
          // The existing flow in OnboardingChat.tsx / VoiceOnboarding.tsx seems to call completeConversation
          // when isHookProcessingComplete (derived from isComplete) is true or manually.
        }
      } catch (error) {
        console.error('Error sending message:', error);
        Alert.alert('Error', 'Failed to send your message. Please try again.');
      } finally {
        setIsTyping(false);
      }
    },
    [session, initialCoachId, conversationHistory, isTyping, isProcessing, isComplete]
  );

  // Function to manually complete the conversation and process results
  const completeConversation = useCallback(
    async (
      providedHistory?: { role: 'user' | 'coach'; content: string }[],
      directExtractedProfile?: Partial<OnboardingProfile> | null
    ) => {
      if (!session || isProcessing)
        return { success: false, error: 'Session not active or already processing.' };

      setIsProcessing(true);

      // Prioritize directly passed profile, then state, then fallback
      let profileToProcess: Partial<OnboardingProfile> | null | undefined = directExtractedProfile;

      if (!profileToProcess && extractedProfileFromTool) {
        console.log(
          '[ONBOARDING_CONVERSATION] Using profile from tool call state (direct was not provided):',
          extractedProfileFromTool
        );
        profileToProcess = extractedProfileFromTool;
      }

      try {
        console.log('[ONBOARDING_CONVERSATION] ✅ Starting completion process...');

        if (profileToProcess) {
          console.log(
            '[ONBOARDING_CONVERSATION] Using profile from direct pass or tool call state:',
            profileToProcess
          );
          setProcessingStep('saving');
        } else {
          // If no profile is available from tool call (direct or state), it means onboarding is not yet complete via function call.
          // This indicates an issue or incomplete flow if completeConversation was called prematurely.
          console.warn(
            '[ONBOARDING_CONVERSATION] No profile from tool call. Onboarding might be incomplete or an error occurred.'
          );
          // Alert.alert('Incomplete Information', 'The onboarding conversation hasn\'t provided all necessary details yet. Please continue the chat or check for errors.');
          setIsProcessing(false);
          setProcessingStep('idle');
          return { success: false, error: 'Onboarding data not available from AI function call.' };
        }

        // Prepare the profile for saving, mapping fields and ensuring type correctness
        const profileToSave: Partial<OnboardingProfile> = {};

        const knownKeys: (keyof OnboardingProfile)[] = [
          'nickname',
          'units',
          'current_mileage',
          'current_frequency',
          'goal_type',
          'experience_level',
          'schedule_constraints',
          'race_distance',
          'race_date',
          'injury_history',
          'shoe_size',
          'clothing_size',
          'onboarding_completed',
          'coach_id',
        ];

        for (const key of knownKeys) {
          if (key in profileToProcess && profileToProcess[key] !== undefined) {
            (profileToSave as any)[key] = profileToProcess[key];
          }
        }

        if ((profileToProcess as any).name && !profileToSave.nickname) {
          profileToSave.nickname = (profileToProcess as any).name;
        }
        if (profileToSave.nickname === '' || profileToSave.nickname === null) {
          profileToSave.nickname = undefined;
        }

        if ((profileToProcess as any).goal && !profileToSave.goal_type) {
          profileToSave.goal_type = (profileToProcess as any).goal;
        }
        if (!profileToSave.goal_type) {
          profileToSave.goal_type = 'General fitness';
        }

        if (profileToSave.race_date && String(profileToSave.race_date).trim() === '') {
          profileToSave.race_date = undefined;
        } else if (profileToSave.race_date) {
          profileToSave.race_date = String(profileToSave.race_date).trim();
        } else {
          profileToSave.race_date = undefined;
        }

        profileToSave.coach_id = initialCoachId;

        console.log(
          '[ONBOARDING_CONVERSATION] Profile to save to database (pre-defaults for plan):',
          JSON.stringify(profileToSave, null, 2)
        );

        setProcessingStep('saving');

        if (!session.user) {
          throw new Error('User is not authenticated');
        }

        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            ...profileToSave,
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.user.id);

        if (profileUpdateError) {
          console.error('Error updating profile:', profileUpdateError);
          throw new Error(`Error updating profile: ${JSON.stringify(profileUpdateError)}`);
        }

        console.log('[ONBOARDING_CONVERSATION] Profile saved successfully.');

        console.log('[ONBOARDING_CONVERSATION] Generating training plan...');
        setProcessingStep('generating_plan');

        const userCurrentDate = new Date().toISOString().split('T')[0];

        let parsedFrequency = 0;
        const freqInput = profileToSave.current_frequency
          ? String(profileToSave.current_frequency).toLowerCase()
          : '0';
        if (freqInput === 'everyday' || freqInput === 'daily') {
          parsedFrequency = 7;
        } else {
          parsedFrequency = parseInt(freqInput, 10);
          if (isNaN(parsedFrequency)) {
            console.warn(
              `[useOnboardingConversation] Could not parse current_frequency: '${profileToSave.current_frequency}'. Defaulting to 0 for plan generation.`
            );
            parsedFrequency = 0;
          }
        }
        console.log(
          `[useOnboardingConversation] Parsed current_frequency: ${parsedFrequency} from input: '${profileToSave.current_frequency}'`
        );

        const parsedMileage = profileToSave.current_mileage
          ? parseFloat(String(profileToSave.current_mileage).replace(/[^\d.-]/g, ''))
          : 0;
        console.log(
          `[useOnboardingConversation] Parsed current_mileage: ${parsedMileage} from input: '${profileToSave.current_mileage}'`
        );

        const onboardingDataForPlan: OnboardingData = {
          nickname: profileToSave.nickname || session.user.email?.split('@')[0] || 'Athlete',
          units: profileToSave.units || 'km',
          current_mileage: String(parsedMileage),
          trainingFrequency: String(parsedFrequency),
          goalType: profileToSave.goal_type || 'General fitness',
          experienceLevel: profileToSave.experience_level || 'beginner',
          schedule_constraints: profileToSave.schedule_constraints || 'none',
          raceDistance: profileToSave.race_distance || undefined,
          raceDate: profileToSave.race_date || undefined,
          injury_history: profileToSave.injury_history || 'none',
          shoe_size: profileToSave.shoe_size || undefined,
          clothing_size: profileToSave.clothing_size || undefined,
          userStartDate: userCurrentDate,
        };

        try {
          await generateAndSavePlan(session.user.id, onboardingDataForPlan);
          console.log('[ONBOARDING_CONVERSATION] Training plan generated and saved successfully.');
        } catch (planError) {
          console.error(
            '[ONBOARDING_CONVERSATION] Error generating/saving training plan:',
            planError
          );
          throw new Error(
            `Training plan generation failed: ${planError instanceof Error ? planError.message : String(planError)}`
          );
        }

        setIsComplete(true);
        setProcessingStep('complete');
        setIsProcessing(false);
        console.log('[ONBOARDING_CONVERSATION] ✅ Completion process finished successfully.');
        return { success: true };
      } catch (error) {
        console.error('[ONBOARDING_CONVERSATION] Error processing conversation:', error);
        Alert.alert(
          'Error',
          error instanceof Error
            ? error.message
            : 'An unknown error occurred during onboarding completion.'
        );
        setIsProcessing(false);
        setProcessingStep('idle');
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    [session, isProcessing, conversationHistory, initialCoachId, extractedProfileFromTool]
  );

  // New function to process a complete transcript (e.g., from voice)
  const processFinalTranscriptForToolCall = useCallback(
    async (finalHistory: { role: 'user' | 'coach'; content: string }[]) => {
      if (!session || isProcessing || isComplete) return null; // Return null if cannot process

      console.log(
        '[useOnboardingConversation] Processing final transcript for potential tool call.'
      );
      setIsTyping(true);
      let toolArgsToReturn: Partial<OnboardingProfile> | null = null;

      try {
        const result = await onboardingService.handleOnboardingConversation(null, {
          coachId: initialCoachId,
          userProfile: {},
          conversationHistory: finalHistory,
        });

        if (result.message && result.message.trim() !== '') {
          setMessage(result.message);
          setConversationHistory(result.conversationHistory);
        }

        if (result.toolCallArguments) {
          console.log(
            '[useOnboardingConversation] Tool call arguments received from final transcript processing:',
            result.toolCallArguments
          );
          setExtractedProfileFromTool(result.toolCallArguments); // Still set state for other potential flows
          toolArgsToReturn = result.toolCallArguments;
        }

        if (result.isComplete) {
          console.log(
            '[useOnboardingConversation] Onboarding marked complete after final transcript processing.'
          );
          setIsComplete(true);
        }
        return toolArgsToReturn; // Return the arguments
      } catch (error) {
        console.error('Error processing final transcript:', error);
        Alert.alert('Error', 'Failed to process the conversation. Please try again.');
        return null; // Return null on error
      } finally {
        setIsTyping(false);
      }
    },
    [
      session,
      initialCoachId,
      isTyping,
      isProcessing,
      isComplete,
      setExtractedProfileFromTool,
      setIsComplete,
      setMessage,
      setConversationHistory,
    ]
  );

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
    isRestoringState,
    sendMessage,
    completeConversation,
    markOnboardingComplete,
    processFinalTranscriptForToolCall,
    clearSavedState: () => clearSavedState(),
    hasSavedState: () => hasSavedState(),
  };
}
