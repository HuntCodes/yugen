import React from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';

interface OnboardingInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isTyping: boolean;
  showContinue?: boolean;
  planLoading: boolean;
  disabled?: boolean;
}

export function OnboardingInput({ 
  value, 
  onChangeText, 
  onSend, 
  isTyping, 
  showContinue = false, 
  planLoading, 
  disabled = false
}: OnboardingInputProps) {
  return (
    <View style={{ 
      padding: 16, 
      borderTopWidth: 1, 
      borderTopColor: '#F5F5F5', 
      backgroundColor: 'white'
    }}>
      <View style={{ flexDirection: 'row' }}>
        <TextInput
          style={{ 
            flex: 1, 
            backgroundColor: '#F5F5F5', 
            borderRadius: 6, 
            paddingHorizontal: 16, 
            paddingVertical: 12, 
            marginRight: 8, 
            color: '#000000'
          }}
          placeholder="Type a message..."
          placeholderTextColor="#757575"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSend}
          returnKeyType="send"
          editable={!isTyping && !showContinue && !planLoading && !disabled}
        />
        <TouchableOpacity
          style={{ 
            paddingHorizontal: 16, 
            paddingVertical: 12, 
            borderRadius: 6, 
            backgroundColor: value.trim() && !isTyping && !showContinue && !planLoading && !disabled ? '#000000' : '#DDDDDD'
          }}
          onPress={onSend}
          disabled={!value.trim() || isTyping || showContinue || planLoading || disabled}
        >
          <Text style={{ color: 'white', fontWeight: '500' }}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
} 