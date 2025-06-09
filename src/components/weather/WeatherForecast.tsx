import { Feather } from '@expo/vector-icons';
import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';

import {
  WeatherData,
  getWeatherDescription,
  getWeatherIcon,
} from '../../services/weather/weatherService';
import { Text } from '../ui/StyledText';

interface WeatherForecastProps {
  current: WeatherData;
  hourly: WeatherData[];
  onRefresh: () => void;
  isLoading?: boolean;
}

export function WeatherForecast({ current, hourly, onRefresh, isLoading }: WeatherForecastProps) {
  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true,
    });
  };

  const formatTemperature = (temp: number) => {
    return `${temp}°`;
  };

  const isCurrentHour = (timeString: string) => {
    const weatherTime = new Date(timeString);
    const now = new Date();

    return (
      weatherTime.getFullYear() === now.getFullYear() &&
      weatherTime.getMonth() === now.getMonth() &&
      weatherTime.getDate() === now.getDate() &&
      weatherTime.getHours() === now.getHours()
    );
  };

  const getRelevantHourlyForecast = () => {
    const now = new Date();
    const currentHour = now.getHours();

    const currentHourIndex = hourly.findIndex((hour) => {
      const hourTime = new Date(hour.time);
      return hourTime.getHours() === currentHour && hourTime.getDate() === now.getDate();
    });

    const startIndex = currentHourIndex >= 0 ? currentHourIndex : 0;

    return hourly.slice(startIndex, startIndex + 12);
  };

  const relevantHourlyData = getRelevantHourlyForecast();

  return (
    <View className="mb-4 rounded-lg bg-white shadow-sm">
      {/* Header with current weather */}
      <View className="flex-row items-center justify-between border-b border-gray-100 p-4">
        <View className="flex-row items-center">
          <View className="mr-3">
            <Feather name={getWeatherIcon(current.weatherCode) as any} size={28} color="#374151" />
          </View>
          <View>
            <Text className="text-lg font-semibold">{formatTemperature(current.temperature)}</Text>
            <Text className="text-sm text-gray-600">
              {getWeatherDescription(current.weatherCode)}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center">
          <View className="mr-4">
            <Text className="text-xs text-gray-500">Wind</Text>
            <Text className="text-sm font-medium">{current.windSpeed} km/h</Text>
          </View>
          <View className="mr-3">
            <Text className="text-xs text-gray-500">Humidity</Text>
            <Text className="text-sm font-medium">{current.humidity}%</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} className="p-1" disabled={isLoading}>
            <Feather name="refresh-cw" size={16} color={isLoading ? '#9CA3AF' : '#6B7280'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hourly forecast slider */}
      <View className="py-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-2"
          contentContainerStyle={{ paddingHorizontal: 8 }}>
          {relevantHourlyData.map((hour, index) => {
            const isNow = isCurrentHour(hour.time);

            return (
              <View
                key={hour.time}
                className="mx-2 min-w-[60px] items-center rounded-lg bg-gray-100 px-3 py-2">
                <Text className="mb-1 text-xs text-gray-600">
                  {isNow ? 'Now' : formatTime(hour.time)}
                </Text>
                <View className="mb-1">
                  <Feather
                    name={getWeatherIcon(hour.weatherCode) as any}
                    size={20}
                    color="#374151"
                  />
                </View>
                <Text className="text-sm font-medium">{formatTemperature(hour.temperature)}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
