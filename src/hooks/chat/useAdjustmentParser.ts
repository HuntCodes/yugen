import Constants from 'expo-constants';

import { PlanUpdate } from '../chat/types';

export interface ParsedAdjustment {
  type: 'confirm' | 'reject' | 'adjust' | 'none';
  details?: string;
}

export function useAdjustmentParser() {
  /**
   * Check if message contains feedback that suggests plan adjustment
   */
  const hasPlanFeedback = (message: string): boolean => {
    const messageLower = message.toLowerCase();

    // Case 1: Explicit plan adjustment request with reason
    const adjustmentKeywords = [
      'adjust plan',
      'adjust the plan',
      'adjust my plan',
      'change plan',
      'change the plan',
      'change my plan',
      'modify plan',
      'modify the plan',
      'modify my plan',
      'update plan',
      'update the plan',
      'update my plan',
    ];

    const reasonKeywords = [
      'sore',
      'pain',
      'injured',
      'injury',
      'tired',
      'difficult',
      'hard',
      'easier',
      'too much',
    ];

    const hasExplicitRequest =
      adjustmentKeywords.some((term) => messageLower.includes(term)) &&
      reasonKeywords.some((term) => messageLower.includes(term));

    // Case 2: Reference to specific workout
    const workoutTypes = [
      'run',
      'running',
      'workout',
      'session',
      'tempo',
      'interval',
      'long run',
      'easy run',
      'recovery',
    ];

    const changeVerbs = [
      'change',
      'modify',
      'adjust',
      'update',
      'reduce',
      'make shorter',
      'make easier',
      'skip',
    ];

    const hasWorkoutReference =
      workoutTypes.some((workout) => messageLower.includes(workout)) &&
      changeVerbs.some((verb) => messageLower.includes(verb));

    // Case 3: Simple confirmations or change commands following a discussion about adjustments
    const simpleChangeCommands = [
      'change it',
      'modify it',
      'adjust it',
      'update it',
      'make it shorter',
      'make it easier',
      'lets change',
      'yes change',
      'please change',
    ];

    const hasSimpleCommand = simpleChangeCommands.some((cmd) => messageLower.includes(cmd));

    // Case 4: Date change requests
    const dateChangePatterns = [
      /move (\w+) to (\w+)/i,
      /move (\w+) from (\w+) to (\w+)/i,
      /change (\w+) to (\w+)/i,
      /reschedule (\w+) to (\w+)/i,
      /can('t| not) do (\w+) on (\w+)/i,
      /have .+ on (\w+).* can we change/i,
    ];

    const monthNamePatterns = [
      /january|february|march|april|may|june|july|august|september|october|november|december/i,
      /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i,
    ];

    const dayReferencePatterns = [
      /today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i,
    ];

    // Check for date change request patterns
    const hasDateChangeRequest =
      dateChangePatterns.some((pattern) => pattern.test(messageLower)) ||
      (monthNamePatterns.some((pattern) => pattern.test(messageLower)) &&
        messageLower.includes('move')) ||
      (dayReferencePatterns.some((pattern) => pattern.test(messageLower)) &&
        (messageLower.includes('move') || messageLower.includes('change')));

    return hasExplicitRequest || hasWorkoutReference || hasSimpleCommand || hasDateChangeRequest;
  };

  /**
   * Check if message is confirming a plan adjustment
   */
  const isConfirmingPlanUpdate = (message: string): boolean => {
    const messageLower = message.toLowerCase().trim();
    const confirmTerms = [
      'yes',
      'yeah',
      'yep',
      'yup',
      'sure',
      'ok',
      'okay',
      'confirm',
      'approved',
      'sounds good',
      'do it',
      'go ahead',
      'make the change',
      'update it',
    ];

    return confirmTerms.some((term) => messageLower.includes(term) || messageLower === term);
  };

  /**
   * Check if message is rejecting a plan adjustment
   */
  const isRejectingPlanUpdate = (message: string): boolean => {
    const messageLower = message.toLowerCase().trim();
    const rejectTerms = [
      'no',
      'nope',
      "don't",
      'dont',
      'cancel',
      'stop',
      'reject',
      'negative',
      'hold off',
      'wait',
      "don't change",
      'dont change',
    ];

    return rejectTerms.some((term) => messageLower.includes(term) || messageLower === term);
  };

  /**
   * Parse a user message to determine the type of adjustment request
   */
  const parseAdjustmentMessage = (message: string): ParsedAdjustment => {
    if (isConfirmingPlanUpdate(message)) {
      return { type: 'confirm' };
    }

    if (isRejectingPlanUpdate(message)) {
      return { type: 'reject' };
    }

    if (hasPlanFeedback(message)) {
      return {
        type: 'adjust',
        details: message,
      };
    }

    return { type: 'none' };
  };

  /**
   * Use AI to generate a specific plan adjustment based on user feedback
   */
  const generatePlanAdjustment = async (
    userMessage: string,
    profile: any,
    trainingPlan: any[]
  ): Promise<PlanUpdate | null> => {
    try {
      // Get API key using all available methods for consistency
      const apiKey =
        process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
        Constants.expoConfig?.extra?.openaiApiKey ||
        Constants.expoConfig?.extra?.OPENAI_API_KEY ||
        (Constants.manifest as any)?.extra?.OPENAI_API_KEY;

      if (!apiKey) {
        console.error('OpenAI API key is missing.');
        return null;
      }

      // Format the current training plan for AI context
      let trainingPlanText = '';

      if (trainingPlan && trainingPlan.length > 0) {
        // Sort by date
        const sortedPlan = [...trainingPlan].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Format to be more readable for AI
        trainingPlanText = sortedPlan
          .map((workout) => {
            const date = new Date(workout.date);
            return `Week ${workout.week_number}, ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}: ${workout.session_type} - ${workout.distance}km, ${workout.time} minutes, Notes: ${workout.notes}`;
          })
          .join('\n');
      } else {
        return null; // No plan to adjust
      }

      // Create a prompt that will ask for a specific plan adjustment
      const systemPrompt = `You are an AI running coach assistant. Your task is to suggest a specific modification to the user's training plan based on their feedback.

User profile: ${profile.fitness_level} runner, ${profile.age} years old, goal: ${profile.goal_description}.

Current training plan:
${trainingPlanText}

The user has requested a change to their plan. Analyze their message and suggest ONE specific modification to a particular workout in their training plan. Your suggestion should:
1. Identify the specific workout to modify (by week number, date, and type)
2. Provide updated values for distance, time, and session description
3. Be responsive to the user's needs while maintaining progress toward their goals

Format your response as JSON with the following fields:
{
  "week": (week number),
  "date": (date in format YYYY-MM-DD),
  "session_type": (type of session),
  "new_notes": (updated workout description),
  "new_distance": (updated distance in km),
  "new_time": (updated time in minutes),
  "new_date": (optional - only include if the date should be changed)
}`;

      // Call the OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', errorText);
        return null;
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      console.log('AI suggestion for plan adjustment:', aiResponse);

      return parseAIResponse(aiResponse);
    } catch (error) {
      console.error('Error in generatePlanAdjustment:', error);
      return null;
    }
  };

  /**
   * Parse the AI response to extract the plan update
   */
  const parseAIResponse = (aiResponse: string): PlanUpdate | null => {
    try {
      // Extract the JSON part
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Could not extract JSON from AI response');
        return null;
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);

      // Validate the response has the required fields
      if (
        !parsedResponse.week ||
        !parsedResponse.date ||
        !parsedResponse.session_type ||
        !parsedResponse.new_notes ||
        parsedResponse.new_distance === undefined ||
        parsedResponse.new_time === undefined
      ) {
        console.error('AI response is missing required fields', parsedResponse);
        return null;
      }

      return parsedResponse as PlanUpdate;
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      return null;
    }
  };

  /**
   * Generate a user-friendly confirmation message about the plan change
   */
  const generateConfirmationMessage = (update: PlanUpdate): string => {
    // Format date for display
    const date = new Date(update.date);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    // If this is a date change, create a different message
    if (update.new_date && update.new_date !== update.date) {
      const newDate = new Date(update.new_date);
      const formattedNewDate = newDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

      return `I've moved your ${update.session_type} workout from ${formattedDate} to ${formattedNewDate}.
      
Here's the updated workout:
• Distance: ${update.new_distance}km
• Time: ${update.new_time} minutes
• Notes: ${update.new_notes}

This change has been saved to your training plan. Let me know if you need any other adjustments.`;
    }

    // Standard message for non-date changes
    return `I've adjusted your ${update.session_type} workout (from Week ${update.week}) to be more manageable. 
    
Here's the updated workout:
• Distance: ${update.new_distance}km
• Time: ${update.new_time} minutes
• Notes: ${update.new_notes}

This change has been saved to your training plan. Let me know how it feels after you complete it, and we can make further adjustments if needed.`;
  };

  return {
    hasPlanFeedback,
    isConfirmingPlanUpdate,
    isRejectingPlanUpdate,
    parseAdjustmentMessage,
    generatePlanAdjustment,
    parseAIResponse,
    generateConfirmationMessage,
  };
}
