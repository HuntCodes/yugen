import { ChatMessage, SESSION_TIME_WINDOW } from './useMessageTypes';
import { saveMessage } from '../../lib/chatMessagesDb';
import {
  createChatSummary,
  saveChatSummary,
  getRelevantChatSummaries,
  identifyChatContext,
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
    console.log('💾 [saveAndNotify] FUNCTION CALLED:', {
      sender: message.sender,
      messageLength: message.message?.length || 0,
      messagePreview: message.message?.substring(0, 100) + (message.message?.length > 100 ? '...' : ''),
      userId,
      hasCallback: !!onMessageResponse
    });
    
    try {
      await saveMessage(message, userId);
      console.log('💾 [saveAndNotify] MESSAGE SAVED TO DB - CALLING CALLBACK');
      onMessageResponse(message);
      console.log('💾 [saveAndNotify] CALLBACK EXECUTED SUCCESSFULLY');
    } catch (error) {
      console.error('💾 [saveAndNotify] ERROR saving message or calling callback:', error);
      // Still call the callback even if save fails to ensure UI updates
      try {
        onMessageResponse(message);
        console.log('💾 [saveAndNotify] CALLBACK EXECUTED (despite save error)');
      } catch (callbackError) {
        console.error('💾 [saveAndNotify] CALLBACK EXECUTION FAILED:', callbackError);
      }
    }
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
      message: errorText,
      timestamp: Date.now(),
    };

    await saveAndNotify(errorResponse, userId, onMessageResponse);
  };

  /**
   * Get relevant chat summaries for the current context
   */
  const getChatContext = async (userId: string, workoutId?: string, topic?: string) => {
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
      const { chatType, topic: identifiedTopic } = await identifyChatContext(messages, workoutId);

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
          end: new Date(),
        },
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
    summarizeAndSaveChat,
  };
}
