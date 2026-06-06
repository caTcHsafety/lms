import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { clearOfflineVault } from '@/lib/offlineVault';

type Role = 'admin' | 'trainer' | 'mentor' | 'student';

interface AuthState {
  session: Session | null;
  user: User | null;
  role: Role | null;
  mustResetPw: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  role: null,
  mustResetPw: false,
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    role: null,
    mustResetPw: false,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;

    const setLoading = (val: boolean) => {
      if (mounted) {
        setState(s => ({ ...s, isLoading: val }));
      }
    };

    async function fetchProfile(session: Session | null) {
      try {
        if (!navigator.onLine) {
          const cachedRole = localStorage.getItem('cached_role') as Role;
          const cachedMustReset = localStorage.getItem('cached_must_reset_pw') === 'true';
          if (mounted) {
            setState({
              session,
              user: session?.user || null,
              role: cachedRole,
              mustResetPw: cachedMustReset,
              isLoading: false,
            });
          }
          return;
        }

        console.log("AuthContext fetchProfile triggered. session present:", !!session, "email:", session?.user?.email);
        if (!session) {
          console.log("AuthContext fetchProfile: No session. Setting empty auth state.");
          if (mounted) setState(s => ({ ...s, session: null, user: null, role: null, mustResetPw: false, isLoading: false }));
          return;
        }

        if (mounted) {
          setState(s => {
            if (s.user?.id === session.user.id && s.role !== null) {
              return s;
            }
            return { ...s, session, user: session.user, isLoading: true };
          });
        }

        console.log("AuthContext: Fetching profile from database for user ID:", session.user.id);
        const { data, error } = await supabase
          .from('profiles')
          .select('role, must_reset_pw')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error("AuthContext: Error fetching profile from database:", error);
          if (mounted) setState(s => ({ ...s, session, user: session.user, role: null, mustResetPw: false }));
          return;
        }

        console.log("AuthContext: Profile fetched successfully. Data:", data);

        localStorage.setItem('cached_role', data.role);
        localStorage.setItem('cached_must_reset_pw', String(data.must_reset_pw));
        localStorage.setItem('offline_session', JSON.stringify(session));

        if (mounted) {
          console.log("AuthContext: Setting state with role:", data.role, "mustResetPw:", data.must_reset_pw);
          setState({
            session,
            user: session.user,
            role: data.role as Role,
            mustResetPw: data.must_reset_pw || false,
            isLoading: false,
          });
        }
      } catch (err) {
        console.error("AuthContext: Uncaught error in fetchProfile:", err);
        const cachedRole = localStorage.getItem('cached_role') as Role;
        const cachedMustReset = localStorage.getItem('cached_must_reset_pw') === 'true';
        if (mounted) {
          setState(s => ({
            ...s,
            session,
            user: session?.user || null,
            role: cachedRole || null,
            mustResetPw: cachedMustReset || false,
          }));
        }
      } finally {
        setLoading(false);
      }
    }

    // Check current session
    if (!navigator.onLine) {
      const offlineSessionStr = localStorage.getItem('offline_session');
      if (offlineSessionStr) {
        try {
          const offlineSession = JSON.parse(offlineSessionStr);
          fetchProfile(offlineSession);
        } catch (e) {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        fetchProfile(session);
      });
    }

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('cached_role');
        localStorage.removeItem('cached_must_reset_pw');
        localStorage.removeItem('offline_session');
      }
      fetchProfile(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
};
