import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../../theme/tokens';
import { ProductCard } from '../../components/ProductCard';
import { PRODUCTS, CATEGORIES } from '../../lib/catalog';
import { trackInteraction } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const norm = (s:string)=> s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const SORTS = [
  { key:'new', label:'M\u1edbi nh\u1ea5t' },
  { key:'price-asc', label:'Gi\u00e1 t\u0103ng d\u1ea7n' },
  { key:'price-desc', label:'Gi\u00e1 gi\u1ea3m d\u1ea7n' },
  { key:'bestseller', label:'B\u00e1n ch\u1ea1y' },
] as const;
type SortKey = typeof SORTS[number]['key'];

export default function Products() {
  const { user, isAuthenticated } = useAuth();
  const { width:screenWidth } = useWindowDimensions();
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('new');
  const [sortOpen, setSortOpen] = useState(false);
  const list = useMemo(()=>{
    let l = cat==='all'? PRODUCTS : PRODUCTS.filter(p=>p.cat===cat);
    if (q.trim()) { const nq = norm(q.trim()); l = l.filter(p=> norm(p.name).includes(nq) || norm(p.kanji).includes(nq)); }
    l = [...l];
    if (sort==='price-asc') l.sort((a,b)=>a.price-b.price);
    else if (sort==='price-desc') l.sort((a,b)=>b.price-a.price);
    else if (sort==='bestseller') l.sort((a,b)=>b.sold-a.sold);
    return l;
  },[cat,q,sort]);
  const sortLabel = SORTS.find(s=>s.key===sort)?.label || 'M\u1edbi nh\u1ea5t';
  const cardGap = 12;
  const cardWidth = Math.floor((screenWidth - 36 - cardGap) / 2);
  useEffect(()=>{
    const query=q.trim();
    if(!isAuthenticated||!user||query.length<2||!list.length)return;
    const timer=setTimeout(()=>{
      list.slice(0,3).forEach((product,rank)=>{
        void trackInteraction({userId:user.id,type:'search',productId:product.slug,value:1,metadata:{query,rank:rank+1,resultCount:list.length}}).catch(()=>undefined);
      });
    },650);
    return()=>clearTimeout(timer);
  },[isAuthenticated,list,q,user]);
  return (
    <SafeAreaView edges={['top']} style={{ flex:1, backgroundColor:C.washi }}>
      <View style={{ paddingHorizontal:18, paddingTop:8 }}>
        <Text style={{ fontFamily:F.display, fontSize:22, color:C.sumi, marginBottom:10 }}>Sản phẩm</Text>
        <View style={st.search}>
          <Ionicons name="search" size={18} color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Tìm kimono, áo khoác, đồ hóa thân, phụ kiện…" placeholderTextColor={C.muted} style={{ flex:1, fontFamily:F.body, fontSize:14, color:C.ink }} />
          {q.length>0 && <Pressable onPress={()=>setQ('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={C.muted} /></Pressable>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:8 }} contentContainerStyle={{ gap:8 }}>
          {CATEGORIES.map(c=>(
            <Pressable key={c.key} style={[st.chip, cat===c.key&&st.chipOn]} onPress={()=>setCat(c.key)}>
              <Text style={{ color:cat===c.key?'#fff':C.ink, fontFamily:F.bodyM, fontSize:12.5 }}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <Text style={{ fontFamily:F.body, fontSize:12.5, color:C.muted }}>{list.length} sản phẩm</Text>
          <Pressable style={{ flexDirection:'row', alignItems:'center', gap:4 }} onPress={()=>setSortOpen(o=>!o)}>
            <Text style={{ fontFamily:F.bodyM, fontSize:12.5, color:C.ink }}>Sắp xếp: {sortLabel}</Text>
            <Ionicons name={sortOpen?'chevron-up':'chevron-down'} size={14} color={C.ink} />
          </Pressable>
        </View>
        {sortOpen && (
          <View style={st.sortMenu}>
            {SORTS.map(s=>(
              <Pressable key={s.key} style={[st.sortOpt, s.key===sort&&{ backgroundColor:C.shuSoft }]} onPress={()=>{ setSort(s.key); setSortOpen(false); }}>
                <Text style={{ fontFamily:s.key===sort?F.bodyB:F.body, fontSize:13, color:s.key===sort?C.shuDeep:C.ink }}>{s.label}</Text>
                {s.key===sort && <Ionicons name="checkmark" size={15} color={C.shuDeep} />}
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal:18, paddingBottom:24 }} keyboardShouldPersistTaps="handled">
        {list.length===0 ? (
          <View style={{ alignItems:'center', paddingVertical:50 }}>
            <Ionicons name="search-outline" size={44} color={C.hair} />
            <Text style={{ fontFamily:F.bodyM, fontSize:14, color:C.muted, marginTop:10 }}>Không tìm thấy "{q}"</Text>
          </View>
        ) : (
          <View style={st.grid}>
            {list.map(p=><ProductCard key={p.slug} p={p} width={cardWidth} imgH={Math.round(cardWidth*1.17)} />)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const st = StyleSheet.create({
  search:{ flexDirection:'row', alignItems:'center', gap:8, minHeight:48, borderWidth:1, borderColor:C.line, borderRadius:12, backgroundColor:'#fff', paddingHorizontal:13, marginBottom:12 },
  chip:{ borderWidth:1, borderColor:C.line, borderRadius:999, paddingVertical:8, paddingHorizontal:13, backgroundColor:'#fff' },
  chipOn:{ backgroundColor:C.shu, borderColor:C.shu },
  grid:{ flexDirection:'row', flexWrap:'wrap', justifyContent:'center', columnGap:12, rowGap:12, width:'100%', alignSelf:'center' },
  sortMenu:{ borderWidth:1, borderColor:C.line, borderRadius:12, backgroundColor:'#fff', marginBottom:10, overflow:'hidden' },
  sortOpt:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:11, paddingHorizontal:14, borderTopWidth:1, borderTopColor:C.hair },
});
