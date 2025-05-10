import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../../../../components/ui/StyledText';

interface SessionHeaderProps {
  displayDate: string;
  sessionType: string;
  isModified: boolean;
  typeColor: string;
  formattedDate: string;
}

/**
 * Header component for the session card with date and type badges
 */
export const SessionHeader: React.FC<SessionHeaderProps> = ({
  displayDate,
  sessionType,
  isModified,
  typeColor,
  formattedDate
}) => {
  return (
    <View style={styles.header}>
      <Text style={styles.date}>{formattedDate}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {isModified && (
          <View style={[styles.badge, { backgroundColor: '#FFB020', marginRight: 8 }]}>
            <Text style={styles.badgeText}>Modified</Text>
          </View>
        )}
        <View style={[styles.badge, { backgroundColor: typeColor }]}>
          <Text style={styles.badgeText}>{sessionType}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  date: {
    fontSize: 14,
    color: '#6B7280', // Secondary text color
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  }
}); 