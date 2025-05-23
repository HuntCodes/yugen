import React from 'react';
import { View, ActivityIndicator, Text, StyleProp, ViewStyle } from 'react-native';
import { MinimalSpinner } from './MinimalSpinner';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  tailwindClassName?: string;
  fullScreen?: boolean;
}

/**
 * A reusable loading spinner component with optional text
 */
export function LoadingSpinner({
  size = 'large',
  color = '#000000',
  text,
  tailwindClassName,
  fullScreen = false,
}: LoadingSpinnerProps) {
  const numericSize = size === 'large' ? 48 : 24;
  
  const defaultTwClasses = fullScreen ? "flex-1 items-center justify-center bg-white" : "items-center justify-center py-4";
  const finalTwClasses = tailwindClassName || defaultTwClasses;

  return (
    <View className={finalTwClasses}>
      <MinimalSpinner size={numericSize} color={color} thickness={size === 'large' ? 3 : 2} />
      {text && (
        <Text className="text-gray-500 mt-4 text-center">{text}</Text>
      )}
    </View>
  );
} 