import React from 'react';
import { View, Text } from 'react-native';

interface TypeIndicatorProps {
  senderName?: string;
}

/**
 * A component that shows a typing indicator for chat messages
 * 
 * @param senderName Optional name of the sender to display
 */
export function TypeIndicator({ senderName = 'Coach' }: TypeIndicatorProps) {
  return (
    <View className="mb-2 items-start">
      <View className="px-4 py-2 rounded-2xl bg-gray-200 max-w-[60%]">
        <Text className="text-gray-500">{senderName} is typing...</Text>
      </View>
    </View>
  );
} 