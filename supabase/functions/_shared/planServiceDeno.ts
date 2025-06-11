// supabase/functions/_shared/planServiceDeno.ts
// import { arqué } from './arquéClient.ts'; // Supabase client for Deno - REMOVED: unused import
// import { type ChatCompletionRequestMessage, Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1"; // Old v3 import
import {
  LocalDate,
  TemporalAdjusters,
  ChronoUnit,
  DayOfWeek,
} from 'https://esm.sh/@js-joda/core@5.5.2'; // Example: using esm.sh for @js-joda/core
import OpenAI from 'https://esm.sh/openai@4.29.2'; // New v4 import (example version, check esm.sh for latest v4)
// Note: You might need to adjust the @js-joda/core version or import method based on your Deno setup.

// Minimal interface for Supabase client to satisfy linter and provide basic type safety
interface MinimalSupabaseClient {
  from: (table: string) => unknown;
}

// Define proper type for Supabase client
interface SupabaseQueryBuilder {
  eq: (column: string, value: string) => SupabaseQueryBuilder;
  gte: (column: string, value: string) => SupabaseQueryBuilder;
  lte: (column: string, value: string) => SupabaseQueryBuilder;
  order: (column: string, options?: { ascending: boolean }) => SupabaseQueryBuilder;
  single: () => Promise<{ data: unknown; error: { message?: string } | null }>;
}

interface SupabaseDeleteBuilder {
  eq: (column: string, value: string) => SupabaseDeleteBuilder;
  gte: (column: string, value: string) => SupabaseDeleteBuilder;
  lte: (column: string, value: string) => SupabaseDeleteBuilder;
}

interface SupabaseDeleteResponse {
  error: { message?: string } | null;
}

// REMOVE or comment out this line:
// interface SupabaseClient {
//   from: (table: string) => {
//     select: (columns: string) => SupabaseQueryBuilder;
//     insert: (data: TrainingSessionDeno[]) => Promise<{ error: { message?: string } | null }>;
//     delete: () => SupabaseDeleteBuilder;
//   };
// }

interface ErrorWithResponse {
  response?: {
    data?: unknown;
  };
}

// Location interfaces for plan generation
interface LocationInfo {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
}

// --- Type Definitions (consistent with existing app and feedbackService.ts) ---
interface UserProfileOnboarding {
  // Fields from 'profiles' table relevant for onboarding/plan generation
  goal_type?: string | null; // Was goal_description
  race_date?: string | null;
  race_distance?: string | null;
  experience_level?: string | null; // Was running_experience
  current_frequency?: string | null; // Was training_frequency
  current_mileage?: string | null; // Was weekly_volume (ensure string for consistency with schema)
  units?: string | null;
  nickname?: string | null; // Was display_name
  injury_history?: string | null;
  schedule_constraints?: string | null; // Directly from profiles
  created_at: string; // Expect created_at as timestamp string from DB
}

interface OnboardingDataInternal {
  goalType: string;
  raceDate?: string | null;
  raceDistance?: string;
  experienceLevel: string;
  trainingFrequency: string;
  currentMileage: string;
  units: string;
  nickname?: string;
  injuryHistory?: string;
  scheduleConstraints?: string;
  planStartDate: string; // Will be derived from created_at (YYYY-MM-DD)
}

interface TrainingSessionDeno {
  user_id: string;
  week_number: number;
  day_of_week: number;
  session_type: string;
  date: string; // YYYY-MM-DD (Note: training_plans.date is timestamptz)
  distance?: number | null;
  time?: number | null;
  notes?: string | null;
  status: 'not_completed' | 'completed' | 'skipped' | 'partially_completed'; // Matches your varchar values
  created_at?: string;
  updated_at?: string;
  // Schema also has plan_type, modified, phase - consider if AI should generate these
}

interface ExistingSession {
  date: string;
  status: string;
  notes?: string;
  post_session_notes?: string;
}

interface AIPlanItem {
  day_of_week?: number;
  session_type?: string;
  date?: string;
  distance?: number;
  time?: number;
  notes?: string;
  week_number?: number;
  phase?: string;
  suggested_location?: string;
}

interface UserTrainingFeedbackDeno {
  id: string;
  user_id: string;
  week_start_date: string;
  prefers?: Record<string, unknown> | null;
  struggling_with?: Record<string, unknown> | null;
  feedback_summary?: string | null;
  raw_data?: Record<string, unknown> | null;
  created_at: string;
}

// Initialize OpenAI client (similar to feedbackService.ts)
const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
let openai: OpenAI | null = null; // Changed type to OpenAI (v4)
if (openAiApiKey) {
  // const configuration = new Configuration({ apiKey: openAiApiKey }); // Old v3 config
  // openai = new OpenAIApi(configuration); // Old v3 client
  openai = new OpenAI({ apiKey: openAiApiKey }); // New v4 client initialization
} else {
  console.warn('[planServiceDeno] OPENAI_API_KEY is not set. AI plan generation will be disabled.');
}

