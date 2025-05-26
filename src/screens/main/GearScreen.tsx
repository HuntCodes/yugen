import React, { useState, useEffect } from 'react';
import { View, FlatList, ActivityIndicator, Modal } from 'react-native';
import { Text } from '../../components/ui/StyledText';
import { Screen } from '../../components/ui/Screen';
import { useAuth } from '../../context/AuthContext';
import { fetchProfile } from '../../services/profile/profileService';
import { getGearRecommendations, getCategoryRecommendations, getProductCategories } from '../../services/gear/gearService';
import { Product, getFallbackProducts } from '../../services/gear/partnerizeService';
import { ProductCard } from '../../components/gear/ProductCard';
import { ProductDetail } from '../../components/gear/ProductDetail';
import { CategoryFilter } from '../../components/gear/CategoryFilter';
import { HeaderBar } from './training/components/HeaderBar';
import { MinimalSpinner } from '../../components/ui/MinimalSpinner';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { TabParamList } from '../../navigation/TabNavigator';

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
      const productToHighlight = products.find(p => p.id === route.params?.highlightProductId);
      
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
          const productToHighlight = products.find(p => p.id === route.params?.highlightProductId);
          
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

  const renderProduct = ({ item }: { item: Product }) => (
    <ProductCard 
      product={item} 
      onPress={handleProductPress} 
    />
  );

  return (
    <Screen className="py-4 px-6" style={{ backgroundColor: '#FBF7F6', flex: 1 }}>
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
            data={products}
            renderItem={renderProduct}
            keyExtractor={item => item.id}
            ItemSeparatorComponent={() => <View className="h-4" />}
            contentContainerStyle={{ paddingBottom: 16, paddingHorizontal: 24 }}
            showsVerticalScrollIndicator={false}
          />
          
          {/* Owned Section */}
          <View className="px-4 pt-2 pb-6">
            <Text className="font-bold text-xl mb-3">Owned</Text>
            <View className="bg-white rounded-lg p-4">
              <Text className="text-gray-500 text-center">No gear added yet.</Text>
              <Text className="text-gray-400 text-center text-sm mt-1">Track your running shoes, apparel, and accessories here.</Text>
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
        onRequestClose={closeModal}
      >
        {selectedProduct && session?.user && (
          <ProductDetail 
            product={selectedProduct} 
            userId={session.user.id}
            onClose={closeModal} 
          />
        )}
      </Modal>
    </Screen>
  );
} 