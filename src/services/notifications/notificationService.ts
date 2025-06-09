import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Import existing services
import { coachStyles } from '../../config/coachingGuidelines';
import { COACHES } from '../../lib/constants/coaches';
import { fetchTrainingPlan } from '../plan/planService';
import { fetchProfile } from '../profile/profileService';
import { getWeatherData, getWeatherDescription } from '../weather/weatherService';

export interface NotificationData {
  userId: string;
  coachId: string;
  latitude?: number;
  longitude?: number;
}

export interface TodaysWorkout {
  sessionType?: string;
  session_type?: string;
  distance: number;
  time: number;
  notes: string;
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions from the user
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    if (!Device.isDevice) {
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    // Additional Android-specific configuration
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('morning-motivation', {
        name: 'Morning Motivation',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        description: 'Daily motivational messages from your coach',
      });

      await Notifications.setNotificationChannelAsync('evening-checkin', {
        name: 'Evening Check-in',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        description: 'Evening recovery and training check-ins',
      });
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

/**
 * Get today's workout for the user
 */
export const getTodaysWorkout = async (userId: string): Promise<TodaysWorkout | null> => {
  try {
    const trainingPlan = await fetchTrainingPlan(userId);
    
    // Use local date instead of UTC date
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    
    // Get all sessions for today
    const todaysSessions = trainingPlan.filter(session => {
      // Extract just the date part from session.date (handles both "2025-06-04" and "2025-06-04T00:00:00+00:00")
      const sessionDate = session.date.split('T')[0];
      return sessionDate === today;
    });
    
    if (todaysSessions.length === 0) {
      return null;
    }
    
    // Prioritize uncompleted sessions
    const uncompletedSessions = todaysSessions.filter(session => session.status !== 'completed');
    
    if (uncompletedSessions.length === 0) {
      // If all are completed, return the first one anyway for a "well done" message
      const completedSession = todaysSessions[0];
      return {
        sessionType: completedSession.session_type,
        distance: completedSession.distance,
        time: completedSession.time,
        notes: completedSession.notes,
      };
    }
    
    // If multiple uncompleted sessions, prioritize by importance or take the first
    const primarySession = uncompletedSessions[0];
    
    // If there are multiple sessions today, mention it in the notes
    let sessionNotes = primarySession.notes || '';
    if (todaysSessions.length > 1) {
      const sessionTypes = todaysSessions.map(s => s.session_type).join(' and ');
      sessionNotes = `${sessionTypes} planned today. ${sessionNotes}`.trim();
    }
    
    return {
      sessionType: primarySession.session_type,
      distance: primarySession.distance,
      time: primarySession.time,
      notes: sessionNotes,
    };
  } catch (error) {
    console.error('Error fetching today\'s workout:', error);
    return null;
  }
};

/**
 * Get weather-based motivation message
 */
export const getWeatherMessage = async (latitude?: number, longitude?: number): Promise<string> => {
  if (!latitude || !longitude) {
    return "It's a perfect day for a run";
  }
  
  try {
    const weather = await getWeatherData(latitude, longitude);
    if (!weather) {
      return "It's a perfect day for a run";
    }
    
    const description = getWeatherDescription(weather.current.weatherCode);
    const temp = weather.current.temperature;
    
    // Create weather-specific messages
    if (temp < 10) {
      return `It's a chilly ${temp}°C and ${description.toLowerCase()} - perfect for running`;
    } else if (temp > 25) {
      return `It's ${temp}°C and ${description.toLowerCase()} - stay hydrated`;
    } else if (weather.current.weatherCode >= 61 && weather.current.weatherCode <= 67) {
      return `It's ${temp}°C with rain - embrace the elements`;
    } else {
      return `It's ${temp}°C and ${description.toLowerCase()} - ideal for your run`;
    }
  } catch (error) {
    console.error('Error getting weather message:', error);
    return "It's a perfect day for a run";
  }
};

/**
 * Generate a personalized morning message from the user's coach
 */
export const generateCoachMessage = async (
  coachId: string, 
  workout: TodaysWorkout | null, 
  latitude?: number, 
  longitude?: number,
  userId?: string
): Promise<string> => {
  const coach = COACHES.find(c => c.id === coachId);
  const coachStyle = coachStyles[coachId as keyof typeof coachStyles];
  
  if (!coach || !coachStyle) {
    return "Good morning! Ready to crush today's run?";
  }
  
  // Get user profile for personalization
  let userNickname = '';
  if (userId) {
    try {
      const profile = await fetchProfile(userId);
      userNickname = profile?.nickname || profile?.first_name || '';
    } catch (error) {
      console.error('Error fetching user profile for notification:', error);
      // Continue without nickname
    }
  }
  
  // Get weather message
  const weatherMessage = await getWeatherMessage(latitude, longitude);
  
  // Base greeting with coach personality and user's nickname
  let greeting = "Good morning";
  if (coachId === 'craig') {
    greeting = userNickname ? `Rise and shine, ${userNickname}` : "Rise and shine";
  } else if (coachId === 'thomas') {
    greeting = userNickname ? `Good morning, ${userNickname}` : "Good morning, athlete";
  } else if (coachId === 'dathan') {
    greeting = userNickname ? `Morning, ${userNickname}` : "Morning, runner";
  }
  
  // Workout-specific message
  let workoutMessage = "";
  if (workout) {
    const sessionType = (workout.sessionType || workout.session_type || '').toLowerCase();
    if (!sessionType) {
      console.warn('[NotificationService] Workout is missing sessionType/session_type:', workout);
    }
    const distance = workout.distance;
    const timeMinutes = Math.round(workout.time);
    
    // Check if there are multiple sessions mentioned in notes
    const hasMultipleSessions = workout.notes && workout.notes.includes(' and ') && workout.notes.includes('planned today');
    
    if (hasMultipleSessions) {
      // Multiple sessions today - keep it natural but concise
      const sessionTypes = workout.notes.split(' planned today')[0]; // Extract just the session types
      workoutMessage = `Today you've got ${sessionTypes.toLowerCase()}: ${sessionType} first (${distance}km, ${timeMinutes}min)`;
    } else if (sessionType.includes('easy') || sessionType.includes('recovery')) {
      workoutMessage = `Today you've got an easy ${distance}km run (~${timeMinutes}min)`;
    } else if (sessionType.includes('tempo') || sessionType.includes('threshold')) {
      workoutMessage = `Today you've got a ${distance}km tempo run (${timeMinutes}min)`;
    } else if (sessionType.includes('interval') || sessionType.includes('speed')) {
      workoutMessage = `Today you've got ${distance}km of intervals (${timeMinutes}min)`;
    } else if (sessionType.includes('long')) {
      workoutMessage = `Today you've got your long run: ${distance}km (${timeMinutes}min)`;
    } else if (sessionType.includes('rest')) {
      workoutMessage = `Today is a rest day`;
    } else {
      workoutMessage = `Today you've got a ${distance}km ${sessionType} (${timeMinutes}min)`;
    }
  } else {
    workoutMessage = "No specific workout today, but every day is good for movement";
  }
  
  // Simple motivational close - not coach specific
  const motivationalMessages = [
    "Let's get after it!",
    "Let's go!",
    "Time to run!",
    "Get out there!",
    "You've got this!"
  ];
  
  const motivationalMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
  
  return `${greeting}! ${weatherMessage}. ${workoutMessage}. ${motivationalMessage}`;
};

/**
 * Generate evening coach message for check-ins
 */
export const generateEveningCoachMessage = async (
  coachId: string,
  workout: TodaysWorkout | null,
  userId?: string
): Promise<string> => {
  const coach = COACHES.find(c => c.id === coachId);
  
  if (!coach) {
    return "How did your training go today?";
  }
  
  // Get user profile for personalization
  let userNickname = '';
  if (userId) {
    try {
      const profile = await fetchProfile(userId);
      userNickname = profile?.nickname || profile?.first_name || '';
    } catch (error) {
      console.error('Error fetching user profile for evening notification:', error);
    }
  }
  
  // Base greeting with coach personality
  let greeting = "Evening";
  if (coachId === 'craig') {
    greeting = userNickname ? `Evening, ${userNickname}` : "Evening, champ";
  } else if (coachId === 'thomas') {
    greeting = userNickname ? `Good evening, ${userNickname}` : "Good evening";
  } else if (coachId === 'dathan') {
    greeting = userNickname ? `Hey ${userNickname}` : "Hey there";
  }
  
  // Workout check-in message
  let workoutCheckIn = "";
  if (workout) {
    const sessionType = (workout.sessionType || workout.session_type || '').toLowerCase();
    if (!sessionType) {
      console.warn('[NotificationService] Workout is missing sessionType/session_type (evening):', workout);
    }
    if (sessionType.includes('rest')) {
      workoutCheckIn = "Hope you enjoyed your rest day";
    } else {
      workoutCheckIn = `How did your ${sessionType} go today?`;
    }
  } else {
    workoutCheckIn = "How did your training go today?";
  }
  
  // Coach-specific reminder
  let reminder = "Feel free to let me know how things went";
  if (coachId === 'craig') {
    reminder = "Reach out if you want to chat about tomorrow's plan";
  } else if (coachId === 'thomas') {
    reminder = "Let me know if you need guidance for tomorrow";
  } else if (coachId === 'dathan') {
    reminder = "Drop me a note if you want to talk about tomorrow's plan";
  }
  
  // Recovery message
  const recoveryMessage = "Quality sleep is your secret weapon for tomorrow's training";
  
  return `${greeting}! ${workoutCheckIn}. ${reminder}. ${recoveryMessage}.`;
};

/**
 * NEW: Schedule dynamic notifications with fresh content generation
 * This schedules notifications that will generate content at trigger time rather than setup time
 */
export const scheduleDynamicNotifications = async (
  data: NotificationData
): Promise<{ morningId: string | null; eveningId: string | null }> => {
  try {
    console.log('[NotificationService] Scheduling dynamic notifications for user:', data.userId);
    
    // Cancel any existing daily notifications
    await cancelDailyNotifications();

    // Schedule morning notification with minimal static content
    // The actual content will be generated when the notification fires
    // TESTING: Schedule for 7:22 PM
    const morningTrigger: Notifications.CalendarTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 19, // 7 PM
      minute: 22, // 22 minutes
      repeats: true,
    };
    
    const coach = COACHES.find((c) => c.id === data.coachId);
    
    const morningId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Message from ${coach?.name || 'Your Coach'}`,
        body: 'Preparing your daily message...', // Fallback text (user shouldn't see this)
        data: {
          userId: data.userId,
          coachId: data.coachId,
          latitude: data.latitude,
          longitude: data.longitude,
          type: 'morning_motivation',
          dynamic: true, // Flag to indicate this should generate content dynamically
          processing: false, // Flag to prevent duplicate processing
        },
        categoryIdentifier: 'morning_motivation',
        sound: false, // No sound for the placeholder
      },
      trigger: morningTrigger,
    });

    // Schedule evening notification
    // TESTING: Schedule for 7:23 PM
    const eveningTrigger: Notifications.CalendarTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 19, // 7 PM
      minute: 23, // 23 minutes
      repeats: true,
    };
    
    const eveningId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Evening Check-in from ${coach?.name || 'Your Coach'}`,
        body: 'Preparing your evening check-in...', // Fallback text (user shouldn't see this)
        data: {
          userId: data.userId,
          coachId: data.coachId,
          type: 'evening_checkin',
          dynamic: true, // Flag to indicate this should generate content dynamically
          processing: false, // Flag to prevent duplicate processing
        },
        categoryIdentifier: 'evening_checkin',
        sound: false, // No sound for the placeholder
      },
      trigger: eveningTrigger,
    });

    console.log('[NotificationService] Scheduled dynamic notifications:', { morningId, eveningId });
    return { morningId, eveningId };
  } catch (error) {
    console.error('Error scheduling dynamic notifications:', error);
    return { morningId: null, eveningId: null };
  }
};

