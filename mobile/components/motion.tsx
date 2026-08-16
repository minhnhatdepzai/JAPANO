import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import { C } from '../theme/tokens';

// ---------------------------------------------------------------------------
// Lớp chuyển động dùng chung cho toàn ứng dụng.
//
// Dự án chưa cài react-native-reanimated và cũng không nên cài chỉ để làm hiệu
// ứng giao diện — Animated có sẵn của React Native chạy được mọi thứ ở đây, và
// tất cả đều dùng useNativeDriver nên chạy trên luồng UI, không giật khi luồng
// JS đang bận (nạp danh sách sản phẩm, chạy recommend, đồng bộ đơn hàng).
//
// Quy ước thời lượng: 120–180ms cho phản hồi chạm, 260–420ms cho xuất hiện.
// Dài hơn nữa là người dùng bắt đầu cảm thấy phải CHỜ hiệu ứng thay vì được nó
// dẫn mắt.
// ---------------------------------------------------------------------------

/**
 * Tôn trọng cài đặt "giảm chuyển động" của hệ điều hành. Người dùng bật nó
 * thường vì chuyển động gây chóng mặt hoặc buồn nôn (rối loạn tiền đình) —
 * bỏ qua cài đặt này là làm ứng dụng không dùng được với họ, nên mọi hiệu ứng
 * ở đây tự tắt và hiện thẳng trạng thái cuối.
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (alive) setReduced(Boolean(value)); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => setReduced(Boolean(value)));
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return reduced;
}

type FadeSlideProps = {
  children: React.ReactNode;
  delay?: number;
  /** Quãng đường trượt lên khi xuất hiện. 0 = chỉ mờ dần. */
  offset?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

/** Xuất hiện: mờ dần + trượt nhẹ lên. Truyền `delay` tăng dần để tạo hiệu ứng lần lượt. */
export function FadeSlideIn({ children, delay = 0, offset = 14, duration = 320, style }: FadeSlideProps) {
  const reduced = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, delay, duration, reduced]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

type PressScaleProps = PressableProps & {
  children: React.ReactNode;
  /** Mức thu nhỏ khi nhấn. 0.96 hợp cho thẻ lớn, 0.93 cho nút nhỏ. */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pressable có phản hồi chạm bằng thu phóng. Trước đây chạm vào thẻ sản phẩm
 * hay nút không có phản hồi tức thì nào — trên máy chậm, người dùng không biết
 * cú chạm đã ăn hay chưa nên bấm lại lần nữa (và tạo đơn trùng).
 */
export function PressScale({ children, scaleTo = 0.96, style, ...rest }: PressScaleProps) {
  const reduced = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) => {
    if (reduced) return;
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  };
  return (
    <Pressable
      {...rest}
      onPressIn={(event) => { to(scaleTo); rest.onPressIn?.(event); }}
      onPressOut={(event) => { to(1); rest.onPressOut?.(event); }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Ô xám nhấp nháy trong lúc chờ dữ liệu — báo "đang tải", khác hẳn "trống rỗng". */
export function Shimmer({ width, height, radius = 8, style }: { width?: number | string; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReduceMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  return (
    <Animated.View
      style={[
        { width: width as number, height, borderRadius: radius, backgroundColor: C.washi2 },
        !reduced && { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.95] }) },
        style,
      ]}
    />
  );
}

/**
 * Thanh tiến trình chạy mượt tới `progress` (0..1) thay vì nhảy cóc. Dùng cho
 * chặng đường đơn hàng và quỹ tích luỹ mục tiêu — nhìn thấy nó CHẠY tới mốc
 * mới là cách rõ nhất để biết "vừa có gì đó tiến lên".
 */
export function ProgressBar({ progress, height = 4, color = C.shu, track = C.line, duration = 520 }:
{ progress: number; height?: number; color?: string; track?: string; duration?: number }) {
  const reduced = useReduceMotion();
  const value = useRef(new Animated.Value(0)).current;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  useEffect(() => {
    if (reduced) { value.setValue(clamped); return; }
    const animation = Animated.timing(value, { toValue: clamped, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [clamped, value, duration, reduced]);
  return (
    <View style={{ height, backgroundColor: track, borderRadius: height, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height,
          borderRadius: height,
          backgroundColor: color,
          width: value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

/**
 * Chấm nhịp cho trạng thái "đang diễn ra" (đơn đang giao, yêu cầu chờ duyệt).
 * Nhịp đập nói được điều mà một chấm tĩnh không nói được: việc này còn đang chạy.
 */
export function PulseDot({ size = 8, color = C.shu }: { size?: number; color?: string }) {
  const reduced = useReduceMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {!reduced && (
        <Animated.View
          style={{
            position: 'absolute',
            width: size, height: size, borderRadius: size, backgroundColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
          }}
        />
      )}
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}
