import { TrainingSession } from '../../../types/training';

/**
 * Get coach personality traits for plan generation
 */
export function getCoachPersonality(coachId: string): string {
  switch(coachId) {
    case 'craig':
      return 'You are Coach Craig - motivational, science-focused, and analytical. You emphasize structured workouts with clear purpose.';
    case 'thomas':
      return 'You are Coach Thomas - warm, encouraging, and supportive. You focus on enjoyment and sustainable training.';
    case 'dathan':
      return 'You are Coach Dathan - competitive, direct, and results-oriented. You push runners to reach their potential with challenging but achievable plans.';
    default:
      return 'You are a balanced coach who provides structured, evidence-based training plans tailored to individual needs.';
  }
}

/**
 * Get the next Sunday's date (including today if it's Sunday)
 */
export function getNextSunday(fromDate: Date = new Date()): Date {
  const result = new Date(fromDate);
  const day = result.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // If today is not Sunday, move to next Sunday
  if (day !== 0) {
    result.setDate(result.getDate() + (7 - day));
  }
  
  // Set to end of day
  result.setHours(23, 59, 59, 999);
  
  return result;
}

/**
 * Format chat summaries into a string for the prompt
 */
export function formatChatSummaries(summaries: any[]): string {
  if (!summaries || summaries.length === 0) {
    return "No recent conversation history available.";
  }
  
  return summaries.map((summary, index) => {
    const typeLabel = summary.chat_type === 'workout' ? 'Workout discussion' :
                      summary.chat_type === 'topic' ? `Topic: ${summary.topic}` :
                      'General coaching';
    return `${index + 1}. ${typeLabel}: ${summary.summary}`;
  }).join('\n');
}

/**
 * Convert generator sessions to match expected training type
 */
export function convertToTrainingType(sessions: TrainingSession[]): any[] {
  return sessions.map(session => ({
    ...session,
    id: session.id || '',
    status: session.status || 'not_completed'
  }));
}

/**
 * Build the prompt for the weekly plan generation
 */
export function buildWeeklyPlanPrompt({
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
}: {
  mondayStr: string;
  sundayStr: string;
  weeksSincePlanStart: number;
  trainingPhase: string;
  coachPersonality: string;
  formattedChatSummaries: string;
  longRunSummary: string | null;
  intervalSummary: string | null;
  easySummary: string | null;
  feedbackSection: string;
  completionStats: {
    completionRate: number;
    avgDistanceCompleted: number;
    commonSkippedTypes: string[];
  };
  struggleSection: string;
  units: string;
  trainingFrequency: number;
  currentMileage: string | number;
  userProfile: any;
  onboardingData: any;
  trainingPreferencesSection: string;
}): string {
  return `You are an expert running coach creating a personalized weekly training plan.

Please fill out this training plan form for ${userProfile?.display_name || onboardingData.nickname || 'Runner'} for next week:

WEEK DETAILS:
Start Date: ${mondayStr} (Monday)
End Date: ${sundayStr} (Sunday)
Week Number: ${weeksSincePlanStart + 1}
Phase: ${trainingPhase}

COACH STYLE: ${coachPersonality}

PHASE DESCRIPTION: The runner is in the "${trainingPhase}" phase. This means:
${trainingPhase === 'Base' ? '- Focus on building a foundation with mostly easy runs.' :
  trainingPhase === 'Build' ? '- Progressively increase volume by ~5% per week. Include some quality workouts.' :
  trainingPhase === 'Recovery' ? '- Lower volume and intensity to allow for recovery.' :
  '- Focus on running consistently with a mix of easy and moderate efforts.'}

For each day next week, provide:
- Type: [Type of workout]
- Distance: [X ${units}]
- Time: [X minutes]
- Notes: [Add notes about pace, terrain, or specific instructions]

CRITICAL FREQUENCY REQUIREMENT: The runner trains ${onboardingData.trainingFrequency} days per week (${trainingFrequency} days). Your training plan MUST match this frequency exactly or only deviate by at most +/- 1 day per week. If the frequency is less than 7 days, leave the appropriate days as rest days or remove them completely.

CRITICAL VOLUME REQUIREMENT: The runner currently does about ${currentMileage} ${units} per week. Maintain this volume in ${trainingPhase} phase, with any changes based on recent performance and feedback.

RECENT PERFORMANCE INSIGHTS:
${formattedChatSummaries}

RECENT WORKOUT FEEDBACK:
${longRunSummary ? `- Long Run Feedback: ${longRunSummary}` : '- No recent long run feedback'}
${intervalSummary ? `- Interval Workout Feedback: ${intervalSummary}` : '- No recent interval workout feedback'}
${easySummary ? `- Easy Run Feedback: ${easySummary}` : '- No recent easy run feedback'}${feedbackSection}

WORKOUT COMPLETION PATTERNS:
- Overall completion rate: ${Math.round(completionStats.completionRate * 100)}%
- Average distance completed: ${completionStats.avgDistanceCompleted.toFixed(1)} ${units}
${completionStats.commonSkippedTypes.length > 0 ? `- Most commonly skipped: ${completionStats.commonSkippedTypes.join(', ')}` : '- No pattern of skipped workouts'}${struggleSection}

Runner Profile:
- Name: ${userProfile?.display_name || onboardingData.nickname || 'Runner'}
- Experience: ${userProfile?.running_experience || onboardingData.experienceLevel}
- Current Weekly Volume: ${currentMileage} ${units}
- Training Frequency: ${trainingFrequency} days per week
- Preferences: ${trainingPreferencesSection}
- Injury History: ${userProfile?.injury_history || onboardingData.injury_history || 'None'}

Fill out the training sessions for each training day next week. For rest days, either omit them or explicitly mark them as "Rest Day" with no distance/time.`;
} 