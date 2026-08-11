import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { Href, Stack, useRouter, usePathname, useRootNavigationState, useSegments } from 'expo-router';
import { syncLocalNotifications } from '../lib/localNotify';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../lib/store';
import { CatalogProvider } from '../lib/data';
import { BotChatProvider } from '../lib/botchat';
import { AuthProvider, useAuth } from '../lib/auth';
import { DailyJapanSpot } from '../components/DailyJapanSpot';
import { ShopProvider } from '../lib/shop';
import { ToastProvider } from '../lib/toast';
import { FloatingCartButton } from '../components/FloatingCartButton';
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
  if (['onboarding', 'login', 'register', 'forgot-password', 'culture', 'product', 'category'].includes(root)) return true;
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

// Chạm vào thông báo hệ thống (đã đóng app hoặc đang chạy nền) phải nhảy
// thẳng tới màn hình liên quan — ví dụ thông báo hoàn tiền/huỷ đơn/trả hàng
// đều mang theo data.orderId từ backend (lib/push.js) nên chỉ cần điều hướng
// tới /order/[id]. getLastNotificationResponseAsync() bắt trường hợp app vừa
// mở LÊN từ việc chạm thông báo (listener bên dưới không bắt được lần đầu đó).
// Thông báo cục bộ (lib/localNotify.ts) mang cùng dạng data với push thật, nên
// một hàm điều hướng dùng chung cho cả hai. Ngoài orderId còn có các action
// không gắn đơn hàng — thưởng mục tiêu, bộ thẻ địa danh, đóng góp địa điểm.
const ACTION_ROUTE: Record<string, string> = {
  'flagcard-intro': '/flagcard-intro',
  goals: '/goals',
  'explore-japan': '/explore-japan',
  vouchers: '/(tabs)/me',
  policy: '/policy',
};

function navigateFromPushData(router: ReturnType<typeof useRouter>, data: any) {
  const orderId = data?.orderId ? String(data.orderId) : '';
  if (orderId) { router.push(`/order/${orderId}` as any); return; }
  const action = data?.action ? String(data.action) : '';
  if (ACTION_ROUTE[action]) { router.push(ACTION_ROUTE[action] as any); return; }
  if (action) router.push('/notifications' as any);
}

function PushNotificationRouter() {
  const router = useRouter();

  useEffect(() => {
    let live = true;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (live && response) navigateFromPushData(router, response.notification.request.content.data);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromPushData(router, response.notification.request.content.data);
    });
    return () => { live = false; subscription.remove(); };
  }, [router]);

  return null;
}

// Biến thông báo trên máy chủ thành thông báo hiện thật trên điện thoại. Chỉ
// chạy khi đã đăng nhập và app đang mở; nhịp thưa (25s) vì đây là đường dự
// phòng cho push từ xa, không phải kênh thời gian thực.
const NOTIFICATION_POLL_MS = 25_000;

function NotificationBridge() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => { void syncLocalNotifications(); };
    const start = () => { if (!timer) timer = setInterval(tick, NOTIFICATION_POLL_MS); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

    tick();
    start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') { tick(); start(); } else stop();
    });
    return () => { stop(); subscription.remove(); };
  }, [isAuthenticated]);

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
      <ToastProvider>
      <AuthProvider>
      <ShopProvider>
      <StoreProvider>
      <StatusBar style="dark" />
      <CatalogProvider>
      <BotChatProvider>
      <AuthGate />
      <PushNotificationRouter />
      <NotificationBridge />
      <DailyJapanSpot />
      <Stack screenOptions={{ headerShown:false, contentStyle:{ backgroundColor:'#F4EDE1' }, animation:'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
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
        <Stack.Screen name="policy" />
      </Stack>
      <FloatingCartButton />
      </BotChatProvider>
      </CatalogProvider>
      </StoreProvider>
      </ShopProvider>
      </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
