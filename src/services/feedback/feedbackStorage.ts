import { supabase } from '../../lib/supabase';
import { ChatMessage } from '../../types/chat';

// Define TrainingFeedback interface inline to avoid import error
interface TrainingFeedback {
  id?: string;
  user_id: string;
  week_start_date: string;
  prefers: string[];
  struggling_with: string[];
  feedback_summary: string;
  raw_data?: {
    chat_messages?: any[];
    workout_notes?: any[];
  };
  created_at?: string;
  updated_at?: string;
}

/**
 * Get chat messages from the past week for a user
 * @param userId User ID
 * @param startDate Start date for the week (typically past Sunday)
 * @param endDate End date for the week (typically current Sunday)
 * @returns Array of chat messages
 */
export async function getWeekChatMessages(
  userId: string,
  startDate: string,
  endDate: string
): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .order('timestamp', { ascending: true });
      
    if (error) {
      console.error('Error fetching chat messages:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getWeekChatMessages:', error);
    return [];
  }
}

/**
 * Get completed workouts with notes from the past week
 * @param userId User ID
 * @param startDate Start date for the week
 * @param endDate End date for the week
 * @returns Array of workouts with notes
 */
export async function getWeekWorkoutNotes(
  userId: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('date', startDate)
      .lte('date', endDate)
      .not('post_session_notes', 'is', null)
      .order('date', { ascending: true });
      
    if (error) {
      console.error('Error fetching workout notes:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getWeekWorkoutNotes:', error);
    return [];
  }
}

/**
 * Get skipped/missed workouts from the past week
 * @param userId User ID
 * @param startDate Start date for the week
 * @param endDate End date for the week
 * @returns Array of skipped/missed workouts
 */
export async function getWeekSkippedWorkouts(
  userId: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['skipped', 'missed'])
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });
      
    if (error) {
      console.error('Error fetching skipped workouts:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getWeekSkippedWorkouts:', error);
    return [];
  }
}

/**
 * Store training feedback in the database
 */
export async function storeTrainingFeedback(feedback: TrainingFeedback): Promise<boolean> {
  try {
    // Format data for storage
    const storageData = {
      user_id: feedback.user_id,
      week_start_date: feedback.week_start_date,
      prefers: JSON.stringify(feedback.prefers),
      struggling_with: JSON.stringify(feedback.struggling_with),
      feedback_summary: feedback.feedback_summary,
      raw_data: JSON.stringify(feedback.raw_data),
      created_at: feedback.created_at || new Date().toISOString(),
      updated_at: feedback.updated_at || new Date().toISOString()
    };
    
    // Insert into Supabase
    const { error } = await supabase
      .from('user_training_feedback')
      .insert(storageData);
      
    if (error) {
      console.error('Error storing training feedback:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in storeTrainingFeedback:', error);
    return false;
  }
}

/**
 * Get the most recent training feedback for a user
 */
export async function getLatestTrainingFeedback(userId: string): Promise<TrainingFeedback | null> {
  try {
    const { data, error } = await supabase
      .from('user_training_feedback')
      .select('*')
      .eq('user_id', userId)
      .order('week_start_date', { ascending: false })
      .limit(1);
      
    if (error) {
      console.error('Error fetching training feedback:', error);
      return null;
    }
    
    if (!data || data.length === 0) {
      return null;
    }
    
    // Format the data from the database
    const feedback = data[0];
    return {
      id: feedback.id,
      user_id: feedback.user_id,
      week_start_date: feedback.week_start_date,
      prefers: typeof feedback.prefers === 'string' ? JSON.parse(feedback.prefers) : feedback.prefers,
      struggling_with: typeof feedback.struggling_with === 'string' ? JSON.parse(feedback.struggling_with) : feedback.struggling_with,
      feedback_summary: feedback.feedback_summary,
      raw_data: typeof feedback.raw_data === 'string' ? JSON.parse(feedback.raw_data) : feedback.raw_data,
      created_at: feedback.created_at,
      updated_at: feedback.updated_at
    };
  } catch (error) {
    console.error('Error in getLatestTrainingFeedback:', error);
    return null;
  }
}

/**
 * Get all users for feedback processing
 */
export async function getAllUsers(): Promise<{id: string}[]> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id');
      
    if (error) {
      console.error('Error fetching users for feedback processing:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    return [];
  }
} 