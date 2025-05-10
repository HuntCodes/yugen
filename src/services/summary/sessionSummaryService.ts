import { supabase } from '../../lib/api/supabase';
import { ChatMessage } from '../../types/chat';
import Constants from 'expo-constants';

// Define the summary types for sessions
export type SessionType = 'workout' | 'topic' | 'general';

// Interface for session summaries
export interface SessionSummary {
  id?: string;
  user_id: string;
  session_id?: string;
  topic?: string;
  session_type: SessionType;
  summary: string;
  note_summary?: string;
  time_frame?: {
    start: Date;
    end: Date;
  };
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Creates a summary for a session's messages using AI
 * @param messages Array of chat messages to summarize
 * @param userId User ID associated with the messages
 * @param sessionType Type of session (workout, topic, general)
 * @param sessionId Optional workout session ID if applicable
 * @param topic Optional topic name if applicable
 * @returns The generated summary
 */
export async function createSessionSummary(
  messages: ChatMessage[],
  userId: string,
  sessionType: SessionType,
  sessionId?: string,
  topic?: string
): Promise<string | null> {
  try {
    // Get API key
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
                   Constants.expoConfig?.extra?.openaiApiKey ||
                   Constants.expoConfig?.extra?.OPENAI_API_KEY ||
                   (Constants.manifest as any)?.extra?.OPENAI_API_KEY;
                     
    if (!apiKey) {
      console.error('OpenAI API key not found');
      return null;
    }

    // Format messages for the AI
    const formattedMessages = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.message
    }));

    // Use GPT-3.5-turbo for summarization (more cost-effective)
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
            content: `Create a concise summary (50-100 tokens) of this conversation about ${
              sessionType === 'workout' ? 'a specific workout' : 
              sessionType === 'topic' ? `the topic "${topic || 'unknown'}"` : 
              'general coaching advice'
            }. Focus on key points, advice given, decisions made, and any action items.`
          },
          ...formattedMessages
        ],
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices[0].message.content.trim();

    return summary;
  } catch (error) {
    console.error('Error creating session summary:', error);
    return null;
  }
}

/**
 * Saves a session summary to Supabase
 * @param summary Summary data to save
 * @returns True if successful, false otherwise
 */
export async function saveSessionSummary(summary: SessionSummary): Promise<boolean> {
  try {
    // Format time_frame as Postgres TSTZRANGE if present
    let formattedSummary: any = { ...summary };
    
    if (summary.time_frame) {
      // Format dates in ISO format for Postgres
      const startIso = summary.time_frame.start.toISOString();
      const endIso = summary.time_frame.end.toISOString();
      formattedSummary.time_frame = `[${startIso},${endIso}]`;
    }

    const { error } = await supabase
      .from('session_summaries')
      .insert(formattedSummary);

    if (error) {
      console.error('Error saving session summary:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in saveSessionSummary:', error);
    return false;
  }
}

/**
 * Creates and saves a summary for workout notes
 * @param notes The workout notes to summarize
 * @param userId User ID
 * @param sessionId The workout session ID
 * @returns True if successful, false otherwise
 */
export async function createNoteSummary(
  notes: string,
  userId: string,
  sessionId: string
): Promise<string | null> {
  try {
    // Get API key
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
                   Constants.expoConfig?.extra?.openaiApiKey ||
                   Constants.expoConfig?.extra?.OPENAI_API_KEY ||
                   (Constants.manifest as any)?.extra?.OPENAI_API_KEY;
                     
    if (!apiKey) {
      console.error('OpenAI API key not found');
      return null;
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
            content: 'Create a very concise summary (30-50 tokens) of these workout notes. Focus on key observations, feelings, and performance indicators.'
          },
          { role: 'user', content: notes }
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices[0].message.content.trim();

    return summary;
  } catch (error) {
    console.error('Error creating note summary:', error);
    return null;
  }
}

/**
 * Get relevant session summaries for context
 * @param userId User ID to get summaries for
 * @param sessionId Optional specific session ID
 * @param topic Optional topic to filter by
 * @param limit Maximum number of summaries to return
 * @returns Array of session summaries
 */
export async function getRelevantSummaries(
  userId: string,
  sessionId?: string,
  topic?: string,
  limit: number = 5
): Promise<SessionSummary[]> {
  try {
    let query = supabase
      .from('session_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    // Add filters based on parameters
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    } else if (topic) {
      query = query.eq('topic', topic).eq('session_type', 'topic');
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching session summaries:', error);
      return [];
    }
    
    return data as SessionSummary[];
  } catch (error) {
    console.error('Error in getRelevantSummaries:', error);
    return [];
  }
}

/**
 * Identifies the session type and topic from a conversation
 * @param messages Array of chat messages to analyze
 * @returns Object with session type and topic (if available)
 */
export async function identifySessionContext(
  messages: ChatMessage[],
  workoutId?: string
): Promise<{sessionType: SessionType, topic?: string}> {
  // If workout ID is provided, this is a workout-specific session
  if (workoutId) {
    return { sessionType: 'workout' };
  }
  
  try {
    // Use the last 5 messages for context (to reduce token usage)
    const recentMessages = messages.slice(-5);
    
    // Get API key
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
                   Constants.expoConfig?.extra?.openaiApiKey ||
                   Constants.expoConfig?.extra?.OPENAI_API_KEY ||
                   (Constants.manifest as any)?.extra?.OPENAI_API_KEY;
                     
    if (!apiKey) {
      console.error('OpenAI API key not found');
      return { sessionType: 'general' };
    }

    // Format messages for the AI
    const formattedMessages = recentMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.message
    }));

    // Use GPT-3.5-turbo to determine session type and topic
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
            content: `Analyze this conversation and determine if it's about a specific running topic. If so, return JSON with "sessionType": "topic" and "topic": "topic name". If it's about a specific workout, return "sessionType": "workout". Otherwise, return "sessionType": "general".`
          },
          ...formattedMessages
        ],
        temperature: 0.2,
        max_tokens: 50,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content.trim());
    
    return {
      sessionType: result.sessionType as SessionType,
      topic: result.topic
    };
  } catch (error) {
    console.error('Error identifying session context:', error);
    return { sessionType: 'general' };
  }
} 