import { Feather, Ionicons } from '@expo/vector-icons';
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ImageSourcePropType,
  InputAccessoryView,
  Keyboard,
  Text as RNText,
  Pressable,
} from 'react-native';

import { Text } from '../../../components/ui/StyledText';
import { ChatMessage } from '../../../hooks/useChatFlow';

interface ChatMiniProps {
  coachName: string;
  coachId: string;
  imageMap: Record<string, any>;
  onMessageSend: (message: string) => void;
  isTyping: boolean;
  messages: ChatMessage[];
  // Voice functionality props
  onVoiceActivate?: () => void;
  voiceStarting?: boolean;
  isDailyVoiceModeActive?: boolean;
}

const inputAccessoryViewID = 'chatInputAccessory';

export function ChatMini({
  coachName,
  coachId,
  imageMap,
  onMessageSend,
  isTyping,
  messages,
  onVoiceActivate,
  voiceStarting = false,
  isDailyVoiceModeActive = false,
}: ChatMiniProps) {
  const [message, setMessage] = React.useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const lastMessageCount = useRef(messages.length);
  const hiddenInputRef = useRef<TextInput>(null);
  const [isKeyboardVisibleForIOS, setIsKeyboardVisibleForIOS] = useState(false);

  // State for suggestion messages
  const [suggestions, setSuggestions] = useState([
    "How's my training looking this week?",
    'What do i have for training today?',
    "Can you adjust today's workout?",
  ]);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () =>
        setIsKeyboardVisibleForIOS(true)
      );
      const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () =>
        setIsKeyboardVisibleForIOS(false)
      );

      return () => {
        keyboardDidShowListener.remove();
        keyboardDidHideListener.remove();
      };
    }
  }, []);

  useEffect(() => {
    if (scrollViewRef.current) {
      // Only auto-scroll if there are no suggestions visible
      const shouldAutoScroll =
        suggestions.length === 0 || messages.length > lastMessageCount.current;
      if (shouldAutoScroll) {
        scrollViewRef.current.scrollToEnd({ animated: messages.length > lastMessageCount.current });
      }
    }
    lastMessageCount.current = messages.length;
  }, [messages, suggestions.length]);

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

  // Add logging for message state changes
  const handleMessageChange = (text: string) => {
    setMessage(text);
  };

  const handleSend = () => {
    if (message.trim()) {
      onMessageSend(message);
      setMessage('');
    }
  };

  // Handle suggestion tap
  const handleSuggestionTap = (suggestionText: string) => {
    onMessageSend(suggestionText);
    // Remove the suggestion after sending
    setSuggestions((prev) => prev.filter((s) => s !== suggestionText));
  };

  // Handle suggestion dismiss
  const handleSuggestionDismiss = (suggestionText: string) => {
    setSuggestions((prev) => prev.filter((s) => s !== suggestionText));
  };

  const renderIOSInputAccessoryView = () => (
    <InputAccessoryView nativeID={inputAccessoryViewID}>
      <View style={{ 
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingHorizontal: 8,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'flex-end'
      }}>
        <View style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'flex-end',
          backgroundColor: 'white',
          borderWidth: 2,
          borderColor: '#000',
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 12,
          minHeight: 48,
          maxHeight: 120
        }}>
          <TextInput
            style={{
              flex: 1,
              fontSize: 16,
              minHeight: 24,
              maxHeight: 72,
              paddingVertical: 0,
              textAlignVertical: 'top',
            }}
            value={message}
            onChangeText={handleMessageChange}
            placeholder="Type message here"
            placeholderTextColor="#bbb"
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={(event) => {
              if (message.trim() && message.length < 100) {
                event.preventDefault();
                handleSend();
              }
            }}
            blurOnSubmit={false}
            autoFocus
          />
          <View
            style={{
              marginLeft: 8,
              height: 36,
              width: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              opacity: !message.trim() ? 0.5 : 1,
            }}
            onTouchStart={(event) => {
              if (message.trim()) {
                handleSend();
              }
            }}>
            <Ionicons name="send" size={22} color={message.trim() ? '#000' : '#bbb'} />
          </View>
        </View>
        <Pressable
          style={({ pressed }) => ({
            paddingVertical: 8,
            paddingLeft: 12,
            paddingRight: 4,
            opacity: pressed ? 0.7 : 1
          })}
          onPress={() => {
            Keyboard.dismiss();
          }}>
          <RNText style={{ fontSize: 16, fontWeight: '600', color: '#3B82F6' }}>Done</RNText>
        </Pressable>
      </View>
    </InputAccessoryView>
  );

  const renderIOSStaticPlaceholder = () => (
    <View className="flex-row items-center">
      <TouchableOpacity
        className="h-12 flex-1 flex-row items-center rounded-full border-2 border-black bg-white px-4"
        onPress={() => {
          setTimeout(() => {
            hiddenInputRef.current?.focus();
          }, 50);
        }}
        activeOpacity={0.8}>
        <RNText className="flex-1 text-base text-[#bbb]" numberOfLines={1} style={{ fontSize: 16 }}>
          Type message here
        </RNText>
        <View className="h-9 w-9 items-center justify-center rounded-full">
          <Ionicons name="send" size={22} color="#bbb" />
        </View>
      </TouchableOpacity>
      {onVoiceActivate && (
        <TouchableOpacity
          className="ml-2 h-9 w-9 items-center justify-center rounded-full"
          onPress={voiceStarting || isDailyVoiceModeActive ? undefined : onVoiceActivate}
          disabled={voiceStarting || isDailyVoiceModeActive}
          style={{
            opacity: voiceStarting || isDailyVoiceModeActive ? 0.5 : 1,
          }}>
          <Feather
            name="mic"
            size={20}
            color={voiceStarting || isDailyVoiceModeActive ? '#9CA3AF' : '#000'}
          />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderAndroidInput = () => (
    <View className="flex-row items-center">
      <View className="flex-1 flex-row items-center rounded-full border-2 border-black bg-white px-4"
            style={{ minHeight: 48, maxHeight: 120 }}>
        <TextInput
          className="flex-1 rounded-full bg-white px-0 text-base"
          value={message}
          onChangeText={handleMessageChange}
          placeholder="Type message here"
          placeholderTextColor="#bbb"
          multiline={message.length > 50} // Enable multiline for longer messages
          style={{
            minHeight: 48,
            maxHeight: 100,
            paddingVertical: message.length > 50 ? 8 : 0,
            textAlignVertical: message.length > 50 ? 'top' : 'center',
            includeFontPadding: false,
            fontSize: 16,
          }}
          returnKeyType="send"
          blurOnSubmit={message.length <= 50}
          onSubmitEditing={(event) => {
            // Send for short messages, allow multiline for longer ones
            if (message.trim() && message.length <= 50) {
              event.preventDefault();
              handleSend();
            }
          }}
        />
        <TouchableOpacity
          className="ml-2 h-9 w-9 items-center justify-center rounded-full"
          onPress={() => {
            if (message.trim()) {
              handleSend();
            }
          }}
          style={{
            opacity: !message.trim() ? 0.5 : 1,
          }}>
          <Ionicons name="send" size={22} color={message.trim() ? '#000' : '#bbb'} />
        </TouchableOpacity>
      </View>
      {onVoiceActivate && (
        <TouchableOpacity
          className="ml-2 h-9 w-9 items-center justify-center rounded-full"
          onPress={voiceStarting || isDailyVoiceModeActive ? undefined : onVoiceActivate}
          disabled={voiceStarting || isDailyVoiceModeActive}
          style={{
            opacity: voiceStarting || isDailyVoiceModeActive ? 0.5 : 1,
          }}>
          <Feather
            name="mic"
            size={20}
            color={voiceStarting || isDailyVoiceModeActive ? '#9CA3AF' : '#000'}
          />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View className="flex h-[450px] flex-col rounded-lg bg-white p-4 shadow-sm">
      <View className="mb-4 flex-row items-center">
        <View className="relative mr-3">
          <Image source={imageMap[coachId]} className="h-10 w-10 rounded-full" />
          <View className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
        </View>
        <Text className="flex-1 font-semibold text-black">{coachName}</Text>
        {onVoiceActivate && (
          <TouchableOpacity
            className={`rounded-full border px-3 py-1.5 ${
              voiceStarting || isDailyVoiceModeActive
                ? 'border-gray-300 bg-gray-200'
                : 'border-purple-500 bg-purple-500'
            }`}
            onPress={voiceStarting || isDailyVoiceModeActive ? undefined : onVoiceActivate}
            disabled={voiceStarting || isDailyVoiceModeActive}>
            <Text
              className={`text-sm font-medium ${
                voiceStarting || isDailyVoiceModeActive ? 'text-gray-500' : 'text-white'
              }`}>
              {voiceStarting || isDailyVoiceModeActive ? 'Voice Active...' : 'Voice Check In'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        className="mb-4 flex-1"
        contentContainerStyle={{ paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled">
        {(() => {
          const sortedMessages = messages
            .sort((a, b) => {
              // Sort messages by timestamp to ensure proper chronological order
              const timestampA = a.timestamp || 0;
              const timestampB = b.timestamp || 0;
              return timestampA - timestampB;
            });
          
          return sortedMessages.map((msg, index) => (
            <View
              key={`${msg.timestamp || Date.now()}-${index}`} // Use timestamp + index for better key stability
              className={`mb-2 flex-row items-end ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.sender !== 'user' && (
                <Image source={imageMap[coachId]} className="mr-2 h-6 w-6 rounded-full" />
              )}
              <View
                className={`max-w-[80%] rounded-3xl px-4 py-3 ${msg.sender === 'user' ? 'bg-black' : 'bg-gray-200'}`}>
                <Text className={msg.sender === 'user' ? 'text-white' : 'text-gray-800'}>
                  {msg.message}
                </Text>
              </View>
            </View>
          ));
        })()}

        {isTyping && (
          <View className="mb-2 flex-row items-end justify-start">
            <Image source={imageMap[coachId]} className="mr-2 h-6 w-6 rounded-full" />
            <View className="max-w-[80%] rounded-lg bg-gray-100 px-4 py-3">
              <Text>Typing...</Text>
            </View>
          </View>
        )}

        {/* Suggestion Messages - At bottom of scrollable content */}
        {suggestions.length > 0 && (
          <View className="mt-4 items-end">
            <Text className="mb-2 self-end px-1 text-xs text-gray-400">Message suggestions:</Text>
            {suggestions.map((suggestion, index) => (
              <View key={index} className="mb-2 flex-row items-center self-end">
                {/* Dismiss button */}
                <TouchableOpacity
                  className="mr-2 h-6 w-6 items-center justify-center rounded-full bg-gray-100"
                  onPress={() => handleSuggestionDismiss(suggestion)}
                  activeOpacity={0.7}>
                  <Feather name="x" size={12} color="#666" />
                </TouchableOpacity>

                {/* Suggestion button */}
                <TouchableOpacity
                  className="rounded-3xl border border-gray-200 bg-white px-4 py-3"
                  onPress={() => handleSuggestionTap(suggestion)}
                  activeOpacity={0.7}>
                  <Text className="text-sm text-gray-500">{suggestion}</Text>
                </TouchableOpacity>
              </View>
            ))}
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
          onChangeText={handleMessageChange}
          returnKeyType="send"
          onSubmitEditing={(event) => {
            // Only send if it's a short message (single line behavior)
            if (message.trim() && message.length < 100) {
              event.preventDefault();
              handleSend();
            }
          }}
          blurOnSubmit={false}
        />
      )}
      {Platform.OS === 'ios' && renderIOSInputAccessoryView()}
    </View>
  );
}
