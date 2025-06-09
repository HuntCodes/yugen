import { Feather } from '@expo/vector-icons';
import React from 'react';
import { View, TouchableOpacity, Image } from 'react-native';

import { Text } from '../../../components/ui/StyledText';

interface VoiceCheckInProps {
  coachId: string;
  coachName: string;
  imageMap: Record<string, any>;
  onActivateVoice: () => void;
  disabled?: boolean;
}

export function VoiceCheckIn({
  coachId,
  coachName,
  imageMap,
  onActivateVoice,
  disabled = false,
}: VoiceCheckInProps) {
  return (
    <View className="mb-8 w-full flex-col items-center rounded-lg bg-white p-4 shadow-sm">
      {coachId && imageMap[coachId] && (
        <View className="relative mb-2">
          <Image
            source={imageMap[coachId]}
            className="h-10 w-10 rounded-full"
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              borderWidth: 2,
              borderColor: 'white',
            }}
          />
          <View className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500" />
        </View>
      )}
      <TouchableOpacity
        className={`mb-2.5 flex-row items-center rounded-full border px-5 py-3 ${
          disabled ? 'border-gray-300 bg-gray-300' : 'border-black bg-black'
        }`}
        onPress={disabled ? undefined : onActivateVoice}
        disabled={disabled}>
        <Feather name="mic" size={24} color={disabled ? '#9CA3AF' : 'white'} />
        <Text
          className={`font-inter ml-2 text-base font-bold ${
            disabled ? 'text-gray-500' : 'text-white'
          }`}>
          {disabled ? 'Voice chat active...' : 'Check in with your coach'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
