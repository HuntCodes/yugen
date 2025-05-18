import Constants from 'expo-constants';
import { getTrainingPhase, generateFallbackPlan, extractTrainingFrequency, parseTextPlanToSessions } from './utils/training';
import { TrainingSession, OnboardingData } from '../types/training';

// this is the file where the INITAL training plan is generated

// Use imported types instead of local interface declarations
export { TrainingSession, OnboardingData };

export async function generateTrainingPlan(onboarding: OnboardingData): Promise<TrainingSession[]> {
  console.log('Starting training plan generation with data:', onboarding);
  
  // More robust API key retrieval
  let apiKey: string | undefined = undefined;
  const envApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

  if (envApiKey) {
    apiKey = envApiKey.replace(/["']/g, '').trim();
  } else {
    const configKey = Constants.expoConfig?.extra?.openaiApiKey || 
                   Constants.expoConfig?.extra?.OPENAI_API_KEY ||
                   // @ts-ignore - This is a fallback for older Expo versions
                   (Constants.manifest as any)?.extra?.OPENAI_API_KEY;
    if (configKey) {
      apiKey = String(configKey).replace(/["']/g, '').trim();
    }
  }
                 
  if (!apiKey) {
    console.error('OpenAI API key not found in process.env or Expo constants');
    throw new Error('OpenAI API key not found');
  }

  // Calculate current week dates for context
  // Use userStartDate from onboarding data if available, otherwise default to server's current date
  let today: Date;
  if (onboarding.userStartDate) {
    // userStartDate is expected to be "YYYY-MM-DD"
    const [year, month, day] = onboarding.userStartDate.split('-').map(Number);
    // Create a Date object representing midnight UTC for the given user's start date
    today = new Date(Date.UTC(year, month - 1, day));
  } else {
    // This fallback is highly problematic for users in different timezones than the server.
    // It's strongly recommended to ensure userStartDate is always provided from the client.
    console.error("CRITICAL: userStartDate not provided to generateTrainingPlan. Falling back to server's current date. This will cause timezone issues for the user's first week plan and may lead to plans starting on the wrong day for the user.");
    // Use server's current date as a last resort
    const serverNow = new Date();
    // Align to UTC midnight of the server's current date
    today = new Date(Date.UTC(serverNow.getUTCFullYear(), serverNow.getUTCMonth(), serverNow.getUTCDate()));
  }
  
  // Calculate the next Sunday
  const nextSunday = new Date(today);
  const daysUntilSunday = 7 - today.getDay();
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  nextSunday.setHours(23, 59, 59, 999);
  
  // Calculate the Monday after next Sunday (start of Week 2)
  const weekTwoStart = new Date(nextSunday);
  weekTwoStart.setDate(nextSunday.getDate() + 1);
  weekTwoStart.setHours(0, 0, 0, 0);
  
  // Calculate the end of Week 2 (Sunday)
  const weekTwoEnd = new Date(weekTwoStart);
  weekTwoEnd.setDate(weekTwoStart.getDate() + 6);
  weekTwoEnd.setHours(23, 59, 59, 999);
  
  // Format dates for the prompt
  const formatLocalDate = (date: Date): string => {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };
  
  const currentDateStr = formatLocalDate(today);
  const nextSundayStr = formatLocalDate(nextSunday);
  const weekTwoStartStr = formatLocalDate(weekTwoStart);
  const weekTwoEndStr = formatLocalDate(weekTwoEnd);

  // Get numeric training frequency
  const trainingFrequency = extractTrainingFrequency(onboarding.trainingFrequency);
  console.log('Extracted training frequency:', trainingFrequency, 'from', onboarding.trainingFrequency);

  // Extract current mileage or use default
  const currentMileage = onboarding.current_mileage || 'Not specified';
  const units = onboarding.units || 'km';
  
  // Use text form instead of JSON for more reliable parsing
  const prompt = `You are an expert running coach. Based on the following runner profile, create a detailed training plan for their first two weeks.

Please fill out this training plan form for ${onboarding.nickname || 'Runner'}:

WEEK 1 (Partial Week):
Start Date: ${currentDateStr} (today)
End Date: ${nextSundayStr} (this Sunday)
Phase: Base (introductory week)

WEEK 2 (Full Week):
Start Date: ${weekTwoStartStr} (Monday)
End Date: ${weekTwoEndStr} (Sunday)
Phase: Base (first full week)

For each day in this date range, provide:
- Type: [Type of workout]
- Distance: [X ${units}]
- Time: [X minutes]
- Notes: [Add notes about pace, terrain, or specific instructions]

CRITICAL FREQUENCY REQUIREMENT: The runner currently trains ${onboarding.trainingFrequency} days per week (${trainingFrequency} days). Your training plan MUST match this frequency exactly or only deviate by at most +/- 1 day per week. If the frequency is less than 7 days, leave the appropriate days as rest days or remove them completely.

CRITICAL VOLUME REQUIREMENT: The runner currently does about ${currentMileage} ${units} per week. For Week 1 (partial week), scale the volume proportionally to the number of days remaining. For Week 2, maintain a similar weekly volume. Never drastically reduce their volume.

IMPORTANT NEW USER CONSIDERATION: This is a new user signing up on ${currentDateStr}. For Week 1, only include training sessions from their signup day onwards. Week 2 should be their first full week of training.

Runner Profile:
- Name: ${onboarding.nickname || 'Runner'}
- Goal: ${onboarding.goalType}
- Experience: ${onboarding.experienceLevel}
- Current Weekly Volume: ${currentMileage} ${units}
- Training Frequency: ${onboarding.trainingFrequency} days per week
- Preferences: ${onboarding.trainingPreferences || 'None'}
- Injury History: ${onboarding.injury_history || 'None'}
- Schedule Constraints: ${onboarding.schedule_constraints || 'None'}
- Units: ${units}

Fill out the training sessions for each day in the date range specified above. For rest days, either omit them or explicitly mark them as "Rest Day" with no distance/time.`;

  console.log('Sending OpenAI request with prompt length:', prompt.length);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful, expert running coach. Create running plans by filling in the form template provided. Be specific and detailed in your answers. Include proper volume and intensity based on the runner\'s current level.' 
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

    // Parse the text plan into TrainingSession objects
    try {
      // Parse the text plan using our new utility
      let sessions = parseTextPlanToSessions(content, units);
      
      // If the parser couldn't extract any valid sessions, fall back to plan generation
      if (sessions.length === 0) {
        console.error('No valid sessions could be parsed from the response:', content);
        
        // Fallback to a basic plan
        console.log('Using fallback sample plan with frequency:', trainingFrequency);
        const fallbackSessions = generateFallbackPlan(trainingFrequency, parseFloat(String(currentMileage).replace(/[^\d.]/g, '') || '0'), units);
        
        // Add phase to fallback plan and ensure IDs
        sessions = fallbackSessions.map(session => ({
          ...session,
          phase: 'Base',
          id: session.id || crypto.randomUUID() // Ensure ID is set
        })) as TrainingSession[];
      }
      
      // updateSessionDatesToCurrentYear call removed as dates should be correct from generation
      // sessions = updateSessionDatesToCurrentYear(sessions, true) as TrainingSession[];
      
      console.log('Successfully parsed training plan with sessions:', sessions.length);
      return sessions;
    } catch (err) {
      console.error('Error parsing training plan text:', err);
      
      // Fallback to a basic plan if parsing fails
      console.log('Using fallback sample plan with frequency:', trainingFrequency);
      const fallbackSessions = generateFallbackPlan(trainingFrequency, parseFloat(String(currentMileage).replace(/[^\d.]/g, '') || '0'), units);
      
      // Add phase to fallback plan and ensure IDs
      const sessions = fallbackSessions.map(session => ({
        ...session,
        phase: 'Base',
        id: session.id || crypto.randomUUID() // Ensure ID is set
      })) as TrainingSession[];
      
      // updateSessionDatesToCurrentYear call removed
      // return updateSessionDatesToCurrentYear(sessions, true) as TrainingSession[];
      return sessions; // Return the sessions directly
    }
  } catch (err) {
    console.error('Error in generateTrainingPlan:', err);
    throw err;
  }
} 