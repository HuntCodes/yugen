import { useState, useEffect, useRef } from 'react';

import { useMessageFormatting } from './useMessageFormatting';
import { useMessageStorage } from './useMessageStorage';
import { useMessageAnalysis, OpenAIResponse, OpenAIToolCall } from './useMessageAnalysis';
import { ChatState, ChatMessage, MessageHandlerParams, SESSION_TIME_WINDOW } from './useMessageTypes';
import { usePlanAdjustment, PlanUpdate } from './usePlanAdjustment';
import { executeWorkoutAdjustment } from '../../services/plan/planService';
import { environment } from '../../config/environment';
import { addOrUpdateUserTrainingFeedback, UserTrainingFeedbackData, fetchUserTrainingFeedback } from '../../services/feedback/feedbackService';
import { WeatherForecast } from '../../services/weather/weatherService';
import { handleError, logError } from '../../lib/utils/errorHandling';

const MAX_CONVERSATION_HISTORY_MESSAGES = 10; // Number of recent messages to include

// Define the structure for the arguments our function expects
interface ProposeWorkoutAdjustmentArgs {
  session_id?: string;
  original_date?: string; // YYYY-MM-DD
  workout_type?: string;
  adjustment_details: {
    new_date?: string; // YYYY-MM-DD
    new_day_description?: string;
    new_distance?: number;
    new_duration_minutes?: number;
    intensity_change?: 'easier' | 'harder' | 'same';
    action?: 'update' | 'delete' | 'suggest_new';
    reason: string;
    user_query: string;
  };
  coach_suggestion_to_user: string;
}

interface PendingToolCallAdjustment {
  tool_call_id: string;
  function_name: string;
  original_user_message: string; // Store the original user message that triggered the tool call
  parsed_args: ProposeWorkoutAdjustmentArgs;
  ai_message_with_tool_call: {
    role: 'assistant';
    content: string | null;
    tool_calls: OpenAIToolCall[];
  }; // Store the AI message that contained the tool call
}

// Tool interfaces - these should match the parameters defined in the tools below
interface ExecuteWorkoutAdjustmentArgs {
  session_id?: string;
  original_date?: string;
  workout_type?: string;
  adjustment_details: {
    new_date?: string;
    new_day_description?: string;
    new_distance?: number;
    new_duration_minutes?: number;
    new_suggested_location?: string;
    intensity_change?: 'easier' | 'harder' | 'same';
    action?: 'update' | 'delete'; // Removed 'suggest_new' as AI will confirm then execute
    reason: string;
    user_query: string;
  };
  // coach_suggestion_to_user is removed as AI will now confirm verbally then call tool
}

interface AddUserTrainingFeedbackArgs extends Partial<UserTrainingFeedbackData> {
  // user_id will be added by the calling function, not expected from AI
  // week_start_date is optional, AI can provide or it defaults in service
}

interface PendingToolCallConfirmation {
  tool_name: string;
  tool_call_id: string; // From AI
  original_user_message: string;
  ai_message_with_tool_call: {
    role: 'assistant';
    content: string | null;
    tool_calls: OpenAIToolCall[];
  };
  parsed_args: ExecuteWorkoutAdjustmentArgs | AddUserTrainingFeedbackArgs; // Arguments AI wants to run
  coach_suggestion_to_user: string; // The message AI used to ask for confirmation
}

/**
 * Hook for processing chat messages, delegating to specialized modules
 */
