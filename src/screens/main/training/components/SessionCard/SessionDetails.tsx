import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '../../../../../components/ui/StyledText';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../../../../../navigation/TabNavigator';
import { getProductIdFromShoeName } from '../../../../../lib/utils/training/shoeRecommendations';

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
        {suggestedShoe && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Suggested Shoe:</Text>
            <TouchableOpacity onPress={() => handleShoeClick(suggestedShoe)}>
              <Text style={[styles.detailValue, styles.clickableShoe]}>{suggestedShoe}</Text>
            </TouchableOpacity>
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
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
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