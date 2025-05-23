import React from 'react';
import { View, Dimensions, Text } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
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

  // Convert data for gifted-charts - planned mileage as primary data
  const plannedData = weeklyData.map((data, index) => ({
    value: convertMileage(data.plannedMileage),
    label: `Week ${data.weekNumber}`,
  }));

  // Actual mileage as secondary data
  const actualData = weeklyData.map((data, index) => ({
    value: convertMileage(data.actualMileage),
  }));

  console.log('[MileageGraph] plannedData:', JSON.stringify(plannedData, null, 2));
  console.log('[MileageGraph] actualData:', JSON.stringify(actualData, null, 2));

  // Calculate max value for Y-axis scaling
  const allValues = [...plannedData.map(d => d.value), ...actualData.map(d => d.value)];
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0;

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

  // Chart dimensions with proper spacing for labels and better space utilization
  const yAxisLabelWidth = 50; // Space for y-axis labels
  const rightPadding = 0; // Increased padding to accommodate full "Week X" label width
  const leftPadding = 20; // Padding on the left for Week 1 label visibility
  const chartWidth = screenWidth - 110; // Reduced chart width to prevent spillover naturally
  const chartHeight = 220;
  
  // Better spacing calculation to prevent cramped labels
  const availableWidth = chartWidth - yAxisLabelWidth - leftPadding - rightPadding;
  const minSpacing = 60; // Minimum spacing to prevent cramped labels
  const idealSpacing = weeklyData.length > 1 ? availableWidth / (weeklyData.length - 1) : minSpacing;
  const spacing = Math.max(minSpacing, idealSpacing);
  
  // Set Week 1 at x=0 with padding for label visibility
  const initialSpacing = leftPadding;

  return (
    <View className="bg-white rounded-lg p-4" style={{ minHeight: 330 }}>
      {/* Legend */}
      <View className="flex-row justify-center items-center mb-6">
        <View className="flex-row items-center mr-12">
          <View 
            className="w-3 h-3 rounded-full mr-3" 
            style={{ backgroundColor: colors.primary }}
          />
          <Text className="text-text-primary font-medium">Planned</Text>
        </View>
        <View className="flex-row items-center">
          <View 
            className="w-3 h-3 rounded-full mr-3" 
            style={{ backgroundColor: colors.success }}
          />
          <Text className="text-text-primary font-medium">Actual</Text>
        </View>
      </View>

      {/* Single Chart with both data series */}
      <View style={{ height: 260 }}>
        <LineChart
          data={plannedData}
          data2={actualData}
          height={chartHeight}
          width={chartWidth}
          initialSpacing={initialSpacing}
          spacing={spacing}
          endSpacing={rightPadding}
          
          // Y-axis configuration
          maxValue={topTickValue}
          noOfSections={4}
          yAxisLabelTexts={yAxisLabelTexts}
          yAxisLabelWidth={yAxisLabelWidth}
          yAxisColor={colors.text.secondary}
          yAxisThickness={1}
          yAxisTextStyle={{
            color: colors.text.secondary,
            fontSize: 12,
            paddingRight: 8, // Add padding between labels and axis line
          }}
          
          // X-axis configuration
          xAxisColor={colors.text.secondary}
          xAxisThickness={1}
          xAxisLabelTextStyle={{
            color: colors.text.secondary,
            fontSize: 12,
            textAlign: 'center',
          }}
          
          // Grid lines
          rulesType="solid"
          rulesColor="#f3f4f6"
          
          // Planned line styling (primary data)
          color={colors.primary}
          thickness={2.5}
          curved={true}
          areaChart={true}
          startFillColor={colors.primary}
          endFillColor={colors.primary}
          startOpacity={0.15}
          endOpacity={0.05}
          dataPointsColor={colors.primary}
          dataPointsRadius={4}
          
          // Actual line styling (secondary data) - only basic properties
          color2={colors.success}
          thickness2={2.5}
          dataPointsColor2={colors.success}
          dataPointsRadius2={4}
          
          // Additional styling
          backgroundColor="transparent"
          hideDataPoints={false}
          hideDataPoints2={false}
          
          // Animation
          animateOnDataChange={true}
          animationDuration={800}
        />
      </View>
    </View>
  );
} 