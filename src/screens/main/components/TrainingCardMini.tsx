import { Feather } from '@expo/vector-icons';
import { LocalDate, ZoneId } from '@js-joda/core';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, Dimensions } from 'react-native';

import { Text } from '../../../components/ui/StyledText';
import {
  getSuggestedShoe,
  getProductIdFromShoeName,
} from '../../../lib/utils/training/shoeRecommendations';
import type { TabParamList } from '../../../navigation/TabNavigator';
import { WeatherForecast, getWeatherDescription } from '../../../services/weather/weatherService';
import { TrainingSession, SessionStatus } from '../training/components/types';

import '@js-joda/timezone';

interface TrainingCardMiniProps {
  sessions: TrainingSession[];
  onSessionUpdate?: (sessionId: string, updates: Partial<TrainingSession>) => void;
  navigation: BottomTabNavigationProp<TabParamList>;
  weatherData?: WeatherForecast | null;
}

export function TrainingCardMini({
  sessions = [],
  onSessionUpdate,
  navigation,
  weatherData,
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
  today.setHours(0, 0, 0, 0); // Set to start of day for timezone-aware comparison

  const upcomingSessions = sessions
    .filter((session) => {
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
        day: 'numeric',
      });
    } catch (err) {
      return dateString;
    }
  };

  // Handle shoe recommendation click
  const handleShoeClick = (shoeName: string) => {
    const productId = getProductIdFromShoeName(shoeName);
    if (productId) {
      navigation.navigate('Gear', { highlightProductId: productId });
    }
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

  // Format weather information for a specific session date
  const formatWeatherInfo = (sessionDateString: string) => {
    if (!weatherData) return null;

    try {
      // Use js-joda for proper timezone handling
      const systemZone = ZoneId.systemDefault();
      const today = LocalDate.now(systemZone);

      // Extract just the date part from the session date string (in case it's a full ISO datetime)
      const sessionDateOnly = sessionDateString.split('T')[0]; // Extract YYYY-MM-DD part

      // Parse session date as LocalDate
      const sessionLocalDate = LocalDate.parse(sessionDateOnly);

      // Calculate days difference
      const diffDays = sessionLocalDate.toEpochDay() - today.toEpochDay();

      // Determine the day label
      let dayLabel: string;
      if (diffDays === 0) {
        dayLabel = "Today's";
      } else if (diffDays === 1) {
        dayLabel = "Tomorrow's";
      } else if (diffDays > 1 && diffDays <= 7) {
        // Convert to JavaScript Date for weekday formatting
        const jsDate = new Date(
          sessionLocalDate.year(),
          sessionLocalDate.monthValue() - 1,
          sessionLocalDate.dayOfMonth()
        );
        dayLabel = `${jsDate.toLocaleDateString('en-US', { weekday: 'long' })}'s`;
      } else {
        // For sessions more than 7 days out, we don't show weather
        return null;
      }

      // Filter hourly data for the session date
      // The weather API returns times in the user's timezone, so we can compare date strings
      const sessionDateString_YYYY_MM_DD = sessionLocalDate.toString(); // YYYY-MM-DD format

      const sessionDayWeather = weatherData.hourly.filter((hour) => {
        // Extract just the date part from the ISO datetime string
        const hourDateString = hour.time.split('T')[0]; // YYYY-MM-DD
        return hourDateString === sessionDateString_YYYY_MM_DD;
      });

      if (sessionDayWeather.length === 0) {
        // No weather data available for this date
        return `${dayLabel} weather: Check closer to your session`;
      }

      // Get temperature range for the day
      const temperatures = sessionDayWeather.map((h) => h.temperature);
      const minTemp = Math.min(...temperatures);
      const maxTemp = Math.max(...temperatures);

      // Check for rain during the day
      const hasRainExpected = sessionDayWeather.some(
        (hour) =>
          (hour.weatherCode >= 51 && hour.weatherCode <= 67) || // Rain/drizzle
          (hour.weatherCode >= 80 && hour.weatherCode <= 82) // Rain showers
      );

      let weatherText = `${dayLabel} weather: ${minTemp}-${maxTemp}°`;

      if (hasRainExpected) {
        // Find when rain is expected
        const rainHours = sessionDayWeather.filter(
          (hour) =>
            (hour.weatherCode >= 51 && hour.weatherCode <= 67) ||
            (hour.weatherCode >= 80 && hour.weatherCode <= 82)
        );

        if (rainHours.length > 0) {
          const firstRainHour = new Date(rainHours[0].time);
          const lastRainHour = new Date(rainHours[rainHours.length - 1].time);

          if (rainHours.length >= 6) {
            // Rain for most of the day
            weatherText += ', rain expected';
          } else {
            // Rain during specific time period
            const startTime = firstRainHour.getHours();
            const endTime = lastRainHour.getHours();

            // Helper function to format time in 12-hour format
            const formatTime = (hour: number) => {
              if (hour === 0) return '12am';
              if (hour === 12) return '12pm';
              if (hour < 12) return `${hour}am`;
              return `${hour - 12}pm`;
            };

            let timeOfDay: string;
            if (endTime <= 12) {
              timeOfDay = 'morning';
            } else if (startTime >= 17) {
              timeOfDay = 'evening';
            } else if (startTime >= 12 && endTime <= 17) {
              timeOfDay = 'afternoon';
            } else {
              timeOfDay = `${formatTime(startTime)}-${formatTime(endTime)}`;
            }

            // Only add "range" for specific time ranges, not general time periods
            if (timeOfDay.includes('-')) {
              weatherText += `, rain in the ${timeOfDay} range`;
            } else {
              weatherText += `, rain in the ${timeOfDay}`;
            }
          }
        }
      } else {
        // Check general conditions
        const mostCommonWeatherCode =
          sessionDayWeather
            .map((h) => h.weatherCode)
            .sort(
              (a, b) =>
                sessionDayWeather.filter((h) => h.weatherCode === a).length -
                sessionDayWeather.filter((h) => h.weatherCode === b).length
            )
            .pop() || 0;

        const description = getWeatherDescription(mostCommonWeatherCode).toLowerCase();

        // Add weather description to temperature
        if (description.includes('clear') || description.includes('sunny')) {
          weatherText += ', clear and sunny';
        } else if (description.includes('partly cloudy')) {
          weatherText += ', partly cloudy';
        } else if (description.includes('overcast') || description.includes('cloudy')) {
          weatherText += ', cloudy';
        } else if (description.includes('fog')) {
          weatherText += ', foggy';
        } else if (description.includes('wind')) {
          weatherText += ', windy';
        } else {
          // For any other condition, add the description
          weatherText += `, ${description}`;
        }
      }

      return weatherText;
    } catch (error) {
      console.error('Error formatting weather info:', error);
      return null;
    }
  };

  // Render an upcoming session
  const renderSession = (item: TrainingSession) => {
    const statusInfo = getStatusInfo(item.status);
    const suggestedShoe = item.suggested_shoe || getSuggestedShoe(item.session_type);
    const weatherInfo = formatWeatherInfo(item.date);

    return (
      <TouchableOpacity
        key={item.id}
        className="relative mb-4 rounded-lg bg-white p-4 shadow-sm"
        onPress={() => navigation.navigate('Training')}>
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-base font-bold">{item.session_type}</Text>
          <Text className="text-gray-600">{formatDate(item.date)}</Text>
        </View>

        <View className="mb-2 flex-row">
          <Text className="mr-2 rounded bg-gray-100 px-2 py-1">
            {item.distance === null || item.distance === 0 ? '0km' : `${item.distance}km`}
          </Text>
          <Text className="mr-2 rounded bg-gray-100 px-2 py-1">
            {item.time === null || item.time === 0 ? '0 min' : `${item.time} min`}
          </Text>
          <Text className={`rounded px-2 py-1 ${statusInfo.bgColor} ${statusInfo.textColor}`}>
            {statusInfo.text}
          </Text>
        </View>

        {/* Fixed height container for notes with right padding to avoid arrow overlap */}
        <View className="mb-2 h-[48px] pr-12">
          <Text numberOfLines={2} className="text-sm text-gray-700">
            {item.notes || ' '}
          </Text>
        </View>

        {/* Weather information */}
        {weatherInfo && (
          <View className="mb-2">
            <Text className="text-xs text-gray-600">{weatherInfo}</Text>
          </View>
        )}

        {/* Location suggestion */}
        {item.suggested_location && (
          <View className="mb-2">
            <Text className="text-xs text-gray-600" style={{ flexWrap: 'wrap' }}>
              Suggested Location: {item.suggested_location}
            </Text>
          </View>
        )}

        {suggestedShoe && (
          <View className="flex-row items-center">
            <Text className="mr-1 text-xs text-gray-600">Suggested shoe:</Text>
            <TouchableOpacity onPress={() => handleShoeClick(suggestedShoe)}>
              <Text className="text-xs font-medium text-blue-600">{suggestedShoe}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Right arrow indicator centered vertically */}
        <View
          style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }}>
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
        }}>
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
      <View className="pb-2 pl-6 pr-0 pt-2">
        <Text className="mb-3 text-xl font-bold">Upcoming Sessions</Text>
        <Text className="py-4 text-center text-gray-500">No upcoming sessions.</Text>
      </View>
    );
  }

  return (
    <View className="pl-6 pr-0 pt-2" style={{ overflow: 'visible' }}>
      <Text className="mb-3 text-xl font-bold">Upcoming Sessions</Text>

      <ScrollView
        horizontal
        snapToInterval={cardWidth + spacing}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={({ nativeEvent }) => setScrollX(nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
        style={{ overflow: 'visible' }}
        contentContainerStyle={{ paddingRight: spacing, overflow: 'visible' }}>
        {displaySessions.map((item) => (
          <View key={item.id} style={{ width: cardWidth, marginRight: spacing }}>
            {renderSession(item)}
          </View>
        ))}
      </ScrollView>

      {displaySessions.length > 1 ? renderSliderIndicator() : null}
    </View>
  );
}
