import React, { useRef, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Image, ScrollView, KeyboardAvoidingView, Platform, ImageSourcePropType } from 'react-native';
import { Text } from '../../../components/ui/StyledText';
import { Feather } from '@expo/vector-icons';
import { ChatMessage } from '../../../hooks/useChatFlow';

interface ChatMiniProps {
  coachName: string;
  coachId: string;
  imageMap: Record<string, any>;
  onMessageSend: (message: string) => void;
  isTyping: boolean;
  messages: ChatMessage[];
}

export function ChatMini({ coachName, coachId, imageMap, onMessageSend, isTyping, messages }: ChatMiniProps) {
  const [message, setMessage] = React.useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const lastMessageCount = useRef(messages.length);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: false });
    }
  }, []);

  useEffect(() => {
    if (scrollViewRef.current && messages.length > lastMessageCount.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
    lastMessageCount.current = messages.length;
  }, [messages]);

  const handleSend = () => {
    if (message.trim()) {
      onMessageSend(message);
      setMessage('');
    }
  };

  return (
    <View className="bg-white rounded-xl p-4 h-[450px]">
      <View className="flex-row items-center mb-4">
        <Image 
          source={imageMap[coachId]} 
          className="w-10 h-10 rounded-full mr-3"
        />
        <Text className="font-semibold text-black">{coachName}</Text>
      </View>
      
      <ScrollView 
        ref={scrollViewRef}
        className="flex-1 mb-4"
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        {messages.map((msg, index) => (
          <View 
            key={index} 
            className={`flex-row items-end mb-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender !== 'user' && (
              <Image 
                source={imageMap[coachId]} 
                className="w-6 h-6 rounded-full mr-2"
              />
            )}
            <View className={`max-w-[80%] py-3 px-4 rounded-2xl ${msg.sender === 'user' ? 'bg-purple-500' : 'bg-gray-100'}`}>
              <Text className={msg.sender === 'user' ? 'text-white' : 'text-black'}>
                {msg.message}
              </Text>
            </View>
          </View>
        ))}
        
        {isTyping && (
          <View className="flex-row items-end mb-2 justify-start">
            <Image 
              source={imageMap[coachId]} 
              className="w-6 h-6 rounded-full mr-2"
            />
            <View className="max-w-[80%] py-3 px-4 rounded-2xl bg-gray-100">
              <Text>Typing...</Text>
            </View>
          </View>
        )}
      </ScrollView>
      
      <View className="flex-row items-center border-t border-gray-100 pt-3">
        <TextInput
          className="flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2 max-h-[100px]"
          value={message}
          onChangeText={setMessage}
          placeholder="Type your message..."
          placeholderTextColor="#999"
          multiline
        />
        <TouchableOpacity 
          className={`px-4 py-2 rounded-full ${!message.trim() ? 'bg-purple-300' : 'bg-purple-500'}`}
          onPress={handleSend}
          disabled={!message.trim()}
        >
          <Text className="text-white font-medium">Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
} 