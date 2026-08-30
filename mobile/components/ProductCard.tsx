import React from 'react';
import { Animated, Easing, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F } from '../theme/tokens';
import { Price } from './ui';
import { FadeSlideIn, PressScale, useReduceMotion } from './motion';
import { Product } from '../lib/catalog';
import { useStore } from '../lib/store';
import { SmartImage } from './SmartImage';

const friendlyReason = (reason?:string) => {
  const value=String(reason||'').trim();
  if(!value)return '';
  if(/mô hình|model|ranker|xếp hạng|thuật toán/i.test(value))return 'Hợp gu của bạn';
  return value.replace(/^vì\s+/i,'').replace(/^phù hợp vì\s+/i,'');
};

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
        <Ionicons name={on?'heart':'heart-outline'} size={18} color={C.ink} />
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
  const reduced = useReduceMotion();
  const displayReason=friendlyReason(reason);
  const reveal = React.useRef(new Animated.Value(0)).current;
  // Xuất hiện lần lượt theo vị trí trong lưới. Trần 8 nhịp (≈280ms) để hàng
  // cuối của một lưới dài không phải chờ lâu mới hiện — hiệu ứng lần lượt là
  // để dẫn mắt, không phải để bắt chờ.
  const delay = Math.min(index, 8) * 35;
  React.useEffect(()=>{
    if(reduced){reveal.setValue(1);return;}
    reveal.setValue(0);
    const animation=Animated.timing(reveal,{
      toValue:1,duration:720,delay,
      easing:Easing.out(Easing.cubic),useNativeDriver:true,
    });
    animation.start();
    return()=>animation.stop();
  },[delay,reduced,reveal,p.slug]);
  return (
    <FadeSlideIn delay={delay} offset={10} style={{ width }}>
      <View style={st.card}>
        <PressScale
          onPress={()=>router.push(`/product/${p.slug}`)}
          scaleTo={0.975}
          accessibilityRole="button"
          accessibilityLabel={`${p.name}, ${p.price.toLocaleString('vi-VN')} đồng`}
        >
          <View style={[st.tile,{ height:imgH }]}>
          <Animated.View style={[
            StyleSheet.absoluteFill,
            !reduced&&{
              opacity:reveal.interpolate({inputRange:[0,1],outputRange:[.55,1]}),
              transform:[
                {scale:reveal.interpolate({inputRange:[0,1],outputRange:[1.075,1]})},
                {translateY:reveal.interpolate({inputRange:[0,1],outputRange:[8,0]})},
              ],
            },
          ]}>
            <SmartImage source={p.images[0]} style={StyleSheet.absoluteFill as any} recyclingKey={`${p.slug}-card`} />
          </Animated.View>
          <LinearGradient
            colors={['rgba(20,12,7,0.02)','rgba(20,12,7,0)','rgba(20,12,7,0.22)']}
            locations={[0,.55,1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {!reduced&&(
            <Animated.View
              pointerEvents="none"
              style={[
                st.lightSweep,
                {
                  height:imgH*1.45,
                  opacity:reveal.interpolate({inputRange:[0,.18,.72,1],outputRange:[0,.3,.12,0]}),
                  transform:[
                    {translateX:reveal.interpolate({inputRange:[0,1],outputRange:[-80,width+80]})},
                    {rotate:'14deg'},
                  ],
                },
              ]}
            />
          )}
          {!!p.old && p.old > p.price && (
            <View style={st.saleTag}>
              <Text style={st.saleTagT}>-{Math.round((1 - p.price / p.old) * 100)}%</Text>
            </View>
          )}
          </View>
          <View style={st.meta}>
            <Text style={st.nm} numberOfLines={2}>{p.name}</Text>
            <Price value={p.price} old={p.old} size={13} />
            {!!displayReason && (
              <View style={st.reasonPill}>
                <Text style={st.reasonSpark}>✦</Text>
                <Text style={st.reason} numberOfLines={1}>{displayReason}</Text>
              </View>
            )}
          </View>
        </PressScale>
        {/* Nút tim nằm ngoài PressScale: nó có hành động riêng, không nên bị hiệu
            ứng nhấn của cả thẻ nuốt mất. */}
        <View style={[st.heartWrap,{ height:imgH }]} pointerEvents="box-none">
          <Heart slug={p.slug} />
        </View>
      </View>
    </FadeSlideIn>
  );
});
ProductCard.displayName = 'ProductCard';

const st = StyleSheet.create({
  card:{ backgroundColor:C.card, borderRadius:18, borderWidth:1, borderColor:C.line, overflow:'hidden', elevation:2, shadowColor:'#111', shadowOpacity:.055, shadowRadius:8, shadowOffset:{width:0,height:3} },
  tile:{ overflow:'hidden', backgroundColor:C.washi2, position:'relative' },
  lightSweep:{ position:'absolute', top:-34, left:-42, width:44, backgroundColor:'rgba(255,255,255,0.48)' },
  heartWrap:{ position:'absolute', top:0, left:0, right:0 },
  heart:{ position:'absolute', top:8, right:8, width:44, height:44, borderRadius:22, backgroundColor:'rgba(255,255,255,0.96)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(17,17,17,0.08)' },
  saleTag:{ position:'absolute', top:10, left:10, backgroundColor:C.shu, borderRadius:7, paddingHorizontal:7, paddingVertical:4 },
  saleTagT:{ color:'#fff', fontFamily:F.bodyX, fontSize:10 },
  meta:{ minHeight:101, paddingHorizontal:10, paddingTop:9, paddingBottom:10 },
  nm:{ minHeight:34, fontFamily:F.bodyB, fontSize:12.5, lineHeight:17, color:C.ink, marginBottom:3 },
  reasonPill:{ alignSelf:'flex-start', maxWidth:'100%', flexDirection:'row', alignItems:'center', gap:4, marginTop:6, borderRadius:999, backgroundColor:C.washi2, paddingVertical:3, paddingHorizontal:7 },
  reasonSpark:{ color:C.shu, fontFamily:F.bodyB, fontSize:9 },
  reason:{ flexShrink:1, fontFamily:F.bodyM, fontSize:9.5, color:C.ink },
});