/**
 * NEW: Force refresh all notification content after training plan updates
 * This should be called whenever training plans are updated to ensure fresh content
 */
export const refreshNotificationContent = async (userId: string): Promise<boolean> => {
  try {
    console.log('[NotificationService] Refreshing notification content for user:', userId);
    
    // Get user profile to retrieve coach and location data
    const profile = await fetchProfile(userId);
    if (!profile?.coach_id) {
      console.warn('[NotificationService] No coach found for user, skipping notification refresh');
      return false;
    }

    // Prepare notification data
    const notificationData: NotificationData = {
      userId: userId,
      coachId: profile.coach_id,
      latitude: profile.latitude,
      longitude: profile.longitude,
    };

    // Reschedule notifications with fresh data
    const result = await scheduleDynamicNotifications(notificationData);
    
    if (result.morningId && result.eveningId) {
      console.log('[NotificationService] Successfully refreshed notification content');
      return true;
    } else {
      console.warn('[NotificationService] Failed to refresh some notifications');
      return false;
    }
  } catch (error) {
    console.error('[NotificationService] Error refreshing notification content:', error);
    return false;
  }
};

/**
 * NEW: Check if user has completed onboarding and has a coach before setting up notifications
 */
export const isReadyForNotifications = async (userId: string): Promise<boolean> => {
  try {
    const profile = await fetchProfile(userId);
    
    // User must have a coach (completed onboarding) to receive meaningful notifications
    return !!(profile?.coach_id);
  } catch (error) {
    console.error('[NotificationService] Error checking notification readiness:', error);
    return false;
  }
};

