import { supabase } from '../../lib/supabase';
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
 * IMPORTANT: This is a destructive operation.
 */
async function removeWorkoutsFromDate(userId: string, fromDateUTC: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('training_plans')
      .delete()
      .eq('user_id', userId)
      .gte('date', fromDateUTC); // Ensure date is compared in UTC if fromDateUTC is YYYY-MM-DD
      
    if (error) {
      console.error(`[weeklyPlanService] Error removing workouts from ${fromDateUTC} for user ${userId}:`, error);
      return false;
    }
    console.log(`[weeklyPlanService] Successfully removed workouts from ${fromDateUTC} for user ${userId}`);
    return true;
  } catch (error) {
    console.error(`[weeklyPlanService] Exception in removeWorkoutsFromDate for user ${userId}:`, error);
    return false;
  }
}

export async function generateAndStoreCurrentWeekPlanForUser(userId: string): Promise<boolean> {
  try {
    console.log(`[weeklyPlanService] Starting generateAndStoreCurrentWeekPlanForUser for user: ${userId}`);

    const onboardingData = await getUserOnboardingData(userId);
    if (!onboardingData) {
      console.error(`[weeklyPlanService] Failed to get onboarding data for user: ${userId}`);
      return false;
    }

    const todayServer = new Date(); // Server's current date
    todayServer.setUTCHours(0,0,0,0); // Normalize to start of UTC day for comparisons
    const todayServerDateUtcString = todayServer.toISOString().split('T')[0];

    // Determine the Monday of the current week based on server's today
    const dayOfWeekServer = todayServer.getUTCDay(); // Sunday = 0, Monday = 1, ...
    const mondayOfCurrentWeekServer = new Date(todayServer);
    mondayOfCurrentWeekServer.setUTCDate(todayServer.getUTCDate() - (dayOfWeekServer === 0 ? 6 : dayOfWeekServer - 1));
    const mondayOfCurrentWeekServerUtcString = mondayOfCurrentWeekServer.toISOString().split('T')[0];
    
    const sundayOfCurrentWeekServer = new Date(mondayOfCurrentWeekServer);
    sundayOfCurrentWeekServer.setUTCDate(mondayOfCurrentWeekServer.getUTCDate() + 6);
    const sundayOfCurrentWeekServerUtcString = sundayOfCurrentWeekServer.toISOString().split("T")[0];

    // 1. Fetch existing sessions for the target week to check for interactions
    const { data: existingSessions, error: fetchError } = await supabase
      .from('training_plans')
      .select('id, date, status, post_session_notes')
      .eq('user_id', userId)
      .gte('date', mondayOfCurrentWeekServerUtcString)
      .lte('date', sundayOfCurrentWeekServerUtcString);

    if (fetchError) {
      console.error(`[weeklyPlanService] Error fetching existing sessions for user ${userId}:`, fetchError);
      return false; // Critical error, cannot proceed safely
    }

    let hasInteractedSessionsInTargetWeek = false;
    if (existingSessions) {
      for (const session of existingSessions) {
        if (session.status !== 'not_completed' || (session.post_session_notes && session.post_session_notes.trim() !== '')) {
          hasInteractedSessionsInTargetWeek = true;
          break;
        }
      }
    }
    console.log(`[weeklyPlanService] User ${userId} hasInteractedSessionsInTargetWeek: ${hasInteractedSessionsInTargetWeek}`);

    // 2. Conditional Deletion Logic
    if (!hasInteractedSessionsInTargetWeek) {
      // No interactions, safe to clear the whole target week from its Monday
      console.log(`[weeklyPlanService] No interacted sessions found for target week. Removing all sessions from ${mondayOfCurrentWeekServerUtcString} for user ${userId}`);
      await removeWorkoutsFromDate(userId, mondayOfCurrentWeekServerUtcString);
    } else {
      // Interactions found, only clear from today (server time) onwards
      console.log(`[weeklyPlanService] Interacted sessions found. Removing sessions from ${todayServerDateUtcString} (today server) onwards for user ${userId}`);
      await removeWorkoutsFromDate(userId, todayServerDateUtcString);
    }

    // 3. Generate new 7-day plan for the current week (Mon-Sun)
    // generateWeeklyPlan is expected to return sessions for the week containing the current server date, starting from its Monday.
    const newSessions = await generateWeeklyPlan(userId, onboardingData, false); // includeCurrentWeek = false as we target the current week based on server date

    if (!newSessions || newSessions.length === 0) {
      console.error(`[weeklyPlanService] No sessions generated by generateWeeklyPlan for user: ${userId}`);
      return false; 
    }
    console.log(`[weeklyPlanService] Generated ${newSessions.length} new workouts for user: ${userId}`);

    // 4. Save New Sessions (Careful Merge/Insert)
    const sessionsToInsert = [];
    for (const newSession of newSessions) {
      const newSessionDate = new Date(newSession.date);
      newSessionDate.setUTCHours(0,0,0,0);

      if (newSessionDate < todayServer && hasInteractedSessionsInTargetWeek) {
        // This new session is for a past day within a week that had interactions.
        // Check if an interacted session already exists for this specific past day.
        const existingInteractedPastSession = existingSessions?.find(es => 
          es.date === newSession.date && 
          (es.status !== 'not_completed' || (es.post_session_notes && es.post_session_notes.trim() !== ''))
        );
        if (existingInteractedPastSession) {
          console.log(`[weeklyPlanService] Skipping save for newly generated past session on ${newSession.date} as an interacted session already exists for user ${userId}`);
          continue; // Skip inserting this new past session, prioritize existing interacted one
        }
      }
      // If not a skipped past session, prepare it for insert
      sessionsToInsert.push({
        user_id: userId,
        week_number: newSession.week_number,
        day_of_week: newSession.day_of_week,
        session_type: newSession.session_type,
        date: newSession.date,
        distance: newSession.distance,
        time: newSession.time,
        notes: newSession.notes,
        status: 'not_completed', // New sessions are always not_completed
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    if (sessionsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('training_plans')
        .insert(sessionsToInsert);

      if (insertError) {
        console.error(`[weeklyPlanService] Error inserting new weekly plan sessions for user ${userId}:`, insertError);
        return false;
      }
      console.log(`[weeklyPlanService] Successfully inserted ${sessionsToInsert.length} new plan sessions for user ${userId}`);
    } else {
      console.log(`[weeklyPlanService] No new sessions needed to be inserted for user ${userId} (e.g., all were past, interacted days).`);
    }
    
    return true;

  } catch (error) {
    console.error(`[weeklyPlanService] Exception in generateAndStoreCurrentWeekPlanForUser for user ${userId}:`, error);
    return false;
  }
}

/**
 * @deprecated This function is being replaced by generateAndStoreCurrentWeekPlanForUser and client-initiated updates.
 * Original function to generate and save a new weekly training plan for a user.
 */
export async function refreshWeeklyPlan(userId: string): Promise<boolean> {
  try {
    console.warn('[weeklyPlanService] DEPRECATED refreshWeeklyPlan called for user:', userId, 'Consider updating to generateAndStoreCurrentWeekPlanForUser or client-initiated flow.');
    // Minimal original logic for reference or if called by old paths, but without feedback processing.
    const onboardingData = await getUserOnboardingData(userId);
    if (!onboardingData) {
      console.error('[weeklyPlanService] Failed to get onboarding data for plan refresh (deprecated path)');
      return false;
    }
    const today = new Date();
    const todayFormatted = today.toISOString().split('T')[0];
    await removeWorkoutsFromDate(userId, todayFormatted); // Simple remove from today
    const sessions = await generateWeeklyPlan(userId, onboardingData);
    if (!sessions || sessions.length === 0) {
      console.error('[weeklyPlanService] No sessions generated (deprecated path)');
      return false;
    }
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
    const { error: insertError } = await supabase.from('training_plans').insert(sessionRows);
    if (insertError) {
      console.error('[weeklyPlanService] Error inserting (deprecated path):', insertError);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[weeklyPlanService] Error in DEPRECATED refreshWeeklyPlan:', error);
    return false;
  }
}

/**
 * Check and refresh plans for all active users
 * @deprecated This global refresh approach is being superseded by client-initiated individual updates.
 * It should be modified or retired.
 */
export async function refreshAllUserPlans(): Promise<{
  success: boolean;
  refreshed: number;
  failed: number;
  skipped: number;
}> {
  console.warn("[weeklyPlanService] DEPRECATED refreshAllUserPlans called. This process is moving to client-initiated updates.");
  const result = {
    success: true, // Default to true as it might do nothing or only partial work now
    refreshed: 0,
    failed: 0,
    skipped: 0
  };
  
  // try {
  //   const { data: users, error: usersError } = await supabase
  //     .from('profiles')
  //     .select('id');
      
  //   if (usersError) {
  //     console.error('[weeklyPlanService] Error fetching users (deprecated refreshAllUserPlans):', usersError);
  //     result.success = false;
  //     return result;
  //   }
    
  //   if (!users || users.length === 0) {
  //     console.log('[weeklyPlanService] No users found (deprecated refreshAllUserPlans)');
  //     return result;
  //   }
    
  //   console.log(`[weeklyPlanService] DEPRECATED: Checking ${users.length} users for plan refresh. Consider client-initiated flow.`);
    
  //   for (const user of users) {
  //     try {
  //       const needsRefresh = await checkNeedsRefresh(user.id);
  //       if (needsRefresh) {
  //         // IMPORTANT: The call to processWeeklyTrainingFeedback is REMOVED here
  //         // as it's overly redundant if this script is still run globally after the main script's global feedback pass.
  //         // The new fn_request_weekly_plan_update handles its own feedback round.
  //         console.log(`[weeklyPlanService] DEPRECATED: Refreshing plan for user ${user.id}`);
  //         const refreshed = await refreshWeeklyPlan(user.id); // Uses the now-deprecated refreshWeeklyPlan
  //         if (refreshed) {
  //           result.refreshed++;
  //         } else {
  //           console.warn(`[weeklyPlanService] DEPRECATED: Failed to refresh plan for user ${user.id}`);
  //           result.failed++;
  //         }
  //       } else {
  //         result.skipped++;
  //       }
  //     } catch (error) {
  //       console.error(`[weeklyPlanService] DEPRECATED: Error processing user ${user.id} in refreshAllUserPlans:`, error);
  //       result.failed++;
  //     }
  //   }
    
  //   result.success = result.failed === 0;
  //   console.log(`[weeklyPlanService] DEPRECATED refreshAllUserPlans complete. Refreshed: ${result.refreshed}, Skipped: ${result.skipped}, Failed: ${result.failed}`);
  // } catch (error) {
  //   console.error('[weeklyPlanService] DEPRECATED: Error in refreshAllUserPlans:', error);
  //   result.success = false;
  // }
  
  return result;
} 