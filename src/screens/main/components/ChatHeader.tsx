import React from 'react';
import { View, Text, Image } from 'react-native';

interface ChatHeaderProps {
  coachName: string;
  coachId: string;
  imageMap: Record<string, any>;
}

export function ChatHeader({ coachName, coachId, imageMap }: ChatHeaderProps) {
  return (
    <View style={{ 
      paddingHorizontal: 16, 
      paddingTop: 8, 
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#F5F5F5',
    }}>
      <Text style={{ 
        fontSize: 32, 
        fontWeight: 'bold', 
        color: '#000000',
        marginBottom: 16
      }}>
        Home
      </Text>
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#F9F9F9',
        padding: 12,
        borderRadius: 8,
      }}>
        <Image
          source={coachId ? imageMap[coachId] : undefined}
          style={{ 
            width: 40, 
            height: 40, 
            borderRadius: 20, 
            marginRight: 12, 
            borderWidth: 1, 
            borderColor: '#E0E5EB',
            backgroundColor: '#F5F5F5'
          }}
          resizeMode="cover"
        />
        <View>
          <Text style={{ color: '#000000', fontSize: 18, fontWeight: '600' }}>{coachName || 'Coach'}</Text>
          <Text style={{ color: '#666', fontSize: 14 }}>Message your coach</Text>
        </View>
      </View>
    </View>
  );
} 