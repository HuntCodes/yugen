import { LocalDateTime, LocalDate, ZoneId, DateTimeFormatter } from '@js-joda/core';

import { ChatMessage } from './useMessageTypes';
import { coachStyles } from '../../config/coachingGuidelines';
import { formatDateYMD } from '../../lib/utils/dateUtils';
import { UserTrainingFeedbackData } from '../../services/feedback/feedbackService';
import { getFallbackProducts, Product } from '../../services/gear/partnerizeService';
import {
  getLocationForPlanGeneration,
  formatLocationForPrompt,
  LocationInfo,
} from '../../services/location/locationForPlanService';
import { WeatherForecast, getWeatherDescription } from '../../services/weather/weatherService';
import { PlanUpdate } from '../chat/types';

// Import js-joda for robust local time handling
import '@js-joda/timezone'; // Required for timezone operations

/**
 * Hook for message formatting utilities
 */
export function useMessageFormatting() {
  /**
   * Format date as a readable string
   */
  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

  /**
   * Format the day of week
   */
  const getDayOfWeek = (date: Date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  /**
   * Format training plan data for the AI prompt
   */
  const formatTrainingPlanForPrompt = (trainingPlan: any[]): string => {
    console.log('🏃‍♂️ [formatTrainingPlanForPrompt] INPUT:', {
      trainingPlanLength: trainingPlan?.length || 0,
      trainingPlan: trainingPlan?.map(w => ({
        id: w.id,
        date: w.date,
        session_type: w.session_type,
        distance: w.distance,
        time: w.time,
        suggested_location: w.suggested_location,
        status: w.status
      })) || []
    });

    if (!trainingPlan || trainingPlan.length === 0) {
      const result = 'No training plan available yet.';
      console.log('🏃‍♂️ [formatTrainingPlanForPrompt] RESULT (empty plan):', result);
      return result;
    }

    // Improved sorting to handle time-of-day ordering for same-day workouts
    const sortedPlan = [...trainingPlan].sort((a, b) => {
      // First sort by date
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;

      // If same date, check for time-of-day indicators
      const hasTimeA =
        a.session_type && (a.session_type.includes('(PM)') || a.session_type.includes('(AM)'));
      const hasTimeB =
        b.session_type && (b.session_type.includes('(PM)') || b.session_type.includes('(AM)'));
      const isPMA = a.session_type && a.session_type.includes('(PM)');
      const isPMB = b.session_type && b.session_type.includes('(PM)');

      // Sessions without time indicators come first (morning implied)
      if (!hasTimeA && hasTimeB) return -1;
      if (hasTimeA && !hasTimeB) return 1;

      // If both have time indicators, AM comes before PM
      if (hasTimeA && hasTimeB) {
        if (!isPMA && isPMB) return -1; // A is AM, B is PM
        if (isPMA && !isPMB) return 1; // A is PM, B is AM
      }

      // Fallback to created_at for stable ordering
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    const today = new Date();
    // Normalize today to start of day to ensure we include today's workouts
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    const todayStr = formatDateYMD(startOfToday);

    console.log('🏃‍♂️ [formatTrainingPlanForPrompt] FILTERING:', {
      todayStr,
      startOfToday: startOfToday.toISOString(),
      sortedPlanLength: sortedPlan.length,
      sortedPlan: sortedPlan.map(w => ({ id: w.id, date: w.date, session_type: w.session_type }))
    });

    // Show all upcoming workouts for the next 14 days to allow AI to see scheduling conflicts
    // CRITICAL FIX: Use startOfToday instead of today to include today's workouts
    const upcomingOrCurrentWeek = sortedPlan
      .filter((workout) => {
        const workoutDate = new Date(workout.date);
        return (
          workoutDate >= startOfToday && workoutDate <= new Date(startOfToday.getTime() + 14 * 24 * 60 * 60 * 1000)
        );
      })
      .slice(0, 14); // Show up to 14 days of workouts to prevent scheduling conflicts

    console.log('🏃‍♂️ [formatTrainingPlanForPrompt] FILTERED UPCOMING:', {
      upcomingOrCurrentWeekLength: upcomingOrCurrentWeek.length,
      upcomingWorkouts: upcomingOrCurrentWeek.map(w => ({
        id: w.id,
        date: w.date,
        session_type: w.session_type,
        suggested_location: w.suggested_location
      }))
    });

    if (upcomingOrCurrentWeek.length === 0) {
      const result = 'No upcoming workouts in the training plan for the next 14 days.';
      console.log('🏃‍♂️ [formatTrainingPlanForPrompt] RESULT (no upcoming):', result);
      return result;
    }

    const result = upcomingOrCurrentWeek
      .map((workout) => {
        const date = new Date(workout.date);
        const dayOfWeek = getDayOfWeek(date);
        const isToday = workout.date === todayStr ? ' (TODAY)' : '';
        const sessionIdText = workout.id ? ` (ID: ${workout.id})` : '';

        let description = `${workout.session_type || 'Workout'}`;
        if (workout.distance) description += ` ${workout.distance}km`;
        if (workout.time) description += ` ${workout.time}min`;
        if (workout.pace) description += ` @ ${workout.pace}`;
        if (workout.exertion_level) description += ` RPE ${workout.exertion_level}`;

        // Add suggested location if available
        let locationInfo = '';
        if (workout.suggested_location) {
          locationInfo = ` Location: ${workout.suggested_location}.`;
        }

        // Add suggested shoe if available
        let shoeInfo = '';
        if (workout.suggested_shoe) {
          shoeInfo = ` Suggested shoe: ${workout.suggested_shoe}.`;
        }

        // Add status info
        let statusLabel = '';
        if (workout.status) {
          let statusText = '';
          switch (workout.status) {
            case 'completed':
              statusText = 'Completed';
              break;
            case 'skipped':
              statusText = 'Skipped';
              break;
            case 'not_completed':
              statusText = 'Not Completed';
              break;
            default:
              statusText = workout.status;
          }
          statusLabel = ` Status: ${statusText}.`;
        }

        return `ID ${workout.id || 'N/A'}: ${dayOfWeek}, ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${description}${isToday}.${locationInfo}${shoeInfo}${statusLabel} Notes: ${workout.notes || 'None'}`;
      })
      .join('\n');

    console.log('🏃‍♂️ [formatTrainingPlanForPrompt] FINAL RESULT:');
    console.log('=====================================');
    console.log(result);
    console.log('=====================================');

    return result;
  };

  /**
   * Format chat summaries for the AI prompt
   */
  const formatChatSummariesForPrompt = (chatSummaries: any[]): string => {
    console.log('💬 [formatChatSummariesForPrompt] INPUT:', {
      chatSummariesLength: chatSummaries?.length || 0,
      chatSummaries: chatSummaries || []
    });

    if (!chatSummaries || chatSummaries.length === 0) {
      console.log('💬 [formatChatSummariesForPrompt] RESULT (empty):', '');
      return '';
    }

    const result = 'Previous conversation summaries:\n' +
      chatSummaries
        .map((summary, index) => {
          const typeLabel =
            summary.chat_type === 'workout'
              ? 'Workout'
              : summary.chat_type === 'topic'
                ? `Topic: ${summary.topic}`
                : 'General';
          return `${index + 1}. ${typeLabel}: ${summary.summary}`;
        })
        .join('\n');

    console.log('💬 [formatChatSummariesForPrompt] RESULT:');
    console.log('=====================================');
    console.log(result);
    console.log('=====================================');

    return result;
  };

  /**
   * Format a user-friendly message for plan adjustment confirmation
   */
  const formatPlanAdjustmentPrompt = (planUpdate: PlanUpdate, trainingPlan: any[]): string => {
    let confirmationPrompt = '';

    // If this is a date change
    if (planUpdate.new_date && planUpdate.new_date !== planUpdate.date) {
      const currentDate = new Date(planUpdate.date);
      const newDate = new Date(planUpdate.new_date);

      confirmationPrompt = `I can move your ${planUpdate.session_type} workout from ${formatDate(currentDate)} to ${formatDate(newDate)}.

The updated workout would be:
• Distance: ${planUpdate.new_distance}km
• Time: ${planUpdate.new_time} minutes
• Notes: ${planUpdate.new_notes}

Would you like me to make this change to your training plan?`;
    } else {
      // For non-date changes
      const workout = trainingPlan.find(
        (w) =>
          w.week_number === planUpdate.week &&
          w.date === planUpdate.date &&
          w.session_type === planUpdate.session_type
      );

      if (workout) {
        confirmationPrompt = `I suggest adjusting your ${planUpdate.session_type} workout from Week ${planUpdate.week} as follows:

Current:
• Distance: ${workout.distance}km
• Time: ${workout.time} minutes
• Notes: ${workout.notes}

Proposed change:
• Distance: ${planUpdate.new_distance}km ${planUpdate.new_distance !== workout.distance ? '(' + (planUpdate.new_distance < workout.distance ? 'reduced' : 'increased') + ')' : '(unchanged)'}
• Time: ${planUpdate.new_time} minutes ${planUpdate.new_time !== workout.time ? '(' + (planUpdate.new_time < workout.time ? 'reduced' : 'increased') + ')' : '(unchanged)'}
• Notes: ${planUpdate.new_notes}

Would you like me to update your training plan with these changes?`;
      } else {
        confirmationPrompt = `I suggest adjusting your ${planUpdate.session_type} workout from Week ${planUpdate.week} to:

• Distance: ${planUpdate.new_distance}km
• Time: ${planUpdate.new_time} minutes
• Notes: ${planUpdate.new_notes}

Would you like me to update your training plan with these changes?`;
      }
    }

    return confirmationPrompt;
  };

  /**
   * Builds the user context string to be provided to the AI.
   */
  const buildUserContextString = (
    profile: any,
    trainingPlan: any[],
    recentMessages: ChatMessage[],
    feedback?: UserTrainingFeedbackData | null
  ): string => {
    console.log('👤 [buildUserContextString] INPUT:', {
      profile: profile ? {
        nickname: profile.nickname,
        experience_level: profile.experience_level,
        current_mileage: profile.current_mileage,
        goal_description: profile.goal_description,
        goal_type: profile.goal_type,
        units: profile.units,
        weekly_mileage: profile.weekly_mileage,
        coach_id: profile.coach_id
      } : null,
      trainingPlanLength: trainingPlan?.length || 0,
      recentMessagesLength: recentMessages?.length || 0,
      hasFeedback: !!feedback
    });

    let context =
      '--- USER CONTEXT ---\
';

    // Profile Information
    context += '\n## Your Profile:\n';
    context += `- Name/Nickname: ${profile?.nickname || profile?.first_name || 'Unknown'}\n`;
    context += `- Experience Level: ${profile?.experience_level || profile?.running_experience || 'Unknown'}\n`;
    context += `- Current Weekly Mileage: ${profile?.current_mileage || profile?.weekly_volume || 'Unknown'}\n`;
    context += `- Goal: ${profile?.goal_description || profile?.goal_type || 'General fitness'}\n`;
    context += `- Preferred Units: ${profile?.units || 'km'}\n`;
    if (profile?.injury_history && profile.injury_history !== 'None' && profile.injury_history !== '') {
      context += `- Injury History: ${profile.injury_history}\n`;
    }
    if (profile?.training_frequency) {
      context += `- Weekly Training Frequency: ${profile.training_frequency}\n`;
    }

    // Training Plan for the Week
    context += "\n## This Week's Training Plan:\n";
    context += `${formatTrainingPlanForPrompt(trainingPlan)}\n`;

    // Recent User Feedback/Preferences (from user_training_feedback table)
    if (feedback) {
      context +=
        '\n## Your Recent Feedback & Preferences (Week of ' +
        (feedback.week_start_date || 'current') +
        '):\n';
      if (feedback.feedback_summary) {
        context += `- Summary: ${feedback.feedback_summary}\n`;
      }
      if (feedback.prefers && Object.keys(feedback.prefers).length > 0) {
        context += `- Prefers: ${JSON.stringify(feedback.prefers)}\n`;
      }
      if (feedback.struggling_with && Object.keys(feedback.struggling_with).length > 0) {
        context += `- Struggling With: ${JSON.stringify(feedback.struggling_with)}\n`;
      }
    }

    // Recent Conversation History (already part of messages array, but could be summarized here if needed)
    // For now, assuming recentMessages will be passed directly in the API call's messages array.
    // If we wanted to include it textually here:
    // context += "\n## Recent Conversation Snippet:\n";
    // recentMessages.slice(-3).forEach(msg => {
    //   context += `- ${msg.sender === 'user' ? 'You' : 'Coach'}: ${msg.message}\n`;
    // });

    context +=
      '\n--- END USER CONTEXT ---\
';

    console.log('👤 [buildUserContextString] RESULT:');
    console.log('=====================================');
    console.log(context);
    console.log('=====================================');

    return context;
  };

  /**
   * Builds the system prompt for the AI coach.
   * This version can optionally accept a training plan to include today's and tomorrow's workouts.
   * It can also include coach-specific communication style information and current weather conditions.
   */
  const buildSystemPrompt = async (
    trainingPlan?: any[],
    coachId?: string,
    weatherData?: WeatherForecast | null
  ): Promise<string> => {
    console.log('🤖 [buildSystemPrompt] INPUT:', {
      trainingPlanLength: trainingPlan?.length || 0,
      coachId,
      hasWeatherData: !!weatherData,
      weatherDataSample: weatherData ? {
        currentTemp: weatherData.current?.temperature,
        currentConditions: weatherData.current?.weatherCode,
        hourlyDataLength: weatherData.hourly?.length || 0
      } : null
    });

    const today = new Date();
    const dayOfWeek = getDayOfWeek(today);
    const formattedDate = `${dayOfWeek}, ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowFormatted = `${getDayOfWeek(tomorrow)}, ${tomorrow.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

    // Add current time for time-sensitive conversations
    const currentTime = today.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const currentHour = today.getHours();

    // Determine time of day for contextual conversation guidance
    let timeOfDay = '';
    if (currentHour >= 5 && currentHour < 12) {
      timeOfDay = 'morning';
    } else if (currentHour >= 12 && currentHour < 17) {
      timeOfDay = 'afternoon';
    } else if (currentHour >= 17 && currentHour < 21) {
      timeOfDay = 'evening';
    } else {
      timeOfDay = 'night';
    }

    console.log('🤖 [buildSystemPrompt] TIME CONTEXT:', {
      today: formattedDate,
      tomorrow: tomorrowFormatted,
      currentTime,
      timeOfDay,
      currentHour
    });

    // Get user location for locally-relevant suggestions
    let locationContext = '';
    try {
      const locationInfo = await getLocationForPlanGeneration();
      if (locationInfo) {
        const formattedLocation = formatLocationForPrompt(locationInfo);
        if (formattedLocation) {
          locationContext = `\n\nUSER LOCATION: You are coaching a runner in ${formattedLocation}. When suggesting training locations, prioritize local parks, trails, tracks, and running routes that would be appropriate for this area. Use your knowledge of popular running spots in this region.`;
        }
        console.log('🤖 [buildSystemPrompt] LOCATION CONTEXT:', { locationContext: formattedLocation || 'Not available' });
      } else {
        console.log('🤖 [buildSystemPrompt] LOCATION CONTEXT:', { locationContext: 'Location info not available' });
      }
    } catch (error) {
      console.log('[buildSystemPrompt] Could not get user location for context:', error);
      console.log('🤖 [buildSystemPrompt] LOCATION CONTEXT:', { locationContext: 'Error getting location' });
      // Continue without location context
    }

    // Get weather information if available
    const weatherContext = formatWeatherForPrompt(weatherData);

    // Get coach-specific information if coachId is provided
    let coachPersonality = '';
    let coachCommunicationStyle = '';
    let coachName = 'Coach';

    if (coachId && coachStyles[coachId]) {
      const coachStyle = coachStyles[coachId];
      coachName = coachStyle.name;
      coachPersonality = `\n\nYOUR PERSONALITY: ${coachStyle.personality.join(', ')}`;
      coachCommunicationStyle = `\nYOUR COMMUNICATION STYLE: ${coachStyle.communicationStyle.join(', ')}`;
    }

    console.log('🤖 [buildSystemPrompt] COACH CONTEXT:', {
      coachName,
      hasPersonality: !!coachPersonality,
      hasCommunicationStyle: !!coachCommunicationStyle
    });

    // Note: The Realtime API will get user profile and plan dynamically if needed via functions or context.
    // This system prompt focuses on role, capabilities, and tool usage.
    const systemPrompt = `You are ${coachName}, an AI running coach. Today is ${formattedDate}. Tomorrow is ${tomorrowFormatted}. It's currently ${currentTime} (${timeOfDay}).${weatherContext}${coachPersonality}${coachCommunicationStyle}${locationContext}
You are conversational, helpful, and encouraging.
Answer running-related questions (nutrition, recovery, gear, etc.).
Explain training sessions and help the user understand their plan.

TRAINING TERMINOLOGY:
- **"Workouts"** = Hard training sessions (tempo runs, hills/hill repeats, intervals, threshold runs, track work, fartlek)
- **"Runs"** = Easy runs, recovery runs, basic long runs (without pace work)
- When users mention "workout day preferences," they typically mean scheduling hard training sessions, NOT easy/recovery runs
- Easy runs and recovery runs should generally stay flexible and fill in around the structured hard sessions

WEATHER-AWARE COACHING:
${weatherData ? 'Use the current weather conditions to provide relevant training advice. Consider factors like temperature, precipitation, wind, and humidity when discussing workouts. Suggest appropriate gear, timing adjustments, or safety considerations based on conditions.' : 'Weather information is not currently available.'}

INITIAL GREETING:
When starting a conversation, begin with a friendly, time-appropriate greeting. Consider the time of day and status of their workouts (Complete, Skipped, Not Completed) for your conversation starters, you might ask how they slept in the morning, or if they had a chance to finish their run if its the evening.

DO NOT assume they want to change their training plan in your first message. Offer to chat about their training plan, answer questions, or just check in on how they're doing.

IMPORTANT: WORKOUT ADJUSTMENTS & FEEDBACK:
You have tools to modify workouts, suggest products and record feedback.

1. 'execute_workout_adjustment': Use this when a user asks to change a specific aspect of a workout.
   - **SCHEDULING CONFLICTS - MANDATORY CHECK**: Before moving any workout to a new date, you MUST check the training plan for existing workouts on that target date. If there's already a workout scheduled:
     a) For Easy Runs: Suggest swapping them (e.g., "I can move your Long Run to Sunday and your Easy Run to Saturday")
     b) For Hard Sessions: Ask which workout to prioritize or suggest a different day
     c) NEVER create double-booked days without explicit user approval
   - **CONVERSATIONAL APPROACH**: When users mention general preferences (like "I prefer workouts on Tuesdays/Fridays"), use this flow:
     a) FIRST call 'add_user_training_feedback' to record the preference
     b) THEN say: "Got it! I've recorded your preference. Let me take this one step at a time. You currently have [describe current workout]. Would you like to swap it with [describe other workout]?"
     c) ONLY make one change at a time with explicit user confirmation for each swap
   - **SINGLE CHANGES**: For direct requests like "Can I change the location?" or "Make it shorter" - call the function immediately
   - SESSION ID: Use session_id from the user's training plan (provided in user context) when possible
   - LOCATION CHANGES: Use new_suggested_location parameter with proper capitalization

   **SMART SCHEDULING EXAMPLES:**
   User: "I prefer workouts on Tuesdays and Fridays"
   You: CALL add_user_training_feedback → "I've noted that preference for future plans! I see you currently have an easy run on Tuesday and a hill workout on Wednesday. Would you like to swap those so your hill workout is on Tuesday instead?"

2. 'get_gear_recommendations': ALWAYS call this function when users mentions:
   - recommendations for stuff to wear / what to wear / gear recommendations
   - Weather + clothing needs: "it's cold", "it's hot", "rainy day", "what should I wear"
   - Product questions: "any products", "recommendations", "gear suggestions"
   - Temperature concerns: "freezing", "hot", "chilly", "warm day"
   
   **COACHING TONE:** After calling the function, recommend gear like a knowledgeable coach:
   - Focus on PERFORMANCE benefits and weather suitability
   - Use natural language: "I'd suggest the Weather Jacket by On...". Don't overload recommendations, just one or two
   - Explain WHY each item works for the conditions
   - Sound like you're giving advice, not selling products
   - You are an employee of On, so you should only recommend On products, never generic products.
   
   **EXAMPLE:** User: "Do you think you've got any gear recommendations?"
   **ACTION:** Call get_gear_recommendations with weather_context="cold and windy", category="Apparel"
   **RESPONSE:** "For these cold conditions, I'd recommend the Weather Jacket by On - it's ultralight but offers great wind and water protection to keep you comfortable. "   

3. 'add_user_training_feedback': Use this to record training feedback in the RIGHT category:
   
   📍 USE 'prefers' FOR PERSISTENT SCHEDULING PREFERENCES (carry forward to ALL future plans):
   - Day preferences: "I prefer long runs on Sundays" → {'I prefer long runs on Sundays': true}
   - Workout timing: "I like workouts on Tuesdays/Fridays" → {'I like workouts on Tuesdays and Fridays': true}
   - General preferences: "I prefer morning runs" → {'I prefer morning runs': true}
   
   📝 USE 'feedback_summary' FOR WEEKLY CONTEXTUAL FEEDBACK (recent training context only):
   - Temporary conditions: "I was sick last week", "Feeling tired lately", "Traveling next week"
   - Specific workout feedback: "The tempo run felt too hard", "Long run went great"
   - Weekly observations: "Had trouble with motivation this week"

   ⚠️ CRITICAL: Scheduling preferences like day/time preferences MUST go in 'prefers', NOT 'feedback_summary'!

IMPORTANT: DO NOT show session IDs (like "ID: 745f2e19-dbeb-483c-945d-436145899d15") to users in your responses. These are technical identifiers that confuse users. However, you MUST use them internally when calling the execute_workout_adjustment function for accuracy. When referring to workouts in conversation, use descriptive terms like "your morning run" or "today's tempo workout" instead.

Engage naturally. Do NOT ask users to phrase requests in specific ways.
Keep responses concise but informative. Maintain a positive and supportive tone.`;

    // Log the system prompt for debugging
    console.log('🤖 [buildSystemPrompt] FINAL SYSTEM PROMPT:');
    console.log('=====================================');
    console.log(systemPrompt);
    console.log('=====================================');

    return systemPrompt;
  };

  /**
   * Defines the tools for the OpenAI Realtime API.
   */
  const getToolsDefinitionForRealtimeAPI = () => {
    console.log('⚙️ [getToolsDefinitionForRealtimeAPI] Generating tools definition for Realtime API');
    
    // The Realtime API requires a different format than the standard Chat API
    // Format: { name, type: "function", parameters } instead of { type: "function", function: { name, parameters } }
    const tools = [
      {
        name: 'execute_workout_adjustment',
        type: 'function',
        description:
          "IMMEDIATELY modifies a user's scheduled workout when they request any change (date, distance, duration, intensity, suggested location, or delete it). Call this function as soon as the user asks for a change - their request IS the confirmation. For location changes, use the new_suggested_location parameter.",
        parameters: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description:
                "The ID of the workout session to modify. Highly preferred - check today's/tomorrow's workout info in the system prompt.",
            },
            original_date: {
              type: 'string',
              format: 'date',
              description:
                'The original date (YYYY-MM-DD) of the workout. Used if session_id is unknown.',
            },
            workout_type: {
              type: 'string',
              description:
                "Type of workout (e.g., 'Easy Run', 'Long Run', 'Rest Day'). Used with original_date if session_id is unknown.",
            },
            adjustment_details: {
              type: 'object',
              properties: {
                new_date: { type: 'string', format: 'date', description: 'New date (YYYY-MM-DD).' },
                new_distance: {
                  type: 'number',
                  description: "New distance (user's preferred units).",
                },
                new_duration_minutes: { type: 'number', description: 'New duration in minutes.' },
                new_suggested_location: {
                  type: 'string',
                  description:
                    "New suggested training location for the workout. Use proper capitalization (e.g., 'The Tan', 'Royal Park', 'Botanical Gardens').",
                },
                intensity_change: {
                  type: 'string',
                  enum: ['easier', 'harder', 'same'],
                  description: 'Intensity change.',
                },
                action: {
                  type: 'string',
                  enum: ['update', 'delete'],
                  description: "Action: 'update' or 'delete'. Default 'update'.",
                },
                reason: { type: 'string', description: "User's reason for change (optional)." },
                user_query: {
                  type: 'string',
                  description: 'The original user query that led to this adjustment.',
                },
              },
              required: ['user_query'],
            },
          },
          required: ['adjustment_details'],
        },
      },
      {
        name: 'add_user_training_feedback',
        type: 'function',
        description:
          "Records user's training preferences, struggles, or general feedback to personalize future plans. Can include preferred workout types, times, feelings about intensity, etc.",
        parameters: {
          type: 'object',
          properties: {
            week_start_date: {
              type: 'string',
              format: 'date',
              description:
                'Week start date (YYYY-MM-DD) for the feedback. Defaults to current week if not provided.',
            },
            prefers: {
              type: 'object',
              description:
                "JSON object for preferences (e.g., {'morning_runs': true, 'solo_sessions': false}).",
            },
            struggling_with: {
              type: 'object',
              description:
                "JSON object for struggles (e.g., {'motivation': 'low', 'hills': 'difficulty'}).",
            },
            feedback_summary: {
              type: 'string',
              description: 'A general text summary of the feedback provided by the user.',
            },
            raw_data: {
              type: 'object',
              description: 'Any other relevant structured data from the conversation.',
            },
          },
          required: ['feedback_summary'],
        },
      },
      {
        name: 'get_gear_recommendations',
        type: 'function',
        description:
          'Fetches running gear recommendations when discussing weather-appropriate clothing, footwear, or equipment. Use this when the user asks about what to wear, gear for weather conditions, or when providing weather-based training advice that would benefit from specific product recommendations.',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['Shoes', 'Apparel', 'All'],
              description:
                "Filter by product category. Use 'Shoes' for footwear, 'Apparel' for clothing, or 'All' for everything.",
            },
            weather_context: {
              type: 'string',
              description:
                "Brief description of weather conditions to help contextualize recommendations (e.g., 'cold and rainy', 'hot and sunny', 'windy conditions').",
            },
            activity_type: {
              type: 'string',
              description:
                "Type of activity the gear is for (e.g., 'easy run', 'long run', 'speed workout', 'general training').",
            },
          },
          required: [],
        },
      },
    ];

    console.log('⚙️ [getToolsDefinitionForRealtimeAPI] TOOLS DEFINITION:');
    console.log('=====================================');
    console.log(JSON.stringify(tools, null, 2));
    console.log('=====================================');

    return tools;
  };

  /**
   * Format weather data for the AI coach prompt - provides 7-day forecast
   */
  const formatWeatherForPrompt = (weatherData?: WeatherForecast | null): string => {
    if (!weatherData) {
      return '';
    }

    const { current, hourly } = weatherData;

    try {
      const systemZone = ZoneId.systemDefault();
      const today = LocalDate.now(systemZone);

      // Helper function to format weather for a specific date
      const formatDayWeather = (targetDate: LocalDate): string | null => {
        const diffDays = targetDate.toEpochDay() - today.toEpochDay();

        // Determine day label
        let dayLabel: string;
        if (diffDays === 0) {
          dayLabel = "Today's";
        } else if (diffDays === 1) {
          dayLabel = "Tomorrow's";
        } else if (diffDays > 1 && diffDays <= 7) {
          const jsDate = new Date(
            targetDate.year(),
            targetDate.monthValue() - 1,
            targetDate.dayOfMonth()
          );
          dayLabel = `${jsDate.toLocaleDateString('en-US', { weekday: 'long' })}'s`;
        } else {
          return null; // Skip days beyond 7 days
        }

        // Filter hourly data for this specific date
        const targetDateString = targetDate.toString(); // YYYY-MM-DD format
        const dayWeatherData = hourly.filter((hour) => {
          const hourDateString = hour.time.split('T')[0]; // Extract YYYY-MM-DD
          return hourDateString === targetDateString;
        });

        if (dayWeatherData.length === 0) {
          return `${dayLabel} weather: Data unavailable`;
        }

        // Get temperature range for the day
        const temperatures = dayWeatherData.map((h) => h.temperature);
        const minTemp = Math.min(...temperatures);
        const maxTemp = Math.max(...temperatures);

        // Check for rain during the day
        const hasRainExpected = dayWeatherData.some(
          (hour) =>
            (hour.weatherCode >= 51 && hour.weatherCode <= 67) || // Rain/drizzle
            (hour.weatherCode >= 80 && hour.weatherCode <= 82) // Rain showers
        );

        let weatherText = `${dayLabel} weather: ${minTemp}-${maxTemp}°`;

        if (hasRainExpected) {
          // Find when rain is expected
          const rainHours = dayWeatherData.filter(
            (hour) =>
              (hour.weatherCode >= 51 && hour.weatherCode <= 67) ||
              (hour.weatherCode >= 80 && hour.weatherCode <= 82)
          );

          if (rainHours.length > 0) {
            const firstRainHour = new Date(rainHours[0].time);
            const lastRainHour = new Date(rainHours[rainHours.length - 1].time);

            if (rainHours.length >= 6) {
              // Rain for most of the day
              weatherText += ', rain expected';
            } else {
              // Rain during specific time period
              const startTime = firstRainHour.getHours();
              const endTime = lastRainHour.getHours();

              let timeOfDay: string;
              if (endTime <= 12) {
                timeOfDay = 'morning';
              } else if (startTime >= 17) {
                timeOfDay = 'evening';
              } else if (startTime >= 12 && endTime <= 17) {
                timeOfDay = 'afternoon';
              } else {
                timeOfDay = `${startTime}:00-${endTime}:00`;
              }

              weatherText += `, rain in the ${timeOfDay}`;
            }
          }
        } else {
          // Check general conditions
          const mostCommonWeatherCode =
            dayWeatherData
              .map((h) => h.weatherCode)
              .sort(
                (a, b) =>
                  dayWeatherData.filter((h) => h.weatherCode === a).length -
                  dayWeatherData.filter((h) => h.weatherCode === b).length
              )
              .pop() || 0;

          const description = getWeatherDescription(mostCommonWeatherCode).toLowerCase();

          if (description.includes('clear') || description.includes('sunny')) {
            weatherText += ', clear skies';
          } else if (description.includes('cloud')) {
            weatherText += ', cloudy conditions';
          }
        }

        return weatherText;
      };

      // Generate 7-day forecast
      const forecastDays: string[] = [];
      for (let i = 0; i < 7; i++) {
        const targetDate = today.plusDays(i);
        const dayForecast = formatDayWeather(targetDate);
        if (dayForecast) {
          forecastDays.push(dayForecast);
        }
      }

      if (forecastDays.length === 0) {
        return '\n\nWEATHER FORECAST:\nWeather data unavailable for the next 7 days.';
      }

      // Add current conditions for context
      const currentCondition = getWeatherDescription(current.weatherCode);
      const windInfo =
        current.windSpeed > 20
          ? ` (windy at ${current.windSpeed} km/h)`
          : current.windSpeed > 10
            ? ` (${current.windSpeed} km/h wind)`
            : '';

      const weatherContext = `\n\nWEATHER FORECAST:
Current conditions: ${current.temperature}° and ${currentCondition.toLowerCase()}${windInfo}. Humidity: ${current.humidity}%.

7-Day Forecast:
${forecastDays.join('\n')}

Use this weather information to provide relevant training advice, suggest appropriate gear, timing adjustments, or safety considerations based on conditions.`;

      return weatherContext;
    } catch (error) {
      console.error('Error formatting weather for prompt:', error);
      return '\n\nWEATHER FORECAST:\nError retrieving weather information.';
    }
  };

  /**
   * Get gear recommendations for the AI coach
   * This function provides access to product information for making weather-appropriate recommendations
   */
  const getGearRecommendations = (
    category?: 'Shoes' | 'Apparel' | 'All',
    weatherContext?: string,
    activityType?: string
  ) => {
    console.log('👕 [getGearRecommendations] INPUT:', {
      category,
      weatherContext,
      activityType
    });

    const allProducts = getFallbackProducts();

    // Filter by category if specified
    let filteredProducts = allProducts;
    if (category && category !== 'All') {
      filteredProducts = allProducts.filter((product) => product.category === category);
    }

    // Return product information without URLs and prices (for coaching recommendations, not sales)
    const productRecommendations = filteredProducts.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      brand: product.brand,
    }));

    const result = {
      products: productRecommendations,
      context: {
        weather_context: weatherContext,
        activity_type: activityType,
        total_products: productRecommendations.length,
        categories_available: [...new Set(allProducts.map((p) => p.category))],
      },
    };

    console.log('👕 [getGearRecommendations] RESULT:', {
      totalProducts: result.products.length,
      categories: result.context.categories_available,
      filteredByCategory: category,
      weatherContext: result.context.weather_context,
      activityType: result.context.activity_type,
      products: result.products.map(p => ({ name: p.name, category: p.category, brand: p.brand }))
    });

    return result;
  };

  return {
    formatDate,
    getDayOfWeek,
    formatDateYMD,
    formatTrainingPlanForPrompt,
    formatChatSummariesForPrompt,
    formatPlanAdjustmentPrompt,
    buildUserContextString,
    buildSystemPrompt,
    getToolsDefinitionForRealtimeAPI,
    formatWeatherForPrompt,
    getGearRecommendations,
  };
}
