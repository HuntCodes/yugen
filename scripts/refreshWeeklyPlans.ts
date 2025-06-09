// import { supabaseAdmin } from '../supabase/functions/_shared/supabaseAdmin';
// import { processAllUsersFeedback } from '../src/services/feedback/feedbackProcessing'; // Original feedback processing
// import { refreshAllUserPlans } from '../src/services/plan/weeklyPlanService'; // Original plan refresh service

/**
 * @deprecated This script is superseded by client-initiated weekly plan updates.
 * The logic for global refresh is no longer the primary mechanism.
 * It's kept here for reference or potential future admin tasks if adapted.
 */
async function main() {
  console.warn(
    'DEPRECATED SCRIPT: scripts/refreshWeeklyPlans.ts is running. \n' +
      'This global plan refresh mechanism is being replaced by client-initiated updates. \n' +
      'The main operational logic of this script has been commented out to prevent conflicts.'
  );

  // try {
  //   console.log('[refreshWeeklyPlans Script] Starting weekly plan refresh process...');

  //   // 1. Process feedback for all users first (e.g., summarize last week's chats and notes)
  //   // This step should ideally complete and store structured feedback before plan generation.
  //   console.log('[refreshWeeklyPlans Script] Step 1: Processing feedback for all users...');
  //   const feedbackResult = await processAllUsersFeedback();
  //   if (feedbackResult.success) {
  //     console.log(`[refreshWeeklyPlans Script] Feedback processing completed. Processed: ${feedbackResult.processed}, Errors: ${feedbackResult.errors}`);
  //   } else {
  //     console.error('[refreshWeeklyPlans Script] Feedback processing failed for some users or entirely. Check logs.');
  // Decide if to continue to plan generation or halt. For now, we'll log and continue.
  //   }

  //   // 2. Refresh training plans for all users
  //   // This will use the feedback processed in step 1.
  //   // The `refreshAllUserPlans` in weeklyPlanService has also been deprecated and its internal
  //   // feedback call removed to avoid redundancy with the step above if this script were active.
  //   console.log('[refreshWeeklyPlans Script] Step 2: Refreshing training plans for all users...');
  //   const planResult = await refreshAllUserPlans();

  //   if (planResult.success) {
  //     console.log(
  //       `[refreshWeeklyPlans Script] Plan refresh completed. Refreshed: ${planResult.refreshed}, Skipped: ${planResult.skipped}, Failed: ${planResult.failed}`
  //     );
  //   } else {
  //     console.error(
  //       `[refreshWeeklyPlans Script] Plan refresh process encountered errors. Refreshed: ${planResult.refreshed}, Skipped: ${planResult.skipped}, Failed: ${planResult.failed}`
  //     );
  //   }

  //   console.log('[refreshWeeklyPlans Script] Weekly plan refresh process finished.');
  // } catch (error) {
  //   console.error('[refreshWeeklyPlans Script] CRITICAL ERROR in main execution:', error);
  //   process.exit(1); // Exit with error code if the main try-catch fails
  // }
}

// Only run main if this script is executed directly
if (require.main === module) {
  main().catch((e) => {
    console.error('Unhandled error in refreshWeeklyPlans script:', e);
    process.exit(1);
  });
}
