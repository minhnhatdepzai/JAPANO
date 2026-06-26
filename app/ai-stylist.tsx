import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Header } from '../components/Header';
import { SafeImage } from '../components/SafeImage';
import { useApp } from '../context/AppContext';
import { Product } from '../data/catalog';
import { api } from '../lib/api';
import { cardStyle, fontFamily, radius, scaleFont, shadow } from '../lib/styles';

export default function AiStylistScreen() {
  const { theme, user, formatCurrency, addToCart } = useApp();
  const userId = user?.id || 'guest';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getAiStylistSuggestions({ userId });
      setData(result);
    } catch (error: any) {
      Alert.alert('AI Stylist chưa sẵn sàng', error?.message || 'Hãy kiểm tra backend.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveSet = async (setItem: any) => {
    try {
      await api.saveOutfitCollection(userId, {
        title: setItem.title,
        description: setItem.reason,
        occasion: setItem.id,
        items: setItem.products || [],
        cover: setItem.products?.[0]?.image || '',
      });
      Alert.alert('Đã lưu', 'Set này đã được lưu vào Bộ sưu tập outfit.');
    } catch (error: any) {
      Alert.alert('Chưa lưu được', error?.message || 'Kiểm tra backend rồi thử lại.');
    }
  };

  const addWholeSet = (items: Product[] = []) => {
    let ok = false;
    items.forEach((item) => { if (addToCart(item)) ok = true; });
    if (ok) Alert.alert('Đã thêm', 'Các món trong set đã được thêm vào giỏ hàng.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header title="AI Stylist cá nhân" subtitle="Set đồ theo quiz, số đo, màu da, dịp mặc và ngân sách" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <View style={[cardStyle(theme), styles.hero]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: theme.primary }]}>PERSONAL FASHION ENGINE</Text>
            <Text style={[styles.title, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 28) }]}>Tạo set đồ tự động cho bạn</Text>
            <Text style={[styles.desc, { color: theme.muted, fontSize: scaleFont(theme, 14) }]}>{data?.summary || 'Trả lời quiz hằng ngày và nhập số đo để AI gợi ý chính xác hơn.'}</Text>
          </View>
          {loading ? <ActivityIndicator color={theme.primary} /> : <Feather name="zap" size={28} color={theme.primary} />}
        </View>

        <View style={styles.quickRow}>
          <Pressable onPress={() => router.push('/stylist-quiz')} style={[styles.quick, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
            <Feather name="edit-3" size={20} color={theme.primary} />
            <Text style={[styles.quickText, { color: theme.text }]}>Quiz hôm nay</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/body-profile')} style={[styles.quick, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
            <Feather name="user-check" size={20} color={theme.primary} />
            <Text style={[styles.quickText, { color: theme.text }]}>Số đo</Text>
          </Pressable>
        </View>

        <View style={styles.quickRow}>
          <Pressable onPress={() => router.push('/tryon-history')} style={[styles.quick, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
            <Feather name="image" size={20} color={theme.primary} />
            <Text style={[styles.quickText, { color: theme.text }]}>Lịch sử thử đồ</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/outfit-collections')} style={[styles.quick, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
            <Feather name="bookmark" size={20} color={theme.primary} />
            <Text style={[styles.quickText, { color: theme.text }]}>Bộ sưu tập</Text>
          </Pressable>
        </View>

        {(data?.sets || []).map((setItem: any) => (
          <View key={setItem.id} style={[cardStyle(theme), styles.setCard]}>
            <View style={styles.setHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.setTitle, { color: theme.heading, fontFamily: fontFamily(theme) }]}>{setItem.title}</Text>
                <Text style={[styles.desc, { color: theme.muted }]}>{setItem.tone}</Text>
              </View>
              <Pressable onPress={() => saveSet(setItem)} style={[styles.iconBtn, { backgroundColor: theme.background, borderColor: theme.border }]}> 
                <Feather name="bookmark" size={19} color={theme.primary} />
              </Pressable>
            </View>
            <Text style={[styles.reason, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}>{setItem.reason}</Text>
            {setItem.sizeAdvice ? (
              <View style={[styles.sizeBox, { borderColor: theme.border, backgroundColor: theme.background }]}> 
                <Feather name="sliders" size={17} color={theme.primary} />
                <Text style={[styles.sizeText, { color: theme.text }]}>Size gợi ý: <Text style={{ fontWeight: '900', color: theme.primary }}>{setItem.sizeAdvice.recommendedSize}</Text>. {(setItem.sizeAdvice.notes || []).slice(0, 2).join(' ')}</Text>
              </View>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productsRow}>
              {(setItem.products || []).map((item: Product) => (
                <Pressable key={item.id} onPress={() => router.push(`/product/${item.id}`)} style={[styles.product, { borderColor: theme.border, backgroundColor: theme.background }]}> 
                  <SafeImage source={{ uri: item.image }} style={styles.productImage} resizeMode="contain" />
                  <Text numberOfLines={2} style={[styles.productName, { color: theme.heading }]}>{item.name}</Text>
                  <Text style={[styles.price, { color: theme.primary }]}>{formatCurrency(item.price)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.actions}>
              <Pressable onPress={() => addWholeSet(setItem.products || [])} style={[styles.primaryBtn, { backgroundColor: theme.primary }]}> 
                <Feather name="shopping-bag" size={17} color={theme.background} />
                <Text style={[styles.primaryText, { color: theme.background }]}>Thêm cả set</Text>
              </Pressable>
              <Pressable onPress={() => router.push({ pathname: '/try-on', params: { comboIds: (setItem.products || []).map((p: Product) => p.id).join(','), comboTitle: setItem.title } })} style={[styles.secondaryBtn, { borderColor: theme.primary }]}> 
                <Feather name="camera" size={17} color={theme.primary} />
                <Text style={[styles.secondaryText, { color: theme.primary }]}>Thử AI</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 100 },
  hero: { padding: 18, flexDirection: 'row', gap: 12, alignItems: 'center' },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 2.2, marginBottom: 6 },
  title: { fontWeight: '900', lineHeight: 34 },
  desc: { lineHeight: 21 },
  quickRow: { flexDirection: 'row', gap: 12 },
  quick: { flex: 1, height: 58, borderWidth: 1, borderRadius: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  quickText: { fontWeight: '900', fontSize: 12 },
  setCard: { padding: 14, gap: 12 },
  setHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setTitle: { fontSize: 21, fontWeight: '900' },
  iconBtn: { width: 42, height: 42, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  reason: { borderWidth: 1, borderRadius: 0, padding: 12, lineHeight: 20 },
  sizeBox: { borderWidth: 1, borderRadius: 0, padding: 12, flexDirection: 'row', gap: 8 },
  sizeText: { flex: 1, lineHeight: 20 },
  productsRow: { gap: 10, paddingVertical: 4 },
  product: { width: 132, borderWidth: 1, borderRadius: 0, padding: 9, gap: 7 },
  productImage: { width: '100%', height: 94, borderRadius: 0},
  productName: { fontWeight: '900', fontSize: 12, lineHeight: 16 },
  price: { fontWeight: '900', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  primaryBtn: { flex: 1, height: 46, borderRadius: 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondaryBtn: { flex: 1, height: 46, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryText: { fontWeight: '900' },
  secondaryText: { fontWeight: '900' },
});
