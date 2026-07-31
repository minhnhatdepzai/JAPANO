import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Btn, money } from '../components/ui';
import { PRODUCTS } from '../lib/catalog';
import { getOrders, ApiOrder } from '../lib/api';
import { C, F } from '../theme/tokens';
import { SmartImage } from '../components/SmartImage';
import { useAuth } from '../lib/auth';

const STATUS:Record<string,{label:string;bg:string;fg:string}> = {
  pending:{ label:'Chờ xử lý', bg:C.shuSoft, fg:C.shuDeep },
  confirmed:{ label:'Đã xác nhận', bg:C.aiSoft, fg:C.ai },
  shipping:{ label:'Đang giao', bg:C.aiSoft, fg:C.ai },
  completed:{ label:'Đã nhận', bg:'#E4EEE6', fg:C.ok },
  cancelled:{ label:'Đã huỷ', bg:'#F6E3E3', fg:C.danger },
  returned:{ label:'Đã trả & hoàn tiền', bg:'#F2EEFF', fg:'#6D28D9' },
};
const CHAIN = ['pending','confirmed','shipping','completed'];

const Badge = ({ label, bg, fg }:{label:string;bg:string;fg:string}) => (
  <View style={{ backgroundColor:bg, borderRadius:999, paddingVertical:3, paddingHorizontal:9 }}><Text style={{ color:fg, fontFamily:F.bodyB, fontSize:10 }}>{label}</Text></View>
);
const Timeline = ({ step }:{step:number}) => {
  const nodes = ['Xác nhận','Đóng gói','Đang giao','Đã nhận'];
  return (
    <View style={{ flexDirection:'row', marginVertical:8 }}>
      {nodes.map((n,i)=>(
        <View key={n} style={{ flex:1, alignItems:'center' }}>
          <View style={{ flexDirection:'row', alignItems:'center', width:'100%' }}>
            <View style={{ flex:1, height:2, backgroundColor:i===0?'transparent':(i<=step?C.shu:C.hair) }} />
            <View style={{ width:12, height:12, borderRadius:6, backgroundColor:i<=step?C.shu:C.hair }} />
            <View style={{ flex:1, height:2, backgroundColor:i===nodes.length-1?'transparent':(i<step?C.shu:C.hair) }} />
          </View>
          <Text style={{ fontFamily:F.body, fontSize:10, color:i<=step?C.ink:C.muted, marginTop:4 }}>{n}</Text>
        </View>
      ))}
    </View>
  );
};

