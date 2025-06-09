import React, { useRef, useEffect } from 'react';
import { ScrollView, View, Text } from 'react-native';

import { ChatBubble } from '../../../components/chat/ChatBubble';
import { TypeIndicator } from '../../../components/chat/TypeIndicator';
import { ChatMessage } from '../../../types/chat';

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
      keyboardShouldPersistTaps="handled">
      {messages.length === 0 ? (
        <View className="items-center justify-center py-12">
          <Text className="text-center text-gray-400">
            Send a message to start chatting with your coach
          </Text>
        </View>
      ) : (
        messages.map((msg, idx) => (
          <View key={idx} className="mb-4">
            <ChatBubble message={msg} coach={coach} imageMap={imageMap} style="default" />
          </View>
        ))
      )}
      {isTyping && (
        <TypeIndicator
          coachName={coach?.name}
          coachId={coach?.id}
          imageMap={imageMap}
          style="withAvatar"
        />
      )}
      <View className="h-4" />
    </ScrollView>
  );
}
