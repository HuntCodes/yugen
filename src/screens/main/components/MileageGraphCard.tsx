import { SkFont } from '@shopify/react-native-skia';
import React from 'react';
import { View, Text } from 'react-native';

import { MileageGraph } from '../../../components/training/MileageGraph';
import { WeeklyMileage } from '../../../hooks/training/useMileageData';

interface MileageGraphCardProps {
  weeklyData: WeeklyMileage[];
  preferredUnit: 'km' | 'mi';
  font: SkFont | null;
}

export const MileageGraphCard: React.FC<MileageGraphCardProps> = ({
  weeklyData,
  preferredUnit,
  font,
}) => {
  if (!weeklyData || weeklyData.length === 0) {
    return (
      <View
        className="items-center justify-center rounded-lg bg-white p-4 shadow-sm"
        style={{ height: 340 }}>
        <Text className="text-text-secondary">No mileage data for graph.</Text>
      </View>
    );
  }

  return (
    <View className="rounded-lg bg-white shadow-sm" style={{ minHeight: 340 }}>
      <MileageGraph weeklyData={weeklyData} preferredUnit={preferredUnit} font={font} />
    </View>
  );
};
