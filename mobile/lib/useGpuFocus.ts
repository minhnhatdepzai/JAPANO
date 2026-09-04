import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { reportGpuFocus, GpuFocus } from './api';
import { useFocusEffect } from 'expo-router';

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

// Số tác vụ GPU do chính người dùng bấm chạy và đang chờ kết quả.
//
// Màn thử đồ khai báo focus nền là 'browse', mà 'browse' nằm trong danh sách
// huỷ job 'tryon' của backend (lib/gpuArbiter.js → cancellationTargets). Vì vậy
// mỗi lần AppState đổi giữa chừng — màn hình tự mờ rồi tắt, kéo thanh thông báo
// xuống, nhận cuộc gọi — hook lại bắn 'browse' và giết luôn tác vụ thử đồ đang
// chạy dở 45–90 giây, kèm thông báo sai "bạn chuyển sang tính năng khác".
//
// Trong lúc còn tác vụ đang chạy thì KHÔNG bắn tín hiệu focus khác nữa. Tín
// hiệu cuối cùng (về nền hoặc sang màn khác) được nhớ lại và gửi ngay khi job
// kết thúc. Nhờ vậy người dùng có thể bấm Home/mở app khác, hoặc lướt sang màn
// khác trong JAPANO, mà request vẫn chạy; GPU cũng không bị giữ sai sau đó.
let gpuJobsInFlight = 0;
let deferredFocus: GpuFocus | null = null;
export function beginGpuJob() { gpuJobsInFlight += 1; }
export function endGpuJob() {
  gpuJobsInFlight = Math.max(0, gpuJobsInFlight - 1);
  if (gpuJobsInFlight === 0 && deferredFocus) {
    const nextFocus = deferredFocus;
    deferredFocus = null;
    void reportGpuFocus(nextFocus);
  }
}

export function useGpuFocus(focus: GpuFocus, fallback: GpuFocus = 'browse') {
  const activeRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      const reportForState = (state: string) => {
        const active = state === 'active';
        activeRef.current = active;
        if (gpuJobsInFlight > 0) {
          deferredFocus = active ? focus : fallback;
          return;
        }
        deferredFocus = null;
        void reportGpuFocus(active ? focus : fallback);
      };
      reportForState(AppState.currentState);
      const subscription = AppState.addEventListener('change', reportForState);
      return () => {
        activeRef.current = false;
        subscription.remove();
        if (gpuJobsInFlight > 0) deferredFocus = fallback;
        else void reportGpuFocus(fallback);
      };
    }, [fallback, focus]),
  );
  return activeRef;
}
