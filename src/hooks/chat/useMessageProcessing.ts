import { useState, useEffect } from 'react';
import { usePlanAdjustment, PlanUpdate } from './usePlanAdjustment';
import { useMessageFormatting } from './useMessageFormatting';
import { useMessageStorage } from './useMessageStorage';
import { useMessageAnalysis, OpenAIResponse, OpenAIToolCall } from './useMessageAnalysis';
import { ChatState, ChatMessage, MessageHandlerParams, SESSION_TIME_WINDOW } from './useMessageTypes';
import { executeWorkoutAdjustment } from '../../services/plan/planService';
import { addOrUpdateUserTrainingFeedback, UserTrainingFeedbackData, fetchUserTrainingFeedback } from '../../services/feedback/feedbackService';

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
  ai_message_with_tool_call: { role: 'assistant', content: string | null, tool_calls: OpenAIToolCall[] }; // Store the AI message that contained the tool call
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
  ai_message_with_tool_call: { role: 'assistant'; content: string | null; tool_calls: OpenAIToolCall[] };
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
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingToolCallConfirmation | null>(null);
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
    generateConfirmationMessage 
  } = usePlanAdjustment();
  
  const {
    formatTrainingPlanForPrompt,
    formatChatSummariesForPrompt,
    formatPlanAdjustmentPrompt,
    buildSystemPrompt,
    buildUserContextString
  } = useMessageFormatting();
  
  const {
    saveAndNotify,
    saveErrorMessage,
    getChatContext,
    summarizeAndSaveChat
  } = useMessageStorage();
  
  const {
    generateAIResponse
  } = useMessageAnalysis();

  // const { executeWorkoutAdjustment } = usePlanService(); // Removed incorrect hook usage

  // Define the tool for OpenAI
  const executeWorkoutAdjustmentTool = {
    type: 'function' as const,
    function: {
      name: 'execute_workout_adjustment',
      description: "Executes an adjustment to a scheduled workout (e.g., change date, distance, delete). This action modifies the user's plan immediately once called. Gather all necessary details first.",
      parameters: {
        type: 'object' as const,
        properties: {
          session_id: { type: 'string', description: "The ID of the workout session to modify. Preferred for accuracy." },
          original_date: { type: 'string', format: 'date', description: "The original date (YYYY-MM-DD) of the workout if session_id is unknown." },
          workout_type: { type: 'string', description: "Type of workout (e.g., 'Easy Run', 'Rest Day') if session_id is unknown." },
          adjustment_details: {
            type: 'object' as const,
            properties: {
              new_date: { type: 'string', format: 'date', description: "New date (YYYY-MM-DD)." },
              new_distance: { type: 'number', description: "New distance (in user's preferred units)." },
              new_duration_minutes: { type: 'number', description: "New duration in minutes." },
              intensity_change: { type: 'string', enum: ['easier', 'harder', 'same'], description: "Intensity change." },
              action: { type: 'string', enum: ['update', 'delete'], description: "Action: 'update' or 'delete'." },
              reason: { type: 'string', description: "User's reason for change." },
              user_query: {type: 'string', description: "Original user query requesting change."}
            },
            required: ['action', 'reason', 'user_query']
          },
        },
        required: ['adjustment_details'] 
      }
    }
  };

  const addUserTrainingFeedbackTool = {
    type: 'function' as const,
    function: {
      name: 'add_user_training_feedback',
      description: "Records or updates the user's training preferences, things they are struggling with, or general feedback summaries for a specific week. This helps in personalizing future training plans.",
      parameters: {
        type: 'object' as const,
        properties: {
          week_start_date: { type: 'string', format: 'date', description: "The start date (YYYY-MM-DD, ideally a Monday) of the week this feedback applies to. If omitted, defaults to the current week." },
          prefers: { type: 'object', description: "JSON object of user preferences (e.g., { preferred_day: 'Saturday', time_of_day: 'morning' }). Merges with existing.", additionalProperties: true },
          struggling_with: { type: 'object', description: "JSON object of things user is struggling with (e.g., { pacing: 'too fast', motivation: 'low on Mondays' }). Merges with existing.", additionalProperties: true },
          feedback_summary: { type: 'string', description: "A text summary of the user's feedback or general feelings about their training for the week." },
          raw_data: { type: 'object', description: "Any other structured data AI wants to save. Merges with existing.", additionalProperties: true }
        },
        // No specific fields are strictly required from the AI, as it can update partially.
      }
    }
  };

  /**
   * Handle a regular chat message (not plan-related)
   */
  const handleRegularChatMessage = async ({
    message,
    userId,
    profile,
    trainingPlan,
    onMessageResponse,
    onPlanAdjusted
  }: MessageHandlerParams) => {
    setIsTyping(true);
    setError(null); // Clear previous errors
    try {
      const userChatMessage: ChatMessage = { sender: 'user', message: message };
      // Add user's new message to the ongoing list of messages for UI and history
      // Note: setCurrentMessages will be called at the end with the full exchange for this turn
      const updatedMessagesHistoryForThisTurn = [...currentMessages, userChatMessage];
      
      const trainingPlanText = formatTrainingPlanForPrompt(trainingPlan);
      const summariesText = ""; // Summaries deprecated for this part
      
      const systemPromptContent = buildSystemPrompt(); // No longer takes profile/plan/summaries directly

      // Construct the messages payload for the AI
      // The userContextString will be prepended to the latest user message content
      const userTrainingFeedback = await fetchUserTrainingFeedback(userId); // Fetch feedback
      const userContextString = buildUserContextString(profile, trainingPlan, currentMessages.slice(-MAX_CONVERSATION_HISTORY_MESSAGES), userTrainingFeedback.data);

      const messagesForAI: Array<{role: string, content: string | null, tool_calls?: OpenAIToolCall[]}> = [
        { role: 'system', content: systemPromptContent }
      ];
      
      const historyToMap = [...currentMessages, { sender: 'user', message }]; // Include current message for history mapping
      const historySlice = historyToMap
        .slice(-MAX_CONVERSATION_HISTORY_MESSAGES) // Take last N, including current user message
        .map((msg, index) => {
          const anyMsg = msg as any;
          let content = "";

          // Prepend userContextString to the LATEST user message in the mapped history
          // This assumes the latest message in historyToMap is the current user's message.
          if (index === historyToMap.length - 1 && anyMsg.sender === 'user') {
            content = `${userContextString}\n\nUser Query: ${anyMsg.message}`;
          } else {
            content = anyMsg.message || "";
          }

          if (anyMsg.role === 'assistant' && anyMsg.hasOwnProperty('tool_calls')) {
            return { role: 'assistant', content: anyMsg.content, tool_calls: anyMsg.tool_calls };
          }
          else if (anyMsg.role === 'tool' && anyMsg.hasOwnProperty('tool_call_id')) {
            return { role: 'tool', tool_call_id: anyMsg.tool_call_id, content: anyMsg.content, name: anyMsg.name };
          }
          else if (anyMsg.sender) { 
            return { role: anyMsg.sender === 'user' ? 'user' : 'assistant', content: content };
          }
          console.warn("Skipping unexpected message structure in history for AI:", msg);
          return null; 
        })
        .filter(Boolean);
      
      messagesForAI.push(...historySlice as any[]); 

      // Pass the constructed messages array to generateAIResponse with BOTH tools
      const aiResponseObject = await generateAIResponse(messagesForAI, [executeWorkoutAdjustmentTool, addUserTrainingFeedbackTool]);
      
      // Moved this here so it includes the user's current message before AI response/tool calls are added
      let finalMessagesForUIAndHistory = [...currentMessages, { sender: 'user', message: message} as ChatMessage];

      if (!aiResponseObject) { // Check if AI response is null (e.g. API key issue, network error)
        console.error("Failed to get AI response object.");
        await saveErrorMessage("Sorry, I couldn't get a response from the coach right now. Please try again later.", userId, onMessageResponse);
        // finalMessagesForUIAndHistory will just have the user message here.
        setCurrentMessages(finalMessagesForUIAndHistory);
        setChatState('idle');
        setIsTyping(false);
        return;
      }

      if (aiResponseObject.tool_calls && aiResponseObject.tool_calls.length > 0) {
        const toolCall = aiResponseObject.tool_calls[0];
        const parsedArgs = JSON.parse(toolCall.function.arguments);
        // Ensure content is string | null, not undefined
        const aiMessageContent = aiResponseObject.content || null;
        const aiMessageWithToolCall = { role: 'assistant' as const, content: aiMessageContent, tool_calls: aiResponseObject.tool_calls };

        let toolResultContent: any;
        let finalAICoachMessageText: string = ""; // Initialize as empty string

        if (toolCall.function.name === 'execute_workout_adjustment') {
            console.log("[useMessageProcessing] AI proposing to call 'execute_workout_adjustment' with args:", JSON.stringify(parsedArgs, null, 2));
            
            // Directly execute the adjustment
            const toolArgs = parsedArgs as ExecuteWorkoutAdjustmentArgs;
            // Defensive structuring for adjustment_details (from previous iterations, might still be useful)
            if (!toolArgs.adjustment_details) toolArgs.adjustment_details = {} as ExecuteWorkoutAdjustmentArgs['adjustment_details'];
            if (!toolArgs.adjustment_details.action) toolArgs.adjustment_details.action = 'update';
            if (!toolArgs.adjustment_details.reason) toolArgs.adjustment_details.reason = (toolArgs as any).reason || "User requested adjustment";
            if (!toolArgs.adjustment_details.user_query) toolArgs.adjustment_details.user_query = (toolArgs as any).user_query || message; // Fallback to current message

            const result = await executeWorkoutAdjustment(userId, toolArgs);
            if (result.success) {
              onPlanAdjusted?.();
            }
            toolResultContent = { status: result.success ? "success" : "error", details: result.message, executed_adjustment: result.success ? toolArgs.adjustment_details : undefined };

        } else if (toolCall.function.name === 'add_user_training_feedback') {
            console.log("[useMessageProcessing] AI proposing to call 'add_user_training_feedback' with args:", JSON.stringify(parsedArgs, null, 2));
            const result = await addOrUpdateUserTrainingFeedback(userId, parsedArgs as AddUserTrainingFeedbackArgs);
            toolResultContent = { status: result.error ? "error" : "success", details: result.error ? result.error.message : "Feedback recorded." };
        } else {
            console.warn(`Unhandled tool call: ${toolCall.function.name}`);
            toolResultContent = { status: "error", details: `Unknown tool: ${toolCall.function.name}` };
        }

        // Common logic for getting AI's follow-up response after any tool call
        const toolResponseMessageForHistory = { role: 'tool' as const, name: toolCall.function.name, tool_call_id: toolCall.id, content: JSON.stringify(toolResultContent) };
        
        // Construct a minimal message history for the follow-up, focusing on the current tool interaction cycle
        const minimalMessagesForFollowUp = [
            { role: 'system', content: systemPromptContent }, // System prompt
            { role: 'user', content: message }, // The user message that triggered this AI tool call sequence
            aiMessageWithToolCall, // The AI's message that contained the tool_call
            toolResponseMessageForHistory // The result of that tool_call
        ];

        const followUpAiResponse = await generateAIResponse(minimalMessagesForFollowUp);
        finalAICoachMessageText = followUpAiResponse?.content || "";

        if (!finalAICoachMessageText) { // Check if it's empty string now
            if (toolResultContent.status === "success") {
                finalAICoachMessageText = toolCall.function.name === 'execute_workout_adjustment' ? "Okay, I've made that adjustment to your plan." : "Got it, I've noted that down.";
            } else {
                finalAICoachMessageText = `There was an issue with that: ${toolResultContent.details || 'Please try again.'}`;
            }
        }
        // At this point, finalAICoachMessageText is guaranteed to be a string.
        const finalAICoachMessage: ChatMessage = { sender: 'coach', message: finalAICoachMessageText };
        await saveAndNotify(finalAICoachMessage, userId, onMessageResponse);
        finalMessagesForUIAndHistory.push(aiMessageWithToolCall as any, toolResponseMessageForHistory as any, finalAICoachMessage);

      } else if (aiResponseObject.content) {
        const aiResponseMessage: ChatMessage = { sender: 'coach', message: aiResponseObject.content };
        await saveAndNotify(aiResponseMessage, userId, onMessageResponse);
        finalMessagesForUIAndHistory = [...finalMessagesForUIAndHistory, aiResponseMessage];
      } else {
        throw new Error("AI response had neither content nor tool_calls.");
      }
      
      setCurrentMessages(finalMessagesForUIAndHistory);
      
    } catch (error) {
      console.error('Error in regular chat message handler:', error);
      await saveErrorMessage(
        "I'm having trouble connecting right now. Please try again in a moment.",
        userId,
        onMessageResponse
      );
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
    onMessageResponse,
    onPlanAdjusted
  }: MessageHandlerParams) => {
    setIsTyping(true);
    setError(null);
    setChatState('processing');

    try {
      await handleRegularChatMessage({ message, userId, profile, trainingPlan, onMessageResponse, onPlanAdjusted });
    } catch (e) {
        console.error("Critical error in processUserMessage:", e);
        await saveErrorMessage("Sorry, a critical error occurred. Please try again later.", userId, onMessageResponse);
    } finally {
        setChatState('idle');
        setIsTyping(false);
    }
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

  return {
    isTyping,
    error,
    chatState,
    processUserMessage,
    setWorkoutSession,
    clearSessionContext,
    currentMessages // For UI display
  };
} 