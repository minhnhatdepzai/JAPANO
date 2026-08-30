import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, TextInput, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../../theme/tokens';
import { ProductCard } from '../../components/ProductCard';
import { CATEGORIES, CAT_LABEL, GARMENT_FILTERS, matchesGarmentFilter, Product } from '../../lib/catalog';
import { useCatalog } from '../../lib/data';
import { logSearch, trackInteraction } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useReduceMotion } from '../../components/motion';

const norm = (s:string)=> s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

// Kho\u1ea3ng c\u00e1ch ch\u1ec9nh s\u1eeda \u2014 cho ph\u00e9p sai/thi\u1ebfu 1-2 k\u00fd t\u1ef1 (g\u00f5 nh\u1ea7m) v\u1eabn ra k\u1ebft qu\u1ea3
// thay v\u00ec ch\u1ec9 kh\u1edbp substring tuy\u1ec7t \u0111\u1ed1i nh\u01b0 tr\u01b0\u1edbc.
function levenshtein(a:string,b:string):number{
  const m=a.length,n=b.length;
  if(!m)return n; if(!n)return m;
  const dp:number[][]=Array.from({length:m+1},()=>new Array(n+1).fill(0));
  for(let i=0;i<=m;i++)dp[i][0]=i;
  for(let j=0;j<=n;j++)dp[0][j]=j;
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)
    dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}
function searchScore(product:Product,queryNorm:string):number{
  if(!queryNorm)return 1;
  const name=norm(product.name);
  const catLabel=norm(CAT_LABEL[product.cat]||'');
  if(name===queryNorm)return 100;
  if(name.startsWith(queryNorm))return 80;
  if(name.includes(queryNorm))return 60;
  if(catLabel.includes(queryNorm))return 40;
  const tokens=queryNorm.split(' ').filter(Boolean);
  const tokenScore=tokens.reduce((sum,token)=>sum+(token.length>=2&&name.includes(token)?15:0),0);
  if(tokenScore>0)return tokenScore;
  // Dung sai g\u00f5 nh\u1ea7m: so t\u1eebng t\u1eeb trong t\u00ean v\u1edbi t\u1eeb kho\u00e1, l\u1ec7ch t\u1ed1i \u0111a 2 k\u00fd t\u1ef1.
  const words=name.split(' ');
  return Math.max(0,...words.map(word=>{
    if(Math.abs(word.length-queryNorm.length)>2)return 0;
    const distance=levenshtein(word,queryNorm);
    return distance<=2?Math.max(0,20-distance*8):0;
  }));
}
const SORTS = [
  { key:'new', label:'M\u1edbi nh\u1ea5t' },
  { key:'price-asc', label:'Gi\u00e1 t\u0103ng d\u1ea7n' },
  { key:'price-desc', label:'Gi\u00e1 gi\u1ea3m d\u1ea7n' },
  { key:'bestseller', label:'B\u00e1n ch\u1ea1y' },
] as const;
type SortKey = typeof SORTS[number]['key'];

function CinematicProductCell({item,index,width,imgH,screenHeight,scrollY}:{
  item:Product;index:number;width:number;imgH:number;screenHeight:number;scrollY:Animated.Value;
}){
  const reduced=useReduceMotion();
  const row=Math.floor(index/2);
  const rowHeight=imgH+78;
  const itemTop=row*rowHeight;
  // Khi một hàng đi vào 1/3 dưới màn hình: ảnh nổi lên, tiến gần camera và rõ
  // dần. Mọi phép biến đổi chạy native; người bật Reduce Motion thấy trạng thái
  // cuối ngay lập tức.
  const enterStart=itemTop-screenHeight*.76;
  const enterEnd=itemTop-screenHeight*.47;
  const reveal=scrollY.interpolate({
    inputRange:[enterStart,Math.max(enterStart+1,enterEnd)],
    outputRange:[0,1],extrapolate:'clamp',
  });
  return (
    <Animated.View style={[
      {width},
      !reduced&&{
        opacity:reveal.interpolate({inputRange:[0,1],outputRange:[.42,1]}),
        transform:[
          {translateY:reveal.interpolate({inputRange:[0,1],outputRange:[34,0]})},
          {scale:reveal.interpolate({inputRange:[0,1],outputRange:[.94,1]})},
        ],
      },
    ]}>
      <ProductCard p={item} index={index} width={width} imgH={imgH}/>
    </Animated.View>
  );
}

