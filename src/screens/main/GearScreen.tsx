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

export function GearScreen() {
  const { session } = useAuth();
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
      <HeaderBar title="Gear Recommendations" />

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
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={item => item.id}
          ItemSeparatorComponent={() => <View className="h-4" />}
          contentContainerStyle={{ paddingBottom: 16, paddingHorizontal: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Product Detail Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
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