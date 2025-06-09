import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';

import { Text } from '../ui/StyledText';

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  className?: string;
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
  className,
}: CategoryFilterProps) {
  return (
    <View className={`overflow-hidden px-4 ${className || ''}`} style={{ height: 48 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center', paddingVertical: 4 }}>
        <TouchableOpacity
          className={`mr-2 rounded-full px-4 py-3 ${selectedCategory === null ? 'bg-black' : 'bg-[#F0ECEB]'}`}
          onPress={() => onSelectCategory(null)}
          activeOpacity={0.7}
          delayPressIn={0}>
          <Text
            className={`${selectedCategory === null ? 'text-white' : 'text-black'} font-medium`}>
            All
          </Text>
        </TouchableOpacity>

        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            className={`mr-2 rounded-full px-4 py-3 ${selectedCategory === category ? 'bg-black' : 'bg-[#F0ECEB]'}`}
            onPress={() => onSelectCategory(category)}
            activeOpacity={0.7}
            delayPressIn={0}>
            <Text
              className={`${selectedCategory === category ? 'text-white' : 'text-black'} font-medium`}>
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
