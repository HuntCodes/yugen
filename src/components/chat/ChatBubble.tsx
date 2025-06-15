import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

import { ChatMessage } from '../../types/chat';

interface ChatBubbleProps {
  message: ChatMessage;
  coach?: { id: string; name: string } | null;
  imageMap?: Record<string, any>;
  style?: 'default' | 'clean';
  customStyles?: {
    container?: any;
    userBubble?: any;
    coachBubble?: any;
    userText?: any;
    coachText?: any;
    nameText?: any;
    avatar?: any;
  };
}

/**
 * A reusable chat bubble component that displays messages from the coach or user.
 *
 * @param message The message object to display
 * @param coach Optional coach information (required when messages include coach sender)
 * @param imageMap Optional map of coach IDs to avatar images
 * @param style Style variant to use ('default' or 'clean')
 * @param customStyles Optional custom styles to override defaults
 */
export function ChatBubble({
  message,
  coach,
  imageMap,
  style = 'default',
  customStyles = {},
}: ChatBubbleProps) {
  // Helper to check if we have valid coach info for avatar
  const hasCoachInfo = coach?.id && imageMap && imageMap[coach.id];

  if (message.sender === 'coach') {
    // COACH MESSAGE
    return (
      <View style={[styles.coachContainer, customStyles.container]}>
        {/* Only show avatar in default style with valid coach info */}
        {style === 'default' && hasCoachInfo && (
          <Image
            source={imageMap[coach.id]}
            style={[styles.avatar, customStyles.avatar]}
            resizeMode="cover"
          />
        )}

        <View style={{ flex: 1 }}>
          {/* Only show name in default style */}
          {style === 'default' && (
            <Text style={[styles.nameText, customStyles.nameText]}>{coach?.name || 'Coach'}</Text>
          )}

          <View style={[styles.coachBubble, customStyles.coachBubble]}>
            <Text style={[styles.coachText, customStyles.coachText]}>{message.message}</Text>
          </View>
        </View>
      </View>
    );
  } else {
    // USER MESSAGE
    return (
      <View style={[styles.userContainer, customStyles.container]}>
        <View style={[styles.userBubble, customStyles.userBubble]}>
          <Text style={[styles.userText, customStyles.userText]}>{message.message}</Text>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  // Coach message styles
  coachContainer: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E5EB',
  },
  nameText: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 4,
    fontWeight: '500',
  },
  coachBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    maxWidth: '85%',
  },
  coachText: {
    color: '#000000',
    lineHeight: 20,
  },

  // User message styles
  userContainer: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  userBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
    borderRadius: 16,
    maxWidth: '85%',
  },
  userText: {
    color: 'white',
    lineHeight: 20,
  },
});
