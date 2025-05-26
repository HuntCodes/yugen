import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../ui/StyledText';
import { Product } from '../../services/gear/partnerizeService';
import { trackProductClick } from '../../services/gear/partnerizeService';
import { logProductView } from '../../services/gear/gearService';

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
            className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 shadow-sm"
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text className="font-bold text-xl">×</Text>
          </TouchableOpacity>
          
          <Image
            source={typeof product.image === 'string' ? { uri: product.image } : product.image}
            className="w-full h-72 bg-gray-100"
            resizeMode="contain"
          />
        </View>
        
        <View className="p-4">
          <Text className="text-2xl font-bold mb-1">{product.name}</Text>
          <Text className="text-gray-500 mb-3">{product.category}</Text>
          <Text className="text-xl font-bold mb-4">{product.price}</Text>
          
          <Text className="text-lg font-semibold mb-2">Description</Text>
          <Text className="text-base mb-6">{product.description}</Text>
          
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-2">Details</Text>
            <View className="flex-row justify-between py-2 border-b border-gray-200">
              <Text className="text-gray-500">Brand</Text>
              <Text>{product.brand}</Text>
            </View>
            <View className="flex-row justify-between py-2 border-b border-gray-200">
              <Text className="text-gray-500">SKU</Text>
              <Text>{product.sku}</Text>
            </View>
          </View>
          
          <TouchableOpacity
            className="bg-black py-4 rounded-md items-center"
            onPress={handleBuyNow}
          >
            <Text className="text-white font-bold text-lg">Buy Now</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            className="mt-3 py-4 rounded-md items-center border border-gray-300"
            onPress={onClose}
          >
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