/**
 * Schedule both daily notifications: 7:30 AM morning motivation and 8:00 PM evening check-in
 * @deprecated Use scheduleDynamicNotifications instead for better content freshness
 */
export const scheduleDailyNotifications = async (
  data: NotificationData
): Promise<{ morningId: string | null; eveningId: string | null }> => {
  console.warn('[NotificationService] scheduleDailyNotifications is deprecated, use scheduleDynamicNotifications instead');
  return scheduleDynamicNotifications(data);
};

/**
 * Cancel all daily notifications (both morning and evening)
 */
export const cancelDailyNotifications = async (): Promise<void> => {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const dailyNotifications = scheduledNotifications.filter(
      (notification) => 
        notification.content.data?.type === 'morning_motivation' ||
        notification.content.data?.type === 'evening_checkin'
    );

    for (const notification of dailyNotifications) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  } catch (error) {
    console.error('Error cancelling daily notifications:', error);
  }
};

/**
 * NEW: Generate fresh notification content when notification is received
 * This function should be called from the app's notification handler
 */
export const generateFreshNotificationContent = async (
  notificationData: any
): Promise<{ title: string; body: string } | null> => {
  try {
    const { userId, coachId, type, latitude, longitude } = notificationData;
    
    if (!userId || !coachId) {
      console.warn('[NotificationService] Missing user or coach data for fresh content generation');
      return null;
    }

    const coach = COACHES.find((c) => c.id === coachId);
    if (!coach) {
      console.warn('[NotificationService] Coach not found for fresh content generation');
      return null;
    }

    // Generate fresh workout data
    const workout = await getTodaysWorkout(userId);

    if (type === 'morning_motivation') {
      const message = await generateCoachMessage(
        coachId,
        workout,
        latitude,
        longitude,
        userId
      );
      
      return {
        title: `Message from ${coach.name}`,
        body: message
      };
    } else if (type === 'evening_checkin') {
      const message = await generateEveningCoachMessage(
        coachId,
        workout,
        userId
      );
      
      return {
        title: `Evening Check-in from ${coach.name}`,
        body: message
      };
    }

    return null;
  } catch (error) {
    console.error('[NotificationService] Error generating fresh notification content:', error);
    return null;
  }
};

