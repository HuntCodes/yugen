import { fetchRecommendedProducts, getFallbackProducts, Product } from './partnerizeService';
import { supabase } from '../../lib/supabase';

/**
 * Get personalized gear recommendations based on user profile and training data
 */
export const getGearRecommendations = async (userId: string): Promise<Product[]> => {
  try {
    // Fetch the user profile for preferences
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return getFallbackProducts();
    }
    
    // Fetch recent training data to better understand user needs
    const { data: trainingData, error: trainingError } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(10);
    
    if (trainingError) {
      console.error('Error fetching training data:', trainingError);
    }
    
    // Determine if user is training for a specific race
    const hasRaceGoal = profile.race_date && profile.race_distance;
    
    // Calculate total training volume to recommend appropriate gear
    let totalDistance = 0;
    let runCount = 0;
    
    if (trainingData && trainingData.length > 0) {
      trainingData.forEach(session => {
        totalDistance += session.distance || 0;
        runCount++;
      });
    }
    
    const avgDistance = runCount > 0 ? totalDistance / runCount : 0;
    
    // Determine user's training level for better recommendations
    let trainingLevel = 'beginner';
    if (avgDistance > 10) {
      trainingLevel = 'intermediate';
    }
    if (avgDistance > 15 || profile.current_mileage > 50) {
      trainingLevel = 'advanced';
    }
    
    // Enriched profile for better recommendations
    const enrichedProfile = {
      ...profile,
      avgRunDistance: avgDistance,
      hasRaceGoal,
      trainingLevel,
      totalWeeklyVolume: profile.current_mileage,
    };
    
    // Try to get personalized recommendations
    try {
      const recommendations = await fetchRecommendedProducts(enrichedProfile);
      
      if (recommendations && recommendations.length > 0) {
        return recommendations;
      }
    } catch (apiError) {
      console.error('Error fetching recommendations from API:', apiError);
    }
    
    // Fall back to local data if API fails
    return getFallbackProducts();
  } catch (error) {
    console.error('Error in getGearRecommendations:', error);
    return getFallbackProducts();
  }
};

/**
 * Get category-specific product recommendations
 */
export const getCategoryRecommendations = async (
  userId: string,
  category: string
): Promise<Product[]> => {
  try {
    // Fetch profile for user preferences
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    if (error || !profile) {
      console.error('Error fetching user profile for category recommendations:', error);
      return getFallbackProducts().filter(product => 
        product.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    // Enrich profile with category preference
    const enrichedProfile = {
      ...profile,
      preferredCategory: category,
    };
    
    // Fetch category-specific recommendations
    const recommendations = await fetchRecommendedProducts(enrichedProfile, 10, category);
    
    if (recommendations && recommendations.length > 0) {
      return recommendations;
    }
    
    // Fall back to filtered local data
    return getFallbackProducts().filter(product => 
      product.category.toLowerCase() === category.toLowerCase()
    );
  } catch (error) {
    console.error(`Error getting recommendations for category ${category}:`, error);
    return getFallbackProducts().filter(product => 
      product.category.toLowerCase() === category.toLowerCase()
    );
  }
};

/**
 * Track when a user views a product detail
 */
export const logProductView = async (userId: string, productId: string): Promise<void> => {
  try {
    await supabase
      .from('product_interactions')
      .insert({
        user_id: userId,
        product_id: productId,
        interaction_type: 'view',
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Error logging product view:', error);
  }
};

/**
 * Get available product categories
 */
export const getProductCategories = (): string[] => {
  return ['Shoes', 'Apparel', 'Accessories'];
}; 