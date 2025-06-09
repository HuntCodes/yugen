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
  console.log('📝 [addOrUpdateUserTrainingFeedback] FUNCTION CALLED');
  console.log('📝 [addOrUpdateUserTrainingFeedback] INPUT:', {
    userId,
    inputData: {
      week_start_date: data.week_start_date,
      prefers: data.prefers,
      struggling_with: data.struggling_with,
      feedback_summary: data.feedback_summary,
      raw_data: data.raw_data,
      hasPrefers: !!data.prefers,
      hasStrugglingWith: !!data.struggling_with,
      hasFeedbackSummary: !!data.feedback_summary,
      hasRawData: !!data.raw_data
    }
  });

  const weekStartDate = data.week_start_date || getMostRecentMonday();
  console.log('📝 [addOrUpdateUserTrainingFeedback] WEEK CALCULATION:', {
    providedWeekStart: data.week_start_date,
    calculatedWeekStart: weekStartDate,
    wasCalculated: !data.week_start_date
  });

  // Ensure data object doesn't have week_start_date if we defaulted it, to avoid conflict in .match()
  const { week_start_date, ...updateData } = data;

  const feedbackToUpsert: UserTrainingFeedbackData = {
    ...updateData,
    user_id: userId,
    week_start_date: weekStartDate,
  };
  
  console.log('📝 [addOrUpdateUserTrainingFeedback] OBJECT TO UPSERT:');
  console.log('=====================================');
  console.log(JSON.stringify(feedbackToUpsert, null, 2));
  console.log('=====================================');

  console.log('📝 [addOrUpdateUserTrainingFeedback] FETCHING EXISTING RECORD...');
  // Fetch existing record to manually merge JSONB fields if necessary,
  // as Supabase upsert with default strategy might overwrite JSONB.
  const { data: existing, error: fetchError } = await supabase
    .from('user_training_feedback')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();

  console.log('📝 [addOrUpdateUserTrainingFeedback] EXISTING RECORD FETCH RESULT:', {
    hasExisting: !!existing,
    fetchError: fetchError?.code || null,
    existingRecord: existing ? {
      id: existing.id,
      week_start_date: existing.week_start_date,
      hasPrefers: !!existing.prefers,
      hasStrugglingWith: !!existing.struggling_with,
      hasFeedbackSummary: !!existing.feedback_summary,
      hasRawData: !!existing.raw_data,
      prefers: existing.prefers,
      struggling_with: existing.struggling_with,
      feedback_summary: existing.feedback_summary
    } : null
  });

  if (fetchError) {
    // If PGRST116, it means no record was found, which is fine for an upsert, treat existing as null.
    if (fetchError.code === 'PGRST116') {
      console.log('📝 [addOrUpdateUserTrainingFeedback] No existing record found (PGRST116) - will insert new record');
      // existing remains null, which is the correct state for a new insert.
    } else {
      console.error('📝 [addOrUpdateUserTrainingFeedback] ERROR fetching existing feedback:', fetchError);
      // Depending on policy, you might still attempt upsert or return error. For now, proceed to upsert.
    }
  }

  if (existing) {
    console.log('📝 [addOrUpdateUserTrainingFeedback] MERGING WITH EXISTING RECORD...');
    
    // Merge JSONB fields: prefers, struggling_with, raw_data
    const originalPrefers = feedbackToUpsert.prefers;
    const originalStrugglingWith = feedbackToUpsert.struggling_with;
    const originalRawData = feedbackToUpsert.raw_data;

    if (updateData.prefers) {
      feedbackToUpsert.prefers = { ...(existing.prefers || {}), ...updateData.prefers };
    } else {
      feedbackToUpsert.prefers = existing.prefers;
    }
    if (updateData.struggling_with) {
      feedbackToUpsert.struggling_with = {
        ...(existing.struggling_with || {}),
        ...updateData.struggling_with,
      };
    } else {
      feedbackToUpsert.struggling_with = existing.struggling_with;
    }
    if (updateData.raw_data) {
      feedbackToUpsert.raw_data = { ...(existing.raw_data || {}), ...updateData.raw_data };
    } else {
      feedbackToUpsert.raw_data = existing.raw_data;
    }
    // For text fields like feedback_summary, append new content instead of overwriting
    if (updateData.feedback_summary) {
      if (existing.feedback_summary) {
        // Append new feedback to existing feedback with a separator
        feedbackToUpsert.feedback_summary = `${existing.feedback_summary}; ${updateData.feedback_summary}`;
      } else {
        // No existing feedback, just use the new feedback
        feedbackToUpsert.feedback_summary = updateData.feedback_summary;
      }
    } else {
      // No new feedback provided, keep existing
      feedbackToUpsert.feedback_summary = existing.feedback_summary;
    }

    console.log('📝 [addOrUpdateUserTrainingFeedback] MERGE DETAILS:', {
      prefers: {
        original: originalPrefers,
        existing: existing.prefers,
        merged: feedbackToUpsert.prefers
      },
      struggling_with: {
        original: originalStrugglingWith,
        existing: existing.struggling_with,
        merged: feedbackToUpsert.struggling_with
      },
      raw_data: {
        original: originalRawData,
        existing: existing.raw_data,
        merged: feedbackToUpsert.raw_data
      },
      feedback_summary: {
        original: updateData.feedback_summary,
        existing: existing.feedback_summary,
        final: feedbackToUpsert.feedback_summary
      }
    });
  }

  console.log('📝 [addOrUpdateUserTrainingFeedback] FINAL OBJECT FOR DATABASE:');
  console.log('=====================================');
  console.log(JSON.stringify(feedbackToUpsert, null, 2));
  console.log('=====================================');

  console.log('📝 [addOrUpdateUserTrainingFeedback] EXECUTING UPSERT...');
  const { data: upsertedData, error } = await supabase
    .from('user_training_feedback')
    .upsert(feedbackToUpsert, {
      onConflict: 'user_id,week_start_date',
      // defaultToNull: false, // Keep existing values for unspecified fields if supported by your client version
    })
    .select()
    .single(); // Expect a single record back

  if (error) {
    console.error('📝 [addOrUpdateUserTrainingFeedback] ERROR during upsert:', error);
    console.log('📝 [addOrUpdateUserTrainingFeedback] FINAL RESULT: ERROR');
    console.log('=====================================');
    console.log('Error:', error);
    console.log('=====================================');
  } else {
    console.log('📝 [addOrUpdateUserTrainingFeedback] UPSERT SUCCESS:', {
      upsertedId: upsertedData?.id,
      week_start_date: upsertedData?.week_start_date,
      hasPrefers: !!upsertedData?.prefers,
      hasStrugglingWith: !!upsertedData?.struggling_with,
      hasFeedbackSummary: !!upsertedData?.feedback_summary,
      hasRawData: !!upsertedData?.raw_data
    });
    console.log('📝 [addOrUpdateUserTrainingFeedback] FINAL RESULT: SUCCESS');
    console.log('=====================================');
    console.log(JSON.stringify(upsertedData, null, 2));
    console.log('=====================================');
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
  console.log('🔍 [fetchUserTrainingFeedback] FUNCTION CALLED');
  console.log('🔍 [fetchUserTrainingFeedback] INPUT:', {
    userId,
    weekStartDate,
    isSpecificWeek: !!weekStartDate
  });

  let query = supabase.from('user_training_feedback').select('*').eq('user_id', userId);

  if (weekStartDate) {
    query = query.eq('week_start_date', weekStartDate);
    console.log('🔍 [fetchUserTrainingFeedback] QUERY TYPE: Specific week -', weekStartDate);
  } else {
    // If no specific week, get the most recent one
    query = query.order('week_start_date', { ascending: false });
    console.log('🔍 [fetchUserTrainingFeedback] QUERY TYPE: Most recent feedback');
  }

  console.log('🔍 [fetchUserTrainingFeedback] EXECUTING QUERY...');
  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    // Specifically check for PGRST116 which might indicate no rows with maybeSingle in some contexts, treat as no data.
    if (error.code === 'PGRST116') {
      console.log('🔍 [fetchUserTrainingFeedback] No feedback record found (PGRST116) - returning null');
      console.log('🔍 [fetchUserTrainingFeedback] RESULT: No data found');
      return { data: null, error: null }; // Return null data, null error as if no record was found
    }
    console.error('🔍 [fetchUserTrainingFeedback] ERROR during fetch:', error);
    console.log('🔍 [fetchUserTrainingFeedback] RESULT: ERROR');
    console.log('=====================================');
    console.log('Error:', error);
    console.log('=====================================');
  } else {
    console.log('🔍 [fetchUserTrainingFeedback] FETCH SUCCESS:', {
      hasData: !!data,
      recordId: data?.id,
      week_start_date: data?.week_start_date,
      hasPrefers: !!data?.prefers,
      hasStrugglingWith: !!data?.struggling_with,
      hasFeedbackSummary: !!data?.feedback_summary,
      hasRawData: !!data?.raw_data
    });
    console.log('🔍 [fetchUserTrainingFeedback] RESULT: SUCCESS');
    console.log('=====================================');
    console.log(data ? JSON.stringify(data, null, 2) : 'No data found');
    console.log('=====================================');
  }
  
  return { data, error };
};
