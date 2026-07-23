import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Href, usePathname, useRouter } from 'expo-router';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

type AuthInput = {
  id?: string;
  name?: string;
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  hydrated: boolean;
  isAuthenticated: boolean;
  signIn: (input: AuthInput) => Promise<Href | null>;
  register: (input: AuthInput) => Promise<Href | null>;
  signOut: () => Promise<void>;
  requireAuth: (target?: Href, replace?: boolean) => boolean;
  continueAsGuest: () => void;
};

const AUTH_KEY = '@japano/auth/v1';
const AuthContext = createContext<AuthContextValue | null>(null);

const normalizeUser = (input: AuthInput): AuthUser => {
  const email = input.email.trim().toLowerCase();
  const fallbackName = email.split('@')[0] || 'Thành viên JAPANO';
  return {
    id: String(input.id || email || 'japano-member'),
    name: input.name?.trim() || fallbackName,
    email,
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const pendingTarget = useRef<Href | null>(null);
  const redirecting = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_KEY)
      .then(raw => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved?.id && saved?.email) setUser(saved as AuthUser);
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (pathname !== '/login') redirecting.current = false;
  }, [pathname]);

  const authenticate = useCallback(async (input: AuthInput) => {
    const next = normalizeUser(input);
    setUser(next);
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(next));
    const target = pendingTarget.current;
    pendingTarget.current = null;
    redirecting.current = false;
    return target;
  }, []);

  const signOut = useCallback(async () => {
    pendingTarget.current = null;
    redirecting.current = false;
    setUser(null);
    await AsyncStorage.removeItem(AUTH_KEY);
  }, []);

  const requireAuth = useCallback((target?: Href, replace = false) => {
    if (user) return true;
    if (!redirecting.current) {
      pendingTarget.current = target || (pathname as Href) || '/(tabs)/products';
      redirecting.current = true;
      if (replace) router.replace('/login');
      else router.push('/login');
    }
    return false;
  }, [pathname, router, user]);

  const continueAsGuest = useCallback(() => {
    pendingTarget.current = null;
    redirecting.current = false;
    setUser(null);
    void AsyncStorage.removeItem(AUTH_KEY);
    router.replace('/(tabs)/products');
  }, [router]);

  return (
    <AuthContext.Provider value={{
      user,
      hydrated,
      isAuthenticated: Boolean(user),
      signIn: authenticate,
      register: authenticate,
      signOut,
      requireAuth,
      continueAsGuest,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
