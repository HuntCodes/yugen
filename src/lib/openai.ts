import Constants from 'expo-constants';
import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid'; // For generating IDs if AI doesn't

import { getTrainingPhase, generateFallbackPlan, extractTrainingFrequency } from './utils/training';
import {
  getLocationForPlanGeneration,
  formatLocationForPrompt,
} from '../services/location/locationForPlanService';
import { TrainingSession, OnboardingData } from '../types/training';

// this is the file where the INITAL training plan is generated

// Use imported types instead of local interface declarations
export { TrainingSession, OnboardingData };

export async function generateTrainingPlan(onboarding: OnboardingData): Promise<TrainingSession[]> {
  console.log(
    '[OpenAI] Starting initial training plan generation with data (Function Calling):',
    onboarding
  );

  // Get user location for training location suggestions
  const locationInfo = await getLocationForPlanGeneration();
  const locationString = formatLocationForPrompt(locationInfo);

  console.log(
    '[OpenAI] User location for plan generation:',
    locationString || 'Location not available'
  );

  let apiKey: string | undefined = undefined;
  const envApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

  if (envApiKey) {
    apiKey = envApiKey.replace(/["\']/g, '').trim();
  } else {
    const configKey =
      Constants.expoConfig?.extra?.openaiApiKey ||
      Constants.expoConfig?.extra?.OPENAI_API_KEY ||
      // @ts-ignore
      (Constants.manifest as any)?.extra?.OPENAI_API_KEY;
    if (configKey) {
      apiKey = String(configKey).replace(/["\']/g, '').trim();
    }
  }

  if (!apiKey) {
    console.error('[OpenAI] API key not found.');
    throw new Error('OpenAI API key not found');
  }

  let today: Date;
  if (onboarding.userStartDate) {
    const [year, month, day] = onboarding.userStartDate.split('-').map(Number);
    today = new Date(Date.UTC(year, month - 1, day));
  } else {
    console.error(
      "[OpenAI] CRITICAL: userStartDate not provided. Falling back to server's current date."
    );
    const serverNow = new Date();
    today = new Date(
      Date.UTC(serverNow.getUTCFullYear(), serverNow.getUTCMonth(), serverNow.getUTCDate())
    );
  }

  const nextSunday = new Date(today);
  const daysUntilSunday = 7 - today.getDay();
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  nextSunday.setHours(23, 59, 59, 999);

  const weekTwoStart = new Date(nextSunday);
  weekTwoStart.setDate(nextSunday.getDate() + 1);
  weekTwoStart.setHours(0, 0, 0, 0);

  const weekTwoEnd = new Date(weekTwoStart);
  weekTwoEnd.setDate(weekTwoStart.getDate() + 6);
  weekTwoEnd.setHours(23, 59, 59, 999);

  const formatLocalDate = (date: Date): string => {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };

  const currentDateStr = formatLocalDate(today);
  const nextSundayStr = formatLocalDate(nextSunday);
  const weekTwoStartStr = formatLocalDate(weekTwoStart);
  const weekTwoEndStr = formatLocalDate(weekTwoEnd);

  const trainingFrequency = extractTrainingFrequency(onboarding.trainingFrequency);
  const currentMileage = onboarding.current_mileage || 'Not specified';
  const units = onboarding.units || 'km';

  const systemPrompt = `You are an expert running coach. Your task is to generate a personalized 2-week initial training plan.
After creating the plan, you MUST call the 'save_initial_training_plan' function with the structured plan data.

🚨 SCHEDULE CONSTRAINTS - HIGHEST PRIORITY:
The user's schedule constraints are MANDATORY and must be strictly followed. These are non-negotiable:
- If user says "I can't run on Tuesdays" → NEVER schedule runs on Tuesdays
- If user says "I prefer morning runs" → Schedule sessions in morning time ranges where possible
- If user says "I work late Mondays/Wednesdays" → Avoid evening sessions on those days
- If user says "I have commitments on weekends" → Adjust weekend long runs accordingly
- Any time/day restrictions mentioned by the user are absolute constraints
- When in doubt about constraints, choose the more conservative interpretation
- Schedule conflicts should be avoided entirely, not just "worked around"

VOLUME REQUIREMENTS:
- The total weekly distance for each week MUST closely match the user's current weekly volume (within 10-15%).
- For high-mileage runners (80+ km/week or 50+ miles/week), consider double days (multiple sessions per day).
- Track cumulative distance as you create each session to ensure weekly targets are met.
- Prioritize meeting volume requirements over session count preferences if needed.
- ⚠️ IMPORTANT: Schedule constraints take precedence over volume - if constraints limit available days, adjust session intensity/duration to maintain volume within those constraints.

PROGRESSION PRINCIPLES:
- Week 1: Establish baseline fitness and routine, conservative approach
- Week 2: Build on Week 1 with appropriate progression and variety
- NEVER create identical weeks - each week should show thoughtful progression
- Vary session types, distances, and intensities while maintaining total volume
- For beginners: focus on consistency and gradual adaptation
- For experienced runners: introduce appropriate variety and challenge

DOUBLE DAY GUIDANCE:
- For 80-120 km/week: Include 1-2 double days per week (easy run + workout, or easy AM + easy PM)
- For 120+ km/week: Include 2-4 double days per week
- Double days should typically be: morning easy run (30-60 min) + afternoon workout OR two easy runs
- Format double days as separate session objects with the same date but different session_type (e.g., "Easy Run (AM)" and Double Run (PM)")
- ⚠️ CONSTRAINT CHECK: Only schedule double days if user's schedule constraints allow for multiple sessions per day

TECHNICAL REQUIREMENTS:
The plan should consist of an array of session objects. Each session object must conform to the schema provided for the 'save_initial_training_plan' function.
Ensure all required fields (date, day_of_week, week_number, phase, session_type) are populated for every session.
Set 'phase' to 'Base' for both weeks. For Week 1 (partial week), set 'week_number' to 1. For Week 2 (full week), set 'week_number' to 2.
Calculate 'day_of_week' (1=Monday, 7=Sunday) based on the session's 'date'.
Provide 'distance' in ${units} and 'time' in minutes. If a session is 'Rest', distance and time can be null or 0.
Include notes for pace, terrain, or specific instructions as appropriate.

VOLUME VERIFICATION:
Before calling the function, mentally calculate the total weekly distance for each week and ensure it matches the target volume.

LOCATION GUIDANCE:
${
  locationString
    ? `The user is based in ${locationString}. For the suggested_location field, suggest appropriate training locations for each workout within a 40km radius:
- Easy runs: Local parks, neighborhood routes, or running paths
- Intervals/Track workouts: Athletics tracks or sports ovals  
- Long runs: Trails, parks, or scenic routes suitable for extended running
- Tempo/Threshold runs: Parks or quiet roads with consistent surfaces
- Hills: Parks or areas with elevation suitable for hill training
- Use shorter, common names for locations
- Only suggest locations you are confident exist in or near ${locationString}
- If you cannot suggest a specific location based on your knowledge, set suggested_location to null`
    : 'User location not available. Set suggested_location to null for all sessions.'
}

Remember to call 'save_initial_training_plan' with the complete list of sessions for these two weeks. Structure each session according to the function's requirements and ensure total weekly volume matches the target.`;

  const userPrompt = `Please generate a 2-week initial training plan for the following runner and then call the 'save_initial_training_plan' function.

Plan Details:
- Week 1 (Partial Week): Start Date: ${currentDateStr} (user's signup day), End Date: ${nextSundayStr} (this Sunday). Only include sessions from signup day onwards.
- Week 2 (Full Week): Start Date: ${weekTwoStartStr} (Monday), End Date: ${weekTwoEndStr} (Sunday). This is the first full week.

🚨 CRITICAL SCHEDULE CONSTRAINTS - MUST FOLLOW:
${onboarding.schedule_constraints && onboarding.schedule_constraints !== 'None' 
  ? `MANDATORY CONSTRAINTS: ${onboarding.schedule_constraints}
  
⚠️ These constraints are NON-NEGOTIABLE. The training plan MUST work around these restrictions.
⚠️ If constraints limit available training days, adjust session intensity/duration to maintain volume.
⚠️ Better to have fewer, longer sessions than to violate the user's schedule constraints.`
  : `No specific schedule constraints provided - you have full flexibility with scheduling.`
}

Runner Profile:
- Name: ${onboarding.nickname || 'Runner'}
- Goal: ${onboarding.goalType}
- Experience: ${onboarding.experienceLevel}
- Current Weekly Volume: ${currentMileage} ${units} ⚠️ CRITICAL: The plan MUST match this weekly volume (within 10-15%)
- Desired Training Frequency: ${onboarding.trainingFrequency} (${trainingFrequency} days per week). ${trainingFrequency >= 6 ? 'NOTE: High frequency may require double days to meet volume targets.' : 'Adhere to this frequency strictly or deviate by at most +/- 1 day per week.'}
- Current Signup Date: ${currentDateStr}.
- Units for Plan: ${units}
- Injury History: ${onboarding.injury_history || 'None'}

VOLUME TARGETS:
- Week 1 target: ${currentMileage} ${units} (or proportional if partial week)
- Week 2 target: ${currentMileage} ${units}

PROGRESSION GUIDANCE:
- Week 1 should focus on establishing a routine and assessing the runner's current fitness
- Week 2 should build slightly on Week 1 with minor progressions or variations:
  * Different session types (if Week 1 had easy runs, Week 2 could include strides or tempo)
  * Vary terrain or intensity within the same total volume
  * For beginners: focus on consistency and gradual adaptation
  * For experienced runners: introduce more variety in session types
- Maintain similar total weekly volume but vary the distribution and session types
- Avoid creating identical weeks - each week should feel like a natural progression
${
  parseFloat(String(currentMileage).replace(/[^\d.]/g, '') || '0') >= 80
    ? `
HIGH MILEAGE RUNNER DETECTED (${currentMileage}):
- Consider 1-4 double days per week depending on volume
- Double sessions can be: Easy AM + Workout PM, or Easy AM + Easy PM
- Typical double day structure: 30-60 min easy run + main workout later
- ⚠️ CONSTRAINT CHECK: Only use double days if schedule constraints allow multiple daily sessions
`
    : ''
}

Remember to call 'save_initial_training_plan' with the complete list of sessions for these two weeks. Structure each session according to the function's requirements and ensure total weekly volume matches the target.`;

  const tools = [
    {
      type: 'function',
      function: {
        name: 'save_initial_training_plan',
        description: 'Saves the generated 2-week initial training plan for the user.',
        parameters: {
          type: 'object',
          properties: {
            sessions: {
              type: 'array',
              description: 'An array of training session objects for the first two weeks.',
              items: {
                type: 'object',
                properties: {
                  date: {
                    type: 'string',
                    description: 'Date of the session in YYYY-MM-DD format.',
                  },
                  day_of_week: {
                    type: 'integer',
                    description: 'Day of the week (1 for Monday, 7 for Sunday).',
                  },
                  week_number: {
                    type: 'integer',
                    description:
                      'The week number (1 for partial first week, 2 for full second week).',
                  },
                  phase: {
                    type: 'string',
                    description:
                      "Training phase, e.g., 'Base'. Should be 'Base' for these initial weeks.",
                  },
                  session_type: {
                    type: 'string',
                    description:
                      "Type of session (e.g., 'Easy Run', 'Easy Run + Strides', 'Double Run','Long Run', 'Threshold Run', 'Rest', 'Tempo Run', 'Hills', 'Strides', 'Track Workout', 'Fartlek', 'Progression Run', 'Cross Training', 'Strength Training').",
                  },
                  distance: {
                    type: 'number',
                    nullable: true,
                    description: `Planned distance in ${units}. Null if not applicable.`,
                  },
                  time: {
                    type: 'integer',
                    nullable: true,
                    description: 'Planned duration in minutes. Null if not applicable.',
                  },
                  notes: {
                    type: 'string',
                    nullable: true,
                    description: 'Specific instructions or notes for the session.',
                  },
                  suggested_location: {
                    type: 'string',
                    nullable: true,
                    description:
                      'Suggested training location for the session within 40km of user location. Null if no appropriate location can be suggested.',
                  },
                },
                required: ['date', 'day_of_week', 'week_number', 'phase', 'session_type'],
              },
            },
          },
          required: ['sessions'],
        },
      },
    },
  ];

  console.log('[OpenAI] Sending request to OpenAI API with function calling for initial plan.');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Or your preferred model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools,
        tool_choice: { type: 'function', function: { name: 'save_initial_training_plan' } }, // Force calling the function
        max_tokens: 3500, // Increased from 2500 to accommodate double days for high-mileage runners
        temperature: 0.5, // Slightly lower temperature for more deterministic plan structure
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OpenAI] API error:', { status: response.status, error: errorText });
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      if (toolCall.function.name === 'save_initial_training_plan') {
        console.log('[OpenAI] Successfully received tool call for save_initial_training_plan.');
        const rawArgs = toolCall.function.arguments;
        try {
          const parsedArgs = JSON.parse(rawArgs);
          let sessions: TrainingSession[] = parsedArgs.sessions || [];

          // Add default id, status, and ensure phase/week_number if AI missed them (though schema should guide it)
          sessions = sessions.map((s: any) => ({
            ...s,
            id: uuidv4(), // Generate UUID for each session
            status: 'not_completed', // Default status
            // Ensure required fields from schema are present, with fallbacks if truly necessary
            date: s.date,
            day_of_week: s.day_of_week,
            week_number: s.week_number,
            phase: s.phase || 'Base',
            session_type: s.session_type,
            distance: s.distance !== undefined ? s.distance : null,
            time: s.time !== undefined ? s.time : null,
            notes: s.notes !== undefined ? s.notes : '',
            suggested_location: s.suggested_location || null,
          }));

          console.log('[OpenAI] Parsed sessions from tool call:', sessions.length);

          // Log volume tracking for debugging
          const targetVolume = parseFloat(String(currentMileage).replace(/[^\d.]/g, '') || '0');
          if (targetVolume > 0) {
            const week1Sessions = sessions.filter((s) => s.week_number === 1);
            const week2Sessions = sessions.filter((s) => s.week_number === 2);

            const week1Volume = week1Sessions.reduce((total, s) => total + (s.distance || 0), 0);
            const week2Volume = week2Sessions.reduce((total, s) => total + (s.distance || 0), 0);

            console.log(`[OpenAI] Volume Analysis:`);
            console.log(`  Target: ${targetVolume} ${units}/week`);
            console.log(`  Week 1: ${week1Volume} ${units} (${week1Sessions.length} sessions)`);
            console.log(`  Week 2: ${week2Volume} ${units} (${week2Sessions.length} sessions)`);
            console.log(`  Week 2 vs Target: ${((week2Volume / targetVolume) * 100).toFixed(1)}%`);

            if (week2Volume < targetVolume * 0.85) {
              console.warn(
                `[OpenAI] ⚠️ Generated volume is significantly below target (${week2Volume} vs ${targetVolume})`
              );
            }

            // Log double days if any
            const week2DoubleDays = week2Sessions.reduce(
              (acc, session) => {
                acc[session.date] = (acc[session.date] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>
            );

            const doubleDayCount = Object.values(week2DoubleDays).filter(
              (count) => count > 1
            ).length;
            console.log(`  Double days in Week 2: ${doubleDayCount}`);
          }

          if (sessions.length === 0) {
            console.warn(
              '[OpenAI] Tool call for save_initial_training_plan returned zero sessions. Generating fallback.'
            );
            // Fallback if AI calls function but provides no sessions
            return generateFallbackPlan(
              trainingFrequency,
              parseFloat(String(currentMileage).replace(/[^\\d.]/g, '') || '0'),
              units
            ).map((s) => ({ ...s, id: s.id || uuidv4() }));
          }
          return sessions;
        } catch (e) {
          console.error(
            '[OpenAI] Error parsing tool call arguments:',
            e,
            '\nRaw arguments:',
            rawArgs
          );
          // Fallback if arguments are malformed
          console.log('[OpenAI] Using fallback plan due to argument parsing error.');
          return generateFallbackPlan(
            trainingFrequency,
            parseFloat(String(currentMileage).replace(/[^\\d.]/g, '') || '0'),
            units
          ).map((s) => ({ ...s, id: s.id || uuidv4() }));
        }
      } else {
        console.warn(`[OpenAI] AI called an unexpected tool: ${toolCall.function.name}.`);
      }
    } else {
      console.warn(
        '[OpenAI] AI did not make a tool call as expected. Response content:',
        message?.content
      );
    }

    // Fallback if no tool call was made or an unexpected tool was called
    console.log('[OpenAI] Using fallback plan because AI did not call save_initial_training_plan.');
    return generateFallbackPlan(
      trainingFrequency,
      parseFloat(String(currentMileage).replace(/[^\\d.]/g, '') || '0'),
      units
    ).map((s) => ({ ...s, id: s.id || uuidv4() }));
  } catch (err) {
    console.error('[OpenAI] Error in generateTrainingPlan (Function Calling):', err);
    // Fallback for any other network or unexpected errors during the process
    console.log('[OpenAI] Using fallback plan due to an unexpected error.');
    // Ensure the fallback sessions also have IDs
    return generateFallbackPlan(
      trainingFrequency,
      parseFloat(String(currentMileage).replace(/[^\\d.]/g, '') || '0'),
      units
    ).map((s) => ({ ...s, id: s.id || uuidv4() }));
  }
}
