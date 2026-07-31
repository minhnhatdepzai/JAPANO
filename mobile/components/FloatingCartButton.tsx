import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../lib/store';
import { C, F } from '../theme/tokens';

/** Lối tắt tới giỏ hàng, xuất hiện toàn cục ngay khi người dùng có sản phẩm. */
export function FloatingCartButton() {
  const { cartCount } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);
  const previousCount = useRef(cartCount);

  useEffect(() => {
    // Người dùng đã tắt thì giữ trạng thái đó qua các màn hình. Khi họ thêm
    // một món mới, lối tắt xuất hiện lại để hỗ trợ đi thanh toán.
    if (cartCount > previousCount.current) setDismissed(false);
    previousCount.current = cartCount;
  }, [cartCount]);

  // Không phụ thuộc route: nút theo người dùng qua mọi màn hình và chỉ biến mất
  // sau khi giỏ được làm trống hoặc người dùng chủ động bấm dấu ×.
  if (!cartCount || dismissed) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mở giỏ hàng, có ${cartCount} sản phẩm`}
      onPress={() => router.push('/cart')}
      style={({ pressed }) => [styles.button, { bottom: Math.max(insets.bottom + 78, 94) }, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="cart" size={23} color="#fff" />
        <View style={styles.badge}><Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text></View>
      </View>
      <Pressable
        accessibilityLabel="Ẩn nút giỏ hàng"
        hitSlop={7}
        onPress={(event) => { event.stopPropagation(); setDismissed(true); }}
        style={styles.closeButton}
      >
        <Ionicons name="close" size={13} color="#fff" />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute', left: 14, zIndex: 950, elevation: 16,
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: C.ai, borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 9, shadowOffset: { width: 0, height: 5 },
  },
  pressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -4, top: -5, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, backgroundColor: C.shu, borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontFamily: F.bodyB, fontSize: 9 },
  closeButton: { position:'absolute', right:-6, top:-7, width:23, height:23, borderRadius:12, backgroundColor:C.sumi, borderWidth:2, borderColor:'#fff', alignItems:'center', justifyContent:'center', elevation:18 },
});
