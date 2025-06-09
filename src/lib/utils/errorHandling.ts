/**
 * Centralized error handling utilities for the app
 */

export interface ErrorContext {
  component: string;
  function: string;
  userId?: string;
  additionalData?: Record<string, any>;
}

export interface RetryableError {
  isRetryable: boolean;
  shouldFallback: boolean;
  retryDelay?: number;
  fallbackMessage?: string;
}

/**
 * Check if an error should be retried based on its characteristics
 */
export const analyzeError = (error: any, context: ErrorContext): RetryableError => {
  const errorString = String(error).toLowerCase();
  const errorMessage = error?.message?.toLowerCase() || '';
  
  // Network/API errors that should be retried
  const retryablePatterns = [
    '429', '500', '502', '503', '504', // HTTP status codes
    'rate limit', 'timeout', 'network', 'econnreset', 'etimedout', 'enotfound',
    'socket hang up', 'request failed', 'fetch failed'
  ];
  
  // Conversation/tool call errors that should use fallback
  const fallbackPatterns = [
    'tool_call_id', 'tool_calls', 'invalid_request_error',
    'missing response messages', 'conversation history', 'unresolved tool calls'
  ];
  
  // API key or auth errors - not retryable
  const nonRetryablePatterns = [
    'api key', 'unauthorized', '401', '403', 'authentication',
    'invalid api key', 'quota exceeded'
  ];
  
  console.log(`🔍 [analyzeError] ANALYZING ERROR in ${context.component}.${context.function}:`, {
    errorString: errorString.substring(0, 200),
    errorMessage: errorMessage.substring(0, 200),
    userId: context.userId,
    additionalData: context.additionalData
  });
  
  // Check for specific tool call contamination errors
  if (errorString.includes('unresolved tool calls') || errorMessage.includes('unresolved tool calls')) {
    console.log(`🔍 [analyzeError] TOOL CALL CONTAMINATION detected`);
    return {
      isRetryable: false,
      shouldFallback: true,
      fallbackMessage: "I had some technical issues with our conversation history. Let's start fresh - how can I help you?"
    };
  }
  
  // Check for non-retryable errors first
  for (const pattern of nonRetryablePatterns) {
    if (errorString.includes(pattern) || errorMessage.includes(pattern)) {
      console.log(`🔍 [analyzeError] NON-RETRYABLE ERROR detected: ${pattern}`);
      return {
        isRetryable: false,
        shouldFallback: true,
        fallbackMessage: "I'm having trouble connecting to my AI systems right now. Please try again in a few minutes."
      };
    }
  }
  
  // Check for fallback-only errors
  for (const pattern of fallbackPatterns) {
    if (errorString.includes(pattern) || errorMessage.includes(pattern)) {
      console.log(`🔍 [analyzeError] FALLBACK ERROR detected: ${pattern}`);
      return {
        isRetryable: false,
        shouldFallback: true,
        fallbackMessage: "I ran into a technical issue processing that request. Let me try a different approach."
      };
    }
  }
  
  // Check for retryable errors
  for (const pattern of retryablePatterns) {
    if (errorString.includes(pattern) || errorMessage.includes(pattern)) {
      console.log(`🔍 [analyzeError] RETRYABLE ERROR detected: ${pattern}`);
      return {
        isRetryable: true,
        shouldFallback: false,
        retryDelay: pattern === '429' ? 5000 : 2000 // Longer delay for rate limits
      };
    }
  }
  
  // Default: treat as retryable with fallback
  console.log(`🔍 [analyzeError] UNKNOWN ERROR - treating as retryable with fallback`);
  return {
    isRetryable: true,
    shouldFallback: true,
    retryDelay: 2000,
    fallbackMessage: "Something went wrong. Let me try again."
  };
};

/**
 * Create contextual error messages based on the operation that failed
 */
export const getContextualErrorMessage = (
  operation: 'chat' | 'plan_adjustment' | 'feedback' | 'gear' | 'voice' | 'general',
  error: any
): string => {
  const errorAnalysis = analyzeError(error, { component: 'error', function: 'getContextualErrorMessage' });
  
  if (errorAnalysis.fallbackMessage) {
    return errorAnalysis.fallbackMessage;
  }
  
  switch (operation) {
    case 'chat':
      return "I'm having trouble responding right now. Please try asking again.";
    case 'plan_adjustment':
      return "I couldn't update your training plan right now. Please try again or adjust it manually.";
    case 'feedback':
      return "I wasn't able to record that feedback. Please try again.";
    case 'gear':
      return "I can't access gear recommendations right now. Please check back later.";
    case 'voice':
      return "There's an issue with voice processing. Please try typing your message instead.";
    default:
      return "Something went wrong. Please try again in a moment.";
  }
};

/**
 * Log error with structured context for easier debugging
 */
export const logError = (error: any, context: ErrorContext): void => {
  const timestamp = new Date().toISOString();
  
  console.error(`❌ [ERROR] ${timestamp} - ${context.component}.${context.function}`);
  console.error('❌ [ERROR] Context:', {
    userId: context.userId,
    component: context.component,
    function: context.function,
    additionalData: context.additionalData
  });
  console.error('❌ [ERROR] Error details:', {
    message: error?.message,
    stack: error?.stack?.split('\n').slice(0, 5), // First 5 lines of stack
    name: error?.name,
    code: error?.code
  });
  
  // Log full error object for debugging (but truncated)
  const errorStr = String(error);
  if (errorStr.length > 500) {
    console.error('❌ [ERROR] Full error (truncated):', errorStr.substring(0, 500) + '...');
  } else {
    console.error('❌ [ERROR] Full error:', errorStr);
  }
};

/**
 * Standard error handler that combines logging and user-friendly messaging
 */
export const handleError = (
  error: any,
  context: ErrorContext,
  operation: 'chat' | 'plan_adjustment' | 'feedback' | 'gear' | 'voice' | 'general' = 'general'
): { shouldRetry: boolean; userMessage: string; retryDelay?: number } => {
  
  logError(error, context);
  const analysis = analyzeError(error, context);
  const userMessage = getContextualErrorMessage(operation, error);
  
  console.log(`🔧 [handleError] ERROR HANDLING RESULT:`, {
    shouldRetry: analysis.isRetryable,
    shouldFallback: analysis.shouldFallback,
    retryDelay: analysis.retryDelay,
    userMessage
  });
  
  return {
    shouldRetry: analysis.isRetryable,
    userMessage,
    retryDelay: analysis.retryDelay
  };
}; 