// --- Helper: Fetch User Onboarding Data ---
async function getUserOnboardingDataDeno(
  arquéClient: unknown,
  userId: string
): Promise<OnboardingDataInternal | null> {
  console.log(`[planServiceDeno] Fetching onboarding data for user ${userId} from profiles table.`);
  const client = arquéClient as MinimalSupabaseClient;
  const { data: profileData, error: profileError } = await (client
    .from('profiles') as {
      select: (columns: string) => {
        eq: (col: string, val: string) => {
          single: () => Promise<{ data: unknown; error: { message?: string } | null }>;
        };
      };
    })
    .select('goal_type, race_date, race_distance, experience_level, current_frequency, current_mileage, units, nickname, injury_history, schedule_constraints, created_at')
    .eq('id', userId)
    .single();

  if (profileError || !profileData) {
    console.error(
      `[planServiceDeno] Error fetching profile for user ${userId}:`,
      profileError?.message
    );
    return null;
  }

  const p = profileData as UserProfileOnboarding;

  // Convert created_at (timestamp string) to YYYY-MM-DD string for planStartDate
  // Supabase typically returns timestamps in ISO 8601 format e.g., "2023-10-27T10:30:00.123456+00:00"
  const createdAtDate = new Date(p.created_at);
  const planStartDateString = createdAtDate.toISOString().split('T')[0];

  return {
    goalType: p.goal_type || 'General fitness',
    raceDate: p.race_date || null,
    raceDistance: p.race_distance || undefined,
    experienceLevel: p.experience_level || 'beginner',
    trainingFrequency: p.current_frequency || '3-4 days per week',
    currentMileage: String(p.current_mileage || '20'),
    units: p.units || 'km',
    nickname: p.nickname || undefined,
    injuryHistory: p.injury_history || undefined,
    scheduleConstraints: p.schedule_constraints || undefined,
    planStartDate: planStartDateString, // Use formatted created_at
  };
}

// --- Helper: Remove Workouts (Conditional based on interaction) ---
// Renamed and modified to delete only for a specific week
async function deleteWorkoutsForSpecificWeekDeno(
  arquéClient: unknown,
  userId: string,
  weekStartUtcString: string,
  weekEndUtcString: string
): Promise<boolean> {
  console.log(
    `[planServiceDeno] Removing workouts for user ${userId} for week ${weekStartUtcString} to ${weekEndUtcString}`
  );
  const client = arquéClient as MinimalSupabaseClient;
  const deleteResponse = await ((client
    .from('training_plans') as {
      delete: () => {
        eq: (col: string, val: string) => {
          gte: (col: string, val: string) => {
            lte: (col: string, val: string) => Promise<{ error: { message?: string } | null }>;
          };
        };
      };
    })
    .delete()
    .eq('user_id', userId)
    .gte('date', weekStartUtcString)
    .lte('date', weekEndUtcString));

  const { error } = deleteResponse;
  if (error) {
    console.error(
      `[planServiceDeno] Error removing workouts for week ${weekStartUtcString}-${weekEndUtcString} for user ${userId}:`,
      error
    );
    return false;
  }
  console.log(
    `[planServiceDeno] Successfully removed workouts for week ${weekStartUtcString}-${weekEndUtcString} for user ${userId}`
  );
  return true;
}

// --- Helper: Extract training frequency for volume calculations ---
function extractTrainingFrequencyDeno(frequencyString: string): number {
  const match = frequencyString.match(/(\d+)(?:-(\d+))?/);
  if (match) {
    const min = parseInt(match[1]);
    const max = match[2] ? parseInt(match[2]) : min;
    return Math.round((min + max) / 2);
  }
  return 4; // Default fallback
}

