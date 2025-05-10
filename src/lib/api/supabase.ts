import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './config';

console.log('Supabase Config:', {
  url: supabaseConfig.url,
  hasKey: !!supabaseConfig.anonKey
});

// Updated client initialization for v1
export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

// Test function to verify connection
export async function testConnection() {
  try {
    // Try to query our test table
    const { data, error } = await supabase
      .from('test_table')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error);
      throw error;
    }
    
    console.log('Supabase connection successful! Test table data:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Supabase test error:', error);
    return { success: false, error };
  }
}

export async function testAuth() {
  try {
    // Generate a unique test email using timestamp
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@onrunningtest.com`;
    const testPassword = 'TestPassword123!';

    console.log('Testing auth with email:', testEmail);

    // Test sign up - updated for v1
    const { user: signUpUser, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });
    
    if (signUpError) {
      console.error('Sign up error:', signUpError);
      return { 
        success: false, 
        error: signUpError,
        step: 'signup',
        details: `Failed to sign up with email ${testEmail}`
      };
    }

    console.log('Sign up successful:', signUpUser);

    // Test sign in - updated for v1
    const { user: signInUser, error: signInError } = await supabase.auth.signIn({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      console.error('Sign in error:', signInError);
      return { 
        success: false, 
        error: signInError,
        step: 'signin',
        details: `Failed to sign in with email ${testEmail}`
      };
    }

    console.log('Sign in successful:', signInUser);

    // Test sign out
    const { error: signOutError } = await supabase.auth.signOut();
    
    if (signOutError) {
      console.error('Sign out error:', signOutError);
      return { 
        success: false, 
        error: signOutError,
        step: 'signout',
        details: 'Failed to sign out'
      };
    }

    console.log('Sign out successful');
    return { success: true };
  } catch (error) {
    console.error('Auth test error:', error);
    return { 
      success: false, 
      error,
      step: 'unknown',
      details: 'An unexpected error occurred'
    };
  }
} 