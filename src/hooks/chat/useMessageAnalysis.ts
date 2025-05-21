import Constants from 'expo-constants';
import { ChatMessage } from './useMessageTypes';
import { identifyChatContext } from '../../services/summary/chatSummaryService';

// Define the structure for a tool call, if needed for type safety elsewhere
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface OpenAIResponse {
  content?: string | null;
  tool_calls?: OpenAIToolCall[];
}

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
    messages: Array<{role: string, content: string | null, tool_calls?: OpenAIToolCall[]}>, // Expects the full messages array
    tools?: any[] 
  ): Promise<OpenAIResponse | null> => {
    try {
      const apiKey = getApiKey();
      
      if (!apiKey) {
        console.error('OpenAI API key not found');
        return null;
      }
      
      const requestBody: any = {
        model: 'gpt-4o-mini',
        messages: messages, // Use the messages array directly
        temperature: 0.7,
      };

      if (tools && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = 'auto';
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody), // Use the constructed body
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
      }

      const data = await response.json();
      
      if (data.choices[0].message.tool_calls) {
        return { tool_calls: data.choices[0].message.tool_calls };
      }
      return { content: data.choices[0].message.content };
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
    messages: Array<{role: string, content: string | null, tool_calls?: OpenAIToolCall[]}>, 
    tools?: any[] 
  ): Promise<OpenAIResponse | null> => {
    return callOpenAI(messages, tools);
  };

  return {
    getApiKey,
    callOpenAI,
    identifyConversationContext,
    generateAIResponse
  };
} 