import { ChatMessage } from './useMessageTypes';
import { PlanUpdate } from '../chat/types';

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
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
  };

  /**
   * Format a date as YYYY-MM-DD
   */
  const formatDateYMD = (date: Date) => {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };

  /**
   * Format training plan data for the AI prompt
   */
  const formatTrainingPlanForPrompt = (trainingPlan: any[]): string => {
    if (!trainingPlan || trainingPlan.length === 0) {
      return 'No training plan available yet.';
    }

    // Sort by date
    const sortedPlan = [...trainingPlan].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
      
    // Format today's date for comparison
    const today = new Date();
    const todayStr = formatDateYMD(today);
      
    // Get the next 5 workouts for context
    const upcomingWorkouts = sortedPlan.filter(workout => 
      workout.date >= todayStr
    ).slice(0, 5);
      
    if (upcomingWorkouts.length === 0) {
      return 'No upcoming workouts in the training plan.';
    }
      
    // Add information about which workouts are for today
    return upcomingWorkouts.map(workout => {
      const date = new Date(workout.date);
      const dayOfWeek = getDayOfWeek(date);
      const isToday = workout.date === todayStr ? " (TODAY)" : "";
        
      return `Week ${workout.week_number}, ${dayOfWeek}, ${date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}: ${workout.session_type}${isToday} - ${workout.distance}km, ${workout.time} minutes, Notes: ${workout.notes}`;
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
   * Create the system prompt for the AI
   */
  const buildSystemPrompt = (profile: any, trainingPlanText: string, summariesText: string): string => {
    // Format current date for prompt
    const today = new Date();
    const dayOfWeek = getDayOfWeek(today);
    const formattedDate = `${dayOfWeek}, ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    
    // Add date formatting helper for the AI
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowFormatted = `${getDayOfWeek(tomorrow)}, ${tomorrow.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    
    // Construct the system prompt
    return `You are an AI running coach with the following details:

This conversation is with a runner who has the following profile:
- Fitness level: ${profile?.fitness_level || 'Unknown'}
- Age: ${profile?.age || 'Unknown'}
- Goal: ${profile?.goal_description || 'General fitness'}
- Preferred distance: ${profile?.preferred_distance || 'Unknown'}
- Running experience: ${profile?.running_experience || 'Unknown'} 

IMPORTANT DATE INFORMATION:
- Today is ${formattedDate}.
- Tomorrow is ${tomorrowFormatted}.

Their upcoming training plan is:
${trainingPlanText}

${summariesText}

Your role is to:
1. Answer running-related questions
2. Provide motivation and support
3. Explain the purpose of different training sessions
4. Give general advice about nutrition, recovery, and gear
5. Help them understand their training plan

Respond conversationally in a helpful, encouraging tone. If they ask about adjusting their training plan, suggest they say "I need to adjust my plan because..." for you to assist with specific changes.

Keep responses concise but informative. Use an encouraging, positive tone while remaining honest about training challenges.`;
  };

  return {
    formatDate,
    getDayOfWeek,
    formatDateYMD,
    formatTrainingPlanForPrompt,
    formatChatSummariesForPrompt,
    formatPlanAdjustmentPrompt,
    buildSystemPrompt
  };
} 