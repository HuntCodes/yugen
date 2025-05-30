import { supabase } from '../../lib/supabase';

export interface ChatMessage {
  sender: 'coach' | 'user';
  message: string;
  timestamp?: number;
}

/**
 * Load all chat messages for a user
 */
export const loadMessages = async (userId: string): Promise<ChatMessage[]> => {
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
};

/**
 * Fetch chat history for a specific user
 */
export const fetchChatHistory = async (userId: string, limit = 50): Promise<ChatMessage[]> => {
  try {
    // Fetch messages for this user from coach_messages table
    const { data, error: fetchError } = await supabase
      .from('coach_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (fetchError) {
      throw new Error(fetchError.message);
    }
    
    // Map the database format to our ChatMessage format
    const formattedMessages: ChatMessage[] = data.map(item => ({
      sender: item.sender,
      message: item.message,
      timestamp: new Date(item.created_at).getTime()
    })).sort((a, b) => (a.timestamp! - b.timestamp!));
    
    return formattedMessages;
  } catch (err) {
    console.error('Error fetching chat history:', err);
    throw err;
  }
};

/**
 * Save a new message to the database
 */
export const saveMessage = async (
  message: ChatMessage, 
  userId: string,
  customTimestamp?: number // Optional timestamp in milliseconds (local time)
): Promise<boolean> => {
  try {
    // Convert custom timestamp to ISO string if provided
    const timestampToUse = customTimestamp 
      ? new Date(customTimestamp).toISOString()
      : new Date().toISOString();
    
    // Save to coach_messages table
    const { error: coachMsgError } = await supabase
      .from('coach_messages')
      .insert({
        user_id: userId,
        sender: message.sender,
        message: message.message,
        created_at: timestampToUse
      });
      
    if (coachMsgError) {
      console.error('Error saving to coach_messages:', coachMsgError);
      return false;
    }
    
    console.log('Message saved successfully with timestamp:', timestampToUse);
    return true;
  } catch (err) {
    console.error('Error in saveMessage:', err);
    return false;
  }
};

/**
 * Clear all chat messages for a user
 */
export const clearChatHistory = async (userId: string): Promise<boolean> => {
  try {
    const { error: deleteError } = await supabase
      .from('coach_messages')
      .delete()
      .eq('user_id', userId);
      
    if (deleteError) {
      throw new Error(deleteError.message);
    }
    
    return true;
  } catch (err) {
    console.error('Error clearing chat history:', err);
    return false;
  }
};

/**
 * Add a listener for real-time updates to chat messages for Supabase v1
 */
export const subscribeToMessages = (
  userId: string, 
  callback: (newMessage: ChatMessage) => void
) => {
  // In v1, we use .from() directly for subscriptions
  const subscription = supabase
    .from('coach_messages')
    .on('INSERT', (payload) => {
      // Only process messages for this user
      if (payload.new && payload.new.user_id === userId) {
        // Format the new message
        const newMessage: ChatMessage = {
          sender: payload.new.sender,
          message: payload.new.message,
          timestamp: new Date(payload.new.created_at).getTime() // Convert ISO string to local time milliseconds
        };
        
        // Call the provided callback
        callback(newMessage);
      }
    })
    .subscribe();
    
  // Return an unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
};

/**
 * Fetch the coach associated with a user
 */
export const fetchCoach = async (userId: string) => {
  try {
    // First get the profile to find coach_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('coach_id')
      .eq('id', userId)
      .maybeSingle();
      
    if (profileError || !profile) {
      console.error('Error fetching profile or no profile found:', profileError);
      return null;
    }
    
    if (!profile.coach_id) {
      console.log('No coach_id found in user profile');
      return null;
    }
    
    // Then fetch the coach details
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('*')
      .eq('id', profile.coach_id)
      .single();
      
    if (coachError) {
      console.error('Error fetching coach:', coachError);
      return null;
    }
    
    return coach;
  } catch (err) {
    console.error('Error in fetchCoach:', err);
    return null;
  }
}; 