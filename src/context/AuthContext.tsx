import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
// Remove dependency on expo-secure-store as it's not installed
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase'; // Ensure this path is correct

// Define our own type for the subscription since it's different in v1
type SupabaseSubscription = {
  unsubscribe: () => void;
};

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // State variable to hold the subscription
  const [authSubscription, setAuthSubscription] = useState<SupabaseSubscription | null>(null);

  useEffect(() => {
    console.log('Auth Context: Checking initial session...');
    // Check for existing session using v1 method
    const initialSession = supabase.auth.session();
    console.log('Auth Context: Initial session:', initialSession);
    setSession(initialSession);
    setLoading(false);
    console.log("Auth Context: Loading set to false");

    // Set up listener AFTER setting initial session and loading state
    console.log('Auth Context: Setting up listener...');
    // Use v1 onAuthStateChange which returns a subscription directly
    const subscription = supabase.auth.onAuthStateChange((event, currentSession) => {
      console.log("Auth Context: Auth state changed:", event, currentSession);
      // Only update if session actually changes to prevent loops
      setSession(currentSession);
    });

    if (subscription) {
      console.log('Auth Context: Listener setup complete. Subscription:', subscription);
      // Store the subscription - explicitly cast to our type
      setAuthSubscription(subscription as unknown as SupabaseSubscription);
    } else {
      console.warn("Auth Context: Listener setup did not return a subscription object.");
    }

    // Cleanup function
    return () => {
      // Use the state variable for cleanup
      if (authSubscription) {
        console.log('Auth Context: Unsubscribing listener...');
        authSubscription.unsubscribe();
        setAuthSubscription(null); // Clear the subscription state
      } else {
        console.log('Auth Context: No listener to unsubscribe from state.');
      }
    };
  }, []); // Empty dependency array means this runs once on mount

  // --- Memoize Auth methods using useCallback --- 

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signIn({ email, password });
    if (error) throw error;
  }, []); // Empty dependency array: function never needs to change

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signIn({ provider: 'google' });
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    // v1 API uses a different method for reset password
    const { error } = await supabase.auth.api.resetPasswordForEmail(email);
    if (error) throw error;
  }, []);

  // Create the value object - functions are now stable references
  const value = React.useMemo(() => ({
    session,
    loading,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    resetPassword,
  }), [session, loading, signIn, signUp, signOut, signInWithGoogle, resetPassword]); // Include all parts of the value in deps

  console.log(`AuthProvider Render: loading=${loading}, session=`, session);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}