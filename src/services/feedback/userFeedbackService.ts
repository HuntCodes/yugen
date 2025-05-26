import { supabase } from '../../lib/supabase';

export interface UserFeedback {
  id: string;
  user_id: string;
  feedback_text: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFeedbackData {
  feedback_text: string;
}

export interface UpdateFeedbackData {
  feedback_text: string;
}

/**
 * Submit new user feedback
 */
export async function submitUserFeedback(userId: string, feedbackData: CreateFeedbackData) {
  try {
    const { data, error } = await supabase
      .from('user_feedback')
      .insert({
        user_id: userId,
        feedback_text: feedbackData.feedback_text
      })
      .select()
      .single();

    if (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Error in submitUserFeedback:', error);
    return { data: null, error };
  }
}

/**
 * Get all feedback from a user
 */
export async function getUserFeedback(userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user feedback:', error);
      throw error;
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Error in getUserFeedback:', error);
    return { data: null, error };
  }
}

/**
 * Update existing feedback
 */
export async function updateUserFeedback(feedbackId: string, updateData: UpdateFeedbackData) {
  try {
    const { data, error } = await supabase
      .from('user_feedback')
      .update({
        feedback_text: updateData.feedback_text
      })
      .eq('id', feedbackId)
      .select()
      .single();

    if (error) {
      console.error('Error updating feedback:', error);
      throw error;
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Error in updateUserFeedback:', error);
    return { data: null, error };
  }
}

/**
 * Delete feedback
 */
export async function deleteUserFeedback(feedbackId: string) {
  try {
    const { error } = await supabase
      .from('user_feedback')
      .delete()
      .eq('id', feedbackId);

    if (error) {
      console.error('Error deleting feedback:', error);
      throw error;
    }

    return { error: null };
  } catch (error: any) {
    console.error('Error in deleteUserFeedback:', error);
    return { error };
  }
} 