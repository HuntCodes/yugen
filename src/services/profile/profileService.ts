import { supabase } from '../../lib/supabase';
import { Coach } from '../../types/coach';

/**
 * Fetch a user's profile by ID
 */
export const fetchProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching profile:', error.message);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Error in fetchProfile:', err);
    return null;
  }
};

/**
 * Check if a profile exists for the user
 */
export const checkProfileExists = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, coach_id')
      .eq('id', userId)
      .maybeSingle();
      
    if (error) {
      console.error('Error checking profile:', error.message);
      return null;
    }
    
    return {
      exists: !!data,
      hasCoach: data ? !!data.coach_id : false,
      profile: data
    };
  } catch (err) {
    console.error('Error in checkProfileExists:', err);
    return null;
  }
};

/**
 * Create a new profile
 */
export const createProfile = async (userId: string, email: string, coachId: string) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email,
        coach_id: coachId,
        updated_at: new Date().toISOString(),
      });
      
    if (error) {
      console.error('Error creating profile:', error.message);
      throw error;
    }
    
    return true;
  } catch (err) {
    console.error('Error in createProfile:', err);
    throw err;
  }
};

/**
 * Update a profile
 */
export const updateProfile = async (userId: string, updates: Record<string, any>) => {
  try {
    // No special processing needed for string fields
    const updatedData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('profiles')
      .update(updatedData)
      .eq('id', userId);
      
    if (error) {
      console.error('Error updating profile:', error.message);
      throw error;
    }
    
    return true;
  } catch (err) {
    console.error('Error in updateProfile:', err);
    throw err;
  }
};

/**
 * Update coach selection
 */
export const updateCoachSelection = async (userId: string, coachId: string) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ 
        coach_id: coachId,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
      
    if (error) {
      console.error('Error updating coach selection:', error.message);
      throw error;
    }
    
    return true;
  } catch (err) {
    console.error('Error in updateCoachSelection:', err);
    throw err;
  }
};

/**
 * Mark onboarding as completed
 */
export const completeOnboarding = async (userId: string) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ 
        onboarding_completed: true,
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId);
      
    if (error) {
      console.error('Error completing onboarding:', error.message);
      throw error;
    }
    
    return true;
  } catch (err) {
    console.error('Error in completeOnboarding:', err);
    throw err;
  }
};

/**
 * Fetch the coach associated with a user
 */
export const fetchCoach = async (userId: string) => {
  try {
    // First get the profile to find coach_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('coach_id')
      .eq('id', userId)
      .maybeSingle();
      
    if (profileError || !profile) {
      console.error('Error fetching profile or no profile found:', profileError);
      return null;
    }
    
    if (!profile.coach_id) {
      console.log('No coach_id found in user profile');
      return null;
    }
    
    return profile.coach_id;
  } catch (err) {
    console.error('Error in fetchCoach:', err);
    return null;
  }
};

/**
 * Save onboarding answers to profile
 */
export const saveOnboardingAnswers = async (userId: string, fields: string[], value: string | (string | null)[]) => {
  try {
    const updates: Record<string, any> = { id: userId };
    
    if (Array.isArray(value)) {
      fields.forEach((field, i) => {
        // If this is a date field and the value is empty or null, set it to null
        // This handles race_date specifically for Supabase's date column type
        if (field.includes('date') && (value[i] === null || !value[i] || value[i] === '')) {
          updates[field] = null;
        } else {
          updates[field] = value[i];
        }
      });
    } else {
      // Handle single field values
      // If this is a date field and the value is empty, set it to null
      if (fields[0].includes('date') && (!value || value === '')) {
        updates[fields[0]] = null;
      } else {
        updates[fields[0]] = value;
      }
    }
    
    updates.updated_at = new Date().toISOString();
    
    const { error } = await supabase
      .from('profiles')
      .upsert(updates);
      
    if (error) {
      console.error('Error saving onboarding answers:', error.message);
      throw error;
    }
    
    return true;
  } catch (err) {
    console.error('Error in saveOnboardingAnswers:', err);
    throw err;
  }
}; 