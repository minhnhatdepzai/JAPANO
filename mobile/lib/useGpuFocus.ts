import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { reportGpuFocus, GpuFocus } from './api';

/**
 * Khai báo màn hình này cần GPU cho tính năng nào.
 *
 * Máy demo chỉ có một GPU ~16 GB trong khi thử đồ (FASHN/FLUX), tạo chuyển động
 * (One-to-All, cần ~13,5 GB) và chatbot/vision (Ollama, ~7 GB) đều tranh nhau.
 * Khi màn hình được mở, hook báo cho backend để nhả VRAM của các tính năng khác;
 * khi rời màn hình, quyền ưu tiên trả về mặc định ('browse' — không giữ GPU).
 *
 * Chỉ là tín hiệu tối ưu tài nguyên: gọi thất bại cũng không ảnh hưởng chức năng,
 * vì backend vẫn tự điều phối GPU ngay trước mỗi tác vụ nặng.
 */
export function useGpuFocus(focus: GpuFocus, fallback: GpuFocus = 'browse') {
  const activeRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      const reportForState = (state: string) => {
        const active = state === 'active';
        activeRef.current = active;
        void reportGpuFocus(active ? focus : fallback);
      };
      reportForState(AppState.currentState);
      const subscription = AppState.addEventListener('change', reportForState);
      return () => {
        activeRef.current = false;
        subscription.remove();
        void reportGpuFocus(fallback);
      };
    }, [fallback, focus]),
  );
  return activeRef;
}
