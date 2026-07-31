import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F, money } from '../../theme/tokens';
import { RisingSun } from '../../components/art';
import { SectionHeader, Price, Streak } from '../../components/ui';
import { ProductCard, Heart } from '../../components/ProductCard';
import { PRODUCTS, CATEGORIES } from '../../lib/catalog';
import { useStore } from '../../lib/store';
import { useCatalog } from '../../lib/data';
import { ApiProductRef, getHomeRecommendations, getTodaysOutfit, OutfitSet } from '../../lib/api';
import { loadStyleProfile } from '../../lib/profile';
import { unreadCount } from '../../lib/notifications';
import { SmartImage } from '../../components/SmartImage';
import { useAuth } from '../../lib/auth';
import { BrandLogo } from '../../lib/shop';
import { useGpuFocus } from '../../lib/useGpuFocus';

const refKey=(ref:ApiProductRef)=>typeof ref==='string'?ref:String(ref.slug||ref.productId||ref.id||ref._id||'');
const todayKey=()=>new Date().toISOString().slice(0,10);

function Shimmer({ style }:{ style:any }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue:1, duration:650, useNativeDriver:true }),
      Animated.timing(pulse, { toValue:0.4, duration:650, useNativeDriver:true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[style, { backgroundColor:C.washi2, opacity:pulse }]} />;
}

