import React, { useRef, useEffect } from 'react';
import { ScrollView, View, Text, Keyboard, Platform } from 'react-native';

import { ChatBubble } from '../../../components/chat/ChatBubble';
import { TypeIndicator } from '../../../components/chat/TypeIndicator';
import { ChatMessage } from '../../../types/chat';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isTyping: boolean;
  coach: { id: string; name: string } | null;
  imageMap: Record<string, any>;
  planError?: string | null;
}

export function ChatMessageList({
  messages,
  isTyping,
  coach,
  imageMap,
  planError,
}: ChatMessageListProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  // Scroll to bottom when messages change or typing status changes
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isTyping]);

  // Set up keyboard listeners to scroll when keyboard appears/disappears
  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    const keyboardHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    // Clean up listeners
    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, []);

  return (
    <ScrollView
      ref={scrollViewRef}
      style={{ flex: 1, padding: 16 }}
      contentContainerStyle={{ paddingBottom: 8 }}
      onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive">
      {messages.map((msg, idx) => (
        <View key={idx} style={{ marginBottom: 16 }}>
          <ChatBubble message={msg} coach={coach} imageMap={imageMap} />
        </View>
      ))}

      {/* Typing indicator */}
      {isTyping && coach && (
        <TypeIndicator
          coachName={coach.name}
          coachId={coach.id}
          imageMap={imageMap}
          style="withAvatar"
        />
      )}

      {/* Error message */}
      {planError && (
        <View
          style={{
            backgroundColor: '#FFEBEE',
            padding: 16,
            borderRadius: 6,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#FFCDD2',
          }}>
          <Text style={{ color: '#C62828' }}>Error: {planError}. Please try again.</Text>
        </View>
      )}
    </ScrollView>
  );
}
