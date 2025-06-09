import * as Notifications from 'expo-notifications';
import { getNotificationStatus, scheduleDynamicNotifications, NotificationData } from './notificationService';

/**
 * Debug function to check all notification status and schedule immediate test
 */
export const debugNotifications = async (userId: string, coachId: string) => {
  console.log('\n=== NOTIFICATION DEBUG ===');
  
  // 1. Check permissions
  const permissions = await Notifications.getPermissionsAsync();
  console.log('Permissions:', permissions);
  
  // 2. Check all scheduled notifications
  const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
  console.log('All scheduled notifications:', allScheduled.length);
  allScheduled.forEach((notif, index) => {
    console.log(`${index + 1}. ID: ${notif.identifier}`);
    console.log(`   Title: ${notif.content.title}`);
    console.log(`   Body: ${notif.content.body}`);
    console.log(`   Data:`, notif.content.data);
    console.log(`   Trigger:`, notif.trigger);
    console.log('---');
  });
  
  // 3. Check our notification status
  const status = await getNotificationStatus();
  console.log('Our notification status:', status);
  
  // 4. Current time
  const now = new Date();
  console.log('Current time:', now.toLocaleTimeString());
  
  console.log('=== END DEBUG ===\n');
  
  return { permissions, allScheduled, status, currentTime: now };
};

/**
 * NEW: Clear all notifications and reschedule fresh ones
 */
export const clearAndRescheduleNotifications = async (userId: string, coachId: string) => {
  console.log('Clearing all notifications and rescheduling...');
  
  // Cancel all notifications
  await Notifications.cancelAllScheduledNotificationsAsync();
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Schedule fresh dynamic notifications
  const notificationData: NotificationData = {
    userId,
    coachId,
    // No location for now to keep it simple
  };
  
  const result = await scheduleDynamicNotifications(notificationData);
  
  console.log('Fresh notifications scheduled:', result);
  
  // Check what was actually scheduled
  const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
  console.log('Notifications after rescheduling:', allScheduled.length);
  allScheduled.forEach((notif, index) => {
    console.log(`${index + 1}. Type: ${notif.content.data?.type}, Time: ${JSON.stringify(notif.trigger)}`);
  });
  
  return { result, totalScheduled: allScheduled.length };
};

/**
 * Schedule immediate test notifications (1 minute from now)
 */
export const scheduleTestNotifications = async (userId: string, coachId: string) => {
  console.log('Scheduling test notifications...');
  
  const now = new Date();
  const testTime1 = new Date(now.getTime() + 60 * 1000); // 1 minute from now
  const testTime2 = new Date(now.getTime() + 120 * 1000); // 2 minutes from now
  
  console.log('Test notification 1 scheduled for:', testTime1.toLocaleTimeString());
  console.log('Test notification 2 scheduled for:', testTime2.toLocaleTimeString());
  
  // Cancel existing notifications first
  await Notifications.cancelAllScheduledNotificationsAsync();
  
  // Schedule test notifications with SIMPLER content (no dynamic flag for testing)
  const morningId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test Morning Notification',
      body: 'This is a simple morning test - no dynamic content',
      data: {
        userId,
        coachId,
        type: 'morning_motivation',
        dynamic: false, // Turn off dynamic for testing
        test: true,
      },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: testTime1,
    },
  });
  
  const eveningId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test Evening Notification',
      body: 'This is a simple evening test - no dynamic content',
      data: {
        userId,
        coachId,
        type: 'evening_checkin',
        dynamic: false, // Turn off dynamic for testing
        test: true,
      },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: testTime2,
    },
  });
  
  console.log('Test notifications scheduled:', { morningId, eveningId });
  
  return { morningId, eveningId, testTime1, testTime2 };
};

/**
 * Schedule immediate notification (10 seconds from now)
 */
export const scheduleImmediateTest = async (userId: string, coachId: string) => {
  const now = new Date();
  const testTime = new Date(now.getTime() + 10 * 1000); // 10 seconds from now
  
  console.log('Immediate test notification scheduled for:', testTime.toLocaleTimeString());
  
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Immediate Test Notification',
      body: 'If you see this, basic notifications are working!',
      data: {
        userId,
        coachId,
        type: 'morning_motivation',
        dynamic: false, // Turn off dynamic for testing
        test: true,
      },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: testTime,
    },
  });
  
  console.log('Immediate test notification scheduled with ID:', id);
  return { id, testTime };
}; 