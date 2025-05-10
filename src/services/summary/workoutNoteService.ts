import { supabase } from '../../lib/supabase';
import Constants from 'expo-constants';

/**
 * Creates a summary for workout notes using AI
 * @param notes The workout notes to summarize
 * @param userId User ID
 * @param workoutId The workout ID
 * @returns The generated summary
 */
export async function createWorkoutNoteSummary(
  notes: string,
  userId: string,
  workoutId: string
): Promise<string | null> {
  try {
    // Get API key
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
                   Constants.expoConfig?.extra?.openaiApiKey ||
                   Constants.expoConfig?.extra?.OPENAI_API_KEY ||
                   (Constants.manifest as any)?.extra?.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('📝 [createWorkoutNoteSummary] OpenAI API key not found');
      return null;
    }

    // Fetch the workout details to provide context
    const { data: workoutData, error: workoutError } = await supabase
      .from('training_plans')
      .select('session_type, distance, time, notes')
      .eq('id', workoutId)
      .single();

    if (workoutError) {
      console.error('📝 [createWorkoutNoteSummary] Error fetching workout details:', workoutError);
    }

    // Create prompt with workout context if available
    let systemPrompt = 'Create a concise summary (30-50 tokens) of these workout notes. Focus on key observations, feelings, and performance indicators.';
    
    if (workoutData) {
      systemPrompt = `Create a concise summary (30-50 tokens) of these notes from a ${workoutData.session_type} workout (${workoutData.distance}km, ${workoutData.time} min). 
      Focus on key observations about performance, physical feelings, and mental state. Include anything about injuries or other issues.
      The summary will be used to track workout progress and patterns over time and write upcoming training plans.`;
    }

    // Use GPT-3.5-turbo for note summarization
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
            content: systemPrompt
          },
          { role: 'user', content: notes }
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      console.error('📝 [createWorkoutNoteSummary] OpenAI API error:', response.status, await response.text());
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices[0].message.content.trim();

    return summary;
  } catch (error) {
    console.error('📝 [createWorkoutNoteSummary] Error creating workout note summary:', error);
    return null;
  }
}

/**
 * Summarizes and stores workout notes when they are added or updated
 * @param workoutId Workout ID
 * @param notes The full workout notes
 * @param userId User ID
 * @returns True if successful, false otherwise
 */
export async function processWorkoutNotes(
  workoutId: string,
  notes: string,
  userId: string
): Promise<boolean> {
  try {
    // If notes are empty, no need to summarize
    if (!notes || notes.trim() === '') {
      return true;
    }
    
    // Check if we already have a summary for this workout
    const { data: existingSummaries, error: fetchError } = await supabase
      .from('workout_note_summaries')
      .select('id')
      .eq('workout_id', workoutId)
      .eq('user_id', userId)
      .limit(1);
      
    if (fetchError) {
      console.error('📝 [processWorkoutNotes] Error checking existing summaries:', fetchError);
      return false;
    }
    
    // Create a summary of the notes
    const summary = await createWorkoutNoteSummary(notes, userId, workoutId);
    
    if (!summary) {
      console.error('📝 [processWorkoutNotes] Failed to create summary');
      return false;
    }
    
    // If we have an existing summary, update it; otherwise create a new one
    if (existingSummaries && existingSummaries.length > 0) {
      const { error: updateError } = await supabase
        .from('workout_note_summaries')
        .update({ summary: summary })
        .eq('id', existingSummaries[0].id);
        
      if (updateError) {
        console.error('📝 [processWorkoutNotes] Error updating summary:', updateError);
        return false;
      }
    } else {
      // Create a new workout note summary entry
      const { data: insertData, error: insertError } = await supabase
        .from('workout_note_summaries')
        .insert({
          user_id: userId,
          workout_id: workoutId,
          summary: summary
        })
        .select();
        
      if (insertError) {
        console.error('📝 [processWorkoutNotes] Error creating summary entry:', insertError);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('📝 [processWorkoutNotes] Error processing workout notes:', error);
    return false;
  }
}

/**
 * Get note summary for a specific workout
 * @param workoutId Workout ID
 * @param userId User ID
 * @returns The note summary if available, null otherwise
 */
export async function getWorkoutNoteSummary(
  workoutId: string,
  userId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('workout_note_summaries')
      .select('summary')
      .eq('workout_id', workoutId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (error) {
      console.error('📝 [getWorkoutNoteSummary] Error fetching summary:', error);
      return null;
    }
    
    if (data && data.length > 0 && data[0].summary) {
      return data[0].summary;
    }
    
    return null;
  } catch (error) {
    console.error('📝 [getWorkoutNoteSummary] Error:', error);
    return null;
  }
} 