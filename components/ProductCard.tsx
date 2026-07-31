import React, { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Product } from '../data/catalog';
import { useApp } from '../context/AppContext';
import { fontFamily, radius, scaleFont, shadow } from '../lib/styles';
import { SafeImage } from './SafeImage';

function productIdentity(product: any) {
  return String(product?.id || product?.slug || product?._id || product?.sku || product?.name || '').trim();
}

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { theme, formatCurrency, wishlist, toggleWishlist } = useApp();
  const scale = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [fade]);
  const animatePress = (toValue: number) => Animated.spring(scale, { toValue, useNativeDriver: Platform.OS !== 'web', speed: 22, bounciness: 7 }).start();
  const liked = wishlist.some((item) => productIdentity(item) === productIdentity(product));
  const originalPrice = Number((product as any).originalPrice || 0);
  const hasDiscount = originalPrice > Number(product.price || 0);
  const discountPercent = Number((product as any).discountPercent || (hasDiscount ? Math.round((1 - Number(product.price || 0) / originalPrice) * 100) : 0));
  const width = compact ? 190 : '100%';
  return (
    <Animated.View style={{ width, opacity: fade, transform: [{ scale }] }}>
    <Pressable
      onPressIn={() => animatePress(0.975)}
      onPressOut={() => animatePress(1)}
      onPress={() => router.push(`/product/${product.id}`)}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}
    >
      <View style={[styles.imageWrap, { backgroundColor: theme.background }]}> 
        <SafeImage source={{ uri: product.image }} style={styles.image} resizeMode="cover" />
        {(product.badge || hasDiscount) ? <View style={[styles.badge, { backgroundColor: theme.primary }]}><Text style={[styles.badgeText, { color: theme.background }]}>{hasDiscount ? `GIẢM ${discountPercent}%` : product.badge}</Text></View> : null}
        <Pressable onPress={(e) => { e.stopPropagation(); toggleWishlist(product); }} style={[styles.heart, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Feather name="heart" size={17} color={liked ? theme.primary : theme.muted} />
        </Pressable>
      </View>
      <View style={styles.info}>
        <Text numberOfLines={2} style={[styles.name, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, compact ? 15 : 16) }]}>{product.name}</Text>
        <Text numberOfLines={2} style={[styles.desc, { color: theme.muted, fontSize: scaleFont(theme, 12) }]}>{product.description}</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.price, { color: theme.primary, fontSize: scaleFont(theme, 15) }]}>{formatCurrency(product.price)}</Text>
            {hasDiscount ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={[styles.oldPrice, { color: theme.muted }]}>{formatCurrency(originalPrice)}</Text>
                <View style={{ backgroundColor: theme.primary, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ color: theme.background, fontSize: 9, fontWeight: '900' }}>-{discountPercent}%</Text>
                </View>
              </View>
            ) : null}
          </View>
          <View style={[styles.add, { backgroundColor: theme.primary }]}>
            <Feather name="chevron-right" size={18} color={theme.background} />
          </View>
        </View>
      </View>
    </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 0, padding: 10, gap: 10, overflow: 'hidden' },
  imageWrap: { height: 200, borderRadius: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  badge: { position: 'absolute', left: 10, top: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 0},
  badgeText: { fontSize: 10, fontWeight: '900' },
  heart: { position: 'absolute', right: 10, top: 10, width: 34, height: 34, borderRadius: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  info: { gap: 6 },
  name: { fontWeight: '900', lineHeight: 21 },
  desc: { lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  price: { fontWeight: '900' },
  oldPrice: { marginTop: 2, fontSize: 12, fontWeight: '800', textDecorationLine: 'line-through' },
  add: { width: 36, height: 36, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
});
