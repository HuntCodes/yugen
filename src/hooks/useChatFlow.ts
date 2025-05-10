import { useMessageHandling, ChatMessage } from './chat/useMessageHandling';
import { useSupabaseChat } from './chat/useSupabaseChat';
import { saveMessage as saveMessageToDb } from '../lib/chatMessagesDb';
import { processChat } from '../services/summary/chatSummaryService';

export { ChatMessage };

export function useChatFlow() {
  const { 
    isTyping, 
    error, 
    processUserMessage: handleMessage 
  } = useMessageHandling();
  
  const {
    fetchUserProfile,
    fetchUserTrainingPlan
  } = useSupabaseChat();

  /**
   * Process a user message and determine response
   */
  const processUserMessage = async (
    message: string, 
    userId: string, 
    profile: any,
    trainingPlan: any[],
    onMessageResponse: (message: ChatMessage) => void
  ) => {
    try {
      // Log the user message to the terminal
      console.log('\n👤 User:', message);
      
      // Save the user message to the database
      const userMessage: ChatMessage = { sender: 'user', message };
      await saveMessageToDb(userMessage, userId);
      
      // Handle special debug commands
      if (message.toLowerCase() === 'test permissions') {
        console.log('Testing database permissions is now handled by usePlanAdjustment.');
        return;
      }
      
      // Handle direct test of plan update functionality
      if (message.toLowerCase() === 'test update plan') {
        console.log('Test plan update functionality is now handled by usePlanAdjustment.');
        return;
      }
      
      // Process the message using our message handling hook
      const response = await handleMessage({
        message,
        userId,
        profile,
        trainingPlan,
        onMessageResponse
      });
      
      // After getting a response, create chat summaries occasionally
      // We'll do this every 5-10 messages to avoid too many API calls
      try {
        // Get recent messages from the database
        const { data: messages } = await fetch(`/api/messages?userId=${userId}&limit=10`)
          .then(res => res.json())
          .catch(() => ({ data: [] }));
        
        if (messages && messages.length >= 5) {
          // Attempt to determine if this is about a workout
          const isWorkoutRelated = message.toLowerCase().includes('workout') || 
                                  message.toLowerCase().includes('run') ||
                                  message.toLowerCase().includes('training');
          
          // Extract topic if possible
          let topic = undefined;
          if (message.length < 50) {
            topic = message; // Use short messages as topics
          }
          
          // Create a chat summary in the background
          processChat(
            messages, 
            userId, 
            isWorkoutRelated ? 'workout' : 'general',
            topic
          ).catch(err => console.error('Error creating chat summary:', err));
        }
      } catch (err) {
        console.error('Error processing chat summary:', err);
        // Don't let summarization errors affect the main flow
      }
      
    } catch (error) {
      console.error('Error in useChatFlow.processUserMessage:', error);
      
      // Provide a fallback error response
      const errorResponse: ChatMessage = { 
        sender: 'coach', 
        message: "I'm sorry, I encountered an error processing your message. Please try again in a moment."
      };
      await saveMessageToDb(errorResponse, userId);
      onMessageResponse(errorResponse);
    }
  };

  return {
    isTyping,
    error,
    processUserMessage
  };
} 