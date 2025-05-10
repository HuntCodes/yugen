import { supabase } from '../../lib/api/supabase';
import { generateWeeklyPlan } from '../../lib/api/weeklyPlanGenerator';
import { OnboardingData } from '../../types/training';
import { processWeeklyTrainingFeedback } from '../../services/feedback/trainingFeedbackService';

/**
 * Check if a user's plan needs to be refreshed
 * Criteria: No workouts after today or it's Sunday (refresh day)
 */
export async function checkNeedsRefresh(userId: string): Promise<boolean> {
  try {
    // Get today's date (midnight) for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayFormatted = today.toISOString().split('T')[0];

    // Check if it's Sunday (refresh day)
    const isSunday = today.getDay() === 0;

    // Count workouts after today
    const { count, error } = await supabase
      .from('training_plans')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('date', todayFormatted);
      
    if (error) {
      console.error('Error checking for future workouts:', error);
      return false;
    }
    
    // Need refresh if: it's Sunday or there are no future workouts
    return isSunday || count === 0;
  } catch (error) {
    console.error('Error in checkNeedsRefresh:', error);
    return false;
  }
}

/**
 * Get the user's onboarding data needed for plan generation
 */
async function getUserOnboardingData(userId: string): Promise<OnboardingData | null> {
  try {
    // Get user profile data
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId);
      
    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return null;
    }
    
    // Handle array result
    if (!profileData || profileData.length === 0) {
      console.error('No profile found for user:', userId);
      return null;
    }
    
    const profile = profileData[0];
    
    // Get onboarding responses
    const { data: onboardingResponses, error: onboardingError } = await supabase
      .from('onboarding_responses')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (onboardingError) {
      console.error('Error fetching onboarding data:', onboardingError);
      // Can proceed with just profile data if needed
    }
    
    // Construct onboarding data from profile and onboarding responses
    const onboardingData: OnboardingData = {
      goalType: profile.goal_description || 'General fitness',
      raceDate: profile.race_date,
      raceDistance: profile.goal_distance,
      experienceLevel: profile.running_experience || 'beginner',
      trainingFrequency: onboardingResponses?.training_frequency || profile.training_frequency || '3-4 days per week',
      current_mileage: String(profile.weekly_volume || '20'),
      units: profile.units || 'km',
      trainingPreferences: profile.training_preferences,
      nickname: profile.display_name,
      injury_history: profile.injury_history,
      schedule_constraints: onboardingResponses?.schedule_constraints
    };
    
    return onboardingData;
  } catch (error) {
    console.error('Error getting user onboarding data:', error);
    return null;
  }
}

/**
 * Remove future workouts starting from the specified date
 */
async function removeFutureWorkouts(userId: string, fromDate: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('training_plans')
      .delete()
      .eq('user_id', userId)
      .gte('date', fromDate);
      
    if (error) {
      console.error('Error removing future workouts:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in removeFutureWorkouts:', error);
    return false;
  }
}

/**
 * Generate and save a new weekly training plan for a user
 */
export async function refreshWeeklyPlan(userId: string): Promise<boolean> {
  try {
    console.log('Refreshing weekly plan for user:', userId);
    
    // Check if user exists in profiles table
    const { data: profileExists, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId);
      
    if (profileError) {
      console.error('Error checking profile:', profileError);
      return false;
    }
    
    if (!profileExists || profileExists.length === 0) {
      console.error('Cannot generate plan: Profile does not exist for user:', userId);
      return false;
    }
    
    console.log('Profile exists, proceeding with plan generation');
    
    // Get user's onboarding data
    const onboardingData = await getUserOnboardingData(userId);
    if (!onboardingData) {
      console.error('Failed to get onboarding data for plan refresh');
      return false;
    }
    
    // Get today's date
    const today = new Date();
    const todayFormatted = today.toISOString().split('T')[0];
    
    // Remove future workouts from today onwards
    const removed = await removeFutureWorkouts(userId, todayFormatted);
    if (!removed) {
      console.warn('Failed to remove future workouts, but continuing with refresh');
    }
    
    // Generate new weekly plan
    const sessions = await generateWeeklyPlan(userId, onboardingData);
    
    if (!sessions || sessions.length === 0) {
      console.error('No sessions generated for weekly plan');
      return false;
    }
    
    console.log(`Generated ${sessions.length} workouts for weekly plan`);
    
    // Insert the new sessions into the database
    const sessionRows = sessions.map(session => ({
      user_id: userId,
      week_number: session.week_number,
      day_of_week: session.day_of_week,
      session_type: session.session_type,
      date: session.date,
      distance: session.distance,
      time: session.time,
      notes: session.notes,
      status: 'not_completed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    
    const { error: insertError } = await supabase
      .from('training_plans')
      .insert(sessionRows);
      
    if (insertError) {
      console.error('Error inserting new weekly plan:', insertError);
      return false;
    }
    
    console.log('Successfully refreshed weekly plan for user:', userId);
    return true;
  } catch (error) {
    console.error('Error refreshing weekly plan:', error);
    return false;
  }
}

/**
 * Check and refresh plans for all active users
 * This function would be called by a CRON job or scheduled task
 */
export async function refreshAllUserPlans(): Promise<{
  success: boolean;
  refreshed: number;
  failed: number;
  skipped: number;
}> {
  const result = {
    success: false,
    refreshed: 0,
    failed: 0,
    skipped: 0
  };
  
  try {
    // Get all active users
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id');
      
    if (usersError) {
      console.error('Error fetching users for plan refresh:', usersError);
      return result;
    }
    
    if (!users || users.length === 0) {
      console.log('No users found for plan refresh');
      result.success = true;
      return result;
    }
    
    console.log(`Checking ${users.length} users for plan refresh`);
    
    // Calculate the previous week's Sunday (for feedback processing)
    const today = new Date();
    const day = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const prevSunday = new Date(today);
    prevSunday.setDate(today.getDate() - day - 7); // Go back to previous Sunday
    prevSunday.setHours(0, 0, 0, 0);
    
    const weekStartDate = prevSunday.toISOString().split('T')[0];
    
    // Process each user
    for (const user of users) {
      try {
        // Check if the user needs a refresh
        const needsRefresh = await checkNeedsRefresh(user.id);
        
        if (needsRefresh) {
          console.log(`User ${user.id} needs a plan refresh`);
          
          // Process weekly training feedback before generating new plan
          console.log(`Processing training feedback for user ${user.id}`);
          await processWeeklyTrainingFeedback(user.id, weekStartDate);
          
          // Then refresh the plan with the new feedback incorporated
          const refreshed = await refreshWeeklyPlan(user.id);
          
          if (refreshed) {
            result.refreshed++;
          } else {
            result.failed++;
          }
        } else {
          console.log(`User ${user.id} does not need a plan refresh`);
          result.skipped++;
        }
      } catch (error) {
        console.error(`Error processing user ${user.id}:`, error);
        result.failed++;
      }
    }
    
    result.success = result.failed === 0;
    console.log(`Plan refresh complete. Refreshed: ${result.refreshed}, Failed: ${result.failed}, Skipped: ${result.skipped}`);
    return result;
  } catch (error) {
    console.error('Error in refreshAllUserPlans:', error);
    return result;
  }
} 