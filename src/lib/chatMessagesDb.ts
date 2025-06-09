// Message database operations for coach-user chat
import { supabase } from './supabase';
import { ChatMessage } from '../types/chat';

/**
 * Save a chat message to the database
 */
export async function saveMessage(
  message: ChatMessage,
  userId: string,
  customTimestamp?: number // Optional timestamp in milliseconds (local time)
): Promise<boolean> {
  try {
    // Convert custom timestamp to ISO string if provided
    const timestampToUse = customTimestamp
      ? new Date(customTimestamp).toISOString()
      : new Date().toISOString();

    // Use direct insert to coach_messages table
    const { error: insertError } = await supabase.from('coach_messages').insert({
      user_id: userId,
      sender: message.sender,
      message: message.message,
      created_at: timestampToUse,
    });

    if (insertError) {
      console.error('Error saving message via direct insert:', insertError);
      return false;
    }

    console.log('Message saved successfully with timestamp:', timestampToUse);
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

    return data.map((msg) => ({
      sender: msg.sender as 'coach' | 'user',
      message: msg.message,
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
