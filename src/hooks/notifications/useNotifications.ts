import { useState, useEffect } from 'react';

import {
  rescheduleAllNotificationsForNext14Days,
  cancelDailyNotifications,
  getNotificationStatus,
  refreshNotificationContent,
  isReadyForNotifications,
} from '../../services/notifications/notificationService';
import { fetchProfile } from '../../services/profile/profileService';
import { useAuth } from '../useAuth';
import { useAppPermissions } from '../useAppPermissions';

interface NotificationState {
  permissionsGranted: boolean;
  isScheduled: boolean;
  loading: boolean;
  error: string | null;
  isReadyForSetup: boolean;
}

export const useNotifications = () => {
  const { session } = useAuth();
  const {
    notifications: notificationStatus,
    requestNotificationPermission,
  } = useAppPermissions();
  const [state, setState] = useState<NotificationState>({
    permissionsGranted: false,
    isScheduled: false,
    loading: false,
    error: null,
    isReadyForSetup: false,
  });

  // Check notification status and readiness on mount
  useEffect(() => {
    checkNotificationStatus();
    checkNotificationReadiness();
  }, [session?.user?.id, notificationStatus]);

  const checkNotificationReadiness = async () => {
    if (!session?.user) {
      setState((prev) => ({ ...prev, isReadyForSetup: false }));
      return;
    }

    try {
      const ready = await isReadyForNotifications(session.user.id);
      setState((prev) => ({ ...prev, isReadyForSetup: ready }));
    } catch (error) {
      console.error('Error checking notification readiness:', error);
      setState((prev) => ({ ...prev, isReadyForSetup: false }));
    }
  };

  const checkNotificationStatus = async () => {
    try {
      const status = await getNotificationStatus();
      const permissionsGranted = notificationStatus === 'granted';

      setState((prev) => ({
        ...prev,
        permissionsGranted,
        isScheduled: status.scheduledCount > 0,
      }));

      // If the user has granted permissions but no notifications are scheduled (e.g., after app reinstall or OS cleanup), eagerly schedule them again
      if (permissionsGranted && status.scheduledCount === 0) {
        if (session?.user) {
          try {
            const profile = await fetchProfile(session.user.id);
            if (profile?.coach_id) {
              await rescheduleAllNotificationsForNext14Days(session.user.id, profile.coach_id);
              // Re-fetch to update state
              const statusAfter = await getNotificationStatus();
              setState((prev) => ({
                ...prev,
                isScheduled: statusAfter.scheduledCount > 0,
              }));
            }
          } catch (autoScheduleError) {
            console.error('Error auto-rescheduling notifications:', autoScheduleError);
          }
        }
      }
    } catch (error) {
      console.error('Error checking notification status:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to check notification status',
      }));
    }
  };

  const setupNotifications = async () => {
    if (!session?.user) {
      setState((prev) => ({
        ...prev,
        error: 'User not authenticated',
      }));
      return false;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Check if user has completed onboarding first
      const ready = await isReadyForNotifications(session.user.id);
      if (!ready) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Please complete onboarding and select a coach first.',
          isReadyForSetup: false,
        }));
        return false;
      }

      // Fetch user profile to get coach_id
      const profile = await fetchProfile(session.user.id);
      if (!profile?.coach_id) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'No coach selected. Please complete onboarding first.',
          isReadyForSetup: false,
        }));
        return false;
      }

      // Request notification permissions
      const permissionsGranted = await requestNotificationPermission();
      if (!permissionsGranted) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Notification permissions denied',
        }));
        return false;
      }

      // Eager scheduling: schedule the next 14 days immediately with full content
      await rescheduleAllNotificationsForNext14Days(session.user.id, profile.coach_id);

      // Verify scheduling succeeded by checking notification count
      await checkNotificationStatus();

      setState((prev) => ({
        ...prev,
        loading: false,
        permissionsGranted: true,
        isScheduled: true,
        isReadyForSetup: true,
      }));
      return true;
    } catch (error) {
      console.error('Error setting up notifications:', error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to setup notifications',
      }));
      return false;
    }
  };

  const disableNotifications = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      await cancelDailyNotifications();
      setState((prev) => ({
        ...prev,
        loading: false,
        isScheduled: false,
      }));
      return true;
    } catch (error) {
      console.error('Error disabling notifications:', error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to disable notifications',
      }));
      return false;
    }
  };

  // NEW: Function to refresh notification content after plan updates
  const refreshNotifications = async () => {
    if (!session?.user) {
      console.warn('No user session available for notification refresh');
      return false;
    }

    try {
      const success = await refreshNotificationContent(session.user.id);
      if (success) {
        console.log('Notifications refreshed successfully');
        // Recheck status after refresh
        await checkNotificationStatus();
      }
      return success;
    } catch (error) {
      console.error('Error refreshing notifications:', error);
      return false;
    }
  };

  return {
    permissionsGranted: state.permissionsGranted,
    isScheduled: state.isScheduled,
    loading: state.loading,
    error: state.error,
    isReadyForSetup: state.isReadyForSetup,
    setupNotifications,
    disableNotifications,
    checkNotificationStatus,
    checkNotificationReadiness,
    refreshNotifications,
  };
};
