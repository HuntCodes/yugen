import React from 'react';
import { View, Dimensions, Text } from 'react-native';

import { colors } from '../../styles/colors';

interface WeeklyMileage {
  weekNumber: number;
  plannedMileage: number;
  actualMileage: number;
}

interface MileageGraphProps {
  weeklyData: WeeklyMileage[];
  preferredUnit: 'km' | 'mi';
  font: any; // Keep for compatibility but won't be used
}

export function MileageGraph({ weeklyData, preferredUnit, font }: MileageGraphProps) {
  const screenWidth = Dimensions.get('window').width;

  const convertMileage = (kilometers: number): number => {
    if (typeof kilometers !== 'number' || isNaN(kilometers)) return 0;
    return preferredUnit === 'mi' ? kilometers / 1.60934 : kilometers;
  };

  if (!weeklyData || weeklyData.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', height: 340 }}>
        <Text className="text-gray-500">No mileage data available.</Text>
      </View>
    );
  }

  // Calculate max value for Y-axis scaling
  const allPlannedValues = weeklyData.map((d) => convertMileage(d.plannedMileage));
  const maxValue = allPlannedValues.length > 0 ? Math.max(...allPlannedValues) : 0;

  // Determine the top tick value for the Y-axis - round up to next 10
  let topTickValue: number;
  if (maxValue === 0) {
    topTickValue = preferredUnit === 'mi' ? 30 : 50;
  } else {
    const roundingFactor = 10; // Always round to next 10 for both km and mi
    topTickValue = Math.ceil(maxValue / roundingFactor) * roundingFactor;
  }

  // Ensure minimum value
  if (maxValue > 0 && topTickValue < 10) {
    topTickValue = 10;
  }

  const yAxisLabelTexts = [];
  const stepValue = topTickValue / 4;
  for (let i = 0; i <= 4; i++) {
    const value = Math.round(i * stepValue);
    yAxisLabelTexts.push(`${value} ${preferredUnit === 'km' ? 'km' : 'mi'}`);
  }

  // Chart dimensions
  const yAxisLabelWidth = 50;
  const chartHeight = 220;
  const chartPadding = 20;

  return (
    <View className="rounded-lg bg-white p-4" style={{ minHeight: 330 }}>
      {/* Legend */}
      <View className="mb-6 flex-row items-center justify-center">
        <View className="mr-12 flex-row items-center">
          <View className="mr-3 h-3 w-3 rounded" style={{ backgroundColor: '#D1D5DB' }} />
          <Text className="text-text-primary font-medium">Planned</Text>
        </View>
        <View className="flex-row items-center">
          <View className="mr-3 h-3 w-3 rounded" style={{ backgroundColor: colors.success }} />
          <Text className="text-text-primary font-medium">Completed</Text>
        </View>
      </View>

      {/* Custom Bar Chart */}
      <View style={{ height: 280, paddingLeft: yAxisLabelWidth, paddingRight: chartPadding }}>
        {/* Y-axis labels and grid lines - positioned together */}
        <View className="absolute bottom-8 left-0 right-5 top-2" style={{ height: chartHeight }}>
          {yAxisLabelTexts.reverse().map((label, index) => {
            const positionRatio = index / (yAxisLabelTexts.length - 1);
            const topPosition = positionRatio * chartHeight - 6; // Subtract half text height for centering

            return (
              <View key={index}>
                {/* Y-axis label */}
                <View
                  className="absolute items-end pr-2"
                  style={{
                    width: yAxisLabelWidth,
                    top: topPosition,
                  }}>
                  <Text className="text-xs text-gray-600">{label}</Text>
                </View>

                {/* Grid line */}
                <View
                  className="absolute border-t border-gray-200"
                  style={{
                    left: yAxisLabelWidth + 2,
                    right: 0,
                    top: topPosition + 6, // Add back the offset for grid line
                    height: 1,
                  }}
                />
              </View>
            );
          })}
        </View>

        {/* Bars container - aligned with chart area */}
        <View className="absolute bottom-8 left-12 right-5 top-2" style={{ height: chartHeight }}>
          <View className="flex-1 flex-row items-end justify-between">
            {weeklyData.map((data, index) => {
              const plannedValue = convertMileage(data.plannedMileage);
              const actualValue = convertMileage(data.actualMileage);
              const barHeight = (plannedValue / topTickValue) * chartHeight;
              const actualHeight = (actualValue / topTickValue) * chartHeight;

              return (
                <View key={data.weekNumber} className="flex-1 items-center">
                  {/* Bar container - positioned relative to the chart baseline */}
                  <View
                    className="relative"
                    style={{ width: 32, height: barHeight > 0 ? barHeight : 2 }}>
                    {/* Background grey bar (planned) */}
                    <View
                      className="absolute bottom-0 w-full"
                      style={{
                        height: '100%',
                        backgroundColor: '#D1D5DB',
                        borderRadius: 4,
                      }}
                    />
                    {/* Green fill (actual) */}
                    {actualHeight > 0 && (
                      <View
                        className="absolute bottom-0 w-full"
                        style={{
                          height: `${Math.min(100, (actualHeight / Math.max(barHeight, 1)) * 100)}%`,
                          backgroundColor: colors.success,
                          borderRadius: 4,
                        }}
                      />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Week labels positioned closer to chart area */}
        <View className="absolute bottom-4 left-12 right-5" style={{ height: 20 }}>
          <View className="flex-row justify-between">
            {weeklyData.map((data, index) => (
              <View key={data.weekNumber} className="flex-1 items-center">
                <Text className="text-center text-xs text-gray-600">Week {data.weekNumber}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
