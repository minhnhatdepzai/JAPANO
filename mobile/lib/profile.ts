import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StyleProfile } from './api';

const PROFILE_KEY = '@japano/style-profile/v1';

/**
 * Thế hệ của bộ ước lượng vóc dáng đang chạy.
 *
 * Ước lượng đã lưu trên máy là số do MỘT PHIÊN BẢN CỤ THỂ của model sinh ra. Khi
 * model được sửa, những con số cũ không tự biến mất — máy Redmi test vẫn hiện
 * "202 cm / 117 kg" trong ô chiều cao/cân nặng nhiều ngày sau khi bộ ước lượng
 * sinh ra chúng đã bị thay, vì chúng nằm trong AsyncStorage chứ không phải trong
 * response.
 *
 * Tăng số này mỗi khi bộ ước lượng thay đổi tới mức số cũ không còn dùng được.
 * Số đo do CHÍNH NGƯỜI DÙNG nhập không bao giờ bị xoá — chỉ ước lượng của AI.
 *
 *   2 — 2026-08-28: tách tay khỏi thân, chiều cao chuyển sang prior dân số,
 *       hồi quy train lại và hiệu chuẩn theo BodyM. Ước lượng của thế hệ 1
 *       (đầu ra kiểu 202cm/117kg) bị loại bỏ.
 *   3 — 2026-08-29: 5 mẫu chuyển thành anchor chạy ngầm; app tự áp size được
 *       backend chọn và không còn lưu kết quả của mẫu như số đo người dùng.
 */
export const BODY_ESTIMATOR_GENERATION = 3;

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
  /** Thế hệ bộ ước lượng đã sinh ra heightEstimateCm/weightEstimateKg. */
  estimatorGeneration?: number;
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

/**
 * Bỏ ước lượng do thế hệ model cũ sinh ra, giữ nguyên mọi thứ người dùng tự nhập.
 */
export function dropStaleEstimates(profile: SavedStyleProfile): SavedStyleProfile {
  const hasEstimate = profile.heightEstimateCm != null || profile.weightEstimateKg != null;
  if (!hasEstimate || profile.estimatorGeneration === BODY_ESTIMATOR_GENERATION) return profile;
  const cleaned: SavedStyleProfile = {
    ...profile,
    heightEstimateCm: undefined,
    weightEstimateKg: undefined,
    estimateConfidence: undefined,
    heightEstimateConfidence: undefined,
    weightEstimateConfidence: undefined,
    estimatorGeneration: undefined,
  };
  // `measurementSource: 'image-estimation'` là thứ khiến màn hình thử đồ điền
  // sẵn con số ước lượng. Bỏ ước lượng mà giữ cờ này thì ô nhập vẫn trống nhưng
  // app vẫn tin là đang dùng ước lượng.
  if (cleaned.heightSource === 'image-estimation') cleaned.heightSource = undefined;
  if (cleaned.weightSource === 'image-estimation') cleaned.weightSource = undefined;
  if (cleaned.measurementSource === 'image-estimation') cleaned.measurementSource = undefined;
  return cleaned;
}

export async function loadStyleProfile(): Promise<SavedStyleProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    const stored = raw ? { ...DEFAULT_STYLE_PROFILE, ...JSON.parse(raw) } : DEFAULT_STYLE_PROFILE;
    const cleaned = dropStaleEstimates(stored);
    if (cleaned !== stored) {
      // Ghi lại ngay để lần mở sau không phải dọn lại, và để mọi màn hình khác
      // đọc profile cũng thấy bản đã dọn.
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(cleaned)).catch(() => {});
    }
    return cleaned;
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
