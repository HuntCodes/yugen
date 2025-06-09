import React from 'react';
import { View } from 'react-native';

import { Button } from '../../../components/ui/Button';

interface ActionButtonsProps {
  onViewTrainingPlan: () => void;
  onSignOut: () => void;
}

export function ActionButtons({ onViewTrainingPlan, onSignOut }: ActionButtonsProps) {
  return (
    <View
      style={{
        padding: 16,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#F0ECEB',
      }}>
      <Button
        title="View Training Plan"
        variant="primary"
        onPress={onViewTrainingPlan}
        fullWidth
        style={{ marginBottom: 12 }}
      />

      <Button title="Sign Out" variant="outline" onPress={onSignOut} fullWidth />
    </View>
  );
}
