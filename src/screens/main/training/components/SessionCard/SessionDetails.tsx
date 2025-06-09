import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';

import { Text } from '../../../../../components/ui/StyledText';
import { getProductIdFromShoeName } from '../../../../../lib/utils/training/shoeRecommendations';
import { TabParamList } from '../../../../../navigation/TabNavigator';

interface SessionDetailsProps {
  distance: number;
  time: number;
  suggestedShoe?: string;
  suggestedLocation?: string;
  description?: string;
}

/**
 * Component displaying detailed session information like distance, time, and gear
 */
export const SessionDetails: React.FC<SessionDetailsProps> = ({
  distance,
  time,
  suggestedShoe,
  suggestedLocation,
  description,
}) => {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();

  // Handle shoe recommendation click
  const handleShoeClick = (shoeName: string) => {
    const productId = getProductIdFromShoeName(shoeName);
    if (productId) {
      navigation.navigate('Gear', { highlightProductId: productId });
    }
  };

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
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Suggested Shoe:</Text>
          <TouchableOpacity onPress={() => handleShoeClick(suggestedShoe || '')}>
            <Text style={[styles.detailValue, styles.clickableShoe]}>
              {suggestedShoe || 'None'}
            </Text>
          </TouchableOpacity>
        </View>
        {suggestedLocation && (
          <View style={styles.locationRow}>
            <Text style={styles.detailLabel}>Suggested Location:</Text>
            <Text style={styles.locationValue} numberOfLines={2}>
              {suggestedLocation}
            </Text>
          </View>
        )}
      </View>

      {description && <Text style={styles.description}>{description}</Text>}
    </>
  );
};

const styles = StyleSheet.create({
  detailsContainer: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    flexWrap: 'wrap',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  locationValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
    textAlign: 'right',
  },
  clickableShoe: {
    color: '#2563eb', // Blue color
    textDecorationLine: 'underline',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
});
