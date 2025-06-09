import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import { View, FlatList, ActivityIndicator, Modal } from 'react-native';

import { HeaderBar } from './training/components/HeaderBar';
import { CategoryFilter } from '../../components/gear/CategoryFilter';
import { ProductCard } from '../../components/gear/ProductCard';
import { ProductDetail } from '../../components/gear/ProductDetail';
import { MinimalSpinner } from '../../components/ui/MinimalSpinner';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/StyledText';
import { useAuth } from '../../context/AuthContext';
import { TabParamList } from '../../navigation/TabNavigator';
import {
  getGearRecommendations,
  getCategoryRecommendations,
  getProductCategories,
} from '../../services/gear/gearService';
import { Product, getFallbackProducts } from '../../services/gear/partnerizeService';
import { fetchProfile } from '../../services/profile/profileService';

type GearScreenRouteProp = RouteProp<TabParamList, 'Gear'>;

export function GearScreen() {
  const { session } = useAuth();
  const route = useRoute<GearScreenRouteProp>();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [categories] = useState<string[]>(getProductCategories());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, [session]);

  useEffect(() => {
    if (profile) {
      loadProducts();
    }
  }, [profile, selectedCategory]);

  // Handle navigation parameters to highlight specific product
  useEffect(() => {
    if (route.params?.highlightProductId && products.length > 0) {
      const productToHighlight = products.find((p) => p.id === route.params?.highlightProductId);

      if (productToHighlight) {
        setSelectedProduct(productToHighlight);
        // Add a small delay to ensure proper safe area calculation
        setTimeout(() => {
          setModalVisible(true);
        }, 100);
      }
    }
  }, [route.params?.highlightProductId, products]);

  // Handle navigation when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Check if we have a product to highlight
      if (route.params?.highlightProductId) {
        if (products.length > 0) {
          const productToHighlight = products.find(
            (p) => p.id === route.params?.highlightProductId
          );

          if (productToHighlight) {
            setSelectedProduct(productToHighlight);
            // Add a small delay to ensure proper safe area calculation
            setTimeout(() => {
              setModalVisible(true);
            }, 100);
          }
        }
      }
    }, [route.params?.highlightProductId, products])
  );

  const loadUserProfile = async () => {
    try {
      if (session?.user) {
        const userProfile = await fetchProfile(session.user.id);
        setProfile(userProfile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      // Placeholder fallback products until API is implemented
      setProducts(getFallbackProducts());
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductPress = (product: Product) => {
    setSelectedProduct(product);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  const handleCategorySelect = (category: string | null) => {
    setSelectedCategory(category);
  };

  // Filter products based on selected category
  const filteredProducts = selectedCategory 
    ? products.filter(product => product.category === selectedCategory)
    : products;

  const renderProduct = ({ item }: { item: Product }) => (
    <ProductCard product={item} onPress={handleProductPress} />
  );

  return (
    <Screen className="px-6 py-4" style={{ backgroundColor: '#FBF7F6', flex: 1 }}>
      <HeaderBar title="Gear" />

      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategorySelect}
        className="my-4"
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <MinimalSpinner size={48} color="#000000" thickness={3} />
          <Text className="mt-2">Loading recommendations...</Text>
        </View>
      ) : (
        <View className="flex-1">
          <FlatList
            data={filteredProducts}
            renderItem={renderProduct}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View className="h-4" />}
            contentContainerStyle={{ paddingBottom: 16, paddingHorizontal: 24 }}
            showsVerticalScrollIndicator={false}
          />

          {/* Owned Section */}
          <View className="px-4 pb-6 pt-2">
            <Text className="mb-3 text-xl font-bold">Owned</Text>
            <View className="rounded-lg bg-white p-4">
              <Text className="text-center text-gray-500">No gear added yet.</Text>
              <Text className="mt-1 text-center text-sm text-gray-400">
                Track your running shoes, apparel, and accessories here.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Product Detail Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        presentationStyle="fullScreen"
        onRequestClose={closeModal}>
        {selectedProduct && session?.user && (
          <ProductDetail product={selectedProduct} userId={session.user.id} onClose={closeModal} />
        )}
      </Modal>
    </Screen>
  );
}
