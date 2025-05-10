import { extractTrainingFeedback } from './feedbackAnalysis';
import { 
  getWeekChatMessages, 
  getWeekWorkoutNotes, 
  getWeekSkippedWorkouts, 
  storeTrainingFeedback,
  getAllUsers
} from './feedbackStorage';

/**
 * Extract and store training feedback for a specific user and week
 * @returns True if successful, false otherwise
 */
export async function processWeeklyTrainingFeedback(
  userId: string,
  weekStartDate?: string // YYYY-MM-DD format, defaults to previous Sunday
): Promise<boolean> {
  try {
    // Calculate week start (Sunday) and end dates if not provided
    let startDate: Date;
    if (weekStartDate) {
      startDate = new Date(weekStartDate);
    } else {
      // Default to previous Sunday
      const today = new Date();
      const day = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      startDate = new Date(today);
      startDate.setDate(today.getDate() - day - 7); // Go back to previous Sunday
    }
    startDate.setHours(0, 0, 0, 0);
    
    // End date is 6 days after start (Saturday)
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
    
    // Format dates as YYYY-MM-DD
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`Processing training feedback for user ${userId} for week ${startDateStr} to ${endDateStr}`);
    
    // Get data
    const chatMessages = await getWeekChatMessages(userId, startDateStr, endDateStr);
    const workoutsWithNotes = await getWeekWorkoutNotes(userId, startDateStr, endDateStr);
    const skippedWorkouts = await getWeekSkippedWorkouts(userId, startDateStr, endDateStr);
    
    // Extract the feedback
    const feedback = await extractTrainingFeedback(
      userId, 
      startDateStr, 
      endDateStr, 
      chatMessages, 
      workoutsWithNotes, 
      skippedWorkouts
    );
    
    if (!feedback) {
      console.log(`No feedback could be generated for user ${userId}`);
      return false;
    }
    
    // Store the feedback
    const stored = await storeTrainingFeedback(feedback);
    
    if (!stored) {
      console.error(`Failed to store feedback for user ${userId}`);
      return false;
    }
    
    console.log(`Successfully processed and stored training feedback for user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error in processWeeklyTrainingFeedback:', error);
    return false;
  }
}

/**
 * Process training feedback for all users for the past week
 * @returns Results of the processing
 */
export async function processAllUsersFeedback(): Promise<{
  success: boolean;
  processed: number;
  failed: number;
}> {
  const result = {
    success: false,
    processed: 0,
    failed: 0
  };
  
  try {
    // Get all active users
    const users = await getAllUsers();
    
    if (users.length === 0) {
      console.log('No users found for feedback processing');
      result.success = true;
      return result;
    }
    
    console.log(`Processing training feedback for ${users.length} users`);
    
    // Calculate the previous week's Sunday (start date)
    const today = new Date();
    const day = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const prevSunday = new Date(today);
    prevSunday.setDate(today.getDate() - day - 7); // Go back to previous Sunday
    prevSunday.setHours(0, 0, 0, 0);
    
    const weekStartDate = prevSunday.toISOString().split('T')[0];
    
    // Process each user
    for (const user of users) {
      try {
        const processed = await processWeeklyTrainingFeedback(user.id, weekStartDate);
        
        if (processed) {
          result.processed++;
        } else {
          result.failed++;
        }
      } catch (error) {
        console.error(`Error processing feedback for user ${user.id}:`, error);
        result.failed++;
      }
    }
    
    result.success = result.failed === 0;
    console.log(`Training feedback processing complete. Processed: ${result.processed}, Failed: ${result.failed}`);
    return result;
  } catch (error) {
    console.error('Error in processAllUsersFeedback:', error);
    return result;
  }
} 