import React from 'react';
import { View, Text, Image } from 'react-native';

interface TypeIndicatorProps {
  coachName: string;
  coachId: string;
  imageMap: Record<string, any>;
}

export function TypeIndicator({ coachName, coachId, imageMap }: TypeIndicatorProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
      <Image
        source={coachId ? imageMap[coachId] : undefined}
        style={{ 
          width: 36, 
          height: 36, 
          borderRadius: 18, 
          marginRight: 12,
          backgroundColor: '#F5F5F5',
          borderWidth: 1,
          borderColor: '#E0E5EB'
        }}
        resizeMode="cover"
      />
      <View>
        <Text style={{ 
          fontSize: 13, 
          color: '#757575', 
          marginBottom: 4, 
          fontWeight: '500'
        }}>
          {coachName || 'Coach'}
        </Text>
        <View style={{ 
          paddingHorizontal: 16, 
          paddingVertical: 12, 
          backgroundColor: '#F5F5F5', 
          borderRadius: 6
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#757575', marginRight: 8 }}>Typing</Text>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ 
                width: 6, 
                height: 6, 
                borderRadius: 3, 
                backgroundColor: '#757575', 
                marginHorizontal: 2 
              }}></View>
              <View style={{ 
                width: 6, 
                height: 6, 
                borderRadius: 3, 
                backgroundColor: '#757575', 
                marginHorizontal: 2 
              }}></View>
              <View style={{ 
                width: 6, 
                height: 6, 
                borderRadius: 3, 
                backgroundColor: '#757575', 
                marginHorizontal: 2 
              }}></View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
} 