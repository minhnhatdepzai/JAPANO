import React from 'react';
import { Animated, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C, F } from '../theme/tokens';
import { Price } from './ui';
import { FadeSlideIn, PressScale, useReduceMotion } from './motion';
import { Product } from '../lib/catalog';
import { useStore } from '../lib/store';
import { SmartImage } from './SmartImage';

export const Heart = React.memo(({ slug }:{ slug:string }) => {
  const { isWished, toggleWish } = useStore();
  const reduced = useReduceMotion();
  const on = isWished(slug);
  const pop = React.useRef(new Animated.Value(1)).current;
  // Thả tim là một hành động đáng ăn mừng nhỏ: nảy một cái để xác nhận, thay vì
  // biểu tượng lặng lẽ đổi màu mà mắt dễ bỏ sót.
  const press = () => {
    toggleWish(slug);
    if (reduced) return;
    Animated.sequence([
      Animated.spring(pop, { toValue:1.35, useNativeDriver:true, speed:50, bounciness:14 }),
      Animated.spring(pop, { toValue:1, useNativeDriver:true, speed:26, bounciness:10 }),
    ]).start();
  };
  return (
    <Pressable
      onPress={press}
      style={st.heart}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={on?'Bỏ khỏi danh sách yêu thích':'Thêm vào danh sách yêu thích'}
    >
      <Animated.View style={{ transform:[{ scale:pop }] }}>
        <Ionicons name={on?'heart':'heart-outline'} size={16} color={C.shu} />
      </Animated.View>
    </Pressable>
  );
});
Heart.displayName = 'Heart';

// memo hoá: lưới sản phẩm dựng lại toàn bộ thẻ mỗi lần màn hình cha vẽ lại —
// rõ nhất là khi gõ ô tìm kiếm (mỗi ký tự là một lần setState của cha). Props
// đều là giá trị nguyên thuỷ hoặc object sản phẩm ổn định nên so sánh nông đủ.
export const ProductCard = React.memo(({ p, width=150, reason, imgH=180, index=0 }:
  { p:Product; width?:number; reason?:string; imgH?:number; index?:number }) => {
  const router = useRouter();
  // Xuất hiện lần lượt theo vị trí trong lưới. Trần 8 nhịp (≈280ms) để hàng
  // cuối của một lưới dài không phải chờ lâu mới hiện — hiệu ứng lần lượt là
  // để dẫn mắt, không phải để bắt chờ.
  const delay = Math.min(index, 8) * 35;
  return (
    <FadeSlideIn delay={delay} offset={10} style={{ width }}>
      <PressScale
        onPress={()=>router.push(`/product/${p.slug}`)}
        scaleTo={0.965}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}, ${p.price.toLocaleString('vi-VN')} đồng`}
      >
        <View style={[st.tile,{ height:imgH }]}>
          <SmartImage source={p.images[0]} style={st.img} recyclingKey={`${p.slug}-card`} />
          {!!p.old && p.old > p.price && (
            <View style={st.saleTag}>
              <Text style={st.saleTagT}>-{Math.round((1 - p.price / p.old) * 100)}%</Text>
            </View>
          )}
        </View>
        <Text style={st.nm} numberOfLines={1}>{p.name}</Text>
        <Price value={p.price} old={p.old} size={13} />
        {!!reason && <Text style={st.reason}>{reason}</Text>}
      </PressScale>
      {/* Nút tim nằm ngoài PressScale: nó có hành động riêng, không nên bị hiệu
          ứng nhấn của cả thẻ nuốt mất. */}
      <View style={[st.heartWrap,{ height:imgH }]} pointerEvents="box-none">
        <Heart slug={p.slug} />
      </View>
    </FadeSlideIn>
  );
});
ProductCard.displayName = 'ProductCard';

const st = StyleSheet.create({
  tile:{ borderRadius:14, overflow:'hidden', backgroundColor:C.washi2, position:'relative', borderWidth:1.5, borderColor:C.blue },
  img:{ width:'100%', height:'100%' },
  heartWrap:{ position:'absolute', top:0, left:0, right:0 },
  heart:{ position:'absolute', top:8, right:8, width:30, height:30, borderRadius:15, backgroundColor:'rgba(255,255,255,0.9)', alignItems:'center', justifyContent:'center' },
  saleTag:{ position:'absolute', top:8, left:8, backgroundColor:C.shu, borderRadius:6, paddingHorizontal:6, paddingVertical:3 },
  saleTagT:{ color:'#fff', fontFamily:F.bodyX, fontSize:10 },
  nm:{ fontFamily:F.bodyB, fontSize:12.5, color:C.ink, marginTop:7, marginBottom:2 },
  reason:{ fontFamily:F.bodyB, fontSize:10, color:C.kin, marginTop:2 },
});
