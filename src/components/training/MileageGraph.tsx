import React from 'react';
import { View, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '../../styles/colors';

interface WeeklyMileage {
  weekNumber: number;
  plannedMileage: number;
  actualMileage: number;
}

interface MileageGraphProps {
  weeklyData: WeeklyMileage[];
  preferredUnit: 'km' | 'mi';
}

export function MileageGraph({ weeklyData, preferredUnit }: MileageGraphProps) {
  // Calculate chart width by subtracting wrapper (16px each side) and container padding (16px each side) = 64px total
  const screenWidth = Dimensions.get('window').width - 64;

  // Convert mileage between units if needed (data comes in as kilometers)
  const convertMileage = (kilometers: number) => {
    return preferredUnit === 'mi' ? kilometers / 1.60934 : kilometers;
  };

  // Prepare data for the chart
  const labels = weeklyData.map(data => `Week ${data.weekNumber}`);
  const plannedData = weeklyData.map(data => convertMileage(data.plannedMileage));
  const actualData = weeklyData.map(data => convertMileage(data.actualMileage));

  const chartData = {
    labels,
    datasets: [
      {
        data: plannedData,
        color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        strokeWidth: 2,
        withDots: false,
        withDashedLines: true,
        dashWidth: 4,
        dashGap: 4,
      },
      {
        data: actualData,
        color: (opacity = 1) => `rgba(0, 200, 0, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ['Planned', 'Actual'],
  };

  const chartConfig = {
    backgroundColor: colors.background,
    backgroundGradientFrom: colors.background,
    backgroundGradientTo: colors.background,
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 8,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: colors.primary,
    },
    propsForLabels: {
      fontSize: 12,
    },
  };

  return (
    <View style={{
      backgroundColor: colors.background,
      padding: 16,
      borderRadius: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    }}>
      <LineChart
        data={chartData}
        width={screenWidth}
        height={220}
        chartConfig={chartConfig}
        bezier
        style={{ marginVertical: 8, borderRadius: 8, backgroundColor: colors.background }}
        withDots={true}
        withInnerLines={true}
        withOuterLines={true}
        withVerticalLines={true}
        withHorizontalLines={true}
        withVerticalLabels={true}
        withHorizontalLabels={true}
        yAxisLabel=""
        yAxisSuffix={` ${preferredUnit}`}
        yAxisInterval={1}
      />
    </View>
  );
} 