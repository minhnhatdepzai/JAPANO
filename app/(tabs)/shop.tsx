import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { categories, products } from '../../data/catalog';
import { Header } from '../../components/Header';
import { ProductCard } from '../../components/ProductCard';
import { SafeImage } from '../../components/SafeImage';
import { useApp } from '../../context/AppContext';
import { fontFamily, radius, shadow } from '../../lib/styles';
import { AISearchBox } from '../../components/AISearchBox';
import { ShopQuickActions } from '../../components/ShopQuickActions';
import { getSpecialRecommendation } from '../../data/occasions';
import { isConversationalSearch, normalizeSearchText, rankProductsForQuery } from '../../lib/aiSearch';

export default function ShopScreen() {
  const params = useLocalSearchParams<{ category?: string; q?: string }>();
  const { theme, user, addSearchTerm } = useApp();
  const { width } = useWindowDimensions();
  const columns = width > 760 ? 3 : 2;
  const [categoryId, setCategoryId] = useState(params.category || categories[0].id);
  const [subCategoryId, setSubCategoryId] = useState<string>('all');
  const [query, setQuery] = useState(String(params.q || ''));
  const occasion = useMemo(() => getSpecialRecommendation(new Date(), user || undefined), [user?.birthday, user?.specialDates]);

  const current = categories.find((c) => c.id === categoryId) || categories[0];
  const filtered = useMemo(() => {
    const base = products.filter((p) => {
      const okCat = p.category === categoryId;
      const okSub = subCategoryId === 'all' || p.subcategory === subCategoryId;
      return okCat && okSub;
    });
    const q = normalizeSearchText(query);
    if (!q) return base;
    if (isConversationalSearch(query)) {
      const ranked = rankProductsForQuery(query, base, occasion);
      return ranked.length ? ranked.map((item) => item.product) : base;
    }
    return base.filter((p) => normalizeSearchText(`${p.name} ${p.description} ${p.story} ${p.subcategory} ${(p.visualTags || []).join(' ')}`).includes(q));
  }, [categoryId, subCategoryId, query, occasion?.key]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header title="Cửa hàng" subtitle="Danh mục lớn nào cũng có mục nhỏ, kéo ngang để lọc nhanh." />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator keyboardShouldPersistTaps="always" keyboardDismissMode="none">
        <ShopQuickActions />
        <AISearchBox
          value={query}
          onChangeText={setQuery}
          occasion={occasion}
          placeholder="Tìm sản phẩm hoặc hỏi AI: hôm nay mặc gì đây?"
          onSubmitQuery={(text) => addSearchTerm(text)}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.horizontalList}>
          {categories.map((cat) => {
            const active = cat.id === categoryId;
            return (
              <Pressable key={cat.id} onPress={() => { setCategoryId(cat.id); setSubCategoryId('all'); }} style={[styles.bigCat, { backgroundColor: active ? theme.primary : theme.card, borderColor: active ? theme.primary : theme.border }, shadow(theme)]}>
                <SafeImage source={cat.image} style={styles.bigCatImage} />
                <Text style={[styles.bigCatTitle, { color: active ? theme.background : theme.heading, fontFamily: fontFamily(theme) }]}>{cat.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[styles.subTitle, { color: theme.heading, fontFamily: fontFamily(theme) }]}>{current.name}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.subList}>
          <Pressable onPress={() => setSubCategoryId('all')} style={[styles.chip, { backgroundColor: subCategoryId === 'all' ? theme.primary : theme.card, borderColor: subCategoryId === 'all' ? theme.primary : theme.border }]}> 
            <Text style={[styles.chipText, { color: subCategoryId === 'all' ? theme.background : theme.text }]}>Tất cả</Text>
          </Pressable>
          {current.subcategories.map((sub) => {
            const active = sub.id === subCategoryId;
            return (
              <Pressable key={sub.id} onPress={() => setSubCategoryId(sub.id)} style={[styles.subCard, { backgroundColor: active ? theme.primary : theme.card, borderColor: active ? theme.primary : theme.border }]}> 
                <SafeImage source={{ uri: sub.image }} style={styles.subImage} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[styles.subName, { color: active ? theme.background : theme.heading }]}>{sub.name}</Text>
                  <Text numberOfLines={2} style={[styles.subDesc, { color: active ? theme.background : theme.muted }]}>{sub.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.countRow}>
          <Text style={[styles.count, { color: theme.muted }]}>{filtered.length} sản phẩm</Text>
          <Text style={[styles.count, { color: theme.primary }]}>{query.trim() ? 'Đang lọc bằng AI Search' : 'Ảnh giữ tỷ lệ, không cắt mất'}</Text>
        </View>

        <View style={styles.grid}> 
          {filtered.map((p, index) => (
            <View key={`shop-product-${String(p.id || p.name)}-${index}`} style={{ width: `${100 / columns - 2}%` }}><ProductCard product={p} /></View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120, gap: 14 },
  search: { height: 52, borderWidth: 1, borderRadius: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  input: { flex: 1, height: '100%', fontSize: 14 },
  horizontalList: { gap: 12, paddingVertical: 4 },
  bigCat: { width: 112, borderWidth: 1, borderRadius: 0, padding: 10, gap: 8, alignItems: 'center' },
  bigCatImage: { width: 72, height: 72, borderRadius: 0},
  bigCatTitle: { fontSize: 14, fontWeight: '900', textAlign: 'center' },
  subTitle: { fontSize: 26, fontWeight: '900', marginTop: 8 },
  subList: { gap: 10, paddingBottom: 4 },
  chip: { borderWidth: 1, borderRadius: 0, paddingHorizontal: 18, justifyContent: 'center', height: 74 },
  chipText: { fontWeight: '900' },
  subCard: { width: 230, minHeight: 74, borderWidth: 1, borderRadius: 0, padding: 8, flexDirection: 'row', gap: 10, alignItems: 'center' },
  subImage: { width: 58, height: 58, borderRadius: 0},
  subName: { fontSize: 14, fontWeight: '900' },
  subDesc: { marginTop: 2, fontSize: 11, lineHeight: 15 },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  count: { fontSize: 12, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
});