// --- Helper: Get Persistent User Preferences (accumulate from ALL weeks) ---
async function getPersistentUserPreferencesDeno(
  arquéClient: unknown,
  userId: string
): Promise<string> {
  console.log(`[planServiceDeno] Fetching persistent user preferences for user ${userId}`);
  
  try {
    // Get ALL user feedback records to accumulate persistent preferences
    const client = arquéClient as MinimalSupabaseClient;
    const feedbackQuery = await ((client
      .from('user_training_feedback') as {
        select: (columns: string) => {
          eq: (col: string, val: string) => Promise<{ data: UserTrainingFeedbackDeno[] | null; error: { message?: string } | null }>;
        };
      })
      .select('prefers, week_start_date')
      .eq('user_id', userId));

    const allFeedback = feedbackQuery?.data;
    const error = feedbackQuery?.error;

    if (error) {
      console.error(`[planServiceDeno] Error fetching user preferences for ${userId}:`, error);
      return '';
    }

    if (!allFeedback || allFeedback.length === 0) {
      console.log(`[planServiceDeno] No user preferences found for user ${userId}`);
      return '';
    }

    // Accumulate all preference data across all weeks
    const accumulatedPreferences: Record<string, unknown> = {};
    
    allFeedback.forEach((feedback: UserTrainingFeedbackDeno) => {
      if (feedback.prefers && typeof feedback.prefers === 'object') {
        // Merge preferences, with newer ones taking precedence
        Object.assign(accumulatedPreferences, feedback.prefers);
      }
    });

    if (Object.keys(accumulatedPreferences).length === 0) {
      console.log(`[planServiceDeno] No persistent preferences found for user ${userId}`);
      return '';
    }

    // Format preferences for the AI prompt
    const preferenceStrings: string[] = [];
    
    for (const [key, value] of Object.entries(accumulatedPreferences)) {
      if (value && typeof value === 'string') {
        preferenceStrings.push(`${key}: ${value}`);
      } else if (value && typeof value === 'object') {
        preferenceStrings.push(`${key}: ${JSON.stringify(value)}`);
      } else if (value) {
        preferenceStrings.push(`${key}: ${String(value)}`);
      }
    }

    const formattedPreferences = preferenceStrings.length > 0 
      ? preferenceStrings.join('\n- ') 
      : '';

    console.log(`[planServiceDeno] Accumulated ${preferenceStrings.length} persistent preferences for user ${userId}`);
    
    return formattedPreferences ? `- ${formattedPreferences}` : '';
  } catch (error) {
    console.error(`[planServiceDeno] Error in getPersistentUserPreferencesDeno:`, error);
    return '';
  }
}

/**
 * Get user's current location and reverse geocode to get city/region info
 * Used for training plan generation to suggest appropriate training locations
 */
async function getLocationForPlanGenerationDeno(latitude?: number, longitude?: number): Promise<LocationInfo | null> {
  try {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return null;
    }
    const coordinates = { latitude, longitude };
    // Use Nominatim API (free) for reverse geocoding
    const reverseGeoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.latitude}&lon=${coordinates.longitude}&addressdetails=1`;
    try {
      const response = await fetch(reverseGeoUrl, {
        headers: {
          'User-Agent': 'Yugen-RunningApp/1.0', // Required by Nominatim
        },
      });
      if (response.ok) {
        const geoData = await response.json();
        const address = geoData.address || {};
        return {
          ...coordinates,
          city: address.city || address.town || address.village || null,
          region: address.state || address.region || null,
          country: address.country || null,
        };
      } else {
        console.log('[planServiceDeno] Reverse geocoding failed, returning coordinates only');
        return coordinates;
      }
    } catch (geoError) {
      console.log('[planServiceDeno] Reverse geocoding error, returning coordinates only:', geoError);
      return coordinates;
    }
  } catch (error) {
    console.error('[planServiceDeno] Error getting location for plan generation:', error);
    return null;
  }
}

/**
 * Format location info for AI prompt
 * Returns a string describing the user's location for AI context
 */
function formatLocationForPromptDeno(locationInfo: LocationInfo | null): string {
  if (!locationInfo) {
    return '';
  }

  const { city, region, country } = locationInfo;

  if (city && region && country) {
    return `${city}, ${region}, ${country}`;
  } else if (city && country) {
    return `${city}, ${country}`;
  } else if (region && country) {
    return `${region}, ${country}`;
  } else if (country) {
    return country;
  } else {
    return 'Unknown location';
  }
}

// --- Enhanced AI Plan Generation Logic (aligned with openai.ts) ---
async function generateNewWeekPlanWithAI(
  onboardingData: OnboardingDataInternal,
  currentPhase: string,
  weeksSincePlanStart: number,
  latestFeedbackSummary?: string,
  persistentPreferences?: string,
  targetMondayDate?: Date,
  latitude?: number | null,
  longitude?: number | null
): Promise<Omit<TrainingSessionDeno, 'user_id' | 'status' | 'created_at' | 'updated_at'>[]> {
  if (!openai) {
    console.warn('[planServiceDeno] OpenAI client not available. Cannot generate AI plan.');
    return [];
  }

  // Get user location for training location suggestions
  let locationInfo: LocationInfo | null = null;
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    locationInfo = await getLocationForPlanGenerationDeno(latitude, longitude);
  }
  const locationString = formatLocationForPromptDeno(locationInfo);

  console.log(
    '[planServiceDeno] User location for plan generation:',
    locationString || 'Location not available'
  );

  // Extract training frequency and current mileage for volume calculations
  const trainingFrequency = extractTrainingFrequencyDeno(onboardingData.trainingFrequency);
  const currentMileageNumber = parseFloat(
    String(onboardingData.currentMileage).replace(/[^\d.]/g, '') || '0'
  );

  // Calculate target dates
  let targetMondayString = 'current Monday';
  let targetSundayString = 'current Sunday';
  if (targetMondayDate) {
    const targetSundayDate = new Date(targetMondayDate);
    targetSundayDate.setUTCDate(targetMondayDate.getUTCDate() + 6);
    targetMondayString = targetMondayDate.toISOString().split('T')[0];
    targetSundayString = targetSundayDate.toISOString().split('T')[0];
  }

  // Build sophisticated system prompt (aligned with openai.ts)
  const systemPrompt = `You are an expert running coach. Your task is to generate a personalized 7-day training plan (Monday to Sunday).

