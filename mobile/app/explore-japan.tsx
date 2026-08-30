import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Screen, Header, Btn, money } from '../components/ui';
import { SmartImage } from '../components/SmartImage';
import { JapanMap } from '../components/JapanMap';
import { useCatalog } from '../lib/data';
import { JapanSpot, PHOTO_ATTRIBUTION, PREFECTURE_VIDEO, prefecturesInRegion, regionsList, spotsInPrefecture } from '../lib/japanSpots';
import { composeScenePhoto, generateTryOn, getJapanSpotReviews, getJapanSpotSuggestions, getSpotRecommendations, JapanScene, JapanSpotReview, JapanSpotSuggestion, postJapanSpotReview, postJapanSpotSuggestion, SpotRecommendation, SpotRewardConfig, TryOnSafetyError } from '../lib/api';
import * as ImagePicker from 'expo-image-picker';
import { saveMediaToLibrary, shareMedia } from '../lib/media';
import { loadStyleProfile } from '../lib/profile';
import { useStore } from '../lib/store';
import { beginGpuJob, endGpuJob } from '../lib/useGpuFocus';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { MediaAttachPicker, ReviewMediaPlayer } from '../components/MediaAttach';
import { ReviewMediaPick } from '../lib/media';
import { C, F } from '../theme/tokens';

const REGION_KANJI: Record<string, string> = {
  'Hokkaido': '北海道', 'Tōhoku': '東北', 'Kantō': '関東', 'Chūbu': '中部',
  'Kansai': '関西', 'Chūgoku': '中国', 'Shikoku': '四国', 'Kyūshū & Okinawa': '九州',
};

type ExploreLevel = 'regions' | 'prefectures' | 'spots' | 'detail';

export default function ExploreJapan() {
  const router = useRouter();
  const [view, setView] = useState<ExploreLevel>('regions');
  const [region, setRegion] = useState('');
  const [prefecture, setPrefecture] = useState('');
  const [spot, setSpot] = useState<JapanSpot | null>(null);
  const regions = useMemo(() => regionsList(), []);
  const prefectures = useMemo(() => (region ? prefecturesInRegion(region) : []), [region]);
  const spots = useMemo(() => (prefecture ? spotsInPrefecture(prefecture) : []), [prefecture]);

  const back = () => {
    if (view === 'detail') { setView('spots'); setSpot(null); return; }
    if (view === 'spots') { setView('prefectures'); setPrefecture(''); return; }
    if (view === 'prefectures') { setView('regions'); setRegion(''); return; }
    router.back();
  };

  const title = view === 'regions' ? 'Khám phá Nhật Bản' : view === 'prefectures' ? region : view === 'spots' ? prefecture : spot?.place || '';

  return (
    <Screen>
      <Header title={title} onBack={back} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 28 }}>
        {view === 'regions' && (
          <>
            <View style={st.notebook}>
              <Text style={st.notebookKicker}>NHẬT KÝ NHỎ VỀ NHẬT BẢN</Text>
              <Text style={st.notebookText}>Nhật Bản trải dài từ Hokkaido băng tuyết ở phía bắc đến Okinawa biển xanh ở phía nam — mỗi vùng một khí hậu, một nếp sống và một cách mặc riêng. JAPANO gom lại những địa điểm đẹp và có thật để bạn lên kế hoạch cho chuyến đi, hoặc đơn giản là biết thêm một câu chuyện nhỏ trước khi diện bộ đồ yêu thích.</Text>
            </View>
            <Text style={st.mapHint}>Chạm vào một vùng trên bản đồ hoặc chọn trong danh sách bên dưới.</Text>
            <View style={st.mapWrap}>
              <JapanMap availableRegions={regions} onSelect={r => { setRegion(r); setView('prefectures'); }} />
            </View>
            {regions.map(r => {
              const count = prefecturesInRegion(r).reduce((s, p) => s + spotsInPrefecture(p).length, 0);
              return (
                <Pressable key={r} style={st.regionCard} onPress={() => { setRegion(r); setView('prefectures'); }}>
                  <View style={st.regionKanji}><Text style={st.regionKanjiT}>{REGION_KANJI[r] || '日'}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.regionName}>{r}</Text>
                    <Text style={st.regionSub}>{count} địa điểm · {prefecturesInRegion(r).length} tỉnh</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.muted} />
                </Pressable>
              );
            })}
          </>
        )}

        {view === 'prefectures' && prefectures.map(p => {
          const list = spotsInPrefecture(p);
          return (
            <Pressable key={p} style={st.prefCard} onPress={() => { setPrefecture(p); setView('spots'); }}>
              <SmartImage source={{ uri: list[0]?.photoUrl }} style={st.prefImg} recyclingKey={`explore-pref-${p}`} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={st.prefName}>{p}</Text>
                <Text style={st.prefSub}>{list.length} địa điểm nổi tiếng</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </Pressable>
          );
        })}

        {view === 'spots' && (
          <>
            {!!PREFECTURE_VIDEO[prefecture] && <PrefectureVideo videoId={PREFECTURE_VIDEO[prefecture]} prefecture={prefecture} />}
            {spots.map(s => (
              <Pressable key={s.place} style={st.spotCard} onPress={() => { setSpot(s); setView('detail'); }}>
                <SmartImage source={{ uri: s.photoUrl }} style={st.spotImg} recyclingKey={`explore-spot-${s.place}`} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={st.spotName}>{s.place}</Text>
                  <Text style={st.spotTime}>{s.time}</Text>
                  <Text style={st.spotTip} numberOfLines={2}>{s.tip}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.muted} />
              </Pressable>
            ))}
            <SuggestionBox prefecture={prefecture} />
          </>
        )}

        {view === 'detail' && spot && <SpotDetail spot={spot} />}
      </ScrollView>
    </Screen>
  );
}

