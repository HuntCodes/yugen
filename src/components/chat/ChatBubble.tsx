import React from 'react';
import { View, Text, Image } from 'react-native';
import { Coach } from '../../types/coach';

// Updated path to point to src/assets
const imageMap: Record<string, any> = {
  craig: require('../../../src/assets/craig.jpg'),
  thomas: require('../../../src/assets/thomas.jpg'),
  dathan: require('../../../src/assets/dathan.jpg'),
};

interface ChatBubbleProps {
  message: string;
  sender: 'user' | 'coach';
  coach?: Coach | null;
}

export function ChatBubble({ message, sender, coach }: ChatBubbleProps) {
  if (sender === 'coach' && coach) {
    return (
      <View className="mb-4 flex-row items-start">
        <Image
          source={coach.id ? imageMap[coach.id] : undefined}
          className="w-10 h-10 rounded-full mr-3 bg-gray-200"
          resizeMode="cover"
        />
        <View>
          <Text className="text-xs text-gray-500 mb-1 font-semibold">{coach.name}</Text>
          <View className="px-5 py-3 rounded-2xl bg-[#F3F4F6] shadow-sm max-w-[80%]">
            <Text className="text-black text-base leading-relaxed">{message}</Text>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View className={`mb-2 ${sender === 'user' ? 'items-end' : 'items-start'}`}> 
      <View className={`px-5 py-3 rounded-2xl max-w-[80%] shadow-sm ${
        sender === 'user' ? 'bg-[#0074E8]' : 'bg-[#F3F4F6]'
      }`}>
        <Text className={sender === 'user' ? 'text-white text-base leading-relaxed' : 'text-black text-base leading-relaxed'}>{message}</Text>
      </View>
    </View>
  );
} 