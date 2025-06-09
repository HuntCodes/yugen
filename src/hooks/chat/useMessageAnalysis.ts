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

// Retry configuration
interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // Base delay in milliseconds
  maxDelay: number; // Maximum delay in milliseconds
  retryableErrors: string[]; // Error codes/messages that should trigger retry
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableErrors: [
    '429', // Rate limit
    '500', // Internal server error
    '502', // Bad gateway
    '503', // Service unavailable
    '504', // Gateway timeout
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'network',
    'timeout'
  ]
};

/**
 * Hook for message analysis utilities
 */
export function useMessageAnalysis() {
  /**
   * Get the OpenAI API key from available sources
   */
  const getApiKey = (): string | null => {
    const apiKey =
      process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
      Constants.expoConfig?.extra?.openaiApiKey ||
      Constants.expoConfig?.extra?.OPENAI_API_KEY ||
      (Constants.manifest as any)?.extra?.OPENAI_API_KEY;

    return apiKey || null;
  };

  /**
   * Check if an error is retryable based on status code or error message
   */
  const isRetryableError = (error: any, config: RetryConfig): boolean => {
    const errorString = String(error).toLowerCase();
    const statusMatch = errorString.match(/\b(\d{3})\b/);
    
    if (statusMatch) {
      const statusCode = statusMatch[1];
      if (config.retryableErrors.includes(statusCode)) {
        return true;
      }
    }
    
    return config.retryableErrors.some(retryableError => 
      errorString.includes(retryableError.toLowerCase())
    );
  };

  /**
   * Calculate delay for exponential backoff
   */
  const calculateDelay = (attempt: number, config: RetryConfig): number => {
    const exponentialDelay = config.baseDelay * Math.pow(2, attempt);
    const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // Add jitter
    return Math.min(jitteredDelay, config.maxDelay);
  };

  /**
   * Sleep for specified milliseconds
   */
  const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  /**
   * Validate messages array for OpenAI API requirements
   */
  const validateMessages = (messages: any[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!Array.isArray(messages) || messages.length === 0) {
      errors.push('Messages array is empty or not an array');
      return { isValid: false, errors };
    }

    // Track tool calls that need responses
    const pendingToolCalls: Set<string> = new Set();
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      if (!msg.role) {
        errors.push(`Message at index ${i} missing role`);
        continue;
      }
      
      if (msg.role === 'assistant' && msg.tool_calls) {
        // Assistant made tool calls - track them
        for (const toolCall of msg.tool_calls) {
          if (toolCall.id) {
            pendingToolCalls.add(toolCall.id);
          }
        }
      } else if (msg.role === 'tool') {
        // Tool response - should have tool_call_id
        if (!msg.tool_call_id) {
          errors.push(`Tool message at index ${i} missing tool_call_id`);
        } else {
          pendingToolCalls.delete(msg.tool_call_id);
        }
      }
    }
    
    // Check if there are unresolved tool calls
    if (pendingToolCalls.size > 0) {
      errors.push(`Unresolved tool calls: ${Array.from(pendingToolCalls).join(', ')}`);
    }
    
    return { isValid: errors.length === 0, errors };
  };

  /**
   * Call the OpenAI API with retry logic and enhanced error handling
   */
  const callOpenAI = async (
    messages: { role: string; content: string | null; tool_calls?: OpenAIToolCall[]; tool_call_id?: string; name?: string }[],
    tools?: any[],
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<OpenAIResponse | null> => {
    console.log('🤖 [callOpenAI] FUNCTION CALLED');
    console.log('🤖 [callOpenAI] INPUT:', {
      messagesLength: messages.length,
      hasTools: !!tools && tools.length > 0,
      toolsCount: tools?.length || 0,
      retryConfig: {
        maxRetries: retryConfig.maxRetries,
        baseDelay: retryConfig.baseDelay
      }
    });

    // Validate messages before making API call
    const validation = validateMessages(messages);
    if (!validation.isValid) {
      console.error('🤖 [callOpenAI] MESSAGE VALIDATION FAILED:', validation.errors);
      console.log('🤖 [callOpenAI] INVALID MESSAGES ARRAY:');
      console.log('=====================================');
      console.log(JSON.stringify(messages, null, 2));
      console.log('=====================================');
      throw new Error(`Invalid messages array: ${validation.errors.join(', ')}`);
    }

    console.log('🤖 [callOpenAI] MESSAGES VALIDATION PASSED');
    console.log('🤖 [callOpenAI] MESSAGES FOR API:');
    console.log('=====================================');
    console.log(JSON.stringify(messages.map((msg, i) => ({
      index: i,
      role: msg.role,
      hasContent: !!msg.content,
      contentLength: msg.content?.length || 0,
      hasToolCalls: !!msg.tool_calls,
      toolCallsCount: msg.tool_calls?.length || 0,
      toolCallId: msg.tool_call_id,
      name: msg.name
    })), null, 2));
    console.log('=====================================');

    const apiKey = getApiKey();
    if (!apiKey) {
      console.error('🤖 [callOpenAI] OpenAI API key not found');
      return null;
    }

    let lastError: any = null;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        console.log(`🤖 [callOpenAI] ATTEMPT ${attempt + 1}/${retryConfig.maxRetries + 1}`);

        const requestBody: any = {
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.7,
        };

        if (tools && tools.length > 0) {
          requestBody.tools = tools;
          requestBody.tool_choice = 'auto';
          console.log('🤖 [callOpenAI] TOOLS ENABLED:', tools.length);
        }

        console.log('🤖 [callOpenAI] REQUEST BODY SUMMARY:', {
          model: requestBody.model,
          messagesCount: requestBody.messages.length,
          temperature: requestBody.temperature,
          hasTools: !!requestBody.tools,
          toolsCount: requestBody.tools?.length || 0
        });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        console.log('🤖 [callOpenAI] RESPONSE STATUS:', response.status);

        if (!response.ok) {
          const errorBody = await response.text();
          const error = new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
          lastError = error;

          console.error(`🤖 [callOpenAI] API ERROR (Attempt ${attempt + 1}):`, {
            status: response.status,
            errorBody,
            isRetryable: isRetryableError(error, retryConfig)
          });

          // Check if this is a retryable error
          if (attempt < retryConfig.maxRetries && isRetryableError(error, retryConfig)) {
            const delay = calculateDelay(attempt, retryConfig);
            console.log(`🤖 [callOpenAI] RETRYING in ${delay}ms...`);
            await sleep(delay);
            continue;
          } else {
            console.error('🤖 [callOpenAI] NON-RETRYABLE ERROR or MAX RETRIES REACHED');
            throw error;
          }
        }

        const data = await response.json();
        console.log('🤖 [callOpenAI] RESPONSE DATA:', {
          hasChoices: !!data.choices,
          choicesLength: data.choices?.length || 0,
          hasMessage: !!data.choices?.[0]?.message,
          hasContent: !!data.choices?.[0]?.message?.content,
          hasToolCalls: !!data.choices?.[0]?.message?.tool_calls,
          toolCallsCount: data.choices?.[0]?.message?.tool_calls?.length || 0
        });

        if (data.choices?.[0]?.message?.tool_calls) {
          console.log('🤖 [callOpenAI] TOOL CALLS RESPONSE:');
          console.log('=====================================');
          console.log(JSON.stringify(data.choices[0].message.tool_calls, null, 2));
          console.log('=====================================');
          return { tool_calls: data.choices[0].message.tool_calls };
        }

        const content = data.choices?.[0]?.message?.content;
        console.log('🤖 [callOpenAI] CONTENT RESPONSE:', {
          hasContent: !!content,
          contentLength: content?.length || 0,
          contentPreview: content?.substring(0, 100) + (content?.length > 100 ? '...' : '')
        });

        console.log('🤖 [callOpenAI] SUCCESS - returning content response');
        return { content };

      } catch (error) {
        lastError = error;
        console.error(`🤖 [callOpenAI] EXCEPTION (Attempt ${attempt + 1}):`, error);

        // Check if this is a retryable error
        if (attempt < retryConfig.maxRetries && isRetryableError(error, retryConfig)) {
          const delay = calculateDelay(attempt, retryConfig);
          console.log(`🤖 [callOpenAI] RETRYING after exception in ${delay}ms...`);
          await sleep(delay);
          continue;
        } else {
          console.error('🤖 [callOpenAI] FINAL FAILURE - no more retries');
          break;
        }
      }
    }

    console.error('🤖 [callOpenAI] ALL RETRIES EXHAUSTED:', lastError);
    return null;
  };

  /**
   * Identify the topic/context of a conversation
   */
  const identifyConversationContext = async (messages: ChatMessage[], workoutId?: string) => {
    return identifyChatContext(messages, workoutId);
  };

  /**
   * Generate AI response to user message using context
   */
  const generateAIResponse = async (
    messages: { role: string; content: string | null; tool_calls?: OpenAIToolCall[]; tool_call_id?: string; name?: string }[],
    tools?: any[]
  ): Promise<OpenAIResponse | null> => {
    console.log('🎯 [generateAIResponse] FUNCTION CALLED');
    console.log('🎯 [generateAIResponse] DELEGATING TO callOpenAI...');
    return callOpenAI(messages, tools);
  };

  return {
    getApiKey,
    callOpenAI,
    identifyConversationContext,
    generateAIResponse,
  };
}
