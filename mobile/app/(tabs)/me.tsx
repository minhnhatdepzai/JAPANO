import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../../theme/tokens';
import { EnsoAvatar, Streak } from '../../components/ui';
import { getFlagcardCollection, getOrders } from '../../lib/api';
import { useStore } from '../../lib/store';
import { useAuth } from '../../lib/auth';

const Row = ({ icon, label, to, danger }:{ icon:string; label:string; to?:Href; danger?:boolean }) => {
  const router = useRouter();
  return (
    <Pressable style={st.row} onPress={()=> to && router.push(to)}>
      <View style={[st.ic, danger&&{ backgroundColor:'#F6E3E3' }]}><Ionicons name={icon as any} size={17} color={danger?C.danger:C.shu} /></View>
      <Text style={[st.rowLbl, danger&&{ color:C.danger }]}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={16} color={C.muted} />}
    </Pressable>
  );
};
const Stat = ({ n, label, to }:{ n:string; label:string; to?:Href }) => {
  const router = useRouter();
  return (
    <Pressable style={st.stat} onPress={()=> to && router.push(to)}>
      <Text style={{ fontFamily:F.display, fontSize:20, color:C.sumi }}>{n}</Text>
      <Text style={{ fontFamily:F.body, fontSize:10.5, color:C.muted }}>{label}</Text>
    </Pressable>
  );
};

export default function Me() {
  const router = useRouter();
  const { wish } = useStore();
  const { user, signOut } = useAuth();
  const [flagProgress, setFlagProgress] = useState<{owned:number;required:number;completed:boolean}|null>(null);
  const [orderStats, setOrderStats] = useState<{count:number;xu:number}|null>(null);
  useFocusEffect(useCallback(() => {
    let live = true;
    getFlagcardCollection().then(res => { if (live) setFlagProgress(res.progress); }).catch(() => undefined);
    getOrders().then(orders => {
      if (!live) return;
      const spent = orders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+Number(o.total||0),0);
      setOrderStats({ count: orders.length, xu: Math.floor(spent/10000) });
    }).catch(() => undefined);
    return () => { live = false; };
  }, []));
  return (
    <SafeAreaView edges={['top']} style={{ flex:1, backgroundColor:C.washi }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal:18, paddingTop:16, paddingBottom:24 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:14 }}>
          <EnsoAvatar size={64} letter="M" />
          <View style={{ flex:1 }}>
            <Text style={{ fontFamily:F.display, fontSize:20, color:C.sumi }}>{user?.name||'Thành viên JAPANO'}</Text>
            <Text style={{ fontFamily:F.body, fontSize:12, color:C.muted }}>{user?.email||''}</Text>
            <View style={{ marginTop:4 }}><Streak label="✦ VIP · 5 ngày streak" /></View>
          </View>
          <Pressable style={st.editChip} onPress={()=>router.push('/profile')}><Text style={{ fontFamily:F.bodyM, fontSize:11, color:C.ink }}>Sửa</Text></Pressable>
        </View>

        <View style={{ flexDirection:'row', gap:10, marginVertical:14 }}>
          <Stat n={orderStats?String(orderStats.count):'…'} label="Đơn hàng" to="/orders" />
          <Stat n={String(wish.length)} label="Đã lưu" to="/(tabs)/wishlist" />
          <Stat n={orderStats?orderStats.xu.toLocaleString('vi-VN'):'…'} label="Xu" />
        </View>

        <Text style={st.grp}>TÀI KHOẢN</Text>
        <Row icon="person-outline" label="Thông tin cá nhân" to="/profile" />
        <Row icon="location-outline" label="Địa chỉ nhận hàng" to="/addresses" />
        <Row icon="cube-outline" label="Đơn hàng của tôi" to="/orders" />
        <Row icon="heart-outline" label="Yêu thích" to="/(tabs)/wishlist" />
        <Row icon="notifications-outline" label="Thông báo" to="/notifications" />
        <Row icon="flag-outline" label="Mục tiêu mua sắm & làm đẹp" to="/goals" />
        <Pressable style={st.row} onPress={()=>router.push('/flagcards')}>
          <View style={st.ic}><Ionicons name="albums-outline" size={17} color={C.shu} /></View>
          <Text style={st.rowLbl}>Thẻ sưu tầm địa danh</Text>
          {!!flagProgress && (
            <View style={[st.flagBadge, flagProgress.completed && st.flagBadgeDone]}>
              <Text style={[st.flagBadgeT, flagProgress.completed && st.flagBadgeTDone]}>{flagProgress.completed?'Đủ bộ ✓':`${flagProgress.owned}/${flagProgress.required}`}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color={C.muted} />
        </Pressable>

        <Text style={st.grp}>KHÁC</Text>
        <Row icon="sparkles-outline" label="Văn hoá Nhật Bản" to="/culture" />
        <Row icon="settings-outline" label="Cài đặt hệ thống" to="/settings" />
        <Pressable style={st.row} onPress={()=>void signOut().then(()=>router.replace('/login'))}>
          <View style={[st.ic,{ backgroundColor:'#F6E3E3' }]}><Ionicons name="power-outline" size={17} color={C.danger} /></View>
          <Text style={[st.rowLbl,{ color:C.danger }]}>Đăng xuất</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const st = StyleSheet.create({
  editChip:{ borderWidth:1, borderColor:C.line, borderRadius:999, paddingVertical:7, paddingHorizontal:13, backgroundColor:'#fff' },
  stat:{ flex:1, backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:14, padding:12, alignItems:'center' },
  grp:{ fontFamily:F.display, fontSize:12, color:C.muted, letterSpacing:1.5, marginTop:16, marginBottom:2 },
  row:{ flexDirection:'row', alignItems:'center', gap:12, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.hair },
  ic:{ width:34, height:34, borderRadius:10, backgroundColor:C.shuSoft, alignItems:'center', justifyContent:'center' },
  rowLbl:{ flex:1, fontFamily:F.bodyM, fontSize:14, color:C.ink },
  flagBadge:{ backgroundColor:C.washi2, borderRadius:999, paddingVertical:3, paddingHorizontal:9, marginRight:8 },
  flagBadgeDone:{ backgroundColor:C.shuSoft },
  flagBadgeT:{ fontFamily:F.bodyB, fontSize:10.5, color:C.muted },
  flagBadgeTDone:{ color:C.shuDeep },
});