export function useMessageProcessing() {
  // State management
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatState, setChatState] = useState<'idle' | 'processing'>('idle');
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingToolCallConfirmation | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [currentWorkoutId, setCurrentWorkoutId] = useState<string | undefined>(undefined);
  const [currentTopic, setCurrentTopic] = useState<string | undefined>(undefined);

  // Import utility functions from other hooks
  const {
    hasPlanFeedback,
    isConfirmingPlanUpdate,
    isRejectingPlanUpdate,
    handlePlanAdjustment,
    applyPlanChangeToSupabase,
    generateConfirmationMessage,
  } = usePlanAdjustment();

  const {
    formatTrainingPlanForPrompt,
    formatChatSummariesForPrompt,
    formatPlanAdjustmentPrompt,
    buildSystemPrompt,
    buildUserContextString,
    getGearRecommendations,
  } = useMessageFormatting();

  const { saveAndNotify, saveErrorMessage, getChatContext, summarizeAndSaveChat } =
    useMessageStorage();

  const { generateAIResponse, identifyConversationContext } = useMessageAnalysis();

  // const { executeWorkoutAdjustment } = usePlanService(); // Removed incorrect hook usage

  /**
   * Clean conversation history to remove incomplete tool call sequences
   * This prevents failed tool calls from contaminating future AI interactions
   */
  const cleanConversationHistory = (messages: ChatMessage[]): ChatMessage[] => {
    const cleaned: ChatMessage[] = [];
    let i = 0;
    
    while (i < messages.length) {
      const msg = messages[i];
      
      // Check if this is an assistant message with tool calls
      if ((msg as any).role === 'assistant' && (msg as any).tool_calls) {
        const toolCalls = (msg as any).tool_calls;
        let allToolCallsResolved = true;
        
        // Look ahead to see if all tool calls are resolved
        for (const toolCall of toolCalls) {
          let foundResponse = false;
          for (let j = i + 1; j < messages.length; j++) {
            const nextMsg = messages[j];
            if ((nextMsg as any).role === 'tool' && (nextMsg as any).tool_call_id === toolCall.id) {
              foundResponse = true;
              break;
            }
            // Stop looking if we hit another assistant message or user message
            if ((nextMsg as any).role === 'assistant' || nextMsg.sender === 'user') {
              break;
            }
          }
          if (!foundResponse) {
            allToolCallsResolved = false;
            break;
          }
        }
        
        if (allToolCallsResolved) {
          // Include this complete tool call sequence
          cleaned.push(msg);
          // Skip ahead to include all related tool responses
          i++;
          while (i < messages.length && ((messages[i] as any).role === 'tool')) {
            cleaned.push(messages[i]);
            i++;
          }
          // Include the final assistant response if it exists
          if (i < messages.length && ((messages[i] as any).role === 'assistant' || messages[i].sender === 'coach')) {
            cleaned.push(messages[i]);
            i++;
          }
        } else {
          console.log('🧹 [cleanConversationHistory] REMOVING incomplete tool call sequence');
          // Skip this incomplete sequence entirely
          i++;
          // Skip any orphaned tool responses that follow
          while (i < messages.length && (messages[i] as any).role === 'tool') {
            console.log('🧹 [cleanConversationHistory] REMOVING orphaned tool response');
            i++;
          }
        }
      } else {
        // Regular message, include it
        cleaned.push(msg);
        i++;
      }
    }
    
    console.log(`🧹 [cleanConversationHistory] CLEANED: ${messages.length} → ${cleaned.length} messages`);
    return cleaned;
  };

  // Define the tool for OpenAI
  const executeWorkoutAdjustmentTool = {
    type: 'function' as const,
    function: {
      name: 'execute_workout_adjustment',
      description:
        "Executes an adjustment to a scheduled workout (e.g., change date, distance, duration, location, delete). This action modifies the user's plan immediately once called. For location changes, use new_suggested_location parameter. Gather all necessary details first.",
      parameters: {
        type: 'object' as const,
        properties: {
          session_id: {
            type: 'string',
            description: 'The ID of the workout session to modify. Preferred for accuracy.',
          },
          original_date: {
            type: 'string',
            format: 'date',
            description: 'The original date (YYYY-MM-DD) of the workout if session_id is unknown.',
          },
          workout_type: {
            type: 'string',
            description: "Type of workout (e.g., 'Easy Run', 'Rest Day') if session_id is unknown.",
          },
          adjustment_details: {
            type: 'object' as const,
            properties: {
              new_date: { type: 'string', format: 'date', description: 'New date (YYYY-MM-DD).' },
              new_distance: {
                type: 'number',
                description: "New distance (in user's preferred units).",
              },
              new_duration_minutes: { type: 'number', description: 'New duration in minutes.' },
              new_suggested_location: {
                type: 'string',
                description:
                  "New suggested training location for the workout. Use proper capitalization (e.g., 'The Tan', 'Royal Park', 'Botanical Gardens').",
              },
              intensity_change: {
                type: 'string',
                enum: ['easier', 'harder', 'same'],
                description: 'Intensity change.',
              },
              action: {
                type: 'string',
                enum: ['update', 'delete'],
                description: "Action: 'update' or 'delete'.",
              },
              reason: { type: 'string', description: "User's reason for change." },
              user_query: { type: 'string', description: 'Original user query requesting change.' },
            },
            required: ['action', 'reason', 'user_query'],
          },
        },
        required: ['adjustment_details'],
      },
    },
  };

  const addUserTrainingFeedbackTool = {
    type: 'function' as const,
    function: {
      name: 'add_user_training_feedback',
      description: "Records user training feedback in the appropriate category. Use this to capture BOTH persistent preferences that should carry forward to all future training plans AND weekly contextual feedback that applies only to recent training.",
      parameters: {
        type: 'object' as const,
        properties: {
          week_start_date: {
            type: 'string',
            format: 'date',
            description: 'Week start date (YYYY-MM-DD). Defaults to current week if not provided.',
          },
          prefers: {
            type: 'object',
            description: "PERSISTENT SCHEDULING PREFERENCES that should apply to ALL future training plans. Use PLAIN ENGLISH keys for clarity. Examples: {'I prefer long runs on Sundays': true}, {'I like workouts on Tuesdays and Fridays': true}, {'I prefer morning runs': true}, {'I don't like back-to-back hard days': true}. These will be used for EVERY weekly plan generation.",
            additionalProperties: true
          },
          struggling_with: {
            type: 'object',
            description: "ONGOING STRUGGLES that should influence future plans. Use for: persistent issues ('hills_difficulty': true), ongoing challenges ('motivation_mondays': 'low'). These carry forward to help plan adjustments.",
            additionalProperties: true
          },
          feedback_summary: {
            type: 'string',
            description: 'WEEKLY CONTEXTUAL FEEDBACK for recent training only. Use for: temporary conditions (sick last week, feeling tired, travel plans), specific workout feedback (tempo felt hard, long run went well). This is for context, not persistent preferences.',
          },
          raw_data: {
            type: 'object',
            description: 'Any other relevant structured data from the conversation.',
            additionalProperties: true
          },
        },
        // No required fields - AI can update any combination
      },
    },
  };

  const getGearRecommendationsTool = {
    type: 'function' as const,
    function: {
      name: 'get_gear_recommendations',
      description:
        'Fetches running gear recommendations when discussing weather-appropriate clothing, footwear, or equipment. Use this when the user asks about what to wear, gear for weather conditions, or when providing weather-based training advice that would benefit from specific product recommendations.',
      parameters: {
        type: 'object' as const,
        properties: {
          category: {
            type: 'string',
            enum: ['Shoes', 'Apparel', 'All'],
            description:
              "Filter by product category. Use 'Shoes' for footwear, 'Apparel' for clothing, or 'All' for everything.",
          },
          weather_context: {
            type: 'string',
            description:
              "Brief description of weather conditions to help contextualize recommendations (e.g., 'cold and rainy', 'hot and sunny', 'windy conditions').",
          },
          activity_type: {
            type: 'string',
            description:
              "Type of activity the gear is for (e.g., 'easy run', 'long run', 'speed workout', 'general training').",
          },
        },
        required: [],
      },
    },
  };

  /**
   * Handle a regular chat message (not plan-related)
   */
  const handleRegularChatMessage = async ({
    message,
    userId,
    profile,
    trainingPlan,
    weatherData,
    onMessageResponse,
    onPlanAdjusted,
  }: MessageHandlerParams) => {
    setIsTyping(true);
    setError(null); // Clear previous errors
    try {
      const userChatMessage: ChatMessage = { sender: 'user', message };
      
      // Clean the conversation history to remove any incomplete tool call sequences
      const cleanedCurrentMessages = cleanConversationHistory(currentMessages);
      console.log('🧹 [handleRegularChatMessage] USING CLEANED HISTORY:', {
        originalLength: currentMessages.length,
        cleanedLength: cleanedCurrentMessages.length
      });
      
      // Add user's new message to the cleaned history
      const updatedMessagesHistoryForThisTurn = [...cleanedCurrentMessages, userChatMessage];

      const trainingPlanText = formatTrainingPlanForPrompt(trainingPlan);
      const summariesText = ''; // Summaries deprecated for this part

      const systemPromptContent = await buildSystemPrompt(
        trainingPlan,
        profile?.coach_id,
        weatherData
      );

      // Construct the messages payload for the AI
      // The userContextString will be prepended to the latest user message content
      const userTrainingFeedback = await fetchUserTrainingFeedback(userId); // Fetch feedback
      const userContextString = buildUserContextString(
        profile,
        trainingPlan,
        cleanedCurrentMessages.slice(-MAX_CONVERSATION_HISTORY_MESSAGES),
        userTrainingFeedback.data
      );

      const messagesForAI: {role: string, content: string | null, tool_calls?: OpenAIToolCall[]}[] = [
        { role: 'system', content: systemPromptContent }
      ];

      const historyToMap = [...cleanedCurrentMessages, { sender: 'user', message }]; // Include current message for history mapping
      const historySlice = historyToMap
        .slice(-MAX_CONVERSATION_HISTORY_MESSAGES) // Take last N, including current user message
        .map((msg, index) => {
          const anyMsg = msg as any;
          let content = '';

          // Prepend userContextString to the LATEST user message in the mapped history
          // This assumes the latest message in historyToMap is the current user's message.
          if (index === historyToMap.length - 1 && anyMsg.sender === 'user') {
            content = `${userContextString}\n\nUser Query: ${anyMsg.message}`;
          } else {
            content = anyMsg.message || '';
          }

          if (anyMsg.role === 'assistant' && anyMsg.hasOwnProperty('tool_calls')) {
            return { role: 'assistant', content: anyMsg.content, tool_calls: anyMsg.tool_calls };
          } else if (anyMsg.role === 'tool' && anyMsg.hasOwnProperty('tool_call_id')) {
            return {
              role: 'tool',
              tool_call_id: anyMsg.tool_call_id,
              content: anyMsg.content,
              name: anyMsg.name,
            };
          } else if (anyMsg.sender) {
            return { role: anyMsg.sender === 'user' ? 'user' : 'assistant', content };
          }
          console.warn('Skipping unexpected message structure in history for AI:', msg);
          return null;
        })
        .filter(Boolean);

      messagesForAI.push(...(historySlice as any[]));

      // Pass the constructed messages array to generateAIResponse with ALL tools
      const aiResponseObject = await generateAIResponse(messagesForAI, [
        executeWorkoutAdjustmentTool,
        addUserTrainingFeedbackTool,
        getGearRecommendationsTool,
      ]);

      // Use cleaned messages as the base for final history
      let finalMessagesForUIAndHistory = [
        ...cleanedCurrentMessages,
        { sender: 'user', message: message } as ChatMessage,
      ];

      if (!aiResponseObject) {
        // Check if AI response is null (e.g. API key issue, network error)
        console.error('Failed to get AI response object.');
        throw new Error('No AI response received - possible API key or network issue');
      }

      if (aiResponseObject.tool_calls && aiResponseObject.tool_calls.length > 0) {
        console.log(`🔧 [useMessageProcessing] AI MADE ${aiResponseObject.tool_calls.length} TOOL CALLS`);
        
        // Ensure content is string | null, not undefined
        const aiMessageContent = aiResponseObject.content || null;
        const aiMessageWithToolCall = {
          role: 'assistant' as const,
          content: aiMessageContent,
          tool_calls: aiResponseObject.tool_calls,
        };

        // Process ALL tool calls, not just the first one
        const toolResponseMessages: any[] = [];
        let allToolsSuccessful = true;
        let finalAICoachMessageText: string = '';

        // Execute all tool calls
        for (let i = 0; i < aiResponseObject.tool_calls.length; i++) {
          const toolCall = aiResponseObject.tool_calls[i];
          console.log(`🔧 [useMessageProcessing] PROCESSING TOOL CALL ${i + 1}/${aiResponseObject.tool_calls.length}: ${toolCall.function.name}`);
          
          let toolResultContent: any;
          
          try {
            const parsedArgs = JSON.parse(toolCall.function.arguments);
            
            if (toolCall.function.name === 'execute_workout_adjustment') {
              console.log(
                `[useMessageProcessing] AI calling 'execute_workout_adjustment' (${i + 1}/${aiResponseObject.tool_calls.length}) with args:`,
                JSON.stringify(parsedArgs, null, 2)
              );

              // Directly execute the adjustment
              const toolArgs = parsedArgs as ExecuteWorkoutAdjustmentArgs;
              // Defensive structuring for adjustment_details
              if (!toolArgs.adjustment_details)
                toolArgs.adjustment_details = {} as ExecuteWorkoutAdjustmentArgs['adjustment_details'];
              if (!toolArgs.adjustment_details.action) toolArgs.adjustment_details.action = 'update';
              if (!toolArgs.adjustment_details.reason)
                toolArgs.adjustment_details.reason =
                  (toolArgs as any).reason || 'User requested adjustment';
              if (!toolArgs.adjustment_details.user_query)
                toolArgs.adjustment_details.user_query = (toolArgs as any).user_query || message;

              const result = await executeWorkoutAdjustment(userId, toolArgs);
              if (result.success) {
                onPlanAdjusted?.();
              }
              toolResultContent = {
                status: result.success ? 'success' : 'error',
                details: result.message,
                executed_adjustment: result.success ? toolArgs.adjustment_details : undefined,
              };
            } else if (toolCall.function.name === 'add_user_training_feedback') {
              console.log(`📝 [useMessageProcessing] AI calling 'add_user_training_feedback' (${i + 1}/${aiResponseObject.tool_calls.length})`);
              console.log('📝 [useMessageProcessing] PARSED ARGUMENTS:');
              console.log('=====================================');
              console.log(JSON.stringify(parsedArgs, null, 2));
              console.log('=====================================');
              
              const result = await addOrUpdateUserTrainingFeedback(
                userId,
                parsedArgs as AddUserTrainingFeedbackArgs
              );
              
              console.log('📝 [useMessageProcessing] FEEDBACK SERVICE RESULT:', {
                hasError: !!result.error,
                hasData: !!result.data,
                errorMessage: result.error?.message || null,
                resultDataId: result.data?.id || null,
                resultWeekStart: result.data?.week_start_date || null
              });
              
              toolResultContent = {
                status: result.error ? 'error' : 'success',
                details: result.error ? result.error.message : 'Feedback recorded.',
              };
            } else if (toolCall.function.name === 'get_gear_recommendations') {
              console.log(
                `[useMessageProcessing] AI calling 'get_gear_recommendations' (${i + 1}/${aiResponseObject.tool_calls.length}) with args:`,
                JSON.stringify(parsedArgs, null, 2)
              );
              const gearResult = getGearRecommendations(
                parsedArgs.category,
                parsedArgs.weather_context,
                parsedArgs.activity_type
              );
              toolResultContent = {
                status: 'success',
                details: 'Gear recommendations retrieved successfully',
                data: gearResult,
              };
            } else {
              console.warn(`Unhandled tool call: ${toolCall.function.name}`);
              toolResultContent = {
                status: 'error',
                details: `Unknown tool: ${toolCall.function.name}`,
              };
            }
          } catch (toolError) {
            console.error(`🔧 [useMessageProcessing] TOOL EXECUTION ERROR for ${toolCall.function.name}:`, toolError);
            
            const toolErrorHandling = handleError(toolError, {
              component: 'useMessageProcessing',
              function: `tool_${toolCall.function.name}`,
              userId,
              additionalData: { toolName: toolCall.function.name, toolCallIndex: i }
            }, toolCall.function.name === 'execute_workout_adjustment' ? 'plan_adjustment' : 
               toolCall.function.name === 'add_user_training_feedback' ? 'feedback' : 'gear');
            
            toolResultContent = {
              status: 'error',
              details: toolErrorHandling.userMessage,
            };
            allToolsSuccessful = false;
          }

          // Create tool response message for this specific tool call
          const toolResponseMessage = {
            role: 'tool' as const,
            name: toolCall.function.name,
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResultContent),
          };
          
          toolResponseMessages.push(toolResponseMessage);
          console.log(`✅ [useMessageProcessing] TOOL CALL ${i + 1} COMPLETED: ${toolCall.function.name} -> ${toolResultContent.status}`);
        }

        console.log(`🔄 [useMessageProcessing] ALL ${aiResponseObject.tool_calls.length} TOOL CALLS COMPLETED`);
        console.log('🔄 [useMessageProcessing] PREPARING FOLLOW-UP AI CALL');
        console.log('🔄 [useMessageProcessing] TOOL RESPONSE MESSAGES COUNT:', toolResponseMessages.length);

        // Construct messages for follow-up with ALL tool responses
        const minimalMessagesForFollowUp = [
          { role: 'system', content: systemPromptContent }, // System prompt
          { role: 'user', content: message }, // The user message that triggered this AI tool call sequence
          aiMessageWithToolCall, // The AI's message that contained ALL the tool_calls
          ...toolResponseMessages, // ALL the tool response messages
        ];

        console.log('🔄 [useMessageProcessing] FOLLOW-UP MESSAGES STRUCTURE:');
        console.log('=====================================');
        console.log(JSON.stringify(minimalMessagesForFollowUp.map((msg, i) => ({
          index: i,
          role: msg.role,
          hasContent: !!msg.content,
          contentLength: msg.content?.length || 0,
          hasToolCalls: !!(msg as any).tool_calls,
          toolCallsCount: (msg as any).tool_calls?.length || 0,
          toolCallId: (msg as any).tool_call_id,
          name: (msg as any).name
        })), null, 2));
        console.log('=====================================');

        let followUpAiResponse: any = null;
        let followUpAttempts = 0;
        const maxFollowUpAttempts = 2;

        // Try to get follow-up response with retry logic for conversation issues
        while (followUpAttempts < maxFollowUpAttempts && !followUpAiResponse?.content) {
          followUpAttempts++;
          console.log(`🔄 [useMessageProcessing] FOLLOW-UP ATTEMPT ${followUpAttempts}/${maxFollowUpAttempts}`);
          
          try {
            followUpAiResponse = await generateAIResponse(minimalMessagesForFollowUp);
            
            if (followUpAiResponse?.content) {
              console.log('🔄 [useMessageProcessing] FOLLOW-UP SUCCESS:', {
                hasContent: true,
                contentLength: followUpAiResponse.content.length,
                contentPreview: followUpAiResponse.content.substring(0, 100) + '...'
              });
              break;
            } else {
              console.warn(`🔄 [useMessageProcessing] FOLLOW-UP ATTEMPT ${followUpAttempts} - No content received`);
            }
          } catch (error) {
            console.error(`🔄 [useMessageProcessing] FOLLOW-UP ATTEMPT ${followUpAttempts} FAILED:`, error);
            
            // If this is a conversation history issue, try with simplified messages
            if (followUpAttempts < maxFollowUpAttempts && 
                (String(error).includes('tool_call_id') || String(error).includes('tool_calls'))) {
              
              console.log('🔄 [useMessageProcessing] DETECTED TOOL CALL HISTORY ISSUE - SIMPLIFYING...');
              
              // Try with a simpler message structure
              const simplifiedMessages = [
                { role: 'system', content: `You are ${profile?.coach_id || 'a helpful'} running coach. Multiple tool functions were just executed successfully. Provide a brief, natural response to acknowledge the completion.` },
                { role: 'user', content: `I requested: ${message}` },
                { role: 'assistant', content: `I've processed your request and made the necessary updates to your training plan and recorded your preferences. How can I help you further?` }
              ];
              
              console.log('🔄 [useMessageProcessing] TRYING SIMPLIFIED MESSAGES...');
              minimalMessagesForFollowUp.splice(0, minimalMessagesForFollowUp.length, ...simplifiedMessages);
            }
          }
        }

        finalAICoachMessageText = followUpAiResponse?.content || '';

        if (!finalAICoachMessageText) {
          console.warn('🔄 [useMessageProcessing] ALL FOLLOW-UP ATTEMPTS FAILED - USING FALLBACK');
          
          // Create a summary message based on what was accomplished
          const adjustmentCount = toolResponseMessages.filter(msg => msg.name === 'execute_workout_adjustment').length;
          const feedbackCount = toolResponseMessages.filter(msg => msg.name === 'add_user_training_feedback').length;
          const gearCount = toolResponseMessages.filter(msg => msg.name === 'get_gear_recommendations').length;
          
          if (allToolsSuccessful) {
            let summary = "Great! I've";
            if (adjustmentCount > 0) {
              summary += ` updated ${adjustmentCount} workout${adjustmentCount > 1 ? 's' : ''} in your plan`;
            }
            if (feedbackCount > 0) {
              summary += `${adjustmentCount > 0 ? ' and' : ''} recorded your training preferences`;
            }
            if (gearCount > 0) {
              summary += `${(adjustmentCount > 0 || feedbackCount > 0) ? ' and' : ''} found gear recommendations`;
            }
            finalAICoachMessageText = summary + ". Your plan is all set!";
          } else {
            finalAICoachMessageText = "I've processed most of your requests, though there were some issues with a few items. Please let me know if you need any adjustments.";
          }
        }
        
        console.log('🔄 [useMessageProcessing] FINAL AI MESSAGE:', {
          hasMessage: !!finalAICoachMessageText,
          messageLength: finalAICoachMessageText.length,
          messagePreview: finalAICoachMessageText.substring(0, 100) + (finalAICoachMessageText.length > 100 ? '...' : '')
        });
        
        // At this point, finalAICoachMessageText is guaranteed to be a string.
        const finalAICoachMessage: ChatMessage = {
          sender: 'coach',
          message: finalAICoachMessageText,
          timestamp: Date.now(), // Add timestamp for proper sorting
        };
        await saveAndNotify(finalAICoachMessage, userId, onMessageResponse);
        finalMessagesForUIAndHistory.push(
          aiMessageWithToolCall as any,
          ...toolResponseMessages as any[],
          finalAICoachMessage
        );
      } else if (aiResponseObject.content) {
        const aiResponseMessage: ChatMessage = {
          sender: 'coach',
          message: aiResponseObject.content,
          timestamp: Date.now(), // Add timestamp for proper sorting
        };
        await saveAndNotify(aiResponseMessage, userId, onMessageResponse);
        finalMessagesForUIAndHistory = [...finalMessagesForUIAndHistory, aiResponseMessage];
      } else {
        throw new Error('AI response had neither content nor tool_calls.');
      }

      setCurrentMessages(finalMessagesForUIAndHistory);
    } catch (error) {
      console.error('Error in regular chat message handler:', error);
      
      // Use centralized error handling
      const errorHandling = handleError(error, {
        component: 'useMessageProcessing',
        function: 'handleRegularChatMessage',
        userId,
        additionalData: { messageLength: message.length }
      }, 'chat');
      
      // Re-throw the error to be handled by the retry logic in processUserMessage
      throw new Error(errorHandling.userMessage);
    }
  };

  /**
   * Main function to process user messages
   */
  const processUserMessage = async ({
    message,
    userId,
    profile,
    trainingPlan,
    weatherData,
    onMessageResponse,
    onPlanAdjusted,
  }: MessageHandlerParams) => {
    setIsTyping(true);
    setError(null);
    setChatState('processing');

    const errorContext = {
      component: 'useMessageProcessing',
      function: 'processUserMessage',
      userId,
      additionalData: { messageLength: message.length, hasProfile: !!profile, hasTrainingPlan: !!trainingPlan }
    };

    let attemptCount = 0;
    const maxAttempts = 2;

    while (attemptCount < maxAttempts) {
      attemptCount++;
      
      try {
        console.log(`🔄 [processUserMessage] ATTEMPT ${attemptCount}/${maxAttempts}`);
        
        await handleRegularChatMessage({
          message,
          userId,
          profile,
          trainingPlan,
          weatherData,
          onMessageResponse,
          onPlanAdjusted,
        });
        
        // Success - break out of retry loop
        console.log(`✅ [processUserMessage] SUCCESS on attempt ${attemptCount}`);
        break;
        
      } catch (error) {
        console.error(`❌ [processUserMessage] ATTEMPT ${attemptCount} FAILED:`, error);
        
        const errorHandling = handleError(error, errorContext, 'chat');
        
        // If this is the last attempt or error is not retryable, show error to user
        if (attemptCount >= maxAttempts || !errorHandling.shouldRetry) {
          console.error(`💥 [processUserMessage] FINAL FAILURE after ${attemptCount} attempts`);
          
          // Check if this is a persistent tool call error - if so, clear conversation state
          if (String(error).includes('tool_call') || String(error).includes('Unresolved tool calls')) {
            console.log('🔄 [processUserMessage] CLEARING CONVERSATION STATE due to persistent tool call errors');
            setCurrentMessages([]);
            await saveErrorMessage(
              "I had some technical issues with our conversation history. Let's start fresh - how can I help you?",
              userId,
              onMessageResponse
            );
          } else {
            await saveErrorMessage(errorHandling.userMessage, userId, onMessageResponse);
          }
          break;
        } else {
          // Wait before retry if specified
          if (errorHandling.retryDelay) {
            console.log(`⏳ [processUserMessage] WAITING ${errorHandling.retryDelay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, errorHandling.retryDelay));
          }
          console.log(`🔄 [processUserMessage] RETRYING... (attempt ${attemptCount + 1})`);
        }
      }
    }

    setChatState('idle');
    setIsTyping(false);
  };

  // Reset current session when conversation has been inactive for the session window
  useEffect(() => {
    const checkSessionTimeout = () => {
      if (currentMessages.length > 0) {
        const lastMessageTime = new Date().getTime() - SESSION_TIME_WINDOW;

        // If no messages in the last 3 days, reset session
        if (lastMessageTime > 0) {
          setCurrentWorkoutId(undefined);
          setCurrentTopic(undefined);
          setCurrentMessages([]);
        }
      }
    };

    // Check every hour
    const interval = setInterval(checkSessionTimeout, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [currentMessages]);

  /**
   * Sets the current workout ID when discussing a specific workout
   */
  const setWorkoutSession = (workoutId: string) => {
    setCurrentWorkoutId(workoutId);
  };

  const clearSessionContext = () => {
    setCurrentWorkoutId(undefined);
    setCurrentTopic(undefined);
    setCurrentMessages([]);
  };

  /**
   * Clear conversation state and start fresh
   */
  const clearConversationState = () => {
    console.log('🔄 [clearConversationState] CLEARING all conversation state');
    setCurrentWorkoutId(undefined);
    setCurrentTopic(undefined);
    setCurrentMessages([]);
    setError(null);
    setPendingConfirmation(null);
  };

  return {
    isTyping,
    error,
    chatState,
    processUserMessage,
    setWorkoutSession,
    clearSessionContext,
    currentMessages, // For UI display
    clearConversationState,
  };
}
