import { ConversationContext } from './types';
// import { normalizeProfileData } from './onboardingDataFormatter'; // Keep if used elsewhere
// import { requiredInformation } from '../../config/coachingGuidelines'; // Keep if used elsewhere

/**
 * Validates and processes the coach's response to extract information
 * This function is likely deprecated as part of the move to direct OpenAI function calling.
 */
/*
export function processCoachResponse(
  responseText: string, 
  extractedInfo: Record<string, string | null>,
  context: ConversationContext
): CoachResponse {
  console.log('[RESPONSE_PARSER] Processing coach response (DEPRECATED FLOW):', { 
    responseText: responseText.substring(0, 100) + '...',
    extractedInfoKeys: Object.keys(extractedInfo),
  });

  // Validate the response
  if (!responseText || typeof responseText !== 'string') {
    console.error('[RESPONSE_PARSER] Invalid response format');
    return {
      message: 'Sorry, I encountered an error. Let\'s try again.',
      extractedInfo: {},
      completionStatus: {
        missingFields: [], // Object.keys(requiredInformation), // requiredInformation might be undefined here now
        complete: false
      },
      isValid: false,
      error: 'Invalid response format'
    };
  }

  // Normalize extracted data
  // const normalizedData = normalizeProfileData(extractedInfo, context.userProfile);
  // console.log('[RESPONSE_PARSER] Normalized data:', normalizedData);
  const normalizedData = extractedInfo; // Assuming data is already in good shape if this path were ever hit


  // Calculate missing fields and completion status
  const allRequiredFields: string[] = []; // Object.keys(requiredInformation).filter(
  //   key => key !== 'onboarding_completed'
  // );
  
  // Merge the existing profile with newly extracted data
  const mergedProfile = {
    ...context.userProfile,
    ...normalizedData
  };
  
  // console.log('[RESPONSE_PARSER] Merged profile:', mergedProfile);
  
  // Check for missing fields based on merged profile
  const missingFields = allRequiredFields.filter(key => {
    if ((key === 'race_distance' || key === 'race_date') && 
        (mergedProfile.race_distance === null || 
         mergedProfile.race_date === null)) {
      return false;
    }
    return !mergedProfile[key as keyof typeof mergedProfile];
  });
  
  const isComplete = missingFields.length === 0;
  // console.log('[RESPONSE_PARSER] Completion check:', { 
  //   missingFields, 
  //   isComplete 
  // });
  
  // Check for completion
  const completionStatus = {
    missingFields,
    complete: isComplete
  };
  
  const completionPhraseDetected = responseText.includes("Perfect! I've got all the information I need");
  // console.log('[RESPONSE_PARSER] Completion phrase detected:', completionPhraseDetected);
  
  // Final response
  return {
    message: responseText,
    extractedInfo: normalizedData,
    completionStatus,
    isValid: true,
    completionPhraseDetected
  };
}
*/

/**
 * Extracts JSON from a GPT response text
 * This function is likely deprecated as part of the move to direct OpenAI function calling.
 */
/*
export function extractJsonFromResponse(responseText: string): Record<string, string | null> {
  console.log('[RESPONSE_PARSER] Extracting JSON from response (DEPRECATED FLOW):', { 
    responseTextLength: responseText.length,
    responseTextPreview: responseText.substring(0, 100) + '...' 
  });
  
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const jsonString = jsonMatch[0];
      // console.log('[RESPONSE_PARSER] Found JSON string:', jsonString);
      const parsedJson = JSON.parse(jsonString);
      // console.log('[RESPONSE_PARSER] Successfully parsed JSON with keys:', Object.keys(parsedJson));
      return parsedJson;
    }
    
    console.log('[RESPONSE_PARSER] No JSON found in response (DEPRECATED FLOW)');
    return {};
  } catch (error) {
    console.error('[RESPONSE_PARSER] Error parsing JSON from response (DEPRECATED FLOW):', error);
    return {};
  }
}
*/
