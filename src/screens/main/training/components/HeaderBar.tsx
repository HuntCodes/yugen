import React from 'react';
import { View, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Text } from '../../../../components/ui/StyledText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export interface HeaderBarProps {
  title: string;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ title }) => {
  // Fixed padding to match HomeScreen header
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#FBF7F6',
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 4,
    minHeight: 46,
  },
  headerTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: 'bold',
    color: '#333333',
  },
}); 