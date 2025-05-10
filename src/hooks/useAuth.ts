import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { getSession, signOut as authSignOut, onAuthStateChange } from '../services/auth/authService';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    getSession().then((session) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const subscription = onAuthStateChange((session) => {
      setSession(session);
      setLoading(false);
    });

    // Make sure to check if subscription exists before unsubscribing
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signOut = async () => {
    await authSignOut();
    setSession(null);
  };

  return {
    session,
    loading,
    signOut,
  };
} 