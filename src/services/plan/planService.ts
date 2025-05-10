import { supabase } from '../../lib/supabase';
import { generateTrainingPlan, OnboardingData } from '../../lib/openai';

export interface TrainingSession {
  week_number: number;
  day_of_week: number; // 1-7, where 1 is Monday and 7 is Sunday
  session_type: string;
  date: string;
  distance: number;
  time: number;
  notes: string;
}

export interface PlanUpdate {
  week: number;
  date: string;
  session_type: string;
  new_notes: string;
  new_distance: number;
  new_time: number;
  new_date?: string;
}

/**
 * Check if a user has existing training sessions
 */
export const checkExistingTrainingSessions = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('training_plans')
      .select('id')
      .eq('user_id', userId);
      
    if (error) {
      console.error('Error checking existing sessions:', error);
      throw error;
    }
    
    return data || [];
  } catch (err) {
    console.error('Error in checkExistingTrainingSessions:', err);
    throw err;
  }
};

/**
 * Insert training sessions into the database
 */
export const insertTrainingSessions = async (sessions: any[]) => {
  try {
    const { data, error } = await supabase
      .from('training_plans')
      .insert(sessions);
      
    if (error) {
      console.error('Error inserting training sessions:', error);
      throw error;
    }
    
    return data;
  } catch (err) {
    console.error('Error in insertTrainingSessions:', err);
    throw err;
  }
};

/**
 * Fetch the training plan for a user
 */
export const fetchTrainingPlan = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .order('week_number', { ascending: true })
      .order('date', { ascending: true });
      
    if (error) {
      console.error('Error fetching training plan:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Error in fetchTrainingPlan:', err);
    return [];
  }
};

/**
 * Generate and save a new training plan for a user
 */
export const generateAndSavePlan = async (userId: string, onboardingData: OnboardingData) => {
  try {
    // First, check if the user profile exists
    const { data: profileExists, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
      
    if (profileError || !profileExists) {
      console.error('Error: User does not have a profile:', profileError || 'No profile found');
      console.log('Cannot generate plan without a user profile. UserId:', userId);
      throw new Error('User profile does not exist. Please complete profile setup first.');
    }
    
    console.log('Generating training plan with data:', onboardingData);
    
    // Generate plan using OpenAI
    const sessions = await generateTrainingPlan(onboardingData);
    console.log('Generated sessions successfully:', sessions.length);
    
    // Insert all sessions into training_plans
    const rows = sessions.map(session => ({
      user_id: userId,
      ...session,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    
    const { error: insertError } = await supabase
      .from('training_plans')
      .insert(rows);
      
    if (insertError) {
      console.error('Error inserting training plan:', insertError);
      throw insertError;
    }
    
    return sessions;
  } catch (err) {
    console.error('Error generating plan:', err);
    throw err;
  }
};

/**
 * Apply an update to a training plan session
 */
export const applyPlanUpdate = async (update: PlanUpdate, userId: string) => {
  try {
    console.log('Applying plan change to Supabase for user:', userId);
    console.log('Update details:', update);
    
    // Find the workout to update
    const { data: workouts, error: fetchError } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('week_number', update.week)
      .eq('date', update.date)
      .eq('session_type', update.session_type);
    
    if (fetchError) {
      console.error('Error fetching workout to update:', fetchError);
      return false;
    }
    
    if (!workouts || workouts.length === 0) {
      console.error('No matching workout found for update');
      return false;
    }
    
    // Use the first matching workout
    const workoutToUpdate = workouts[0];
    console.log('Found workout to update:', workoutToUpdate);
    
    // Prepare the update object
    const supabaseUpdate: any = {
      notes: update.new_notes,
      distance: update.new_distance,
      time: update.new_time,
      updated_at: new Date().toISOString()
    };
    
    // Add date update if provided
    if (update.new_date && update.new_date !== update.date) {
      supabaseUpdate.date = update.new_date;
    }
    
    console.log('Sending update to Supabase:', supabaseUpdate);
    
    // Apply the update
    const { data: updateResult, error: updateError } = await supabase
      .from('training_plans')
      .update(supabaseUpdate)
      .eq('id', workoutToUpdate.id)
      .select();
    
    if (updateError) {
      console.error('Error updating workout:', updateError);
      return false;
    }
    
    console.log('Update result:', updateResult);
    return true;
  } catch (err) {
    console.error('Error in applyPlanUpdate:', err);
    return false;
  }
};

/**
 * Generate a confirmation message for plan updates
 */
export const generateConfirmationMessage = (update: PlanUpdate): string => {
  // Format dates nicely
  const originalDate = new Date(update.date);
  const formattedOriginalDate = originalDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });
  
  let message = `I've updated your ${update.session_type} workout for ${formattedOriginalDate}. `;
  
  // If date changed, add date change info
  if (update.new_date && update.new_date !== update.date) {
    const newDate = new Date(update.new_date);
    const formattedNewDate = newDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
    message += `I've moved it to ${formattedNewDate}. `;
  }
  
  // Add distance and time changes
  message += `It's now a ${update.new_distance}km run with a target time of ${update.new_time} minutes. `;
  
  // Add notes
  message += `Your workout includes: ${update.new_notes}`;
  
  return message;
};

/**
 * Delete a training plan for a user
 */
export const deleteTrainingPlan = async (userId: string) => {
  try {
    const { error } = await supabase
      .from('training_plans')
      .delete()
      .eq('user_id', userId);
      
    if (error) {
      console.error('Error deleting training plan:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error in deleteTrainingPlan:', err);
    return false;
  }
}; 