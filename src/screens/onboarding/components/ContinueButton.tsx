import React from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { MinimalSpinner } from '../../../components/ui/MinimalSpinner';

interface ContinueButtonProps {
  onContinue: () => void;
  isLoading?: boolean;
}

export function ContinueButton({ onContinue, isLoading = false }: ContinueButtonProps) {
  return (
    <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#F5F5F5', backgroundColor: 'white' }}>
      <TouchableOpacity
        style={{
          backgroundColor: '#000',
          borderRadius: 6,
          paddingVertical: 16,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
        }}
        onPress={onContinue}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <View style={{ marginRight: 8 }}>
              <MinimalSpinner size={20} color="#FFFFFF" thickness={2} />
            </View>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Generating Plan...</Text>
          </>
        ) : (
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Continue</Text>
        )}
      </TouchableOpacity>
    </View>
  );
} 