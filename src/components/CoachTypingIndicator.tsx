import React from 'react';
import { View, Text } from 'react-native';

export function CoachTypingIndicator() {
  // Placeholder for animated dots
  return (
    <View className="mb-2 items-start">
      <View className="px-4 py-2 rounded-2xl bg-gray-200 max-w-[60%]">
        <Text className="text-gray-500">Coach is typing...</Text>
      </View>
    </View>
  );
} 