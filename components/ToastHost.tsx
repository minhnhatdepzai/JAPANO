// Thanh thông báo nổi bật (toast) — trượt từ trên xuống, có icon, vạch màu thương hiệu, tự ẩn.
// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { toast } from '../lib/toast';
import { fontFamily, onPrimary, scaleFont, shadow } from '../lib/styles';

function accentFor(theme, type) {
  if (type === 'error') return '#C0392B';
  if (type === 'success') return theme.primary;
  return theme.primary;
}

function ToastCard({ item, theme, onClose }) {
  const anim = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(1)).current;
  const accent = accentFor(theme, item.type);
  const duration = item.duration || 2600;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }).start();
    Animated.timing(progress, { toValue: 0, duration, easing: Easing.linear, useNativeDriver: false }).start();
    const t = setTimeout(dismiss, duration);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    Animated.timing(anim, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => onClose(item.id));
  }

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-26, 0] });
  const widthPct = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
      <Pressable onPress={dismiss}>
        <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderLeftWidth: 6, borderLeftColor: accent, paddingVertical: 12, paddingRight: 14, paddingLeft: 12, gap: 12 }, shadow(theme)]}>
          <View style={{ width: 42, height: 42, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name={item.icon || 'check-circle'} size={22} color={onPrimary(theme)} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 15) }}>{item.title}</Text>
            {item.message ? <Text numberOfLines={2} style={{ color: theme.muted, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 12), marginTop: 1 }}>{item.message}</Text> : null}
          </View>
          <Feather name="x" size={18} color={theme.muted} />
        </View>
        <Animated.View style={{ height: 3, backgroundColor: accent, width: widthPct }} />
      </Pressable>
    </Animated.View>
  );
}

export function ToastHost() {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);

  useEffect(() => toast.subscribe((t) => setItems((old) => [...old.slice(-2), t])), []);

  const remove = (id) => setItems((old) => old.filter((x) => x.id !== id));

  if (!items.length) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, zIndex: 9999, gap: 8 }}>
      {items.map((item) => <ToastCard key={item.id} item={item} theme={theme} onClose={remove} />)}
    </View>
  );
}

export default ToastHost;