⚠️ CRITICAL USER PREFERENCES - HIGHEST PRIORITY:
When user feedback contains explicit scheduling preferences (e.g., "I prefer to do long runs on Sundays", "I like workouts on Tuesdays/Fridays"), these MUST be honored as the PRIMARY constraint for workout placement. User preferences override all other considerations except safety.

VOLUME REQUIREMENTS:
- The total weekly distance MUST closely match the user's current weekly volume (within 10-15%).
- For high-mileage runners (80+ km/week or 50+ miles/week), consider double days (multiple sessions per day).
- Track cumulative distance as you create each session to ensure weekly targets are met.
- Prioritize meeting volume requirements over session count preferences if needed.

DOUBLE DAY GUIDANCE:
- For 80-120 km/week: Include 1-2 double days per week (easy run + workout, or easy AM + easy PM)
- For 120+ km/week: Include 2-4 double days per week
- Double days should typically be: morning easy run (30-60 min) + afternoon workout OR two easy runs
- Format double days as separate session objects with the same date but different session_type (e.g., "Easy Run (AM)" and "Tempo Run (PM)")

SESSION TYPE GUIDANCE:
- Easy Run: Base aerobic development, comfortable effort
- Easy Run + Strides: Easy run with 4-6 x 100m accelerations
- Double Run: Shorter run in the afternoon
- Long Run: Weekly long effort for endurance building
- Threshold Run: Comfortably hard sustained effort (threshold pace)
- Tempo Run: Comfortably hard sustained effort (threshold pace)
- Progression Run: Start easy, finish at moderate-hard effort
- Hills: Hill repeats or hill circuit for strength and power
- Track Workout: Structured intervals on track (400m, 800m, mile repeats, etc.)
- Fartlek: Unstructured speed play with varied efforts
- Rest: Complete rest day
- Cross Training: Non-running aerobic activity (cycling, swimming, etc.)
- Strength Training: Resistance training focused on running-specific strength

TECHNICAL REQUIREMENTS:
After creating the plan, you MUST call the 'save_weekly_training_plan' function with the structured plan data.
Each session object in the sessions array should have the following fields:
- "day_of_week" (1 for Monday through 7 for Sunday)
- "session_type" (use the session types from the guidance above)
- "date" (YYYY-MM-DD format for the specific day)
- "distance" (in specified units, null if not applicable like Rest days)
- "time" (in minutes, null if not applicable)
- "notes" (specific instructions, pace guidance, terrain notes, etc.)
- "week_number" (the provided week number)
- "phase" (the provided training phase)
- "suggested_location" (string, nullable, description: Suggested training location for the session within 40km of user location. Null if no appropriate location can be suggested.)

VOLUME VERIFICATION:
Before finalizing the plan, mentally calculate the total weekly distance and ensure it matches the target volume.

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
}`;

  // Build detailed user prompt
  let userPrompt = `Generate a 7-day training plan for the week starting Monday, ${targetMondayString}, and ending Sunday, ${targetSundayString}.

Runner Profile:
- Name: ${onboardingData.nickname || 'Runner'}
- Goal: ${onboardingData.goalType}`;

  if (onboardingData.raceDate) userPrompt += `\n- Race Date: ${onboardingData.raceDate}`;
  if (onboardingData.raceDistance)
    userPrompt += `\n- Race Distance: ${onboardingData.raceDistance}`;

  userPrompt += `
- Experience: ${onboardingData.experienceLevel}
- Current Weekly Volume: ${onboardingData.currentMileage} ${onboardingData.units} ⚠️ CRITICAL: The plan MUST match this weekly volume (within 10-15%)
- Desired Training Frequency: ${onboardingData.trainingFrequency} (${trainingFrequency} days per week). ${trainingFrequency >= 6 ? 'NOTE: High frequency may require double days to meet volume targets.' : 'Adhere to this frequency strictly or deviate by at most +/- 1 day per week.'}
- Units for Plan: ${onboardingData.units}`;

  if (onboardingData.injuryHistory)
    userPrompt += `\n- Injury History: ${onboardingData.injuryHistory}`;
  if (onboardingData.scheduleConstraints)
    userPrompt += `\n- Schedule Constraints: ${onboardingData.scheduleConstraints}`;

  // ⚠️ HIGH PRIORITY: Add user feedback immediately after profile, not buried at the end
  if (persistentPreferences || latestFeedbackSummary) {
    userPrompt += `

