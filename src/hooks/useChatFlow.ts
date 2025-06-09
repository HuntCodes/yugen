import { useMessageHandling, ChatMessage } from './chat/useMessageHandling';
import { useSupabaseChat } from './chat/useSupabaseChat';
import { saveMessage as saveMessageToDb } from '../lib/chatMessagesDb';
import { processChat } from '../services/summary/chatSummaryService';
import { WeatherForecast } from '../services/weather/weatherService';

export { ChatMessage };

export function useChatFlow() {
  const { isTyping, error, processUserMessage: handleMessage } = useMessageHandling();

  const { fetchUserProfile, fetchUserTrainingPlan } = useSupabaseChat();

  /**
   * Process a user message and determine response
   */
  const processUserMessage = async (
    userMessage: ChatMessage,
    userId: string,
    profile: any,
    trainingPlan: any[],
    onMessageResponse: (message: ChatMessage) => void,
    onPlanAdjusted?: () => Promise<void>,
    weatherData?: WeatherForecast | null
  ) => {
    try {
      // Log the user message to the terminal
      console.log('\n👤 User:', userMessage.message);

      // Save the user message to the database, now with its original timestamp
      await saveMessageToDb(userMessage, userId, userMessage.timestamp);

      // Handle special debug commands
      if (userMessage.message.toLowerCase() === 'test permissions') {
        console.log('Testing database permissions is now handled by usePlanAdjustment.');
        return;
      }

      // Handle direct test of plan update functionality
      if (userMessage.message.toLowerCase() === 'test update plan') {
        console.log('Test plan update functionality is now handled by usePlanAdjustment.');
        return;
      }

      // Process the message using our message handling hook
      const response = await handleMessage({
        message: userMessage.message,
        userId,
        profile,
        trainingPlan,
        weatherData,
        onMessageResponse,
        onPlanAdjusted,
      });

      // After getting a response, create chat summaries occasionally
      // We'll do this every 5-10 messages to avoid too many API calls
      try {
        // Get recent messages from the database
        const { data: messages } = await fetch(`/api/messages?userId=${userId}&limit=10`)
          .then((res) => res.json())
          .catch(() => ({ data: [] }));

        if (messages && messages.length >= 5) {
          // Attempt to determine if this is about a workout
          const isWorkoutRelated =
            userMessage.message.toLowerCase().includes('workout') ||
            userMessage.message.toLowerCase().includes('run') ||
            userMessage.message.toLowerCase().includes('training');

          // Extract topic if possible
          let topic = undefined;
          if (userMessage.message.length < 50) {
            topic = userMessage.message; // Use short messages as topics
          }

          // Create a chat summary in the background
          processChat(messages, userId, isWorkoutRelated ? 'workout' : 'general', topic).catch(
            (err) => console.error('Error creating chat summary:', err)
          );
        }
      } catch (err) {
        console.error('Error processing chat summary:', err);
        // Don't let summarization errors affect the main flow
      }
    } catch (error) {
      console.error('Error in useChatFlow.processUserMessage:', error);

      // Provide a fallback error response
      // Ensure coach error responses also get a timestamp if needed by saveMessageToDb,
      // though they are typically generated and saved immediately.
      const errorResponse: ChatMessage = {
        sender: 'coach',
        message:
          "I'm sorry, I encountered an error processing your message. Please try again in a moment.",
        timestamp: Date.now(), // Add timestamp for consistency if saveMessageToDb expects it for all messages
      };
      await saveMessageToDb(errorResponse, userId, errorResponse.timestamp);
      onMessageResponse(errorResponse);
    }
  };

  return {
    isTyping,
    error,
    processUserMessage,
  };
}
