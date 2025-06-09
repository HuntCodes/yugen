import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { logProductView } from '../../services/gear/gearService';
import { Product, trackProductClick } from '../../services/gear/partnerizeService';
import { Text } from '../ui/StyledText';

interface ProductDetailProps {
  product: Product;
  userId: string;
  onClose: () => void;
}

export function ProductDetail({ product, userId, onClose }: ProductDetailProps) {
  React.useEffect(() => {
    // Log that the user viewed this product detail
    logProductView(userId, product.id);
  }, [product.id, userId]);

  const handleBuyNow = async () => {
    // Track the product click for analytics/affiliate tracking
    await trackProductClick(product.id, userId);

    // Open the product URL in the browser
    if (await Linking.canOpenURL(product.url)) {
      await Linking.openURL(product.url);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <ScrollView style={{ flex: 1 }}>
        <View className="relative">
          <TouchableOpacity
            className="absolute right-4 top-4 z-10 rounded-full bg-white p-2 shadow-sm"
            style={styles.closeButton}
            onPress={onClose}>
            <Text className="text-xl font-bold">×</Text>
          </TouchableOpacity>

          <Image
            source={typeof product.image === 'string' ? { uri: product.image } : product.image}
            className="h-72 w-full bg-gray-100"
            resizeMode="contain"
          />
        </View>

        <View className="p-4">
          <Text className="mb-1 text-2xl font-bold">{product.name}</Text>
          <Text className="mb-3 text-gray-500">{product.category}</Text>
          <Text className="mb-4 text-xl font-bold">{product.price}</Text>

          <Text className="mb-2 text-lg font-semibold">Description</Text>
          <Text className="mb-6 text-base">{product.description}</Text>

          <View className="mb-6">
            <Text className="mb-2 text-lg font-semibold">Details</Text>
            <View className="flex-row justify-between border-b border-gray-200 py-2">
              <Text className="text-gray-500">Brand</Text>
              <Text>{product.brand}</Text>
            </View>
            <View className="flex-row justify-between border-b border-gray-200 py-2">
              <Text className="text-gray-500">SKU</Text>
              <Text>{product.sku}</Text>
            </View>
          </View>

          <TouchableOpacity
            className="items-center rounded-md bg-black py-4"
            onPress={handleBuyNow}>
            <Text className="text-lg font-bold text-white">Buy Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-3 items-center rounded-md border border-gray-300 py-4"
            onPress={onClose}>
            <Text className="font-medium">Back to Recommendations</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
});
