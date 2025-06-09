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
      {label && <Text className="mb-1 text-sm font-medium text-gray-700">{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        editable={!disabled}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        style={inputStyle}
        className="rounded-md bg-gray-100 px-4 py-3 text-black"
        placeholderTextColor="#9CA3AF"
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
      />
      {error && <Text className="mt-1 text-sm text-red-500">{error}</Text>}
    </View>
  );
}
