import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApp } from '../context/AppContext';
import { radius, shadow } from '../lib/styles';

export function ShopQuickActions({ compact = false }: { compact?: boolean }) {
  const { theme, cart, wishlist, orders } = useApp();
  const pendingOrders = orders.filter((order) => !/delivered|completed|cancelled/i.test(String(order.status || ''))).length;
  const notificationCount = Math.min(9, pendingOrders + (cart.length ? 1 : 0));
  const items = [
    { label: 'Giỏ hàng', icon: 'shopping-bag' as const, count: cart.length, href: '/cart' },
    { label: 'Yêu thích', icon: 'heart' as const, count: wishlist.length, href: '/wishlist' },
    { label: 'Thông báo', icon: 'bell' as const, count: notificationCount, href: '/notifications' },
    { label: 'AI Stylist', icon: 'zap' as const, count: 0, href: '/ai-stylist' },
    { label: 'Camera AI', icon: 'camera' as const, count: 0, href: '/ai-camera' },
  ];

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {items.map((item) => (
        <Pressable
          key={item.label}
          accessibilityLabel={item.label}
          onPress={() => router.push(item.href as any)}
          style={[
            styles.button,
            compact && styles.buttonCompact,
            { backgroundColor: theme.card, borderColor: theme.border },
            shadow(theme),
          ]}
        >
          <Feather name={item.icon} size={compact ? 23 : 24} color={theme.primary} />
          {item.count > 0 ? (
            <View style={[styles.badge, compact && styles.badgeCompact, { backgroundColor: theme.primary }]}> 
              <Text style={[styles.badgeText, { color: theme.background }]}>{item.count}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'flex-start' },
  rowCompact: { flex: 1, justifyContent: 'flex-end', gap: 6 },
  button: { width: 54, height: 54, borderWidth: 1, borderRadius: 0, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  buttonCompact: { width: 40, height: 40, minWidth: 40, borderRadius: 0},
  badge: { position: 'absolute', top: -6, right: -6, minWidth: 21, height: 21, borderRadius: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeCompact: { top: -6, right: -6, minWidth: 20, height: 20 },
  badgeText: { fontSize: 11, fontWeight: '900' },
});
