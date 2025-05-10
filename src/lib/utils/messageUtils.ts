// Message handling utilities for coach-user chat
import { supabase } from '../api/supabase';
import { ChatMessage } from '../../services/chat/chatService';

/**
 * Save a chat message to the database
 */
export async function saveMessage(
  message: ChatMessage, 
  userId: string
): Promise<boolean> {
  try {
    // Try coach_messages table first
    const { error: coachMsgError } = await supabase
      .from('coach_messages')
      .insert({
        user_id: userId,
        sender: message.sender,
        message: message.message,
        created_at: new Date().toISOString()
      });
      
    if (coachMsgError) {
      console.error('Error saving to coach_messages:', coachMsgError);
      
      // Fallback: Try chat_messages table
      const { error: chatMsgError } = await supabase
        .from('chat_messages')
        .insert({
          user_id: userId,
          sender: message.sender,
          content: message.message,
          created_at: new Date().toISOString()
        });
        
      if (chatMsgError) {
        console.error('Error saving to chat_messages:', chatMsgError);
        return false;
      }
    } else {
      console.log('Message saved successfully to coach_messages');
    }
    
    return true;
  } catch (err) {
    console.error('Failed to save message:', err);
    return false;
  }
}

/**
 * Load all chat messages for a user
 */
export async function loadMessages(userId: string): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('coach_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error('Error loading messages:', error);
      return [];
    }
    
    return data.map(msg => ({
      sender: msg.sender as 'coach' | 'user',
      message: msg.message
    }));
  } catch (err) {
    console.error('Failed to load messages:', err);
    return [];
  }
}

/**
 * Mark all messages as read
 */
export async function markMessagesAsRead(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('coach_messages')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
      
    if (error) {
      console.error('Error marking messages as read:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Failed to mark messages as read:', err);
    return false;
  }
} 