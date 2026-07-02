import React from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { Header } from '../components/Header';
import { ProductCard } from '../components/ProductCard';
import { useApp } from '../context/AppContext';
import { fontFamily, radius, scaleFont } from '../lib/styles';

export default function WishlistScreen() {
  const { theme, wishlist } = useApp();
  const { width } = useWindowDimensions();
  const columns = width > 760 ? 3 : 2;
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title="Yêu thích" subtitle="Danh sách sản phẩm bạn đã lưu để mua sau, đồng bộ với web qua MongoDB." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        {wishlist.length ? (
          <View style={styles.grid}>
            {wishlist.map((p, index) => (
              <View key={`wishlist-page-${String(p.id || p.name)}-${index}`} style={{ width: `${100 / columns - 2}%` }}>
                <ProductCard product={p} />
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.border }]}> 
            <Text style={[styles.emptyTitle, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 24) }]}>Chưa có sản phẩm yêu thích</Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>Bấm biểu tượng trái tim trên sản phẩm ở Home hoặc Shop để lưu lại.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 150 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  emptyBox: { borderWidth: 1, borderRadius: 0, padding: 18, gap: 8 },
  emptyTitle: { fontWeight: '900' },
  emptyText: { fontSize: 14, lineHeight: 21 },
});
