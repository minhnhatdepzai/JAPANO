import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { money } from '../components/ui';
import { getFlagcardCollection, Flagcard, FlagcardCollection } from '../lib/api';
import { C, F } from '../theme/tokens';

const W = Dimensions.get('window').width;

function IntroSlide({ data }:{ data:FlagcardCollection }) {
  return (
    <View style={st.slide}>
      <Text style={{ fontSize:52 }}>🚩</Text>
      <Text style={st.introEyebrow}>SƯU TẦM ĐỊA DANH</Text>
      <Text style={st.introTitle}>Sưu tầm đủ {data.progress.required} thẻ địa danh{`\n`}nhận mã giảm {data.config.rewardPercent}%</Text>
      <Text style={st.introSub}>
        Mỗi đơn hàng thanh toán thành công từ {money(data.config.qualifyingOrderMin)} sẽ ngẫu nhiên tặng bạn một thẻ địa danh chưa có —
        mỗi thẻ là một địa danh lịch sử Nhật Bản kèm truyền thuyết, điểm check-in và gợi ý trang phục.
      </Text>
      <Text style={st.introHint}>Vuốt hoặc chạm mũi tên để xem trước cả {data.cards.length} tấm thẻ →</Text>
    </View>
  );
}

function CardSlide({ card }:{ card:Flagcard }) {
  return (
    <View style={st.slide}>
      <View style={[st.glyphBig, { backgroundColor:`${card.accent || C.shu}22` }]}>
        <Text style={{ fontSize:44 }}>{card.glyph}</Text>
      </View>
      {card.owned && <View style={st.ownedTag}><Ionicons name="checkmark-circle" size={13} color={C.ok} /><Text style={st.ownedTagT}>Bạn đã có thẻ này</Text></View>}
      <Text style={st.cardEyebrow}>{card.region} · #{card.order}/7</Text>
      <Text style={st.cardTitle}>{card.title}</Text>
      <Text style={st.cardJp}>{card.japanese}</Text>
      <Text style={st.cardSummary}>{card.summary}</Text>
    </View>
  );
}

function OutroSlide({ onFinish }:{ onFinish:()=>void }) {
  return (
    <View style={st.slide}>
      <Text style={{ fontSize:52 }}>🎁</Text>
      <Text style={st.introTitle}>Bắt đầu sưu tầm ngay hôm nay</Text>
      <Text style={st.introSub}>Đặt đơn đầu tiên đủ điều kiện để nhận thẻ địa danh ngẫu nhiên, hoặc xem lại bộ sưu tập hiện tại của bạn.</Text>
      <Pressable style={st.cta} onPress={onFinish}>
        <Text style={{ color:'#fff', fontFamily:F.bodyB, fontSize:14 }}>Xem bộ sưu tập của tôi</Text>
      </Pressable>
    </View>
  );
}

