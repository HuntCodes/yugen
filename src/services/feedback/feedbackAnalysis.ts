import Constants from 'expo-constants';
import { ChatMessage } from '../../types/chat';

// Define TrainingFeedback interface inline to avoid import error
interface TrainingFeedback {
  id?: string;
  user_id: string;
  week_start_date: string;
  prefers: string[];
  struggling_with: string[];
  feedback_summary: string;
  raw_data?: {
    chat_messages?: any[];
    workout_notes?: any[];
  };
  created_at?: string;
  updated_at?: string;
}

/**
 * Extract training feedback using AI from user's weekly activity
 */
export async function extractTrainingFeedback(
  userId: string,
  weekStartDate: string, // YYYY-MM-DD format
  weekEndDate: string,    // YYYY-MM-DD format
  chatMessages: ChatMessage[],
  workoutsWithNotes: any[],
  skippedWorkouts: any[]
): Promise<TrainingFeedback | null> {
  try {
    // Get API key safely
    const apiKey = Constants.expoConfig?.extra?.openaiApiKey || 
                 Constants.expoConfig?.extra?.OPENAI_API_KEY ||
                 (Constants.manifest as any)?.extra?.OPENAI_API_KEY;
                 
    if (!apiKey) {
      console.error('OpenAI API key not found');
      return null;
    }

    // If there's no data from the week, don't create a summary
    if (
      chatMessages.length === 0 && 
      workoutsWithNotes.length === 0 && 
      skippedWorkouts.length === 0
    ) {
      console.log(`No data found for user ${userId} between ${weekStartDate} and ${weekEndDate}`);
      return null;
    }
    
    // Format the data for the AI
    const formattedChatMessages = chatMessages.map(msg => 
      `${msg.sender === 'user' ? 'User' : 'Coach'}: ${msg.message}`
    ).join('\n\n');
    
    const formattedWorkoutNotes = workoutsWithNotes.map(workout => 
      `${workout.date} - ${workout.session_type} (${workout.distance}km, ${workout.time}min): ${workout.post_session_notes}`
    ).join('\n\n');
    
    const formattedSkippedWorkouts = skippedWorkouts.map(workout => 
      `${workout.date} - ${workout.session_type} (${workout.distance}km, ${workout.time}min): ${workout.status.toUpperCase()}`
    ).join('\n\n');
    
    // Construct prompt for AI
    const prompt = `
Extract key training preferences and patterns based on the following data from a runner for the week of ${weekStartDate} to ${weekEndDate}.

CHAT CONVERSATIONS:
${formattedChatMessages || "No chat data available for this week."}

COMPLETED WORKOUT NOTES:
${formattedWorkoutNotes || "No completed workout notes available for this week."}

SKIPPED/MISSED WORKOUTS:
${formattedSkippedWorkouts || "No skipped/missed workouts for this week."}

Please analyze this data and fill out the following template:

Prefers:
- [LIST ACTIVITIES, WORKOUTS, OR BEHAVIORS THE USER CONSISTENTLY ENJOYS OR SUCCEEDS AT]

Struggling With:
- [LIST ACTIVITIES, WORKOUTS, OR BEHAVIORS THE USER AVOIDS, COMPLAINS ABOUT, OR FREQUENTLY FAILS TO COMPLETE]

Feedback Summary:
[WRITE A 2-3 SENTENCE SUMMARY OF THE USER'S OVERALL TRAINING EXPERIENCE, KEY INSIGHTS, AND SUGGESTIONS FOR FUTURE TRAINING]
`;

    // Call OpenAI API to generate the feedback
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert running coach assistant who analyzes training data and extracts insights. Be specific, concrete, and actionable. If there is insufficient data, make reasonable inferences but note the limitations.'
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const feedbackText = data.choices[0].message.content.trim();
    
    // Parse the response
    const parsedFeedback = parseFeedbackResponse(feedbackText);
    
    // Create the feedback object
    const trainingFeedback: TrainingFeedback = {
      user_id: userId,
      week_start_date: weekStartDate,
      prefers: parsedFeedback.prefers,
      struggling_with: parsedFeedback.strugglingWith,
      feedback_summary: parsedFeedback.feedbackSummary,
      raw_data: {
        chat_messages: chatMessages,
        workout_notes: workoutsWithNotes.concat(skippedWorkouts)
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    return trainingFeedback;
  } catch (error) {
    console.error('Error extracting training feedback:', error);
    return null;
  }
}

/**
 * Parse the AI response text to extract structured feedback
 */
function parseFeedbackResponse(feedbackText: string): {
  prefers: string[];
  strugglingWith: string[];
  feedbackSummary: string;
} {
  const prefers: string[] = [];
  const strugglingWith: string[] = [];
  let feedbackSummary = '';
  
  // Simple regex parsing
  const prefersMatch = feedbackText.match(/Prefers:\s*\n([\s\S]*?)(?=\n\s*Struggling With:|$)/i);
  if (prefersMatch && prefersMatch[1]) {
    const prefersSection = prefersMatch[1].trim();
    const items = prefersSection.split('\n').map((item: string) => item.replace(/^-\s*/, '').trim());
    prefers.push(...items.filter((item: string) => item.length > 0));
  }
  
  const strugglingWithMatch = feedbackText.match(/Struggling With:\s*\n([\s\S]*?)(?=\n\s*Feedback Summary:|$)/i);
  if (strugglingWithMatch && strugglingWithMatch[1]) {
    const strugglingSection = strugglingWithMatch[1].trim();
    const items = strugglingSection.split('\n').map((item: string) => item.replace(/^-\s*/, '').trim());
    strugglingWith.push(...items.filter((item: string) => item.length > 0));
  }
  
  const summaryMatch = feedbackText.match(/Feedback Summary:\s*\n?([\s\S]*?)$/i);
  if (summaryMatch && summaryMatch[1]) {
    feedbackSummary = summaryMatch[1].trim();
  }

  return {
    prefers,
    strugglingWith,
    feedbackSummary
  };
} 