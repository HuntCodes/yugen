import { refreshAllUserPlans } from '../src/services/plan';
import { processAllUsersFeedback } from '../src/services/feedback/trainingFeedbackService';

/**
 * This script refreshes weekly training plans for all users who need it.
 * It's designed to be run by a cron job on a scheduled basis (e.g., every Sunday).
 * 
 * To run manually:
 * npx ts-node scripts/refreshWeeklyPlans.ts
 */
async function main() {
  console.log('Starting weekly training plan refresh process...');
  
  try {
    // First, process training feedback for all users
    console.log('Processing training feedback for all users...');
    const feedbackResult = await processAllUsersFeedback();
    
    console.log('\nFeedback Processing Results:');
    console.log('---------------------------');
    console.log(`Status: ${feedbackResult.success ? 'SUCCESS' : 'PARTIAL FAILURE'}`);
    console.log(`Users with processed feedback: ${feedbackResult.processed}`);
    console.log(`Failed feedback processing: ${feedbackResult.failed}`);
    
    // Then refresh plans for all users
    console.log('\nStarting weekly plan refresh...');
    const result = await refreshAllUserPlans();
    
    console.log('\nPlan Refresh Results:');
    console.log('-------------------');
    console.log(`Status: ${result.success ? 'SUCCESS' : 'PARTIAL FAILURE'}`);
    console.log(`Users with refreshed plans: ${result.refreshed}`);
    console.log(`Users with no need for refresh: ${result.skipped}`);
    console.log(`Failed refreshes: ${result.failed}`);
    
    // Exit with appropriate code
    if (result.success && feedbackResult.success) {
      console.log('\n✅ Complete process completed successfully!');
      process.exit(0);
    } else {
      console.error('\n⚠️ Process completed with some failures.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Unhandled error during process:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 