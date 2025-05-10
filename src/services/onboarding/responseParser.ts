import { CoachResponse, ConversationContext } from './types';
import { normalizeProfileData } from './onboardingDataFormatter';
import { requiredInformation } from '../../config/coachingGuidelines';

/**
 * Validates and processes the coach's response to extract information
 */
export function processCoachResponse(
  responseText: string, 
  extractedInfo: Record<string, string | null>,
  context: ConversationContext
): CoachResponse {
  // Validate the response
  if (!responseText || typeof responseText !== 'string') {
    return {
      message: 'Sorry, I encountered an error. Let\'s try again.',
      extractedInfo: {},
      completionStatus: {
        missingFields: Object.keys(requiredInformation),
        complete: false
      },
      isValid: false,
      error: 'Invalid response format'
    };
  }

  // Normalize extracted data
  const normalizedData = normalizeProfileData(extractedInfo, context.userProfile);

  // Calculate missing fields and completion status
  const allRequiredFields = Object.keys(requiredInformation).filter(
    key => key !== 'onboarding_completed'
  );
  
  // Merge the existing profile with newly extracted data
  const mergedProfile = {
    ...context.userProfile,
    ...normalizedData
  };
  
  // Check for missing fields based on merged profile
  const missingFields = allRequiredFields.filter(key => {
    // Skip race fields if user has explicitly indicated no races
    if ((key === 'race_distance' || key === 'race_date') && 
        (mergedProfile.race_distance === null || 
         mergedProfile.race_date === null)) {
      return false;
    }
    return !mergedProfile[key as keyof typeof mergedProfile];
  });
  
  const isComplete = missingFields.length === 0;
  
  // Check for completion
  const completionStatus = {
    missingFields,
    complete: isComplete
  };
  
  // Check for the specific "completion" phrase that signals the AI thinks we're done
  const completionPhraseDetected = responseText.includes("Perfect! I've got all the information I need");
  
  // Final response
  return {
    message: responseText,
    extractedInfo: normalizedData,
    completionStatus,
    isValid: true,
    completionPhraseDetected
  };
}

/**
 * Extracts JSON from a GPT response text
 */
export function extractJsonFromResponse(responseText: string): Record<string, string | null> {
  try {
    // Look for JSON object in the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const jsonString = jsonMatch[0];
      return JSON.parse(jsonString);
    }
    
    return {};
  } catch (error) {
    console.error('Error parsing JSON from response:', error);
    return {};
  }
} 