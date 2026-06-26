import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StripeProvider } from '../lib/stripe';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from '../context/AppContext';
import { RoutePersistence } from '../components/RoutePersistence';
import { FloatingButterflies } from '../components/FloatingButterflies';
import { TextThemeRuntime } from '../components/TextThemeRuntime';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const STRIPE_URL_SCHEME = Constants.appOwnership === 'expo' ? Linking.createURL('/--/') : Linking.createURL('');

function RootStack() {
  const { theme } = useApp();
  return (
    <>
      <StatusBar style={theme.background === '#15110F' ? 'light' : 'dark'} backgroundColor={theme.background} translucent />
      <TextThemeRuntime />
      <RoutePersistence />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
        <Stack.Screen name="register" options={{ presentation: 'modal' }} />
        <Stack.Screen name="forgot-password" options={{ presentation: 'modal' }} />
        <Stack.Screen name="cart" options={{ presentation: 'card' }} />
        <Stack.Screen name="wishlist" options={{ presentation: 'card' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
        <Stack.Screen name="admin" options={{ presentation: 'card' }} />
        <Stack.Screen name="checkout" options={{ presentation: 'card' }} />
        <Stack.Screen name="try-on" options={{ presentation: 'card' }} />
        <Stack.Screen name="ai-camera" options={{ presentation: 'card' }} />
        <Stack.Screen name="stylist-quiz" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ai-stylist" options={{ presentation: 'card' }} />
        <Stack.Screen name="body-profile" options={{ presentation: 'card' }} />
        <Stack.Screen name="tryon-history" options={{ presentation: 'card' }} />
        <Stack.Screen name="outfit-collections" options={{ presentation: 'card' }} />
      </Stack>
      <FloatingButterflies />
    </>
  );
}

export default function RootLayout() {
  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.com.leminhnhat123.japanofashionai"
      urlScheme={STRIPE_URL_SCHEME}
    >
      <AppProvider>
        <RootStack />
      </AppProvider>
    </StripeProvider>
  );
}
