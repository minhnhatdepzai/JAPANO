import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, Pressable, Dimensions, ActivityIndicator, Modal, PanResponder, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, F, money } from '../../theme/tokens';
import { Btn, SectionHeader, Price, TagK } from '../../components/ui';
import { PRODUCTS, Product, storyFor, variantPrice, variantOldPrice, priceRange } from '../../lib/catalog';
import { useStore } from '../../lib/store';
import { getFulfillmentPolicy, getOutfitFor, getProductAiDescription, getProductReviews, getRelatedProducts, getShop, OutfitSet, ProductAiDescription, ProductReviews, reactToReview, trackInteraction } from '../../lib/api';
import { SmartImage } from '../../components/SmartImage';
import { useAuth } from '../../lib/auth';
import { ResizeMode, Video } from 'expo-av';
import { ReviewMediaPlayer } from '../../components/MediaAttach';
import { prefecturesForProduct, spotsForProduct } from '../../lib/japanSpots';
import { useReduceMotion } from '../../components/motion';

const W = Dimensions.get('window').width;
const COLORS = [
  { hex:C.ink, name:'Mực' }, { hex:'#A33A2F', name:'Đỏ son' },
  { hex:'#243244', name:'Chàm' }, { hex:'#6B7255', name:'Xanh trà' }, { hex:C.ink, name:'Vàng kim' },
];
const DEFAULT_SIZES = ['S','M','L','XL','XXL','XXXL','4XL','5XL'];

