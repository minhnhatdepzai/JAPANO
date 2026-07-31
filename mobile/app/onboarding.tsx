import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Pressable, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Btn } from '../components/ui';
import { Torii, Fuji, Noren } from '../components/art';
import { C, F } from '../theme/tokens';

const W = Dimensions.get('window').width;

const SLIDES = [
  {
    Art: Torii, kanji: 'HÀNH TRÌNH',
    title: 'Mặc đẹp theo\ntinh thần Nhật',
    sub: 'Áo truyền thống, áo khoác Nhật, trang phục hóa thân và phụ kiện — tuyển chọn theo phong cách tinh tế.',
  },
  {
    Art: Fuji, kanji: 'THỬ ĐỒ THÔNG MINH',
    title: 'Thử đồ thật\nkhông cần đến cửa hàng',
    sub: 'Chụp một ảnh — hệ thống thay trang phục, gợi ý kích cỡ và phối đồ theo dáng người của bạn.',
  },
  {
    Art: Noren, kanji: 'SƯU TẦM',
    title: 'Sưu tầm thẻ địa danh\nkhắp Nhật Bản',
    sub: 'Mỗi đơn hàng mở khoá một địa danh lịch sử. Đủ bộ 7 thẻ, nhận mã giảm giá 50%.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;

  const goToLogin = () => router.replace('/login');
  const browseAsGuest = () => router.replace('/(tabs)/products');
  const next = () => {
    if (last) { goToLogin(); return; }
    scrollRef.current?.scrollTo({ x: (page + 1) * W, animated: true });
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / W));
  };

  return (
    <Screen wave={false}>
      <Pressable style={st.skip} onPress={browseAsGuest}><Text style={st.skipT}>Xem sản phẩm</Text></Pressable>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex:1 }}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={{ width: W, flex:1 }}>
            <View style={{ height:260 }}>
              <slide.Art height={260} />
              <LinearGradient colors={[C.washi, 'rgba(244,237,225,0)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
            </View>
            <View style={st.textWrap}>
              <Text style={st.kana}>{slide.kanji}</Text>
              <Text style={st.brand}>{slide.title}</Text>
              <Text style={st.sub}>{slide.sub}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal:22, paddingBottom:10 }}>
        <View style={st.dots}>
          {SLIDES.map((_,i)=>(<View key={i} style={[st.dot, i===page&&{ width:22, backgroundColor:C.shu }]} />))}
        </View>
        <Btn label={last?'Đăng nhập để bắt đầu':'Tiếp theo'} onPress={next} />
        <Text style={st.foot}>Hoặc <Text style={{ color:C.shu, fontFamily:F.bodyB }} onPress={browseAsGuest}>chỉ xem sản phẩm</Text></Text>
      </View>
    </Screen>
  );
}
const st = StyleSheet.create({
  skip:{ position:'absolute', right:18, top:14, zIndex:10, paddingVertical:8, paddingHorizontal:12 },
  skipT:{ fontFamily:F.bodyM, fontSize:13, color:C.muted },
  textWrap:{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:26 },
  kana:{ fontFamily:F.displaySb, color:C.shu, letterSpacing:2, fontSize:12, marginBottom:10 },
  brand:{ fontFamily:F.displayX, fontSize:26, color:C.sumi, textAlign:'center', lineHeight:34 },
  sub:{ fontFamily:F.body, color:C.muted, fontSize:14, textAlign:'center', marginTop:14, lineHeight:22, maxWidth:280 },
  dots:{ flexDirection:'row', gap:6, justifyContent:'center', marginTop:14, marginBottom:16 },
  dot:{ width:6, height:6, borderRadius:3, backgroundColor:C.hair },
  foot:{ textAlign:'center', marginTop:12, fontFamily:F.body, fontSize:13, color:C.muted },
});
