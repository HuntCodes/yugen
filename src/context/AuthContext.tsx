import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
// Text import no longer needed here if not used directly

type SupabaseSubscription = {
  unsubscribe: () => void;
};

// Restore AuthContextType to its original form
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
  // Restore original state and effects logic
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authSubscription, setAuthSubscription] = useState<SupabaseSubscription | null>(null);

  useEffect(() => {
    console.log('Auth Context: Checking initial session...');
    const initialSession = supabase.auth.session();
    console.log('Auth Context: Initial session:', initialSession);
    setSession(initialSession);
    setLoading(false);
    console.log("Auth Context: Loading set to false");

    console.log('Auth Context: Setting up listener...');
    const subscription = supabase.auth.onAuthStateChange((event, currentSession) => {
      console.log("Auth Context: Auth state changed:", event, currentSession);
      setSession(currentSession);
    });

    if (subscription) {
      console.log('Auth Context: Listener setup complete. Subscription:', subscription);
      setAuthSubscription(subscription as unknown as SupabaseSubscription);
    } else {
      console.warn("Auth Context: Listener setup did not return a subscription object.");
    }

    return () => {
      if (authSubscription) {
        console.log('Auth Context: Unsubscribing listener...');
        authSubscription.unsubscribe();
        setAuthSubscription(null);
      } else {
        console.log('Auth Context: No listener to unsubscribe from state.');
      }
    };
  }, []); 

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signIn({ email, password });
    if (error) throw error;
  }, []);

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
    const { error } = await supabase.auth.api.resetPasswordForEmail(email);
    if (error) throw error;
  }, []);

  // Restore the memoized value
  const value = React.useMemo(() => ({
    session,
    loading,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    resetPassword,
  }), [session, loading, signIn, signUp, signOut, signInWithGoogle, resetPassword]);

  console.log(`AuthProvider Render: loading=${loading}, session=`, session);

  // Restore the original provider return
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Restore useAuth to its original form
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider'); 
  }
  return context;
}