import React from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Text } from '../../../components/ui/StyledText';
import { Feather } from '@expo/vector-icons';

interface VoiceCheckInProps {
  coachId: string;
  coachName: string;
  imageMap: Record<string, any>;
  onActivateVoice: () => void;
}

export function VoiceCheckIn({ coachId, coachName, imageMap, onActivateVoice }: VoiceCheckInProps) {
  return (
    <View className="bg-white rounded-lg p-4 shadow-sm mb-8 w-full flex-col items-center">
      {coachId && imageMap[coachId] && (
        <View className="relative mb-2">
          <Image 
            source={imageMap[coachId]} 
            className="w-10 h-10 rounded-full"
            style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: 'white' }}
          />
          <View 
            className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"
          />
        </View>
      )}
      <TouchableOpacity 
        className="flex-row items-center bg-black py-3 px-5 rounded-full border-black mb-2.5" 
        onPress={onActivateVoice}
      >
        <Feather name="mic" size={24} color="white" />
        <Text className="text-white ml-2 text-base font-bold font-inter">Check in with your coach</Text>
      </TouchableOpacity>
    </View>
  );
} 