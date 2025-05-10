import { Platform } from 'react-native';

// Define the API credentials
const USER_APPLICATION_KEY = 'xdNXtsh4Kv';
const USER_API_KEY = '5sXLthcR';

// Define interfaces for the API responses
export interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  image: string;
  category: string;
  url: string;
  sku: string;
  brand: string;
}

interface PartnerizeResponse {
  products: Product[];
  pagination?: {
    total: number;
    next?: string;
  };
}

/**
 * Fetch recommended products based on user preferences
 */
export const fetchRecommendedProducts = async (
  userProfile: any,
  limit: number = 10,
  category?: string
): Promise<Product[]> => {
  try {
    // Determine device type for tracking
    const deviceType = Platform.OS === 'ios' ? 'ios' : 'android';
    
    // Build query params based on user profile
    const queryParams = new URLSearchParams();
    queryParams.append('limit', limit.toString());
    
    // Add user preferences for more relevant recommendations
    if (userProfile?.gender) {
      queryParams.append('gender', userProfile.gender);
    }
    
    if (userProfile?.shoe_size) {
      queryParams.append('size', userProfile.shoe_size);
    }
    
    if (category) {
      queryParams.append('category', category);
    }
    
    // Add 'running' keyword to focus on running products
    queryParams.append('keyword', 'running');
    
    // You can add more filtering based on user preferences
    if (userProfile?.clothing_size) {
      queryParams.append('apparel_size', userProfile.clothing_size);
    }
    
    // Add brand filter for On products
    queryParams.append('brand', 'on');
    
    // Construct the API URL
    // Note: This is a placeholder URL - replace with the actual Partnerize API endpoint
    const apiUrl = `https://api.partnerize.com/v2/products?${queryParams.toString()}`;
    
    // Make the API request
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Application-Key': USER_APPLICATION_KEY,
        'X-API-Key': USER_API_KEY,
        'User-Agent': `OnRunClub/${deviceType}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data: PartnerizeResponse = await response.json();
    
    // Process and return the products
    return data.products.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description || 'No description available',
      price: product.price,
      image: product.image,
      category: product.category,
      url: product.url,
      sku: product.sku,
      brand: product.brand,
    }));
  } catch (error) {
    console.error('Error fetching recommended products:', error);
    return [];
  }
};

/**
 * Fetch products by category
 */
export const fetchProductsByCategory = async (
  category: string,
  limit: number = 20
): Promise<Product[]> => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('limit', limit.toString());
    queryParams.append('category', category);
    queryParams.append('brand', 'on');
    
    const apiUrl = `https://api.partnerize.com/v2/products?${queryParams.toString()}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Application-Key': USER_APPLICATION_KEY,
        'X-API-Key': USER_API_KEY,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data: PartnerizeResponse = await response.json();
    return data.products;
  } catch (error) {
    console.error(`Error fetching products for category ${category}:`, error);
    return [];
  }
};

/**
 * Track a product click (for affiliate tracking)
 */
export const trackProductClick = async (productId: string, userId: string): Promise<boolean> => {
  try {
    const apiUrl = 'https://api.partnerize.com/v2/click';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Application-Key': USER_APPLICATION_KEY,
        'X-API-Key': USER_API_KEY,
      },
      body: JSON.stringify({
        product_id: productId,
        user_id: userId,
        device_type: Platform.OS,
      }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error tracking product click:', error);
    return false;
  }
};

/**
 * Provide a fallback set of products for development or when the API is unavailable
 */
export const getFallbackProducts = (): Product[] => {
  return [
    {
      id: 'cloudflow-1',
      name: 'Cloudflow',
      description: 'The performance running shoe with explosive takeoffs and soft landings.',
      price: '$139.99',
      image: 'https://www.on-running.com/images/product/cloudflow/cloudflow-rock-rose.png',
      category: 'Shoes',
      url: 'https://www.on-running.com/products/cloudflow',
      sku: 'CLF-RR-M',
      brand: 'On',
    },
    {
      id: 'weather-jacket-1',
      name: 'Weather Jacket',
      description: 'Lightweight, breathable protection from the elements.',
      price: '$199.99',
      image: 'https://www.on-running.com/images/product/weather-jacket/weather-jacket-black.png',
      category: 'Apparel',
      url: 'https://www.on-running.com/products/weather-jacket',
      sku: 'WJ-BLK-M',
      brand: 'On',
    },
    {
      id: 'performance-t-1',
      name: 'Performance T',
      description: 'Technical running tee with advanced temperature regulation.',
      price: '$59.99',
      image: 'https://www.on-running.com/images/product/performance-t/performance-t-navy.png',
      category: 'Apparel',
      url: 'https://www.on-running.com/products/performance-t',
      sku: 'PT-NVY-M',
      brand: 'On',
    },
    {
      id: 'running-shorts-1',
      name: 'Running Shorts',
      description: 'Lightweight, breathable shorts with 5" inseam.',
      price: '$69.99',
      image: 'https://www.on-running.com/images/product/running-shorts/running-shorts-black.png',
      category: 'Apparel',
      url: 'https://www.on-running.com/products/running-shorts',
      sku: 'RS-BLK-M',
      brand: 'On',
    },
  ];
}; 