import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../theme/tokens';

// Thanh thông báo nổi trong ứng dụng.
//
// Trước đây bấm xong một thao tác (thêm giỏ, gửi đánh giá, gửi đóng góp, nạp
// quỹ mục tiêu…) thì màn hình im lặng: chỉ lỗi mới bật Alert, còn thành công
// không có phản hồi nào nên người dùng không biết đã ăn hay chưa. Provider này
// cấp một hàm toast() dùng chung cho mọi màn hình, hiển thị ngay lập tức và tự
// tắt — độc lập với danh sách "Thông báo" của tài khoản (lib/notifications.ts).

export type ToastKind = 'success' | 'error' | 'info';
export type ToastAction = { label: string; onPress: () => void };
type ToastInput = { message: string; kind?: ToastKind; action?: ToastAction; durationMs?: number };
type ToastEntry = ToastInput & { id: number; kind: ToastKind };

const ToastContext = createContext<{ toast: (input: ToastInput | string, kind?: ToastKind) => void }>({ toast: () => undefined });
export const useToast = () => useContext(ToastContext);

const STYLE: Record<ToastKind, { bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { bg: '#1F6B44', icon: 'checkmark-circle' },
  error: { bg: '#B23A34', icon: 'alert-circle' },
  info: { bg: C.sumi, icon: 'information-circle' },
};

function ToastCard({ entry, onDone }: { entry: ToastEntry; onDone: (id: number) => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  const skin = STYLE[entry.kind];

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => onDone(entry.id));
    };
    Animated.spring(anim, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }).start();
    const timer = setTimeout(finish, entry.durationMs ?? (entry.action ? 5200 : 2800));
    return () => clearTimeout(timer);
  }, [anim, entry, onDone]);

  return (
    <Animated.View
      style={[
        st.card,
        { backgroundColor: skin.bg, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }] },
      ]}
    >
      <Ionicons name={skin.icon} size={19} color="#fff" />
      <Text style={st.text} numberOfLines={3}>{entry.message}</Text>
      {!!entry.action && (
        <Pressable hitSlop={8} onPress={() => { entry.action?.onPress(); onDone(entry.id); }}>
          <Text style={st.action}>{entry.action.label}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastEntry[]>([]);
  const insets = useSafeAreaInsets();
  const nextId = useRef(1);

  const toast = useCallback((input: ToastInput | string, kind: ToastKind = 'success') => {
    const entry: ToastEntry = typeof input === 'string'
      ? { id: nextId.current++, message: input, kind }
      : { ...input, id: nextId.current++, kind: input.kind || kind };
    if (!entry.message?.trim()) return;
    // Giữ tối đa 3 thanh cùng lúc để không che mất nội dung màn hình.
    setItems(current => [...current, entry].slice(-3));
  }, []);

  const remove = useCallback((id: number) => setItems(current => current.filter(item => item.id !== id)), []);
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {!!items.length && (
        <View pointerEvents="box-none" style={[st.host, { top: insets.top + 8 }]}>
          {items.map(entry => <ToastCard key={entry.id} entry={entry} onDone={remove} />)}
        </View>
      )}
    </ToastContext.Provider>
  );
}

const st = StyleSheet.create({
  host: { position: 'absolute', left: 12, right: 12, zIndex: 9999, gap: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
  },
  text: { flex: 1, color: '#fff', fontFamily: F.bodyM, fontSize: 12.5, lineHeight: 18 },
  action: { color: '#F6D6B4', fontFamily: F.bodyX, fontSize: 12 },
});
