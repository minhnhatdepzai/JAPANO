import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, F, money } from '../../theme/tokens';
import { Btn, SectionHeader, Price, TagK } from '../../components/ui';
import { PRODUCTS, Product, storyFor } from '../../lib/catalog';
import { useStore } from '../../lib/store';
import { getOutfitFor, getProductAiDescription, getProductReviews, getRelatedProducts, OutfitSet, ProductAiDescription, ProductReviews, reactToReview, trackInteraction } from '../../lib/api';
import { SmartImage } from '../../components/SmartImage';
import { useAuth } from '../../lib/auth';
import { ResizeMode, Video } from 'expo-av';

const W = Dimensions.get('window').width;
const COLORS = [
  { hex:'#1A1410', name:'Mực' }, { hex:'#A33A2F', name:'Đỏ son' },
  { hex:'#243244', name:'Chàm' }, { hex:'#6B7255', name:'Xanh trà' }, { hex:'#B08D3C', name:'Vàng kim' },
];
const DEFAULT_SIZES = ['S','M','L','XL','XXL','XXXL','4XL','5XL'];

function KenBurnsImage({ source, style, recyclingKey }:{ source:any; style:any; recyclingKey?:string }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue:1, duration:7000, useNativeDriver:true }),
      Animated.timing(t, { toValue:0, duration:7000, useNativeDriver:true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const scale = t.interpolate({ inputRange:[0,1], outputRange:[1, 1.14] });
  const translateX = t.interpolate({ inputRange:[0,1], outputRange:[0, -16] });
  const translateY = t.interpolate({ inputRange:[0,1], outputRange:[0, 12] });
  return (
    <View style={[style, { overflow:'hidden' }]}>
      <Animated.View style={{ width:'100%', height:'100%', transform:[{ scale }, { translateX }, { translateY }] }}>
        <SmartImage source={source} style={{ width:'100%', height:'100%' }} recyclingKey={recyclingKey} />
      </Animated.View>
    </View>
  );
}

const StoryBlock = ({ kanji: _kanji, title, children }:{kanji:string;title:string;children:React.ReactNode}) => (
  <View style={st.story}>
    <View style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
      <Text style={{ fontFamily:F.display, fontSize:16, color:C.sumi, flex:1 }}>{title}</Text>
    </View>
    {children}
  </View>
);

export default function Detail() {
  const { slug } = useLocalSearchParams<{ slug:string }>();
  const router = useRouter();
  const { isWished, toggleWish, addToCart } = useStore();
  const { user, isAuthenticated, requireAuth } = useAuth();
  const p = PRODUCTS.find(x=>x.slug===slug) || PRODUCTS[0];
  const productSizes = p.sizes?.length ? p.sizes : DEFAULT_SIZES;
  const media = [
    ...p.images.map((source,index)=>({kind:'image' as const,source,index})),
    ...(p.videos||[]).map((video,index)=>({kind:'video' as const,source:typeof video==='string'?video:video.url,index})),
  ];
  const story = storyFor(p.cat);
  const [color, setColor] = useState(0);
  const [size, setSize] = useState(1);
  const chosenSizeIndex = Math.min(size, Math.max(0, productSizes.length-1));
  const chosenSize = productSizes[chosenSizeIndex] || 'M';
  const [page, setPage] = useState(0);
  const related = PRODUCTS.filter(x=>x.cat===p.cat && x.slug!==p.slug).slice(0,4);
  const fallbackRel = related.length? related : PRODUCTS.filter(x=>x.slug!==p.slug).slice(0,4);
  const [relatedSlugs,setRelatedSlugs] = useState<string[]|null>(null);
  const [outfit,setOutfit] = useState<OutfitSet|null>(null);
  const [aiDescription,setAiDescription] = useState<ProductAiDescription|null>(null);
  const [aiLoading,setAiLoading] = useState(true);
  const [reviewData,setReviewData]=useState<ProductReviews|null>(null);
  const loadReviews=()=>getProductReviews(p.slug,user?.id||'').then(setReviewData).catch(()=>setReviewData(null));
  useEffect(()=>{
    let live=true;
    void getRelatedProducts(p.slug,8).then(slugs=>{if(live)setRelatedSlugs(slugs);}).catch(()=>undefined);
    void getOutfitFor(p.slug).then(set=>{if(live)setOutfit(set);}).catch(()=>undefined);
    setAiLoading(true);
    void getProductAiDescription(p.slug).then(data=>{if(live)setAiDescription(data);}).catch(()=>undefined).finally(()=>{if(live)setAiLoading(false);});
    void getProductReviews(p.slug,user?.id||'').then(data=>{if(live)setReviewData(data);}).catch(()=>undefined);
    if(isAuthenticated)void trackInteraction({userId:user!.id,type:'view',productId:p.slug,value:1}).catch(()=>undefined);
    return ()=>{live=false;};
  },[isAuthenticated,p.slug,user]);
  const rel = useMemo(()=>{
    const found=(relatedSlugs||[]).map(s=>PRODUCTS.find(x=>x.slug===s)).filter(Boolean) as Product[];
    return found.length? found : fallbackRel;
  },[relatedSlugs,fallbackRel]);
  const outfitItems = useMemo(()=>(outfit?.items||[]).map(i=>PRODUCTS.find(x=>x.slug===i.slug)).filter(Boolean) as Product[],[outfit]);
  const wished = isAuthenticated && isWished(p.slug);
  const openMemberRoute=(target:any)=>{if(requireAuth(target))router.push(target);};
  const react=async(reviewId:string,value:'helpful'|'not_helpful')=>{if(!requireAuth())return;try{await reactToReview(reviewId,user!.id,value);await loadReviews();}catch{}};

  return (
    <View style={{ flex:1, backgroundColor:C.washi }}>
      <ScrollView contentContainerStyle={{ paddingBottom:80 }} showsVerticalScrollIndicator={false}>
        {/* gallery */}
        <View>
          {media.length>1 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e=>setPage(Math.round(e.nativeEvent.contentOffset.x / W))}>
              {media.map((item,i)=>item.kind==='image'
                ? <SmartImage key={`anh-${i}`} source={item.source} style={{ width:W, height:380 }} recyclingKey={`${p.slug}-gallery-${i}`} />
                : <View key={`video-${i}`} style={{width:W,height:380,backgroundColor:'#111'}}><Video source={{uri:item.source}} style={{width:'100%',height:'100%'}} useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay={page===i} isLooping /></View>)}
            </ScrollView>
          ) : (
            <KenBurnsImage source={p.images[0]} style={{ width:W, height:380 }} recyclingKey={`${p.slug}-gallery-0`} />
          )}
          <Pressable accessibilityLabel="Quay lại" style={[st.round,{ position:'absolute', left:14, top:46 }]} onPress={()=>router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View style={{ position:'absolute', right:14, top:48, flexDirection:'row', gap:8 }}>
            <Pressable style={st.round} onPress={()=>toggleWish(p.slug)}><Ionicons name={wished?'heart':'heart-outline'} size={20} color="#fff" /></Pressable>
            <View style={st.round}><Ionicons name="share-social-outline" size={20} color="#fff" /></View>
          </View>
          <View style={st.flag}><Text style={{ color:'#fff', fontFamily:F.bodyX, fontSize:10 }}>MỚI · MAY THỦ CÔNG</Text></View>
          {media.length>1 && (
            <View style={st.dots}>
              {media.map((_,i)=>(<View key={i} style={[st.dot, i===page&&{ width:22, backgroundColor:C.shu }]} />))}
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal:18, paddingTop:14 }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
            <View style={{ flex:1, paddingRight:10 }}>
              <Text style={{ fontFamily:F.displaySb, color:C.kin, letterSpacing:2, fontSize:10 }}>TRANG PHỤC NHẬT · JAPANO</Text>
              <Text style={{ fontFamily:F.display, fontSize:22, color:C.sumi, marginTop:3 }}>{p.name}</Text>
            </View>
            <Price value={p.price} old={p.old} size={19} />
          </View>
          <Text style={{ fontFamily:F.body, fontSize:12.5, color:C.muted, marginTop:8 }}>{reviewData?.summary.count?<><Text style={{color:C.kin}}>★</Text> <Text style={{color:C.ink,fontFamily:F.bodyB}}>{reviewData.summary.average}</Text> · {reviewData.summary.count} đánh giá đã xác minh</>:<>Chưa có đánh giá</>} · {p.sold||0} đã bán</Text>

          <View style={st.aiCard}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
              <View style={st.aiIcon}><Ionicons name="eye-outline" size={18} color="#fff" /></View>
              <View style={{ flex:1 }}>
                <Text style={st.aiLabel}>TRÍ TUỆ NHÂN TẠO ĐỌC ẢNH SẢN PHẨM</Text>
                <Text style={st.aiEngine}>Đối chiếu ảnh với dữ liệu sản phẩm</Text>
              </View>
            </View>
            {aiLoading ? (
              <View style={{ flexDirection:'row', alignItems:'center', gap:8, paddingVertical:12 }}>
                <ActivityIndicator size="small" color={C.shu} />
                <Text style={st.aiMuted}>Đang đọc ảnh và đối chiếu “{p.name}”…</Text>
              </View>
            ) : aiDescription ? (
              <>
                <Text style={st.aiHeadline}>{aiDescription.headline}</Text>
                <Text style={st.aiBody}>{aiDescription.visualSummary}</Text>
                {aiDescription.details.slice(0,3).map((detail,index)=><Text key={index} style={st.aiBullet}>• {detail}</Text>)}
                <View style={st.aiTip}><Text style={st.aiTipTitle}>Cách phối</Text><Text style={st.aiBody}>{aiDescription.stylingTip}</Text></View>
                <Text style={st.aiReason}>{aiDescription.purchaseReason}</Text>
              </>
            ) : <Text style={st.aiMuted}>Chưa tải được mô tả tự động; thông tin bên dưới vẫn dùng dữ liệu sản phẩm đã xác nhận.</Text>}
            <Pressable style={st.goalLink} onPress={()=>openMemberRoute({ pathname:'/goals', params:{ productId:p.slug } } as any)}>
              <Ionicons name="flag-outline" size={16} color={C.shu} />
              <Text style={st.goalLinkText}>Lập lộ trình để mua món này</Text>
              <Ionicons name="chevron-forward" size={16} color={C.shu} />
            </Pressable>
          </View>

          {/* colors */}
          <Text style={st.lbl}>Màu sắc</Text>
          <View style={{ flexDirection:'row', gap:10, marginTop:8 }}>
            {COLORS.map((c,i)=>(
              <Pressable key={i} onPress={()=>setColor(i)} style={[st.sw,{ backgroundColor:c.hex }, color===i&&st.swSel]}>
                {color===i && <Ionicons name="checkmark" size={14} color="#fff" />}
              </Pressable>
            ))}
          </View>
          <Text style={{ fontFamily:F.body, fontSize:11, color:C.muted, marginTop:6 }}>Mã màu đang chọn: <Text style={{ color:C.ink, fontFamily:F.bodyB }}>{COLORS[color].hex} · {COLORS[color].name}</Text></Text>

          {/* sizes */}
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:16 }}>
            <Text style={{ fontFamily:F.bodyB, fontSize:13, color:C.ink }}>Kích thước</Text>
            <Pressable onPress={()=>openMemberRoute({ pathname:'/tryon', params:{ productId:p.slug, color:COLORS[color].name, size:chosenSize } } as any)}><Text style={{ fontFamily:F.bodyB, fontSize:11.5, color:C.shu }}>Gợi ý kích cỡ cho tôi →</Text></Pressable>
          </View>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:8 }}>
            {productSizes.map((s,i)=>(
              <Pressable key={s} onPress={()=>setSize(i)} style={[st.size, chosenSizeIndex===i&&st.sizeSel]}>
                <Text style={{ fontFamily:F.bodyB, fontSize:13, color:chosenSizeIndex===i?'#fff':C.ink }}>{s}</Text>
              </Pressable>
            ))}
          </View>

          {/* CULTURE */}
          <SectionHeader kanji="物語" label={story.title} />
          <StoryBlock kanji={story.kanji} title="Nguồn gốc & ý nghĩa">
            <Text style={st.p}>{story.text}</Text>
          </StoryBlock>
          <StoryBlock kanji="粋" title={story.ikiTitle}>
            <Text style={st.p}>{story.ikiText}</Text>
            <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>{story.tags.map(t=><TagK key={t} label={t} />)}</View>
          </StoryBlock>
          <StoryBlock kanji="職人" title="Chất liệu & thủ công">
            <Text style={st.p}>{story.craftText}</Text>
            <View style={{ flexDirection:'row', gap:16, marginTop:10 }}>
              <View><Text style={st.spec}>🧵 Vải</Text><Text style={st.specV}>{story.material}</Text></View>
              <View><Text style={st.spec}>🎐 Nhuộm</Text><Text style={st.specV}>{story.nhuom}</Text></View>
              <View><Text style={st.spec}>💧 Giặt</Text><Text style={st.specV}>{story.giat}</Text></View>
            </View>
          </StoryBlock>

          {/* AI ghép đồ: hoà sắc + tương đồng chủ đề + xu hướng */}
          {outfitItems.length>1 && (
            <>
              <SectionHeader kanji="組" label="Phối cùng bộ này" action={`~${money(outfit?.totalPrice||0)}`} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:12 }}>
                {outfitItems.map(item=>(
                  <Pressable key={item.slug} style={{ width:120 }} onPress={()=>router.push(`/product/${item.slug}`)}>
                    <SmartImage source={item.images[0]} style={{ width:'100%', height:150, borderRadius:12, borderWidth:item.slug===p.slug?2:0, borderColor:C.shu }} recyclingKey={`${item.slug}-outfit`} />
                    <Text style={{ fontFamily:F.bodyB, fontSize:12, color:C.ink, marginTop:6 }} numberOfLines={1}>{item.name}</Text>
                    <Price value={item.price} size={12} />
                  </Pressable>
                ))}
              </ScrollView>
              <Btn label="Thêm cả bộ vào giỏ" variant="ghost" style={{ marginTop:10 }} onPress={()=>{if(requireAuth())outfitItems.forEach(item=>addToCart(item.slug));}} />
            </>
          )}

          {/* related */}
          <SectionHeader kanji="似" label="Có thể bạn cũng thích" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:12 }}>
            {rel.map(r=>(
              <Pressable key={r.slug} style={{ width:120 }} onPress={()=>router.push(`/product/${r.slug}`)}>
                <SmartImage source={r.images[0]} style={{ width:'100%', height:150, borderRadius:12 }} recyclingKey={`${r.slug}-related`} />
                <Text style={{ fontFamily:F.bodyB, fontSize:12, color:C.ink, marginTop:6 }} numberOfLines={1}>{r.name}</Text>
                <Price value={r.price} size={12} />
              </Pressable>
            ))}
          </ScrollView>

          {/* reviews */}
          <SectionHeader kanji="評" label="Đánh giá đã xác minh" action={reviewData?.summary.count?`${reviewData.summary.count} đánh giá`:undefined} />
          <View style={st.reviewTop}>
            <View style={{ alignItems:'center' }}><Text style={{ fontFamily:F.display, fontSize:30, color:C.sumi }}>{reviewData?.summary.count?reviewData.summary.average:'—'}</Text><Text style={{ color:C.kin, fontSize:12 }}>{reviewData?.summary.count?'★★★★★':'Chưa có sao'}</Text></View>
            <View style={{ flex:1, gap:4 }}>
              {[5,4,3,2,1].map((rating)=><View key={rating} style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                  <Text style={{ fontSize:11, color:C.muted }}>{rating}★</Text>
                  <View style={st.barBg}><View style={[st.barFill,{ width:`${reviewData?.summary.count?Math.round((reviewData.summary.distribution.find(item=>item.rating===rating)?.count||0)/reviewData.summary.count*100):0}%` }]} /></View>
                </View>
              )}
            </View>
          </View>
          {!reviewData?.reviews.length&&<View style={st.review}><Text style={{fontFamily:F.body,fontSize:12.5,lineHeight:19,color:C.muted,textAlign:'center'}}>Chưa có bình luận thực tế. Chỉ khách đã mua và nhận hàng mới có thể đánh giá.</Text></View>}
          {(reviewData?.reviews||[]).map(review=><View style={st.review} key={review.id}><View style={{flexDirection:'row',justifyContent:'space-between'}}><View><Text style={{fontFamily:F.bodyB,fontSize:13,color:C.ink}}>{review.userName}</Text><Text style={{fontFamily:F.bodyM,fontSize:10,color:C.ok}}>✓ Đã mua hàng</Text></View><Text style={{color:C.kin,fontSize:12}}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</Text></View><Text style={{fontFamily:F.body,fontSize:12.5,color:C.ink,marginTop:7,lineHeight:20}}>{review.comment}</Text><View style={{flexDirection:'row',gap:8,marginTop:9}}><Pressable style={[st.reaction,review.myReaction==='helpful'&&st.reactionOn]} onPress={()=>void react(review.id,'helpful')}><Text style={st.reactionText}>👍 Hữu ích {review.helpful}</Text></Pressable><Pressable style={[st.reaction,review.myReaction==='not_helpful'&&st.reactionOn]} onPress={()=>void react(review.id,'not_helpful')}><Text style={st.reactionText}>👎 Chưa hữu ích {review.notHelpful}</Text></Pressable></View></View>)}
        </View>
      </ScrollView>

      {/* sticky bar */}
      <View style={st.sticky}>
        <Btn label="Thử đồ thông minh" variant="ghost" style={{ flex:1 }} onPress={()=>openMemberRoute({ pathname:'/tryon', params:{ productId:p.slug, color:COLORS[color].name, size:chosenSize } } as any)} />
        <Btn label="Mục tiêu" variant="ink" style={{ flex:1 }} onPress={()=>openMemberRoute({ pathname:'/goals', params:{ productId:p.slug } } as any)} />
        <Btn label="Thêm giỏ" style={{ flex:1.3 }} onPress={()=>addToCart(p.slug, COLORS[color].name, chosenSize)} />
      </View>
    </View>
  );
}
const st = StyleSheet.create({
  round:{ width:46, height:46, borderRadius:23, backgroundColor:'rgba(26,20,16,0.9)', borderWidth:2, borderColor:'rgba(255,255,255,0.9)', alignItems:'center', justifyContent:'center', elevation:6, shadowColor:'#000', shadowOpacity:.28, shadowRadius:8, shadowOffset:{width:0,height:3} },
  flag:{ position:'absolute', left:14, bottom:14, backgroundColor:C.shu, paddingVertical:2, paddingHorizontal:6, borderRadius:6 },
  dots:{ position:'absolute', bottom:14, right:14, flexDirection:'row', gap:5 },
  dot:{ width:5, height:5, borderRadius:3, backgroundColor:'#fff', opacity:0.9 },
  lbl:{ fontFamily:F.bodyB, fontSize:13, color:C.ink, marginTop:16 },
  sw:{ width:34, height:34, borderRadius:9, borderWidth:2, borderColor:'transparent', alignItems:'center', justifyContent:'center' },
  swSel:{ borderColor:C.shu },
  size:{ width:42, height:42, borderRadius:10, borderWidth:1, borderColor:C.line, backgroundColor:'#fff', alignItems:'center', justifyContent:'center' },
  sizeSel:{ backgroundColor:C.sumi, borderColor:C.sumi },
  story:{ paddingVertical:14, borderTopWidth:1, borderTopColor:C.hair },
  p:{ fontFamily:F.body, fontSize:13, lineHeight:22, color:C.ink },
  spec:{ fontFamily:F.bodyB, fontSize:12, color:C.ink }, specV:{ fontFamily:F.body, fontSize:11, color:C.muted },
  reviewTop:{ flexDirection:'row', gap:14, alignItems:'center', backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:14, padding:14 },
  barBg:{ flex:1, height:5, backgroundColor:C.hair, borderRadius:3, overflow:'hidden' },
  barFill:{ height:'100%', backgroundColor:C.shu },
  review:{ marginTop:10, backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:14, padding:12 },
  reaction:{borderWidth:1,borderColor:C.line,borderRadius:999,paddingVertical:6,paddingHorizontal:10,backgroundColor:'#fff'},reactionOn:{borderColor:C.shu,backgroundColor:C.shuSoft},reactionText:{fontFamily:F.bodyM,fontSize:10.5,color:C.ink},
  aiCard:{ marginTop:14, backgroundColor:'#fff', borderWidth:1, borderColor:'#DAC7BB', borderRadius:16, padding:14 },
  aiIcon:{ width:34, height:34, borderRadius:10, backgroundColor:C.ai, alignItems:'center', justifyContent:'center' },
  aiLabel:{ fontFamily:F.bodyX, fontSize:10.5, letterSpacing:.7, color:C.ai },
  aiEngine:{ fontFamily:F.body, fontSize:10.5, color:C.muted, marginTop:1 },
  aiHeadline:{ fontFamily:F.display, fontSize:17, lineHeight:24, color:C.sumi, marginTop:12 },
  aiBody:{ fontFamily:F.body, fontSize:12.5, lineHeight:20, color:C.ink, marginTop:6 },
  aiBullet:{ fontFamily:F.body, fontSize:12, lineHeight:19, color:C.ink, marginTop:4 },
  aiMuted:{ fontFamily:F.body, fontSize:12, lineHeight:18, color:C.muted },
  aiTip:{ backgroundColor:C.aiSoft, borderRadius:12, padding:10, marginTop:10 },
  aiTipTitle:{ fontFamily:F.bodyX, fontSize:11, color:C.ai },
  aiReason:{ fontFamily:F.bodyB, fontSize:12.5, lineHeight:20, color:C.shuDeep, marginTop:10 },
  goalLink:{ flexDirection:'row', alignItems:'center', gap:7, borderTopWidth:1, borderTopColor:C.hair, paddingTop:12, marginTop:12 },
  goalLinkText:{ flex:1, fontFamily:F.bodyB, fontSize:12.5, color:C.shu },
  sticky:{ position:'absolute', left:0, right:0, bottom:0, flexDirection:'row', gap:10, backgroundColor:C.paper, borderTopWidth:1, borderTopColor:C.line, padding:12, paddingBottom:24 },
});
