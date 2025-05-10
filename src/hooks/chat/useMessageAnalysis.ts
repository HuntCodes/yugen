import Constants from 'expo-constants';
import { ChatMessage } from './useMessageTypes';
import { identifyChatContext } from '../../services/summary/chatSummaryService';

/**
 * Hook for message analysis utilities
 */
export function useMessageAnalysis() {
  /**
   * Get the OpenAI API key from available sources
   */
  const getApiKey = (): string | null => {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
                  Constants.expoConfig?.extra?.openaiApiKey ||
                  Constants.expoConfig?.extra?.OPENAI_API_KEY ||
                  (Constants.manifest as any)?.extra?.OPENAI_API_KEY;
                  
    return apiKey || null;
  };

  /**
   * Call the OpenAI API with a system prompt and user message
   */
  const callOpenAI = async (
    systemPrompt: string,
    userMessage: string
  ): Promise<string | null> => {
    try {
      const apiKey = getApiKey();
      
      if (!apiKey) {
        console.error('OpenAI API key not found');
        return null;
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      return null;
    }
  };

  /**
   * Identify the topic/context of a conversation
   */
  const identifyConversationContext = async (
    messages: ChatMessage[],
    workoutId?: string
  ) => {
    return identifyChatContext(messages, workoutId);
  };

  /**
   * Generate AI response to user message using context
   */
  const generateAIResponse = async (
    message: string,
    systemPrompt: string
  ): Promise<string | null> => {
    return callOpenAI(systemPrompt, message);
  };

  return {
    getApiKey,
    callOpenAI,
    identifyConversationContext,
    generateAIResponse
  };
} 