function SpotDetail({ spot }: { spot: JapanSpot }) {
  const router = useRouter();
  const { products } = useCatalog();
  const product = products.find(item => item.slug === spot.slug) || products[0];
  const openMap = () => { void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.mapQuery)}`).catch(() => undefined); };
  const openSource = () => { void Linking.openURL(spot.sourceUrl).catch(() => undefined); };
  return (
    <>
      <SmartImage source={{ uri: spot.photoUrl }} style={st.heroImg} recyclingKey={`explore-detail-${spot.place}`} />
      <Text style={st.photoCredit}>{PHOTO_ATTRIBUTION}</Text>
      <View style={st.info}><Ionicons name="camera-outline" size={19} color={C.ink} /><View style={{ flex: 1 }}><Text style={st.time}>{spot.time}</Text><Text style={st.tip}>{spot.tip}</Text></View></View>

      <GuideSection icon="navigate-circle-outline" title="NẰM Ở ĐÂU?">
        <Text style={st.guideText}>{spot.where}</Text>
        <Pressable style={st.mapButton} onPress={openMap}><Ionicons name="map-outline" size={14} color={C.ink} /><Text style={st.mapButtonText}>Mở vị trí trên bản đồ</Text><Ionicons name="open-outline" size={12} color={C.ink} /></Pressable>
      </GuideSection>
      <GuideSection icon="time-outline" title="LỊCH SỬ NGẮN">
        <Text style={st.guideText}>{spot.history}</Text>
      </GuideSection>
      <GuideSection icon="sparkles-outline" title="CÓ GÌ NỔI BẬT?">
        {spot.highlights.map((item, index) => <View key={index} style={st.bulletRow}><View style={st.bullet} /><Text style={st.bulletText}>{item}</Text></View>)}
      </GuideSection>
      <GuideSection icon="camera-outline" title="CHỤP ẢNH Ở ĐÂU ĐẸP?">
        {spot.photoSpots.map((p, index) => <View key={p.name} style={st.photoSpot}><Text style={st.photoIndex}>{String(index + 1).padStart(2, '0')}</Text><View style={{ flex: 1 }}><Text style={st.photoName}>{p.name}</Text><Text style={st.photoTip}>{p.tip}</Text></View></View>)}
      </GuideSection>
      <GuideSection icon="bus-outline" title="ĐI THẾ NÀO?">
        <Text style={st.guideText}>{spot.access}</Text>
      </GuideSection>
      <Pressable style={st.source} onPress={openSource}><Ionicons name="shield-checkmark-outline" size={14} color={C.kin} /><Text style={st.sourceText}>Nguồn kiểm chứng: {spot.sourceLabel}</Text><Ionicons name="open-outline" size={12} color={C.kin} /></Pressable>

      <TravelTryOnBox spot={spot} />

      <ReviewsBox place={spot.place} prefecture={spot.prefecture} />

      {product && (
        <>
          <View style={st.outfitDivider}><View style={st.dividerLine} /><Text style={st.dividerText}>PHỐI ĐỒ CHO CHUYẾN ĐI</Text><View style={st.dividerLine} /></View>
          <View style={st.outfit}><SmartImage source={product.images[0]} style={st.thumb} recyclingKey={`explore-outfit-${product.slug}`} /><View style={{ flex: 1 }}><Text style={st.outfitLabel}>BỘ ĐỒ ĐỀ XUẤT</Text><Text style={st.product} numberOfLines={2}>{product.name}</Text><Text style={st.price}>{money(product.price)}</Text></View></View>
          <Btn label="Đi đến xem bộ đồ" onPress={() => router.push(`/product/${product.slug}`)} style={{ marginTop: 12 }} />
        </>
      )}
    </>
  );
}

/**
 * "Đưa mình tới đây": ghép ảnh khách vào chính địa điểm đang xem.
 *
 * App chỉ gửi tên địa điểm; ảnh nền do máy chủ tự tra và tự tải. Người trong
 * ảnh được CẮT ra rồi đặt lên nền, không đi qua model sinh ảnh — nên khuôn mặt
 * và cơ thể không thể bị vẽ lại.
 */
/**
 * Thử đồ JAPANO ngay tại trang địa điểm.
 *
 * Câu hỏi khối này trả lời: "nếu tôi mặc món này của JAPANO và chụp ở đây thì
 * có hợp không?" — nên nó phải nằm CÙNG trang với địa điểm, không đẩy người
 * dùng sang một màn hình khác rồi bắt chọn lại ảnh và địa điểm.
 *
 * Thứ tự xử lý cố định:
 *   ảnh người dùng → thử sản phẩm → ghép người ĐÃ MẶC ĐỒ vào phong cảnh
 *
 * Không bao giờ ghép vào cảnh trước rồi mới thử đồ: khi người đã nằm trên hậu
 * cảnh phức tạp, model giữ khuôn mặt và phối cảnh khó hơn nhiều.
 *
 * Đổi sản phẩm giữ nguyên: ảnh người, địa điểm, góc chụp, vị trí cuộn.
 */
type TravelPhoto = { uri: string; base64: string; label: string };
type TravelStep = 'idle' | 'tryon' | 'fit' | 'scene' | 'finishing';

const TRAVEL_STEP: Record<Exclude<TravelStep, 'idle'>, (product: string, place: string) => string> = {
  tryon: (product) => `Đang mặc thử ${product}…`,
  fit: () => 'Đang kiểm tra độ vừa…',
  scene: (_p, place) => `Đang đưa bạn đến ${place}…`,
  finishing: () => 'Đang hoàn thiện ảnh…',
};

const TRAVEL_FILTERS: { id: string; label: string; match: (r: SpotRecommendation) => boolean }[] = [
  { id: 'all', label: 'Tất cả', match: () => true },
  { id: 'kimono', label: 'Kimono/Yukata', match: (r) => /kimono|yukata|haori|hakama/i.test(`${r.product.name} ${r.product.garmentType || ''}`) },
  { id: 'top', label: 'Áo', match: (r) => /^áo|blouse|shirt/i.test(r.product.name) },
  { id: 'skirt', label: 'Váy', match: (r) => /váy|skirt|dress/i.test(r.product.name) },
  { id: 'pants', label: 'Quần', match: (r) => /quần|culottes|short/i.test(r.product.name) },
  { id: 'outer', label: 'Áo khoác', match: (r) => /khoác|cardigan|blazer|hanten/i.test(r.product.name) },
  { id: 'weather', label: 'Hợp thời tiết', match: (r) => r.weatherMatch },
  { id: 'color', label: 'Hợp màu cảnh', match: (r) => r.colorHarmony === 'tương phản dễ chịu' },
];

function TravelTryOnBox({ spot }: { spot: JapanSpot }) {
  const { toast } = useToast();
  const router = useRouter();
  const { addToCart } = useStore();

  const [photo, setPhoto] = useState<TravelPhoto | null>(null);
  const [recos, setRecos] = useState<SpotRecommendation[]>([]);
  const [scenes, setScenes] = useState<JapanScene[]>([]);
  const [spotInfo, setSpotInfo] = useState<any>(null);
  const [season, setSeason] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const [activeScene, setActiveScene] = useState<JapanScene | null>(null);
  const [selected, setSelected] = useState<SpotRecommendation | null>(null);
  const [size, setSize] = useState('');
  const [step, setStep] = useState<TravelStep>('idle');
  const [tryonImage, setTryonImage] = useState('');
  const [sceneImage, setSceneImage] = useState('');
  const [tab, setTab] = useState<'before' | 'tryon' | 'scene'>('scene');
  const [error, setError] = useState('');
  const [sceneRetry, setSceneRetry] = useState(false);
  const [timings, setTimings] = useState<{ tryon?: number; scene?: number }>({});

  // Gợi ý tải ngay khi mở địa điểm, song song với mọi thứ khác. Huỷ khi đổi
  // địa điểm để một phản hồi đến muộn không ghi đè danh sách mới.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const profile = await loadStyleProfile().catch(() => null);
        const result = await getSpotRecommendations({
          place: spot.place, prefecture: spot.prefecture,
          height: Number(profile?.heightEstimateCm) || undefined,
          weight: Number(profile?.weightEstimateKg) || undefined,
          limit: 20, signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setRecos(result.recommendations);
        setScenes(result.scenes);
        setSpotInfo(result.spot);
        setSeason(result.season);
        setActiveScene(result.scenes[0] || null);
      } catch { /* để danh sách rỗng, phần dưới sẽ báo */ }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [spot.place, spot.prefecture]);

  const visibleFilters = useMemo(
    () => TRAVEL_FILTERS.filter(f => f.id === 'all' || recos.some(f.match)), [recos]);
  const shown = useMemo(() => {
    const active = TRAVEL_FILTERS.find(f => f.id === filter) || TRAVEL_FILTERS[0];
    return recos.filter(active.match);
  }, [recos, filter]);

  const clearResult = () => { setTryonImage(''); setSceneImage(''); setError(''); setSceneRetry(false); setTimings({}); };

  const pickPhoto = async (camera: boolean) => {
    setError('');
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { Alert.alert('Cần quyền camera', 'Hãy cấp quyền camera để chụp ảnh.'); return; }
    }
    const pick = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, base64: true });
    const asset = pick.canceled ? null : pick.assets?.[0];
    if (!asset?.base64) return;
    setPhoto({ uri: asset.uri, base64: `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`, label: 'Ảnh của bạn' });
    clearResult();
  };

  const run = async (item: SpotRecommendation, chosenSize: string, sceneOnly = false) => {
    if (!photo) { Alert.alert('Chưa có ảnh', 'Hãy chụp ảnh hoặc chọn ảnh có sẵn.'); return; }
    setError(''); setSceneRetry(false);
    beginGpuJob();
    let worn = sceneOnly ? tryonImage : '';
    try {
      if (!worn) {
        setStep('tryon');
        const t0 = Date.now();
        const output = await generateTryOn({
          personImageBase64: photo.base64,
          productId: item.product.slug,
          size: chosenSize,
          qualityMode: 'balanced',
        });
        if (!output.imageUrl) throw new Error(output.message || 'Chưa tạo được ảnh thử đồ.');
        setStep('fit');
        worn = output.imageUrl;
        setTryonImage(worn);
        setTimings(t => ({ ...t, tryon: Date.now() - t0 }));
        setTab('tryon');
      }
      setStep('scene');
      const t1 = Date.now();
      const composed = await composeScenePhoto({
        place: spot.place, prefecture: spot.prefecture,
        personImageBase64: worn,
        sceneId: activeScene?.id,
      });
      setStep('finishing');
      setSceneImage(composed.imageUrl);
      setTimings(t => ({ ...t, scene: Date.now() - t1 }));
      setTab('scene');
    } catch (err: any) {
      if (err instanceof TryOnSafetyError) setError(err.message);
      else if (worn) {
        // Thử đồ xong, chỉ ghép cảnh hỏng: giữ ảnh mặc đồ, cho ghép lại, KHÔNG
        // bắt chạy lại try-on.
        setSceneRetry(true);
        setError(`Ảnh mặc thử đã tạo xong nhưng chưa ghép được vào ${spot.place}. Bạn có thể thử ghép cảnh lại mà không cần thử đồ lại.`);
        setTab('tryon');
      } else setError(String(err?.message || 'Chưa tạo được ảnh. Hãy thử lại.'));
    } finally { endGpuJob(); setStep('idle'); }
  };

  const tryProduct = (item: SpotRecommendation) => {
    const chosen = item.recommendedSize || item.product.sizes[0] || 'M';
    setSelected(item); setSize(chosen); clearResult();
    void run(item, chosen);
  };

  const busy = step !== 'idle';
  const shownImage = tab === 'scene' ? sceneImage : tab === 'tryon' ? tryonImage : (photo?.uri || '');
  const addSelected = () => {
    if (!selected) return;
    addToCart(selected.product.slug, undefined, size);
    toast(`Đã thêm ${selected.product.name} (size ${size}) vào giỏ ✓`);
  };

  return (
    <GuideSection icon="shirt-outline" title="THỬ ĐỒ JAPANO TẠI ĐÂY">
      <Text style={st.guideText}>
        Chọn một sản phẩm JAPANO để xem bạn mặc tại {spot.place} có phù hợp không.
        {spotInfo?.culturalNote ? ` ${spotInfo.culturalNote}` : ''}
      </Text>
      {!!season && <Text style={st.tvMeta}>Mùa {season}{spotInfo?.activity ? ` · ${spotInfo.activity}` : ''}</Text>}

      <Text style={st.tvLabel}>1. Ảnh của bạn</Text>
      <View style={st.tvPickRow}>
        <Pressable style={st.tvPick} onPress={() => void pickPhoto(true)}><Text style={st.tvPickT}>📷 Chụp</Text></Pressable>
        <Pressable style={st.tvPick} onPress={() => void pickPhoto(false)}><Text style={st.tvPickT}>▧ Thư viện</Text></Pressable>
      </View>
      {!!photo && <Text style={st.tvNote}>Đang dùng: {photo.label}. Đổi sản phẩm vẫn giữ nguyên ảnh này.</Text>}

      {scenes.length > 1 && (
        <>
          <Text style={st.tvLabel}>Góc chụp</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tvRow}>
            {scenes.map(scene => (
              <Pressable key={scene.id} style={[st.tvScene, activeScene?.id === scene.id && st.tvOn]}
                onPress={() => { setActiveScene(scene); if (selected && tryonImage) void run(selected, size, true); }}>
                <SmartImage source={{ uri: scene.thumbnailUrl }} style={st.tvSceneImg} recyclingKey={`tv-s-${scene.id}`} />
                <Text style={st.tvPresetT} numberOfLines={1}>{scene.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      <Text style={st.tvLabel}>2. Chọn trang phục</Text>
      {visibleFilters.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tvRow}>
          {visibleFilters.map(f => (
            <Pressable key={f.id} style={[st.tvChip, filter === f.id && st.tvChipOn]} onPress={() => setFilter(f.id)}>
              <Text style={[st.tvChipT, filter === f.id && st.tvChipTOn]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {loading && <View style={st.tvRow}>{[0, 1, 2].map(i => <View key={i} style={st.tvSkeleton} />)}</View>}
      {!loading && shown.length === 0 && <Text style={st.tvMeta}>Chưa có sản phẩm nào hợp bộ lọc này.</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tvRow}>
        {shown.map(item => (
          <View key={item.product.slug} style={st.tvCard}>
            <SmartImage source={{ uri: item.product.image || '' }} style={st.tvCardImg} recyclingKey={`tv-c-${item.product.slug}`} />
            <View style={st.tvBadgeRow}>
              {item.seasonMatch && <Text style={st.tvBadge}>Hợp mùa</Text>}
              {item.colorHarmony === 'tương phản dễ chịu' && <Text style={st.tvBadge}>Hợp cảnh</Text>}
            </View>
            <Text style={st.tvCardName} numberOfLines={2}>{item.product.name}</Text>
            <Text style={st.tvCardPrice}>{money(item.product.price)}</Text>
            {!!item.recommendedSize && <Text style={st.tvMeta}>Size gợi ý {item.recommendedSize}</Text>}
            {!!item.reasons[0] && <Text style={st.tvReason} numberOfLines={3}>{item.reasons[0]}</Text>}
            <Pressable style={[st.tvTry, busy && st.tvTryOff]} disabled={busy} onPress={() => tryProduct(item)}>
              <Text style={st.tvTryT}>Thử ngay</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {busy && (
        <View style={st.tvProgress}>
          <ActivityIndicator size="small" color={C.ink} />
          <Text style={st.tvProgressT}>{TRAVEL_STEP[step as Exclude<TravelStep, 'idle'>](selected?.product.name || 'trang phục', spot.place)}</Text>
        </View>
      )}
      {!!error && (
        <View style={st.tvErr}>
          <Text style={st.tvErrT}>{error}</Text>
          {sceneRetry && selected && (
            <Pressable style={st.tvErrBtn} onPress={() => void run(selected, size, true)}>
              <Text style={st.tvErrBtnT}>Thử ghép cảnh lại</Text>
            </Pressable>
          )}
        </View>
      )}

      {!!shownImage && (
        <>
          <View style={st.tvTabRow}>
            {([['before', 'Ảnh gốc'], ['tryon', 'Mặc sản phẩm'], ['scene', 'Tại địa điểm']] as const).map(([key, label]) => {
              const on = key === 'before' ? Boolean(photo) : key === 'tryon' ? Boolean(tryonImage) : Boolean(sceneImage);
              return (
                <Pressable key={key} disabled={!on} style={[st.tvTab, tab === key && st.tvTabOn, !on && st.tvTabOff]} onPress={() => setTab(key)}>
                  <Text style={[st.tvTabT, tab === key && st.tvTabTOn]} numberOfLines={1}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <SmartImage source={{ uri: shownImage }} style={st.tvResult} recyclingKey={`tv-out-${tab}`} />
          {!!activeScene && tab === 'scene' && <Text style={st.photoCredit}>{activeScene.attribution}</Text>}
          {(timings.tryon || timings.scene) && (
            <Text style={st.tvMeta}>
              {timings.tryon ? `Thử đồ ${(timings.tryon / 1000).toFixed(1)}s` : ''}
              {timings.tryon && timings.scene ? ' · ' : ''}
              {timings.scene ? `ghép cảnh ${(timings.scene / 1000).toFixed(1)}s` : ''}
            </Text>
          )}
        </>
      )}

      {!!selected && (
        <View style={st.tvBuy}>
          <Text style={st.tvBuyName}>{selected.product.name}</Text>
          <Text style={st.tvBuyPrice}>{money(selected.product.price)} · size {size}</Text>
          <View style={st.tvSizeRow}>
            {selected.product.sizes.map(s => (
              <Pressable key={s} style={[st.tvChip, size === s && st.tvChipOn]} onPress={() => { setSize(s); void run(selected, s); }}>
                <Text style={[st.tvChipT, size === s && st.tvChipTOn]}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <View style={st.tvCtaRow}>
            <Btn label="Thêm vào giỏ" variant="ghost" style={{ flex: 1 }} onPress={addSelected} />
            <Btn label="Mua ngay" style={{ flex: 1 }} onPress={() => { addSelected(); router.push('/cart'); }} />
          </View>
          {!!sceneImage && (
            <View style={st.tvCtaRow}>
              <Pressable style={st.tvMini} onPress={() => void saveMediaToLibrary(sceneImage, 'photo').then(() => toast('Đã lưu ảnh ✓')).catch(() => toast({ message: 'Chưa lưu được ảnh.', kind: 'error' }))}>
                <Ionicons name="download-outline" size={14} color={C.ink} /><Text style={st.tvMiniT}>Lưu ảnh</Text>
              </Pressable>
              <Pressable style={st.tvMini} onPress={() => void shareMedia(sceneImage, 'photo').catch(() => undefined)}>
                <Ionicons name="share-social-outline" size={14} color={C.ink} /><Text style={st.tvMiniT}>Chia sẻ</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </GuideSection>
  );
}

function PrefectureVideo({ videoId, prefecture }: { videoId: string; prefecture: string }) {
  const { width } = useWindowDimensions();
  const playerWidth = width - 36;
  const playerHeight = Math.round(playerWidth * 9 / 16);
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;padding:0;background:#000;overflow:hidden}iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}</style></head><body><iframe src="https://www.youtube.com/embed/${videoId}?playsinline=1&modestbranding=1&rel=0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></body></html>`;
  return (
    <View style={st.videoBox}>
      <Text style={st.videoTitle}>Video giới thiệu {prefecture}</Text>
      <View style={{ width: playerWidth, height: playerHeight, borderRadius: 14, overflow: 'hidden' }}>
        <WebView
          source={{ html, baseUrl: 'https://www.japano.app' }}
          style={{ width: playerWidth, height: playerHeight }}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          mediaPlaybackRequiresUserAction={false}
          userAgent="Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        />
      </View>
    </View>
  );
}

