import React from 'react';
import { View, Text, Image } from 'react-native';
import { ChatMessage } from '../../../types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  coach: { id: string; name: string } | null;
  imageMap: Record<string, any>;
}

export function MessageBubble({ message, coach, imageMap }: MessageBubbleProps) {
  if (message.sender === 'coach') {
    return (
      <View style={{ flexDirection: 'row' }}>
        <Image
          source={coach?.id ? imageMap[coach.id] : undefined}
          style={{ 
            width: 36, 
            height: 36, 
            borderRadius: 18, 
            marginRight: 12,
            backgroundColor: '#F5F5F5',
            borderWidth: 1,
            borderColor: '#E0E5EB'
          }}
          resizeMode="cover"
        />
        <View style={{ flex: 1 }}>
          <Text style={{ 
            fontSize: 13, 
            color: '#757575', 
            marginBottom: 4, 
            fontWeight: '500'
          }}>
            {coach?.name || 'Coach'}
          </Text>
          <View style={{ 
            paddingHorizontal: 16, 
            paddingVertical: 12, 
            backgroundColor: '#F5F5F5', 
            borderRadius: 6,
            maxWidth: '85%' 
          }}>
            <Text style={{ color: '#000000', lineHeight: 20 }}>{message.message}</Text>
          </View>
        </View>
      </View>
    );
  } else {
    return (
      <View style={{ alignItems: 'flex-end' }}>
        <View style={{ 
          paddingHorizontal: 16, 
          paddingVertical: 12, 
          backgroundColor: '#000000', 
          borderRadius: 6,
          maxWidth: '85%' 
        }}>
          <Text style={{ color: 'white', lineHeight: 20 }}>{message.message}</Text>
        </View>
      </View>
    );
  }
} 