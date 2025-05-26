import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../../../../components/ui/StyledText';

interface SessionDetailsProps {
  distance: number;
  time: number;
  suggestedShoe?: string;
  description?: string;
}

/**
 * Component displaying detailed session information like distance, time, and gear
 */
export const SessionDetails: React.FC<SessionDetailsProps> = ({
  distance,
  time,
  suggestedShoe,
  description
}) => {
  return (
    <>
      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Distance:</Text>
          <Text style={styles.detailValue}>{distance}km</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Time:</Text>
          <Text style={styles.detailValue}>{time} min</Text>
        </View>
        {suggestedShoe && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Suggested Shoe:</Text>
            <Text style={styles.detailValue}>{suggestedShoe}</Text>
          </View>
        )}
      </View>
      
      {description && (
        <Text style={styles.description}>{description}</Text>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  detailsContainer: {
    marginBottom: 12,
    backgroundColor: '#F0ECEB',
    padding: 12,
    borderRadius: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280', // Secondary text color
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827', // Primary text color
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#6B7280', // Secondary text color
    marginBottom: 16,
  }
}); 