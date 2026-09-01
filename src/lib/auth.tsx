import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { pullAndMergeHeroBuilds } from './heroLoadoutSync';
import { clearAccountScopedLocalData } from './persistence';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const syncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Pull + merge synced hero builds once per sign-in (not on every re-render).
  useEffect(() => {
    const userId = session?.user.id ?? null;
    if (userId && syncedUserIdRef.current !== userId) {
      syncedUserIdRef.current = userId;
      pullAndMergeHeroBuilds(userId);
    }
    if (!userId) {
      syncedUserIdRef.current = null;
    }
  }, [session]);

  async function signInWithGoogle() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    // Clear this account's board/hero builds from the browser so they don't
    // linger for whoever uses this machine next, then reload so every
    // component re-reads the now-empty state from scratch.
    clearAccountScopedLocalData();
    window.location.reload();
  }

  return (
    <AuthContext.Provider value={{ session, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
