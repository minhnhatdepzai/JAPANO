// JAPANO V54 TRYON SIZE COLOR SELECTORS
// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  V49_FALLBACK_ACCESSORIES,
  V49_FALLBACK_PRODUCTS,
  V49_SIZE_CHART,
  v49FirstImage,
  v49Get,
  v49IsAccessory,
  v49Money,
  v49Post,
  v49ProductId,
  v49RecommendSize,
} from '../lib/japanoV49ShopApi';

type Img = { uri: string; base64?: string };

async function pickUserImage(setter: (v: Img) => void) {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    base64: true,
    allowsEditing: false,
  });
  if (r.canceled || !r.assets?.[0]) return;
  const a = r.assets[0];
  const mime = a.mimeType || 'image/jpeg';
  setter({ uri: a.uri, base64: `data:${mime};base64,${a.base64 || ''}` });
}

async function takeUserPhoto(setter: (v: Img) => void) {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Chưa có quyền camera', 'Hãy cấp quyền camera để chụp ảnh.');
    return;
  }
  const r = await ImagePicker.launchCameraAsync({
    quality: 0.9,
    base64: true,
    allowsEditing: false,
  });
  if (r.canceled || !r.assets?.[0]) return;
  const a = r.assets[0];
  const mime = a.mimeType || 'image/jpeg';
  setter({ uri: a.uri, base64: `data:${mime};base64,${a.base64 || ''}` });
}

function AccessoryCard({ item, selected, onPress }: any) {
  return (
    <TouchableOpacity onPress={() => onPress(item)} style={[s.accCard, selected && s.accSelected]}>
      <Image source={{ uri: v49FirstImage(item) || 'https://placehold.co/500x700/fdf2f8/be185d?text=JAPANO' }} style={s.accImg} />
      <View style={s.accBody}>
        <Text numberOfLines={2} style={s.accName}>{item?.name || 'Phụ kiện shop'}</Text>
        <Text style={s.price}>{v49Money(item?.price)}</Text>
        <Text numberOfLines={1} style={s.small}>{item?.subcategory || item?.category || 'phụ kiện'}</Text>
      </View>
      {selected ? <View style={s.check}><Text style={s.checkText}>✓</Text></View> : null}
    </TouchableOpacity>
  );
}

