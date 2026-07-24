import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Header } from '../components/Header';
import { SafeImage } from '../components/SafeImage';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { cardStyle, fontFamily, radius, scaleFont } from '../lib/styles';

export default function TryOnHistoryScreen() {
  const { theme, user, generatedImages } = useApp();
  const userId = user?.id || 'guest';
  const [items, setItems] = useState<any[]>([]);

  useFocusEffect(useCallback(() => {
    let mounted = true;
    api.getTryOnHistory(userId).then((data: any) => {
      if (!mounted) return;
      const remote = Array.isArray(data?.history) ? data.history : [];
      const local = generatedImages.map((img) => ({ id: img.id, resultUrl: img.url, url: img.url, prompt: img.prompt, createdAt: img.createdAt }));
      const merged = [...remote, ...local].filter((item, index, arr) => item.resultUrl && arr.findIndex((x) => x.resultUrl === item.resultUrl) === index);
      setItems(merged);
    }).catch(() => setItems(generatedImages.map((img) => ({ id: img.id, resultUrl: img.url, url: img.url, prompt: img.prompt, createdAt: img.createdAt }))));
    return () => { mounted = false; };
  }, [userId, generatedImages.length]));

  const saveOutfit = async (item: any) => {
    try {
      await api.saveOutfitCollection(userId, {
        title: `Outfit thử đồ ${new Date(item.createdAt || Date.now()).toLocaleDateString('vi-VN')}`,
        description: item.prompt || 'Outfit tạo từ AI thử đồ',
        occasion: 'try-on-history',
        cover: item.resultUrl || item.url,
        items: item.productIds || [],
      });
      Alert.alert('Đã lưu', 'Ảnh thử đồ đã được lưu vào Bộ sưu tập outfit.');
    } catch (error: any) {
      Alert.alert('Chưa lưu được', error?.message || 'Kiểm tra backend rồi thử lại.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header title="Lịch sử thử đồ AI" subtitle="Ảnh gốc, ảnh kết quả, lưu outfit và chia sẻ" />
      <ScrollView contentContainerStyle={styles.content}>
        {items.length === 0 ? (
          <View style={[cardStyle(theme), styles.empty]}>
            <Feather name="image" size={30} color={theme.primary} />
            <Text style={[styles.emptyTitle, { color: theme.heading, fontFamily: fontFamily(theme) }]}>Chưa có ảnh thử đồ</Text>
            <Text style={[styles.desc, { color: theme.muted }]}>Khi bạn dùng AI thử đồ, ảnh kết quả sẽ hiện ở đây để mua lại set, lưu outfit hoặc chia sẻ.</Text>
          </View>
        ) : null}

        {items.map((item) => (
          <View key={String(item.id || item.resultUrl)} style={[cardStyle(theme), styles.card]}>
            <SafeImage source={{ uri: item.resultUrl || item.url }} style={styles.image} resizeMode="cover" />
            <Text style={[styles.date, { color: theme.primary }]}>{new Date(item.createdAt || Date.now()).toLocaleString('vi-VN')}</Text>
            <Text numberOfLines={3} style={[styles.desc, { color: theme.text }]}>{item.prompt || 'Ảnh thử đồ AI'}</Text>
            <View style={styles.actions}>
              <Pressable onPress={() => saveOutfit(item)} style={[styles.btn, { backgroundColor: theme.primary }]}> 
                <Feather name="bookmark" size={16} color={theme.background} />
                <Text style={[styles.btnText, { color: theme.background }]}>Lưu outfit</Text>
              </Pressable>
              <Pressable onPress={() => Share.share({ message: item.resultUrl || item.url })} style={[styles.btnOutline, { borderColor: theme.primary }]}> 
                <Feather name="share-2" size={16} color={theme.primary} />
                <Text style={[styles.btnText, { color: theme.primary }]}>Chia sẻ</Text>
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
  empty: { padding: 20, gap: 10, alignItems: 'center' },
  emptyTitle: { fontSize: 22, fontWeight: '900' },
  card: { padding: 14, gap: 10 },
  image: { width: '100%', height: 340, borderRadius: 0},
  date: { fontWeight: '900', fontSize: 12 },
  desc: { lineHeight: 21, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, height: 46, borderRadius: 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btnOutline: { flex: 1, height: 46, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btnText: { fontWeight: '900' },
});
