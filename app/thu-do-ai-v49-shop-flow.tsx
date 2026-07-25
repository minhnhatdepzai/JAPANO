// JAPANO - THỬ ĐỒ AI (đồ chính + phụ kiện), giao diện theo theme, bền lỗi
// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import AppButton from '../components/AppButton';
import { SafeImage } from '../components/SafeImage';
import { cardStyle, fontFamily, inputStyle, onPrimary, pill, pillText, scaleFont, shadow } from '../lib/styles';
import {
  V49_FALLBACK_ACCESSORIES,
  V49_FALLBACK_PRODUCTS,
  v49FirstImage,
  v49Get,
  v49IsAccessory,
  v49Money,
  v49Post,
  v49ProductId,
  v49RecommendSize,
} from '../lib/japanoV49ShopApi';

async function pickUserImage(setter) {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, base64: true, allowsEditing: false });
  if (r.canceled || !r.assets?.[0]) return;
  const a = r.assets[0];
  setter({ uri: a.uri, base64: `data:${a.mimeType || 'image/jpeg'};base64,${a.base64 || ''}` });
}
async function takeUserPhoto(setter) {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) { Alert.alert('Chưa có quyền camera', 'Hãy cấp quyền camera để chụp ảnh.'); return; }
  const r = await ImagePicker.launchCameraAsync({ quality: 0.9, base64: true, allowsEditing: false });
  if (r.canceled || !r.assets?.[0]) return;
  const a = r.assets[0];
  setter({ uri: a.uri, base64: `data:${a.mimeType || 'image/jpeg'};base64,${a.base64 || ''}` });
}

