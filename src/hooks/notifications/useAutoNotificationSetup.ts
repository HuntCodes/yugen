import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { useNotifications } from './useNotifications';

const NOTIFICATION_SETUP_KEY = 'notification_setup_completed';
const NOTIFICATION_PROMPT_SHOWN_KEY = 'notification_prompt_shown';

export const useAutoNotificationSetup = () => {
  const { session } = useAuth();
  const { 
    permissionsGranted, 
    isScheduled, 
    isReadyForSetup,
    setupNotifications 
  } = useNotifications();
  const [hasPrompted, setHasPrompted] = useState(false);

  const showNotificationOptIn = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      Alert.alert(
        '🏃‍♂️ Daily Coach Messages',
        "Get personalized messages from your coach twice daily: morning motivation at 7:30 AM with workout and weather details, plus evening check-ins at 8:00 PM for recovery tracking.",
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => {
              // Mark that we've shown the prompt so we don't keep asking
              AsyncStorage.setItem(NOTIFICATION_PROMPT_SHOWN_KEY, 'true');
              resolve(false);
            },
          },
          {
            text: 'Enable Notifications',
            onPress: () => {
              resolve(true);
            },
          },
        ],
        { cancelable: false }
      );
    });
  };

  const setupNotificationsWithFeedback = async (): Promise<void> => {
    try {
      const success = await setupNotifications();
      if (success) {
        // Mark setup as completed
        await AsyncStorage.setItem(NOTIFICATION_SETUP_KEY, 'true');
        Alert.alert(
          '🎉 Notifications Enabled!',
          "Perfect! You'll now receive daily messages from your coach: motivation at 7:30 AM and evening check-ins at 8:00 PM. You can adjust this anytime in your profile settings."
        );
      } else {
        Alert.alert(
          'Setup Incomplete',
          'We had trouble setting up notifications. You can try again later in your profile settings.'
        );
      }
    } catch (error) {
      console.error('Error setting up notifications:', error);
      Alert.alert(
        'Setup Error',
        'Something went wrong. You can try enabling notifications later in your profile settings.'
      );
    }
  };

  const checkAndPromptForNotifications = async () => {
    if (!session?.user || hasPrompted) {
      return;
    }

    try {
      // Check if we've already completed setup
      const setupCompleted = await AsyncStorage.getItem(NOTIFICATION_SETUP_KEY);
      const promptShown = await AsyncStorage.getItem(NOTIFICATION_PROMPT_SHOWN_KEY);
      
      // Don't show if already set up or if user previously declined
      if (setupCompleted || promptShown || permissionsGranted || isScheduled) {
        return;
      }

      // IMPORTANT: Check if user is ready for notifications (has completed onboarding)
      if (!isReadyForSetup) {
        console.log('[AutoNotificationSetup] User not ready for notifications, waiting for onboarding completion');
        return;
      }

      setHasPrompted(true);

      // Show the opt-in dialog
      const userAccepted = await showNotificationOptIn();
      if (userAccepted) {
        await setupNotificationsWithFeedback();
      }
    } catch (error) {
      console.error('Error checking notification setup:', error);
    }
  };

  // Auto-prompt when conditions are met
  useEffect(() => {
    // Small delay to let the screen render first
    const timer = setTimeout(() => {
      checkAndPromptForNotifications();
    }, 1500);

    return () => clearTimeout(timer);
  }, [session, permissionsGranted, isScheduled, isReadyForSetup, hasPrompted]);

  return {
    checkAndPromptForNotifications,
    hasPrompted,
  };
}; 