import { useState } from 'react';

import {
  ChatMessage,
  fetchChatHistory as fetchChatHistoryService,
  saveMessage as saveMessageService,
  clearChatHistory as clearChatHistoryService,
  subscribeToMessages as subscribeToMessagesService,
} from '../../services/chat/chatService';
import { fetchTrainingPlan } from '../../services/plan/planService';
import { fetchProfile } from '../../services/profile/profileService';

interface ChatHistoryOptions {
  userId: string;
  limit?: number;
}

export function useSupabaseChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch chat history for a specific user
   */
  const fetchChatHistory = async ({ userId, limit = 50 }: ChatHistoryOptions) => {
    setLoading(true);
    setError(null);

    try {
      const formattedMessages = await fetchChatHistoryService(userId, limit);
      setMessages(formattedMessages);
      return formattedMessages;
    } catch (err) {
      console.error('Error fetching chat history:', err);
      setError('Failed to load chat history');
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save a new message to the database
   */
  const saveMessage = async (message: ChatMessage, userId: string) => {
    try {
      return await saveMessageService(message, userId);
    } catch (err) {
      console.error('Error in saveMessage:', err);
      return false;
    }
  };

  /**
   * Clear all chat messages for a user
   */
  const clearChatHistory = async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const success = await clearChatHistoryService(userId);
      if (success) {
        setMessages([]);
      }
      return success;
    } catch (err) {
      console.error('Error clearing chat history:', err);
      setError('Failed to clear chat history');
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Add a listener for real-time updates to chat messages
   */
  const subscribeToMessages = (userId: string, callback: (messages: ChatMessage[]) => void) => {
    const unsubscribe = subscribeToMessagesService(userId, (newMessage) => {
      // Update our local state
      setMessages((prev) => [...prev, newMessage]);

      // Call the provided callback with updated messages array
      callback([...messages, newMessage]);
    });

    return unsubscribe;
  };

  /**
   * Fetch user profile data from the database
   */
  const fetchUserProfile = async (userId: string) => {
    try {
      return await fetchProfile(userId);
    } catch (err) {
      console.error('Error in fetchUserProfile:', err);
      return null;
    }
  };

  /**
   * Fetch the user's training plan from the database
   */
  const fetchUserTrainingPlan = async (userId: string) => {
    try {
      return await fetchTrainingPlan(userId);
    } catch (err) {
      console.error('Error in fetchTrainingPlan:', err);
      return [];
    }
  };

  return {
    messages,
    loading,
    error,
    fetchChatHistory,
    saveMessage,
    clearChatHistory,
    subscribeToMessages,
    fetchUserProfile,
    fetchUserTrainingPlan,
  };
}
