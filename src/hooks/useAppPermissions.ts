import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';

// Allowed values from Expo permission objects
export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

interface PermissionState {
  location: PermissionStatus;
  notifications: PermissionStatus;
  microphone: PermissionStatus;
}

const INITIAL_STATE: PermissionState = {
  location: 'undetermined',
  notifications: 'undetermined',
  microphone: 'undetermined',
};

const LAST_LOCATION_PROMPT_KEY = 'lastLocationPermissionPromptTs';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function useAppPermissions() {
  const [state, setState] = useState<PermissionState>(INITIAL_STATE);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const refreshAllPermissions = useCallback(async () => {
    try {
      // Location
      const locationPerm = await Location.getForegroundPermissionsAsync();
      // Notifications
      const notifPerm = await Notifications.getPermissionsAsync();
      // Microphone
      const micPerm = await Audio.getPermissionsAsync();

      setState({
        location: locationPerm.status as PermissionStatus,
        notifications: notifPerm.status as PermissionStatus,
        microphone: micPerm.status as PermissionStatus,
      });
    } catch (err) {
      console.error('[useAppPermissions] Error refreshing permissions:', err);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Listeners
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Initial fetch
    refreshAllPermissions();

    const handleAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        refreshAllPermissions();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [refreshAllPermissions]);

  // ---------------------------------------------------------------------------
  // Request wrappers
  // ---------------------------------------------------------------------------
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      // Throttle to once per 24h
      const lastPromptStr = await AsyncStorage.getItem(LAST_LOCATION_PROMPT_KEY);
      if (lastPromptStr) {
        const lastPrompt = Number(lastPromptStr);
        if (!isNaN(lastPrompt) && Date.now() - lastPrompt < TWENTY_FOUR_HOURS_MS) {
          console.log('[useAppPermissions] Skipping location prompt – throttled');
          return state.location === 'granted';
        }
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      await AsyncStorage.setItem(LAST_LOCATION_PROMPT_KEY, Date.now().toString());
      await refreshAllPermissions();
      return status === 'granted';
    } catch (err) {
      console.error('[useAppPermissions] Error requesting location permission:', err);
      return false;
    }
  }, [refreshAllPermissions, state.location]);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing === 'granted') {
        await refreshAllPermissions();
        return true;
      }
      const { status } = await Notifications.requestPermissionsAsync();
      await refreshAllPermissions();
      return status === 'granted';
    } catch (err) {
      console.error('[useAppPermissions] Error requesting notification permission:', err);
      return false;
    }
  }, [refreshAllPermissions]);

  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      await refreshAllPermissions();
      return status === 'granted';
    } catch (err) {
      console.error('[useAppPermissions] Error requesting microphone permission:', err);
      return false;
    }
  }, [refreshAllPermissions]);

  return {
    ...state,
    requestLocationPermission,
    requestNotificationPermission,
    requestMicrophonePermission,
  } as const;
} 