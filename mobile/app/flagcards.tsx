import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen, Header, money } from '../components/ui';
import { getFlagcardCollection, Flagcard, FlagcardCollection } from '../lib/api';
import { PRODUCTS } from '../lib/catalog';
import { C, F } from '../theme/tokens';

const SEEN_KEY = '@japano/flagcards/seenOwned';
const COMPLETED_KEY = '@japano/flagcards/completedShown';
const CONFETTI_COLORS = [C.shu, C.kin, C.matcha, C.sakura, '#fff'];

function Confetti({ show }:{ show:boolean }) {
  const pieces = useRef(Array.from({ length:22 }, () => new Animated.Value(0))).current;
  const seeds = useRef(Array.from({ length:22 }, (_, i) => ({
    left: 6 + ((i * 41) % 90),
    drift: Math.random()*140-70,
    delay: Math.random()*350,
    duration: 1700 + Math.random()*900,
    spin: 180 + Math.random()*360,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 6 + Math.random()*5,
  }))).current;
  useEffect(() => {
    if (!show) return;
    pieces.forEach(p => p.setValue(0));
    Animated.stagger(28, pieces.map((p, i) => Animated.timing(p, { toValue:1, duration:seeds[i].duration, delay:seeds[i].delay, useNativeDriver:true }))).start();
  }, [show]);
  if (!show) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {pieces.map((p, i) => {
        const seed = seeds[i];
        const translateY = p.interpolate({ inputRange:[0,1], outputRange:[-20, 640] });
        const translateX = p.interpolate({ inputRange:[0,1], outputRange:[0, seed.drift] });
        const rotate = p.interpolate({ inputRange:[0,1], outputRange:['0deg', `${seed.spin}deg`] });
        const opacity = p.interpolate({ inputRange:[0,0.85,1], outputRange:[1,1,0] });
        return (
          <Animated.View key={i} style={{
            position:'absolute', left:`${seed.left}%`, top:0,
            width:seed.size, height:seed.size*1.6, backgroundColor:seed.color, borderRadius:2,
            opacity, transform:[{ translateY }, { translateX }, { rotate }],
          }} />
        );
      })}
    </View>
  );
}

function CelebrationOverlay({ voucherCode, onClose }:{ voucherCode?:string; onClose:()=>void }) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue:1, useNativeDriver:true, friction:6 }),
      Animated.timing(opacity, { toValue:1, duration:220, useNativeDriver:true }),
    ]).start();
  }, []);
  return (
    <View style={st.overlay}>
      <Confetti show />
      <Animated.View style={[st.celebrateCard, { opacity, transform:[{ scale }] }]}>
        <Text style={{ fontSize:44 }}>🎉</Text>
        <Text style={st.celebrateTitle}>Đủ bộ 7 thẻ địa danh!</Text>
        <Text style={st.celebrateSub}>Bạn vừa mở khoá mã giảm giá 50% cho toàn bộ sản phẩm.</Text>
        {!!voucherCode && <Text selectable style={st.celebrateCode}>{voucherCode}</Text>}
        <Pressable style={st.celebrateBtn} onPress={onClose}><Text style={{ color:'#fff', fontFamily:F.bodyB, fontSize:13 }}>Tuyệt vời!</Text></Pressable>
      </Animated.View>
    </View>
  );
}

