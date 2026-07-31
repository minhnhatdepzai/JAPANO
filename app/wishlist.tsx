import React from 'react';
import { Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { Header } from '../components/Header';
import { ProductCard } from '../components/ProductCard';
import { useApp } from '../context/AppContext';
import { fontFamily, radius, scaleFont } from '../lib/styles';

export default function WishlistScreen() {
  const { theme, wishlist, removeFromWishlist } = useApp();
  const { width } = useWindowDimensions();
  const columns = width > 760 ? 3 : 2;

  const confirmRemove = (product: any) => {
    Alert.alert(
      'Xóa sản phẩm yêu thích',
      `Bạn có chắc muốn xóa "${product.name || 'sản phẩm'}" khỏi danh sách yêu thích không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xóa', style: 'destructive', onPress: () => removeFromWishlist(product) },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title="Yêu thích" subtitle="Danh sách sản phẩm bạn đã lưu để mua sau, đồng bộ với web qua MongoDB." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        {wishlist.length ? (
          <View style={styles.grid}>
            {wishlist.map((p, index) => (
              <View key={`wishlist-page-${String(p.id || p.slug || p.name)}-${index}`} style={{ width: `${100 / columns - 2}%` }}>
                <View style={[styles.wishlistItem, { backgroundColor: theme.card, borderColor: theme.border }]}> 
                  <ProductCard product={p} />
                  <Pressable style={[styles.removeBtn, { borderColor: theme.border }]} onPress={() => confirmRemove(p)}>
                    <Feather name="trash-2" size={16} color={theme.text} />
                    <Text style={[styles.removeText, { color: theme.text }]}>Xóa</Text>
                  </Pressable>
                </View>
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
  wishlistItem: { borderWidth: 1, borderRadius: 0, overflow: 'hidden', position: 'relative' },
  removeBtn: { position: 'absolute', right: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 0, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.92)' },
  removeText: { fontSize: 12, fontWeight: '900' },
  emptyBox: { borderWidth: 1, borderRadius: 0, padding: 18, gap: 8 },
  emptyTitle: { fontWeight: '900' },
  emptyText: { fontSize: 14, lineHeight: 21 },
});
