import Constants from 'expo-constants';

import { buildConversationPrompt } from './coachPromptBuilder';
import { ConversationContext, ConversationResult } from './types';
import { supabase } from '../../lib/supabase';
import { OnboardingProfile } from '../../types/onboarding';

/**
 * Main conversation handler - focuses solely on the conversation experience
 * Returns a complete conversation transcript once onboarding is complete,
 * or tool call arguments if the AI decides to call the update_onboarding_profile tool.
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
  const conversationHistory = [...currentContext.conversationHistory];

  // Handle special case for initial greeting (when userMessage is null)
  const isInitialGreeting = userMessage === null || userMessage === 'START_CONVERSATION';

  // Build system prompt
  // NOTE: buildConversationPrompt might need adjustments to encourage function calling.
  const systemPrompt = buildConversationPrompt(currentContext, userMessage);

  try {
    // Prepare messages array - for initial greeting, we don't include a user message
    const messages: any[] = [
      // Using any for now, will refine based on OpenAI library types if available
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.map((msg: { role: 'user' | 'coach'; content: string }) => ({
        role: msg.role === 'coach' ? ('assistant' as const) : ('user' as const),
        content: msg.content,
      })),
    ];

    // Only add the user message if it's not the initial greeting
    if (userMessage !== null && !isInitialGreeting) {
      messages.push({ role: 'user' as const, content: userMessage });
    }

    // Make a call to OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        // 'OpenAI-Project': 'proj_hKaI3BQl7GIX7cECLqFM538H' // Consider if this is still needed/valid
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Updated model
        messages,
        tools: [updateOnboardingProfileTool],
        tool_choice: 'auto', // Let the model decide when to call the function
        max_tokens: 1000, // Adjust as needed
        temperature: 0.7,
      }),
    });

    const responseData = await response.json();

    // Check for errors in API response
    if (!response.ok || !responseData.choices || !responseData.choices[0]) {
      console.error('OpenAI API error:', responseData);
      throw new Error(`OpenAI API error: ${responseData.error?.message || 'Unknown error'}`);
    }

    const choice = responseData.choices[0];
    let coachMessage = '';
    let toolCallArguments: Partial<OnboardingProfile> | null = null;
    let isCompleteByToolCall = false;

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      const toolCall = choice.message.tool_calls[0];
      if (toolCall.function.name === 'update_onboarding_profile') {
        toolCallArguments = JSON.parse(toolCall.function.arguments);
        coachMessage = choice.message.content || "Okay, let's get started!";
        isCompleteByToolCall = true;
        console.log(
          "[handleOnboardingConversation] AI called 'update_onboarding_profile'. Arguments:",
          toolCallArguments
        );
        console.log(
          '[handleOnboardingConversation] Coach message accompanying tool call:',
          coachMessage
        );
      } else {
        // Handle other potential tool calls if any in the future
        coachMessage = choice.message.content || 'I need to do something else first.';
      }
    } else {
      coachMessage = choice.message.content
        ? choice.message.content.trim()
        : "I'm not sure what to say.";
    }

    // Update conversation history with new messages
    if (userMessage !== null && !isInitialGreeting) {
      conversationHistory.push({ role: 'user', content: userMessage });
    }
    // Add assistant's response to history, even if it's a precursor to a tool call or a simple message
    if (coachMessage) {
      conversationHistory.push({ role: 'coach', content: coachMessage });
    }

    // Determine if onboarding is complete
    // Original completion logic based on phrases:
    const lowerCoachMessage = coachMessage.toLowerCase();
    const completionPhrases = [
      "i've got everything i need",
      "i've got all the information i need",
      'got all the information i need',
      "perfect! i've got all the information i need",
    ];
    const isCompleteByPhrase = completionPhrases.some((phrase) =>
      lowerCoachMessage.includes(phrase)
    );

    // Onboarding is complete if the tool was called OR if the AI uses a completion phrase.
    const isComplete = isCompleteByToolCall || isCompleteByPhrase;
    if (isCompleteByToolCall && isCompleteByPhrase) {
      console.log(
        '[handleOnboardingConversation] Onboarding complete by BOTH tool call and completion phrase.'
      );
    } else if (isCompleteByToolCall) {
      console.log('[handleOnboardingConversation] Onboarding complete by tool call.');
    } else if (isCompleteByPhrase) {
      console.log('[handleOnboardingConversation] Onboarding complete by phrase.');
    }

    return {
      message: coachMessage,
      isComplete,
      conversationHistory,
      toolCallArguments, // Include this in the result
    };
  } catch (error) {
    console.error('Error in handleOnboardingConversation:', error);
    throw error;
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
  const configKey =
    Constants.expoConfig?.extra?.openaiApiKey ||
    Constants.expoConfig?.extra?.OPENAI_API_KEY ||
    // @ts-ignore - This is a fallback for older Expo versions
    Constants.manifest?.extra?.OPENAI_API_KEY;

  return configKey ? configKey.replace(/["']/g, '').trim() : undefined;
}

const updateOnboardingProfileTool = {
  type: 'function' as const,
  function: {
    name: 'update_onboarding_profile',
    description:
      "Updates the user's profile with information gathered during the onboarding conversation. Call this function once all required information has been collected.",
    parameters: {
      type: 'object' as const,
      properties: {
        nickname: {
          type: 'string' as const,
          description: "The athlete's preferred name or nickname.",
        },
        units: {
          type: 'string' as const,
          enum: ['km', 'miles'] as const,
          description: "The athlete's preferred units for distance (km or miles).",
        },
        current_mileage: {
          type: 'string' as const,
          description:
            "The athlete's current weekly running mileage (e.g., '30', '25-35'). Include the unit if specified, otherwise assume based on 'units' field.",
        },
        current_frequency: {
          type: 'string' as const,
          description:
            "How many days per week the athlete currently runs. This should be a numerical string (e.g., '3', '5', '7' for everyday).",
        },
        experience_level: {
          type: 'string' as const,
          description:
            "How long the athlete has been running (e.g., '6 months', '2 years', '10+ years', 'just started', 'since high school').",
        },
        goal_type: {
          type: 'string' as const,
          description:
            "The athlete's primary running goal (e.g., 'run a marathon', 'get faster at 5k', 'general fitness', 'complete first 10k').",
        },
        race_distance: {
          type: 'string' as const,
          description:
            "The distance of their target race, if any (e.g., '10k', 'marathon', 'half marathon'). Include unit if specified. Null or empty if no specific race.",
        },
        race_date: {
          type: 'string' as const,
          description:
            'The date of their target race in YYYY-MM-DD format, if any. Null or empty if no specific race or date.',
        },
        schedule_constraints: {
          type: 'string' as const,
          description:
            "Any constraints on their training schedule (e.g., 'busy on weekends', 'can only run in mornings', 'no specific constraints'). Null if none.",
        },
        injury_history: {
          type: 'string' as const,
          description:
            'A brief description of any significant past injuries or current niggles. Null if no notable history.',
        },
      },
      required: [
        'nickname',
        'units',
        'current_mileage',
        'current_frequency',
        'experience_level',
        'goal_type',
      ],
    },
  },
};
