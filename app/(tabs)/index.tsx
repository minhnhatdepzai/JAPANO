import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { categories, products } from '../../data/catalog';
import { getOccasionProducts, getSpecialRecommendation } from '../../data/occasions';
import { useApp } from '../../context/AppContext';
import { fontFamily, radius, scaleFont, shadow } from '../../lib/styles';
import { SafeImage } from '../../components/SafeImage';
import { ProductCard } from '../../components/ProductCard';
import { AISearchBox } from '../../components/AISearchBox';
import { goBackOrReplace } from '../../lib/navigation';
import { ShopQuickActions } from '../../components/ShopQuickActions';
import { api } from '../../lib/api';

export default function HomeScreen() {
  const { theme, user, recentlyViewed } = useApp();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const columns = width > 760 ? 3 : 2;
  const [homeQuery, setHomeQuery] = useState('');
  const occasion = useMemo(() => getSpecialRecommendation(new Date(), user || undefined), [user?.birthday, user?.specialDates]);
  const occasionProducts = getOccasionProducts(occasion);
  const fade = useRef(new Animated.Value(0)).current;
  React.useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: Platform.OS !== 'web' }).start(); }, []);

  // Gợi ý cho bạn: cá nhân hoá theo sản phẩm đã xem + hành vi (recommender ML); fallback đã xem gần đây.
  const [recommended, setRecommended] = useState<any[]>([]);
  const findInCatalog = (id: string) => products.find((p: any) => String(p.id) === String(id) || String(p._id) === String(id));
  useEffect(() => {
    let alive = true;
    (async () => {
      let ids: string[] = [];
      if (user?.id) {
        try { const r = await api.getRecommendations(user.id, 12); ids = Array.isArray(r?.productIds) ? r.productIds : []; } catch {}
      }
      let list = ids.map(findInCatalog).filter(Boolean);
      // ưu tiên xen các sản phẩm đã xem gần đây
      const viewed = (recentlyViewed || []).map(findInCatalog).filter(Boolean);
      for (const v of viewed) { if (!list.find((x: any) => String(x.id) === String(v.id))) list.unshift(v); }
      if (list.length < 6) for (const p of products) { if (!list.find((x: any) => String(x.id) === String(p.id))) list.push(p); if (list.length >= 10) break; }
      if (alive) setRecommended(list.slice(0, 10));
    })();
    return () => { alive = false; };
  }, [user?.id, recentlyViewed]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: 150 + insets.bottom }]} showsVerticalScrollIndicator keyboardShouldPersistTaps="always" keyboardDismissMode="none">
      <Animated.View style={{ opacity: fade }}>
        <View style={styles.topRow}>
          <Pressable onPress={() => goBackOrReplace('/(tabs)')} accessibilityLabel="Quay lại" style={[styles.backButton, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
            <Feather name="arrow-left" size={19} color={theme.text} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.kicker, { color: theme.primary, fontSize: scaleFont(theme, 11) }]}>JAPANO FASHION AI</Text>
            <Text style={[styles.welcome, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 28) }]}>Chào {user?.name?.split(' ')?.[0] || 'bạn'}, hôm nay mua gì?</Text>
          </View>
          <ShopQuickActions compact />
        </View>

        <AISearchBox
          value={homeQuery}
          onChangeText={setHomeQuery}
          occasion={occasion}
          placeholder="Tìm sản phẩm hoặc hỏi AI: hôm nay mặc gì đây?"
          onSubmitQuery={(text) => router.push({ pathname: '/shop', params: { q: text } })}
        />

        <View style={[styles.hero, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
          <View style={styles.heroText}>
            <Text style={[styles.kicker, { color: theme.primary, fontSize: scaleFont(theme, 11) }]}>BỘ SƯU TẬP MỚI</Text>
            <Text style={[styles.heroTitle, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 38), lineHeight: scaleFont(theme, 42) }]}>Phong cách Nhật cổ cho đời thường</Text>
            <Text style={[styles.heroDesc, { color: theme.muted, fontSize: scaleFont(theme, 14) }]}>Quần áo, đồ dùng, thẻ bài, quà tặng và phối đồ AI. Mua hàng cần đăng nhập để lưu giỏ, thanh toán và lịch sử.</Text>
            <Pressable onPress={() => router.push('/shop')} style={[styles.primaryBtn, { backgroundColor: theme.primary }]}> 
              <Text style={[styles.primaryBtnText, { color: theme.background }]}>Xem sản phẩm</Text>
              <Feather name="chevron-right" size={18} color={theme.background} />
            </Pressable>
          </View>
          <SafeImage source={{ uri: products[0].image }} style={styles.heroImage} resizeMode="contain" />
        </View>

        <View style={[styles.forYou, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kicker, { color: theme.primary, fontSize: scaleFont(theme, 11) }]}>DÀNH CHO BẠN</Text>
              <Text style={[styles.sectionTitle, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 26) }]}>{occasion ? occasion.name : 'Gợi ý hôm nay'}</Text>
            </View>
            <Feather name="calendar" size={24} color={theme.primary} />
          </View>
          <Text style={[styles.forYouIntro, { color: theme.muted, fontSize: scaleFont(theme, 14) }]}>{occasion ? occasion.intro : 'Chưa có dịp đặc biệt trong 3 ngày tới, JAPANO chọn sản phẩm theo xu hướng và độ dễ phối.'}</Text>
          {occasion ? <View style={[styles.reasonBox, { borderColor: theme.border, backgroundColor: theme.background }]}><Feather name="star" size={16} color={theme.primary} /><Text style={[styles.reasonText, { color: theme.text, fontSize: scaleFont(theme, 13) }]}>{occasion.reason}</Text></View> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.horizontalList}>{occasionProducts.map((p, index) => <ProductCard key={`occasion-${String(p.id || p.name)}-${index}`} product={p} compact />)}</ScrollView>
        </View>

        <View style={styles.sectionHeaderPlain}>
          <Text style={[styles.sectionTitle, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 25) }]}>Danh mục mua sắm</Text>
          <Pressable onPress={() => router.push('/shop')}><Text style={{ color: theme.primary, fontWeight: '900' }}>Xem tất cả</Text></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.horizontalList}>
          {categories.map((cat) => (
            <Pressable key={cat.id} onPress={() => router.push({ pathname: '/shop', params: { category: cat.id } })} style={[styles.categoryCard, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
              <SafeImage source={cat.image} style={styles.categoryImage} resizeMode="cover" />
              <Text style={[styles.categoryTitle, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 17) }]}>{cat.name}</Text>
              <Text numberOfLines={2} style={[styles.categorySubtitle, { color: theme.muted, fontSize: scaleFont(theme, 12) }]}>{cat.subtitle}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {recommended.length ? (
          <>
            <View style={styles.sectionHeaderPlain}>
              <Text style={[styles.sectionTitle, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 25) }]}>Gợi ý cho bạn</Text>
              <View style={{ width: 46, height: 4, backgroundColor: theme.primary, marginTop: 6 }} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.horizontalList}>{recommended.map((p, index) => <ProductCard key={`reco-${String(p.id || p.name)}-${index}`} product={p} compact />)}</ScrollView>
          </>
        ) : null}

        <View style={styles.sectionHeaderPlain}>
          <Text style={[styles.sectionTitle, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 25) }]}>Sản phẩm nổi bật</Text>
          <View style={{ width: 46, height: 4, backgroundColor: theme.primary, marginTop: 6 }} />
        </View>
        <View style={styles.grid}>{products.slice(0, 8).map((p, index) => <View key={`home-product-${String(p.id || p.name)}-${index}`} style={{ width: `${100 / columns - 2}%` }}><ProductCard product={p} /></View>)}</View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 18 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 },
  backButton: { width: 42, height: 42, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cartBtn: { width: 48, height: 48, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cartBadge: { position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText: { fontSize: 11, fontWeight: '900' },
  welcome: { marginTop: 6, fontWeight: '900' },
  hero: { borderWidth: 1, borderRadius: 0, padding: 16, minHeight: 305, overflow: 'hidden', gap: 12 },
  heroText: { gap: 10 },
  kicker: { letterSpacing: 2.3, fontWeight: '900' },
  heroTitle: { fontWeight: '900' },
  heroDesc: { lineHeight: 22 },
  heroImage: { width: '100%', height: 150, alignSelf: 'center', borderRadius: 0},
  primaryBtn: { marginTop: 4, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 0},
  primaryBtnText: { fontSize: 12, letterSpacing: 1.2, fontWeight: '900', textTransform: 'uppercase' },
  forYou: { borderWidth: 1, borderRadius: 0, padding: 16, overflow: 'hidden', marginTop: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  sectionHeaderPlain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  sectionTitle: { fontWeight: '900' },
  forYouIntro: { marginTop: 10, lineHeight: 22 },
  reasonBox: { marginTop: 12, borderWidth: 1, borderRadius: 0, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  reasonText: { flex: 1, lineHeight: 19 },
  horizontalList: { gap: 12, paddingVertical: 10 },
  categoryCard: { width: 190, borderWidth: 1, borderRadius: 0, padding: 12, gap: 8 },
  categoryImage: { width: '100%', height: 122, borderRadius: 0},
  categoryTitle: { fontWeight: '900' },
  categorySubtitle: { lineHeight: 17 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
});
