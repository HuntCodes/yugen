import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

import { Text } from '../../../../../components/ui/StyledText';
import { colors } from '../../../../../styles/colors';

// Define session status type
type AppSessionStatus = 'completed' | 'missed' | 'planned' | 'not_completed' | 'skipped';

interface SessionStatusControlsProps {
  status: AppSessionStatus;
  isUpdating: boolean;
  onStatusUpdate: (status: AppSessionStatus) => void;
}

/**
 * Component for handling session status updates (completed, skipped)
 */
export const SessionStatusControls: React.FC<SessionStatusControlsProps> = ({
  status,
  isUpdating,
  onStatusUpdate,
}) => {
  return (
    <View style={styles.statusButtons}>
      <TouchableOpacity
        style={[
          styles.statusButton,
          styles.completedButton,
          status === 'completed' && styles.completedButtonActive,
        ]}
        disabled={isUpdating}
        onPress={() => onStatusUpdate('completed')}>
        <Text
          style={[
            styles.statusButtonText,
            status === 'completed' && styles.statusButtonTextActive,
          ]}>
          Completed
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.statusButton,
          styles.skippedButton,
          status === 'skipped' && styles.skippedButtonActive,
        ]}
        disabled={isUpdating}
        onPress={() => onStatusUpdate('skipped')}>
        <Text
          style={[styles.statusButtonText, status === 'skipped' && styles.statusButtonTextActive]}>
          Skipped
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  statusButtons: {
    flexDirection: 'row',
    marginVertical: 12,
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#F0ECEB',
    alignItems: 'center',
  },
  completedButton: {
    // Default style
  },
  skippedButton: {
    // Default style
  },
  completedButtonActive: {
    backgroundColor: colors.success,
  },
  skippedButtonActive: {
    backgroundColor: colors.error,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
});
