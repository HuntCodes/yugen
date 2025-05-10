import React from 'react';
import { View, ActivityIndicator, Text, StyleProp, ViewStyle } from 'react-native';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  fullscreen?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A reusable loading spinner component with optional text
 */
export function LoadingSpinner({
  size = 'large',
  color = '#000000',
  text,
  fullscreen = false,
  style,
}: LoadingSpinnerProps) {
  const containerStyle = fullscreen
    ? 'flex-1 items-center justify-center bg-white'
    : 'items-center justify-center py-4';

  return (
    <View style={style} className={containerStyle}>
      <ActivityIndicator size={size} color={color} />
      {text && (
        <Text className="text-gray-500 mt-4 text-center">{text}</Text>
      )}
    </View>
  );
} 