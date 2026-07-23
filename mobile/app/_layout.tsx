import React, { useEffect } from 'react';
import { Href, Stack, usePathname, useRootNavigationState, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../lib/store';
import { CatalogProvider } from '../lib/data';
import { BotChatProvider } from '../lib/botchat';
import { AuthProvider, useAuth } from '../lib/auth';
import { DailyJapanSpot } from '../components/DailyJapanSpot';
import { ShopProvider } from '../lib/shop';
import {
  useFonts,
  Arimo_400Regular,
  Arimo_500Medium,
  Arimo_600SemiBold,
  Arimo_700Bold,
} from '@expo-google-fonts/arimo';

SplashScreen.preventAutoHideAsync();

const guestCanOpen = (segments: string[]) => {
  const [root, child] = segments;
  if (!root || root === 'index') return true;
  if (['onboarding', 'login', 'register', 'culture', 'product', 'category'].includes(root)) return true;
  return root === '(tabs)' && (!child || child === 'index' || child === 'products');
};

function AuthGate() {
  const segments = useSegments() as string[];
  const pathname = usePathname();
  const rootNavigation = useRootNavigationState();
  const { hydrated, isAuthenticated, requireAuth } = useAuth();
  const publicRoute = guestCanOpen(segments);

  useEffect(() => {
    if (rootNavigation?.key && hydrated && !isAuthenticated && !publicRoute) {
      requireAuth(pathname as Href, true);
    }
  }, [hydrated, isAuthenticated, pathname, publicRoute, requireAuth, rootNavigation?.key]);

  return null;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Arimo_400Regular, Arimo_500Medium, Arimo_600SemiBold, Arimo_700Bold,
  });
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);
  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
      <ShopProvider>
      <StoreProvider>
      <StatusBar style="dark" />
      <CatalogProvider>
      <BotChatProvider>
      <AuthGate />
      <DailyJapanSpot />
      <Stack screenOptions={{ headerShown:false, contentStyle:{ backgroundColor:'#F4EDE1' }, animation:'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="daily" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="culture" />
        <Stack.Screen name="product/[slug]" />
        <Stack.Screen name="category/[cat]" />
        <Stack.Screen name="camera" />
        <Stack.Screen name="tryon" />
        <Stack.Screen name="goals" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="success" options={{ animation:'fade' }} />
        <Stack.Screen name="payment-result" options={{ animation:'fade' }} />
        <Stack.Screen name="addresses" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="flagcards" />
        <Stack.Screen name="flagcard-intro" options={{ presentation:'transparentModal', animation:'slide_from_bottom' }} />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings" />
      </Stack>
      </BotChatProvider>
      </CatalogProvider>
      </StoreProvider>
      </ShopProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
