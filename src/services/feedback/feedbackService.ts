import { supabase } from '../../lib/supabase';

export interface UserTrainingFeedbackData {
  id?: string; // UUID
  user_id?: string; // UUID, should be set by the service
  created_at?: string; // timestamptz
  week_start_date?: string; // date (YYYY-MM-DD)
  prefers?: Record<string, any>; // jsonb
  struggling_with?: Record<string, any>; // jsonb
  feedback_summary?: string; // text
  raw_data?: Record<string, any>; // jsonb
}

// Helper to get the start of the current week (Monday) in YYYY-MM-DD format
const getMostRecentMonday = (date = new Date()): string => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
};

/**
 * Adds or updates user training feedback for a given week.
 * If a record for the user and week_start_date exists, it merges the new data.
 * Otherwise, it inserts a new record.
 * @param userId The user's ID.
 * @param data The feedback data to add or update. week_start_date can be provided, otherwise defaults to current week's Monday.
 */
export const addOrUpdateUserTrainingFeedback = async (
  userId: string,
  data: Partial<UserTrainingFeedbackData>
): Promise<{ data: UserTrainingFeedbackData | null; error: any }> => {
  console.log('[feedbackService] addOrUpdateUserTrainingFeedback called with userId:', userId, 'and data:', JSON.stringify(data, null, 2)); // LOG INPUT
  const weekStartDate = data.week_start_date || getMostRecentMonday();

  // Ensure data object doesn't have week_start_date if we defaulted it, to avoid conflict in .match()
  const { week_start_date, ...updateData } = data;

  const feedbackToUpsert: UserTrainingFeedbackData = {
    ...updateData,
    user_id: userId,
    week_start_date: weekStartDate,
  };
  console.log('[feedbackService] Object to be upserted:', JSON.stringify(feedbackToUpsert, null, 2)); // LOG UPSERT OBJECT

  // Fetch existing record to manually merge JSONB fields if necessary,
  // as Supabase upsert with default strategy might overwrite JSONB.
  const { data: existing, error: fetchError } = await supabase
    .from('user_training_feedback')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();

  if (fetchError) {
    // If PGRST116, it means no record was found, which is fine for an upsert, treat existing as null.
    if (fetchError.code === 'PGRST116') {
      console.log('[feedbackService] addOrUpdateUserTrainingFeedback: No existing feedback record found to merge (PGRST116), will insert new.');
      // existing remains null, which is the correct state for a new insert.
    } else {
      console.error('[feedbackService] Error fetching existing feedback for merge:', fetchError);
      // Depending on policy, you might still attempt upsert or return error. For now, proceed to upsert.
    }
  }

  if (existing) {
    // Merge JSONB fields: prefers, struggling_with, raw_data
    if (updateData.prefers) {
      feedbackToUpsert.prefers = { ...(existing.prefers || {}), ...updateData.prefers };
    } else {
      feedbackToUpsert.prefers = existing.prefers;
    }
    if (updateData.struggling_with) {
      feedbackToUpsert.struggling_with = { ...(existing.struggling_with || {}), ...updateData.struggling_with };
    } else {
      feedbackToUpsert.struggling_with = existing.struggling_with;
    }
    if (updateData.raw_data) {
      feedbackToUpsert.raw_data = { ...(existing.raw_data || {}), ...updateData.raw_data };
    } else {
      feedbackToUpsert.raw_data = existing.raw_data;
    }
    // For text fields like feedback_summary, the new value overwrites if provided.
    if (updateData.feedback_summary === undefined) {
        feedbackToUpsert.feedback_summary = existing.feedback_summary;
    }
  }
  
  const { data: upsertedData, error } = await supabase
    .from('user_training_feedback')
    .upsert(feedbackToUpsert, { 
        onConflict: 'user_id,week_start_date',
        // defaultToNull: false, // Keep existing values for unspecified fields if supported by your client version
     })
    .select()
    .single(); // Expect a single record back

  if (error) {
    console.error('[feedbackService] Error upserting user training feedback:', error);
  }
  return { data: upsertedData, error };
};

/**
 * Fetches the most recent user training feedback for a user.
 * Can optionally filter by a specific week_start_date.
 * @param userId The user's ID.
 * @param weekStartDate Optional specific week start date to fetch.
 */
export const fetchUserTrainingFeedback = async (
  userId: string,
  weekStartDate?: string
): Promise<{ data: UserTrainingFeedbackData | null; error: any }> => {
  let query = supabase
    .from('user_training_feedback')
    .select('*')
    .eq('user_id', userId);

  if (weekStartDate) {
    query = query.eq('week_start_date', weekStartDate);
  } else {
    // If no specific week, get the most recent one
    query = query.order('week_start_date', { ascending: false });
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    // Specifically check for PGRST116 which might indicate no rows with maybeSingle in some contexts, treat as no data.
    if (error.code === 'PGRST116') {
      console.log('[feedbackService] fetchUserTrainingFeedback: No feedback record found (PGRST116 treated as no data).');
      return { data: null, error: null }; // Return null data, null error as if no record was found
    }
    console.error('[feedbackService] Error fetching user training feedback:', error);
  }
  return { data, error };
}; 