/**
 * Update notification content with fresh data (called when app opens)
 * @deprecated Use refreshNotificationContent instead
 */
export const updateNotificationContent = async (data: NotificationData): Promise<void> => {
  console.warn('[NotificationService] updateNotificationContent is deprecated, use refreshNotificationContent instead');
  try {
    await refreshNotificationContent(data.userId);
  } catch (error) {
    console.error('Error updating notification content:', error);
  }
};

/**
 * Get notification statistics
 */
export const getNotificationStatus = async (): Promise<{
  permissionsGranted: boolean;
  scheduledCount: number;
  hasMorning: boolean;
  hasEvening: boolean;
}> => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    
    const morningNotifications = scheduled.filter(
      (notification) => notification.content.data?.type === 'morning_motivation'
    );
    
    const eveningNotifications = scheduled.filter(
      (notification) => notification.content.data?.type === 'evening_checkin'
    );

    return {
      permissionsGranted: status === 'granted',
      scheduledCount: morningNotifications.length + eveningNotifications.length,
      hasMorning: morningNotifications.length > 0,
      hasEvening: eveningNotifications.length > 0,
    };
  } catch (error) {
    console.error('Error getting notification status:', error);
    return {
      permissionsGranted: false,
      scheduledCount: 0,
      hasMorning: false,
      hasEvening: false,
    };
  }
};

