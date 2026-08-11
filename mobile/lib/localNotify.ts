import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { fetchNotifications, Noti } from './notifications';
import { ensureAndroidChannel } from './push';

// ---------------------------------------------------------------------------
// Vì sao có file này
//
// Backend đã gửi push thật qua Expo Push API (backend/lib/push.js) cho hàng
// chục sự kiện: đơn hàng đổi trạng thái, hoàn tiền, voucher, thưởng mục tiêu…
// Nhưng push TỪ XA đòi hỏi một EAS projectId (và credential FCM trên Android),
// mà dự án chưa có — nên bảng push_tokens rỗng và chưa từng có thông báo nào
// hiện lên máy.
//
// Cầu nối này lấp đúng khoảng trống đó: khi app đang mở, nó theo dõi thông báo
// của chính người dùng trên máy chủ và dựng lại thành THÔNG BÁO CỤC BỘ — vẫn
// hiện ở khay thông báo Android/iOS, vẫn kêu, vẫn bấm vào mở đúng màn hình.
// Không cần tài khoản EAS, không cần FCM.
//
// Khi bật push từ xa sau này, giữ nguyên file này vẫn an toàn: mỗi thông báo
// chỉ hiện một lần nhờ danh sách id đã hiện ở dưới.
// ---------------------------------------------------------------------------

const SEEN_KEY = '@japano/notifications/presented/v1';
const MAX_SEEN = 300;
// Không dội bom khay thông báo: mỗi nhịp chỉ hiện tối đa vài cái mới nhất.
const MAX_PER_TICK = 3;

type SeenState = { ids: string[]; baselineAt: number };

async function loadSeen(): Promise<SeenState | null> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ids: Array.isArray(parsed?.ids) ? parsed.ids.map(String) : [], baselineAt: Number(parsed?.baselineAt) || 0 };
  } catch { return null; }
}

async function saveSeen(state: SeenState): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify({ ids: state.ids.slice(-MAX_SEEN), baselineAt: state.baselineAt }));
  } catch { /* hết dung lượng thì lần sau ghi lại */ }
}

// Thông báo cũ trong tài khoản không phải là "tin mới" với người dùng. Lần chạy
// đầu tiên chỉ ghi mốc thời gian rồi im lặng, tránh cảnh vừa đăng nhập đã nhận
// vài chục thông báo cũ cùng lúc.
async function baseline(list: Noti[]): Promise<SeenState> {
  const state: SeenState = { ids: list.map((item) => item.id), baselineAt: Date.now() };
  await saveSeen(state);
  return state;
}

function routeData(noti: Noti): Record<string, unknown> {
  const orderMatch = String(noti.action || '').match(/^order:(.+)$/);
  return {
    notificationId: noti.id,
    type: noti.type || 'Hệ thống',
    ...(orderMatch ? { orderId: orderMatch[1] } : {}),
    ...(noti.action && !orderMatch ? { action: noti.action } : {}),
  };
}

async function present(noti: Noti): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: noti.title || 'JAPANO',
      body: noti.body || '',
      data: routeData(noti),
      sound: 'default',
    },
    trigger: null, // hiện ngay
  });
}

/**
 * Đối chiếu thông báo trên máy chủ với những cái đã hiện, và hiện phần còn
 * thiếu. Tự nuốt lỗi — mất mạng hay chưa cấp quyền thì bỏ qua êm.
 */
export async function syncLocalNotifications(): Promise<number> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') return 0;
    await ensureAndroidChannel();

    const list = await fetchNotifications();
    if (!list.length) return 0;

    const seen = await loadSeen();
    if (!seen) { await baseline(list); return 0; }

    const known = new Set(seen.ids);
    const fresh = list
      .filter((item) => !known.has(item.id) && item.at > seen.baselineAt)
      .sort((a, b) => a.at - b.at)
      .slice(-MAX_PER_TICK);

    // Kể cả khi không hiện cái nào, vẫn ghi nhận toàn bộ id đã thấy để những
    // thông báo cũ hơn mốc không bị xét lại ở nhịp sau.
    const nextIds = [...seen.ids, ...list.map((item) => item.id).filter((id) => !known.has(id))];
    await saveSeen({ ids: nextIds, baselineAt: seen.baselineAt });

    for (const item of fresh) {
      // eslint-disable-next-line no-await-in-loop
      await present(item);
    }
    return fresh.length;
  } catch {
    return 0;
  }
}

/** Dùng cho nút "Gửi thử" trong Cài đặt — kiểm tra thông báo có hiện được không. */
export async function sendTestNotification(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    const status = existing.status === 'granted'
      ? 'granted'
      : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return false;
    await ensureAndroidChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'JAPANO · Thông báo thử',
        body: 'Nếu bạn thấy thông báo này ở khay thông báo thì mọi thứ đã hoạt động ✓',
        data: { type: 'Hệ thống' },
        sound: 'default',
      },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}
