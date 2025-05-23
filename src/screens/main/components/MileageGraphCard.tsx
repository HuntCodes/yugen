import React from 'react';
import { View, Text } from 'react-native';
import { MileageGraph } from '../../../components/training/MileageGraph';
import { WeeklyMileage } from '../../../hooks/training/useMileageData';
import { SkFont } from '@shopify/react-native-skia';

interface MileageGraphCardProps {
  weeklyData: WeeklyMileage[];
  preferredUnit: 'km' | 'mi';
  font: SkFont | null;
}

export const MileageGraphCard: React.FC<MileageGraphCardProps> = ({ weeklyData, preferredUnit, font }) => {
  if (!weeklyData || weeklyData.length === 0) {
    return (
      <View className="bg-white rounded-lg p-4 shadow-sm items-center justify-center" style={{ height: 340 }}>
        <Text className="text-text-secondary">No mileage data for graph.</Text>
      </View>
    );
  }

  return (
    <View className="bg-white rounded-lg shadow-sm" style={{ minHeight: 340 }}>
      <MileageGraph 
        weeklyData={weeklyData} 
        preferredUnit={preferredUnit} 
        font={font}
      />
    </View>
  );
}; 