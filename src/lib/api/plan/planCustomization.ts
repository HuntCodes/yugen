import { supabase } from '../../supabase';
import { TrainingSession } from '../../../types/training';

/**
 * Extract the numeric training frequency from the training frequency text
 */
export function extractTrainingFrequency(trainingFrequency: string): number {
  // Try to extract a number from the string
  const matches = trainingFrequency.match(/(\d+)/);
  if (matches && matches[1]) {
    const frequency = parseInt(matches[1], 10);
    // Sanity check - only accept 1-7 days per week
    if (frequency >= 1 && frequency <= 7) {
      return frequency;
    }
  }
  
  // If we couldn't extract a number, try to interpret common phrases
  const loweredText = trainingFrequency.toLowerCase();
  if (loweredText.includes('once a week') || loweredText.includes('1 day')) {
    return 1;
  } else if (loweredText.includes('twice a week') || loweredText.includes('2 day')) {
    return 2;
  } else if (loweredText.includes('three') || loweredText.includes('3 day')) {
    return 3;
  } else if (loweredText.includes('four') || loweredText.includes('4 day')) {
    return 4;
  } else if (loweredText.includes('five') || loweredText.includes('5 day')) {
    return 5;
  } else if (loweredText.includes('six') || loweredText.includes('6 day')) {
    return 6;
  } else if (loweredText.includes('seven') || loweredText.includes('every day') || loweredText.includes('7 day')) {
    return 7;
  }
  
  // Default to 3 days if we can't determine
  return 3;
}

/**
 * Get a single recent workout summary for a specific user and workout type
 */
export async function getRecentWorkoutSummary(userId: string, workoutType: string): Promise<string | null> {
  try {
    // Find a recent workout of this type
    const { data: workouts, error } = await supabase
      .from('training_plans')
      .select('id, date')
      .eq('user_id', userId)
      .eq('session_type', workoutType)
      .eq('status', 'completed')
      .order('date', { ascending: false })
      .limit(1);
      
    if (error || !workouts || workouts.length === 0) {
      return null;
    }
    
    // Get the summary for this workout
    return await getWorkoutNoteSummary(workouts[0].id, userId);
  } catch (error) {
    console.error(`Error getting recent workout summary for ${workoutType}:`, error);
    return null;
  }
}

/**
 * Helper function to get workout note summary
 * This is a placeholder - you'll need to implement this or import from the actual service
 */
async function getWorkoutNoteSummary(workoutId: string, userId: string): Promise<string | null> {
  try {
    // Implement or import from the actual workout note service
    const { data, error } = await supabase
      .from('training_plans')
      .select('post_session_notes')
      .eq('id', workoutId)
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data.post_session_notes;
  } catch (error) {
    console.error('Error getting workout note summary:', error);
    return null;
  }
}

/**
 * Prepare training feedback for plan generation prompt
 * Returns sections for preferences, struggles, and overall feedback
 */
export function prepareTrainingFeedback(trainingFeedback: any, userProfile: any, onboardingData: any): {
  trainingPreferencesSection: string;
  struggleSection: string;
  feedbackSection: string;
} {
  let trainingPreferencesSection = userProfile?.training_preferences || onboardingData.trainingPreferences || 'None specified';
  let struggleSection = '';
  let feedbackSection = '';
  
  if (trainingFeedback) {
    if (trainingFeedback.prefers && trainingFeedback.prefers.length > 0) {
      trainingPreferencesSection = trainingFeedback.prefers.join(', ');
    }
    if (trainingFeedback.struggling_with && trainingFeedback.struggling_with.length > 0) {
      struggleSection = `\nSTRUGGLING WITH:
${trainingFeedback.struggling_with.map((item: string) => `- ${item}`).join('\n')}`;
    }
    if (trainingFeedback.feedback_summary) {
      feedbackSection = `\nRECENT TRAINING FEEDBACK:
${trainingFeedback.feedback_summary}`;
    }
  }
  
  return {
    trainingPreferencesSection,
    struggleSection,
    feedbackSection
  };
}

/**
 * Add week number and phase information to all sessions
 */
export function addWeekInfoToSessions(sessions: TrainingSession[], weekNumber: number, phase: string): TrainingSession[] {
  return sessions.map(session => ({
    ...session,
    week_number: weekNumber,
    phase: phase
  }));
} 