export default function ThuDoAiV49ShopFlowScreen() {
  const router = useRouter?.();
  const params = useLocalSearchParams?.() || {};

  const paramProductId = String(params.productId || params.id || params._id || params.sku || '');
  const paramProductJson = String(params.product || '');
  const paramSelectedSize = String(params.selectedSize || '');
  const paramSelectedColor = String(params.selectedColor || '');
  const paramVariantId = String(params.variantId || '');

  const [userImage, setUserImage] = useState<Img | null>(null);
  const [mainProduct, setMainProduct] = useState<any | null>(null);
  const [accessories, setAccessories] = useState<any[]>(V49_FALLBACK_ACCESSORIES);
  const [selectedAccessories, setSelectedAccessories] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [suggested, setSuggested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultImg, setResultImg] = useState('');
  const [message, setMessage] = useState('Bạn đang ở trang thử đồ. Hãy thêm ảnh của bạn để xem gợi ý size và phụ kiện.');
  const [tips, setTips] = useState<any>(null);
  const [adultConfirmed, setAdultConfirmed] = useState(false);

  const [quiz, setQuiz] = useState({ height: '', weight: '', bust: '', waist: '', hip: '', shoulder: '' });
  const [selectedSize, setSelectedSize] = useState(paramSelectedSize);
  const [selectedColor, setSelectedColor] = useState(paramSelectedColor);
  const [selectedVariantId, setSelectedVariantId] = useState(paramVariantId);
  const [recommendedSize, setRecommendedSize] = useState('');

  async function loadShopData() {
    try {
      setLoading(true);

      let selectedFromParam: any = null;
      if (paramProductJson) {
        try {
          selectedFromParam = JSON.parse(decodeURIComponent(paramProductJson));
        } catch {}
      }

      const data = await v49Get('/api/v49/shop/products', {
        ok: false,
        items: [...V49_FALLBACK_PRODUCTS, ...V49_FALLBACK_ACCESSORIES],
        offline: true,
      });

      const items = data.items || [];
      const acc = items.filter(v49IsAccessory);
      setAccessories(acc.length ? acc : V49_FALLBACK_ACCESSORIES);

      if (selectedFromParam) {
        setMainProduct(selectedFromParam);
        if (selectedFromParam.selectedSize && !selectedSize) setSelectedSize(String(selectedFromParam.selectedSize));
        if (selectedFromParam.selectedColor && !selectedColor) setSelectedColor(String(selectedFromParam.selectedColor));
        if (selectedFromParam.selectedVariantId && !selectedVariantId) setSelectedVariantId(String(selectedFromParam.selectedVariantId));
      } else if (paramProductId) {
        const found = items.find((p) => v49ProductId(p) === paramProductId);
        setMainProduct(found || V49_FALLBACK_PRODUCTS[0]);
      } else {
        setMainProduct(V49_FALLBACK_PRODUCTS[0]);
      }

      if (data.offline) {
        setMessage('Không kết nối được backend nên đang dùng dữ liệu tạm để hiển thị UI. Khi backend chạy, app sẽ lấy sản phẩm shop thật.');
      } else {
        setMessage('Đã nhận sản phẩm và phụ kiện từ shop. Đồ chính lấy từ ảnh đầu tiên của sản phẩm.');
      }
    } catch (e: any) {
      setMainProduct(V49_FALLBACK_PRODUCTS[0]);
      setAccessories(V49_FALLBACK_ACCESSORIES);
      setMessage('Không tải được dữ liệu shop, đang dùng dữ liệu tạm để giao diện vẫn chạy.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadShopData(); }, []);

  const visibleAccessories = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accessories.filter((p) => {
      const text = `${p.name || ''} ${p.category || ''} ${p.subcategory || ''} ${p.description || ''} ${(p.visualTags || []).join(' ')}`.toLowerCase();
      return !q || text.includes(q);
    });
  }, [accessories, query]);

  function toggleAccessory(p: any) {
    const id = v49ProductId(p);
    setSelectedAccessories((old) => {
      if (old.some((x) => v49ProductId(x) === id)) return old.filter((x) => v49ProductId(x) !== id);
      return [...old, p].slice(0, 5);
    });
  }


  function normalizeVariantText(v: any) {
    return String(v?.name || v?.size || v?.sizeName || v?.color || v?.colorName || v || '').trim();
  }

  function productSizes(item: any) {
    const list: any[] = [];
    if (Array.isArray(item?.sizes)) list.push(...item.sizes);
    if (Array.isArray(item?.availableSizes)) list.push(...item.availableSizes);
    if (Array.isArray(item?.variants)) item.variants.forEach((v: any) => list.push(v.size || v.sizeName || v.SizeName));
    return Array.from(new Set([...list.map(normalizeVariantText).filter(Boolean), 'S', 'M', 'L', 'XL', '2XL', '3XL']));
  }

  function productColors(item: any) {
    const list: any[] = [];
    if (Array.isArray(item?.colors)) list.push(...item.colors);
    if (Array.isArray(item?.availableColors)) list.push(...item.availableColors);
    if (Array.isArray(item?.variants)) item.variants.forEach((v: any) => list.push(v.color || v.colorName || v.ColorName));
    const clean = Array.from(new Set(list.map(normalizeVariantText).filter(Boolean)));
    return clean.length ? clean : ['Mặc định'];
  }

  function findSelectedVariant(item: any, size = selectedSize, color = selectedColor) {
    const variants = Array.isArray(item?.variants) ? item.variants : [];
    if (!variants.length) return null;
    const s0 = String(size || '').toLowerCase();
    const c0 = String(color || '').toLowerCase();
    return variants.find((v: any) => {
      const vs = String(v.size || v.sizeName || v.SizeName || '').toLowerCase();
      const vc = String(v.color || v.colorName || v.ColorName || '').toLowerCase();
      return (!s0 || vs === s0) && (!c0 || vc === c0 || c0 === 'mặc định');
    }) || variants.find((v: any) => {
      const vs = String(v.size || v.sizeName || v.SizeName || '').toLowerCase();
      return !s0 || vs === s0;
    }) || variants[0];
  }

  function updateSelectedColor(c: string) {
    setSelectedColor(c);
    const variant = findSelectedVariant(mainProduct, selectedSize, c);
    setSelectedVariantId(String(variant?.id || variant?._id || variant?.variantId || ''));
  }

  function updateSelectedSize(size: string) {
    setSelectedSize(size);
    const variant = findSelectedVariant(mainProduct, size, selectedColor);
    setSelectedVariantId(String(variant?.id || variant?._id || variant?.variantId || ''));
  }

  function requireSizeColor() {
    const ss = productSizes(mainProduct);
    const cc = productColors(mainProduct);
    if (ss.length && !selectedSize) {
      Alert.alert('Chưa chọn size', 'Vui lòng chọn size muốn thử trước.');
      return false;
    }
    if (cc.length > 1 && !selectedColor) {
      Alert.alert('Chưa chọn màu', 'Vui lòng chọn màu sắc muốn thử trước.');
      return false;
    }
    return true;
  }

  function updateQuiz(key: string, value: string) {
    const next = { ...quiz, [key]: value };
    setQuiz(next);
    const rec = v49RecommendSize(next);
    setRecommendedSize(rec);
    if (!selectedSize) updateSelectedSize(rec);
  }

  async function suggestByUserPhoto() {
    if (!userImage?.base64) {
      Alert.alert('Cần ảnh của bạn', 'Hãy chọn hoặc chụp ảnh của bạn trước.');
      return;
    }
    if (!mainProduct) {
      Alert.alert('Chưa có sản phẩm', 'Hãy quay lại sản phẩm bạn thích và bấm Thử đồ.');
      return;
    }
    if (!requireSizeColor()) return;

    const rec = v49RecommendSize(quiz);
    setRecommendedSize(rec);
    setSelectedSize(selectedSize || rec);

    try {
      setLoading(true);
      const data = await v49Post('/api/v49/shop/recommend-accessories', {
        personImageBase64: userImage.base64,
        mainProductId: v49ProductId(mainProduct),
        quiz,
        selectedSize: selectedSize || rec,
        selectedColor: selectedColor || 'Mặc định',
        selectedVariantId,
        adultConfirmed,
      }, {
        ok: false,
        items: accessories,
        autoSelected: accessories.slice(0, 3),
        tips: {
          summary: 'Đang dùng gợi ý offline. Khi backend chạy, AI sẽ phân tích ảnh người dùng và sắp xếp phụ kiện phù hợp hơn.',
          sizeAdvice: [`Size gợi ý theo quiz: ${rec}`],
          accessoryAdvice: ['Dây chuyền/cổ, đồng hồ/cổ tay, túi/vai hoặc tay, dù/cầm tay, khăn trùm đầu/tóc.'],
        },
      });

      const newAccessories = data.items || accessories;
      const autoSelected = data.autoSelected || newAccessories.slice(0, 3);
      setAccessories(newAccessories);
      setSelectedAccessories(autoSelected.slice(0, 3));
      setTips(data.tips || null);
      setSuggested(true);
      setMessage('Đã gợi ý lại phụ kiện theo ảnh của bạn và món đồ đang thử.');
    } catch (e: any) {
      Alert.alert('Gợi ý lỗi', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function runTryOn() {
    if (!userImage?.base64) {
      Alert.alert('Thiếu ảnh người', 'Hãy chọn hoặc chụp ảnh của bạn trước.');
      return;
    }
    if (!mainProduct) {
      Alert.alert('Thiếu sản phẩm chính', 'Hãy quay lại sản phẩm bạn thích và bấm Thử đồ.');
      return;
    }
    if (!requireSizeColor()) return;

    try {
      setLoading(true);
      setResultImg('');
      const rec = recommendedSize || v49RecommendSize(quiz);
      const data = await v49Post('/api/v49/mobile/tryon-selected-product', {
        personImageBase64: userImage.base64,
        mainProductId: v49ProductId(mainProduct),
        accessoryProductIds: selectedAccessories.map(v49ProductId),
        quiz,
        selectedSize: selectedSize || rec,
        selectedColor: selectedColor || 'Mặc định',
        selectedVariantId,
        recommendedSize: rec,
        adultConfirmed,
      });

      const final = data?.finalImageBase64
        ? (String(data.finalImageBase64).startsWith('data:') ? data.finalImageBase64 : `data:image/png;base64,${data.finalImageBase64}`)
        : '';

      setResultImg(final);
      setTips(data?.tips || tips);
      setMessage(data?.message || 'Đã tạo thử đồ với sản phẩm shop.');
      if (!final) Alert.alert('Chưa có ảnh kết quả', data?.message || 'AI Gateway chưa trả ảnh.');
    } catch (e: any) {
      Alert.alert('Thử đồ lỗi', e.message || 'Network request failed');
    } finally {
      setLoading(false);
    }
  }

  const mainImage = v49FirstImage(mainProduct);
  const sizes = productSizes(mainProduct);
  const colors = productColors(mainProduct);

  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={s.topbar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router?.back?.()}>
          <Text style={s.backText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>Thử đồ</Text>
        <View style={{ width: 76 }} />
      </View>

      <Text style={s.title}>Thử đồ AI Shop</Text>
      <Text style={s.sub}>
        Sản phẩm chính là món bạn đã bấm trong shop. App dùng ảnh đầu tiên của sản phẩm, không cho chọn ảnh sản phẩm ngoài.
      </Text>

      <View style={s.productCard}>
        <Image source={{ uri: mainImage || 'https://placehold.co/600x800/fdf2f8/be185d?text=JAPANO' }} style={s.productImg} />
        <View style={s.productInfo}>
          <Text style={s.productName}>{mainProduct?.name || 'Sản phẩm đang thử'}</Text>
          <View style={s.priceRow}>
            <Text style={s.productPrice}>{v49Money(mainProduct?.price)}</Text>
            {mainProduct?.originalPrice ? <Text style={s.oldPrice}>{v49Money(mainProduct.originalPrice)}</Text> : null}
          </View>
          <Text style={s.productNote}>Ảnh đồ = ảnh đầu tiên của sản phẩm này.</Text>
          <Text style={s.selectedLine}>Đang thử: Size {selectedSize || 'chưa chọn'} • Màu {selectedColor || 'Mặc định'}</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.section}>1. Thêm ảnh của bạn</Text>
        <Text style={s.note}>Sau khi thêm ảnh, phần gợi ý size/phụ kiện mới xuất hiện.</Text>
        <View style={s.rowButtons}>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => pickUserImage(setUserImage)}>
            <Text style={s.secondaryText}>Chọn ảnh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => takeUserPhoto(setUserImage)}>
            <Text style={s.secondaryText}>Chụp ảnh</Text>
          </TouchableOpacity>
        </View>
        {userImage?.uri ? <Image source={{ uri: userImage.uri }} style={s.userPreview} /> : null}
      </View>

      {userImage?.uri ? (
        <View style={s.card}>
          <Text style={s.section}>2. Quiz size & gợi ý</Text>
          <Text style={s.note}>Nhập nhanh số đo để chương trình gợi ý size. Bạn vẫn có thể chọn size khác.</Text>

          <View style={s.grid2}>
            <TextInput style={s.input} keyboardType="numeric" placeholder="Chiều cao cm" value={quiz.height} onChangeText={(v) => updateQuiz('height', v)} />
            <TextInput style={s.input} keyboardType="numeric" placeholder="Cân nặng kg" value={quiz.weight} onChangeText={(v) => updateQuiz('weight', v)} />
            <TextInput style={s.input} keyboardType="numeric" placeholder="Ngực cm" value={quiz.bust} onChangeText={(v) => updateQuiz('bust', v)} />
            <TextInput style={s.input} keyboardType="numeric" placeholder="Eo cm" value={quiz.waist} onChangeText={(v) => updateQuiz('waist', v)} />
            <TextInput style={s.input} keyboardType="numeric" placeholder="Hông cm" value={quiz.hip} onChangeText={(v) => updateQuiz('hip', v)} />
            <TextInput style={s.input} keyboardType="numeric" placeholder="Vai cm" value={quiz.shoulder} onChangeText={(v) => updateQuiz('shoulder', v)} />
          </View>

          <Text style={s.label}>Chọn màu sắc</Text>
          <View style={s.sizeWrap}>
            {colors.map((c) => (
              <TouchableOpacity key={c} style={[s.sizePill, selectedColor === c && s.sizeSelected]} onPress={() => updateSelectedColor(c)}>
                <Text style={[s.sizeText, selectedColor === c && s.sizeTextSelected]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Chọn size</Text>
          <View style={s.sizeWrap}>
            {sizes.map((size) => (
              <TouchableOpacity key={size} style={[s.sizePill, selectedSize === size && s.sizeSelected]} onPress={() => updateSelectedSize(size)}>
                <Text style={[s.sizeText, selectedSize === size && s.sizeTextSelected]}>{size}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.selectionSummary}>
            <Text style={s.selectionSummaryText}>Đang chọn: Size {selectedSize || recommendedSize || 'chưa chọn'} • Màu {selectedColor || 'Mặc định'}</Text>
            <Text style={s.selectionSummarySub}>Thông tin này sẽ gửi qua backend khi tạo thử đồ AI thật.</Text>
          </View>

          <View style={s.recommendBox}>
            <Text style={s.recommendTitle}>Size gợi ý: {recommendedSize || v49RecommendSize(quiz)}</Text>
            <Text style={s.note}>Gợi ý dựa vào quiz. Khi có backend/AI, hệ thống có thể cộng thêm phân tích ảnh người dùng.</Text>
          </View>

          <Text style={s.label}>Bảng kích thước tham khảo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={[s.tableRow, s.tableHead]}>
                <Text style={s.cell}>Size</Text><Text style={s.cell}>Cao</Text><Text style={s.cell}>Nặng</Text><Text style={s.cell}>Ngực</Text><Text style={s.cell}>Eo</Text><Text style={s.cell}>Hông</Text>
              </View>
              {V49_SIZE_CHART.map((r) => (
                <View key={r.size} style={s.tableRow}>
                  <Text style={s.cell}>{r.size}</Text><Text style={s.cell}>{r.height}</Text><Text style={s.cell}>{r.weight}</Text><Text style={s.cell}>{r.bust}</Text><Text style={s.cell}>{r.waist}</Text><Text style={s.cell}>{r.hip}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={s.row}>
            <Text style={{ flex: 1, color: '#9d174d', fontWeight: '800' }}>Xác nhận adult fashion nếu là bikini / đồ bơi / crop-top</Text>
            <Switch value={adultConfirmed} onValueChange={setAdultConfirmed} />
          </View>

          <TouchableOpacity style={s.primaryBtn} onPress={suggestByUserPhoto} disabled={loading}>
            <Text style={s.primaryText}>{loading ? 'Đang gợi ý...' : 'Gợi ý size & phụ kiện từ shop'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={s.card}>
        <Text style={s.section}>{suggested ? '3. Phụ kiện phù hợp đã gợi ý' : '3. Chọn phụ kiện shop'}</Text>
        <Text style={s.note}>Phụ kiện lấy từ database shop: dù, dây chuyền, khăn trùm đầu, đồng hồ, túi, kính, bông tai...</Text>
        <TextInput style={s.input} placeholder="Tìm phụ kiện..." value={query} onChangeText={setQuery} />
        <FlatList
          horizontal
          data={visibleAccessories}
          keyExtractor={(p, i) => `${v49ProductId(p)}-${i}`}
          renderItem={({ item }) => (
            <AccessoryCard item={item} selected={selectedAccessories.some((x) => v49ProductId(x) === v49ProductId(item))} onPress={toggleAccessory} />
          )}
          showsHorizontalScrollIndicator={false}
        />
        <Text style={s.note}>Đã chọn: {selectedAccessories.map((x) => x.name).join(', ') || 'chưa chọn phụ kiện'}</Text>
      </View>

      {tips ? (
        <View style={s.card}>
          <Text style={s.section}>Gợi ý của hệ thống</Text>
          <Text style={s.note}>Tóm tắt: {tips.summary || '—'}</Text>
          <Text style={s.note}>Size: {(tips.sizeAdvice || []).join(' | ') || '—'}</Text>
          <Text style={s.note}>Phụ kiện: {(tips.accessoryAdvice || []).join(' | ') || '—'}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={s.tryBtn} onPress={runTryOn} disabled={loading}>
        <Text style={s.tryText}>{loading ? 'Đang tạo...' : 'Tạo thử đồ với sản phẩm này'}</Text>
      </TouchableOpacity>

      <View style={s.card}>
        <Text style={s.section}>Trạng thái</Text>
        <Text style={s.note}>{message}</Text>
      </View>

      {resultImg ? (
        <View style={s.card}>
          <Text style={s.section}>Kết quả cuối</Text>
          <Image source={{ uri: resultImg }} style={s.result} />
          <Text style={s.note}>Nếu AI trả nhiều ảnh khác nhau, hệ thống lấy ảnh đầu tiên làm final.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, gap: 14, backgroundColor: '#fff7fb' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  backBtn: { paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: '#fbcfe8' },
  backText: { color: '#9d174d', fontWeight: '900' },
  topTitle: { color: '#831843', fontWeight: '900', fontSize: 16 },
  title: { fontSize: 30, fontWeight: '900', color: '#831843' },
  sub: { color: '#6b7280', lineHeight: 20 },
  card: { backgroundColor: 'white', borderRadius: 22, padding: 14, borderWidth: 1, borderColor: '#fbcfe8', gap: 10 },
  productCard: { backgroundColor: 'white', borderRadius: 24, padding: 12, borderWidth: 1, borderColor: '#fbcfe8', flexDirection: 'row', gap: 14 },
  productImg: { width: 116, height: 152, borderRadius: 18, backgroundColor: '#f3f4f6' },
  productInfo: { flex: 1, gap: 6 },
  productName: { fontWeight: '900', fontSize: 19, color: '#111827' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  productPrice: { color: '#be185d', fontWeight: '900', fontSize: 21 },
  oldPrice: { color: '#9ca3af', textDecorationLine: 'line-through' },
  productNote: { color: '#6b7280', lineHeight: 18 },
  selectedLine: { color: '#be185d', fontWeight: '900', lineHeight: 18 },
  section: { fontSize: 20, fontWeight: '900', color: '#9d174d' },
  note: { color: '#374151', lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowButtons: { flexDirection: 'row', gap: 10 },
  primaryBtn: { backgroundColor: '#ec4899', borderRadius: 16, padding: 14, alignItems: 'center' },
  primaryText: { color: 'white', fontWeight: '900' },
  secondaryBtn: { flex: 1, backgroundColor: '#fdf2f8', borderRadius: 14, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: '#f9a8d4' },
  secondaryText: { color: '#be185d', fontWeight: '900' },
  tryBtn: { backgroundColor: '#111827', borderRadius: 18, padding: 16, alignItems: 'center' },
  tryText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  userPreview: { width: '100%', height: 310, borderRadius: 18, backgroundColor: '#f3f4f6' },
  input: { borderWidth: 1, borderColor: '#f9a8d4', borderRadius: 14, padding: 12, backgroundColor: '#fff' },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontWeight: '900', color: '#831843', marginTop: 2 },
  sizeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sizePill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: '#f9a8d4', backgroundColor: '#fff' },
  sizeSelected: { backgroundColor: '#ec4899', borderColor: '#ec4899' },
  sizeText: { color: '#831843', fontWeight: '900' },
  sizeTextSelected: { color: 'white' },
  selectionSummary: { backgroundColor: '#fff1f2', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#fda4af' },
  selectionSummaryText: { color: '#9f1239', fontWeight: '900' },
  selectionSummarySub: { color: '#be123c', fontSize: 12, fontWeight: '700', marginTop: 3 },
  recommendBox: { backgroundColor: '#fdf2f8', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#fbcfe8' },
  recommendTitle: { color: '#be185d', fontWeight: '900', fontSize: 16 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#fce7f3' },
  tableHead: { backgroundColor: '#fdf2f8' },
  cell: { width: 92, padding: 8, color: '#374151', fontWeight: '700' },
  accCard: { width: 156, marginRight: 10, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#fce7f3', overflow: 'hidden' },
  accSelected: { borderColor: '#ec4899', borderWidth: 3, backgroundColor: '#fdf2f8' },
  accImg: { width: '100%', height: 148, backgroundColor: '#f3f4f6' },
  accBody: { padding: 9 },
  accName: { fontWeight: '900', color: '#111827', minHeight: 40 },
  price: { color: '#be185d', fontWeight: '900' },
  small: { color: '#6b7280', fontSize: 12 },
  check: { position: 'absolute', top: 8, right: 8, backgroundColor: '#ec4899', borderRadius: 999, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: 'white', fontWeight: '900' },
  result: { width: '100%', height: 540, borderRadius: 18, backgroundColor: '#f3f4f6' },
});
