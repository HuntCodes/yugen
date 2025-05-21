import Constants from 'expo-constants';
import { getTrainingPhase, generateFallbackPlan, extractTrainingFrequency } from './utils/training';
import { TrainingSession, OnboardingData } from '../types/training';
import { v4 as uuidv4 } from 'uuid'; // For generating IDs if AI doesn't

// this is the file where the INITAL training plan is generated

// Use imported types instead of local interface declarations
export { TrainingSession, OnboardingData };

export async function generateTrainingPlan(onboarding: OnboardingData): Promise<TrainingSession[]> {
  console.log('[OpenAI] Starting initial training plan generation with data (Function Calling):', onboarding);

  let apiKey: string | undefined = undefined;
  const envApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

  if (envApiKey) {
    apiKey = envApiKey.replace(/["\']/g, '').trim();
  } else {
    const configKey = Constants.expoConfig?.extra?.openaiApiKey ||
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
    console.error("[OpenAI] CRITICAL: userStartDate not provided. Falling back to server's current date.");
    const serverNow = new Date();
    today = new Date(Date.UTC(serverNow.getUTCFullYear(), serverNow.getUTCMonth(), serverNow.getUTCDate()));
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
The plan should consist of an array of session objects. Each session object must conform to the schema provided for the 'save_initial_training_plan' function.
Ensure all required fields (date, day_of_week, week_number, phase, session_type) are populated for every session.
Set 'phase' to 'Base' for both weeks. For Week 1 (partial week), set 'week_number' to 1. For Week 2 (full week), set 'week_number' to 2.
Calculate 'day_of_week' (1=Monday, 7=Sunday) based on the session's 'date'.
Provide 'distance' in ${units} and 'time' in minutes. If a session is 'Rest', distance and time can be null or 0.
Include notes for pace, terrain, or specific instructions as appropriate.`;

  const userPrompt = `Please generate a 2-week initial training plan for the following runner and then call the 'save_initial_training_plan' function.

Plan Details:
- Week 1 (Partial Week): Start Date: ${currentDateStr} (user's signup day), End Date: ${nextSundayStr} (this Sunday). Only include sessions from signup day onwards.
- Week 2 (Full Week): Start Date: ${weekTwoStartStr} (Monday), End Date: ${weekTwoEndStr} (Sunday). This is the first full week.

Runner Profile:
- Name: ${onboarding.nickname || 'Runner'}
- Goal: ${onboarding.goalType}
- Experience: ${onboarding.experienceLevel}
- Current Weekly Volume: ${currentMileage} ${units}
- Desired Training Frequency: ${onboarding.trainingFrequency} (${trainingFrequency} days per week). Adhere to this frequency strictly or deviate by at most +/- 1 day per week. If frequency is less than 7, include appropriate rest days.
- Current Signup Date: ${currentDateStr}.
- Units for Plan: ${units}
- Preferences: ${onboarding.trainingPreferences || 'None'}
- Injury History: ${onboarding.injury_history || 'None'}
- Schedule Constraints: ${onboarding.schedule_constraints || 'None'}

Remember to call 'save_initial_training_plan' with the complete list of sessions for these two weeks. Structure each session according to the function's requirements.`;

  const tools = [
    {
      type: "function",
      function: {
        name: "save_initial_training_plan",
        description: "Saves the generated 2-week initial training plan for the user.",
        parameters: {
          type: "object",
          properties: {
            sessions: {
              type: "array",
              description: "An array of training session objects for the first two weeks.",
              items: {
                type: "object",
                properties: {
                  date: { type: "string", description: "Date of the session in YYYY-MM-DD format." },
                  day_of_week: { type: "integer", description: "Day of the week (1 for Monday, 7 for Sunday)." },
                  week_number: { type: "integer", description: "The week number (1 for partial first week, 2 for full second week)." },
                  phase: { type: "string", description: "Training phase, e.g., 'Base'. Should be 'Base' for these initial weeks." },
                  session_type: { type: "string", description: "Type of session (e.g., 'Easy Run', 'Long Run', 'Rest')." },
                  distance: { type: "number", nullable: true, description: `Planned distance in ${units}. Null if not applicable.` },
                  time: { type: "integer", nullable: true, description: "Planned duration in minutes. Null if not applicable." },
                  notes: { type: "string", nullable: true, description: "Specific instructions or notes for the session." }
                },
                required: ["date", "day_of_week", "week_number", "phase", "session_type"]
              }
            }
          },
          required: ["sessions"]
        }
      }
    }
  ];

  console.log('[OpenAI] Sending request to OpenAI API with function calling for initial plan.');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Or your preferred model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: tools,
        tool_choice: {"type": "function", "function": {"name": "save_initial_training_plan"}}, // Force calling the function
        max_tokens: 2500, // Increased max_tokens for potentially larger JSON
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
      if (toolCall.function.name === "save_initial_training_plan") {
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
          }));

          console.log('[OpenAI] Parsed sessions from tool call:', sessions.length);
          if (sessions.length === 0) {
            console.warn('[OpenAI] Tool call for save_initial_training_plan returned zero sessions. Generating fallback.');
            // Fallback if AI calls function but provides no sessions
            return generateFallbackPlan(trainingFrequency, parseFloat(String(currentMileage).replace(/[^\\d.]/g, '') || '0'), units).map(s => ({...s, id: s.id || uuidv4()}));
          }
          return sessions;
        } catch (e) {
          console.error('[OpenAI] Error parsing tool call arguments:', e, "\nRaw arguments:", rawArgs);
          // Fallback if arguments are malformed
          console.log('[OpenAI] Using fallback plan due to argument parsing error.');
          return generateFallbackPlan(trainingFrequency, parseFloat(String(currentMileage).replace(/[^\\d.]/g, '') || '0'), units).map(s => ({...s, id: s.id || uuidv4()}));
        }
      } else {
         console.warn(`[OpenAI] AI called an unexpected tool: ${toolCall.function.name}.`);
      }
    } else {
      console.warn('[OpenAI] AI did not make a tool call as expected. Response content:', message?.content);
    }

    // Fallback if no tool call was made or an unexpected tool was called
    console.log('[OpenAI] Using fallback plan because AI did not call save_initial_training_plan.');
    return generateFallbackPlan(trainingFrequency, parseFloat(String(currentMileage).replace(/[^\\d.]/g, '') || '0'), units).map(s => ({...s, id: s.id || uuidv4()}));

  } catch (err) {
    console.error('[OpenAI] Error in generateTrainingPlan (Function Calling):', err);
    // Fallback for any other network or unexpected errors during the process
    console.log('[OpenAI] Using fallback plan due to an unexpected error.');
    // Ensure the fallback sessions also have IDs
    return generateFallbackPlan(trainingFrequency, parseFloat(String(currentMileage).replace(/[^\\d.]/g, '') || '0'), units).map(s => ({...s, id: s.id || uuidv4()}));
  }
} 