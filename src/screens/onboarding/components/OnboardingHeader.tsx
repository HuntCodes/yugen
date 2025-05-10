import React from 'react';
import { View, Text, Image } from 'react-native';

interface OnboardingHeaderProps {
  coachName: string;
  coachId: string;
  imageMap: Record<string, any>;
}

export function OnboardingHeader({ coachName, coachId, imageMap }: OnboardingHeaderProps) {
  return (
    <View style={{ 
      paddingHorizontal: 16, 
      paddingTop: 8, 
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#F5F5F5',
    }}>
      <Text style={{ 
        fontSize: 26, 
        fontWeight: 'bold', 
        color: '#000000',
        marginBottom: 8
      }}>
        Get to know your coach
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Image
          source={coachId ? imageMap[coachId] : undefined}
          style={{ 
            width: 32, 
            height: 32, 
            borderRadius: 16, 
            marginRight: 8, 
            borderWidth: 1, 
            borderColor: '#E0E5EB',
            backgroundColor: '#F5F5F5'
          }}
          resizeMode="cover"
        />
        <Text style={{ color: '#000000', fontSize: 16 }}>{coachName || 'Coach'}</Text>
      </View>
    </View>
  );
} 