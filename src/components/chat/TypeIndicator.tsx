import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface TypeIndicatorProps {
  senderName?: string;
  coachId?: string;
  coachName?: string;
  imageMap?: Record<string, any>;
  style?: 'minimal' | 'withAvatar';
  customStyles?: {
    container?: any;
    text?: any;
    avatar?: any;
    bubbleContainer?: any;
    dotsContainer?: any;
    dot?: any;
  };
}

/**
 * A reusable component that shows a typing indicator for chat messages.
 * 
 * @param senderName Optional name of the sender to display (used in minimal mode)
 * @param coachId Optional coach ID to display the avatar image (required for withAvatar mode)
 * @param coachName Optional coach name to display (used in withAvatar mode)
 * @param imageMap Map of coach IDs to avatar images (required for withAvatar mode)
 * @param style Style variant to use ('minimal' or 'withAvatar')
 * @param customStyles Optional custom styles to override defaults
 */
export function TypeIndicator({ 
  senderName = 'Coach', 
  coachId,
  coachName,
  imageMap,
  style = 'minimal',
  customStyles = {}
}: TypeIndicatorProps) {
  // If withAvatar style is used but no coach data provided, fall back to minimal
  const useMinimalStyle = style === 'minimal' || !coachId || !imageMap;
  
  if (useMinimalStyle) {
    return (
      <View style={[styles.minimalContainer, customStyles.container]}>
        <View style={[styles.minimalBubble, customStyles.bubbleContainer]}>
          <Text style={[styles.minimalText, customStyles.text]}>
            {senderName || 'Coach'} is typing...
          </Text>
        </View>
      </View>
    );
  } else {
    // withAvatar style
    return (
      <View style={[styles.avatarContainer, customStyles.container]}>
        <Image
          source={imageMap?.[coachId]}
          style={[styles.avatar, customStyles.avatar]}
          resizeMode="cover"
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.nameText, customStyles.text]}>
            {coachName || senderName || 'Coach'}
          </Text>
          <View style={[styles.bubbleContainer, customStyles.bubbleContainer]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.typingText, customStyles.text]}>Typing</Text>
              <View style={[styles.dotsContainer, customStyles.dotsContainer]}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.dot, customStyles.dot]} />
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  // Minimal style (previously in components/chat/TypeIndicator)
  minimalContainer: {
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  minimalBubble: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    maxWidth: '60%',
  },
  minimalText: {
    color: '#757575',
  },
  
  // With avatar style (previously in screens/*/TypeIndicator)
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E5EB'
  },
  nameText: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 4,
    fontWeight: '500',
  },
  bubbleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
  },
  typingText: {
    color: '#757575',
    marginRight: 8,
  },
  dotsContainer: {
    flexDirection: 'row',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#757575',
    marginHorizontal: 2,
  },
}); 