function GuideSection({ icon, title, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; children: React.ReactNode }) {
  return <View style={st.section}><View style={st.sectionTitle}><View style={st.sectionIcon}><Ionicons name={icon} size={14} color={C.ink} /></View><Text style={st.sectionTitleText}>{title}</Text></View>{children}</View>;
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={22} color={C.kin} />
        </Pressable>
      ))}
    </View>
  );
}

function ReviewsBox({ place, prefecture }: { place: string; prefecture: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<JapanSpotReview[]>([]);
  const [average, setAverage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [media, setMedia] = useState<ReviewMediaPick | null>(null);

  const load = () => { setLoading(true); getJapanSpotReviews(place, prefecture).then(data => { setReviews(data.reviews); setAverage(data.average); }).catch(() => undefined).finally(() => setLoading(false)); };
  useEffect(load, [place, prefecture]);

  const submit = async () => {
    if (sending) return;
    if (comment.trim().length < 3) { toast({ message: 'Viết vài dòng cảm nhận của bạn về địa điểm này nhé.', kind: 'error' }); return; }
    setSending(true);
    try {
      await postJapanSpotReview({ place, prefecture, rating, comment: comment.trim(), userName: user?.name, media: media?.dataUri, mediaKind: media?.kind });
      setComment(''); setRating(5); setMedia(null);
      toast('Đã gửi đánh giá địa điểm, cảm ơn bạn ✓');
      load();
    } catch (e: any) {
      toast({ message: e?.message || 'Chưa gửi được, vui lòng thử lại.', kind: 'error' });
    } finally { setSending(false); }
  };

  return (
    <View style={st.reviewBox}>
      <View style={st.reviewHead}>
        <Text style={st.reviewTitle}>Đánh giá & bình luận</Text>
        {!!reviews.length && <Text style={st.reviewAvg}><Ionicons name="star" size={12} color={C.kin} /> {average.toFixed(1)} · {reviews.length} đánh giá</Text>}
      </View>
      {loading && <ActivityIndicator color={C.ink} style={{ marginVertical: 10 }} />}
      {!loading && !reviews.length && <Text style={st.reviewEmpty}>Chưa có đánh giá nào — hãy là người đầu tiên chia sẻ cảm nhận.</Text>}
      {reviews.map(r => (
        <View key={r.id} style={st.reviewItem}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={st.reviewName}>{r.userName}</Text>
            <View style={{ flexDirection: 'row' }}>{[1, 2, 3, 4, 5].map(n => <Ionicons key={n} name={n <= r.rating ? 'star' : 'star-outline'} size={11} color={C.kin} />)}</View>
          </View>
          <Text style={st.reviewComment}>{r.comment}</Text>
          <ReviewMediaPlayer media={r.media} />
        </View>
      ))}
      <View style={st.reviewForm}>
        <Text style={st.reviewFormLabel}>Viết đánh giá của bạn</Text>
        <StarPicker value={rating} onChange={setRating} />
        <TextInput
          value={comment} onChangeText={setComment} multiline
          placeholder="Cảm nhận của bạn về địa điểm này…"
          placeholderTextColor={C.muted}
          style={st.reviewInput}
        />
        <MediaAttachPicker value={media} onChange={setMedia} />
        <Btn label={sending ? 'Đang gửi…' : 'Gửi đánh giá'} onPress={() => { if (!sending) void submit(); }} style={{ marginTop: 10 }} />
      </View>
    </View>
  );
}

// Đóng góp địa điểm chụp ảnh mới — có thưởng thật để khuyến khích cộng đồng
// cùng xây danh sách địa điểm đẹp của Nhật Bản. Mức thưởng lấy từ backend
// (lib/communityRewards.js) chứ không ghi cứng trong app.
const REWARD_LABEL: Record<string, string> = {
  pending: 'Đang chờ cửa hàng duyệt',
  approved: 'Đã duyệt · đã nhận thưởng',
  rejected: 'Chưa được duyệt',
};

function SuggestionBox({ prefecture }: { prefecture: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<JapanSpotSuggestion[]>([]);
  const [reward, setReward] = useState<SpotRewardConfig | null>(null);
  const [place, setPlace] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getJapanSpotSuggestions(prefecture, user?.id || '')
      .then(data => { setSuggestions(data.suggestions); setReward(data.rewardConfig); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };
  useEffect(load, [prefecture, user?.id]);

  const submit = async () => {
    if (sending) return;
    if (!user?.id) { toast({ message: 'Đăng nhập để gửi đóng góp và nhận thưởng nhé.', kind: 'error' }); router.push('/login'); return; }
    if (text.trim().length < 3) { toast({ message: 'Mô tả ngắn gọn địa điểm bạn muốn đề xuất.', kind: 'error' }); return; }
    setSending(true);
    try {
      await postJapanSpotSuggestion({ prefecture, place: place.trim(), suggestion: text.trim(), userName: user?.name, userId: user.id });
      setText(''); setPlace('');
      toast({
        message: reward ? `Đã gửi đóng góp! Được duyệt là bạn nhận ${reward.label}.` : 'Đã gửi đóng góp, cảm ơn bạn!',
        kind: 'success',
        durationMs: 5000,
      });
      load();
    } catch (e: any) {
      toast({ message: e?.message || 'Chưa gửi được, vui lòng thử lại.', kind: 'error' });
    } finally { setSending(false); }
  };

  const mine = suggestions.filter(s => s.mine);

  return (
    <View style={st.suggestBox}>
      <Text style={st.suggestTitle}>Bạn biết địa điểm chụp ảnh đẹp khác ở {prefecture}?</Text>
      <Text style={st.suggestSub}>Cùng xây bản đồ địa điểm đẹp của Nhật Bản cho cả cộng đồng JAPANO.</Text>
      {!!reward && (
        <View style={st.rewardBanner}>
          <Ionicons name="gift" size={19} color={C.ink} />
          <View style={{ flex: 1 }}>
            <Text style={st.rewardBannerTitle}>Đóng góp được duyệt → nhận {reward.amount.toLocaleString('vi-VN')}₫</Text>
            <Text style={st.rewardBannerBody}>Voucher giảm {reward.amount.toLocaleString('vi-VN')}₫ cho đơn từ {reward.minOrder.toLocaleString('vi-VN')}₫, hạn dùng {reward.validityDays} ngày. Mỗi địa điểm hợp lệ được thưởng một lần.</Text>
          </View>
        </View>
      )}
      <TextInput
        value={place} onChangeText={setPlace}
        placeholder="Tên địa điểm (ví dụ: Cầu Kintai)"
        placeholderTextColor={C.muted}
        style={[st.suggestInput, { minHeight: 44 }]}
      />
      <TextInput
        value={text} onChangeText={setText} multiline
        placeholder={`Ở đâu trong ${prefecture}, chụp đẹp nhất lúc nào, đi tới bằng cách gì…`}
        placeholderTextColor={C.muted}
        style={[st.suggestInput, { marginTop: 8 }]}
      />
      <Btn label={sending ? 'Đang gửi…' : 'Gửi đóng góp để nhận thưởng'} onPress={() => { if (!sending) void submit(); }} style={{ marginTop: 8 }} />
      {loading && <ActivityIndicator color={C.ink} style={{ marginTop: 10 }} />}
      {!loading && !!mine.length && (
        <View style={{ marginTop: 12 }}>
          <Text style={st.suggestListTitle}>Đóng góp của bạn</Text>
          {mine.map(s => {
            const status = s.reward?.status || 'pending';
            return (
              <View key={s.id} style={[st.suggestItem, status === 'approved' && st.suggestItemOk]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons
                    name={status === 'approved' ? 'checkmark-circle' : status === 'rejected' ? 'close-circle' : 'time-outline'}
                    size={14}
                    color={status === 'approved' ? '#1F6B44' : status === 'rejected' ? C.danger : C.muted}
                  />
                  <Text style={st.suggestStatus}>{REWARD_LABEL[status]}</Text>
                </View>
                <Text style={st.suggestItemText}>{s.suggestion}</Text>
                {status === 'approved' && !!s.reward?.voucherCode && (
                  <Text selectable style={st.suggestVoucher}>Mã của bạn: {s.reward.voucherCode} · giảm {Number(s.reward.amount || 0).toLocaleString('vi-VN')}₫</Text>
                )}
                {status === 'rejected' && !!s.reward?.note && <Text style={st.suggestNote}>{s.reward.note}</Text>}
              </View>
            );
          })}
        </View>
      )}
      {!loading && !!suggestions.length && (
        <View style={{ marginTop: 12 }}>
          <Text style={st.suggestListTitle}>Đề xuất từ cộng đồng</Text>
          {suggestions.filter(s => !s.mine).map(s => (
            <View key={s.id} style={st.suggestItem}>
              <Text style={st.suggestItemName}>{s.userName}</Text>
              <Text style={st.suggestItemText}>{s.suggestion}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  intro: { fontFamily: F.body, fontSize: 12.5, lineHeight: 19, color: C.muted, marginBottom: 14 },
  notebook: { backgroundColor: C.sumi, borderRadius: 18, padding: 16, marginBottom: 14 },
  notebookKicker: { fontFamily: F.bodyX, fontSize: 10, letterSpacing: 1.4, color: 'rgba(255,255,255,0.72)' },
  notebookText: { fontFamily: F.body, fontSize: 12, lineHeight: 19, color: 'rgba(255,255,255,0.70)', marginTop: 8 },
  mapHint: { fontFamily: F.body, fontSize: 11, color: C.muted, marginBottom: 6, textAlign: 'center' },
  mapWrap: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingVertical: 10, marginBottom: 16 },
  videoBox: { marginBottom: 16 },
  videoTitle: { fontFamily: F.bodyB, fontSize: 12.5, color: C.ink, marginBottom: 8 },
  regionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginBottom: 10 },
  regionKanji: { width: 46, height: 46, borderRadius: 13, backgroundColor: C.sumi, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  regionKanjiT: { fontFamily: F.display, fontSize: 19, color: C.card },
  regionName: { fontFamily: F.bodyB, fontSize: 14.5, color: C.ink },
  regionSub: { fontFamily: F.body, fontSize: 11.5, color: C.muted, marginTop: 2 },
  prefCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10, marginBottom: 10 },
  prefImg: { width: 58, height: 68, borderRadius: 10 },
  prefName: { fontFamily: F.bodyB, fontSize: 13.5, color: C.ink },
  prefSub: { fontFamily: F.body, fontSize: 11.5, color: C.muted, marginTop: 2 },
  spotCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10, marginBottom: 10 },
  spotImg: { width: 58, height: 68, borderRadius: 10 },
  spotName: { fontFamily: F.bodyB, fontSize: 13.5, color: C.ink },
  spotTime: { fontFamily: F.bodyM, fontSize: 11, color: C.ink, marginTop: 2 },
  spotTip: { fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 15.5 },
  heroImg: { width: '100%', height: 200, borderRadius: 16, marginBottom: 4 },
  photoCredit: { fontFamily: F.body, fontSize: 9.5, color: C.muted, marginBottom: 10, textAlign: 'right' },
  travelCta: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: C.ink, borderRadius: 13, padding: 14, marginTop: 16 },
  travelCtaT: { fontFamily: F.bodyX, fontSize: 14, color: '#fff' },
  travelCtaSub: { fontFamily: F.body, fontSize: 11, lineHeight: 16, color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  tvMeta: { fontFamily: F.body, fontSize: 10.5, color: C.muted, marginTop: 3 },
  tvLabel: { fontFamily: F.bodyX, fontSize: 11, letterSpacing: .5, color: C.ink, marginTop: 14 },
  tvPickRow: { flexDirection: 'row', gap: 9, marginTop: 8 },
  tvPick: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingVertical: 9, alignItems: 'center', backgroundColor: C.card },
  tvPickT: { fontFamily: F.bodyB, fontSize: 11.5, color: C.ink },
  tvRow: { gap: 8, paddingVertical: 9, paddingRight: 4 },
  tvOn: { borderColor: C.shu, borderWidth: 2 },
  tvPreset: { width: 72, borderWidth: 1, borderColor: C.line, borderRadius: 9, backgroundColor: C.card, padding: 4 },
  tvPresetImg: { width: '100%', aspectRatio: 2 / 3, borderRadius: 5, backgroundColor: C.washi2 },
  tvPresetT: { fontFamily: F.bodyB, fontSize: 9, color: C.ink, marginTop: 3 },
  tvScene: { width: 118, borderWidth: 1, borderColor: C.line, borderRadius: 9, backgroundColor: C.card, padding: 4 },
  tvSceneImg: { width: '100%', height: 74, borderRadius: 5, backgroundColor: C.washi2 },
  tvNote: { fontFamily: F.body, fontSize: 10.5, color: C.muted, backgroundColor: C.washi2, borderRadius: 8, padding: 8 },
  tvChip: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.card },
  tvChipOn: { backgroundColor: C.ink, borderColor: C.ink },
  tvChipT: { fontFamily: F.bodyB, fontSize: 10.5, color: C.ink },
  tvChipTOn: { color: '#fff' },
  tvSkeleton: { width: 150, height: 230, borderRadius: 11, backgroundColor: C.washi2 },
  tvCard: { width: 150, borderWidth: 1, borderColor: C.line, borderRadius: 11, backgroundColor: C.card, padding: 7 },
  tvCardImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: 7, backgroundColor: C.washi2 },
  tvBadgeRow: { flexDirection: 'row', gap: 4, marginTop: 5, flexWrap: 'wrap' },
  tvBadge: { fontFamily: F.bodyB, fontSize: 8, color: C.shu, borderWidth: 1, borderColor: C.shu, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 },
  tvCardName: { fontFamily: F.bodyB, fontSize: 11.5, color: C.ink, marginTop: 4 },
  tvCardPrice: { fontFamily: F.bodyX, fontSize: 12, color: C.shu, marginTop: 1 },
  tvReason: { fontFamily: F.body, fontSize: 9.5, lineHeight: 13.5, color: C.muted, marginTop: 4 },
  tvTry: { marginTop: 7, backgroundColor: C.ink, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  tvTryOff: { opacity: .4 },
  tvTryT: { fontFamily: F.bodyB, fontSize: 11, color: '#fff' },
  tvProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: C.washi2, borderRadius: 10, padding: 10 },
  tvProgressT: { fontFamily: F.bodyB, fontSize: 11.5, color: C.ink, flex: 1 },
  tvErr: { marginTop: 11, backgroundColor: '#FCE8E8', borderColor: '#EBC4C4', borderWidth: 1, borderRadius: 10, padding: 10 },
  tvErrT: { fontFamily: F.body, fontSize: 11, lineHeight: 16, color: C.ink },
  tvErrBtn: { marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: C.ink, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6 },
  tvErrBtnT: { fontFamily: F.bodyB, fontSize: 11, color: C.ink },
  tvTabRow: { flexDirection: 'row', gap: 5, marginTop: 12 },
  tvTab: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingVertical: 7, alignItems: 'center', backgroundColor: C.card },
  tvTabOn: { backgroundColor: C.ink, borderColor: C.ink },
  tvTabOff: { opacity: .4 },
  tvTabT: { fontFamily: F.bodyB, fontSize: 10, color: C.ink },
  tvTabTOn: { color: '#fff' },
  tvResult: { width: '100%', aspectRatio: 2 / 3, borderRadius: 12, marginTop: 8, backgroundColor: C.washi2 },
  tvBuy: { marginTop: 12, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, backgroundColor: C.card },
  tvBuyName: { fontFamily: F.bodyX, fontSize: 14, color: C.ink },
  tvBuyPrice: { fontFamily: F.bodyB, fontSize: 12, color: C.shu, marginTop: 2 },
  tvSizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  tvCtaRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  tvMini: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingVertical: 8 },
  tvMiniT: { fontFamily: F.bodyB, fontSize: 11, color: C.ink },
  sceneRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  sceneBtn: { minWidth: 74, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 8, backgroundColor: C.card },
  sceneBtnT: { fontFamily: F.bodyB, fontSize: 10, color: C.ink },
  sceneThumb: { width: 34, height: 51, borderRadius: 5, backgroundColor: C.washi2 },
  sceneBusy: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  sceneBusyT: { fontFamily: F.body, fontSize: 11.5, color: C.muted },
  sceneErr: { fontFamily: F.body, fontSize: 11.5, lineHeight: 17, color: C.shu, marginTop: 8 },
  sceneResult: { width: '100%', aspectRatio: 2 / 3, borderRadius: 12, marginTop: 12, backgroundColor: C.washi2 },
  info: { flexDirection: 'row', gap: 9, backgroundColor: C.washi2, borderRadius: 12, padding: 11 },
  time: { fontFamily: F.bodyB, fontSize: 12.5, color: C.ink }, tip: { fontFamily: F.body, fontSize: 11.5, lineHeight: 17, color: C.muted, marginTop: 2 },
  section: { marginTop: 16 }, sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 }, sectionIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: C.washi2, alignItems: 'center', justifyContent: 'center' }, sectionTitleText: { fontFamily: F.bodyX, fontSize: 9.5, letterSpacing: 1.15, color: C.shuDeep },
  guideText: { fontFamily: F.body, fontSize: 11.5, lineHeight: 18, color: C.ink },
  mapButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E8C7BD', backgroundColor: '#FFF8F5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, marginTop: 9 }, mapButtonText: { fontFamily: F.bodyB, fontSize: 10.5, color: C.ink },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 7 }, bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.kin, marginTop: 7 }, bulletText: { flex: 1, fontFamily: F.body, fontSize: 11.5, lineHeight: 17.5, color: C.ink },
  photoSpot: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.hair, borderRadius: 11, padding: 10, marginBottom: 7 }, photoIndex: { fontFamily: F.displayX, fontSize: 17, color: C.ink }, photoName: { fontFamily: F.bodyB, fontSize: 11.5, color: C.ink }, photoTip: { fontFamily: F.body, fontSize: 10.5, lineHeight: 15.5, color: C.muted, marginTop: 2 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.washi2, borderRadius: 9, padding: 9, marginTop: 14 }, sourceText: { flex: 1, fontFamily: F.bodyM, fontSize: 9.5, lineHeight: 13, color: C.muted },
  outfitDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 }, dividerLine: { height: 1, flex: 1, backgroundColor: C.line }, dividerText: { fontFamily: F.bodyX, fontSize: 8.5, letterSpacing: 1, color: C.muted },
  outfit: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 9, marginTop: 11 }, thumb: { width: 58, height: 68, borderRadius: 9 },
  outfitLabel: { fontFamily: F.bodyX, fontSize: 8.5, letterSpacing: 1, color: C.kin }, product: { fontFamily: F.bodyB, fontSize: 12.5, color: C.ink, marginTop: 3 }, price: { fontFamily: F.bodyX, fontSize: 12, color: C.ink, marginTop: 3 },
  reviewBox: { marginTop: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14 },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reviewTitle: { fontFamily: F.display, fontSize: 15, color: C.sumi },
  reviewAvg: { fontFamily: F.bodyB, fontSize: 11.5, color: C.ink },
  reviewEmpty: { fontFamily: F.body, fontSize: 11.5, color: C.muted, marginTop: 8 },
  reviewItem: { borderTopWidth: 1, borderTopColor: C.hair, paddingVertical: 9 },
  reviewName: { fontFamily: F.bodyB, fontSize: 12, color: C.ink },
  reviewComment: { fontFamily: F.body, fontSize: 12, lineHeight: 18, color: C.ink, marginTop: 4 },
  reviewForm: { marginTop: 14, borderTopWidth: 1, borderTopColor: C.hair, paddingTop: 12 },
  reviewFormLabel: { fontFamily: F.bodyB, fontSize: 11.5, color: C.ink, marginBottom: 7 },
  reviewInput: { minHeight: 70, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: '#fff', padding: 11, fontFamily: F.body, fontSize: 12.5, color: C.ink, marginTop: 9, textAlignVertical: 'top' },
  suggestBox: { marginTop: 6, marginBottom: 16, backgroundColor: C.washi2, borderRadius: 16, padding: 14 },
  suggestTitle: { fontFamily: F.bodyB, fontSize: 13, color: C.ink },
  suggestSub: { fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 3, marginBottom: 10 },
  suggestInput: { minHeight: 60, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: '#fff', padding: 11, fontFamily: F.body, fontSize: 12.5, color: C.ink, textAlignVertical: 'top' },
  suggestListTitle: { fontFamily: F.bodyX, fontSize: 9.5, letterSpacing: 1, color: C.shuDeep, marginBottom: 6 },
  suggestItem: { backgroundColor: '#fff', borderRadius: 10, padding: 9, marginBottom: 6 },
  suggestItemOk: { borderWidth: 1, borderColor: '#CBE3CC', backgroundColor: '#F4FAF4' },
  suggestItemName: { fontFamily: F.bodyB, fontSize: 10.5, color: C.ink },
  suggestItemText: { fontFamily: F.body, fontSize: 11.5, lineHeight: 17, color: C.ink, marginTop: 2 },
  suggestStatus: { fontFamily: F.bodyB, fontSize: 10.5, color: C.muted },
  suggestVoucher: { fontFamily: F.bodyX, fontSize: 11, color: '#1F6B44', marginTop: 5 },
  suggestNote: { fontFamily: F.body, fontSize: 10.5, lineHeight: 16, color: C.muted, marginTop: 4 },
  rewardBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: C.washi2, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 11, marginBottom: 10 },
  rewardBannerTitle: { fontFamily: F.bodyB, fontSize: 12, color: C.ink },
  rewardBannerBody: { fontFamily: F.body, fontSize: 10.5, lineHeight: 16, color: C.ink, marginTop: 3 },
});
