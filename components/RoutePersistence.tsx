import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import { useEffect } from 'react';

export const LAST_ROUTE_KEY = 'japano.lastRoute';

const ignored = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/try-on',
  '/checkout',
  '/cart',
  '/wishlist',
  '/notifications',
]);

function shouldIgnore(pathname: string) {
  if (ignored.has(pathname)) return true;

  return (
    pathname.startsWith('/try-on') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/wishlist') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password')
  );
}

export function RoutePersistence() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    if (shouldIgnore(pathname)) {
      AsyncStorage.removeItem(LAST_ROUTE_KEY).catch(() => null);
      return;
    }

    AsyncStorage.setItem(LAST_ROUTE_KEY, pathname).catch(() => null);
  }, [pathname]);

  return null;
}

export default RoutePersistence;