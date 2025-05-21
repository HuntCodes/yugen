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

// Re-define or import ProposeWorkoutAdjustmentArgs if not already available globally
// For simplicity, defining a relevant subset here. Ensure this matches the one in useMessageProcessing.ts
interface AdjustmentDetails {
  new_date?: string; // YYYY-MM-DD
  new_distance?: number;
  new_duration_minutes?: number;
  intensity_change?: 'easier' | 'harder' | 'same';
  action?: 'update' | 'delete' | 'suggest_new';
  reason?: string; // For logging or notes
  // user_query is not directly used for DB update but good for context
}

interface WorkoutAdjustmentArgs {
  session_id?: string;
  original_date?: string; 
  workout_type?: string; // Made more critical if session_id is absent
  adjustment_details: AdjustmentDetails;
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

/**
 * Execute a workout adjustment (update or delete) in the database.
 */
export const executeWorkoutAdjustment = async (
  userId: string,
  adjustment: WorkoutAdjustmentArgs
): Promise<{ success: boolean; message: string }> => {
  const { session_id, original_date, workout_type, adjustment_details } = adjustment;
  const { action = 'update' } = adjustment_details; 

  console.log('[planService] Attempting to execute adjustment:', JSON.stringify(adjustment, null, 2));

  try {
    if (action === 'delete') {
      let deleteQuery = supabase.from('training_plans').delete().eq('user_id', userId);
      let countToVerify = 0;

      if (session_id) {
        deleteQuery = deleteQuery.eq('id', session_id);
        countToVerify = 1; // Expect to delete 1 if ID is correct
      } else if (original_date && workout_type) { 
        // If deleting by date and type, first check how many match to avoid ambiguity
        const { data: matchingSessions, error: findError } = await supabase
          .from('training_plans')
          .select('id')
          .eq('user_id', userId)
          .eq('date', original_date)
          .eq('session_type', workout_type);

        if (findError) {
          console.error('[planService] Error finding sessions to delete:', findError);
          return { success: false, message: `Error finding workouts to delete: ${findError.message}` };
        }
        if (!matchingSessions || matchingSessions.length === 0) {
          return { success: false, message: "No workout found to delete with the provided date and type." };
        }
        if (matchingSessions.length > 1) {
          return { success: false, message: `Multiple workouts (${matchingSessions.length}) found for ${workout_type} on ${original_date}. Please ask the user to be more specific or use the workout ID.` };
        }
        // If exactly one, proceed to delete by its specific ID for safety
        deleteQuery = deleteQuery.eq('id', matchingSessions[0].id);
        countToVerify = 1;
      } else {
        return { success: false, message: "Cannot delete: session_id, or both original_date and workout_type, are required." };
      }

      console.log('[planService] Executing delete query for workout.');
      const { error, count } = await deleteQuery;
      if (error) {
        console.error('Error deleting workout:', error);
        return { success: false, message: `Failed to delete workout: ${error.message}` };
      }
      // `count` from delete operation might be null for some providers or configurations.
      // Relying on prior check (countToVerify) is safer if count is not guaranteed.
      if (count === 0 && countToVerify > 0) { 
        console.warn('[planService] Delete query executed but no workout found or deleted despite prior check.', {userId, session_id, original_date, workout_type});
        return { success: false, message: "Workout to delete was not found (or already deleted)." };
      }
      return { success: true, message: "Workout successfully deleted." };
    }

    if (action === 'update') {
      let foundSessionToUpdate: any;

      if (session_id) {
        const { data, error } = await supabase
          .from('training_plans')
          .select('id, session_type, notes')
          .eq('user_id', userId)
          .eq('id', session_id)
          .maybeSingle();
        if (error) throw error; // Let catch block handle
        foundSessionToUpdate = data;
      } else if (original_date && workout_type) {
        const { data: matchingSessions, error: findError } = await supabase
          .from('training_plans')
          .select('id, session_type, notes')
          .eq('user_id', userId)
          .eq('date', original_date)
          .eq('session_type', workout_type);
        
        if (findError) throw findError;
        if (!matchingSessions || matchingSessions.length === 0) {
          return { success: false, message: "Workout to update not found with the provided date and type." };
        }
        if (matchingSessions.length > 1) {
          return { success: false, message: `Multiple workouts (${matchingSessions.length}) found for ${workout_type} on ${original_date}. Please ask the user to be more specific or use the workout ID.` };
        }
        foundSessionToUpdate = matchingSessions[0];
      } else {
        return { success: false, message: "Cannot update: session_id, or both original_date and workout_type, are required." };
      }

      if (!foundSessionToUpdate) {
        console.warn('[planService] No workout found to update with details:', {userId, session_id, original_date, workout_type});
        return { success: false, message: "Workout to update not found." };
      }

      console.log('[planService] Found workout to update:', foundSessionToUpdate);
      const targetSessionId = foundSessionToUpdate.id;
      const currentSessionType = foundSessionToUpdate.session_type;
      const currentNotes = foundSessionToUpdate.notes || "";

      // Prevent applying distance/duration to a Rest Day type workout
      if (currentSessionType && currentSessionType.toLowerCase().includes('rest') && 
          (adjustment_details.new_distance !== undefined || adjustment_details.new_duration_minutes !== undefined)) {
        return { success: false, message: `Cannot apply distance or duration to a '${currentSessionType}'. Please change session type first or adjust differently.` };
      }
      
      const updateObject: { [key: string]: any } = { updated_at: new Date().toISOString() };
      if (adjustment_details.new_date) updateObject.date = adjustment_details.new_date;
      if (adjustment_details.new_distance !== undefined) updateObject.distance = adjustment_details.new_distance;
      if (adjustment_details.new_duration_minutes !== undefined) updateObject.time = adjustment_details.new_duration_minutes;
      
      if (adjustment_details.intensity_change || adjustment_details.reason) {
        let newNoteParts = [];
        if (currentNotes) newNoteParts.push(currentNotes);
        if (adjustment_details.intensity_change) newNoteParts.push(`Intensity: ${adjustment_details.intensity_change}.`);
        if (adjustment_details.reason) newNoteParts.push(`Reason for change: ${adjustment_details.reason}.`);
        updateObject.notes = newNoteParts.join(' | ');
      }

      if (Object.keys(updateObject).length === 1 && updateObject.updated_at) {
        return { success: false, message: "No valid changes provided for workout update." };
      }

      console.log('[planService] Executing update for workout ID:', targetSessionId, 'with object:', updateObject);
      const { data, error } = await supabase
        .from('training_plans')
        .update(updateObject)
        .eq('id', targetSessionId) // Always update by specific ID now
        .select(); 

      if (error) {
        console.error('Error updating workout:', error);
        return { success: false, message: `Failed to update workout: ${error.message}` };
      }
      if (!data || data.length === 0) {
          console.warn('[planService] Workout update query executed but no record changed.', {targetSessionId});
          // This case should be rare now since we found the record first.
          return { success: false, message: "Workout found but no changes were applied during update." };
      }

      return { success: true, message: "Workout successfully updated." };
    }

    return { success: false, message: `Unsupported action: ${action}` };

  } catch (err: any) {
    console.error('Error in executeWorkoutAdjustment:', err);
    return { success: false, message: `An unexpected error occurred: ${err.message}` };
  }
}; 