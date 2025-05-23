import React, { useRef, useEffect, useState } from 'react';
import { View, TextInput, TouchableOpacity, Image, ScrollView, KeyboardAvoidingView, Platform, ImageSourcePropType, InputAccessoryView, Keyboard, Text as RNText } from 'react-native';
import { Text } from '../../../components/ui/StyledText';
import { Feather, Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../../../hooks/useChatFlow';

interface ChatMiniProps {
  coachName: string;
  coachId: string;
  imageMap: Record<string, any>;
  onMessageSend: (message: string) => void;
  isTyping: boolean;
  messages: ChatMessage[];
}

const inputAccessoryViewID = "chatInputAccessory";

export function ChatMini({ coachName, coachId, imageMap, onMessageSend, isTyping, messages }: ChatMiniProps) {
  const [message, setMessage] = React.useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const lastMessageCount = useRef(messages.length);
  const hiddenInputRef = useRef<TextInput>(null);
  const [isKeyboardVisibleForIOS, setIsKeyboardVisibleForIOS] = useState(false);

  useEffect(() => {
    console.log('[ChatMini] hiddenInputRef.current (on mount):', hiddenInputRef.current);

    if (Platform.OS === 'ios') {
      const keyboardDidShowListener = Keyboard.addListener(
        'keyboardDidShow',
        () => setIsKeyboardVisibleForIOS(true)
      );
      const keyboardDidHideListener = Keyboard.addListener(
        'keyboardDidHide',
        () => setIsKeyboardVisibleForIOS(false)
      );

      return () => {
        keyboardDidShowListener.remove();
        keyboardDidHideListener.remove();
      };
    }
  }, []);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: messages.length > lastMessageCount.current });
    }
    lastMessageCount.current = messages.length;
  }, [messages]);

  // New useEffect to scroll to end when keyboard is hidden on iOS
  useEffect(() => {
    if (Platform.OS === 'ios' && !isKeyboardVisibleForIOS && scrollViewRef.current) {
      // Small delay to allow layout to update with placeholder reappearing
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100); // 100ms delay, adjust if needed
      return () => clearTimeout(timer);
    }
  }, [isKeyboardVisibleForIOS]); // Depends on keyboard visibility state

  const handleSend = () => {
    if (message.trim()) {
      onMessageSend(message);
      setMessage('');
    }
  };

  const renderIOSInputAccessoryView = () => (
    <InputAccessoryView nativeID={inputAccessoryViewID} style={{ backgroundColor: '#FFFFFF' }}>
      <View className="flex-row items-center bg-white border-t border-gray-200 px-2 py-2.5">
        <View className="flex-1 flex-row items-center bg-white border-2 border-black rounded-full px-4 h-12">
          <TextInput
            className="flex-1 text-base py-0"
            value={message}
            onChangeText={setMessage}
            placeholder="Type message here"
            placeholderTextColor="#bbb"
            multiline={false}
            style={{ height: 38 }}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            autoFocus
          />
          <TouchableOpacity
            className="ml-2 w-9 h-9 rounded-full items-center justify-center"
            onPress={handleSend}
            disabled={!message.trim()}
          >
            <Ionicons name="send" size={22} color={message.trim() ? '#000' : '#bbb'} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => Keyboard.dismiss()} className="pl-3 pr-1 py-2">
          <RNText className="text-blue-500 font-semibold text-base">Done</RNText>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );

  const renderIOSStaticPlaceholder = () => (
    <TouchableOpacity
      className="flex-row items-center bg-white border-2 border-black rounded-full px-4 h-12"
      onPress={() => {
        console.log("[ChatMini] iOS Static Placeholder TAPPED!");
        setTimeout(() => {
          console.log("[ChatMini] Attempting to focus hiddenInputRef.current");
          hiddenInputRef.current?.focus();
        }, 50);
      }}
      activeOpacity={0.8}
    >
      <RNText className="flex-1 text-base text-[#bbb]" numberOfLines={1}>
        Type message here
      </RNText>
      <View className="ml-2 w-9 h-9 rounded-full items-center justify-center">
        <Ionicons name="send" size={22} color={'#bbb'} />
      </View>
    </TouchableOpacity>
  );

  const renderAndroidInput = () => (
    <View className="flex-row items-center bg-white border-2 border-black rounded-full px-4 h-12">
      <TextInput
        className="flex-1 bg-white rounded-full px-0 py-0 text-base"
        value={message}
        onChangeText={setMessage}
        placeholder="Type message here"
        placeholderTextColor="#bbb"
        multiline={false}
        style={{ height: 38 }}
        returnKeyType="send"
        blurOnSubmit={true}
        onSubmitEditing={handleSend}
      />
      <TouchableOpacity
        className="ml-2 w-9 h-9 rounded-full items-center justify-center"
        onPress={handleSend}
        disabled={!message.trim()}
      >
        <Ionicons name="send" size={22} color={message.trim() ? '#000' : '#bbb'} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="bg-white rounded-lg p-4 h-[450px] shadow-sm flex flex-col">
      <View className="flex-row items-center mb-4">
        <View className="relative mr-3">
          <Image
            source={imageMap[coachId]}
            className="w-10 h-10 rounded-full"
          />
          <View
            className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"
          />
        </View>
        <Text className="font-semibold text-black">{coachName}</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        className="flex-1 mb-4"
        contentContainerStyle={{ paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
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
            <View className={`max-w-[80%] py-3 px-4 rounded-3xl ${msg.sender === 'user' ? 'bg-black' : 'bg-gray-200'}`}>
              <Text className={msg.sender === 'user' ? 'text-white' : 'text-gray-800'}>
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
            <View className="max-w-[80%] py-3 px-4 rounded-lg bg-gray-100">
              <Text>Typing...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View className="pt-3">
        {Platform.OS === 'ios' && !isKeyboardVisibleForIOS && renderIOSStaticPlaceholder()}
        {Platform.OS === 'android' && renderAndroidInput()}
      </View>

      {Platform.OS === 'ios' && (
        <TextInput
          ref={hiddenInputRef}
          style={{ position: 'absolute', top: -9999, left: -9999, width: 1, height: 1, opacity: 0 }}
          inputAccessoryViewID={inputAccessoryViewID}
          value={message}
          onChangeText={setMessage}
        />
      )}
      {Platform.OS === 'ios' && renderIOSInputAccessoryView()}
    </View>
  );
} 