/**
 * Schedule daily morning notification at 7:30 AM
 * @deprecated Use scheduleDynamicNotifications instead
 */
export const scheduleDailyMorningNotification = async (
  data: NotificationData
): Promise<string | null> => {
  console.warn('[NotificationService] scheduleDailyMorningNotification is deprecated, use scheduleDynamicNotifications instead');
  const result = await scheduleDynamicNotifications(data);
  return result.morningId;
};

/**
 * Schedule evening recovery notification at 8:00 PM
 * @deprecated Use scheduleDynamicNotifications instead
 */
export const scheduleEveningNotification = async (
  data: NotificationData
): Promise<string | null> => {
  console.warn('[NotificationService] scheduleEveningNotification is deprecated, use scheduleDynamicNotifications instead');
  const result = await scheduleDynamicNotifications(data);
  return result.eveningId;
};

/**
 * Cancel all notifications and reschedule morning (7:30 AM) and evening (8:00 PM) notifications for the next 14 days
 */
export const rescheduleAllNotificationsForNext14Days = async (userId: string, coachId: string) => {
  console.log('[NotificationService] Starting rescheduleAllNotificationsForNext14Days', { userId, coachId });
  if (!coachId) {
    console.error('[NotificationService] coachId is undefined or falsy. Skipping notification scheduling.');
    return;
  }
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[NotificationService] All scheduled notifications cancelled.');

    // Fetch the latest plan
    const plan = await fetchTrainingPlan(userId);
    console.log('[NotificationService] Training plan fetched:', plan.length, 'sessions');

    // Get today
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      // Format as YYYY-MM-DD in local time
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      // Find the session(s) for this day
      const sessions = plan.filter(s => s.date.split('T')[0] === dateString);
      console.log(`[NotificationService] ${dateString}: Found ${sessions.length} session(s)`);

      if (sessions.length > 0) {
        const workout = sessions[0]; // Prioritize first session
        let morningContent = '';
        let eveningContent = '';
        try {
          morningContent = await generateCoachMessage(coachId, workout, workout.latitude, workout.longitude, userId);
          eveningContent = await generateEveningCoachMessage(coachId, workout, userId);
        } catch (contentError) {
          console.error(`[NotificationService] Error generating content for ${dateString}:`, contentError);
          morningContent = 'Your daily workout.';
          eveningContent = 'How did your workout go today?';
        }

        const morningTriggerDate = new Date(date);
        morningTriggerDate.setHours(7, 30, 0, 0);
        const eveningTriggerDate = new Date(date);
        eveningTriggerDate.setHours(20, 0, 0, 0);

        // Add guard: Only schedule if trigger is in the future
        const now = new Date();
        if (morningTriggerDate > now) {
          try {
            const morningId = await Notifications.scheduleNotificationAsync({
              content: {
                title: `Message from Coach`,
                body: morningContent,
                data: { userId, coachId, sessionId: workout.id, type: 'morning_motivation' },
                sound: 'default',
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: morningTriggerDate,
              },
            });
            console.log(`[NotificationService] Scheduled morning notification for ${dateString} (id: ${morningId}) at 7:30 AM`);
          } catch (morningError) {
            console.error(`[NotificationService] Error scheduling morning notification for ${dateString}:`, morningError);
          }
        } else {
          console.log(`[NotificationService] Skipping morning notification for ${dateString} (trigger in the past)`);
        }

        if (eveningTriggerDate > now) {
          try {
            const eveningId = await Notifications.scheduleNotificationAsync({
              content: {
                title: `Evening Check-in from Coach`,
                body: eveningContent,
                data: { userId, coachId, sessionId: workout.id, type: 'evening_checkin' },
                sound: 'default',
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: eveningTriggerDate,
              },
            });
            console.log(`[NotificationService] Scheduled evening notification for ${dateString} (id: ${eveningId}) at 8:00 PM`);
          } catch (eveningError) {
            console.error(`[NotificationService] Error scheduling evening notification for ${dateString}:`, eveningError);
          }
        } else {
          console.log(`[NotificationService] Skipping evening notification for ${dateString} (trigger in the past)`);
        }
      } else {
        console.log(`[NotificationService] No workout scheduled for ${dateString}, skipping notifications.`);
      }
    }
  } catch (error) {
    console.error('Error rescheduling notifications:', error);
  }
};