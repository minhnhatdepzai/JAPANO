import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StyleProfile } from './api';

const PROFILE_KEY = '@japano/style-profile/v1';

export type SavedStyleProfile = StyleProfile & {
  style: string;
  lastQuizDate?: string;
  streak?: number;
  /**
   * Số liệu AI ước lượng từ ảnh được lưu RIÊNG, không ghi đè height/weight do
   * người dùng tự nhập. Nhờ vậy màn hình luôn phân biệt được đâu là số đo thật
   * và đâu là ước lượng, và người dùng có thể huỷ dùng ước lượng bất cứ lúc nào.
   */
  heightEstimateCm?: number;
  weightEstimateKg?: number;
  estimateConfidence?: number;
  heightEstimateConfidence?: number;
  weightEstimateConfidence?: number;
  heightSource?: 'user' | 'image-estimation';
  weightSource?: 'user' | 'image-estimation';
  measurementSource?: 'user' | 'image-estimation';
};

export const DEFAULT_STYLE_PROFILE: SavedStyleProfile = {
  style: 'toi-gian',
  // Không điền sẵn 165 như thể đó là số đo thật của khách. Khi chưa có dữ liệu,
  // backend tự fallback size M; body analysis vẫn được quyền ước lượng từ ảnh.
  height: '',
  weight: '',
  bust: '',
  waist: '',
  hip: '',
  shoulder: '',
  streak: 0,
};

export async function loadStyleProfile(): Promise<SavedStyleProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? { ...DEFAULT_STYLE_PROFILE, ...JSON.parse(raw) } : DEFAULT_STYLE_PROFILE;
  } catch {
    return DEFAULT_STYLE_PROFILE;
  }
}

export async function saveStyleProfile(patch: Partial<SavedStyleProfile>) {
  const current = await loadStyleProfile();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  return next;
}
