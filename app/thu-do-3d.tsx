// JAPANO - THỬ ĐỒ 3D (khác thử đồ ảnh 2D): xoay nhiều góc, dùng ảnh thật HOẶC người mẫu tuỳ chỉnh dáng.
// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import AppButton from '../components/AppButton';
import { SafeImage } from '../components/SafeImage';
import { cardStyle, fontFamily, inputStyle, onPrimary, pill, pillText, scaleFont } from '../lib/styles';
import {
  V49_FALLBACK_ACCESSORIES, V49_FALLBACK_PRODUCTS,
  v49FirstImage, v49Get, v49IsAccessory, v49Money, v49Post, v49ProductId,
} from '../lib/japanoV49ShopApi';

const BUILDS = [['Gầy', 0.82], ['Cân đối', 1.0], ['Đầy đặn', 1.25], ['Mập', 1.5]];
const PART_OPTS = [['Nhỏ', 0.85], ['Vừa', 1.0], ['To', 1.2]];

async function pickImg(setter) {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, base64: true });
  if (r.canceled || !r.assets?.[0]) return;
  const a = r.assets[0];
  setter({ uri: a.uri, base64: `data:${a.mimeType || 'image/jpeg'};base64,${a.base64 || ''}` });
}
async function takeImg(setter) {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) { Alert.alert('Chưa có quyền camera', 'Hãy cấp quyền camera.'); return; }
  const r = await ImagePicker.launchCameraAsync({ quality: 0.9, base64: true });
  if (r.canceled || !r.assets?.[0]) return;
  const a = r.assets[0];
  setter({ uri: a.uri, base64: `data:${a.mimeType || 'image/jpeg'};base64,${a.base64 || ''}` });
}

function PartRow({ theme, label, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ width: 70, color: theme.text, fontWeight: '800', fontSize: scaleFont(theme, 13) }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 6, flex: 1 }}>
        {PART_OPTS.map(([lbl, v]) => (
          <Pressable key={lbl} onPress={() => onChange(v)} style={[pill(theme, value === v), { flex: 1 }]}><Text style={pillText(theme, value === v)}>{lbl}</Text></Pressable>
        ))}
      </View>
    </View>
  );
}

