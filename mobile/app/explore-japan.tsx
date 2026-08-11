import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Screen, Header, Btn, money } from '../components/ui';
import { SmartImage } from '../components/SmartImage';
import { JapanMap } from '../components/JapanMap';
import { useCatalog } from '../lib/data';
import { JapanSpot, PHOTO_ATTRIBUTION, PREFECTURE_VIDEO, prefecturesInRegion, regionsList, spotsInPrefecture } from '../lib/japanSpots';
import { getJapanSpotReviews, getJapanSpotSuggestions, JapanSpotReview, JapanSpotSuggestion, postJapanSpotReview, postJapanSpotSuggestion, SpotRewardConfig } from '../lib/api';
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
      <View style={st.info}><Ionicons name="camera-outline" size={19} color={C.shu} /><View style={{ flex: 1 }}><Text style={st.time}>{spot.time}</Text><Text style={st.tip}>{spot.tip}</Text></View></View>

      <GuideSection icon="navigate-circle-outline" title="NẰM Ở ĐÂU?">
        <Text style={st.guideText}>{spot.where}</Text>
        <Pressable style={st.mapButton} onPress={openMap}><Ionicons name="map-outline" size={14} color={C.shu} /><Text style={st.mapButtonText}>Mở vị trí trên bản đồ</Text><Ionicons name="open-outline" size={12} color={C.shu} /></Pressable>
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
  return <View style={st.section}><View style={st.sectionTitle}><View style={st.sectionIcon}><Ionicons name={icon} size={14} color={C.shu} /></View><Text style={st.sectionTitleText}>{title}</Text></View>{children}</View>;
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
      {loading && <ActivityIndicator color={C.shu} style={{ marginVertical: 10 }} />}
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
          <Ionicons name="gift" size={19} color="#8A6518" />
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
      {loading && <ActivityIndicator color={C.shu} style={{ marginTop: 10 }} />}
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
  notebookKicker: { fontFamily: F.bodyX, fontSize: 10, letterSpacing: 1.4, color: '#F6D6B4' },
  notebookText: { fontFamily: F.body, fontSize: 12, lineHeight: 19, color: '#D8D2CB', marginTop: 8 },
  mapHint: { fontFamily: F.body, fontSize: 11, color: C.muted, marginBottom: 6, textAlign: 'center' },
  mapWrap: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingVertical: 10, marginBottom: 16 },
  videoBox: { marginBottom: 16 },
  videoTitle: { fontFamily: F.bodyB, fontSize: 12.5, color: C.ink, marginBottom: 8 },
  regionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginBottom: 10 },
  regionKanji: { width: 46, height: 46, borderRadius: 13, backgroundColor: C.sumi, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  regionKanjiT: { fontFamily: F.display, fontSize: 19, color: '#F6D6B4' },
  regionName: { fontFamily: F.bodyB, fontSize: 14.5, color: C.ink },
  regionSub: { fontFamily: F.body, fontSize: 11.5, color: C.muted, marginTop: 2 },
  prefCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10, marginBottom: 10 },
  prefImg: { width: 58, height: 68, borderRadius: 10 },
  prefName: { fontFamily: F.bodyB, fontSize: 13.5, color: C.ink },
  prefSub: { fontFamily: F.body, fontSize: 11.5, color: C.muted, marginTop: 2 },
  spotCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10, marginBottom: 10 },
  spotImg: { width: 58, height: 68, borderRadius: 10 },
  spotName: { fontFamily: F.bodyB, fontSize: 13.5, color: C.ink },
  spotTime: { fontFamily: F.bodyM, fontSize: 11, color: C.shu, marginTop: 2 },
  spotTip: { fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 15.5 },
  heroImg: { width: '100%', height: 200, borderRadius: 16, marginBottom: 4 },
  photoCredit: { fontFamily: F.body, fontSize: 9.5, color: C.muted, marginBottom: 10, textAlign: 'right' },
  info: { flexDirection: 'row', gap: 9, backgroundColor: '#FFF7EA', borderRadius: 12, padding: 11 },
  time: { fontFamily: F.bodyB, fontSize: 12.5, color: C.ink }, tip: { fontFamily: F.body, fontSize: 11.5, lineHeight: 17, color: C.muted, marginTop: 2 },
  section: { marginTop: 16 }, sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 }, sectionIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: C.shuSoft, alignItems: 'center', justifyContent: 'center' }, sectionTitleText: { fontFamily: F.bodyX, fontSize: 9.5, letterSpacing: 1.15, color: C.shuDeep },
  guideText: { fontFamily: F.body, fontSize: 11.5, lineHeight: 18, color: C.ink },
  mapButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E8C7BD', backgroundColor: '#FFF8F5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, marginTop: 9 }, mapButtonText: { fontFamily: F.bodyB, fontSize: 10.5, color: C.shu },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 7 }, bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.kin, marginTop: 7 }, bulletText: { flex: 1, fontFamily: F.body, fontSize: 11.5, lineHeight: 17.5, color: C.ink },
  photoSpot: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.hair, borderRadius: 11, padding: 10, marginBottom: 7 }, photoIndex: { fontFamily: F.displayX, fontSize: 17, color: '#C8A65B' }, photoName: { fontFamily: F.bodyB, fontSize: 11.5, color: C.ink }, photoTip: { fontFamily: F.body, fontSize: 10.5, lineHeight: 15.5, color: C.muted, marginTop: 2 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F7F0DF', borderRadius: 9, padding: 9, marginTop: 14 }, sourceText: { flex: 1, fontFamily: F.bodyM, fontSize: 9.5, lineHeight: 13, color: '#82651F' },
  outfitDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 }, dividerLine: { height: 1, flex: 1, backgroundColor: C.line }, dividerText: { fontFamily: F.bodyX, fontSize: 8.5, letterSpacing: 1, color: C.muted },
  outfit: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 9, marginTop: 11 }, thumb: { width: 58, height: 68, borderRadius: 9 },
  outfitLabel: { fontFamily: F.bodyX, fontSize: 8.5, letterSpacing: 1, color: C.kin }, product: { fontFamily: F.bodyB, fontSize: 12.5, color: C.ink, marginTop: 3 }, price: { fontFamily: F.bodyX, fontSize: 12, color: C.shu, marginTop: 3 },
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
  suggestBox: { marginTop: 6, marginBottom: 16, backgroundColor: C.shuSoft, borderRadius: 16, padding: 14 },
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
  rewardBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#FBF1DA', borderWidth: 1, borderColor: '#EBD6A3', borderRadius: 12, padding: 11, marginBottom: 10 },
  rewardBannerTitle: { fontFamily: F.bodyB, fontSize: 12, color: '#7A5A15' },
  rewardBannerBody: { fontFamily: F.body, fontSize: 10.5, lineHeight: 16, color: '#8A6518', marginTop: 3 },
});
