import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { registerPushToken } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Gọi sau khi đăng nhập/đăng ký thành công và lúc khởi động app nếu đã có
// phiên — xin quyền, lấy Expo push token, và đăng ký với backend. Máy ảo/chưa
// cấp quyền/mất mạng thì bỏ qua êm, không chặn luồng chính (đăng nhập vẫn OK
// dù không có push).
export async function syncPushToken(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const projectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (token) await registerPushToken(token, Platform.OS);
  } catch {
    // Không có quyền / không phải máy thật / mất mạng — bỏ qua.
  }
}
