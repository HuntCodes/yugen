import { useState, useEffect } from 'react';
import { usePlanAdjustment, PlanUpdate } from './usePlanAdjustment';
import { useMessageFormatting } from './useMessageFormatting';
import { useMessageStorage } from './useMessageStorage';
import { useMessageAnalysis } from './useMessageAnalysis';
import { ChatState, ChatMessage, MessageHandlerParams, SESSION_TIME_WINDOW } from './useMessageTypes';

/**
 * Hook for processing chat messages, delegating to specialized modules
 */
export function useMessageProcessing() {
  // State management
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatState, setChatState] = useState<ChatState>('normal');
  const [pendingPlanUpdate, setPendingPlanUpdate] = useState<{update: PlanUpdate, userId: string} | null>(null);
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
    buildSystemPrompt
  } = useMessageFormatting();
  
  const {
    saveAndNotify,
    saveErrorMessage,
    getChatContext,
    summarizeAndSaveChat
  } = useMessageStorage();
  
  const {
    generateAIResponse,
    identifyConversationContext
  } = useMessageAnalysis();

  /**
   * Handle user responses to plan change confirmations
   */
  const handleConfirmationResponse = async ({
    message,
    userId,
    onMessageResponse
  }: Pick<MessageHandlerParams, 'message' | 'userId' | 'onMessageResponse'>) => {
    try {
      // Check if this is a confirmation
      if (isConfirmingPlanUpdate(message)) {
        // Get the pending update
        if (!pendingPlanUpdate || pendingPlanUpdate.userId !== userId) {
          throw new Error('No pending plan update found');
        }
        
        const { update } = pendingPlanUpdate;
        
        // Apply the update to Supabase
        const success = await applyPlanChangeToSupabase(update, userId);
        
        if (!success) {
          throw new Error('Failed to update training plan');
        }
        
        // Generate confirmation message
        const confirmationMessage = generateConfirmationMessage(update);
        
        // Send the confirmation message
        const aiResponse: ChatMessage = { 
          sender: 'coach', 
          message: confirmationMessage
        };
        await saveAndNotify(aiResponse, userId, onMessageResponse);
        
        // Clear the pending update
        setPendingPlanUpdate(null);
        setChatState('normal');
        
      } else if (isRejectingPlanUpdate(message)) {
        // User rejected the update
        const aiResponse: ChatMessage = { 
          sender: 'coach', 
          message: "No problem! Let me know if you'd like to try a different adjustment to your training plan."
        };
        await saveAndNotify(aiResponse, userId, onMessageResponse);
        
        // Clear the pending update
        setPendingPlanUpdate(null);
        setChatState('normal');
        
      } else {
        // Not a clear confirmation or rejection
        const aiResponse: ChatMessage = { 
          sender: 'coach', 
          message: "I'm not sure if you want to proceed with the plan adjustment. Please respond with 'yes' to confirm the changes or 'no' to cancel."
        };
        await saveAndNotify(aiResponse, userId, onMessageResponse);
        
        // Keep awaiting confirmation
        setChatState('awaiting_plan_confirmation');
      }
    } catch (error) {
      console.error('Error handling confirmation response:', error);
      await saveErrorMessage(
        "I encountered an error while updating your training plan. Let me try again. Would you like me to proceed with the changes?",
        userId,
        onMessageResponse
      );
      
      // Keep awaiting confirmation
      setChatState('awaiting_plan_confirmation');
    }
  };

  /**
   * Handle a plan adjustment request from the user
   */
  const handlePlanAdjustmentRequest = async ({
    message,
    userId,
    profile,
    trainingPlan,
    onMessageResponse
  }: MessageHandlerParams) => {
    try {
      // Call the OpenAI API to get plan adjustment suggestion
      const planUpdate = await handlePlanAdjustment(message, profile, trainingPlan);
      
      if (!planUpdate) {
        await saveErrorMessage(
          "I'm having trouble understanding how to adjust your plan. Could you provide more specific details about what you'd like to change?",
          userId,
          onMessageResponse
        );
        return;
      }
      
      console.log('Generated plan update:', planUpdate);
      
      // Store the plan update for confirmation
      setPendingPlanUpdate({
        update: planUpdate,
        userId
      });
      
      // Format a user-friendly message showing the proposed changes
      const confirmationPrompt = formatPlanAdjustmentPrompt(planUpdate, trainingPlan);
      
      const confirmationMessage: ChatMessage = { 
        sender: 'coach', 
        message: confirmationPrompt
      };
      await saveAndNotify(confirmationMessage, userId, onMessageResponse);
      
      // Set the chat state to awaiting confirmation
      setChatState('awaiting_plan_confirmation');
      
    } catch (error) {
      console.error('Error handling plan adjustment request:', error);
      await saveErrorMessage(
        "I'm having trouble processing your request to adjust the training plan. Could you try again later?",
        userId,
        onMessageResponse
      );
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
    onMessageResponse
  }: MessageHandlerParams) => {
    try {
      // Update current messages with user's message
      const userMessage: ChatMessage = { sender: 'user', message };
      const updatedMessages = [...currentMessages, userMessage];
      setCurrentMessages(updatedMessages);
      
      // Identify chat context if not already set
      if (!currentWorkoutId && !currentTopic) {
        const { chatType, topic } = await identifyConversationContext(updatedMessages);
        if (chatType === 'topic' && topic) {
          setCurrentTopic(topic);
        }
      }
      
      // Format the training plan data for the AI prompt
      const trainingPlanText = formatTrainingPlanForPrompt(trainingPlan);
      
      // Get relevant chat summaries for context
      const chatSummaries = await getChatContext(
        userId, 
        currentWorkoutId, 
        currentTopic
      );
      
      // Format chat summaries for the AI prompt
      const summariesText = formatChatSummariesForPrompt(chatSummaries);
      
      // Build the system prompt
      const systemPrompt = buildSystemPrompt(profile, trainingPlanText, summariesText);
      
      // Generate the AI response
      const aiResponseText = await generateAIResponse(message, systemPrompt);
      
      if (!aiResponseText) {
        throw new Error("Failed to generate AI response");
      }
      
      // Create and save the coach's response
      const aiResponse: ChatMessage = { 
        sender: 'coach', 
        message: aiResponseText 
      };
      await saveAndNotify(aiResponse, userId, onMessageResponse);
      
      // Update current messages with AI's response
      setCurrentMessages([...updatedMessages, aiResponse]);
      
      // If we have accumulated enough messages, create and save a summary
      if (updatedMessages.length >= 10) {
        const success = await summarizeAndSaveChat(
          updatedMessages,
          userId,
          currentTopic,
          currentWorkoutId
        );
        
        if (success) {
          // Reset current messages to just the most recent exchange to save memory
          setCurrentMessages(updatedMessages.slice(-2));
          
          // Update session context if it changed from the summary
          const { chatType, topic } = await identifyConversationContext(updatedMessages, currentWorkoutId);
          if (chatType === 'topic' && topic) {
            setCurrentTopic(topic);
          }
        }
      }
      
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
   * Master function to process user messages and determine appropriate handler
   */
  const processUserMessage = async ({
    message, 
    userId, 
    profile,
    trainingPlan,
    onMessageResponse
  }: MessageHandlerParams) => {
    setIsTyping(true);
    setError(null);
    
    try {
      // If we're awaiting confirmation for a plan update
      if (chatState === 'awaiting_plan_confirmation') {
        await handleConfirmationResponse({ message, userId, onMessageResponse });
        setIsTyping(false);
        return;
      }
      
      // Check if this is a plan adjustment request
      if (hasPlanFeedback(message)) {
        await handlePlanAdjustmentRequest({ message, userId, profile, trainingPlan, onMessageResponse });
        setIsTyping(false);
        return;
      }
      
      // Default: Handle as a regular chat message
      await handleRegularChatMessage({ message, userId, profile, trainingPlan, onMessageResponse });
      
    } catch (error) {
      console.error('Error processing message:', error);
      setError('Error processing message. Please try again.');
    } finally {
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
  
  return {
    isTyping,
    error,
    chatState,
    processUserMessage,
    setWorkoutSession
  };
} 