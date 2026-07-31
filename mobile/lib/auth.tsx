import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Href, usePathname, useRouter } from 'expo-router';
import { apiLogin, apiRegister, apiMe, setAuthToken, ApiAuthUser } from './api';
import { syncPushToken } from './push';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'staff' | 'admin' | 'super_admin';
};

type AuthContextValue = {
  user: AuthUser | null;
  hydrated: boolean;
  isAuthenticated: boolean;
  signIn: (input: { email: string; password: string }) => Promise<Href | null>;
  register: (input: { name: string; email: string; password: string }) => Promise<Href | null>;
  signOut: () => Promise<void>;
  requireAuth: (target?: Href, replace?: boolean) => boolean;
  continueAsGuest: () => void;
};

// Token thật ký bởi backend (bcrypt + JWT, xem backend/lib/auth.js) — không còn
// là "auth cục bộ" chỉ lưu AsyncStorage như trước. Token vào SecureStore (nhạy
// cảm hơn hồ sơ hiển thị), hồ sơ người dùng vẫn AsyncStorage để đọc nhanh lúc mở app.
const TOKEN_KEY = 'japano_auth_token';
const USER_KEY = '@japano/auth/user/v2';
const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(user: ApiAuthUser): AuthUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const pendingTarget = useRef<Href | null>(null);
  const redirecting = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const cachedRaw = await AsyncStorage.getItem(USER_KEY);
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!token) return;
        setAuthToken(token);
        if (cachedRaw) setUser(toAuthUser(JSON.parse(cachedRaw)));
        // Xác thực lại với backend — token có thể đã hết hạn hoặc bị thu hồi.
        const { user: me } = await apiMe();
        setUser(toAuthUser(me));
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(me));
        void syncPushToken();
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
        await AsyncStorage.removeItem(USER_KEY).catch(() => undefined);
        setAuthToken(null);
        setUser(null);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (pathname !== '/login') redirecting.current = false;
  }, [pathname]);

  const applySession = useCallback(async (token: string, apiUser: ApiAuthUser) => {
    setAuthToken(token);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(apiUser));
    setUser(toAuthUser(apiUser));
    void syncPushToken();
    const target = pendingTarget.current;
    pendingTarget.current = null;
    redirecting.current = false;
    return target;
  }, []);

  const signIn = useCallback(async (input: { email: string; password: string }) => {
    const { token, user: apiUser } = await apiLogin(input);
    return applySession(token, apiUser);
  }, [applySession]);

  const register = useCallback(async (input: { name: string; email: string; password: string }) => {
    const { token, user: apiUser } = await apiRegister(input);
    return applySession(token, apiUser);
  }, [applySession]);

  const signOut = useCallback(async () => {
    pendingTarget.current = null;
    redirecting.current = false;
    setUser(null);
    setAuthToken(null);
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined),
      AsyncStorage.removeItem(USER_KEY).catch(() => undefined),
    ]);
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
    setAuthToken(null);
    void SecureStore.deleteItemAsync(TOKEN_KEY);
    void AsyncStorage.removeItem(USER_KEY);
    router.replace('/(tabs)/products');
  }, [router]);

  return (
    <AuthContext.Provider value={{
      user,
      hydrated,
      isAuthenticated: Boolean(user),
      signIn,
      register,
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
