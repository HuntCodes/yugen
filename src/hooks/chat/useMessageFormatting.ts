import { ChatMessage } from './useMessageTypes';
import { PlanUpdate } from '../chat/types';
import { UserTrainingFeedbackData } from '../../services/feedback/feedbackService';

/**
 * Hook for message formatting utilities
 */
export function useMessageFormatting() {
  /**
   * Format date as a readable string
   */
  const formatDate = (date: Date) => date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  /**
   * Format the day of week
   */
  const getDayOfWeek = (date: Date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  /**
   * Format a date as YYYY-MM-DD
   */
  const formatDateYMD = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  /**
   * Format training plan data for the AI prompt
   */
  const formatTrainingPlanForPrompt = (trainingPlan: any[]): string => {
    if (!trainingPlan || trainingPlan.length === 0) {
      return 'No training plan available yet.';
    }

    const sortedPlan = [...trainingPlan].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
      
    const today = new Date();
    const todayStr = formatDateYMD(today);
      
    // Show all upcoming workouts for the current week or next 7 days for better context for AI
    const upcomingOrCurrentWeek = sortedPlan.filter(workout => {
      const workoutDate = new Date(workout.date);
      return workoutDate >= today && workoutDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    }).slice(0, 7); // Limit to 7 for brevity if many exist
      
    if (upcomingOrCurrentWeek.length === 0) {
      return 'No upcoming workouts in the training plan for the next 7 days.';
    }
      
    return upcomingOrCurrentWeek.map(workout => {
      const date = new Date(workout.date);
      const dayOfWeek = getDayOfWeek(date);
      const isToday = workout.date === todayStr ? " (TODAY)" : "";
      const sessionIdText = workout.id ? ` (ID: ${workout.id})` : ""; 
        
      let description = `${workout.session_type || 'Workout'}`;
      if (workout.distance) description += ` ${workout.distance}km`;
      if (workout.time) description += ` ${workout.time}min`;
      if (workout.pace) description += ` @ ${workout.pace}`;
      if (workout.exertion_level) description += ` RPE ${workout.exertion_level}`;
        
      return `ID ${workout.id || 'N/A'}: ${dayOfWeek}, ${date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${description}${isToday}. Notes: ${workout.notes || 'None'}`;
    }).join('\n');
  };

  /**
   * Format chat summaries for the AI prompt
   */
  const formatChatSummariesForPrompt = (chatSummaries: any[]): string => {
    if (!chatSummaries || chatSummaries.length === 0) {
      return '';
    }

    return "Previous conversation summaries:\n" + 
      chatSummaries.map((summary, index) => {
        const typeLabel = summary.chat_type === 'workout' ? 'Workout' :
                          summary.chat_type === 'topic' ? `Topic: ${summary.topic}` :
                          'General';
        return `${index + 1}. ${typeLabel}: ${summary.summary}`;
      }).join('\n');
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
      const workout = trainingPlan.find(w => 
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
    let context = "--- USER CONTEXT ---\
";

    // Profile Information
    context += "\n## Your Profile:\n";
    context += `- Fitness Level: ${profile?.fitness_level || 'Unknown'}\n`;
    context += `- Age: ${profile?.age || 'Unknown'}\n`;
    context += `- Goal: ${profile?.goal_description || 'General fitness'}\n`;
    // Add other relevant profile fields: units, weekly_mileage, personal_best, constraints, etc.
    context += `- Preferred Units: ${profile?.units || 'km'}\n`;

    // Training Plan for the Week
    context += "\n## This Week's Training Plan:\n";
    context += `${formatTrainingPlanForPrompt(trainingPlan)}\n`;

    // Recent User Feedback/Preferences (from user_training_feedback table)
    if (feedback) {
      context += "\n## Your Recent Feedback & Preferences (Week of " + (feedback.week_start_date || 'current') + "):\n";
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

    context += "\n--- END USER CONTEXT ---\
";
    return context;
  };

  /**
   * Builds the system prompt for the AI coach.
   * This version can optionally accept a training plan to include today's and tomorrow's workouts.
   */
  const buildSystemPrompt = (trainingPlan?: any[]): string => {
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
      hour12: true 
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
    
    // Extract today's and tomorrow's workouts if training plan is provided
    let todayWorkout = '';
    let tomorrowWorkout = '';
    
    if (trainingPlan && trainingPlan.length > 0) {
      const todayStr = formatDateYMD(today);
      const tomorrowStr = formatDateYMD(tomorrow);
      
      const todaySession = trainingPlan.find(workout => workout.date === todayStr);
      const tomorrowSession = trainingPlan.find(workout => workout.date === tomorrowStr);
      
      if (todaySession) {
        todayWorkout = `\n\nTODAY'S TRAINING: ${todaySession.session_type || 'Workout'}`;
        if (todaySession.distance) todayWorkout += ` - ${todaySession.distance}km`;
        if (todaySession.time) todayWorkout += ` for ${todaySession.time} minutes`;
        if (todaySession.notes) todayWorkout += `. Notes: ${todaySession.notes}`;
        todayWorkout += ` (ID: ${todaySession.id || 'N/A'})`;
      } else {
        todayWorkout = '\n\nTODAY\'S TRAINING: Rest day or no scheduled workout';
      }
      
      if (tomorrowSession) {
        tomorrowWorkout = `\nTOMORROW'S TRAINING: ${tomorrowSession.session_type || 'Workout'}`;
        if (tomorrowSession.distance) tomorrowWorkout += ` - ${tomorrowSession.distance}km`;
        if (tomorrowSession.time) tomorrowWorkout += ` for ${tomorrowSession.time} minutes`;
        if (tomorrowSession.notes) tomorrowWorkout += `. Notes: ${tomorrowSession.notes}`;
        tomorrowWorkout += ` (ID: ${tomorrowSession.id || 'N/A'})`;
      } else {
        tomorrowWorkout = '\nTOMORROW\'S TRAINING: Rest day or no scheduled workout';
      }
    }
    
    // Note: The Realtime API will get user profile and plan dynamically if needed via functions or context.
    // This system prompt focuses on role, capabilities, and tool usage.
    const systemPrompt = `You are an AI running coach. Today is ${formattedDate}. Tomorrow is ${tomorrowFormatted}. It's currently ${currentTime} (${timeOfDay}).${todayWorkout}${tomorrowWorkout}
You are conversational, helpful, and encouraging.
Answer running-related questions (nutrition, recovery, gear, etc.).
Explain training sessions and help the user understand their plan.

INITIAL GREETING:
When starting a conversation, begin with a friendly, time-appropriate greeting. Consider the time of day for your conversation starters, you might ask how they slept in the morning, or if they had a chance to finish their run if its the evening.

DO NOT assume they want to change their training plan in your first message. Offer to chat about their training plan, answer questions, or just check in on how they're doing.

IMPORTANT: WORKOUT ADJUSTMENTS & FEEDBACK:
You have tools to modify workouts and record feedback.
1. 'execute_workout_adjustment': Use this to change aspects of a scheduled workout (date, distance, duration, intensity, or delete it).
   - SESSION ID: The user's training plan (which you should have access to or can ask about) contains session IDs. ALWAYS try to get and use the 'session_id' for accuracy.
   - CLARIFICATION: If ambiguous (e.g., 'change tomorrow\'s run' and there are multiple), ask for clarification (referencing description or ID) BEFORE calling the tool.
   - PROPOSAL: You will typically propose the change verbally. The system will then call the tool after user confirmation. (This part is slightly different for Realtime API - the API itself calls the tool based on your decision)
   - SWAPS: If a user asks to "swap" two workouts, explain you'll do it in two steps: confirm moving the first, then confirm moving the second. You will decide to call the 'execute_workout_adjustment' tool for each step.

2. 'add_user_training_feedback': Use this to record the user's training preferences, things they are struggling with, or general feedback. This helps personalize future plans. Specify 'week_start_date' if known, otherwise it defaults to the current week.

Engage naturally. Do NOT ask users to phrase requests in specific ways.
Keep responses concise but informative. Maintain a positive and supportive tone.`;

    // Log the system prompt for debugging
    console.log('[useMessageFormatting] System Prompt Generated:');
    console.log('=====================================');
    console.log(systemPrompt);
    console.log('=====================================');
    
    return systemPrompt;
  };

  /**
   * Defines the tools for the OpenAI Realtime API.
   */
  const getToolsDefinitionForRealtimeAPI = () => {
    // The Realtime API requires a different format than the standard Chat API
    // Format: { name, type: "function", parameters } instead of { type: "function", function: { name, parameters } }
    return [
      {
        name: 'execute_workout_adjustment',
        type: 'function',
        description: "Modifies a user's scheduled workout (e.g., change date, distance, duration, intensity, or delete it). Always aim to use a session_id.",
        parameters: {
          type: 'object',
          properties: {
            session_id: { type: 'string', description: "The ID of the workout session to modify. Highly preferred." },
            original_date: { type: 'string', format: 'date', description: "The original date (YYYY-MM-DD) of the workout. Used if session_id is unknown." },
            workout_type: { type: 'string', description: "Type of workout (e.g., 'Easy Run', 'Long Run', 'Rest Day'). Used with original_date if session_id is unknown." },
            adjustment_details: {
              type: 'object',
              properties: {
                new_date: { type: 'string', format: 'date', description: "New date (YYYY-MM-DD)." },
                new_distance: { type: 'number', description: "New distance (user's preferred units)." },
                new_duration_minutes: { type: 'number', description: "New duration in minutes." },
                intensity_change: { type: 'string', enum: ['easier', 'harder', 'same'], description: "Intensity change." },
                action: { type: 'string', enum: ['update', 'delete'], description: "Action: 'update' or 'delete'. Default 'update'." },
                reason: { type: 'string', description: "User's reason for change (optional)." },
                user_query: {type: 'string', description: "The original user query that led to this adjustment."}
              },
              required: ['user_query']
            }
          },
          required: ['adjustment_details']
        }
      },
      {
        name: 'add_user_training_feedback',
        type: 'function',
        description: "Records user's training preferences, struggles, or general feedback to personalize future plans. Can include preferred workout types, times, feelings about intensity, etc.",
        parameters: {
          type: 'object',
          properties: {
            week_start_date: { type: 'string', format: 'date', description: "Week start date (YYYY-MM-DD) for the feedback. Defaults to current week if not provided." },
            prefers: { type: 'object', description: "JSON object for preferences (e.g., {'morning_runs': true, 'solo_sessions': false})." },
            struggling_with: { type: 'object', description: "JSON object for struggles (e.g., {'motivation': 'low', 'hills': 'difficulty'})." },
            feedback_summary: { type: 'string', description: "A general text summary of the feedback provided by the user." },
            raw_data: { type: 'object', description: "Any other relevant structured data from the conversation."}
          },
          required: ['feedback_summary']
        }
      }
    ];
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
    getToolsDefinitionForRealtimeAPI
  };
} 