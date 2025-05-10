import { supabase } from '../../lib/supabase';
import { PlanUpdate, ChatMessage } from '../chat/types';

export function useAdjustmentStorage() {
  /**
   * Apply a plan change to the Supabase database
   */
  const applyPlanChangeToSupabase = async (
    update: PlanUpdate,
    userId: string
  ): Promise<boolean> => {
    try {
      console.log('Applying plan change to Supabase for user:', userId);
      console.log('Update details:', update);
      
      // Check if the date has an outdated year
      const updateDate = new Date(update.date);
      const currentYear = new Date().getFullYear();
      const isOutdatedYear = updateDate.getFullYear() < currentYear;
      
      // Find the workout to update
      let workouts;
      let fetchError;
      
      if (isOutdatedYear) {
        // If year is outdated, try to find the workout by week number and session type
        // and matching month/day (ignoring year)
        console.log('Detected outdated year in update request. Searching based on month/day pattern.');
        
        // Get all user's training sessions
        const { data, error } = await supabase
          .from('training_plans')
          .select('*')
          .eq('user_id', userId)
          .eq('week_number', update.week)
          .eq('session_type', update.session_type);
          
        fetchError = error;
        
        if (!error && data && data.length > 0) {
          // Filter in memory to find sessions with matching month/day
          workouts = data.filter(workout => {
            const workoutDate = new Date(workout.date);
            return workoutDate.getMonth() === updateDate.getMonth() && 
                   workoutDate.getDate() === updateDate.getDate();
          });
          
          if (workouts.length === 0) {
            console.log('No exact month/day match found. Looking for closest date match in week', update.week);
            // If no exact month/day match, find workouts from the same week
            workouts = data;
          }
        }
      } else {
        // Standard lookup by exact date if year is current
        const result = await supabase
          .from('training_plans')
          .select('*')
          .eq('user_id', userId)
          .eq('week_number', update.week)
          .eq('date', update.date)
          .eq('session_type', update.session_type);
          
        workouts = result.data;
        fetchError = result.error;
      }
      
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
      
      // Create the update object
      const supabaseUpdate: any = {
        notes: update.new_notes,
        distance: update.new_distance,
        time: update.new_time,
        updated_at: new Date().toISOString(),
        modified: true // Mark the workout as modified
      };
      
      // Add date update if provided
      if (update.new_date && update.new_date !== update.date) {
        // Make sure the new date has current year
        const newDate = new Date(update.new_date);
        if (newDate.getFullYear() < currentYear) {
          // Update to current year
          newDate.setFullYear(currentYear);
          // Format date with local components instead of toISOString
          supabaseUpdate.date = `${newDate.getFullYear()}-${(newDate.getMonth() + 1).toString().padStart(2, '0')}-${newDate.getDate().toString().padStart(2, '0')}`;
        } else {
          supabaseUpdate.date = update.new_date;
        }
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
      
      // Verify the update by fetching the workout again
      const { data: verifyData, error: verifyError } = await supabase
        .from('training_plans')
        .select('*')
        .eq('id', workoutToUpdate.id)
        .single();
        
      if (verifyError) {
        console.error('Error verifying update:', verifyError);
      } else {
        console.log('Verified updated workout:', JSON.stringify(verifyData));
        // Check if the update was actually applied
        if (verifyData.notes === update.new_notes && 
            verifyData.distance === update.new_distance &&
            verifyData.time === update.new_time) {
          console.log('✓ Update successfully verified');
        }
      }
      
      return true;
    } catch (err) {
      console.error('Error in applyPlanChangeToSupabase:', err);
      return false;
    }
  };

  /**
   * Test database permissions to debug training plan updates
   */
  const testDatabasePermissions = async (
    userId: string,
    trainingPlan: any[],
    onMessageResponse: (message: ChatMessage) => void
  ) => {
    try {
      console.log('Starting database permission test');
      
      if (!trainingPlan || trainingPlan.length === 0) {
        const errorMsg = 'No training plan available to test';
        console.error(errorMsg);
        
        const aiResponse: ChatMessage = {
          sender: 'coach', 
          message: `I couldn't test the database permissions because there are no training plan entries. Please add some training sessions first.`
        };
        onMessageResponse(aiResponse);
        return;
      }
      
      // Test 1: Read permissions
      console.log('Test 1: Checking read permissions');
      const { data: readData, error: readError } = await supabase
        .from('training_plans')
        .select('*')
        .eq('user_id', userId)
        .limit(1);
        
      if (readError) {
        console.error('Read permission test failed:', readError);
      } else {
        console.log('Read permission test passed:', readData?.length > 0);
      }
      
      // Test 2: Write permissions with a minor update
      console.log('Test 2: Checking write permissions');
      const testWorkout = trainingPlan[0];
      
      // Create a test update that doesn't actually change anything
      const testUpdate = {
        notes: testWorkout.notes,
        updated_at: new Date().toISOString()
      };
      
      const { data: writeData, error: writeError } = await supabase
        .from('training_plans')
        .update(testUpdate)
        .eq('id', testWorkout.id)
        .select();
        
      if (writeError) {
        console.error('Write permission test failed:', writeError);
      } else {
        console.log('Write permission test passed:', writeData);
      }
      
      // Report results
      const readStatus = readError ? '❌ Failed' : '✅ Passed';
      const writeStatus = writeError ? '❌ Failed' : '✅ Passed';
      
      const resultMessage = `
Database Permission Test Results:
- Read access: ${readStatus}
- Write access: ${writeStatus}

${writeError ? `Error updating training plan: ${writeError.message}` : ''}

Training plan entry used for testing:
ID: ${testWorkout.id}
Week: ${testWorkout.week_number}
Date: ${testWorkout.date}
Type: ${testWorkout.session_type}
      `;
      
      const aiResponse: ChatMessage = { 
        sender: 'coach', 
        message: `I've tested the database permissions. ${writeError ? 'There seems to be an issue with updating your training plan.' : 'I should be able to update your training plan.'} Let me know if you want more details.` 
      };
      
      // Log the full results for debugging
      console.log(resultMessage);
      
      // Send the user-friendly message
      onMessageResponse(aiResponse);
      
    } catch (err) {
      console.error('Error testing database permissions:', err);
      const aiResponse: ChatMessage = { 
        sender: 'coach', 
        message: `I encountered an error while testing database permissions. This might explain why I can't update your training plan.`
      };
      onMessageResponse(aiResponse);
    }
  };

  /**
   * Get workouts for a specific week number and user
   */
  const getWorkoutsForWeek = async (userId: string, weekNumber: number): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('training_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('week_number', weekNumber)
        .order('date', { ascending: true });
        
      if (error) {
        console.error('Error fetching workouts for week:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error in getWorkoutsForWeek:', error);
      return [];
    }
  };

  return {
    applyPlanChangeToSupabase,
    testDatabasePermissions,
    getWorkoutsForWeek
  };
} 