import { supabase } from '../../lib/api/supabase';
import { ChatMessage } from '../../types/chat';
import Constants from 'expo-constants';

// Define the chat summary types
export type ChatType = 'topic' | 'general' | 'workout';

// Interface for chat summaries
export interface ChatSummary {
  id?: string;
  user_id: string;
  topic?: string;
  chat_type: ChatType;
  related_workout_id?: string;
  summary: string;
  time_frame?: {
    start: Date;
    end: Date;
  };
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Creates a summary for chat conversations using AI
 * @param messages The chat messages to summarize
 * @param userId User ID
 * @param topic Optional topic of the conversation
 * @param relatedWorkoutId Optional related workout ID
 * @returns The generated summary
 */
export async function createChatSummary(
  messages: ChatMessage[],
  userId: string,
  topic?: string,
  relatedWorkoutId?: string
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

    // Format the conversation for summarization
    const conversation = messages.map(msg => 
      `${msg.sender === 'user' ? 'User' : 'Coach'}: ${msg.message}`
    ).join('\n\n');

    // Build context-aware system prompt
    let systemPrompt = 'Create a concise summary (50-70 tokens) of this coaching conversation. Focus on key points, advice given, and decisions made.';
    
    if (topic) {
      systemPrompt = `Create a concise summary (50-70 tokens) of this coaching conversation about ${topic}. Focus on key points, advice given, and decisions made.`;
    }

    if (relatedWorkoutId) {
      // Get workout info if available
      const { data: workoutData } = await supabase
        .from('training_plans')
        .select('session_type, date')
        .eq('id', relatedWorkoutId)
        .single();

      if (workoutData) {
        systemPrompt = `Create a concise summary (50-70 tokens) of this coaching conversation about a ${workoutData.session_type} workout on ${new Date(workoutData.date).toLocaleDateString()}. Focus on key points, advice given, and decisions made.`;
      }
    }

    // Use GPT-3.5-turbo for conversation summarization
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
          { role: 'user', content: conversation }
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
    console.error('Error creating chat summary:', error);
    return null;
  }
}

/**
 * Stores a chat summary in the chat_summaries table
 * @param userId User ID
 * @param summary The generated summary
 * @param chatType Type of chat ('topic', 'general', or 'workout')
 * @param topic Optional topic of the conversation
 * @param relatedWorkoutId Optional related workout ID
 * @returns True if successful, false otherwise
 */
export async function storeChatSummary(
  userId: string,
  summary: string,
  chatType: 'topic' | 'general' | 'workout',
  topic?: string,
  relatedWorkoutId?: string
): Promise<boolean> {
  try {
    // Create time frame for the summary (last 24 hours)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const timeFrame = {
      lower: yesterday.toISOString(),
      upper: now.toISOString(),
      bounds: '[)'
    };

    // Insert chat summary
    const { error } = await supabase
      .from('chat_summaries')
      .insert({
        user_id: userId,
        topic,
        chat_type: chatType,
        related_workout_id: relatedWorkoutId,
        summary,
        time_frame: timeFrame
      });
      
    if (error) {
      console.error('Error storing chat summary:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in storeChatSummary:', error);
    return false;
  }
}

/**
 * Processes and summarizes a chat conversation
 * @param messages Chat messages to summarize
 * @param userId User ID
 * @param topic Optional topic of the conversation
 * @param relatedWorkoutId Optional related workout ID
 * @returns True if successful, false otherwise
 */
export async function processChat(
  messages: ChatMessage[],
  userId: string,
  chatType: 'topic' | 'general' | 'workout' = 'general',
  topic?: string,
  relatedWorkoutId?: string
): Promise<boolean> {
  try {
    // If there are no messages, no need to summarize
    if (!messages || messages.length < 3) {
      return true;
    }
    
    // Create a summary of the conversation
    const summary = await createChatSummary(messages, userId, topic, relatedWorkoutId);
    
    if (!summary) {
      console.error('Failed to create chat summary');
      return false;
    }
    
    // Store the summary
    return await storeChatSummary(userId, summary, chatType, topic, relatedWorkoutId);
  } catch (error) {
    console.error('Error processing chat:', error);
    return false;
  }
}

/**
 * Get recent chat summaries for a user
 * @param userId User ID
 * @param limit Number of summaries to retrieve (default: 5)
 * @returns Array of chat summaries
 */
export async function getRecentChatSummaries(
  userId: string,
  limit: number = 5
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('chat_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.error('Error fetching chat summaries:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getRecentChatSummaries:', error);
    return [];
  }
}

/**
 * Saves a chat summary to Supabase
 * @param summary Chat summary data to save
 * @returns True if successful, false otherwise
 */
export async function saveChatSummary(summary: ChatSummary): Promise<boolean> {
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
      .from('chat_summaries')
      .insert(formattedSummary);

    if (error) {
      console.error('Error saving chat summary:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in saveChatSummary:', error);
    return false;
  }
}

/**
 * Get relevant chat summaries for context
 * @param userId User ID to get summaries for
 * @param workoutId Optional specific workout ID
 * @param topic Optional topic to filter by
 * @param limit Maximum number of summaries to return
 * @returns Array of chat summaries
 */
export async function getRelevantChatSummaries(
  userId: string,
  workoutId?: string,
  topic?: string,
  limit: number = 5
): Promise<ChatSummary[]> {
  try {
    let query = supabase
      .from('chat_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    // Add filters based on parameters
    if (workoutId) {
      query = query.eq('related_workout_id', workoutId);
    } else if (topic) {
      query = query.eq('topic', topic).eq('chat_type', 'topic');
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching chat summaries:', error);
      return [];
    }
    
    return data as ChatSummary[];
  } catch (error) {
    console.error('Error in getRelevantChatSummaries:', error);
    return [];
  }
}

/**
 * Identifies the chat type and topic from a conversation
 * @param messages Array of chat messages to analyze
 * @param workoutId Optional workout ID if already known
 * @returns Object with chat type and topic (if available)
 */
export async function identifyChatContext(
  messages: ChatMessage[],
  workoutId?: string
): Promise<{chatType: ChatType, topic?: string}> {
  // If workout ID is provided, this is a workout-specific chat
  if (workoutId) {
    return { chatType: 'workout' };
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
      return { chatType: 'general' };
    }

    // Format messages for the AI
    const formattedMessages = recentMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.message
    }));

    // Use GPT-3.5-turbo to determine chat type and topic
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
            content: `Analyze this conversation and determine if it's about a specific running topic. If so, return JSON with "chatType": "topic" and "topic": "topic name". If it's about a specific workout, return "chatType": "workout". Otherwise, return "chatType": "general".`
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
      chatType: result.chatType as ChatType,
      topic: result.topic
    };
  } catch (error) {
    console.error('Error identifying chat context:', error);
    return { chatType: 'general' };
  }
} 