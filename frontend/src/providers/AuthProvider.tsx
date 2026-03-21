'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  createWallet,
  saveWallet,
  loadWallet,
  removeWallet,
  type AutoWallet,
} from '@/lib/wallet';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  wallet: AutoWallet | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  wallet: null,
  loading: true,
  signUp: async () => ({}),
  signIn: async () => ({}),
  signOut: async () => {},
  isAuthenticated: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<AutoWallet | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize: check existing session
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleUserSession(session.user);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          handleUserSession(session.user);
        } else {
          setUser(null);
          setWallet(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * When user logs in, load or create their auto-wallet.
   */
  function handleUserSession(u: User) {
    setUser(u);

    // Try to load existing wallet from localStorage
    let w = loadWallet(u.id);

    if (!w) {
      // Check if wallet address is stored in user metadata
      const metaAddress = u.user_metadata?.wallet_address;

      // Generate new wallet
      w = createWallet();
      saveWallet(u.id, w);

      // Store address in user metadata if not already there
      if (!metaAddress && supabase) {
        supabase.auth.updateUser({
          data: { wallet_address: w.address },
        });
      }
    }

    setWallet(w);
  }

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: 'Auth not configured. Set NEXT_PUBLIC_SUPABASE_ANON_KEY.' };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });

    if (error) return { error: error.message };

    // If user is immediately confirmed (e.g., in dev mode), set up wallet
    if (data.user && data.session) {
      handleUserSession(data.user);
    }

    return {};
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: 'Auth not configured. Set NEXT_PUBLIC_SUPABASE_ANON_KEY.' };

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { error: error.message };
    if (data.user) {
      handleUserSession(data.user);
    }
    return {};
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setWallet(null);
  }, []);

  return (
    <AuthContext
      value={{
        user,
        wallet,
        loading,
        signUp,
        signIn,
        signOut,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext>
  );
}
