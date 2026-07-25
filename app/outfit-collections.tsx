import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Header } from '../components/Header';
import { SafeImage } from '../components/SafeImage';
import { StableTextInput } from '../components/StableTextInput';
import { useApp } from '../context/AppContext';
import { Product } from '../data/catalog';
import { api } from '../lib/api';
import { cardStyle, fontFamily, radius, scaleFont, shadow } from '../lib/styles';

export default function OutfitCollectionsScreen() {
  const { theme, user, wishlist, addToCart } = useApp();
  const userId = user?.id || 'guest';
  const [collections, setCollections] = useState<any[]>([]);
  const [title, setTitle] = useState('Set đi chơi');
  const [occasion, setOccasion] = useState('Đi chơi');

  const load = useCallback(async () => {
    const data = await api.getOutfitCollections(userId).catch(() => ({ collections: [] }));
    setCollections(Array.isArray(data?.collections) ? data.collections : []);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveFromWishlist = async () => {
    if (!wishlist.length) {
      Alert.alert('Chưa có sản phẩm', 'Hãy thêm vài sản phẩm vào yêu thích rồi tạo bộ sưu tập.');
      return;
    }
    try {
      await api.saveOutfitCollection(userId, {
        title,
        occasion,
        description: `Bộ sưu tập tạo từ ${wishlist.length} sản phẩm yêu thích`,
        items: wishlist,
        cover: wishlist[0]?.image || '',
      });
      setTitle('Set đi chơi');
      await load();
      Alert.alert('Đã tạo', 'Bộ sưu tập outfit đã được lưu.');
    } catch (error: any) {
      Alert.alert('Chưa lưu được', error?.message || 'Kiểm tra backend rồi thử lại.');
    }
  };

  const addSetToCart = (items: Product[] = []) => {
    items.forEach((item) => addToCart(item));
  };

  const remove = async (id: string) => {
    await api.deleteOutfitCollection(userId, id).catch(() => null);
    await load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header title="Bộ sưu tập outfit" subtitle="Lưu set đi học, đi chơi, Tết, sinh nhật, công sở, hẹn hò" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[cardStyle(theme), styles.creator]}>
          <Text style={[styles.title, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 23) }]}>Tạo bộ từ mục yêu thích</Text>
          <StableTextInput placeholder="Tên set" value={title} onChangeText={setTitle} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} placeholderTextColor={theme.muted} />
          <StableTextInput placeholder="Dịp sử dụng" value={occasion} onChangeText={setOccasion} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} placeholderTextColor={theme.muted} />
          <Text style={[styles.desc, { color: theme.muted }]}>Hiện có {wishlist.length} sản phẩm yêu thích sẽ được đưa vào set.</Text>
          <Pressable onPress={saveFromWishlist} style={[styles.primaryBtn, { backgroundColor: theme.primary }, shadow(theme)]}> 
            <Feather name="plus-circle" size={17} color={theme.background} />
            <Text style={[styles.primaryText, { color: theme.background }]}>Tạo bộ sưu tập</Text>
          </Pressable>
        </View>

        {collections.length === 0 ? (
          <View style={[cardStyle(theme), styles.empty]}>
            <Feather name="bookmark" size={28} color={theme.primary} />
            <Text style={[styles.emptyTitle, { color: theme.heading }]}>Chưa có bộ sưu tập</Text>
            <Text style={[styles.desc, { color: theme.muted }]}>Bạn có thể lưu set từ AI Stylist, lịch sử thử đồ hoặc mục yêu thích.</Text>
          </View>
        ) : null}

        {collections.map((collection) => (
          <View key={String(collection._id || collection.id)} style={[cardStyle(theme), styles.card]}>
            <View style={styles.collectionHeader}>
              {collection.cover ? <SafeImage source={{ uri: collection.cover }} style={styles.cover} resizeMode="cover" /> : <View style={[styles.cover, { backgroundColor: theme.background }]} />}
              <View style={{ flex: 1 }}>
                <Text style={[styles.collectionTitle, { color: theme.heading, fontFamily: fontFamily(theme) }]}>{collection.title}</Text>
                <Text style={[styles.desc, { color: theme.muted }]}>{collection.occasion || 'Outfit'} · {(collection.items || []).length} món</Text>
              </View>
              <Pressable onPress={() => remove(String(collection._id || collection.id))} style={[styles.smallIcon, { borderColor: theme.border }]}> 
                <Feather name="trash-2" size={17} color={theme.primary} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {(collection.items || []).map((item: Product, index: number) => (
                <Pressable key={`${item.id || index}`} onPress={() => item.id ? router.push(`/product/${item.id}`) : null} style={[styles.product, { borderColor: theme.border, backgroundColor: theme.background }]}> 
                  {item.image ? <SafeImage source={{ uri: item.image }} style={styles.productImage} resizeMode="contain" /> : null}
                  <Text numberOfLines={2} style={[styles.productName, { color: theme.text }]}>{item.name || 'Ảnh thử đồ'}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => addSetToCart(collection.items || [])} style={[styles.outlineBtn, { borderColor: theme.primary }]}> 
              <Feather name="shopping-bag" size={16} color={theme.primary} />
              <Text style={[styles.outlineText, { color: theme.primary }]}>Thêm set vào giỏ</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 100 },
  creator: { padding: 14, gap: 10 },
  title: { fontWeight: '900' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 0, paddingHorizontal: 12, fontWeight: '800' },
  desc: { lineHeight: 20, fontSize: 13 },
  primaryBtn: { height: 48, borderRadius: 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryText: { fontWeight: '900' },
  empty: { padding: 18, gap: 9, alignItems: 'center' },
  emptyTitle: { fontWeight: '900', fontSize: 19 },
  card: { padding: 14, gap: 12 },
  collectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 66, height: 67, borderRadius: 0},
  collectionTitle: { fontSize: 20, fontWeight: '900' },
  smallIcon: { width: 40, height: 40, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { gap: 10 },
  product: { width: 112, borderWidth: 1, borderRadius: 0, padding: 8, gap: 6 },
  productImage: { width: '100%', height: 74, borderRadius: 0},
  productName: { fontWeight: '800', fontSize: 12, lineHeight: 16 },
  outlineBtn: { height: 44, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  outlineText: { fontWeight: '900' },
});