🔥 CRITICAL USER PREFERENCES & FEEDBACK - MUST FOLLOW:`;

    // ✅ PERSISTENT PREFERENCES (highest priority - carry forward every week)
    if (persistentPreferences) {
      userPrompt += `

🎯 PERSISTENT SCHEDULING PREFERENCES (MANDATORY - NEVER OVERRIDE):
${persistentPreferences}

⚠️ SCHEDULING PRIORITY: These preferences MUST be respected in EVERY weekly plan. They override all other considerations except safety.`;
    }

    // ✅ WEEKLY CONTEXTUAL FEEDBACK (from previous week only)
    if (latestFeedbackSummary) {
      userPrompt += `

📝 RECENT WEEKLY FEEDBACK (previous week context):
${latestFeedbackSummary}

ℹ️ Use this feedback to adjust intensity, recovery, or session details, but do NOT let it override persistent scheduling preferences above.`;
    }
  }

  userPrompt += `

PLAN STRUCTURE INFO:
- Current Training Phase: ${currentPhase}
- Week Number in Plan: ${weeksSincePlanStart + 1}
- Target Week: ${targetMondayString} to ${targetSundayString}`;

  userPrompt += `

VOLUME TARGET:
- Weekly target: ${onboardingData.currentMileage} ${onboardingData.units}`;

  // Add high mileage guidance if applicable
  if (currentMileageNumber >= 80) {
    userPrompt += `

HIGH MILEAGE RUNNER DETECTED (${onboardingData.currentMileage}):
- Consider 1-4 double days per week depending on volume
- Double sessions can be: Easy AM + Workout PM, or Easy AM + Easy PM  
- Typical double day structure: 30-60 min easy run + main workout later`;
  }

  userPrompt += `

