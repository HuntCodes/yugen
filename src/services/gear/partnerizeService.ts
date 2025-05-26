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
  image: string | any; // Support both URL strings and require() objects
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
      id: 'cloudmonster-1',
      name: 'Cloudmonster',
      description: 'Maximum cushioned running shoe for easy runs and long distances. Features CloudTec® with zero-gravity foam.',
      price: '$159.99',
      image: require('../../assets/cloudmonster.jpg'),
      category: 'Shoes',
      url: 'https://www.on-running.com/en-us/products/cloudmonster',
      sku: 'CM-1-M',
      brand: 'On',
    },
    {
      id: 'cloudboom-zone-1',
      name: 'Cloudboom Zone',
      description: 'Elite racing shoe with carbon fiber Speedboard® and LightSpray upper for maximum speed.',
      price: '$269.99',
      image: require('../../assets/cloudboom-zone.jpg'),
      category: 'Shoes',
      url: 'https://www.on-running.com/en-us/products/cloudboom-zone',
      sku: 'CBZ-1-M',
      brand: 'On',
    },
    {
      id: 'cloudeclipse-1',
      name: 'Cloudeclipse',
      description: 'Premium daily trainer with dual-density CloudTec Phase® technology for unmatched comfort.',
      price: '$179.99',
      image: require('../../assets/cloudeclipse.jpg'),
      category: 'Shoes',
      url: 'https://www.on-running.com/en-us/products/cloudeclipse',
      sku: 'CE-1-M',
      brand: 'On',
    },
    {
      id: 'cloudboom-strike-1',
      name: 'Cloudboom Strike',
      description: 'Versatile performance shoe with Speedboard® technology for training and racing.',
      price: '$199.99',
      image: require('../../assets/cloudboom-strike.jpg'),
      category: 'Shoes',
      url: 'https://www.on-running.com/en-us/products/cloudboom-strike',
      sku: 'CBS-1-M',
      brand: 'On',
    },
  ];
}; 