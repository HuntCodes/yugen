import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isTyping: boolean;
}

export function ChatInput({ value, onChangeText, onSend, isTyping }: ChatInputProps) {
  return (
    <View className="px-4 py-2.5">
      <View className="flex-row items-center">
        <TextInput
          className="flex-1 rounded-full bg-gray-100 px-5 py-3.5 text-black"
          placeholder="Message your coach..."
          placeholderTextColor="#757575"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSend}
          returnKeyType="send"
          editable={!isTyping}
          multiline={false}
          style={styles.input}
        />
        <TouchableOpacity
          className={`ml-2 rounded-full p-3 ${value.trim() && !isTyping ? 'bg-gray-200' : 'bg-gray-100'}`}
          onPress={onSend}
          disabled={!value.trim() || isTyping}
          style={styles.sendButton}>
          <Text className="text-center font-medium">Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: 16,
    color: '#000000',
  },
  sendButton: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
});
