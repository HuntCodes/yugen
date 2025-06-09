import React from 'react';
import { TextInput, TextInputProps, View, Text } from 'react-native';

interface AuthInputProps extends TextInputProps {
  label: string;
  error?: string;
}

export function AuthInput({ label, error, ...props }: AuthInputProps) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-gray-700">{label}</Text>
      <TextInput
        className={`rounded-lg border p-3 ${error ? 'border-red-500' : 'border-gray-300'}`}
        {...props}
      />
      {error && <Text className="mt-1 text-sm text-red-500">{error}</Text>}
    </View>
  );
}
