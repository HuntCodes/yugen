import Constants from 'expo-constants';
import { OnboardingData, TrainingSession } from '../../types/training';
import { getRelevantChatSummaries } from '../../services/summary/chatSummaryService';
import { getLatestTrainingFeedback } from '../../services/feedback/trainingFeedbackService';
import { supabase } from './supabase';
import {
  getNextSunday,
  formatChatSummaries,
  buildWeeklyPlanPrompt,
  getCoachPersonality,
  extractTrainingFrequency,
  getRecentWorkoutSummary,
  getWorkoutCompletionStats,
  prepareTrainingFeedback,
  callOpenAIForPlanGeneration,
  parseAIResponseToSessions,
  calculateCyclicalPhase
} from './plan';

// this is the file where the ongoing weekly training plan is generated

/**
 * Generate a weekly training plan with user feedback incorporated
 */
export async function generateWeeklyPlan(
  userId: string, 
  onboardingData: OnboardingData,
  includeCurrentWeek: boolean = true
): Promise<TrainingSession[]> {
  console.log('Starting weekly training plan generation with data:', onboardingData);
  
  // Get next Monday's date
  const today = new Date();
  const nextMonday = new Date(today);
  const daysUntilMonday = (8 - today.getDay()) % 7;
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  
  // Calculate end date (Sunday)
  const endDate = new Date(nextMonday);
  endDate.setDate(nextMonday.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);
  
  // Format dates for the prompt
  const mondayStr = nextMonday.toISOString().split('T')[0];
  const sundayStr = endDate.toISOString().split('T')[0];

  // Get user's current fitness level and training information
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId);
    
  if (profileError) {
    console.error('Error fetching user profile:', profileError);
  }
  
  const userProfile = profileData && profileData.length > 0 ? profileData[0] : null;
  
  // Get plan start date from profiles or default to today
  let planStartDate = today;
  if (userProfile?.plan_start_date) {
    planStartDate = new Date(userProfile.plan_start_date);
  }

  // Get coach ID from profile - important for plan style
  const coachId = userProfile?.coach_id || 'dathan'; // Default to Dathan if no coach selected
  console.log(`Using coach_id: ${coachId} for generating training plan`);

  // Calculate week number (relative to plan start)
  const weeksSincePlanStart = Math.floor((nextMonday.getTime() - planStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
  
  // Calculate training phase using cyclical pattern
  const trainingPhase = calculateCyclicalPhase(weeksSincePlanStart);
  console.log('Current training phase:', trainingPhase, 'for week', weeksSincePlanStart);
  
  // Get recent chat summaries for context
  const chatSummaries = await getRelevantChatSummaries(userId, undefined, undefined, 5);
  const formattedChatSummaries = formatChatSummaries(chatSummaries);
  
  // Get recent workout note summaries
  const longRunSummary = await getRecentWorkoutSummary(userId, 'Long Run');
  const intervalSummary = await getRecentWorkoutSummary(userId, 'Interval');
  const easySummary = await getRecentWorkoutSummary(userId, 'Easy Run');
  
  // Get workout completion statistics
  const completionStats = await getWorkoutCompletionStats(userId);
  
  // Get latest training feedback
  const trainingFeedback = await getLatestTrainingFeedback(userId);
  
  // Extract current running volume from profile or use the one from onboarding
  const currentMileage = userProfile?.weekly_volume || onboardingData.current_mileage || 'Not specified';
  const units = userProfile?.units || onboardingData.units || 'km';
  
  // Extract numeric training frequency from onboarding text
  const trainingFrequency = extractTrainingFrequency(onboardingData.trainingFrequency);
  
  // Prepare training feedback for the prompt
  const { 
    trainingPreferencesSection, 
    struggleSection, 
    feedbackSection 
  } = prepareTrainingFeedback(trainingFeedback, userProfile, onboardingData);
  
  // Get coach personality traits to use in prompt
  const coachPersonality = getCoachPersonality(coachId);
  
  // Build the prompt for plan generation
  const prompt = buildWeeklyPlanPrompt({
    mondayStr,
    sundayStr,
    weeksSincePlanStart,
    trainingPhase,
    coachPersonality,
    formattedChatSummaries,
    longRunSummary,
    intervalSummary,
    easySummary,
    feedbackSection,
    completionStats,
    struggleSection,
    units,
    trainingFrequency,
    currentMileage,
    userProfile,
    onboardingData,
    trainingPreferencesSection
  });

  try {
    // Call OpenAI to generate the plan
    const content = await callOpenAIForPlanGeneration(prompt);
    
    // Parse the response into training sessions
    return await parseAIResponseToSessions(
      content, 
      units, 
      weeksSincePlanStart, 
      trainingPhase,
      trainingFrequency,
      currentMileage
    );
  } catch (err) {
    console.error('Error generating weekly plan:', err);
    throw err;
  }
} 