export default function FlagcardIntro() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<FlagcardCollection|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    getFlagcardCollection().then(res => { if (live) setData(res); }).catch(() => undefined).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const close = () => router.back();
  const finish = () => router.replace('/flagcards');

  const slideCount = data ? data.cards.length + 2 : 0;
  const last = page === slideCount - 1;
  const first = page === 0;

  const goTo = (target:number) => {
    const clamped = Math.max(0, Math.min(slideCount - 1, target));
    scrollRef.current?.scrollTo({ x: clamped * W, animated: true });
    setPage(clamped);
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / W));
  };

  return (
    <View style={st.backdrop}>
      <View style={st.sheet}>
        <Pressable style={st.close} onPress={close} hitSlop={10}>
          <Ionicons name="close" size={22} color={C.muted} />
        </Pressable>

        {loading && (
          <View style={{ height:420, alignItems:'center', justifyContent:'center' }}>
            <ActivityIndicator color={C.ink} />
          </View>
        )}

        {!loading && data && (
          <>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScrollEnd}
              style={{ height:430 }}
            >
              <View style={{ width:W }}><IntroSlide data={data} /></View>
              {data.cards.map(card => <View key={card.id} style={{ width:W }}><CardSlide card={card} /></View>)}
              <View style={{ width:W }}><OutroSlide onFinish={finish} /></View>
            </ScrollView>

            <View style={st.dots}>
              {Array.from({ length: slideCount }).map((_, i) => (
                <View key={i} style={[st.dot, i===page && st.dotOn]} />
              ))}
            </View>

            <View style={st.nav}>
              <Pressable style={[st.navBtn, first && st.navBtnDisabled]} disabled={first} onPress={()=>goTo(page-1)}>
                <Ionicons name="chevron-back" size={18} color={first?C.hair:C.ink} />
                <Text style={[st.navT, first && { color:C.hair }]}>Lùi</Text>
              </Pressable>
              <Pressable style={st.navBtnPrimary} onPress={()=> last ? finish() : goTo(page+1)}>
                <Text style={{ color:'#fff', fontFamily:F.bodyB, fontSize:13 }}>{last?'Xem bộ sưu tập':'Qua'}</Text>
                {!last && <Ionicons name="chevron-forward" size={18} color="#fff" />}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  backdrop:{ flex:1, backgroundColor:'rgba(17,12,8,0.55)', justifyContent:'flex-end' },
  sheet:{ backgroundColor:C.washi, borderTopLeftRadius:28, borderTopRightRadius:28, paddingTop:18, paddingBottom:28, overflow:'hidden' },
  close:{ position:'absolute', right:16, top:14, zIndex:10, width:32, height:32, borderRadius:16, backgroundColor:C.card, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.line },

  slide:{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:30 },
  introEyebrow:{ fontFamily:F.bodyX, fontSize:10.5, letterSpacing:1.5, color:C.ink, marginTop:12 },
  introTitle:{ fontFamily:F.display, fontSize:21, lineHeight:29, color:C.sumi, textAlign:'center', marginTop:8 },
  introSub:{ fontFamily:F.body, fontSize:12.5, lineHeight:20, color:C.muted, textAlign:'center', marginTop:12, maxWidth:290 },
  introHint:{ fontFamily:F.bodyB, fontSize:11.5, color:C.ink, marginTop:16 },

  glyphBig:{ width:88, height:88, borderRadius:24, alignItems:'center', justifyContent:'center' },
  ownedTag:{ flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'#E4EEE6', borderRadius:999, paddingVertical:4, paddingHorizontal:11, marginTop:12 },
  ownedTagT:{ fontFamily:F.bodyB, fontSize:10.5, color:C.ok },
  cardEyebrow:{ fontFamily:F.bodyX, fontSize:10.5, letterSpacing:1, color:C.muted, marginTop:14 },
  cardTitle:{ fontFamily:F.display, fontSize:19, color:C.sumi, textAlign:'center', marginTop:5 },
  cardJp:{ fontFamily:F.displaySb, fontSize:13, color:C.kin, marginTop:4 },
  cardSummary:{ fontFamily:F.body, fontSize:12.5, lineHeight:20, color:C.ink, textAlign:'center', marginTop:12, maxWidth:290 },

  cta:{ backgroundColor:C.primary, borderRadius:14, paddingVertical:13, paddingHorizontal:26, marginTop:20 },

  dots:{ flexDirection:'row', gap:6, justifyContent:'center', marginTop:8 },
  dot:{ width:6, height:6, borderRadius:3, backgroundColor:C.hair },
  dotOn:{ width:18, backgroundColor:C.primary },

  nav:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, marginTop:16 },
  navBtn:{ flexDirection:'row', alignItems:'center', gap:2, paddingVertical:10, paddingHorizontal:6 },
  navBtnDisabled:{ opacity:0.5 },
  navT:{ fontFamily:F.bodyM, fontSize:13, color:C.ink },
  navBtnPrimary:{ flexDirection:'row', alignItems:'center', gap:4, backgroundColor:C.primary, borderRadius:14, paddingVertical:11, paddingHorizontal:20 },
});
