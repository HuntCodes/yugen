import React, { useRef, useEffect } from 'react';
import { ScrollView, View, Text, Image } from 'react-native';
import { ChatMessage } from '../../../types/chat';
import { TypeIndicator } from './TypeIndicator';

interface MessageListProps {
  messages: ChatMessage[];
  isTyping: boolean;
  coach: { id: string; name: string };
  imageMap: Record<string, any>;
}

export function MessageList({ messages, isTyping, coach, imageMap }: MessageListProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isTyping]);
  
  return (
    <ScrollView 
      className="flex-1 px-4 py-2"
      ref={scrollViewRef}
      onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {messages.length === 0 ? (
        <View className="items-center justify-center py-12">
          <Text className="text-gray-400 text-center">Send a message to start chatting with your coach</Text>
        </View>
      ) : (
        messages.map((msg, idx) => (
          <View key={idx} className="mb-4">
            {msg.sender === 'coach' ? (
              <View className="flex-row mb-1">
                <Image
                  source={coach?.id ? imageMap[coach.id] : undefined}
                  className="w-9 h-9 rounded-full mr-3 bg-gray-100 border border-gray-200"
                  resizeMode="cover"
                />
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 mb-1 font-medium">
                    {coach?.name || 'Coach'}
                  </Text>
                  <View className="bg-gray-100 p-3 rounded-2xl rounded-tl-none max-w-[85%]">
                    <Text className="text-black leading-5">{msg.message}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className="items-end mb-1">
                <View className="bg-black p-3 rounded-2xl rounded-tr-none max-w-[85%]">
                  <Text className="text-white leading-5">{msg.message}</Text>
                </View>
              </View>
            )}
          </View>
        ))
      )}
      {isTyping && (
        <TypeIndicator 
          coachName={coach?.name} 
          coachId={coach?.id} 
          imageMap={imageMap} 
        />
      )}
      <View className="h-4" />
    </ScrollView>
  );
} 