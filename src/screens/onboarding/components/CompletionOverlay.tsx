import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import * as Animatable from 'react-native-animatable';

interface CompletionOverlayProps {
  visible: boolean;
  coachName: string;
  coachAvatar: any;
  onContinue: () => void;
  isProcessing?: boolean;
}

export function CompletionOverlay({ 
  visible, 
  coachName, 
  coachAvatar, 
  onContinue, 
  isProcessing = false 
}: CompletionOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Animatable.View 
        animation="fadeInUp" 
        duration={500} 
        style={styles.content}
      >
        <View style={styles.coachSection}>
          <Image source={coachAvatar} style={styles.coachAvatar} />
          <Text style={styles.title}>Conversation Complete</Text>
          <Text style={styles.subtitle}>
            Great chat with {coachName}! Ready to create your personalized training plan?
          </Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.continueButton, isProcessing && styles.continueButtonDisabled]}
          onPress={onContinue}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          <Text style={styles.continueButtonText}>
            {isProcessing ? 'Creating Plan...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </Animatable.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 500,
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    marginHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  coachSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  coachAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  continueButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 40,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  continueButtonDisabled: {
    backgroundColor: '#888888',
    opacity: 0.7,
  },
  continueButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
}); 