export default function Home() {
  useGpuFocus('home');
  const {width:screenWidth}=useWindowDimensions();
  const router = useRouter();
  const { cartCount, addToCart } = useStore();
  const { user, isAuthenticated, requireAuth } = useAuth();
  const {products}=useCatalog();
  const [remoteRefs,setRemoteRefs]=useState<ApiProductRef[]>([]);
  const [reasons,setReasons]=useState<Record<string,string>>({});
  const [recsLoading,setRecsLoading]=useState(true);
  const [outfit,setOutfit]=useState<OutfitSet|null>(null);
  const [unread,setUnread]=useState(0);
  const [streak,setStreak]=useState(0);
  const [dailyDone,setDailyDone]=useState(true);
  const bySlug=(slug:string)=>products.find(p=>p.slug===slug)||PRODUCTS.find(p=>p.slug===slug)||products[0]||PRODUCTS[0];
  useEffect(()=>{
    let live=true;
    if(isAuthenticated){
      void loadStyleProfile().then(profile=>getHomeRecommendations(user?.id,8,profile)).then(data=>{
        if(live){setRemoteRefs(data.items);setReasons(data.reasons);}
      }).catch(()=>undefined).finally(()=>{if(live)setRecsLoading(false);});
    }else{
      setRemoteRefs([]);setReasons({});setRecsLoading(false);
    }
    void getTodaysOutfit().then(data=>{if(live)setOutfit(data);}).catch(()=>undefined);
    return()=>{live=false;};
  },[isAuthenticated,products,user?.id]);
  useFocusEffect(useCallback(()=>{
    let live=true;
    if(isAuthenticated){
      void unreadCount().then(n=>{if(live)setUnread(n);}).catch(()=>undefined);
      void loadStyleProfile().then(p=>{if(live){setStreak(Number(p.streak||0));setDailyDone(p.lastQuizDate===todayKey());}});
    }else if(live){setUnread(0);setStreak(0);setDailyDone(true);}
    return()=>{live=false;};
  },[isAuthenticated]));
  const recs=useMemo(()=>{
    const remote=remoteRefs.map(ref=>bySlug(refKey(ref))).filter(Boolean);
    const fallback=['kimono-hong','haori-dang-dai','yae-miko'].map(bySlug);
    return [...remote,...fallback].filter((p,i,a)=>a.findIndex(x=>x.slug===p.slug)===i).slice(0,3);
  },[remoteRefs,products]);
  const featured = ['furina','yukata-xanh','cardigan-dai','giay-dep'].map(bySlug);
  const heroImg = bySlug('kimono-hong').images[0];
  const setThumbs = ['haori-dang-dai','so-mi-trang','balo-vai'].map(s=>bySlug(s).images[0]);
  const featuredCardWidth=Math.floor((screenWidth-36-12)/2);

  return (
    <SafeAreaView edges={['top']} style={{ flex:1, backgroundColor:C.washi }}>
      <RisingSun />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* greeting */}
        <View style={st.greet}>
          <View style={{flexDirection:'row',alignItems:'center',gap:10}}><BrandLogo size={44}/><View><Text style={{ fontFamily:F.body, fontSize:12, color:C.muted }}>Xin chào,</Text><Text style={{ fontFamily:F.display, fontSize:17, color:C.sumi }}>{user?.name||'Khách'}</Text></View></View>
          <View style={{ flexDirection:'row', gap:10 }}>
            <Pressable style={st.icBtn} onPress={()=>router.push('/(tabs)/products')}><Ionicons name="search" size={18} color={C.ink} /></Pressable>
            <Pressable style={st.icBtn} onPress={()=>{if(requireAuth('/cart'))router.push('/cart');}}>
              <Ionicons name="bag-outline" size={18} color={C.ink} />
              {isAuthenticated&&cartCount>0 && <View style={st.countBadge}><Text style={st.countT}>{cartCount}</Text></View>}
            </Pressable>
            <Pressable style={st.icBtn} onPress={()=>{if(requireAuth('/notifications'))router.push('/notifications');}}>
              <Ionicons name="notifications-outline" size={18} color={C.ink} />
              {unread>0 && <View style={st.badge} />}
            </Pressable>
          </View>
        </View>

        {isAuthenticated&&!dailyDone && (
          <Pressable style={st.dailyBanner} onPress={()=>router.push('/daily')}>
            <Text style={{ fontSize:20 }}>🔥</Text>
            <View style={{ flex:1, marginLeft:10 }}>
              <Text style={{ fontFamily:F.bodyB, fontSize:12.5, color:'#fff' }}>Trả lời câu hỏi hôm nay để giữ chuỗi {streak} ngày</Text>
              <Text style={{ fontFamily:F.body, fontSize:11, color:'#f0d9b6', marginTop:2 }}>Chỉ mất 10 giây — nhận gợi ý đồ Nhật hợp gu hơn</Text>
            </View>
            <Streak label={`${streak} 🔥`} />
          </Pressable>
        )}

        {/* hero */}
        <View style={st.hero}>
          <SmartImage source={heroImg} style={StyleSheet.absoluteFill as any} recyclingKey="home-hero" />
          <LinearGradient colors={['rgba(26,20,16,0)','rgba(26,20,16,0.75)']} style={StyleSheet.absoluteFill} />
          <View style={{ position:'absolute', left:18, bottom:16, right:18 }}>
            <Text style={{ fontFamily:F.displaySb, letterSpacing:3, fontSize:10, color:'#f0d9b6' }}>KHÁM PHÁ NHẬT BẢN</Text>
            <Text style={{ fontFamily:F.displayX, fontSize:26, color:'#fff', marginTop:4, marginBottom:8 }}>Từ Hokkaido đến{'\n'}Okinawa, đi cùng JAPANO</Text>
            <Text style={{ fontFamily:F.body, fontSize:11.5, lineHeight:17, color:'#EDE6DC', marginBottom:10 }} numberOfLines={2}>Địa điểm nổi tiếng, gợi ý chụp ảnh đẹp và câu chuyện từng vùng — có thật, có nguồn kiểm chứng.</Text>
            <Pressable style={st.heroBtn} onPress={()=>router.push('/explore-japan')}>
              <Text style={{ color:'#fff', fontFamily:F.bodyB, fontSize:13 }}>Khám phá →</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal:18 }}>
          {/* category chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop:14 }} contentContainerStyle={{ gap:8 }}>
            {CATEGORIES.map((c,i)=>(
              <Pressable key={c.key} style={[st.chip, i===0&&st.chipOn]} onPress={()=> c.key==='all'?router.push('/(tabs)/products'):router.push(`/category/${c.key}`)}>
                <Text style={{ color:i===0?'#fff':C.ink, fontFamily:F.bodyM, fontSize:12.5 }}>{c.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* recommendations */}
          <SectionHeader kanji="推" label="Gợi ý cho bạn" action="Tất cả" onAction={()=>router.push('/(tabs)/products')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:12 }}>
            {recsLoading
              ? [0,1,2].map(i=>(
                  <View key={i} style={{ width:150 }}>
                    <Shimmer style={{ height:180, borderRadius:14 }} />
                    <Shimmer style={{ height:12, borderRadius:6, marginTop:8, width:'80%' }} />
                    <Shimmer style={{ height:12, borderRadius:6, marginTop:6, width:'50%' }} />
                  </View>
                ))
              : recs.map((p,i)=><ProductCard key={p.slug} p={p} reason={reasons[p.slug]||['phong cách Nhật cổ','vì bạn thích sự tối giản','hợp gu của bạn'][i]} />)}
          </ScrollView>

          {/* culture strip */}
          <Pressable style={st.culture} onPress={()=>router.push('/culture')}>
            <View style={{ height:120 }}>
              <SmartImage source={bySlug('yukata-xanh').images[0]} style={StyleSheet.absoluteFill as any} recyclingKey="home-culture" />
              <LinearGradient colors={['rgba(26,20,16,0.6)','transparent']} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFill} />
              <View style={{ position:'absolute', left:14, top:16 }}>
                <Text style={{ fontFamily:F.displaySb, letterSpacing:3, fontSize:11, color:'#f0d9b6' }}>PHONG CÁCH CÁCH TÂN</Text>
                <Text style={{ fontFamily:F.displayX, fontSize:20, color:'#fff', marginTop:4, maxWidth:200 }}>Đổi mới phong cách theo lối Nhật</Text>
              </View>
            </View>
            <View style={st.cultureBand}>
              <Text style={{ fontFamily:F.body, fontSize:12.5, color:C.ink, flex:1 }}>Tối giản · bền · tinh tế — mặc ít mà chất hơn.</Text>
              <Text style={{ fontFamily:F.bodyB, color:C.shu, fontSize:12 }}>Tìm hiểu →</Text>
            </View>
          </Pressable>

          {/* outfit: AI ghép đồ — đổi mỗi ngày, một lý do để quay lại app dù chưa mua gì */}
          <SectionHeader kanji="組" label="Hôm nay mặc gì · Gợi ý phối đồ" action="Xem thêm" onAction={()=>router.push(`/product/${outfit?.anchor||'haori-dang-dai'}`)} />
          <Pressable style={st.look} onPress={()=>router.push(`/product/${outfit?.anchor||'haori-dang-dai'}`)}>
            <View style={{ flexDirection:'row' }}>
              {(outfit?outfit.items.map(i=>bySlug(i.slug)):setThumbs.map(im=>({images:[im]} as any))).slice(0,3).map((p:any,i:number)=>(
                <SmartImage key={i} source={p.images[0]} style={[st.lookThumb, i>0&&{ marginLeft:-10 }]} recyclingKey={`home-look-${p.slug||i}`} />
              ))}
            </View>
            <View style={{ flex:1, marginLeft:10 }}>
              <Text style={{ fontFamily:F.bodyB, fontSize:13.5, color:C.ink }} numberOfLines={1}>{outfit?.title||'Bộ đồ đi làm thanh lịch'}</Text>
              <Text style={{ fontFamily:F.body, fontSize:11.5, color:C.muted, marginTop:2 }}>{outfit?.items.length||3} món · <Text style={{ color:C.shu, fontFamily:F.bodyB }}>{money(outfit?.totalPrice??2290000)}</Text></Text>
            </View>
            <Pressable style={st.addSet} onPress={()=>{if(requireAuth())(outfit?.items||[]).forEach(i=>addToCart(i.slug));}}><Text style={{ color:'#fff', fontFamily:F.bodyB, fontSize:11 }}>Thêm cả bộ</Text></Pressable>
          </Pressable>

          {/* featured grid */}
          <SectionHeader kanji="選" label="Sản phẩm nổi bật" action="Tất cả" onAction={()=>router.push('/(tabs)/products')} />
          <View style={st.grid}>
            {featured.map(p=><ProductCard key={p.slug} p={p} width={featuredCardWidth} imgH={Math.round(featuredCardWidth*1.2)} />)}
          </View>

          {/* quick actions */}
          <View style={[st.grid,{ marginTop:16, marginBottom:24 }]}>
            <Pressable style={st.quick} onPress={()=>{if(requireAuth('/camera'))router.push('/camera');}}>
              <Ionicons name="camera-outline" size={26} color={C.shu} />
              <Text style={st.quickT}>Ống kính JAPANO</Text><Text style={st.quickS}>chụp → gợi ý đồ</Text>
            </Pressable>
            <Pressable style={st.quick} onPress={()=>{if(requireAuth('/goals'))router.push('/goals');}}>
              <Ionicons name="flag-outline" size={26} color={C.shu} />
              <Text style={st.quickT}>Mục tiêu</Text><Text style={st.quickS}>mua sắm · sức khoẻ · Nhật Bản</Text>
            </Pressable>
            <Pressable style={st.quick} onPress={()=>router.push('/explore-japan')}>
              <Ionicons name="compass-outline" size={26} color={C.shu} />
              <Text style={st.quickT}>Khám phá Nhật Bản</Text><Text style={st.quickS}>địa điểm · chụp ảnh đẹp</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const st = StyleSheet.create({
  greet:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:18, paddingTop:6, paddingBottom:10 },
  icBtn:{ width:38, height:38, borderRadius:11, backgroundColor:'#fff', borderWidth:1, borderColor:C.line, alignItems:'center', justifyContent:'center' },
  badge:{ position:'absolute', top:8, right:9, width:7, height:7, borderRadius:4, backgroundColor:C.shu },
  dailyBanner:{ flexDirection:'row', alignItems:'center', marginHorizontal:18, marginBottom:6, padding:12, borderRadius:14, backgroundColor:C.sumi },
  countBadge:{ position:'absolute', top:-4, right:-4, minWidth:18, height:18, borderRadius:9, backgroundColor:C.shu, alignItems:'center', justifyContent:'center', paddingHorizontal:4, borderWidth:1.5, borderColor:C.washi },
  countT:{ color:'#fff', fontFamily:F.bodyX, fontSize:10 },
  hero:{ height:222, overflow:'hidden', borderBottomLeftRadius:26, borderBottomRightRadius:26 },
  heroBtn:{ backgroundColor:C.shu, alignSelf:'flex-start', paddingVertical:8, paddingHorizontal:14, borderRadius:11 },
  chip:{ borderWidth:1, borderColor:C.line, borderRadius:999, paddingVertical:8, paddingHorizontal:13, backgroundColor:'#fff' },
  chipOn:{ backgroundColor:C.shu, borderColor:C.shu },
  culture:{ borderRadius:18, overflow:'hidden', borderWidth:1, borderColor:C.line, marginTop:18 },
  cultureBand:{ flexDirection:'row', alignItems:'center', padding:14, backgroundColor:'rgba(26,20,16,0.03)' },
  look:{ flexDirection:'row', alignItems:'center', padding:10, borderWidth:1, borderColor:C.line, borderRadius:14, backgroundColor:'#fff' },
  lookThumb:{ width:46, height:56, borderRadius:9, borderWidth:2, borderColor:'#fff' },
  addSet:{ backgroundColor:C.sumi, paddingVertical:8, paddingHorizontal:11, borderRadius:10 },
  grid:{ flexDirection:'row', flexWrap:'wrap', justifyContent:'center', columnGap:12, rowGap:12, width:'100%', alignSelf:'center' },
  quick:{ width:'48%', backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:16, padding:14, alignItems:'center' },
  quickT:{ fontFamily:F.bodyX, fontSize:13, color:C.ink, marginTop:4 },
  quickS:{ fontFamily:F.body, fontSize:10.5, color:C.muted },
});