export default function ThuDoAiScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() || {};
  const { theme } = useApp();

  const paramProductId = String(params.productId || params.id || params._id || params.sku || '');
  const paramProductJson = String(params.product || '');

  const [userImage, setUserImage] = useState(null);
  const [mainProduct, setMainProduct] = useState(null);
  const [accessories, setAccessories] = useState(V49_FALLBACK_ACCESSORIES);
  const [selectedAccessories, setSelectedAccessories] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultImg, setResultImg] = useState('');
  const [message, setMessage] = useState('Thêm ảnh của bạn, chọn món đồ và phụ kiện rồi bấm "Tạo thử đồ".');
  const [adultConfirmed, setAdultConfirmed] = useState(false);

  const [quiz, setQuiz] = useState({ height: '', weight: '', bust: '', waist: '', hip: '', shoulder: '' });
  const [selectedSize, setSelectedSize] = useState(String(params.selectedSize || ''));
  const [selectedColor, setSelectedColor] = useState(String(params.selectedColor || ''));
  const [recommendedSize, setRecommendedSize] = useState('');
  const [sizeAdvice, setSizeAdvice] = useState('');
  const [suggestingSize, setSuggestingSize] = useState(false);
  const [suggestingAcc, setSuggestingAcc] = useState(false);

  async function loadShopData() {
    try {
      setLoading(true);
      let fromParam = null;
      if (paramProductJson) { try { fromParam = JSON.parse(decodeURIComponent(paramProductJson)); } catch {} }

      const data = await v49Get('/api/v49/shop/products', { items: [...V49_FALLBACK_PRODUCTS, ...V49_FALLBACK_ACCESSORIES], offline: true });
      const items = data.items || [];
      const acc = items.filter(v49IsAccessory);
      setAccessories(acc.length ? acc : V49_FALLBACK_ACCESSORIES);

      if (fromParam) setMainProduct(fromParam);
      else if (paramProductId) setMainProduct(items.find((p) => v49ProductId(p) === paramProductId) || V49_FALLBACK_PRODUCTS[0]);
      else setMainProduct(V49_FALLBACK_PRODUCTS[0]);
    } catch {
      setMainProduct((m) => m || V49_FALLBACK_PRODUCTS[0]);
      setAccessories(V49_FALLBACK_ACCESSORIES);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadShopData(); }, []);

  const visibleAccessories = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accessories.filter((p) => {
      const text = `${p.name || ''} ${p.category || ''} ${p.subcategory || ''} ${(p.visualTags || []).join(' ')}`.toLowerCase();
      return !q || text.includes(q);
    });
  }, [accessories, query]);

  function toggleAccessory(p) {
    const id = v49ProductId(p);
    setSelectedAccessories((old) => (old.some((x) => v49ProductId(x) === id) ? old.filter((x) => v49ProductId(x) !== id) : [...old, p].slice(0, 5)));
  }

  const sizes = useMemo(() => {
    const s = Array.isArray(mainProduct?.sizes) ? mainProduct.sizes.map(String) : [];
    return Array.from(new Set([...s, 'S', 'M', 'L', 'XL', '2XL', '3XL'].filter(Boolean)));
  }, [mainProduct]);
  const colors = useMemo(() => {
    const c = Array.isArray(mainProduct?.colors) ? mainProduct.colors.map(String) : [];
    return c.length ? Array.from(new Set(c)) : ['Mặc định'];
  }, [mainProduct]);

  function updateQuiz(key, value) {
    const next = { ...quiz, [key]: value };
    setQuiz(next);
    const rec = v49RecommendSize(next);
    setRecommendedSize(rec);
    if (!selectedSize) setSelectedSize(rec);
  }

  async function suggestSize() {
    try {
      setSuggestingSize(true);
      const data = await v49Post('/api/v49/shop/suggest-size', {
        productId: v49ProductId(mainProduct),
        category: mainProduct?.category || '',
        height: quiz.height, weight: quiz.weight, bust: quiz.bust, waist: quiz.waist, hip: quiz.hip,
      }, { ok: true, size: v49RecommendSize(quiz), advice: 'Gợi ý theo số đo bạn nhập.' });
      if (data?.size) { setRecommendedSize(data.size); setSelectedSize(data.size); }
      setSizeAdvice(data?.advice || '');
    } catch {
      const rec = v49RecommendSize(quiz);
      setRecommendedSize(rec); setSelectedSize(rec); setSizeAdvice('Gợi ý theo số đo bạn nhập.');
    } finally { setSuggestingSize(false); }
  }

  async function suggestAccessories() {
    try {
      setSuggestingAcc(true);
      const data = await v49Get(`/api/v49/shop/suggest-accessories?productId=${encodeURIComponent(v49ProductId(mainProduct))}&limit=5`, { ok: true, productIds: [] });
      const ids = Array.isArray(data?.productIds) ? data.productIds : [];
      let picked = ids.map((x) => accessories.find((p) => String(v49ProductId(p)) === String(x))).filter(Boolean);
      if (!picked.length) picked = accessories.slice(0, 3);
      setSelectedAccessories(picked.slice(0, 5));
      setMessage(picked.length ? `Đã gợi ý ${picked.length} phụ kiện đi kèm hợp với "${mainProduct?.name || 'sản phẩm'}".` : 'Chưa tìm được phụ kiện phù hợp.');
    } catch {
      setSelectedAccessories(accessories.slice(0, 3));
    } finally { setSuggestingAcc(false); }
  }

  async function runTryOn() {
    if (!userImage?.base64) { Alert.alert('Thiếu ảnh người', 'Hãy chọn hoặc chụp ảnh của bạn trước.'); return; }
    if (!mainProduct) { Alert.alert('Thiếu sản phẩm', 'Hãy vào sản phẩm và bấm "Thử đồ AI".'); return; }
    try {
      setLoading(true);
      setResultImg('');
      setMessage('Đang tạo ảnh thử đồ...');
      const rec = recommendedSize || v49RecommendSize(quiz);
      const data = await v49Post('/api/v49/mobile/tryon-selected-product', {
        personImageBase64: userImage.base64,
        mainProductId: v49ProductId(mainProduct),
        mainProductImageUrl: v49FirstImage(mainProduct),
        mainProductImageUrls: (Array.isArray(mainProduct?.images) ? mainProduct.images : []).map((x) => (typeof x === 'string' ? x : (x?.url || x?.secure_url || ''))).filter(Boolean),
        mainProductName: mainProduct?.name || '',
        accessoryProductIds: selectedAccessories.map(v49ProductId),
        quiz,
        selectedSize: selectedSize || rec,
        selectedColor: selectedColor || 'Mặc định',
        recommendedSize: rec,
        adultConfirmed,
      }, { ok: false, message: 'Không kết nối được máy chủ. Hãy chạy backend (cổng 4000) rồi thử lại.' });

      const raw = data?.finalImageBase64 || data?.imageBase64 || '';
      const final = raw ? (String(raw).startsWith('data:') ? raw : `data:image/png;base64,${raw}`) : '';
      setResultImg(final);
      setMessage(data?.message || (final ? 'Đã tạo ảnh thử đồ.' : 'Chưa có ảnh kết quả.'));
    } catch (e) {
      setMessage(`Không tạo được ảnh: ${e?.message || 'lỗi mạng'}.`);
    } finally {
      setLoading(false);
    }
  }

  const mainImage = v49FirstImage(mainProduct);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Pressable onPress={() => (router.canGoBack?.() ? router.back() : router.replace('/(tabs)/shop'))} style={{ width: 42, height: 42, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>
        <Text style={{ flex: 1, color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 17) }}>Thử đồ AI</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {/* Đồ chính */}
        <View style={[cardStyle(theme), { padding: 12, flexDirection: 'row', gap: 12 }]}>
          <SafeImage source={{ uri: mainImage }} style={{ width: 104, height: 134, backgroundColor: theme.background }} resizeMode="cover" />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 17) }}>{mainProduct?.name || 'Sản phẩm đang thử'}</Text>
            <Text style={{ color: theme.primary, fontWeight: '900', fontSize: scaleFont(theme, 18) }}>{v49Money(mainProduct?.price)}</Text>
            <Text style={{ color: theme.muted, fontSize: scaleFont(theme, 12) }}>Ảnh đồ = ảnh đầu tiên của sản phẩm.</Text>
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: scaleFont(theme, 12) }}>Đang thử: size {selectedSize || 'chưa chọn'} • màu {selectedColor || 'Mặc định'}</Text>
          </View>
        </View>

        {/* 1. Ảnh người */}
        <View style={[cardStyle(theme), { padding: 14, gap: 10 }]}>
          <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 16) }}>1. Ảnh của bạn</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><AppButton title="Chọn ảnh" icon="image" variant="outline" onPress={() => pickUserImage(setUserImage)} /></View>
            <View style={{ flex: 1 }}><AppButton title="Chụp ảnh" icon="camera" variant="outline" onPress={() => takeUserPhoto(setUserImage)} /></View>
          </View>
          {userImage?.uri ? <SafeImage source={{ uri: userImage.uri }} style={{ width: '100%', height: 320, backgroundColor: theme.background }} resizeMode="contain" /> : null}
        </View>

        {/* 2. Quiz size */}
        {userImage?.uri ? (
          <View style={[cardStyle(theme), { padding: 14, gap: 10 }]}>
            <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 16) }}>2. Số đo & size</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[['height', 'Cao (cm)'], ['weight', 'Nặng (kg)'], ['bust', 'Ngực (cm)'], ['waist', 'Eo (cm)'], ['hip', 'Hông (cm)'], ['shoulder', 'Vai (cm)']].map(([k, ph]) => (
                <TextInput key={k} style={[inputStyle(theme), { width: '48%' }]} keyboardType="numeric" placeholder={ph} placeholderTextColor={theme.muted} value={quiz[k]} onChangeText={(v) => updateQuiz(k, v)} />
              ))}
            </View>

            <Text style={{ color: theme.heading, fontWeight: '900', marginTop: 4 }}>Màu sắc</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {colors.map((c) => (
                <Pressable key={c} onPress={() => setSelectedColor(c)} style={pill(theme, selectedColor === c)}><Text style={pillText(theme, selectedColor === c)}>{c}</Text></Pressable>
              ))}
            </View>

            <Text style={{ color: theme.heading, fontWeight: '900', marginTop: 4 }}>Kích cỡ</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {sizes.map((sz) => (
                <Pressable key={sz} onPress={() => setSelectedSize(sz)} style={pill(theme, selectedSize === sz)}><Text style={pillText(theme, selectedSize === sz)}>{sz}</Text></Pressable>
              ))}
            </View>

            <View style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, padding: 10, gap: 6 }}>
              <Text style={{ color: theme.primary, fontWeight: '900' }}>Size gợi ý: {recommendedSize || v49RecommendSize(quiz)}</Text>
              {sizeAdvice ? <Text style={{ color: theme.text, fontSize: scaleFont(theme, 12), lineHeight: 18 }}>{sizeAdvice}</Text> : null}
              <AppButton title={suggestingSize ? 'Đang tính size...' : 'Gợi ý size cho tôi'} icon="maximize-2" variant="outline" loading={suggestingSize} onPress={suggestSize} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ flex: 1, color: theme.text, fontWeight: '800' }}>Xác nhận người lớn nếu là bikini / đồ bơi / crop-top</Text>
              <Switch value={adultConfirmed} onValueChange={setAdultConfirmed} trackColor={{ true: theme.primary }} />
            </View>
          </View>
        ) : null}

        {/* 3. Phụ kiện */}
        <View style={[cardStyle(theme), { padding: 14, gap: 10 }]}>
          <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 16) }}>3. Chọn phụ kiện để thử</Text>
          <Text style={{ color: theme.muted, fontSize: scaleFont(theme, 12) }}>Dây chuyền, đồng hồ, túi, kính, dù, khăn, bông tai... Chọn tối đa 5.</Text>
          <AppButton title={suggestingAcc ? 'Đang gợi ý...' : 'Gợi ý phụ kiện đi kèm'} icon="zap" variant="outline" loading={suggestingAcc} onPress={suggestAccessories} />
          <TextInput style={inputStyle(theme)} placeholder="Tìm phụ kiện..." placeholderTextColor={theme.muted} value={query} onChangeText={setQuery} />
          <FlatList
            horizontal
            data={visibleAccessories}
            keyExtractor={(p, i) => `${v49ProductId(p)}-${i}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
            renderItem={({ item }) => {
              const sel = selectedAccessories.some((x) => v49ProductId(x) === v49ProductId(item));
              return (
                <Pressable onPress={() => toggleAccessory(item)} style={{ width: 150, borderWidth: sel ? 2 : 1, borderColor: sel ? theme.primary : theme.border, backgroundColor: theme.card }}>
                  <SafeImage source={{ uri: v49FirstImage(item) }} style={{ width: '100%', height: 130, backgroundColor: theme.background }} resizeMode="cover" />
                  <View style={{ padding: 8, gap: 3 }}>
                    <Text numberOfLines={2} style={{ color: theme.heading, fontWeight: '900', fontSize: scaleFont(theme, 12), minHeight: 32 }}>{item?.name || 'Phụ kiện'}</Text>
                    <Text style={{ color: theme.primary, fontWeight: '900', fontSize: scaleFont(theme, 12) }}>{v49Money(item?.price)}</Text>
                  </View>
                  {sel ? <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: theme.primary, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}><Feather name="check" size={15} color={onPrimary(theme)} /></View> : null}
                </Pressable>
              );
            }}
          />
          <Text style={{ color: theme.muted, fontSize: scaleFont(theme, 12) }}>Đã chọn: {selectedAccessories.map((x) => x.name).join(', ') || 'chưa chọn phụ kiện'}</Text>
        </View>

        <AppButton title={loading ? 'Đang tạo...' : 'Tạo thử đồ'} icon="zap" loading={loading} onPress={runTryOn} />

        <View style={[cardStyle(theme), { padding: 14, gap: 6 }]}>
          <Text style={{ color: theme.heading, fontWeight: '900' }}>Trạng thái</Text>
          <Text style={{ color: theme.text, lineHeight: 20 }}>{message}</Text>
        </View>

        {resultImg ? (
          <View style={[cardStyle(theme), { padding: 14, gap: 8 }]}>
            <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 16) }}>Kết quả</Text>
            <SafeImage source={{ uri: resultImg }} style={{ width: '100%', height: 540, backgroundColor: theme.background }} resizeMode="contain" />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
