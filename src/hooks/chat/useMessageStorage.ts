import { ChatMessage, SESSION_TIME_WINDOW } from './useMessageTypes';
import { saveMessage } from '../../lib/chatMessagesDb';
import {
  createChatSummary,
  saveChatSummary,
  getRelevantChatSummaries,
  identifyChatContext
} from '../../services/summary/chatSummaryService';

/**
 * Hook for message storage utilities
 */
export function useMessageStorage() {
  /**
   * Save message to storage and notify caller through callback
   */
  const saveAndNotify = async (
    message: ChatMessage,
    userId: string,
    onMessageResponse: (message: ChatMessage) => void
  ): Promise<void> => {
    await saveMessage(message, userId);
    onMessageResponse(message);
  };

  /**
   * Save error message and notify caller
   */
  const saveErrorMessage = async (
    errorText: string,
    userId: string,
    onMessageResponse: (message: ChatMessage) => void
  ): Promise<void> => {
    const errorResponse: ChatMessage = {
      sender: 'coach',
      message: errorText
    };
    
    await saveAndNotify(errorResponse, userId, onMessageResponse);
  };

  /**
   * Get relevant chat summaries for the current context
   */
  const getChatContext = async (
    userId: string,
    workoutId?: string,
    topic?: string
  ) => {
    return getRelevantChatSummaries(userId, workoutId, topic);
  };

  /**
   * Create and save a summary of the conversation
   */
  const summarizeAndSaveChat = async (
    messages: ChatMessage[],
    userId: string,
    topic?: string,
    workoutId?: string
  ): Promise<boolean> => {
    try {
      if (messages.length < 10) {
        return false; // Not enough messages to summarize
      }
      
      // Identify chat context
      const { chatType, topic: identifiedTopic } = await identifyChatContext(
        messages,
        workoutId
      );
      
      // Generate summary
      const summary = await createChatSummary(
        messages,
        userId,
        identifiedTopic || topic,
        workoutId
      );
      
      if (!summary) {
        return false;
      }
      
      // Save summary to Supabase
      await saveChatSummary({
        user_id: userId,
        related_workout_id: workoutId,
        topic: identifiedTopic || topic,
        chat_type: chatType,
        summary,
        time_frame: {
          start: new Date(Date.now() - SESSION_TIME_WINDOW),
          end: new Date()
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error summarizing chat:', error);
      return false;
    }
  };

  return {
    saveAndNotify,
    saveErrorMessage,
    getChatContext,
    summarizeAndSaveChat
  };
} 