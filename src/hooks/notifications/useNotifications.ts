import * as Location from 'expo-location';
import { useState, useEffect } from 'react';

import {
  requestNotificationPermissions,
  scheduleDynamicNotifications,
  cancelDailyNotifications,
  getNotificationStatus,
  refreshNotificationContent,
  isReadyForNotifications,
  NotificationData,
} from '../../services/notifications/notificationService';
import { fetchProfile } from '../../services/profile/profileService';
import { useAuth } from '../useAuth';

interface NotificationState {
  permissionsGranted: boolean;
  isScheduled: boolean;
  loading: boolean;
  error: string | null;
  isReadyForSetup: boolean;
}

export const useNotifications = () => {
  const { session } = useAuth();
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
  }, [session?.user?.id]);

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
      setState((prev) => ({
        ...prev,
        permissionsGranted: status.permissionsGranted,
        isScheduled: status.scheduledCount > 0,
      }));
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
      const permissionsGranted = await requestNotificationPermissions();
      if (!permissionsGranted) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Notification permissions denied',
        }));
        return false;
      }

      // Get user location for weather data
      let location = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          location = await Location.getCurrentPositionAsync({});
        }
      } catch (locationError) {
        console.log('Could not get location for weather:', locationError);
        // Continue without location - weather will use fallback message
      }

      // Schedule dynamic notifications
      const notificationData: NotificationData = {
        userId: session.user.id,
        coachId: profile.coach_id,
        latitude: location?.coords.latitude,
        longitude: location?.coords.longitude,
      };

      const result = await scheduleDynamicNotifications(notificationData);

      if (result.morningId && result.eveningId) {
        setState((prev) => ({
          ...prev,
          loading: false,
          permissionsGranted: true,
          isScheduled: true,
          isReadyForSetup: true,
        }));
        return true;
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to schedule all notifications',
        }));
        return false;
      }
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
