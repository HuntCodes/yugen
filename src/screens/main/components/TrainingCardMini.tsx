import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Text } from '../../../components/ui/StyledText';
import { TrainingSession, SessionStatus } from '../training/components/types';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../../../navigation/TabNavigator';
import { Feather } from '@expo/vector-icons';

interface TrainingCardMiniProps {
  sessions: TrainingSession[];
  onSessionUpdate?: (sessionId: string, updates: Partial<TrainingSession>) => void;
  navigation: BottomTabNavigationProp<TabParamList>;
}

export function TrainingCardMini({ 
  sessions = [], 
  onSessionUpdate, 
  navigation 
}: TrainingCardMiniProps) {
  // Scroll state & dimensions
  const [scrollX, setScrollX] = useState(0);
  const spacing = 16; // space between cards
  // Account for HomeScreen px-6 (24px) on both sides: total 48px
  const containerWidth = Dimensions.get('window').width - 48;
  // each card slightly narrower to reveal next card peek
  const cardWidth = containerWidth - spacing;
  // Filter and sort sessions to only show upcoming ones
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day

  const upcomingSessions = sessions
    .filter(session => {
      try {
        const sessionDate = new Date(session.date);
        sessionDate.setHours(0, 0, 0, 0); // Set to start of day
        return sessionDate >= today;
      } catch (err) {
        return false;
      }
    })
    .sort((a, b) => {
      try {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      } catch (err) {
        return 0;
      }
    });

  // Show up to 3 sessions in slider
  const displaySessions = upcomingSessions.slice(0, 3);

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } catch (err) {
      return dateString;
    }
  };

  // Get suggested shoe based on session type
  const getSuggestedShoe = (sessionType: string) => {
    const type = sessionType.toLowerCase();
    // Cloudmonster for easy runs, strength training, long runs
    if (type.includes('easy') || type.includes('strength') || type.includes('long')) {
      return 'Cloudmonster';
    }
    // Cloudboom Echo 4 for speed intervals, hills, fartlek
    else if (type.includes('interval') || type.includes('hill') || type.includes('fartlek') || type.includes('speed')) {
      return 'Cloudboom Echo 4';
    }
    // Default
    return 'Cloudmonster';
  };

  // Get status display information
  const getStatusInfo = (status?: string) => {
    switch (status) {
      case 'completed':
        return { text: 'Completed', bgColor: 'bg-green-100', textColor: 'text-green-800' };
      case 'skipped':
      case 'missed':
        return { text: 'Skipped', bgColor: 'bg-red-100', textColor: 'text-red-800' };
      case 'not_completed':
        return { text: 'Not completed', bgColor: 'bg-gray-100', textColor: 'text-gray-800' };
      default:
        return { text: 'Planned', bgColor: 'bg-gray-100', textColor: 'text-gray-800' };
    }
  };

  // Render an upcoming session
  const renderSession = (item: TrainingSession) => {
    const statusInfo = getStatusInfo(item.status);
    const suggestedShoe = item.suggested_shoe || getSuggestedShoe(item.session_type);
    
    return (
      <TouchableOpacity 
        key={item.id} 
        className="bg-white p-4 rounded-lg mb-4 shadow-sm relative"
        onPress={() => navigation.navigate('Training')}
      >
        <View className="flex-row justify-between items-center mb-2">
          <Text className="font-bold text-base">{item.session_type}</Text>
          <Text className="text-gray-600">{formatDate(item.date)}</Text>
        </View>
        
        <View className="flex-row mb-2">
          <Text className="bg-gray-100 px-2 py-1 rounded mr-2">{item.distance === null || item.distance === 0 ? '0km' : `${item.distance}km`}</Text>
          <Text className="bg-gray-100 px-2 py-1 rounded mr-2">{item.time === null || item.time === 0 ? '0 min' : `${item.time} min`}</Text>
          <Text className={`px-2 py-1 rounded ${statusInfo.bgColor} ${statusInfo.textColor}`}>
            {statusInfo.text}
          </Text>
        </View>
        
        {/* Fixed height container for notes with right padding to avoid arrow overlap */}
        <View className="h-[48px] mb-2 pr-12"> 
          <Text numberOfLines={2} className="text-gray-700 text-sm">
            {item.notes || ' '}
          </Text>
        </View>
        
        <View className="flex-row items-center">
          <Text className="text-xs text-gray-600 mr-1">Suggested shoe:</Text>
          <Text className="text-xs font-medium">{suggestedShoe}</Text>
        </View>

        {/* Right arrow indicator centered vertically */}
        <View style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }}>
          <Feather name="chevron-right" size={24} color="#C4C4C4" />
        </View>
      </TouchableOpacity>
    );
  };

  // Slider indicator rendering function
  const renderSliderIndicator = () => {
    const num = displaySessions.length;
    const segmentWidth = containerWidth / num;
    const pageWidth = cardWidth + spacing;
    // Calculate indicator left offset within container
    const left = Math.min(
      Math.max((scrollX / pageWidth) * segmentWidth, 0),
      containerWidth - segmentWidth
    );
    
    return (
      <View
        style={{
          height: 2,
          backgroundColor: '#E5E5E5',
          width: containerWidth,
          marginVertical: 8,
          position: 'relative',
        }}
      >
        <View
          style={{
            position: 'absolute',
            height: 2,
            backgroundColor: '#000',
            width: segmentWidth,
            left,
          }}
        />
      </View>
    );
  };

  // Main render
  if (displaySessions.length === 0) {
    return (
      <View className="pl-6 pr-0 pt-2 pb-2">
        <Text className="font-bold text-xl mb-3">Upcoming Sessions</Text>
        <Text className="text-gray-500 text-center py-4">No upcoming sessions.</Text>
      </View>
    );
  }

  return (
    <View className="pl-6 pr-0 pt-2" style={{ overflow: 'visible' }}>
      <Text className="font-bold text-xl mb-3">Upcoming Sessions</Text>
      
      <ScrollView
        horizontal
        snapToInterval={cardWidth + spacing}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={({ nativeEvent }) => setScrollX(nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
        style={{ overflow: 'visible' }}
        contentContainerStyle={{ paddingRight: spacing, overflow: 'visible' }}
      >
        {displaySessions.map(item => (
          <View key={item.id} style={{ width: cardWidth, marginRight: spacing }}>
            {renderSession(item)}
          </View>
        ))}
      </ScrollView>
      
      {displaySessions.length > 1 ? renderSliderIndicator() : null}
    </View>
  );
} 