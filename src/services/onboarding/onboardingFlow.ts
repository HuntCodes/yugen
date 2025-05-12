import Constants from 'expo-constants';
import { ConversationContext, ConversationResult, OnboardingResult } from './types';
import { buildConversationPrompt, buildExtractionPrompt } from './coachPromptBuilder';
import { extractJsonFromResponse } from './responseParser';
import { normalizeProfileData } from './onboardingDataFormatter';
import { OnboardingProfile } from '../../types/onboarding';
import { supabase } from '../../lib/supabase';

/**
 * Main conversation handler - focuses solely on the conversation experience
 * Returns a complete conversation transcript once onboarding is complete
 */
export async function handleOnboardingConversation(
  userMessage: string | null,
  context: ConversationContext
): Promise<ConversationResult> {
  // Make a fresh copy of the context to avoid mutation issues
  const currentContext = JSON.parse(JSON.stringify(context));
  
  // Safely access API key from Expo constants
  const apiKey = getApiKey();
                
  if (!apiKey) {
    console.error('OpenAI API key not found');
    throw new Error('OpenAI API key not found');
  }

  // Use full conversation history for context
  const conversationHistory = currentContext.conversationHistory;

  // Handle special case for initial greeting (when userMessage is null)
  const isInitialGreeting = userMessage === null || userMessage === "START_CONVERSATION";
  
  // Build system prompt
  const systemPrompt = buildConversationPrompt(currentContext, userMessage);

  try {
    // Prepare messages array - for initial greeting, we don't include a user message
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.map((msg: { role: 'user' | 'coach'; content: string }) => ({
        role: msg.role === 'coach' ? 'assistant' as const : 'user' as const,
        content: msg.content
      }))
    ];
    
    // Only add the user message if it's not the initial greeting
    if (userMessage !== null && !isInitialGreeting) {
      messages.push({ role: 'user' as const, content: userMessage });
    }

    // Make a call to OpenAI for conversation only - no extraction here
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Project': 'proj_hKaI3BQl7GIX7cECLqFM538H'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', 
        messages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    const responseData = await response.json();
    
    // Check for errors in API response
    if (!response.ok || !responseData.choices || !responseData.choices[0]) {
      console.error('OpenAI API error:', responseData);
      throw new Error(`OpenAI API error: ${responseData.error?.message || 'Unknown error'}`);
    }

    // Get just the coach's message
    const coachMessage = responseData.choices[0].message.content.trim();

    // Update conversation history with new messages
    if (userMessage !== null && !isInitialGreeting) {
      conversationHistory.push({ role: 'user', content: userMessage });
    }
    conversationHistory.push({ role: 'coach', content: coachMessage });

    // Check if onboarding is complete (determined by the presence of a specific phrase)
    const isComplete = coachMessage.includes("Perfect! I've got all the information I need");

    return {
      message: coachMessage,
      isComplete,
      conversationHistory,
    };
  } catch (error) {
    console.error('Error in handleOnboardingConversation:', error);
    throw error;
  }
}

/**
 * Processes the entire onboarding transcript to extract a profile
 */
export async function processOnboardingTranscript(
  conversationHistory: {role: 'user' | 'coach'; content: string}[],
  coachId: string
): Promise<OnboardingResult> {
  // Safely access API key from Expo constants
  const apiKey = getApiKey();
                
  if (!apiKey) {
    console.error('OpenAI API key not found');
    throw new Error('OpenAI API key not found');
  }

  // Build extraction prompt
  const extractionPrompt = buildExtractionPrompt(conversationHistory, coachId);

  try {
    // Make a separate call to extract the structured profile information
    const extractionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Project': 'proj_hKaI3BQl7GIX7cECLqFM538H'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo-1106',
        messages: [
          { role: 'system', content: extractionPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.1, // Lower temperature for more deterministic extraction
      }),
    });

    const extractionData = await extractionResponse.json();
    
    // Validate API response
    if (!extractionResponse.ok || !extractionData.choices || !extractionData.choices[0]) {
      console.error('OpenAI API extraction error:', extractionData);
      throw new Error(`OpenAI API extraction error: ${extractionData.error?.message || 'Unknown error'}`);
    }

    // Extract profile from response
    const extractionResult = extractionData.choices[0].message.content;
    
    // Parse the JSON from the extraction result
    const extractedInfo = extractJsonFromResponse(extractionResult);
    
    // Normalize the extracted data
    const normalizedInfo = normalizeProfileData(extractedInfo, {});
    
    // Create final profile with appropriate type casting for better type safety
    const extractedProfile: Partial<OnboardingProfile> = {
      ...normalizedInfo,
      onboarding_completed: true,
      coach_id: coachId,
    };

    console.log('FINAL EXTRACTED PROFILE:', extractedProfile);

    return {
      extractedProfile,
      planGenerationSuccess: true,
    };
  } catch (error) {
    console.error('Error in processOnboardingTranscript:', error);
    
    // Return minimal profile with coach_id
    return {
      extractedProfile: { 
        coach_id: coachId,
        onboarding_completed: false
      } as Partial<OnboardingProfile>,
      planGenerationSuccess: false,
    };
  }
}

/**
 * Helper function to safely get the API key from Constants
 */
function getApiKey(): string | undefined {
  // First try the environment variable
  const envApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  
  if (envApiKey) {
    // Remove any surrounding quotes and whitespace that might be causing issues
    return envApiKey.replace(/["']/g, '').trim();
  }
  
  // Then fall back to Constants
  // TypeScript-safe way to access the API key
  const configKey = Constants.expoConfig?.extra?.openaiApiKey || 
                    Constants.expoConfig?.extra?.OPENAI_API_KEY ||
                    // @ts-ignore - This is a fallback for older Expo versions
                    Constants.manifest?.extra?.OPENAI_API_KEY;
  
  return configKey ? configKey.replace(/["']/g, '').trim() : undefined;
} 