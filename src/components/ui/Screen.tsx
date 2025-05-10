import React from 'react';
import { View, SafeAreaView, ScrollView, ViewStyle, StyleProp, Platform, KeyboardAvoidingView } from 'react-native';

interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  className?: string;
  contentClassName?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
}

/**
 * A reusable screen layout component that handles safe areas and keyboard avoiding
 */
export function Screen({
  children,
  scrollable = false,
  className = '',
  contentClassName = '',
  style = {},
  contentStyle = {},
  keyboardVerticalOffset = 0
}: ScreenProps) {

  const InnerComponent = scrollable ? ScrollView : View;

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: '#FFFFFF' }, style]} className={`relative ${className}`}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {scrollable ? (
          <ScrollView
            style={[{ flex: 1 }, contentStyle]}
            className={`font-sans ${contentClassName}`}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View 
            style={[{ flex: 1 }, contentStyle]} 
            className={`font-sans ${contentClassName}`}
          >
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
} 