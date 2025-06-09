import React from 'react';
import { View, Image, TouchableOpacity } from 'react-native';

import { Product } from '../../services/gear/partnerizeService';
import { Text } from '../ui/StyledText';

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
}

export function ProductCard({ product, onPress }: ProductCardProps) {
  return (
    <TouchableOpacity
      className="mb-4 flex-row items-center rounded-lg bg-white p-4"
      onPress={() => onPress(product)}>
      <Image
        source={typeof product.image === 'string' ? { uri: product.image } : product.image}
        className="mr-4 h-24 w-24 rounded-md bg-gray-100"
        resizeMode="contain"
      />
      <View className="flex-1 gap-y-2">
        <Text className="text-lg font-bold">{product.name}</Text>
        <Text className="text-sm text-gray-600">{product.category}</Text>
        <Text className="text-sm" numberOfLines={2}>
          {product.description}
        </Text>
        <Text className="font-bold">{product.price}</Text>
      </View>
    </TouchableOpacity>
  );
}