export default function Products() {
  const { user, isAuthenticated } = useAuth();
  const { width:screenWidth,height:screenHeight } = useWindowDimensions();
  const scrollY=useRef(new Animated.Value(0)).current;
  const [cat, setCat] = useState('all');
  const [garment, setGarment] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('new');
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Lấy từ context chứ không đọc hằng `PRODUCTS` của module: `setCatalog()` thay
  // giá trị đó SAU khi API trả về, nhưng useMemo đã đóng gói giá trị cũ và không
  // có cớ gì để chạy lại — nên màn hình đứng yên ở danh sách đóng gói sẵn và
  // không thấy sản phẩm nào mới thêm trên backend.
  const { products: catalogProducts } = useCatalog();
  const list = useMemo(()=>{
    let l = cat==='all'? catalogProducts : catalogProducts.filter(p=>p.cat===cat);
    if(garment!=='all') l = l.filter(p=>matchesGarmentFilter(p, garment));
    const query = q.trim();
    if (query) {
      const nq = norm(query);
      l = l.map(p=>({ p, score: searchScore(p, nq) }))
        .filter(x=>x.score>0)
        .sort((a,b)=>b.score-a.score)
        .map(x=>x.p);
    } else {
      l = [...l];
    }
    if (sort==='price-asc') l.sort((a,b)=>a.price-b.price);
    else if (sort==='price-desc') l.sort((a,b)=>b.price-a.price);
    else if (sort==='bestseller') l.sort((a,b)=>b.sold-a.sold);
    return l;
  },[catalogProducts,cat,garment,q,sort]);
  const sortLabel = SORTS.find(s=>s.key===sort)?.label || 'M\u1edbi nh\u1ea5t';
  const cardGap = 12;
  const cardWidth = Math.floor((screenWidth - 36 - cardGap) / 2);
  const keyExtractor = useCallback((p:Product)=>p.slug,[]);
  // FlatList tái sử dụng ô khi cuộn, nên `index` ở đây chỉ dùng để rải nhịp
  // xuất hiện của MÀN HÌNH ĐẦU TIÊN; các hàng cuộn tới sau đều rơi vào trần
  // 8 nhịp nên hiện gần như tức thì, đúng như mong đợi khi đang cuộn nhanh.
  const cardImageHeight=Math.round(cardWidth*1.17);
  const renderItem = useCallback(({ item, index }:{ item:Product; index:number })=>(
    <CinematicProductCell
      item={item} index={index} width={cardWidth} imgH={cardImageHeight}
      screenHeight={screenHeight} scrollY={scrollY}
    />
  ),[cardImageHeight,cardWidth,screenHeight,scrollY]);
  useEffect(()=>{
    const query=q.trim();
    if(query.length<2)return;
    const timer=setTimeout(()=>{
      // Ghi mọi lượt tìm — kể cả 0 kết quả — để thấy nhu cầu khách chưa được
      // đáp ứng (kể cả khách chưa đăng nhập); riêng tín hiệu nuôi engine gợi ý
      // (trackInteraction) vẫn cần user thật và có kết quả để gắn vào sản phẩm.
      void logSearch({userId:user?.id,query,resultCount:list.length}).catch(()=>undefined);
      if(isAuthenticated&&user&&list.length){
        list.slice(0,3).forEach((product,rank)=>{
          void trackInteraction({userId:user.id,type:'search',productId:product.slug,value:1,metadata:{query,rank:rank+1,resultCount:list.length}}).catch(()=>undefined);
        });
      }
    },650);
    return()=>clearTimeout(timer);
  },[isAuthenticated,list,q,user]);
  return (
    <SafeAreaView edges={['top']} style={{ flex:1, backgroundColor:C.washi }}>
      <View style={{ paddingHorizontal:18, paddingTop:8 }}>
        <Text style={st.eyebrow}>BỘ SƯU TẬP JAPANO</Text>
        <Text style={st.title}>Sản phẩm</Text>
        <View style={st.search}>
          <Ionicons name="search" size={18} color={C.muted} />
          <TextInput accessibilityLabel="Tìm sản phẩm" value={q} onChangeText={setQ} placeholder="Tìm kimono, áo khoác, phụ kiện…" placeholderTextColor={C.muted} style={{ flex:1, fontFamily:F.body, fontSize:14, color:C.ink }} />
          {q.length>0 && <Pressable accessibilityRole="button" accessibilityLabel="Xóa nội dung tìm kiếm" onPress={()=>setQ('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={C.muted} /></Pressable>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:9 }} contentContainerStyle={{ gap:8, paddingRight:18 }}>
          {CATEGORIES.map(c=>(
            <Pressable key={c.key} accessibilityRole="button" accessibilityState={{selected:cat===c.key}} style={[st.chip, cat===c.key&&st.chipOn]} onPress={()=>setCat(c.key)}>
              <Text style={{ color:cat===c.key?'#fff':C.ink, fontFamily:F.bodyM, fontSize:12.5 }}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={st.toolsRow}>
          <Text style={{ fontFamily:F.body, fontSize:12.5, color:C.muted }}>{list.length} sản phẩm</Text>
          <View style={st.toolActions}>
            <Pressable accessibilityRole="button" accessibilityState={{expanded:filtersOpen}} accessibilityLabel="Mở bộ lọc kiểu trang phục" style={[st.toolButton,garment!=='all'&&st.toolButtonOn]} onPress={()=>{setFiltersOpen(o=>!o);setSortOpen(false);}}>
              <Ionicons name="options-outline" size={15} color={garment!=='all'?'#fff':C.ink}/>
              <Text style={[st.toolText,garment!=='all'&&{color:'#fff'}]}>Bộ lọc{garment!=='all'?' · 1':''}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{expanded:sortOpen}} accessibilityLabel={`Sắp xếp theo ${sortLabel}`} style={st.toolButton} onPress={()=>{setSortOpen(o=>!o);setFiltersOpen(false);}}>
              <Text style={st.toolText}>{sortLabel}</Text>
            <Ionicons name={sortOpen?'chevron-up':'chevron-down'} size={14} color={C.ink} />
            </Pressable>
          </View>
        </View>
        {filtersOpen && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:8 }} contentContainerStyle={{ gap:8, paddingRight:18 }}>
            <Pressable accessibilityRole="button" accessibilityState={{selected:garment==='all'}} style={[st.chip, garment==='all'&&st.chipOn]} onPress={()=>setGarment('all')}>
              <Text style={{ color:garment==='all'?'#fff':C.ink, fontFamily:F.bodyM, fontSize:12 }}>Mọi kiểu</Text>
            </Pressable>
            {GARMENT_FILTERS.map(f=>(
              <Pressable key={f.key} accessibilityRole="button" accessibilityState={{selected:garment===f.key}} style={[st.chip, garment===f.key&&st.chipOn]} onPress={()=>setGarment(garment===f.key?'all':f.key)}>
                <Text style={{ color:garment===f.key?'#fff':C.ink, fontFamily:F.bodyM, fontSize:12 }}>
                  {f.label}{f.adultOnly?' 18+':''}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {sortOpen && (
          <View style={st.sortMenu}>
            {SORTS.map(s=>(
              <Pressable key={s.key} style={[st.sortOpt, s.key===sort&&{ backgroundColor:C.washi2 }]} onPress={()=>{ setSort(s.key); setSortOpen(false); }}>
                <Text style={{ fontFamily:s.key===sort?F.bodyB:F.body, fontSize:13, color:s.key===sort?C.shuDeep:C.ink }}>{s.label}</Text>
                {s.key===sort && <Ionicons name="checkmark" size={15} color={C.shuDeep} />}
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {/* FlatList thay cho ScrollView+map: chỉ dựng những thẻ đang lọt khung
          nhìn. Danh mục còn nhỏ thì khác biệt chưa rõ, nhưng khi kho hàng lớn
          dần thì cách cũ mount toàn bộ ảnh cùng lúc — vừa giật khi mở tab vừa
          ngốn bộ nhớ ảnh. */}
      <Animated.FlatList
        data={list}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={{ gap:cardGap, justifyContent:'center' }}
        contentContainerStyle={{ paddingHorizontal:18, paddingBottom:24, gap:cardGap }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{nativeEvent:{contentOffset:{y:scrollY}}}],
          {useNativeDriver:true},
        )}
        scrollEventThrottle={16}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={
          <View style={{ alignItems:'center', paddingVertical:50 }}>
            <Ionicons name="search-outline" size={44} color={C.hair} />
            <Text style={{ fontFamily:F.bodyM, fontSize:14, color:C.muted, marginTop:10 }}>Không tìm thấy "{q}"</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
const st = StyleSheet.create({
  eyebrow:{fontFamily:F.bodyM,fontSize:9.5,letterSpacing:1.6,color:C.muted,marginBottom:2},
  title:{fontFamily:F.display,fontSize:24,color:C.sumi,marginBottom:10},
  search:{ flexDirection:'row', alignItems:'center', gap:8, minHeight:48, borderWidth:1, borderColor:C.line, borderRadius:12, backgroundColor:'#fff', paddingHorizontal:13, marginBottom:12 },
  chip:{ borderWidth:1, borderColor:C.line, borderRadius:999, paddingVertical:8, paddingHorizontal:13, backgroundColor:'#fff' },
  chipOn:{ backgroundColor:C.primary, borderColor:C.primary },
  toolsRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10,gap:8},
  toolActions:{flexDirection:'row',alignItems:'center',gap:7},
  toolButton:{minHeight:38,flexDirection:'row',alignItems:'center',gap:5,borderWidth:1,borderColor:C.line,borderRadius:999,backgroundColor:'#fff',paddingHorizontal:11},
  toolButtonOn:{backgroundColor:C.primary,borderColor:C.primary},
  toolText:{fontFamily:F.bodyM,fontSize:11.5,color:C.ink},
  sortMenu:{ borderWidth:1, borderColor:C.line, borderRadius:12, backgroundColor:'#fff', marginBottom:10, overflow:'hidden' },
  sortOpt:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:11, paddingHorizontal:14, borderTopWidth:1, borderTopColor:C.hair },
});
