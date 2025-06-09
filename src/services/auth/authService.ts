import { Session } from '@supabase/supabase-js';

import { supabase } from '../../lib/supabase';

/**
 * Get the current user's session
 */
export const getSession = async (): Promise<Session | null> => {
  const session = supabase.auth.session();
  if (!session) {
    console.error('No active session found');
    return null;
  }
  return session;
};

/**
 * Get the current user
 */
export const getCurrentUser = async () => {
  const session = supabase.auth.session();
  const user = supabase.auth.user();

  if (!user) {
    console.error('Error getting user: No authenticated user');
    return null;
  }

  return user;
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (email: string, password: string) => {
  const { user, session, error } = await supabase.auth.signIn({
    email,
    password,
  });

  if (error) {
    console.error('Error signing in:', error.message);
    throw error;
  }

  return { user, session };
};

/**
 * Sign up with email and password
 */
export const signUpWithEmail = async (email: string, password: string) => {
  const { user, session, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error('Error signing up:', error.message);
    throw error;
  }

  return { user, session };
};

/**
 * Sign out the current user
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error signing out:', error.message);
    throw error;
  }

  return true;
};

/**
 * Sign in with OAuth provider
 */
export const signInWithOAuth = async (provider: 'google' | 'facebook' | 'apple') => {
  const { user, session, error } = await supabase.auth.signIn({
    provider,
  });

  if (error) {
    console.error(`Error signing in with ${provider}:`, error.message);
    throw error;
  }

  return { user, session };
};

/**
 * Reset password for email
 */
export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.api.resetPasswordForEmail(email);

  if (error) {
    console.error('Error resetting password:', error.message);
    throw error;
  }

  return true;
};

/**
 * Set up auth state change listener
 */
export const onAuthStateChange = (callback: (session: Session | null) => void) => {
  const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return authListener;
};

/**
 * Update user data
 */
export const updateUserData = async (data: {
  email?: string;
  password?: string;
  data?: Record<string, any>;
}) => {
  const { user, error } = await supabase.auth.update(data);

  if (error) {
    console.error('Error updating user data:', error.message);
    throw error;
  }

  return true;
};
