import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Header } from '../components/Header';
import { SafeImage } from '../components/SafeImage';
import { useApp } from '../context/AppContext';
import { getProduct, Product, products } from '../data/catalog';
import { generateTryOnImage } from '../lib/api';
import { cardStyle, fontFamily, radius, scaleFont, shadow } from '../lib/styles';

type PickedFile = { uri: string; name: string; type: string };

function paramToString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function uniqueIds(value: string) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((id, index, arr) => arr.indexOf(id) === index);
}

export default function TryOnScreen() {
  const params = useLocalSearchParams<{ productId?: string; comboIds?: string; comboTitle?: string }>();
  const { theme, user, formatCurrency, addToCart, addGeneratedImage } = useApp();
  const productId = paramToString(params.productId);
  const comboIds = uniqueIds(paramToString(params.comboIds) || productId || products[0]?.id || '');
  const comboTitle = paramToString(params.comboTitle);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [usage, setUsage] = useState<any>(null);

  const selectedProducts = useMemo(() => {
    const selected = comboIds.map((id) => getProduct(id)).filter(Boolean) as Product[];
    return selected.length ? selected : [products[0]].filter(Boolean) as Product[];
  }, [comboIds.join(',')]);

  const mainProduct = selectedProducts[0];

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền truy cập ảnh', 'Hãy cho phép truy cập thư viện để chọn ảnh người dùng thử đồ.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.86, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setFile({ uri: asset.uri, name: asset.fileName || `try-on-${Date.now()}.jpg`, type: asset.mimeType || 'image/jpeg' });
    setMessage('');
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền camera', 'Hãy cho phép camera để chụp ảnh thử đồ.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.86, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setFile({ uri: asset.uri, name: asset.fileName || `camera-try-on-${Date.now()}.jpg`, type: asset.mimeType || 'image/jpeg' });
    setMessage('');
  };

  const generate = async () => {
    if (!file) {
      Alert.alert('Thiếu ảnh người dùng', 'Hãy chọn hoặc chụp 1 ảnh toàn thân/rõ trang phục trước khi tạo thử đồ.');
      return;
    }
    setLoading(true);
    setMessage('Đang gửi ảnh lên backend và tạo thử đồ AI...');
    try {
      const data = await generateTryOnImage({
        userId: user?.id || 'guest',
        productId: mainProduct?.id,
        productIds: selectedProducts.map((p) => p.id),
        comboTitle: comboTitle || selectedProducts.map((p) => p.name).join(' + '),
        file,
      });
      setImageUrl(data.imageUrl || data.sourceImageUrl || '');
      setUsage(data.usage || null);
      setMessage(data.message || (data.pending ? 'Task đang xử lý, hãy thử lại sau ít phút.' : 'Đã tạo ảnh thử đồ.'));
      if (data.imageUrl) {
        addGeneratedImage({ id: `${Date.now()}-${data.imageUrl}`, url: data.imageUrl, prompt: data.prompt || 'AI try-on', createdAt: Date.now() });
      }
    } catch (error: any) {
      const raw = String(error?.message || 'Không tạo được thử đồ AI.');
      const friendly = /FOTOR_API_KEY|credit|quota|timeout|API key|Fotor/i.test(raw)
        ? 'AI thử đồ chưa tạo được ảnh thật. JAPANO đã giữ luồng ổn định bằng Demo Mode; hãy kiểm tra Fotor API/credit rồi restart backend.'
        : raw;
      setMessage(friendly);
      Alert.alert('Thử đồ AI chưa chạy được', friendly);
    } finally {
      setLoading(false);
    }
  };

  const addAllToCart = () => {
    let ok = false;
    selectedProducts.forEach((item) => { if (addToCart(item)) ok = true; });
    if (ok) Alert.alert('Đã thêm', 'Các món trong set đã được thêm vào giỏ hàng.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header title="Thử đồ AI" subtitle="Bước 1 chọn ảnh, bước 2 chọn set, bước 3 tạo thử đồ. Có Demo Mode nếu AI ảnh quá tải." backFallback="/(tabs)" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <View style={[cardStyle(theme), styles.hero]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: theme.primary }]}>VIRTUAL TRY-ON</Text>
            <Text style={[styles.title, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 28) }]}>Ảnh của bạn + set JAPANO</Text>
            <Text style={[styles.desc, { color: theme.muted }]}>Luồng thử đồ 4 bước: chọn ảnh rõ, kiểm tra set, tạo ảnh, lưu/chia sẻ. Nếu Fotor hết credit hoặc API lỗi, Demo Mode vẫn giữ trang chạy ổn định.</Text>
          </View>
          <Feather name="camera" size={28} color={theme.primary} />
        </View>

        <View style={[styles.previewGrid]}>
          <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
            <Text style={[styles.sectionTitle, { color: theme.heading, fontFamily: fontFamily(theme) }]}>Ảnh người dùng</Text>
            {file ? <SafeImage source={{ uri: file.uri }} style={styles.previewImage} resizeMode="contain" /> : <View style={[styles.emptyImage, { borderColor: theme.border, backgroundColor: theme.background }]}><Feather name="user" size={34} color={theme.primary} /><Text style={[styles.emptyText, { color: theme.muted }]}>Chưa chọn ảnh</Text></View>}
            <View style={styles.buttonRow}>
              <Pressable onPress={choosePhoto} style={[styles.secondaryBtn, { borderColor: theme.primary }]}> 
                <Feather name="image" size={17} color={theme.primary} />
                <Text style={[styles.secondaryText, { color: theme.primary }]}>Chọn ảnh</Text>
              </Pressable>
              <Pressable onPress={takePhoto} style={[styles.secondaryBtn, { borderColor: theme.primary }]}> 
                <Feather name="camera" size={17} color={theme.primary} />
                <Text style={[styles.secondaryText, { color: theme.primary }]}>Chụp</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
            <Text style={[styles.sectionTitle, { color: theme.heading, fontFamily: fontFamily(theme) }]}>Kết quả</Text>
            {imageUrl ? <SafeImage source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="contain" /> : <View style={[styles.emptyImage, { borderColor: theme.border, backgroundColor: theme.background }]}><Feather name="star" size={34} color={theme.primary} /><Text style={[styles.emptyText, { color: theme.muted }]}>Chưa tạo ảnh</Text></View>}
            <Pressable onPress={generate} disabled={loading} style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: loading ? 0.65 : 1 }]}> 
              {loading ? <ActivityIndicator color={theme.background} /> : <Feather name="zap" size={18} color={theme.background} />}
              <Text style={[styles.primaryText, { color: theme.background }]}>{loading ? 'Đang tạo...' : 'Tạo thử đồ'}</Text>
            </Pressable>
          </View>
        </View>

        {message ? (
          <View style={[styles.messageBox, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
            <Feather name="info" size={18} color={theme.primary} />
            <Text style={[styles.messageText, { color: theme.text }]}>{message}</Text>
          </View>
        ) : null}

        {usage ? (
          <View style={[styles.usageBox, { backgroundColor: theme.card, borderColor: theme.border }]}> 
            <Text style={[styles.desc, { color: theme.text }]}>Lượt thử đồ: {usage.vip ? 'VIP không giới hạn' : `${usage.tryOnUsed || 0}/${usage.tryOnLimit || 2}`}</Text>
          </View>
        ) : null}

        <View style={[cardStyle(theme), styles.setCard]}>
          <View style={styles.setHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kicker, { color: theme.primary }]}>COMBO ĐANG THỬ</Text>
              <Text style={[styles.sectionTitle, { color: theme.heading, fontFamily: fontFamily(theme) }]}>{comboTitle || 'Set sản phẩm JAPANO'}</Text>
            </View>
            <Pressable onPress={addAllToCart} style={[styles.cartBtn, { backgroundColor: theme.primary }]}> 
              <Feather name="shopping-bag" size={17} color={theme.background} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.productsRow}>
            {selectedProducts.map((item) => (
              <Pressable key={item.id} onPress={() => router.push(`/product/${item.id}`)} style={[styles.product, { backgroundColor: theme.background, borderColor: theme.border }]}> 
                <SafeImage source={{ uri: item.image }} style={styles.productImage} resizeMode="contain" />
                <Text numberOfLines={2} style={[styles.productName, { color: theme.heading }]}>{item.name}</Text>
                <Text numberOfLines={1} style={[styles.price, { color: theme.primary }]}>{formatCurrency(item.price)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 120 },
  hero: { padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontWeight: '900', lineHeight: 34 },
  desc: { fontSize: 13, lineHeight: 20 },
  previewGrid: { gap: 12 },
  previewCard: { borderWidth: 1, borderRadius: 0, padding: 12, gap: 12 },
  sectionTitle: { fontSize: 22, fontWeight: '900' },
  previewImage: { width: '100%', height: 280, borderRadius: 0},
  emptyImage: { height: 220, borderRadius: 0, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '800' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: { minHeight: 52, borderRadius: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  primaryText: { fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  secondaryBtn: { flex: 1, minHeight: 48, borderRadius: 0, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryText: { fontWeight: '900' },
  messageBox: { borderWidth: 1, borderRadius: 0, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  messageText: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  usageBox: { borderWidth: 1, borderRadius: 0, padding: 12 },
  setCard: { padding: 14, gap: 12 },
  setHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartBtn: { width: 46, height: 46, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  productsRow: { gap: 10, paddingVertical: 2 },
  product: { width: 150, borderWidth: 1, borderRadius: 0, padding: 9, gap: 7 },
  productImage: { width: '100%', height: 110, borderRadius: 0},
  productName: { fontSize: 12, fontWeight: '900', lineHeight: 16 },
  price: { fontSize: 12, fontWeight: '900' },
});
