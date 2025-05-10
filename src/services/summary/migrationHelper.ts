import { supabase } from '../../lib/api/supabase';
import { ChatType } from './chatSummaryService';

/**
 * Migrates data from the session_summaries table to the new chat_summaries and workout_note_summaries tables
 * This is a helper function that should be run once after creating the new tables
 * @returns Success status object
 */
export async function migrateSessionSummaries(): Promise<{
  success: boolean;
  chatSummariesMigrated: number;
  workoutNoteSummariesMigrated: number;
  errors: string[];
}> {
  const result = {
    success: false,
    chatSummariesMigrated: 0,
    workoutNoteSummariesMigrated: 0,
    errors: [] as string[]
  };

  try {
    // Fetch all session summaries
    const { data: sessionSummaries, error: fetchError } = await supabase
      .from('session_summaries')
      .select('*');

    if (fetchError) {
      result.errors.push(`Error fetching session summaries: ${fetchError.message}`);
      return result;
    }

    if (!sessionSummaries || sessionSummaries.length === 0) {
      result.success = true;
      return result; // No data to migrate
    }

    console.log(`Found ${sessionSummaries.length} session summaries to migrate`);

    // Process chat summaries (those without note_summary or empty note_summary)
    const chatSummaries = sessionSummaries.filter(
      s => !s.note_summary || s.note_summary.trim() === ''
    );

    // Process workout note summaries (those with note_summary)
    const workoutNoteSummaries = sessionSummaries.filter(
      s => s.note_summary && s.note_summary.trim() !== '' && s.session_id
    );

    console.log(`Found ${chatSummaries.length} chat summaries and ${workoutNoteSummaries.length} workout note summaries`);

    // Migrate chat summaries
    if (chatSummaries.length > 0) {
      const formattedChatSummaries = chatSummaries.map(s => ({
        user_id: s.user_id,
        topic: s.topic || null,
        chat_type: s.session_type as ChatType,
        related_workout_id: s.session_type === 'workout' ? s.session_id : null,
        summary: s.summary,
        time_frame: s.time_frame,
        created_at: s.created_at,
        updated_at: s.updated_at
      }));

      const { error: insertChatError } = await supabase
        .from('chat_summaries')
        .insert(formattedChatSummaries);

      if (insertChatError) {
        result.errors.push(`Error inserting chat summaries: ${insertChatError.message}`);
      } else {
        result.chatSummariesMigrated = formattedChatSummaries.length;
      }
    }

    // Migrate workout note summaries
    if (workoutNoteSummaries.length > 0) {
      const formattedWorkoutNoteSummaries = workoutNoteSummaries.map(s => ({
        user_id: s.user_id,
        workout_id: s.session_id,
        summary: s.note_summary,
        created_at: s.created_at,
        updated_at: s.updated_at
      }));

      const { error: insertNoteError } = await supabase
        .from('workout_note_summaries')
        .insert(formattedWorkoutNoteSummaries);

      if (insertNoteError) {
        result.errors.push(`Error inserting workout note summaries: ${insertNoteError.message}`);
      } else {
        result.workoutNoteSummariesMigrated = formattedWorkoutNoteSummaries.length;
      }
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Unexpected error during migration: ${errorMessage}`);
    return result;
  }
}

/**
 * Verifies that all data was successfully migrated from session_summaries to the new tables
 * @returns Verification results
 */
export async function verifyMigration(): Promise<{
  success: boolean;
  oldRecordCount: number;
  newChatSummaryCount: number;
  newWorkoutNoteCount: number;
  missingRecords: number;
}> {
  try {
    // Count old records
    const { count: oldCount, error: oldCountError } = await supabase
      .from('session_summaries')
      .select('*', { count: 'exact', head: true });

    if (oldCountError) {
      throw new Error(`Error counting session summaries: ${oldCountError.message}`);
    }

    // Count new chat summaries
    const { count: chatCount, error: chatCountError } = await supabase
      .from('chat_summaries')
      .select('*', { count: 'exact', head: true });

    if (chatCountError) {
      throw new Error(`Error counting chat summaries: ${chatCountError.message}`);
    }

    // Count new workout note summaries
    const { count: noteCount, error: noteCountError } = await supabase
      .from('workout_note_summaries')
      .select('*', { count: 'exact', head: true });

    if (noteCountError) {
      throw new Error(`Error counting workout note summaries: ${noteCountError.message}`);
    }

    // Some records in session_summaries might have both summary and note_summary,
    // which would be migrated to both tables, so we need to count unique records
    const { data: dualRecords, error: dualError } = await supabase
      .from('session_summaries')
      .select('id')
      .not('note_summary', 'is', null)
      .not('summary', 'is', null);

    const dualCount = dualError ? 0 : (dualRecords?.length || 0);

    // Calculate expected total
    const expectedTotal = oldCount || 0;
    const actualTotal = (chatCount || 0) + (noteCount || 0) - dualCount;
    const missingRecords = expectedTotal - actualTotal;

    return {
      success: missingRecords <= 0,
      oldRecordCount: expectedTotal,
      newChatSummaryCount: chatCount || 0,
      newWorkoutNoteCount: noteCount || 0,
      missingRecords: Math.max(0, missingRecords)
    };
  } catch (error) {
    console.error('Error verifying migration:', error);
    return {
      success: false,
      oldRecordCount: 0,
      newChatSummaryCount: 0,
      newWorkoutNoteCount: 0,
      missingRecords: 0
    };
  }
} 