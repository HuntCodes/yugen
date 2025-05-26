import React from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import { Text } from '../ui/StyledText';
import { Product } from '../../services/gear/partnerizeService';

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
}

export function ProductCard({ product, onPress }: ProductCardProps) {
  return (
    <TouchableOpacity 
      className="flex-row bg-white rounded-lg p-4 mb-4 items-center"
      onPress={() => onPress(product)}
    >
      <Image 
        source={typeof product.image === 'string' ? { uri: product.image } : product.image}
        className="w-24 h-24 rounded-md mr-4 bg-gray-100"
        resizeMode="contain"
      />
      <View className="flex-1 gap-y-2">
        <Text className="text-lg font-bold">{product.name}</Text>
        <Text className="text-sm text-gray-600">{product.category}</Text>
        <Text className="text-sm" numberOfLines={2}>{product.description}</Text>
        <Text className="font-bold">{product.price}</Text>
      </View>
    </TouchableOpacity>
  );
} 