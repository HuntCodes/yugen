import Constants from 'expo-constants';

import { OnboardingData, TrainingSession } from '../../../types/training';
import { supabase } from '../../supabase';
import { generateWeeklyFallbackPlan } from '../../utils/training';

/**
 * Make OpenAI API call to generate a training plan based on a prompt
 */
export async function callOpenAIForPlanGeneration(prompt: string): Promise<string> {
  // Ensure API key exists
  const apiKey =
    Constants.expoConfig?.extra?.openaiApiKey ||
    Constants.expoConfig?.extra?.OPENAI_API_KEY ||
    (Constants.manifest as any)?.extra?.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('OpenAI API key not found in any format');
    throw new Error('OpenAI API key not found');
  }

  console.log('Sending OpenAI request for weekly plan');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful, expert running coach. Create personalized training plans by filling in the form template provided. Be specific and detailed in your responses. Incorporate user feedback and adapt plans based on their progress patterns.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1800,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', { status: response.status, error: errorText });
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    console.error('No content in OpenAI response:', data);
    throw new Error('No plan generated: Empty response from OpenAI');
  }

  console.log('Received OpenAI response, content length:', content.length);
  return content;
}

/**
 * Get workout completion statistics for a user
 */
export async function getWorkoutCompletionStats(userId: string): Promise<{
  totalWorkouts: number;
  completedWorkouts: number;
  completionRate: number;
  avgDistanceCompleted: number;
  commonSkippedTypes: string[];
}> {
  try {
    // Get all workouts from the past month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const { data: workouts, error } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .gte('date', oneMonthAgo.toISOString().split('T')[0]);

    if (error || !workouts) {
      return {
        totalWorkouts: 0,
        completedWorkouts: 0,
        completionRate: 0,
        avgDistanceCompleted: 0,
        commonSkippedTypes: [],
      };
    }

    // Calculate statistics
    const totalWorkouts = workouts.length;
    const completedWorkouts = workouts.filter((w) => w.status === 'completed').length;
    const completionRate = totalWorkouts > 0 ? completedWorkouts / totalWorkouts : 0;

    // Calculate average distance completed
    const completedDistances = workouts
      .filter((w) => w.status === 'completed')
      .map((w) => w.distance);
    const avgDistanceCompleted =
      completedDistances.length > 0
        ? completedDistances.reduce((sum, dist) => sum + dist, 0) / completedDistances.length
        : 0;

    // Find most commonly skipped workout types
    const skippedWorkouts = workouts.filter((w) => w.status === 'skipped' || w.status === 'missed');
    const typeCount: Record<string, number> = {};

    skippedWorkouts.forEach((workout) => {
      const type = workout.session_type;
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    // Sort by count and get top types
    const commonSkippedTypes = Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);

    return {
      totalWorkouts,
      completedWorkouts,
      completionRate,
      avgDistanceCompleted,
      commonSkippedTypes,
    };
  } catch (error) {
    console.error('Error getting workout completion stats:', error);
    return {
      totalWorkouts: 0,
      completedWorkouts: 0,
      completionRate: 0,
      avgDistanceCompleted: 0,
      commonSkippedTypes: [],
    };
  }
}

/**
 * Parse the AI response into training sessions
 */
export async function parseAIResponseToSessions(
  content: string,
  units: string,
  weeksSincePlanStart: number,
  trainingPhase: string,
  trainingFrequency: number,
  currentMileage: string | number
): Promise<TrainingSession[]> {
  try {
    // For now, we'll use the fallback plan generator since the text parser doesn't exist
    // This ensures we always return a valid plan
    console.log('Using fallback plan generator for consistent results');

    const weeklyVolume = parseFloat(String(currentMileage).replace(/[^\d.]/g, '') || '20');
    let sessions = generateWeeklyFallbackPlan(
      trainingFrequency,
      weeklyVolume,
      units,
      trainingPhase
    );

    // Add week number and phase to all sessions
    sessions = sessions.map((session: TrainingSession) => ({
      ...session,
      week_number: weeksSincePlanStart + 1,
      phase: trainingPhase,
    }));

    // Update dates to current week
    const today = new Date();
    const currentDay = today.getDay(); // 0 (Sunday) to 6 (Saturday)
    const mondayOfCurrentWeek = new Date(today);
    mondayOfCurrentWeek.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    mondayOfCurrentWeek.setHours(0, 0, 0, 0);

    sessions = sessions.map((session: TrainingSession) => {
      const sessionDate = new Date(mondayOfCurrentWeek);
      sessionDate.setDate(mondayOfCurrentWeek.getDate() + session.day_of_week - 1);
      return {
        ...session,
        date: sessionDate.toISOString().split('T')[0],
      };
    });

    console.log('Successfully generated training plan with sessions:', sessions.length);
    return sessions;
  } catch (err) {
    console.error('Error generating training plan:', err);

    // Final fallback to basic plan if everything fails
    console.log(
      `Using basic fallback plan with frequency: ${trainingFrequency} and volume: ${currentMileage} ${units}`
    );
    const weeklyVolume = parseFloat(String(currentMileage).replace(/[^\d.]/g, '') || '20');
    const sessions = generateWeeklyFallbackPlan(
      trainingFrequency,
      weeklyVolume,
      units,
      trainingPhase
    );

    // Add week number to fallback sessions
    return sessions.map((session: TrainingSession) => ({
      ...session,
      week_number: weeksSincePlanStart + 1,
    }));
  }
}