function NewCardToast({ card, onClose }:{ card:Flagcard; onClose:()=>void }) {
  const translateY = useRef(new Animated.Value(-120)).current;
  useEffect(() => {
    Animated.spring(translateY, { toValue:0, useNativeDriver:true, friction:7 }).start();
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, []);
  return (
    <Animated.View style={[st.newCardToast, { transform:[{ translateY }] }]}>
      <View style={[st.glyphWrap, { backgroundColor:`${card.accent || C.shu}22` }]}><Text style={{ fontSize:20 }}>{card.glyph}</Text></View>
      <View style={{ flex:1 }}>
        <Text style={st.newCardLabel}>✦ Thẻ địa danh mới!</Text>
        <Text style={st.newCardTitle} numberOfLines={1}>{card.title}</Text>
      </View>
      <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={18} color={C.muted} /></Pressable>
    </Animated.View>
  );
}

function DetailBlock({ icon, title, text }:{ icon:string; title:string; text:string }) {
  return (
    <View style={{ marginTop:10 }}>
      <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
        <Ionicons name={icon as any} size={13} color={C.shu} />
        <Text style={st.detailTitle}>{title}</Text>
      </View>
      <Text style={st.detailText}>{text}</Text>
    </View>
  );
}

function CardRow({ card, open, onToggle, onProduct }:
  { card:Flagcard; open:boolean; onToggle:()=>void; onProduct:(slug:string)=>void }) {
  const locked = !card.owned;
  const flip = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(flip, { toValue: open?1:0, duration:380, useNativeDriver:true }).start();
  }, [open]);
  const rotateY = flip.interpolate({ inputRange:[0,1], outputRange:['0deg','360deg'] });
  return (
    <Pressable onPress={onToggle} style={[st.card, locked && st.cardLocked]}>
      <View style={st.cardHead}>
        <Animated.View style={[st.glyphWrap, { backgroundColor:`${card.accent || C.shu}22`, transform:[{ rotateY }] }]}>
          <Text style={{ fontSize:20, opacity:locked?0.35:1 }}>{card.glyph}</Text>
        </Animated.View>
        <View style={{ flex:1 }}>
          <Text style={[st.cardTitle, locked && st.cardTitleLocked]}>{locked?'??? · Chưa sở hữu':card.title}</Text>
          <Text style={st.cardRegion}>{card.region} · #{card.order}</Text>
        </View>
        {locked
          ? <Ionicons name="lock-closed" size={16} color={C.muted} />
          : <Ionicons name={open?'chevron-up':'chevron-down'} size={18} color={C.muted} />}
      </View>

      {!locked && <Text style={st.cardSummary} numberOfLines={open?undefined:2}>{card.summary}</Text>}
      {locked && <Text style={st.cardLockedHint}>Thanh toán thành công một đơn đủ điều kiện để có cơ hội nhận thẻ này.</Text>}

      {!locked && open && (
        <View style={st.detail}>
          <Text style={st.detailJp}>{card.japanese}</Text>

          <DetailBlock icon="time-outline" title="Lịch sử hình thành" text={card.formationHistory} />
          <DetailBlock icon="sparkles-outline" title="Truyền thuyết" text={card.legend} />

          <Text style={st.detailTitle}>Điều thú vị</Text>
          {card.funFacts.map((fact, i) => <Text key={i} style={st.bullet}>• {fact}</Text>)}

          <Text style={st.detailTitle}>Điểm check-in gợi ý</Text>
          {card.checkins.map((checkin, i) => (
            <View key={i} style={st.checkin}>
              <Text style={st.checkinName}>📍 {checkin.name}</Text>
              <Text style={st.checkinTip}>{checkin.tip}</Text>
            </View>
          ))}

          <View style={st.outfitBox}>
            <Text style={st.outfitStyle}>Trang phục &amp; phụ kiện khi checkin · {card.outfit.style}</Text>
            <Text style={st.outfitLine}><Text style={st.outfitK}>Trang phục: </Text>{card.outfit.clothing.join(', ')}</Text>
            <Text style={st.outfitLine}><Text style={st.outfitK}>Phụ kiện: </Text>{card.outfit.accessories.join(', ')}</Text>
            <Text style={st.outfitReason}>{card.outfit.reason}</Text>
          </View>

          {!!card.recommendedProductIds?.length && (
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:10 }}>
              {card.recommendedProductIds.map(slug => {
                const product = PRODUCTS.find(item => item.slug === slug);
                if (!product) return null;
                return (
                  <Pressable key={slug} onPress={()=>onProduct(slug)} style={st.productChip}>
                    <Text style={st.productChipText} numberOfLines={1}>{product.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {!!card.award && (
            <Text style={st.awardText}>Nhận từ đơn {card.award.orderCode} · {new Date(card.award.awardedAt).toLocaleDateString('vi-VN')}</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

export default function Flagcards() {
  const router = useRouter();
  const [data, setData] = useState<FlagcardCollection|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string|null>(null);
  const [newCard, setNewCard] = useState<Flagcard|null>(null);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    let live = true;
    getFlagcardCollection()
      .then(async res => {
        if (!live) return;
        setData(res);
        const [seenRaw, completedRaw] = await Promise.all([
          AsyncStorage.getItem(SEEN_KEY),
          AsyncStorage.getItem(COMPLETED_KEY),
        ]);
        const seen = seenRaw != null ? Number(seenRaw) : null;
        if (res.progress.completed && completedRaw !== '1') {
          setCelebrate(true);
          await AsyncStorage.setItem(COMPLETED_KEY, '1');
        } else if (seen != null && res.progress.owned > seen) {
          const latest = [...res.cards]
            .filter(c => c.owned && c.award)
            .sort((a, b) => Number(b.award!.awardedAt) - Number(a.award!.awardedAt))[0];
          if (latest) setNewCard(latest);
        }
        await AsyncStorage.setItem(SEEN_KEY, String(res.progress.owned));
      })
      .catch((e:any) => { if (live) setError(e?.message || 'Chưa tải được bộ sưu tập.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  return (
    <Screen wave={false}>
      <Header title="Thẻ địa danh Nhật Bản" />
      {!!newCard && <NewCardToast card={newCard} onClose={()=>setNewCard(null)} />}
      {celebrate && <CelebrationOverlay voucherCode={data?.rewardVoucher?.code} onClose={()=>setCelebrate(false)} />}
      {loading && (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator color={C.shu} />
        </View>
      )}
      {!loading && (error || !data) && (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:30 }}>
          <Ionicons name="cloud-offline-outline" size={34} color={C.muted} />
          <Text style={st.errorText}>{error || 'Chưa tải được bộ sưu tập. Kiểm tra kết nối máy chủ và thử lại.'}</Text>
        </View>
      )}
      {!loading && data && (
        <ScrollView contentContainerStyle={{ paddingHorizontal:18, paddingBottom:36 }}>
          <View style={st.hero}>
            <Text style={st.eyebrow}>SƯU TẦM ĐỊA DANH</Text>
            <Text style={st.heroTitle}>Mỗi đơn hàng thành công{`\n`}mở ra một chương lịch sử Nhật.</Text>
            <Text style={st.heroSub}>
              Đơn thanh toán thành công từ {money(data.config.qualifyingOrderMin)} sẽ ngẫu nhiên tặng một thẻ địa danh bạn chưa có.
              Sưu tầm đủ {data.progress.required} thẻ để nhận mã giảm giá {data.config.rewardPercent}% toàn bộ sản phẩm.
            </Text>
          </View>

          <View style={st.progressCard}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end' }}>
              <Text style={st.progressBig}>{data.progress.owned}<Text style={st.progressOf}>/{data.progress.required}</Text></Text>
              <Text style={st.progressLabel}>{data.progress.completed ? 'Đã đủ bộ sưu tập ✓' : `Còn ${data.progress.required - data.progress.owned} thẻ nữa`}</Text>
            </View>
            <View style={st.track}><View style={[st.trackOn, { width:`${data.progress.percent}%` as any }]} /></View>
          </View>

          {!!data.rewardVoucher && (
            <View style={st.voucherCard}>
              <View style={st.voucherRow}>
                <Ionicons name="pricetags" size={20} color="#F6D6B4" />
                <Text style={st.voucherTitle}>Mã giảm giá {data.rewardVoucher.value}% toàn bộ sản phẩm</Text>
              </View>
              <Text selectable style={st.voucherCode}>{data.rewardVoucher.code}</Text>
              <Text style={st.voucherHint}>
                {data.rewardVoucher.min ? `Áp dụng cho đơn từ ${money(data.rewardVoucher.min)} · ` : 'Áp dụng cho mọi đơn hàng · '}
                Hạn dùng {data.rewardVoucher.expiry} · Nhấn giữ mã để sao chép.
              </Text>
            </View>
          )}

          <Text style={st.grp}>BỘ SƯU TẬP {data.cards.length} FLAGCARD</Text>
          {data.cards.map(card => (
            <CardRow
              key={card.id}
              card={card}
              open={openId === card.id}
              onToggle={() => setOpenId(o => o === card.id ? null : card.id)}
              onProduct={(slug) => router.push(`/product/${slug}`)}
            />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  errorText:{ fontFamily:F.body, fontSize:12.5, color:C.muted, textAlign:'center', marginTop:10, lineHeight:19 },

  overlay:{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(17,12,8,0.72)', alignItems:'center', justifyContent:'center', zIndex:50, paddingHorizontal:30 },
  celebrateCard:{ backgroundColor:'#fff', borderRadius:22, padding:26, alignItems:'center', width:'100%', maxWidth:320 },
  celebrateTitle:{ fontFamily:F.display, fontSize:20, color:C.sumi, marginTop:8, textAlign:'center' },
  celebrateSub:{ fontFamily:F.body, fontSize:12.5, lineHeight:19, color:C.muted, textAlign:'center', marginTop:8 },
  celebrateCode:{ fontFamily:F.displayX, fontSize:19, color:C.shu, letterSpacing:1.2, marginTop:14 },
  celebrateBtn:{ backgroundColor:C.shu, borderRadius:14, paddingVertical:12, paddingHorizontal:28, marginTop:18 },

  newCardToast:{ position:'absolute', top:8, left:14, right:14, zIndex:40, flexDirection:'row', alignItems:'center', gap:11, backgroundColor:'#fff', borderRadius:16, padding:12, borderWidth:1, borderColor:C.shu,
    shadowColor:'#000', shadowOpacity:0.18, shadowRadius:10, shadowOffset:{ width:0, height:5 }, elevation:8 },
  newCardLabel:{ fontFamily:F.bodyX, fontSize:10.5, color:C.shu },
  newCardTitle:{ fontFamily:F.bodyB, fontSize:13, color:C.ink, marginTop:1 },
  hero:{ backgroundColor:C.sumi, borderRadius:18, padding:18, marginTop:6 },
  eyebrow:{ fontFamily:F.bodyX, fontSize:10, letterSpacing:1.2, color:'#F6D6B4' },
  heroTitle:{ fontFamily:F.display, fontSize:20, lineHeight:28, color:'#fff', marginTop:6 },
  heroSub:{ fontFamily:F.body, fontSize:11.5, lineHeight:18, color:'#D8D2CB', marginTop:9 },

  progressCard:{ backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:16, padding:16, marginTop:12 },
  progressBig:{ fontFamily:F.displayX, fontSize:30, color:C.sumi },
  progressOf:{ fontFamily:F.display, fontSize:18, color:C.muted },
  progressLabel:{ fontFamily:F.bodyB, fontSize:12, color:C.shu, marginBottom:4 },
  track:{ height:9, borderRadius:5, backgroundColor:C.hair, overflow:'hidden', marginTop:10 },
  trackOn:{ height:'100%', borderRadius:5, backgroundColor:C.matcha },

  voucherCard:{ backgroundColor:C.sumi, borderRadius:16, padding:16, marginTop:12 },
  voucherRow:{ flexDirection:'row', alignItems:'center', gap:8 },
  voucherTitle:{ fontFamily:F.bodyB, fontSize:13, color:'#fff', flex:1 },
  voucherCode:{ fontFamily:F.displayX, fontSize:22, color:'#F6D6B4', letterSpacing:1.5, marginTop:10 },
  voucherHint:{ fontFamily:F.body, fontSize:10.5, lineHeight:16, color:'#D8D2CB', marginTop:8 },

  grp:{ fontFamily:F.display, fontSize:12, color:C.muted, letterSpacing:1.5, marginTop:20, marginBottom:8 },

  card:{ backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:16, padding:14, marginBottom:10 },
  cardLocked:{ backgroundColor:C.washi2, borderStyle:'dashed' },
  cardHead:{ flexDirection:'row', alignItems:'center', gap:11 },
  glyphWrap:{ width:42, height:42, borderRadius:12, alignItems:'center', justifyContent:'center' },
  cardTitle:{ fontFamily:F.bodyB, fontSize:14, color:C.ink },
  cardTitleLocked:{ color:C.muted },
  cardRegion:{ fontFamily:F.body, fontSize:11, color:C.muted, marginTop:2 },
  cardSummary:{ fontFamily:F.body, fontSize:12, lineHeight:18, color:C.ink, marginTop:9 },
  cardLockedHint:{ fontFamily:F.body, fontSize:11.5, lineHeight:17, color:C.muted, marginTop:9, fontStyle:'italic' },

  detail:{ marginTop:12, borderTopWidth:1, borderTopColor:C.hair, paddingTop:12 },
  detailJp:{ fontFamily:F.displaySb, fontSize:13, color:C.kin, marginBottom:4 },
  detailTitle:{ fontFamily:F.bodyX, fontSize:11, color:C.shu, marginTop:10 },
  detailText:{ fontFamily:F.body, fontSize:12, lineHeight:19, color:C.ink, marginTop:3 },
  bullet:{ fontFamily:F.body, fontSize:12, lineHeight:19, color:C.ink, marginTop:3 },

  checkin:{ backgroundColor:C.washi2, borderRadius:10, padding:9, marginTop:6 },
  checkinName:{ fontFamily:F.bodyB, fontSize:12, color:C.ink },
  checkinTip:{ fontFamily:F.body, fontSize:11, lineHeight:16, color:C.muted, marginTop:2 },

  outfitBox:{ backgroundColor:C.shuSoft, borderRadius:12, padding:11, marginTop:12 },
  outfitStyle:{ fontFamily:F.bodyX, fontSize:11, color:C.shuDeep },
  outfitLine:{ fontFamily:F.body, fontSize:11.5, lineHeight:18, color:C.ink, marginTop:5 },
  outfitK:{ fontFamily:F.bodyB, color:C.ink },
  outfitReason:{ fontFamily:F.body, fontSize:11, lineHeight:16, color:C.muted, marginTop:6, fontStyle:'italic' },

  productChip:{ borderWidth:1, borderColor:C.shu, borderRadius:999, paddingVertical:6, paddingHorizontal:11, maxWidth:180 },
  productChipText:{ fontFamily:F.bodyM, fontSize:11, color:C.shuDeep },

  awardText:{ fontFamily:F.body, fontSize:10.5, color:C.muted, marginTop:12 },
});