export default function ThuDo3DScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() || {};
  const { theme } = useApp();

  const [mode, setMode] = useState('mannequin'); // 'photo' | 'mannequin'
  const [userImage, setUserImage] = useState(null);
  const [mainProduct, setMainProduct] = useState(null);
  const [accessories, setAccessories] = useState(V49_FALLBACK_ACCESSORIES);
  const [selectedAccessories, setSelectedAccessories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suggestingAcc, setSuggestingAcc] = useState(false);
  const [frames, setFrames] = useState([]);
  const [modelUrl, setModelUrl] = useState('');
  const [frameIndex, setFrameIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [message, setMessage] = useState('Chọn "Người mẫu 3D" rồi tuỳ chỉnh dáng, hoặc dùng ảnh của bạn, sau đó bấm "Tạo 3D".');

  const [height, setHeight] = useState(165);
  const [build, setBuild] = useState(1.0);
  const [shoulder, setShoulder] = useState(1.0);
  const [chest, setChest] = useState(1.0);
  const [waist, setWaist] = useState(1.0);
  const [hip, setHip] = useState(1.0);

  const rotTimer = useRef(null);

  async function loadShop() {
    try {
      let fromParam = null;
      if (params.product) { try { fromParam = JSON.parse(decodeURIComponent(String(params.product))); } catch {} }
      const data = await v49Get('/api/v49/shop/products', { items: [...V49_FALLBACK_PRODUCTS, ...V49_FALLBACK_ACCESSORIES], offline: true });
      const items = data.items || [];
      const acc = items.filter(v49IsAccessory);
      setAccessories(acc.length ? acc : V49_FALLBACK_ACCESSORIES);
      const pid = String(params.productId || params.id || '');
      setMainProduct(fromParam || items.find((p) => v49ProductId(p) === pid) || V49_FALLBACK_PRODUCTS[0]);
    } catch { setMainProduct((m) => m || V49_FALLBACK_PRODUCTS[0]); }
  }
  useEffect(() => { loadShop(); }, []);

  useEffect(() => {
    if (rotTimer.current) clearInterval(rotTimer.current);
    if (autoRotate && frames.length > 1) {
      rotTimer.current = setInterval(() => setFrameIndex((i) => (i + 1) % frames.length), 280);
    }
    return () => rotTimer.current && clearInterval(rotTimer.current);
  }, [autoRotate, frames.length]);

  async function suggestAccessories() {
    try {
      setSuggestingAcc(true);
      const data = await v49Get(`/api/v49/shop/suggest-accessories?productId=${encodeURIComponent(v49ProductId(mainProduct))}&limit=5`, { ok: true, productIds: [] });
      const ids = Array.isArray(data?.productIds) ? data.productIds : [];
      let picked = ids.map((x) => accessories.find((p) => String(v49ProductId(p)) === String(x))).filter(Boolean);
      if (!picked.length) picked = accessories.slice(0, 3);
      setSelectedAccessories(picked.slice(0, 5));
    } finally { setSuggestingAcc(false); }
  }

  function toggleAcc(p) {
    const id = v49ProductId(p);
    setSelectedAccessories((old) => old.some((x) => v49ProductId(x) === id) ? old.filter((x) => v49ProductId(x) !== id) : [...old, p].slice(0, 5));
  }

  async function create3D() {
    if (mode === 'photo' && !userImage?.base64) { Alert.alert('Thiếu ảnh', 'Hãy chọn/chụp ảnh của bạn, hoặc chuyển sang Người mẫu 3D.'); return; }
    try {
      setLoading(true); setFrames([]); setModelUrl(''); setMessage('Đang dựng mô hình 3D thật...');
      const data = await v49Post('/api/v49/mobile/tryon-3d', {
        useMannequin: mode === 'mannequin',
        personImageBase64: mode === 'photo' ? userImage.base64 : '',
        mannequin: { height, build, shoulder, chest, waist, hip },
        mainProductId: v49ProductId(mainProduct),
        mainProductImageUrl: v49FirstImage(mainProduct),
        mainProductImageUrls: (Array.isArray(mainProduct?.images) ? mainProduct.images : []).map((x) => typeof x === 'string' ? x : (x?.url || x?.secure_url || '')).filter(Boolean),
        accessoryProductIds: selectedAccessories.map(v49ProductId),
        frames: 6,
      }, { ok: false, message: 'Không kết nối được máy chủ. Hãy chạy backend (cổng 4000).' });
      const fr = Array.isArray(data?.frames) ? data.frames.filter(Boolean) : [];
      setFrames(fr); setModelUrl(String(data?.modelUrl || '')); setFrameIndex(0); setAutoRotate(true);
      setMessage(data?.message || (fr.length ? 'Đã dựng 3D.' : 'Chưa có kết quả 3D.'));
    } catch (e) {
      setMessage(`Không tạo được 3D: ${e?.message || 'lỗi mạng'}.`);
    } finally { setLoading(false); }
  }

  const mainImage = v49FirstImage(mainProduct);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Pressable onPress={() => (router.canGoBack?.() ? router.back() : router.replace('/(tabs)/shop'))} style={{ width: 42, height: 42, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>
        <Text style={{ flex: 1, color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 17) }}>Thử đồ 3D</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {/* Đồ chính */}
        <View style={[cardStyle(theme), { padding: 12, flexDirection: 'row', gap: 12 }]}>
          <SafeImage source={{ uri: mainImage }} style={{ width: 96, height: 124, backgroundColor: theme.background }} resizeMode="cover" />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 16) }}>{mainProduct?.name || 'Sản phẩm'}</Text>
            <Text style={{ color: theme.primary, fontWeight: '900', fontSize: scaleFont(theme, 17) }}>{v49Money(mainProduct?.price)}</Text>
            <Text style={{ color: theme.muted, fontSize: scaleFont(theme, 12) }}>3D dựng nhiều góc để bạn xem toàn cảnh khi mặc lên người.</Text>
          </View>
        </View>

        {/* Chế độ */}
        <View style={[cardStyle(theme), { padding: 14, gap: 10 }]}>
          <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 16) }}>1. Dùng gì để dựng 3D?</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><AppButton title="Người mẫu 3D" icon="user" variant={mode === 'mannequin' ? 'primary' : 'outline'} onPress={() => setMode('mannequin')} /></View>
            <View style={{ flex: 1 }}><AppButton title="Ảnh của tôi" icon="camera" variant={mode === 'photo' ? 'primary' : 'outline'} onPress={() => setMode('photo')} /></View>
          </View>

          {mode === 'photo' ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><AppButton title="Chọn ảnh" icon="image" variant="outline" onPress={() => pickImg(setUserImage)} /></View>
                <View style={{ flex: 1 }}><AppButton title="Chụp ảnh" icon="camera" variant="outline" onPress={() => takeImg(setUserImage)} /></View>
              </View>
              {userImage?.uri ? <SafeImage source={{ uri: userImage.uri }} style={{ width: '100%', height: 300, backgroundColor: theme.background }} resizeMode="contain" /> : null}
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ color: theme.muted, fontSize: scaleFont(theme, 12) }}>Không cần ảnh của bạn — chọn dáng người mẫu để xem đồ lên dáng đó.</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ width: 70, color: theme.text, fontWeight: '800', fontSize: scaleFont(theme, 13) }}>Chiều cao</Text>
                <Pressable onPress={() => setHeight((h) => Math.max(140, h - 1))} style={{ width: 40, height: 40, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}><Feather name="minus" size={16} color={theme.text} /></Pressable>
                <Text style={{ width: 60, textAlign: 'center', color: theme.heading, fontWeight: '900' }}>{height}cm</Text>
                <Pressable onPress={() => setHeight((h) => Math.min(200, h + 1))} style={{ width: 40, height: 40, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}><Feather name="plus" size={16} color={theme.text} /></Pressable>
              </View>
              <Text style={{ color: theme.text, fontWeight: '800' }}>Dáng người</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {BUILDS.map(([lbl, v]) => (
                  <Pressable key={lbl} onPress={() => setBuild(v)} style={[pill(theme, build === v), { flex: 1 }]}><Text style={pillText(theme, build === v)}>{lbl}</Text></Pressable>
                ))}
              </View>
              <PartRow theme={theme} label="Vai" value={shoulder} onChange={setShoulder} />
              <PartRow theme={theme} label="Ngực" value={chest} onChange={setChest} />
              <PartRow theme={theme} label="Eo" value={waist} onChange={setWaist} />
              <PartRow theme={theme} label="Hông" value={hip} onChange={setHip} />
            </View>
          )}
        </View>

        {/* Phụ kiện */}
        <View style={[cardStyle(theme), { padding: 14, gap: 10 }]}>
          <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 16) }}>2. Phụ kiện đi kèm (tuỳ chọn)</Text>
          <AppButton title={suggestingAcc ? 'Đang gợi ý...' : 'Gợi ý phụ kiện đi kèm'} icon="zap" variant="outline" loading={suggestingAcc} onPress={suggestAccessories} />
          <FlatList
            horizontal data={accessories} keyExtractor={(p, i) => `${v49ProductId(p)}-${i}`}
            showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}
            renderItem={({ item }) => {
              const sel = selectedAccessories.some((x) => v49ProductId(x) === v49ProductId(item));
              return (
                <Pressable onPress={() => toggleAcc(item)} style={{ width: 130, borderWidth: sel ? 2 : 1, borderColor: sel ? theme.primary : theme.border, backgroundColor: theme.card }}>
                  <SafeImage source={{ uri: v49FirstImage(item) }} style={{ width: '100%', height: 110, backgroundColor: theme.background }} resizeMode="cover" />
                  <View style={{ padding: 7 }}>
                    <Text numberOfLines={2} style={{ color: theme.heading, fontWeight: '900', fontSize: scaleFont(theme, 11), minHeight: 30 }}>{item?.name}</Text>
                  </View>
                  {sel ? <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: theme.primary, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}><Feather name="check" size={14} color={onPrimary(theme)} /></View> : null}
                </Pressable>
              );
            }}
          />
        </View>

        <AppButton title={loading ? 'Đang dựng 3D...' : 'Tạo 3D'} icon="box" loading={loading} onPress={create3D} />

        <View style={[cardStyle(theme), { padding: 14, gap: 6 }]}>
          <Text style={{ color: theme.heading, fontWeight: '900' }}>Trạng thái</Text>
          <Text style={{ color: theme.text, lineHeight: 20 }}>{message}</Text>
        </View>

        {frames.length ? (
          <View style={[cardStyle(theme), { padding: 14, gap: 10 }]}>
            <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 16) }}>Mô hình 3D — xoay để xem toàn cảnh</Text>
            <View style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}>
              <SafeImage source={{ uri: frames[frameIndex] }} style={{ width: '100%', height: 520 }} resizeMode="contain" />
            </View>
            {modelUrl ? <AppButton title="Mở model 3D GLB" icon="box" variant="outline" onPress={() => Linking.openURL(modelUrl)} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Pressable onPress={() => { setAutoRotate(false); setFrameIndex((i) => (i - 1 + frames.length) % frames.length); }} style={{ width: 50, height: 46, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}><Feather name="rotate-ccw" size={18} color={theme.text} /></Pressable>
              <View style={{ flex: 1 }}><AppButton title={autoRotate ? 'Dừng xoay' : 'Tự xoay'} icon={autoRotate ? 'pause' : 'play'} onPress={() => setAutoRotate((v) => !v)} /></View>
              <Pressable onPress={() => { setAutoRotate(false); setFrameIndex((i) => (i + 1) % frames.length); }} style={{ width: 50, height: 46, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}><Feather name="rotate-cw" size={18} color={theme.text} /></Pressable>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              {frames.map((_, i) => <View key={i} style={{ width: 8, height: 8, backgroundColor: i === frameIndex ? theme.primary : theme.border }} />)}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