Remember to call 'save_weekly_training_plan' with the complete list of sessions for this week. Structure each session according to the function's requirements and ensure total weekly volume matches the target.`;

  // Define the function/tool for structured plan generation
  const tools = [
    {
      type: 'function' as const,
      function: {
        name: 'save_weekly_training_plan',
        description: 'Saves the generated 7-day weekly training plan for the user.',
        parameters: {
          type: 'object',
          properties: {
            sessions: {
              type: 'array',
              description: 'An array of training session objects for the week (Monday to Sunday).',
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
                    description: 'The week number in the training plan.',
                  },
                  phase: {
                    type: 'string',
                    description:
                      "Training phase (e.g., 'Base', 'Build', 'Peak', 'Taper', 'Race Week', 'Recovery').",
                  },
                  session_type: {
                    type: 'string',
                    description:
                      "Type of session (e.g., 'Easy Run', 'Easy Run + Strides', 'Long Run', 'Rest', 'Tempo Run', 'Hills', 'Track Workout', 'Fartlek', 'Progression Run', 'Cross Training', 'Strength Training').",
                  },
                  distance: {
                    type: 'number',
                    nullable: true,
                    description: `Planned distance in ${onboardingData.units}. Null if not applicable.`,
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

  console.log(
    '[planServiceDeno] Generating plan with enhanced prompt and function calling (first 300 chars):',
    userPrompt.substring(0, 300)
  );

  try {
    // Use function calling approach (aligned with openai.ts)
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Changed from gpt-4o-mini to gpt-4o for better plan generation
      messages,
      tools,
      tool_choice: { type: 'function', function: { name: 'save_weekly_training_plan' } }, // Force calling the function
      max_tokens: 3500, // Increased to accommodate double days for high-mileage runners
      temperature: 0.5, // Slightly lower temperature for more deterministic plan structure
    });

    const message = completion.choices[0].message;

    // Handle function call response (aligned with openai.ts approach)
    let planArray: AIPlanItem[] = [];

    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      if (toolCall.function.name === 'save_weekly_training_plan') {
        console.log(
          '[planServiceDeno] Successfully received tool call for save_weekly_training_plan.'
        );
        const rawArgs = toolCall.function.arguments;
        try {
          const parsedArgs = JSON.parse(rawArgs);
          planArray = parsedArgs.sessions || [];

          if (!Array.isArray(planArray) || planArray.length === 0) {
            console.error(
              '[planServiceDeno] Tool call returned empty or invalid sessions array:',
              planArray
            );
            return [];
          }

          console.log(`[planServiceDeno] Function call returned ${planArray.length} sessions`);
        } catch (e) {
          console.error(
            '[planServiceDeno] Error parsing tool call arguments:',
            e,
            '\nRaw arguments:',
            rawArgs
          );
          return [];
        }
      } else {
        console.warn(`[planServiceDeno] AI called an unexpected tool: ${toolCall.function.name}.`);
        return [];
      }
    } else {
      console.warn(
        '[planServiceDeno] AI did not make a tool call as expected. Response content:',
        message?.content
      );
      return [];
    }

    // Validate and map to ensure correct structure, e.g., ensure 'date' field is included for each session.
    // The prompt asks for 'date', so the AI should provide it.
    const processedSessions = planArray
      .filter((item: AIPlanItem) => item.date) // Filter out items without dates
      .map((item: AIPlanItem, index: number) => ({
        day_of_week: item.day_of_week || index + 1,
        session_type: item.session_type || 'Generated Workout',
        date: item.date!, // Use ! since we filtered out undefined dates
        distance: item.distance ? Number(item.distance) : null,
        time: item.time ? Number(item.time) : null,
        notes: item.notes || null,
        week_number: item.week_number || weeksSincePlanStart + 1, // Use AI's week_number or calculated
        phase: item.phase || currentPhase, // Use AI's phase or calculated currentPhase
        suggested_location: item.suggested_location || null,
      }));

    // Log volume tracking for debugging (similar to openai.ts)
    if (currentMileageNumber > 0) {
      const weekVolume = processedSessions.reduce(
        (total: number, s) => total + (s.distance || 0),
        0
      );

      console.log(`[planServiceDeno] Volume Analysis:`);
      console.log(`  Target: ${currentMileageNumber} ${onboardingData.units}/week`);
      console.log(
        `  Generated: ${weekVolume} ${onboardingData.units} (${processedSessions.length} sessions)`
      );
      console.log(
        `  Generated vs Target: ${((weekVolume / currentMileageNumber) * 100).toFixed(1)}%`
      );

      if (weekVolume < currentMileageNumber * 0.85) {
        console.warn(
          `[planServiceDeno] ⚠️ Generated volume is significantly below target (${weekVolume} vs ${currentMileageNumber})`
        );
      }

      // Log double days if any
      const doubleDays = processedSessions.reduce(
        (acc: Record<string, number>, session) => {
          acc[session.date] = (acc[session.date] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const doubleDayCount = Object.values(doubleDays).filter((count: number) => count > 1).length;
      console.log(`  Double days: ${doubleDayCount}`);
    }

    return processedSessions;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[planServiceDeno] Raw error object from OpenAI call:', error);
    console.error(
      '[planServiceDeno] Error calling OpenAI for plan generation (error.message):',
      errorMessage
    );
    if (error && typeof error === 'object' && 'response' in error) {
      console.error(
        '[planServiceDeno] OpenAI error response data:',
        (error as ErrorWithResponse).response?.data
      );
    }
    throw new Error(`OpenAI plan generation failed: ${errorMessage}`);
  }
}

// --- Main Service Function ---
export async function generateAndStoreCurrentWeekPlanForUserDeno(
  arquéClient: unknown,
  userId: string,
  targetMondayUtcDate: Date, // The specific Monday (UTC) for which to generate the plan
  latestFeedbackSummary?: string, // Optional: from feedbackService
  latitude?: number | null,
  longitude?: number | null
): Promise<boolean> {
  console.log(
    `[planServiceDeno] Starting plan generation for user ${userId}, target week starting ${targetMondayUtcDate.toISOString().split('T')[0]}`
  );

  const client = arquéClient as MinimalSupabaseClient;
  const onboardingData = await getUserOnboardingDataDeno(client, userId);
  if (!onboardingData) {
    console.error(
      `[planServiceDeno] Failed to get onboarding data for user ${userId}. Cannot generate plan.`
    );
    return false;
  }

  // ✅ NEW: Get persistent user preferences (accumulated across ALL weeks)
  const persistentPreferences = await getPersistentUserPreferencesDeno(client, userId);
  console.log(`[planServiceDeno] Retrieved persistent preferences for user ${userId}:`, persistentPreferences ? 'Found preferences' : 'No preferences');

  // Calculate current training phase and weeksSincePlanStart
  // planStartDate will now always be populated from created_at
  const planStartDateForPhaseCalc = new Date(onboardingData.planStartDate + 'T00:00:00Z');

  // Ensure targetMondayUtcDate is treated as UTC for phase calculation
  // We need to be careful with timezones. targetMondayUtcDate IS already a UTC date object.
  const currentPhase = getTrainingPhaseDeno(
    onboardingData.raceDate,
    targetMondayUtcDate,
    planStartDateForPhaseCalc
  );

  // Calculate weeksSincePlanStart relative to targetMondayUtcDate
  const diffTime = Math.abs(targetMondayUtcDate.getTime() - planStartDateForPhaseCalc.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const weeksSincePlanStart = Math.floor(diffDays / 7);

  console.log(
    `[planServiceDeno] Plan Start Date (from created_at): ${onboardingData.planStartDate}, Target Monday: ${targetMondayUtcDate.toISOString().split('T')[0]}, Current Phase: ${currentPhase}, Weeks Since Plan Start: ${weeksSincePlanStart}`
  );

  // Calculate the end of the week (Sunday) for deletion range
  const targetSundayUtcDate = new Date(targetMondayUtcDate);
  targetSundayUtcDate.setUTCDate(targetMondayUtcDate.getUTCDate() + 6);
  const targetMondayString = targetMondayUtcDate.toISOString().split('T')[0];
  const targetSundayString = targetSundayUtcDate.toISOString().split('T')[0];

  // Delete existing workouts for the target week ONLY
  const deleteSuccess = await deleteWorkoutsForSpecificWeekDeno(
    client,
    userId,
    targetMondayString,
    targetSundayString
  );
  if (!deleteSuccess) {
    console.error(
      `[planServiceDeno] Failed to delete existing workouts for week ${targetMondayString}. Aborting plan generation.`
    );
    // Depending on desired behavior, you might choose to proceed or return false.
    // For now, returning false if deletion fails to prevent potential duplicates or partial overwrites.
    return false;
  }

  // Generate new plan using AI
  const newRawSessions = await generateNewWeekPlanWithAI(
    onboardingData,
    currentPhase, // Pass calculated phase
    weeksSincePlanStart, // Pass weeks since start
    latestFeedbackSummary,
    persistentPreferences, // ✅ NEW: Pass persistent preferences separately
    targetMondayUtcDate,
    latitude,
    longitude
  );
  if (!newRawSessions || newRawSessions.length === 0) {
    console.error(`[planServiceDeno] No new sessions generated by AI for user: ${userId}`);
    // Depending on requirements, this might not be a hard fail if, for instance, deletion occurred
    // and the user just ends up with fewer/no sessions for the week.
    // For now, let's consider it a situation where no new plan is stored, but not a fatal error to block the function.
    return true; // Or false if this should halt everything
  }
  console.log(
    `[planServiceDeno] Generated ${newRawSessions.length} new raw sessions for user: ${userId}`
  );

  // Define variables that were missing
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  // For now, we'll assume there are no existing sessions to check against
  // In a real implementation, you'd fetch existing sessions first
  const existingSessions: ExistingSession[] = [];
  const hasInteractedSessionsInTargetWeek = false;

  // 4. Prepare and Save New Sessions (Careful Merge/Insert)
  const sessionsToInsert: TrainingSessionDeno[] = [];
  const nowISO = new Date().toISOString();

  for (const rawSession of newRawSessions) {
    if (!rawSession.date) {
      console.warn(`[planServiceDeno] Skipping session due to missing date from AI:`, rawSession);
      continue;
    }
    const newSessionDate = new Date(rawSession.date + 'T00:00:00.000Z'); // Ensure UTC context for comparison

    // Check if this new session is for a past day within the target week
    // AND if that week had interactions.
    if (newSessionDate < todayUtc && hasInteractedSessionsInTargetWeek) {
      const existingInteractedPastSession = existingSessions?.find((es) => {
        const esDate = new Date(es.date + 'T00:00:00.000Z');
        const esNotes = es.notes || es.post_session_notes;
        return (
          esDate.getTime() === newSessionDate.getTime() &&
          (es.status !== 'not_completed' || (esNotes && String(esNotes).trim() !== ''))
        );
      });

      if (existingInteractedPastSession) {
        console.log(
          `[planServiceDeno] Skipping save for newly generated past session on ${rawSession.date} as an interacted session already exists for user ${userId}`
        );
        continue; // Skip inserting this new past session, prioritize existing interacted one
      }
    }

    // If the date of the new session is before the target Monday (e.g. AI hallucinated), skip it.
    if (newSessionDate < targetMondayUtcDate) {
      console.log(
        `[planServiceDeno] Skipping session with date ${rawSession.date} as it's before target Monday ${targetMondayString}`
      );
      continue;
    }

    sessionsToInsert.push({
      ...rawSession,
      user_id: userId,
      status: 'not_completed',
      created_at: nowISO,
      updated_at: nowISO,
    });
  }

  if (sessionsToInsert.length > 0) {
    console.log(
      `[planServiceDeno] Attempting to insert ${sessionsToInsert.length} new plan sessions for user ${userId}`
    );
    const { error: insertError } = await ((client
      .from('training_plans') as {
        insert: (data: TrainingSessionDeno[]) => Promise<{ error: { message?: string } | null }>;
      })
      .insert(sessionsToInsert));

    if (insertError) {
      console.error(
        `[planServiceDeno] Error inserting new weekly plan sessions for user ${userId}:`,
        insertError
      );
      return false;
    }
    console.log(
      `[planServiceDeno] Successfully inserted ${sessionsToInsert.length} new plan sessions for user ${userId}`
    );
  } else {
    console.log(
      `[planServiceDeno] No new sessions needed to be inserted for user ${userId} (e.g., all were past, interacted days, or AI returned none).`
    );
  }

  return true;
}

// --- Phase Calculation Logic (Mirrored from planAnalysis.ts) ---

// Helper to get the Monday of the week for a given JS Date (Deno version)
function getMondayOfWeekDeno(date: Date): LocalDate {
  // JS Date month is 0-indexed, LocalDate month is 1-indexed
  const jsJodaDate = LocalDate.of(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  return jsJodaDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
}

// Helper to calculate full weeks between two Mondays (Deno version)
function calculateFullWeeksBetweenMondaysDeno(
  date1Monday: LocalDate,
  date2Monday: LocalDate
): number {
  if (date1Monday.isAfter(date2Monday)) return 0;
  return ChronoUnit.WEEKS.between(date1Monday, date2Monday);
}

// Main phase calculation function (Deno version)
function getTrainingPhaseDeno(
  raceDateString?: string | null,
  currentDateForPhase: Date = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  ),
  planStartDateJs?: Date | null
): string {
  const today = new Date(currentDateForPhase.valueOf()); // Clone to avoid modifying original
  // Ensure time components are zeroed out for consistent day-based comparisons, using UTC for Deno functions
  today.setUTCHours(0, 0, 0, 0);
  const currentWeekMonday = getMondayOfWeekDeno(today);

  const actualPlanStartDate = planStartDateJs
    ? new Date(planStartDateJs.valueOf())
    : new Date(today.valueOf());
  actualPlanStartDate.setUTCHours(0, 0, 0, 0);
  const planStartMonday = getMondayOfWeekDeno(actualPlanStartDate);

  const basePeriodEndDateGlobal = planStartMonday.plusDays(13);

  if (raceDateString && raceDateString !== 'None') {
    const raceDayLd = LocalDate.parse(raceDateString);
    if (currentWeekMonday.isAfter(raceDayLd)) {
      const daysPastRaceStartOfWeek = ChronoUnit.DAYS.between(raceDayLd, currentWeekMonday);
      if (daysPastRaceStartOfWeek < 0) {
        // This condition means current week is before race date, which shouldn't happen in this branch
        // Keep empty for now but could add logic if needed
      } else if (daysPastRaceStartOfWeek <= 6) {
        return 'Recovery';
      } else if (daysPastRaceStartOfWeek <= 13) {
        return 'Recovery';
      } else if (daysPastRaceStartOfWeek <= 20) {
        return 'Base';
      } else if (daysPastRaceStartOfWeek <= 27) {
        return 'Base';
      }
    }
  }

  if (raceDateString && raceDateString !== 'None') {
    const raceDayLd = LocalDate.parse(raceDateString);
    const daysTillRaceForPrimaryLogic = ChronoUnit.DAYS.between(currentWeekMonday, raceDayLd);

    if (daysTillRaceForPrimaryLogic >= -27) {
      const raceWeekMonday = raceDayLd.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
      const taperWeekMonday = raceWeekMonday.minusWeeks(1);
      const peakWeekMonday = taperWeekMonday.minusWeeks(1);

      if (
        currentWeekMonday.isEqual(
          raceDayLd.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        ) &&
        daysTillRaceForPrimaryLogic >= 0
      ) {
        return 'Race Week';
      }
      if (currentWeekMonday.isEqual(taperWeekMonday)) {
        return 'Taper';
      }
      if (currentWeekMonday.isEqual(peakWeekMonday)) {
        return 'Peak';
      }

      if (currentWeekMonday.isBefore(peakWeekMonday)) {
        if (
          currentWeekMonday.isBefore(basePeriodEndDateGlobal.plusDays(1)) &&
          (currentWeekMonday.isEqual(planStartMonday) || currentWeekMonday.isAfter(planStartMonday))
        ) {
          return 'Base';
        }
        const weeksFromPeakToCurrent = calculateFullWeeksBetweenMondaysDeno(
          currentWeekMonday,
          peakWeekMonday.minusDays(1)
        );
        const cyclePositionReversed = weeksFromPeakToCurrent % 4;
        if (cyclePositionReversed === 0) return 'Base';
        if (cyclePositionReversed === 1) return 'Build';
        if (cyclePositionReversed === 2) return 'Build';
        if (cyclePositionReversed === 3) return 'Build';
      }
    }
  }

  if (
    currentWeekMonday.isBefore(basePeriodEndDateGlobal.plusDays(1)) &&
    (currentWeekMonday.isEqual(planStartMonday) || currentWeekMonday.isAfter(planStartMonday))
  ) {
    return 'Base';
  }

  const weeksSincePlanStartForCycle = calculateFullWeeksBetweenMondaysDeno(
    planStartMonday,
    currentWeekMonday
  );
  const adjustedWeeksForCycle = weeksSincePlanStartForCycle - 2;
  if (adjustedWeeksForCycle < 0) {
    return 'Base';
  }
  const cyclePositionForward = adjustedWeeksForCycle % 4;
  if (cyclePositionForward < 3) return 'Build';
  return 'Base';
}
