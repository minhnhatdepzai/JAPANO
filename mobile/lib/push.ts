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

// Lý do lần xin push token gần nhất thất bại. Trước đây toàn bộ hàm nằm trong
// một `catch {}` trống nên khi push im lặng không chạy thì không có cách nào
// biết vì sao — token chưa bao giờ được đăng ký mà không ai hay. Giữ lại lý do
// để màn Cài đặt và log khởi động nói được sự thật.
export type PushStatus =
  | { state: 'unknown' }
  | { state: 'ok'; token: string }
  | { state: 'unsupported'; reason: string }
  | { state: 'denied'; reason: string }
  | { state: 'error'; reason: string };

let lastStatus: PushStatus = { state: 'unknown' };
export const getPushStatus = () => lastStatus;

// Android bắt buộc phải có notification channel thì thông báo mới hiện. Tách
// riêng khỏi luồng lấy token vì thông báo cục bộ (lib/localNotify.ts) vẫn cần
// channel kể cả khi push từ xa chưa dùng được.
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Thông báo JAPANO',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C8452F',
    });
  } catch {
    // Không tạo được channel thì thông báo vẫn có thể hiện ở mức mặc định.
  }
}

// Gọi sau khi đăng nhập/đăng ký thành công và lúc khởi động app nếu đã có
// phiên. Push TỪ XA (Expo Push) cần một EAS projectId và, trên Android bản
// build riêng, cần cả credential FCM — nếu thiếu thì hàm này ghi rõ lý do rồi
// dừng, và app vẫn có thông báo nhờ lib/localNotify.ts.
export async function syncPushToken(): Promise<PushStatus> {
  try {
    await ensureAndroidChannel();

    if (!Device.isDevice) {
      lastStatus = { state: 'unsupported', reason: 'Máy ảo không nhận được push từ xa — hãy chạy trên điện thoại thật.' };
      return lastStatus;
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') {
      lastStatus = { state: 'denied', reason: 'Bạn chưa cho phép JAPANO gửi thông báo.' };
      return lastStatus;
    }

    const extra: any = (Constants as any)?.expoConfig?.extra;
    const projectId = extra?.eas?.projectId || (Constants as any)?.easConfig?.projectId;
    if (!projectId) {
      lastStatus = {
        state: 'unsupported',
        reason: 'Chưa có EAS projectId trong app.json (extra.eas.projectId) nên không lấy được Expo push token. '
          + 'Chạy `eas init` để bật push từ xa; thông báo trong ứng dụng vẫn hoạt động bình thường.',
      };
      return lastStatus;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) {
      lastStatus = { state: 'error', reason: 'Expo không trả về push token.' };
      return lastStatus;
    }
    await registerPushToken(token, Platform.OS);
    lastStatus = { state: 'ok', token };
    return lastStatus;
  } catch (error: any) {
    lastStatus = { state: 'error', reason: String(error?.message || error || 'Lỗi không xác định khi đăng ký push.') };
    return lastStatus;
  }
}
