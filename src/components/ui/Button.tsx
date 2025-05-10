import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleProp, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
}

/**
 * A reusable button component with different variants and states
 */
export function Button({
  onPress,
  title,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const getVariantStyle = () => {
    switch (variant) {
      case 'primary':
        return 'bg-black';
      case 'secondary':
        return 'bg-[#F0ECEB]';
      case 'outline':
        return 'bg-white border border-gray-200';
      default:
        return 'bg-black';
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return 'text-white';
      case 'secondary':
        return 'text-black';
      case 'outline':
        return 'text-black';
      default:
        return 'text-white';
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return 'py-2 px-4';
      case 'medium':
        return 'py-3 px-5';
      case 'large':
        return 'py-4 px-6';
      default:
        return 'py-3 px-5';
    }
  };

  const getTextSizeStyle = () => {
    switch (size) {
      case 'small':
        return 'text-sm';
      case 'medium':
        return 'text-base';
      case 'large':
        return 'text-lg';
      default:
        return 'text-base';
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={style}
      className={`rounded-md ${getVariantStyle()} ${getSizeStyle()} ${
        disabled ? 'opacity-50' : 'opacity-100'
      } ${fullWidth ? 'w-full' : ''}`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? 'white' : 'black'}
        />
      ) : (
        <Text
          style={textStyle}
          className={`font-medium text-center ${getTextStyle()} ${getTextSizeStyle()}`}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
} 