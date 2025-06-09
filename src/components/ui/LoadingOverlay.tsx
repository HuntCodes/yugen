import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';

import { MinimalSpinner } from './MinimalSpinner';

// Get screen dimensions
const { width, height } = Dimensions.get('window');

interface LoadingOverlayProps {
  visible: boolean;
  message: string;
  progress?: number; // 0-1 value for progress bar
}

export function LoadingOverlay({ visible, message, progress = 0 }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <MinimalSpinner size={48} color="#3B82F6" thickness={3} />

        <View style={{ height: 16 }} />

        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${Math.min(Math.max(progress * 100, 0), 100)}%` },
            ]}
          />
        </View>

        <View style={{ height: 12 }} />

        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width,
    height,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 10,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  progressContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  message: {
    fontSize: 16,
    color: '#4B5563',
    fontWeight: '500',
    textAlign: 'center',
  },
});
