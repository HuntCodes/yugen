import { CoachResponse, ConversationContext } from './types';
import { handleOnboardingConversation, processOnboardingTranscript } from './onboardingFlow';
import { processCoachResponse, extractJsonFromResponse } from './responseParser';
import { OnboardingProfile } from '../../types/onboarding';

/**
 * Handles the coach's response to user messages during onboarding
 */
export async function getCoachResponse(
  userMessage: string,
  context: ConversationContext
): Promise<CoachResponse> {
  try {
    // First API call to handle the conversation
    const conversationResult = await handleOnboardingConversation(userMessage, context);
    
    // Second API call to extract structured information
    const partialContext: ConversationContext = {
      ...context,
      conversationHistory: conversationResult.conversationHistory
    };
    
    // Make a JSON extraction call
    const jsonExtractionResult = await makeExtractionCall(partialContext);
    
    // Process the response
    return processCoachResponse(
      conversationResult.message, 
      jsonExtractionResult, 
      partialContext
    );
  } catch (error) {
    console.error('Error in getCoachResponse:', error);
    return {
      message: 'Sorry, I encountered an error. Please try again.',
      extractedInfo: {},
      completionStatus: {
        missingFields: [],
        complete: false
      },
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Makes an API call to extract structured information from the conversation
 */
async function makeExtractionCall(
  context: ConversationContext
): Promise<Record<string, string | null>> {
  try {
    console.log('[ONBOARDING_INTERVIEW] Starting extraction from conversation history');
    console.log('[ONBOARDING_INTERVIEW] Full conversation history:', 
      JSON.stringify(context.conversationHistory, null, 2));
    
    // Use the full conversation history for extraction
    // This ensures we capture all information shared during the conversation
    const conversationToUse = context.conversationHistory;
    console.log('[ONBOARDING_INTERVIEW] Using conversation for extraction:', 
      JSON.stringify(conversationToUse, null, 2));
    
    // Process onboarding transcript for structured information
    const onboardingResult = await processOnboardingTranscript(
      conversationToUse,
      context.coachId
    );
    
    console.log('[ONBOARDING_INTERVIEW] Extraction result:', onboardingResult);
    
    // Convert the extracted profile to a simple Record
    const extractedInfo: Record<string, string | null> = {};
    
    Object.entries(onboardingResult.extractedProfile).forEach(([key, value]) => {
      if (key !== 'onboarding_completed' && key !== 'coach_id') {
        extractedInfo[key] = value as string | null;
      }
    });
    
    console.log('[ONBOARDING_INTERVIEW] Extracted info:', extractedInfo);
    
    return extractedInfo;
  } catch (error) {
    console.error('[ONBOARDING_INTERVIEW] Error in makeExtractionCall:', error);
    return {};
  }
}

// Re-export core functions from onboardingFlow for backward compatibility
export { handleOnboardingConversation, processOnboardingTranscript }; 