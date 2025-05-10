// Message handling utilities for coach-user chat
import { supabase } from './supabase';
import { ChatMessage } from '../types/chat';

/**
 * Save a chat message to the database
 */
export async function saveMessage(
  message: ChatMessage, 
  userId: string
): Promise<boolean> {
  try {
    // Try using the stored procedure first
    const { data, error } = await supabase.rpc('insert_coach_message', {
      p_user_id: userId,
      p_sender: message.sender,
      p_message: message.message
    });
    
    if (error) {
      console.error('Error saving message via RPC:', error);
      
      // Fallback to direct insert if RPC fails
      const { error: insertError } = await supabase
        .from('coach_messages')
        .insert({
          user_id: userId,
          sender: message.sender,
          message: message.message,
          created_at: new Date().toISOString()
        });
        
      if (insertError) {
        console.error('Error saving message via direct insert:', insertError);
        return false;
      }
    } else {
      console.log('Message saved successfully via RPC');
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