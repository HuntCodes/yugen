import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotificationSettings } from '../../components/notifications/NotificationSettings';

export default function NotificationScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="flex-row items-center"
          activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        
        <Text className="text-xl font-semibold text-gray-900">
          Notifications
        </Text>
        
        <View className="w-16" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-6">
          {/* Header Info */}
          <View className="mb-6">
            <Text className="text-2xl font-bold text-gray-900 mb-2">
              Daily Coach Messages
            </Text>
            <Text className="text-gray-600 leading-6">
              Get personalized messages from your coach twice daily: morning motivation with workout and weather details, plus evening check-ins for recovery and progress tracking.
            </Text>
          </View>

          {/* Notification Settings Component */}
          <NotificationSettings showTitle={false} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 