function OrderCard({ order }:{ order:ApiOrder }) {
  const router = useRouter();
  const s = STATUS[order.status] || STATUS.pending;
  const step = CHAIN.indexOf(order.status);
  const thumbs = order.items.slice(0,2).map(it => PRODUCTS.find(p=>p.slug===(it.slug||it.productId))?.images?.[0]).filter(Boolean);
  return (
    <Pressable style={st.card} onPress={()=>router.push(`/order/${order.code}`)}>
      <View style={st.cardTop}><Text style={st.oid}>#{order.code}</Text><Badge label={s.label} bg={s.bg} fg={s.fg} /></View>
      {!!thumbs.length && (
        <View style={{ flexDirection:'row', gap:8, marginVertical:10 }}>
          {thumbs.map((img,i)=><SmartImage key={i} source={img} style={st.thumb} recyclingKey={`order-${order.code}-${i}`} />)}
        </View>
      )}
      {step>=0 && order.status!=='cancelled' && <Timeline step={step} />}
      <View style={st.cardFoot}>
        <Text style={st.footT}>{order.items.length} món · <Text style={{ color:C.shu, fontFamily:F.bodyB }}>{money(order.total)}</Text></Text>
        <View style={order.status==='completed'?st.ghostBtn:st.trackBtn}>
          <Text style={{ color:order.status==='completed'?C.ink:'#fff', fontFamily:order.status==='completed'?F.bodyM:F.bodyB, fontSize:11 }}>{order.status==='completed'?'Đánh giá':order.status==='cancelled'?'Chi tiết':'Theo dõi'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function Orders() {
  const router = useRouter();
  const {user}=useAuth();
  const [tab, setTab] = useState<'active'|'history'>('active');
  const [orders, setOrders] = useState<ApiOrder[]|null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((opts?:{silent?:boolean}) => {
    if(!user){setOrders([]);return Promise.resolve();}
    if(!opts?.silent)setRefreshing(true);
    return getOrders(user.id).then(list => { setOrders(list); setError(''); })
      .catch((e:any) => setError(e?.message || 'Chưa tải được đơn hàng.'))
      .finally(()=>setRefreshing(false));
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    let live = true;
    if(live)void load({silent:true});
    return () => { live = false; };
  }, [load]));

  const active = (orders||[]).filter(o=>['pending','confirmed','shipping'].includes(o.status));
  const history = (orders||[]).filter(o=>['completed','cancelled','returned'].includes(o.status));
  const list = tab==='active' ? active : history;

  return (
    <Screen>
      <Header title="Đơn hàng của tôi" />
      <View style={st.seg}>
        <Pressable style={[st.segItem, tab==='active'&&st.segOn]} onPress={()=>setTab('active')}><Text style={[st.segT, tab==='active'&&st.segTOn]}>Đang đến{orders?` (${active.length})`:''}</Text></Pressable>
        <Pressable style={[st.segItem, tab==='history'&&st.segOn]} onPress={()=>setTab('history')}><Text style={[st.segT, tab==='history'&&st.segTOn]}>Lịch sử{orders?` (${history.length})`:''}</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal:18, paddingBottom:24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load()} tintColor={C.shu} colors={[C.shu]} />}>
        {orders===null && !error && (
          <View style={{ alignItems:'center', paddingVertical:60 }}><ActivityIndicator color={C.shu} /></View>
        )}
        {!!error && (
          <View style={{ alignItems:'center', paddingVertical:50 }}>
            <Ionicons name="cloud-offline-outline" size={40} color={C.hair} />
            <Text style={{ fontFamily:F.body, fontSize:12.5, color:C.muted, marginTop:10, textAlign:'center' }}>{error}</Text>
          </View>
        )}
        {orders!==null && list.length===0 && !error && (
          <View style={{ alignItems:'center', paddingVertical:50 }}>
            <Ionicons name="receipt-outline" size={44} color={C.hair} />
            <Text style={{ fontFamily:F.bodyM, fontSize:14, color:C.muted, marginTop:10 }}>{tab==='active'?'Chưa có đơn nào đang xử lý':'Chưa có đơn hàng hoàn tất'}</Text>
            {tab==='active' && <Btn label="Mua sắm ngay" style={{ marginTop:16, width:200 }} onPress={()=>router.push('/(tabs)/products')} />}
          </View>
        )}
        {list.map(order => <OrderCard key={order.id} order={order} />)}
      </ScrollView>
    </Screen>
  );
}
const st = StyleSheet.create({
  seg:{ flexDirection:'row', marginHorizontal:18, marginBottom:6, borderBottomWidth:1, borderBottomColor:C.hair },
  segItem:{ flex:1, alignItems:'center', paddingVertical:12 },
  segOn:{ borderBottomWidth:2, borderBottomColor:C.shu },
  segT:{ fontFamily:F.bodyM, fontSize:14, color:C.muted },
  segTOn:{ color:C.shu, fontFamily:F.bodyB },
  card:{ backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:14, padding:14, marginTop:12 },
  cardTop:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  oid:{ fontFamily:F.bodyB, fontSize:13, color:C.ink },
  thumb:{ width:50, height:60, borderRadius:8 },
  cardFoot:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:8 },
  footT:{ fontFamily:F.body, fontSize:12, color:C.muted },
  trackBtn:{ backgroundColor:C.shu, borderRadius:999, paddingVertical:6, paddingHorizontal:12 },
  ghostBtn:{ borderWidth:1, borderColor:C.line, borderRadius:999, paddingVertical:6, paddingHorizontal:12, backgroundColor:'#fff' },
});
