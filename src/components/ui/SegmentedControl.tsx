import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface SegmentedControlProps {
  segments: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  containerClassName?: string;
  segmentClassName?: string;
  activeSegmentClassName?: string;
  textClassName?: string;
  activeTextClassName?: string;
}

export function SegmentedControl({
  segments,
  selectedIndex,
  onChange,
  containerClassName = '',
  segmentClassName = '',
  activeSegmentClassName = '',
  textClassName = '',
  activeTextClassName = '',
}: SegmentedControlProps) {
  return (
    <View className={`flex-row ${containerClassName}`}>
      {segments.map((segment, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => onChange(index)}
          className={`flex-1 items-center justify-center px-4 py-2 ${segmentClassName} ${index === selectedIndex ? activeSegmentClassName : ''}`}
          activeOpacity={0.7}>
          <Text
            className={`${textClassName} ${index === selectedIndex ? activeTextClassName : ''}`}>
            {segment}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
