import { Feather } from '@expo/vector-icons';
import React from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';

import { useNotifications } from '../../hooks/notifications/useNotifications';
import { colors } from '../../styles/colors';
import { Text } from '../ui/StyledText';
import {
  requestNotificationPermissions,
  scheduleDailyMorningNotification,
  cancelDailyNotifications,
  getNotificationStatus,
  updateNotificationContent,
  NotificationData,
} from '../../services/notifications/notificationService';
import { useAuth } from '../../context/AuthContext';
import { fetchProfile } from '../../services/profile/profileService';
import * as Location from 'expo-location';

interface NotificationSettingsProps {
  showTitle?: boolean;
  containerStyle?: string;
}

export function NotificationSettings({
  showTitle = true,
  containerStyle = 'bg-white rounded-lg p-4 mb-4',
}: NotificationSettingsProps) {
  const { session } = useAuth();
  const {
    permissionsGranted,
    isScheduled,
    loading,
    error,
    isReadyForSetup,
    setupNotifications,
    disableNotifications,
    checkNotificationStatus,
  } = useNotifications();

  const handleToggleNotifications = async () => {
    if (loading) return;

    // Check if user has completed onboarding first
    if (!isReadyForSetup && !isScheduled) {
      Alert.alert(
        'Complete Onboarding First',
        'Please complete your onboarding and select a coach before setting up notifications. This ensures you receive personalized messages from your chosen coach.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    if (isScheduled) {
      // Disable notifications
      Alert.alert(
        'Disable Morning Notifications',
        'Are you sure you want to stop receiving daily motivation from your coach?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              const success = await disableNotifications();
              if (success) {
                Alert.alert('Success', 'Morning notifications have been disabled.');
              } else {
                Alert.alert('Error', 'Failed to disable notifications. Please try again.');
              }
            },
          },
        ]
      );
    } else {
      // Enable notifications
      const success = await setupNotifications();
      if (success) {
        Alert.alert(
          'Notifications Enabled!',
          "You'll now receive daily motivation from your coach at 7:30 AM and evening check-ins at 8:00 PM. You can change this anytime in your profile settings."
        );
      } else if (error?.includes('permissions')) {
        Alert.alert(
          'Permissions Required',
          'Please enable notifications in your device settings to receive daily motivation from your coach.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                // This would ideally open device settings, but that's platform-specific
                Alert.alert(
                  'Settings',
                  'Please go to Settings > Notifications > Yugen and enable notifications.'
                );
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', error || 'Failed to setup notifications. Please try again.');
      }
    }
  };

  const getStatusText = () => {
    if (loading) return 'Checking...';
    if (!isReadyForSetup && !isScheduled) return 'Complete onboarding first to receive personalized coach messages';
    if (!permissionsGranted) return 'Tap to enable notifications and get daily motivation';
    if (isScheduled) return 'Daily notifications enabled at 7:30 AM and 8:00 PM';
    return 'Tap to enable daily motivation';
  };

  const getStatusColor = () => {
    if (loading) return colors.text.secondary;
    if (!isReadyForSetup && !isScheduled) return colors.text.secondary;
    if (!permissionsGranted) return colors.text.secondary;
    if (isScheduled) return colors.success;
    return colors.text.secondary;
  };

  const getToggleIcon = () => {
    if (loading) return 'clock';
    if (!isReadyForSetup && !isScheduled) return 'user-x';
    if (isScheduled) return 'bell';
    return 'bell-off';
  };

  const getToggleColor = () => {
    if (loading) return colors.text.disabled;
    if (!isReadyForSetup && !isScheduled) return colors.text.disabled;
    if (isScheduled) return colors.success;
    return colors.text.disabled;
  };

  const isDisabled = loading || (!isReadyForSetup && !isScheduled);

  return (
    <View className={containerStyle}>
      {showTitle && (
        <View className="mb-3 flex-row items-center">
          <Feather name="bell" size={20} color={colors.text.secondary} />
          <Text className="ml-2 text-lg font-semibold text-gray-800">Morning Notifications</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleToggleNotifications}
        disabled={isDisabled}
        className="flex-row items-center justify-between py-2"
        activeOpacity={0.7}>
        <View className="mr-4 flex-1">
          <Text className="mb-1 text-base text-gray-800">Daily Coach Messages</Text>
          <Text className="text-sm" style={{ color: getStatusColor() }}>
            {getStatusText()}
          </Text>
          {error && !loading && <Text className="mt-1 text-sm text-red-500">{error}</Text>}
        </View>

        <View className="flex-row items-center">
          <Feather name={getToggleIcon()} size={24} color={getToggleColor()} />
          {!loading && (
            <View
              className={`ml-3 h-6 w-12 rounded-full ${
                isScheduled ? 'bg-green-500' : 'bg-gray-300'
              } flex-row items-center`}>
              <View
                className={`h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  isScheduled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {isScheduled && (
        <View className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
          <Text className="text-sm text-green-700">
            🏃‍♂️ You'll receive personalized morning messages from your coach with today's workout and weather, plus evening check-ins to track your progress and recovery.
          </Text>
        </View>
      )}

      {!isReadyForSetup && !isScheduled && (
        <View className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
          <Text className="text-sm text-orange-700">
            👋 Complete your onboarding and select a coach to receive personalized daily messages. This ensures your notifications are relevant and helpful for your training.
          </Text>
        </View>
      )}
    </View>
  );
}