function KenBurnsImage({ source, style, recyclingKey }:{ source:any; style:any; recyclingKey?:string }) {
  const t = useRef(new Animated.Value(0)).current;
  const reduced = useReduceMotion();
  useEffect(() => {
    if(reduced){t.setValue(0);return;}
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue:1, duration:7000, useNativeDriver:true }),
      Animated.timing(t, { toValue:0, duration:7000, useNativeDriver:true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced,t]);
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

const ZOOM_MIN = 1, ZOOM_MAX = 3, ZOOM_STEP = 0.5;
function ImageZoomModal({ visible, source, onClose }:{ visible:boolean; source:any; onClose:()=>void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(1);
  const offset = useRef({ x:0, y:0 });
  const [level,setLevel] = useState(1);

  const resetZoom = () => {
    scaleValue.current = 1; setLevel(1); offset.current = { x:0, y:0 };
    scale.setValue(1); translateX.setValue(0); translateY.setValue(0);
  };
  useEffect(() => { if (visible) resetZoom(); }, [visible, source]);

  const applyZoom = (next:number) => {
    scaleValue.current = next; setLevel(next);
    Animated.timing(scale, { toValue:next, duration:160, useNativeDriver:true }).start();
    if (next<=1) {
      offset.current = { x:0, y:0 };
      Animated.parallel([
        Animated.timing(translateX, { toValue:0, duration:160, useNativeDriver:true }),
        Animated.timing(translateY, { toValue:0, duration:160, useNativeDriver:true }),
      ]).start();
    }
  };
  const zoomIn = () => applyZoom(Math.min(ZOOM_MAX, Math.round((scaleValue.current+ZOOM_STEP)*10)/10));
  const zoomOut = () => applyZoom(Math.max(ZOOM_MIN, Math.round((scaleValue.current-ZOOM_STEP)*10)/10));

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder:(_,g)=>scaleValue.current>1 && (Math.abs(g.dx)>3||Math.abs(g.dy)>3),
    onPanResponderMove:(_,g)=>{ translateX.setValue(offset.current.x+g.dx); translateY.setValue(offset.current.y+g.dy); },
    onPanResponderRelease:(_,g)=>{ offset.current = { x:offset.current.x+g.dx, y:offset.current.y+g.dy }; },
  })).current;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={zst.backdrop}>
        <Pressable accessibilityLabel="Đóng ảnh phóng to" style={zst.close} onPress={onClose}><Ionicons name="close" size={24} color="#fff" /></Pressable>
        <View style={zst.stage} {...panResponder.panHandlers}>
          <Animated.View style={{ transform:[{ scale },{ translateX },{ translateY }] }}>
            <SmartImage source={source} style={{ width:W, height:W }} contentFit="contain" recyclingKey="zoom-view" />
          </Animated.View>
        </View>
        <View style={zst.controls}>
          <Pressable accessibilityLabel="Thu nhỏ" style={[zst.zoomBtn,level<=ZOOM_MIN&&{opacity:.4}]} disabled={level<=ZOOM_MIN} onPress={zoomOut}><Ionicons name="remove" size={26} color="#fff" /></Pressable>
          <Text style={zst.zoomLabel}>{Math.round(level*100)}%</Text>
          <Pressable accessibilityLabel="Phóng to" style={[zst.zoomBtn,level>=ZOOM_MAX&&{opacity:.4}]} disabled={level>=ZOOM_MAX} onPress={zoomIn}><Ionicons name="add" size={26} color="#fff" /></Pressable>
        </View>
      </View>
    </Modal>
  );
}
const zst = StyleSheet.create({
  backdrop:{ flex:1, backgroundColor:'#000' },
  close:{ position:'absolute', top:46, right:18, zIndex:5, width:42, height:42, borderRadius:21, backgroundColor:'rgba(255,255,255,0.18)', alignItems:'center', justifyContent:'center' },
  stage:{ flex:1, alignItems:'center', justifyContent:'center', overflow:'hidden' },
  controls:{ position:'absolute', bottom:44, left:0, right:0, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:20 },
  zoomBtn:{ width:52, height:52, borderRadius:26, backgroundColor:'rgba(255,255,255,0.18)', alignItems:'center', justifyContent:'center' },
  zoomLabel:{ color:'#fff', fontFamily:F.bodyB, fontSize:13, minWidth:50, textAlign:'center' },
});

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
  // Địa điểm Nhật Bản hợp với đúng món này. Bảng SPOTS là nguồn duy nhất, nên
  // trang sản phẩm và màn Khám phá không thể mô tả lệch nhau.
  const japanSpots = useMemo(()=>spotsForProduct(p.slug),[p.slug]);
  const japanPrefectures = useMemo(()=>prefecturesForProduct(p.slug),[p.slug]);
  const isNew = (p.sold||0) < 10;
  const isHandmade = /thủ công/i.test(story.craftText);
  const badgeLabel = [isNew && 'MỚI', isHandmade && 'MAY THỦ CÔNG'].filter(Boolean).join(' · ');
  const variants = p.variants || [];
  const hasVariants = variants.length > 0;
  const variantColors = useMemo(() => {
    const seen = new Set<string>();
    const list: { name:string; hex:string }[] = [];
    variants.forEach(v => {
      const name = String(v.colorName || 'Mặc định');
      if (seen.has(name)) return;
      seen.add(name);
      list.push({ name, hex: String(v.colorHex || C.ink) });
    });
    return list;
  }, [variants]);
  const colorOptions = hasVariants ? variantColors : COLORS;
  const sizeOrder = (s:string) => { const i = DEFAULT_SIZES.indexOf(s); return i===-1 ? 999 : i; };
  const sizesFor = (name:string) => {
    if (!hasVariants) return productSizes.map(s=>({ size:s, stock:null as number|null }));
    const forColor = variants.filter(v=>String(v.colorName||'Mặc định')===name);
    const source = forColor.length ? forColor : variants;
    const bySize = new Map<string, number>();
    source.forEach(v => { const s = String(v.size||'M'); bySize.set(s, (bySize.get(s)||0) + Math.max(0, Number(v.stock)||0)); });
    return [...bySize.entries()].map(([size,stock])=>({ size, stock })).sort((a,b)=>sizeOrder(a.size)-sizeOrder(b.size));
  };
  const bestSizeFor = (name:string) => {
    const options = sizesFor(name);
    const inStock = options.find(o=>o.stock===null || o.stock>0);
    return (inStock || options[0])?.size || 'M';
  };
  const [colorName, setColorName] = useState(()=>colorOptions[0]?.name || 'Mặc định');
  const [size, setSize] = useState(()=>bestSizeFor(colorOptions[0]?.name || 'Mặc định'));
  const selectColor = (name:string) => { setColorName(name); setSize(bestSizeFor(name)); };
  const currentSizes = sizesFor(colorName);
  const currentStock = hasVariants ? (currentSizes.find(s=>s.size===size)?.stock ?? 0) : null;
  const outOfStock = hasVariants && currentStock === 0;
  const chosenSize = size;
  // Giá bám theo lựa chọn hiện tại; đổi màu hoặc kích cỡ là số tiền đổi theo.
  const shownPrice = useMemo(()=>variantPrice(p, colorName, size), [p, colorName, size]);
  const shownOld = useMemo(()=>variantOldPrice(p, colorName, size), [p, colorName, size]);
  const variesByVariant = useMemo(()=>priceRange(p).varies, [p]);
  const [page, setPage] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const related = PRODUCTS.filter(x=>x.cat===p.cat && x.slug!==p.slug).slice(0,4);
  const fallbackRel = related.length? related : PRODUCTS.filter(x=>x.slug!==p.slug).slice(0,4);
  const [relatedSlugs,setRelatedSlugs] = useState<string[]|null>(null);
  const [outfit,setOutfit] = useState<OutfitSet|null>(null);
  const [aiDescription,setAiDescription] = useState<ProductAiDescription|null>(null);
  const [aiLoading,setAiLoading] = useState(true);
  const isVisionDescription = aiDescription?.engine === 'thi-giac-san-pham' || aiDescription?.engine === 'qwen3-vl:8b';
  const [reviewData,setReviewData]=useState<ProductReviews|null>(null);
  // Phí giao và số ngày đổi/trả lấy từ máy chủ, không ghi cứng — cửa hàng đổi
  // chính sách một chỗ là mọi màn hình đổi theo. Chưa tải xong thì để '—' thay
  // vì đoán một con số, vì đây chính là con số khách dựa vào để quyết định.
  const [shipFee,setShipFee]=useState<number|null>(null);
  const [returnDays,setReturnDays]=useState(30);
  const loadReviews=()=>getProductReviews(p.slug,user?.id||'').then(setReviewData).catch(()=>setReviewData(null));
  useEffect(()=>{
    let live=true;
    void getRelatedProducts(p.slug,8).then(slugs=>{if(live)setRelatedSlugs(slugs);}).catch(()=>undefined);
    void getOutfitFor(p.slug).then(set=>{if(live)setOutfit(set);}).catch(()=>undefined);
    setAiLoading(true);
    void getProductAiDescription(p.slug).then(data=>{if(live)setAiDescription(data);}).catch(()=>undefined).finally(()=>{if(live)setAiLoading(false);});
    void getProductReviews(p.slug,user?.id||'').then(data=>{if(live)setReviewData(data);}).catch(()=>undefined);
    void getShop().then(shop=>{if(live&&Number.isFinite(Number(shop?.shipFee)))setShipFee(Number(shop.shipFee));}).catch(()=>undefined);
    void getFulfillmentPolicy().then(policy=>{const days=Number(policy?.timers?.returnWindowDays);if(live&&days>0)setReturnDays(days);}).catch(()=>undefined);
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
  const shareProduct=()=>void Share.share({
    title:p.name,
    message:`${p.name} · ${money(shownPrice)} tại JAPANO`,
  });
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
            <Pressable accessibilityLabel="Phóng to ảnh sản phẩm" style={st.round} onPress={()=>setZoomOpen(true)}><Ionicons name="search" size={20} color="#fff" /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={wished?'Bỏ khỏi danh sách yêu thích':'Thêm vào danh sách yêu thích'} accessibilityState={{selected:wished}} style={st.round} onPress={()=>toggleWish(p.slug)}><Ionicons name={wished?'heart':'heart-outline'} size={20} color="#fff" /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Chia sẻ sản phẩm" style={st.round} onPress={shareProduct}><Ionicons name="share-social-outline" size={20} color="#fff" /></Pressable>
          </View>
          {!!badgeLabel && <View style={st.flag}><Text style={{ color:'#fff', fontFamily:F.bodyX, fontSize:10 }}>{badgeLabel}</Text></View>}
          {media.length>1 && (
            <View style={st.dots}>
              {media.map((_,i)=>(<View key={i} style={[st.dot, i===page&&{ width:22, backgroundColor:C.primary }]} />))}
            </View>
          )}
        </View>
        <ImageZoomModal visible={zoomOpen} source={media[page]?.kind==='image'?media[page].source:p.images[0]} onClose={()=>setZoomOpen(false)} />

        <View style={{ paddingHorizontal:18, paddingTop:14 }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
            <View style={{ flex:1, paddingRight:10 }}>
              <Text style={{ fontFamily:F.displaySb, color:C.kin, letterSpacing:2, fontSize:10 }}>TRANG PHỤC NHẬT · JAPANO</Text>
              <Text style={{ fontFamily:F.display, fontSize:22, color:C.sumi, marginTop:3 }}>{p.name}</Text>
            </View>
            {/* Giá đi theo đúng màu + kích cỡ khách đang chọn — biến thể có
                giá riêng thì hiện giá riêng (xem lib/catalog.ts::variantPrice). */}
            <View style={{ alignItems:'flex-end' }}>
              <Price value={shownPrice} old={shownOld} size={19} />
              {variesByVariant && (
                <Text style={{ fontFamily:F.body, fontSize:10.5, color:C.muted, marginTop:2 }}>
                  giá thay đổi theo màu/kích cỡ
                </Text>
              )}
            </View>
          </View>
          <Text style={{ fontFamily:F.body, fontSize:12.5, color:C.muted, marginTop:8 }}>{reviewData?.summary.count?<><Text style={{color:C.kin}}>★</Text> <Text style={{color:C.ink,fontFamily:F.bodyB}}>{reviewData.summary.average}</Text> · {reviewData.summary.count} đánh giá đã xác minh</>:<>Chưa có đánh giá</>} · {p.sold||0} đã bán</Text>

          <View style={st.aiCard}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
              <View style={st.aiIcon}><Ionicons name="eye-outline" size={18} color="#fff" /></View>
              <View style={{ flex:1 }}>
                <Text style={st.aiLabel}>GỢI Ý PHONG CÁCH JAPANO</Text>
                <Text style={st.aiEngine}>{isVisionDescription ? 'Phân tích từ hình ảnh và thông tin sản phẩm' : 'Tóm tắt từ thông tin sản phẩm đã xác nhận'}</Text>
              </View>
            </View>
            {aiLoading ? (
              <View style={{ flexDirection:'row', alignItems:'center', gap:8, paddingVertical:12 }}>
                <ActivityIndicator size="small" color={C.ink} />
                <Text style={st.aiMuted}>Đang chuẩn bị gợi ý phối đồ dành cho bạn…</Text>
              </View>
            ) : aiDescription ? (
              <>
                <Text style={st.aiHeadline}>{aiDescription.headline}</Text>
                <Text style={st.aiBody}>{aiDescription.visualSummary}</Text>
                {aiDescription.details.slice(0,3).map((detail,index)=><Text key={index} style={st.aiBullet}>• {detail}</Text>)}
                <View style={st.aiTip}><Text style={st.aiTipTitle}>Cách phối</Text><Text style={st.aiBody}>{aiDescription.stylingTip}</Text></View>
                <Text style={st.aiReason}>{aiDescription.purchaseReason}</Text>
                {!isVisionDescription && <Text style={[st.aiMuted,{ marginTop:8 }]}>Gợi ý dựa trên tên, danh mục và mô tả đã được cửa hàng xác nhận.</Text>}
              </>
            ) : <Text style={st.aiMuted}>Chưa tải được mô tả tự động; thông tin bên dưới vẫn dùng dữ liệu sản phẩm đã xác nhận.</Text>}
            <Pressable style={st.goalLink} onPress={()=>openMemberRoute({ pathname:'/goals', params:{ productId:p.slug } } as any)}>
              <Ionicons name="flag-outline" size={16} color={C.ink} />
              <Text style={st.goalLinkText}>Lưu vào mục tiêu mua sắm</Text>
              <Ionicons name="chevron-forward" size={16} color={C.ink} />
            </Pressable>
          </View>

          {/* colors */}
          <Text style={st.lbl}>Màu sắc</Text>
          <View style={{ flexDirection:'row', gap:10, marginTop:8, flexWrap:'wrap' }}>
            {colorOptions.map((c)=>{
              const total = hasVariants ? sizesFor(c.name).reduce((sum,o)=>sum+(o.stock||0),0) : null;
              const empty = total===0;
              return (
                  <Pressable key={c.name} accessibilityRole="button" accessibilityLabel={`Màu ${c.name}${empty?', đã hết hàng':''}`} accessibilityState={{selected:colorName===c.name,disabled:empty}} onPress={()=>selectColor(c.name)} style={[st.sw,{ backgroundColor:c.hex }, colorName===c.name&&st.swSel, empty&&st.swEmpty]}>
                  {colorName===c.name && <Ionicons name="checkmark" size={14} color="#fff" />}
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontFamily:F.body, fontSize:11, color:C.muted, marginTop:6 }}>Mã màu đang chọn: <Text style={{ color:C.ink, fontFamily:F.bodyB }}>{colorOptions.find(c=>c.name===colorName)?.hex} · {colorName}</Text></Text>

          {/* sizes */}
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:16 }}>
            <Text style={{ fontFamily:F.bodyB, fontSize:13, color:C.ink }}>Kích thước</Text>
            <Pressable onPress={()=>openMemberRoute({ pathname:'/tryon', params:{ productId:p.slug, color:colorName, size:chosenSize } } as any)}><Text style={{ fontFamily:F.bodyB, fontSize:11.5, color:C.ink }}>Gợi ý kích cỡ cho tôi →</Text></Pressable>
          </View>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:8 }}>
            {currentSizes.map((s)=>{
              const soldOut = s.stock===0;
              return (
                <Pressable key={s.size} accessibilityRole="button" accessibilityLabel={`Kích thước ${s.size}${soldOut?', đã hết hàng':s.stock!==null?`, còn ${s.stock}`:''}`} accessibilityState={{selected:size===s.size,disabled:soldOut}} disabled={soldOut} onPress={()=>setSize(s.size)} style={{ alignItems:'center' }}>
                  <View style={[st.size, size===s.size&&st.sizeSel, soldOut&&st.sizeOff]}>
                    <Text style={{ fontFamily:F.bodyB, fontSize:13, color:soldOut?C.muted:(size===s.size?'#fff':C.ink), textDecorationLine:soldOut?'line-through':'none' }}>{s.size}</Text>
                  </View>
                  {s.stock!==null && (
                    <Text style={{ fontFamily:F.body, fontSize:9.5, marginTop:3, color:soldOut?C.danger:(s.stock<=5?C.danger:C.muted) }}>{soldOut?'Hết':`còn ${s.stock}`}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
          {hasVariants && (
            <Text style={{ fontFamily:F.bodyM, fontSize:12, marginTop:8, color:outOfStock?C.danger:(currentStock!==null && currentStock<=5?C.danger:C.ok) }}>
              {outOfStock ? 'Hết hàng ở lựa chọn này — vui lòng chọn màu/kích thước khác' : `Còn lại ${currentStock} sản phẩm cho lựa chọn này`}
            </Text>
          )}

          {/* Chi phí và điều kiện đổi trả, nói TRƯỚC khi khách vào giỏ.
              Nguyên nhân bỏ giỏ hàng được ghi nhận nhiều nhất là phát sinh phí
              bất ngờ ở bước thanh toán (Baymard). Phí giao và cửa sổ đổi/trả
              của JAPANO trước đây chỉ xuất hiện ở màn thanh toán và trang chính
              sách — tức là khách chỉ biết sau khi đã chọn xong hàng. */}
          <View style={st.trust}>
            <View style={st.trustRow}>
              <Ionicons name="cube-outline" size={15} color={C.ai} />
              <Text style={st.trustT}>
                Phí giao hàng {shipFee === null ? '—' : shipFee === 0 ? 'miễn phí' : money(shipFee)}
                {shipFee ? ' · tính một lần cho cả đơn' : ''}
              </Text>
            </View>
            <View style={st.trustRow}>
              <Ionicons name="refresh-outline" size={15} color={C.ai} />
              <Text style={st.trustT}>Đổi/trả trong {returnDays} ngày kể từ khi bạn xác nhận đã nhận hàng</Text>
            </View>
            <View style={st.trustRow}>
              <Ionicons name="shield-checkmark-outline" size={15} color={C.ai} />
              <Text style={st.trustT}>Thanh toán COD, thẻ Stripe hoặc VNPay — hoàn tiền về đúng phương thức đã trả</Text>
            </View>
            <Pressable onPress={()=>router.push('/policy' as any)} hitSlop={8}>
              <Text style={st.trustLink}>Xem đầy đủ quy trình giao – nhận – đổi/trả →</Text>
            </Pressable>
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

          {/* Món đồ gắn với địa điểm có thật, không phải một câu quảng cáo chung.
              Mỗi dòng lấy thẳng từ bảng SPOTS nên giờ chụp và lời khuyên luôn
              khớp với những gì màn Khám phá Nhật Bản đang hiển thị. */}
          {japanSpots.length>0 && (
            <>
              <SectionHeader kanji="旅" label="Mặc bộ này ở đâu trên đất Nhật" action={`${japanSpots.length} nơi`} />
              <Text style={st.p}>
                {japanSpots.length===1
                  ? `Bộ này hợp nhất với một địa điểm trong hành trình JAPANO — ${japanSpots[0].place} (${japanSpots[0].prefecture}).`
                  : `Bộ này hợp với ${japanSpots.length} địa điểm ở ${japanPrefectures.join(', ')}. Mỗi nơi một khung giờ và một kiểu ánh sáng khác nhau.`}
              </Text>
              {japanSpots.map(spot=>(
                <Pressable key={spot.place} style={st.tripRow} onPress={()=>router.push('/explore-japan')}>
                  <SmartImage source={{ uri: spot.photoUrl }} style={st.tripImg} recyclingKey={`trip-${spot.place}`} />
                  <View style={{ flex:1 }}>
                    <Text style={st.tripPlace}>{spot.place}</Text>
                    <Text style={st.tripMeta}>{spot.prefecture} · {spot.time}</Text>
                    <Text style={st.tripTip}>{spot.tip}</Text>
                    <Text style={st.tripSpot} numberOfLines={2}>Góc đẹp nhất: {spot.photoSpots[0]?.name} — {spot.photoSpots[0]?.tip}</Text>
                  </View>
                </Pressable>
              ))}
              <Btn label="Mở Khám phá Nhật Bản" variant="ghost" style={{ marginTop:10 }} onPress={()=>router.push('/explore-japan')} />
            </>
          )}

          {/* AI ghép đồ: hoà sắc + tương đồng chủ đề + xu hướng */}
          {outfitItems.length>1 && (
            <>
              <SectionHeader kanji="組" label="Phối cùng bộ này" action={`~${money(outfit?.totalPrice||0)}`} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:12 }}>
                {outfitItems.map(item=>(
                  <Pressable key={item.slug} style={{ width:120 }} onPress={()=>router.push(`/product/${item.slug}`)}>
                    <SmartImage source={item.images[0]} style={{ width:'100%', height:150, borderRadius:12, borderWidth:item.slug===p.slug?2:0, borderColor:C.primary }} recyclingKey={`${item.slug}-outfit`} />
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
          {(reviewData?.reviews||[]).map(review=><View style={st.review} key={review.id}><View style={{flexDirection:'row',justifyContent:'space-between'}}><View><Text style={{fontFamily:F.bodyB,fontSize:13,color:C.ink}}>{review.userName}</Text><Text style={{fontFamily:F.bodyM,fontSize:10,color:C.ok}}>✓ Đã mua hàng</Text></View><Text style={{color:C.kin,fontSize:12}}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</Text></View><Text style={{fontFamily:F.body,fontSize:12.5,color:C.ink,marginTop:7,lineHeight:20}}>{review.comment}</Text><ReviewMediaPlayer media={review.media} /><View style={{flexDirection:'row',gap:8,marginTop:9}}><Pressable style={[st.reaction,review.myReaction==='helpful'&&st.reactionOn]} onPress={()=>void react(review.id,'helpful')}><Text style={st.reactionText}>👍 Hữu ích {review.helpful}</Text></Pressable><Pressable style={[st.reaction,review.myReaction==='not_helpful'&&st.reactionOn]} onPress={()=>void react(review.id,'not_helpful')}><Text style={st.reactionText}>👎 Chưa hữu ích {review.notHelpful}</Text></Pressable></View></View>)}
        </View>
      </ScrollView>

      {/* sticky bar */}
      <View style={st.sticky}>
        <View style={st.stickyTryOn}><Btn label="Thử trên ảnh" icon="shirt-outline" variant="ghost" style={st.stickyButton} onPress={()=>openMemberRoute({ pathname:'/tryon', params:{ productId:p.slug, color:colorName, size:chosenSize } } as any)} /></View>
        <View style={st.stickyCart}><Btn label={outOfStock?'Hết hàng':'Thêm vào giỏ'} icon="bag-outline" variant="ink" disabled={outOfStock} style={st.stickyButton} onPress={()=>addToCart(p.slug, colorName, chosenSize)} /></View>
      </View>
    </View>
  );
}
const st = StyleSheet.create({
  round:{ width:46, height:46, borderRadius:23, backgroundColor:'rgba(26,20,16,0.9)', borderWidth:2, borderColor:'rgba(255,255,255,0.9)', alignItems:'center', justifyContent:'center', elevation:6, shadowColor:'#000', shadowOpacity:.28, shadowRadius:8, shadowOffset:{width:0,height:3} },
  trust:{ marginTop:14, backgroundColor:C.aiSoft, borderRadius:12, padding:12, gap:8 },
  trustRow:{ flexDirection:'row', alignItems:'flex-start', gap:8 },
  trustT:{ flex:1, fontFamily:F.body, fontSize:11.5, color:C.ink, lineHeight:16 },
  trustLink:{ fontFamily:F.bodyB, fontSize:11.5, color:C.ai, marginTop:2 },
  flag:{ position:'absolute', left:14, bottom:14, backgroundColor:C.shu, paddingVertical:2, paddingHorizontal:6, borderRadius:6 },
  dots:{ position:'absolute', bottom:14, right:14, flexDirection:'row', gap:5 },
  dot:{ width:5, height:5, borderRadius:3, backgroundColor:C.card, opacity:0.9 },
  lbl:{ fontFamily:F.bodyB, fontSize:13, color:C.ink, marginTop:16 },
  sw:{ width:34, height:34, borderRadius:9, borderWidth:2, borderColor:'transparent', alignItems:'center', justifyContent:'center' },
  swSel:{ borderColor:C.primary },
  swEmpty:{ opacity:0.3 },
  size:{ width:42, height:42, borderRadius:10, borderWidth:1, borderColor:C.line, backgroundColor:C.card, alignItems:'center', justifyContent:'center' },
  sizeSel:{ backgroundColor:C.inverseSurface, borderColor:C.inverseSurface },
  sizeOff:{ backgroundColor:C.washi2, borderColor:C.line },
  story:{ paddingVertical:14, borderTopWidth:1, borderTopColor:C.hair },
  tripRow:{ flexDirection:'row', gap:12, paddingVertical:11, borderBottomWidth:1, borderBottomColor:C.hair },
  tripImg:{ width:72, height:96, borderRadius:9, backgroundColor:C.washi2 },
  tripPlace:{ fontFamily:F.bodyX, fontSize:13, color:C.ink },
  tripMeta:{ fontFamily:F.body, fontSize:10.5, color:C.muted, marginTop:1 },
  tripTip:{ fontFamily:F.body, fontSize:11.5, lineHeight:17, color:C.ink, marginTop:4 },
  tripSpot:{ fontFamily:F.body, fontSize:10.5, lineHeight:15.5, color:C.muted, marginTop:4 },
  p:{ fontFamily:F.body, fontSize:13, lineHeight:22, color:C.ink },
  spec:{ fontFamily:F.bodyB, fontSize:12, color:C.ink }, specV:{ fontFamily:F.body, fontSize:11, color:C.muted },
  reviewTop:{ flexDirection:'row', gap:14, alignItems:'center', backgroundColor:C.card, borderWidth:1, borderColor:C.line, borderRadius:14, padding:14 },
  barBg:{ flex:1, height:5, backgroundColor:C.hair, borderRadius:3, overflow:'hidden' },
  barFill:{ height:'100%', backgroundColor:C.primary },
  review:{ marginTop:10, backgroundColor:C.card, borderWidth:1, borderColor:C.line, borderRadius:14, padding:12 },
  reaction:{borderWidth:1,borderColor:C.line,borderRadius:999,paddingVertical:6,paddingHorizontal:10,backgroundColor:C.card},reactionOn:{borderColor:C.primary,backgroundColor:C.washi2},reactionText:{fontFamily:F.bodyM,fontSize:10.5,color:C.ink},
  aiCard:{ marginTop:14, backgroundColor:C.card, borderWidth:1, borderColor:'#DAC7BB', borderRadius:16, padding:14 },
  aiIcon:{ width:34, height:34, borderRadius:10, backgroundColor:C.inverseSurface, alignItems:'center', justifyContent:'center' },
  aiLabel:{ fontFamily:F.bodyX, fontSize:10.5, letterSpacing:.7, color:C.sumi },
  aiEngine:{ fontFamily:F.body, fontSize:10.5, color:C.muted, marginTop:1 },
  aiHeadline:{ fontFamily:F.display, fontSize:17, lineHeight:24, color:C.sumi, marginTop:12 },
  aiBody:{ fontFamily:F.body, fontSize:12.5, lineHeight:20, color:C.ink, marginTop:6 },
  aiBullet:{ fontFamily:F.body, fontSize:12, lineHeight:19, color:C.ink, marginTop:4 },
  aiMuted:{ fontFamily:F.body, fontSize:12, lineHeight:18, color:C.muted },
  aiTip:{ backgroundColor:C.washi2, borderRadius:12, padding:10, marginTop:10 },
  aiTipTitle:{ fontFamily:F.bodyX, fontSize:11, color:C.sumi },
  aiReason:{ fontFamily:F.bodyB, fontSize:12.5, lineHeight:20, color:C.shuDeep, marginTop:10 },
  goalLink:{ flexDirection:'row', alignItems:'center', gap:7, borderTopWidth:1, borderTopColor:C.hair, paddingTop:12, marginTop:12 },
  goalLinkText:{ flex:1, fontFamily:F.bodyB, fontSize:12.5, color:C.ink },
  sticky:{ position:'absolute', left:0, right:0, bottom:0, flexDirection:'row', alignItems:'stretch', gap:8, backgroundColor:C.paper, borderTopWidth:1, borderTopColor:C.line, padding:12, paddingBottom:24 },
  stickyTryOn:{ flex:1 },
  stickyCart:{ flex:1.12 },
  stickyButton:{ width:'100%' },
});
