import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F, money } from '../../theme/tokens';
import { RisingSun } from '../../components/art';
import { SectionHeader, Price, Streak, PressScale } from '../../components/ui';
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

function StudioAction({icon,label,caption,onPress}:{icon:any;label:string;caption:string;onPress:()=>void}){
  return <View style={st.studioActionSlot}>
    <PressScale style={st.studioAction} scaleTo={.965} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}. ${caption}`}>
      <View style={st.studioIcon}><Ionicons name={icon} size={18} color="#fff" /></View>
      <Text style={st.studioLabel} numberOfLines={1}>{label}</Text>
      <Text style={st.studioCaption} numberOfLines={1}>{caption}</Text>
    </PressScale>
  </View>;
}

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
  const recommendationCardWidth=Math.min(160,Math.floor(screenWidth*.41));
  const featuredCardWidth=Math.floor((screenWidth-36-12)/2);

  return (
    <SafeAreaView edges={['top']} style={{ flex:1, backgroundColor:C.washi }}>
      <RisingSun />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* greeting */}
        <View style={st.greet}>
          <View style={{flexDirection:'row',alignItems:'center',gap:10}}><BrandLogo size={44}/><View><Text style={st.greetEyebrow}>JAPANO · 日本</Text><Text style={st.greetName}>{user?.name||'Xin chào'}</Text></View></View>
          <View style={{ flexDirection:'row', gap:10 }}>
            <PressScale style={st.icBtn} scaleTo={.92} onPress={()=>router.push('/(tabs)/products')} accessibilityLabel="Tìm sản phẩm"><Ionicons name="search" size={18} color={C.ink} /></PressScale>
            <PressScale style={st.icBtn} scaleTo={.92} onPress={()=>{if(requireAuth('/cart'))router.push('/cart');}} accessibilityLabel="Mở giỏ hàng">
              <Ionicons name="bag-outline" size={18} color={C.ink} />
              {isAuthenticated&&cartCount>0 && <View style={st.countBadge}><Text style={st.countT}>{cartCount}</Text></View>}
            </PressScale>
            <PressScale style={st.icBtn} scaleTo={.92} onPress={()=>{if(requireAuth('/notifications'))router.push('/notifications');}} accessibilityLabel="Mở thông báo">
              <Ionicons name="notifications-outline" size={18} color={C.ink} />
              {unread>0 && <View style={st.badge} />}
            </PressScale>
          </View>
        </View>

        {isAuthenticated&&!dailyDone && (
          <Pressable style={st.dailyBanner} onPress={()=>router.push('/daily')}>
            <Text style={{ fontSize:20 }}>🔥</Text>
            <View style={{ flex:1, marginLeft:10 }}>
              <Text style={{ fontFamily:F.bodyB, fontSize:12.5, color:'#fff' }}>Trả lời câu hỏi hôm nay để giữ chuỗi {streak} ngày</Text>
              <Text style={{ fontFamily:F.body, fontSize:11, color:'rgba(255,255,255,0.70)', marginTop:2 }}>Chỉ mất 10 giây — nhận gợi ý đồ Nhật hợp gu hơn</Text>
            </View>
            <Streak label={`${streak} 🔥`} />
          </Pressable>
        )}

        {/* hero */}
        <View style={st.hero}>
          <SmartImage source={heroImg} style={StyleSheet.absoluteFill as any} recyclingKey="home-hero" />
          <LinearGradient colors={['rgba(12,10,8,0.04)','rgba(12,10,8,0.16)','rgba(12,10,8,0.88)']} locations={[0,.42,1]} style={StyleSheet.absoluteFill} />
          <View style={st.heroTopline}>
            <View style={st.heroEdition}><View style={st.heroDot}/><Text style={st.heroEditionT}>JAPANO JOURNEY · 25 ĐỊA ĐIỂM</Text></View>
            <Text style={st.heroKanji}>旅</Text>
          </View>
          <View style={{ position:'absolute', left:18, bottom:16, right:18 }}>
            <Text style={st.heroEyebrow}>THỜI TRANG · VĂN HOÁ · HÀNH TRÌNH</Text>
            <Text style={st.heroTitle}>Mặc đẹp ở Nhật,{'\n'}thấy trước chính mình</Text>
            <Text style={st.heroBody} numberOfLines={2}>Thử trang phục JAPANO trên ảnh của bạn, rồi đặt mình vào những khung cảnh đẹp nhất Nhật Bản.</Text>
            <Pressable style={st.heroBtn} onPress={()=>router.push('/explore-japan')}>
              <Text style={st.heroBtnT}>Bắt đầu hành trình</Text><Ionicons name="arrow-forward" size={16} color={C.ink}/>
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal:18 }}>
          <View style={st.studio}>
            <View style={st.studioHead}>
              <View><Text style={st.studioEyebrow}>JAPANO AI STUDIO</Text><Text style={st.studioTitle}>Một ảnh, ba trải nghiệm</Text></View>
              <View style={st.studioSpark}><Ionicons name="sparkles" size={18} color={C.shu}/></View>
            </View>
            <View style={st.studioRow}>
              <StudioAction icon="shirt-outline" label="Thử đồ AI" caption="Tự chọn size" onPress={()=>{if(requireAuth('/tryon?productId=kimono-hong'))router.push('/tryon?productId=kimono-hong');}} />
              <StudioAction icon="image-outline" label="Ảnh tại Nhật" caption="25 phong cảnh" onPress={()=>router.push('/explore-japan')} />
              <StudioAction icon="chatbubble-ellipses-outline" label="Trợ lý Ori" caption="Phối đồ riêng" onPress={()=>{if(requireAuth('/chat'))router.push('/chat');}} />
            </View>
          </View>

          {/* category chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop:14 }} contentContainerStyle={{ gap:8, paddingRight:18 }}>
            {CATEGORIES.map((c,i)=>(
              <Pressable key={c.key} accessibilityRole="button" accessibilityLabel={`Xem danh mục ${c.label}`} style={[st.chip, i===0&&st.chipOn]} onPress={()=> c.key==='all'?router.push('/(tabs)/products'):router.push(`/category/${c.key}`)}>
                <Text style={{ color:i===0?'#fff':C.ink, fontFamily:F.bodyM, fontSize:12.5 }}>{c.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* recommendations */}
          <SectionHeader kanji="推" label="Gợi ý cho bạn" action="Tất cả" onAction={()=>router.push('/(tabs)/products')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:12, paddingBottom:3 }}>
            {recsLoading
              ? [0,1,2].map(i=>(
                  <View key={i} style={[st.productSkeleton,{ width:recommendationCardWidth }]}>
                    <Shimmer style={{ height:180, borderTopLeftRadius:17, borderTopRightRadius:17 }} />
                    <View style={st.productSkeletonMeta}>
                      <Shimmer style={{ height:11, borderRadius:6, width:'88%' }} />
                      <Shimmer style={{ height:11, borderRadius:6, marginTop:6, width:'62%' }} />
                      <Shimmer style={{ height:12, borderRadius:6, marginTop:8, width:'58%' }} />
                      <Shimmer style={{ height:20, borderRadius:99, marginTop:7, width:'90%' }} />
                    </View>
                  </View>
                ))
              : recs.map((p,i)=><ProductCard key={p.slug} p={p} width={recommendationCardWidth} index={i} reason={reasons[p.slug]||['Phong cách Nhật cổ','Tối giản, dễ phối','Hợp gu của bạn'][i]} />)}
          </ScrollView>

          {/* culture strip */}
          <Pressable style={st.culture} onPress={()=>router.push('/culture')}>
            <View style={{ height:120 }}>
              <SmartImage source={bySlug('yukata-xanh').images[0]} style={StyleSheet.absoluteFill as any} recyclingKey="home-culture" />
              <LinearGradient colors={['rgba(26,20,16,0.6)','transparent']} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFill} />
              <View style={{ position:'absolute', left:14, top:16 }}>
                <Text style={{ fontFamily:F.displaySb, letterSpacing:3, fontSize:11, color:'rgba(255,255,255,0.70)' }}>PHONG CÁCH CÁCH TÂN</Text>
                <Text style={{ fontFamily:F.displayX, fontSize:20, color:'#fff', marginTop:4, maxWidth:200 }}>Đổi mới phong cách theo lối Nhật</Text>
              </View>
            </View>
            <View style={st.cultureBand}>
              <Text style={{ fontFamily:F.body, fontSize:12.5, color:C.ink, flex:1 }}>Tối giản · bền · tinh tế — mặc ít mà chất hơn.</Text>
              <Text style={{ fontFamily:F.bodyB, color:C.ink, fontSize:12 }}>Tìm hiểu →</Text>
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
              <Text style={{ fontFamily:F.body, fontSize:11.5, color:C.muted, marginTop:2 }}>{outfit?.items.length||3} món · <Text style={{ color:C.ink, fontFamily:F.bodyB }}>{money(outfit?.totalPrice??2290000)}</Text></Text>
            </View>
            <Pressable style={st.addSet} onPress={()=>{if(requireAuth())(outfit?.items||[]).forEach(i=>addToCart(i.slug));}}><Text style={{ color:'#fff', fontFamily:F.bodyB, fontSize:11 }}>Thêm cả bộ</Text></Pressable>
          </Pressable>

          {/* featured grid */}
        <SectionHeader kanji="選" label="Sản phẩm bán chạy" action="Tất cả" onAction={()=>router.push('/(tabs)/products')} />
          <View style={st.grid}>
            {featured.map((p,i)=><ProductCard key={p.slug} p={p} index={i} width={featuredCardWidth} imgH={Math.round(featuredCardWidth*1.2)} />)}
          </View>

          <View style={st.promiseBar}>
            <View style={st.promise}><Ionicons name="person-circle-outline" size={18} color={C.ink}/><Text style={st.promiseT}>Giữ nguyên gương mặt</Text></View>
            <View style={st.promiseLine}/>
            <View style={st.promise}><Ionicons name="resize-outline" size={18} color={C.ink}/><Text style={st.promiseT}>Tự gợi ý size</Text></View>
            <View style={st.promiseLine}/>
            <View style={st.promise}><Ionicons name="shield-checkmark-outline" size={18} color={C.ink}/><Text style={st.promiseT}>Không lưu ảnh</Text></View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const st = StyleSheet.create({
  greet:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:18, paddingTop:6, paddingBottom:12 },
  greetEyebrow:{ fontFamily:F.bodyM, fontSize:9.5, letterSpacing:1.6, color:C.muted },
  greetName:{ fontFamily:F.display, fontSize:17, color:C.sumi, marginTop:2 },
  icBtn:{ width:38, height:38, borderRadius:12, backgroundColor:'#fff', borderWidth:1, borderColor:C.line, alignItems:'center', justifyContent:'center' },
  badge:{ position:'absolute', top:8, right:9, width:7, height:7, borderRadius:4, backgroundColor:C.shu },
  dailyBanner:{ flexDirection:'row', alignItems:'center', marginHorizontal:18, marginBottom:6, padding:12, borderRadius:14, backgroundColor:C.sumi },
  countBadge:{ position:'absolute', top:-4, right:-4, minWidth:18, height:18, borderRadius:9, backgroundColor:C.shu, alignItems:'center', justifyContent:'center', paddingHorizontal:4, borderWidth:1.5, borderColor:C.washi },
  countT:{ color:'#fff', fontFamily:F.bodyX, fontSize:10 },
  hero:{ height:276, overflow:'hidden', borderRadius:26, marginHorizontal:12, borderWidth:1, borderColor:'rgba(17,17,17,.08)' },
  heroTopline:{ position:'absolute', left:16, top:14, right:16, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  heroEdition:{ flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(17,17,17,.58)', borderRadius:999, paddingVertical:5, paddingHorizontal:9 },
  heroDot:{ width:6, height:6, borderRadius:3, backgroundColor:C.shu },
  heroEditionT:{ color:'rgba(255,255,255,.9)', fontFamily:F.bodyM, fontSize:8.5, letterSpacing:.8 },
  heroKanji:{ color:'rgba(255,255,255,.72)', fontFamily:F.display, fontSize:23 },
  heroEyebrow:{ fontFamily:F.displaySb, letterSpacing:2.6, fontSize:9, color:'rgba(255,255,255,.72)' },
  heroTitle:{ fontFamily:F.displayX, fontSize:27, lineHeight:31, color:'#fff', marginTop:5, marginBottom:7, letterSpacing:-.4 },
  heroBody:{ fontFamily:F.body, fontSize:11.5, lineHeight:17, color:'rgba(255,255,255,.82)', marginBottom:11, maxWidth:330 },
  heroBtn:{ backgroundColor:'#fff', alignSelf:'flex-start', paddingVertical:9, paddingLeft:13, paddingRight:10, borderRadius:12, flexDirection:'row', alignItems:'center', gap:8 },
  heroBtnT:{ color:C.ink, fontFamily:F.bodyB, fontSize:12 },
  studio:{ marginTop:14, borderRadius:20, backgroundColor:C.sumi, padding:14, overflow:'hidden' },
  studioHead:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  studioEyebrow:{ color:'rgba(255,255,255,.54)', fontFamily:F.bodyM, fontSize:8.5, letterSpacing:1.7 },
  studioTitle:{ color:'#fff', fontFamily:F.displaySb, fontSize:16, marginTop:2 },
  studioSpark:{ width:34, height:34, borderRadius:12, backgroundColor:'rgba(255,255,255,.08)', alignItems:'center', justifyContent:'center' },
  studioRow:{ flexDirection:'row', gap:8 },
  studioActionSlot:{ flex:1, minWidth:0 },
  studioAction:{ backgroundColor:'rgba(255,255,255,.075)', borderWidth:1, borderColor:'rgba(255,255,255,.1)', borderRadius:14, padding:9 },
  studioIcon:{ width:30, height:30, borderRadius:10, backgroundColor:'rgba(255,255,255,.12)', alignItems:'center', justifyContent:'center', marginBottom:8 },
  studioLabel:{ color:'#fff', fontFamily:F.bodyB, fontSize:10.5 },
  studioCaption:{ color:'rgba(255,255,255,.48)', fontFamily:F.body, fontSize:8.5, marginTop:2 },
  chip:{ borderWidth:1, borderColor:C.line, borderRadius:999, paddingVertical:8, paddingHorizontal:13, backgroundColor:'#fff' },
  chipOn:{ backgroundColor:C.primary, borderColor:C.primary },
  culture:{ borderRadius:18, overflow:'hidden', borderWidth:1, borderColor:C.line, marginTop:18 },
  cultureBand:{ flexDirection:'row', alignItems:'center', padding:14, backgroundColor:'rgba(26,20,16,0.03)' },
  look:{ flexDirection:'row', alignItems:'center', padding:10, borderWidth:1, borderColor:C.line, borderRadius:14, backgroundColor:'#fff' },
  lookThumb:{ width:46, height:56, borderRadius:9, borderWidth:2, borderColor:'#fff' },
  addSet:{ backgroundColor:C.sumi, paddingVertical:8, paddingHorizontal:11, borderRadius:10 },
  grid:{ flexDirection:'row', flexWrap:'wrap', justifyContent:'center', columnGap:12, rowGap:12, width:'100%', alignSelf:'center' },
  productSkeleton:{ height:281, borderRadius:18, overflow:'hidden', borderWidth:1, borderColor:C.line, backgroundColor:C.card },
  productSkeletonMeta:{ height:101, paddingHorizontal:10, paddingTop:9, paddingBottom:10 },
  promiseBar:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:18, marginBottom:28, borderTopWidth:1, borderBottomWidth:1, borderColor:C.line, paddingVertical:13 },
  promise:{ flex:1, alignItems:'center', gap:5 },
  promiseT:{ textAlign:'center', color:C.muted, fontFamily:F.bodyM, fontSize:8.5 },
  promiseLine:{ width:1, height:24, backgroundColor:C.line },
});
