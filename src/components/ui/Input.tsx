import React from 'react';
import { View, TextInput, Text, StyleProp, ViewStyle, TextStyle } from 'react-native';

interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  secureTextEntry?: boolean;
  disabled?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
}

/**
 * A reusable text input component with label and error state
 */
export function Input({
  value,
  onChangeText,
  placeholder,
  label,
  error,
  secureTextEntry = false,
  disabled = false,
  autoCapitalize = 'none',
  keyboardType = 'default',
  style,
  inputStyle,
  onSubmitEditing,
  returnKeyType,
}: InputProps) {
  return (
    <View style={style} className="mb-4">
      {label && (
        <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        editable={!disabled}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        style={inputStyle}
        className="bg-gray-100 px-4 py-3 rounded-md text-black"
        placeholderTextColor="#9CA3AF"
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
      />
      {error && (
        <Text className="text-sm text-red-500 mt-1">{error}</Text>
      )}
    </View>
  );
} 