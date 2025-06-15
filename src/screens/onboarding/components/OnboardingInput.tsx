import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Platform,
  InputAccessoryView,
  Keyboard,
  Text as RNText,
} from 'react-native';

interface OnboardingInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isTyping: boolean;
  showContinue?: boolean;
  planLoading: boolean;
  disabled?: boolean;
}

const inputAccessoryViewID = 'onboardingInputAccessory';

export function OnboardingInput({
  value,
  onChangeText,
  onSend,
  isTyping,
  showContinue = false,
  planLoading,
  disabled = false,
}: OnboardingInputProps) {
  const hiddenInputRef = useRef<TextInput>(null);
  const [isKeyboardVisibleForIOS, setIsKeyboardVisibleForIOS] = useState(false);
  const [isInputActivated, setIsInputActivated] = useState(false);

  // Handle keyboard visibility for iOS
  useEffect(() => {
    if (Platform.OS === 'ios') {
      const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () =>
        setIsKeyboardVisibleForIOS(true)
      );
      const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
        setIsKeyboardVisibleForIOS(false);
        setIsInputActivated(false); // Reset activation state when keyboard hides
      });

      return () => {
        keyboardDidShowListener.remove();
        keyboardDidHideListener.remove();
      };
    }
  }, []);

  // Dismiss keyboard and reset input when continue button should be shown
  useEffect(() => {
    if (showContinue) {
      Keyboard.dismiss();
      setIsInputActivated(false);
      setIsKeyboardVisibleForIOS(false);
    }
  }, [showContinue]);

  const handleSend = () => {
    if (value.trim() && !isTyping && !showContinue && !planLoading && !disabled) {
      onSend();
    }
  };

  const isInputDisabled = isTyping || showContinue || planLoading || disabled;

  // iOS Input Accessory View with expandable text input
  const renderIOSInputAccessoryView = () => (
    <InputAccessoryView nativeID={inputAccessoryViewID} style={{ backgroundColor: '#FFFFFF' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#F5F5F5',
          paddingHorizontal: 8,
          paddingVertical: 10,
        }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            backgroundColor: '#F5F5F5',
            borderRadius: 999,
            borderWidth: 2,
            borderColor: '#000',
            paddingHorizontal: 16,
            paddingVertical: 12,
            minHeight: 48,
            maxHeight: 120,
          }}>
          <TextInput
            style={{
              flex: 1,
              fontSize: 16,
              color: '#000000',
              minHeight: 24,
              maxHeight: 72,
              paddingVertical: 0,
              textAlignVertical: 'top',
              includeFontPadding: false,
            }}
            value={value}
            onChangeText={(text) => {
              if (text.length <= 500) {
                // 500 character limit
                onChangeText(text);
              }
            }}
            placeholder="Type a message..."
            placeholderTextColor="#757575"
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            editable={!isInputDisabled}
            autoFocus
          />
          <TouchableOpacity
            style={{
              marginLeft: 8,
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              opacity: !value.trim() || isInputDisabled ? 0.5 : 1,
            }}
            onPress={handleSend}
            disabled={!value.trim() || isInputDisabled}>
            <Ionicons
              name="send"
              size={20}
              color={value.trim() && !isInputDisabled ? '#000' : '#757575'}
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => Keyboard.dismiss()}
          style={{ paddingLeft: 12, paddingRight: 4, paddingVertical: 8 }}>
          <RNText style={{ color: '#007AFF', fontWeight: '600', fontSize: 16 }}>Done</RNText>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );

  // iOS Static Placeholder
  const renderIOSStaticPlaceholder = () => (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 999,
        borderWidth: 2,
        borderColor: '#000',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginRight: 8,
        flex: 1,
        opacity: isInputDisabled ? 0.6 : 1,
      }}
      onPress={() => {
        if (!isInputDisabled) {
          setIsInputActivated(true); // Hide placeholder immediately
          setTimeout(() => {
            hiddenInputRef.current?.focus();
          }, 50);
        }
      }}
      activeOpacity={0.8}
      disabled={isInputDisabled}>
      <RNText
        style={{
          flex: 1,
          fontSize: 16,
          color: '#757575',
          includeFontPadding: false,
        }}
        numberOfLines={1}>
        Type a message...
      </RNText>
      <View
        style={{
          marginLeft: 8,
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name="send" size={20} color="#757575" />
      </View>
    </TouchableOpacity>
  );

  // Android Input (non-expandable)
  const renderAndroidInput = () => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 999,
        borderWidth: 2,
        borderColor: '#000',
        paddingHorizontal: 16,
        paddingVertical: 12,
        flex: 1,
      }}>
      <TextInput
        style={{
          flex: 1,
          color: '#000000',
          fontSize: 16,
          height: 24,
          paddingVertical: 0,
          textAlignVertical: 'center',
          includeFontPadding: false,
        }}
        placeholder="Type a message..."
        placeholderTextColor="#757575"
        value={value}
        onChangeText={(text) => {
          if (text.length <= 500) {
            // 500 character limit
            onChangeText(text);
          }
        }}
        onSubmitEditing={handleSend}
        returnKeyType="send"
        editable={!isInputDisabled}
        multiline={false}
        maxLength={500}
      />
      <TouchableOpacity
        style={{
          marginLeft: 8,
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: !value.trim() || isInputDisabled ? 0.5 : 1,
        }}
        onPress={handleSend}
        disabled={!value.trim() || isInputDisabled}>
        <Ionicons
          name="send"
          size={20}
          color={value.trim() && !isInputDisabled ? '#000' : '#757575'}
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <View>
      {/* Only show the input container when keyboard is hidden on iOS or when on Android */}
      {(Platform.OS === 'ios' && !isKeyboardVisibleForIOS && !isInputActivated) ||
      Platform.OS === 'android' ? (
        <View
          style={{
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: '#F5F5F5',
            backgroundColor: 'white',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            {Platform.OS === 'ios' && !isKeyboardVisibleForIOS && renderIOSStaticPlaceholder()}
            {Platform.OS === 'android' && renderAndroidInput()}
          </View>
        </View>
      ) : null}

      {/* Hidden TextInput for iOS to trigger the accessory view */}
      {Platform.OS === 'ios' && (
        <TextInput
          ref={hiddenInputRef}
          style={{ position: 'absolute', top: -9999, left: -9999, width: 1, height: 1, opacity: 0 }}
          inputAccessoryViewID={inputAccessoryViewID}
          value={value}
          onChangeText={onChangeText}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
      )}

      {/* Render the iOS Input Accessory View */}
      {Platform.OS === 'ios' && renderIOSInputAccessoryView()}
    </View>
  );
}
