import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../../theme/tokens';
import { EnsoAvatar, money } from '../../components/ui';
import { getFlagcardCollection, getOrders, getVipStatus, VipStatus } from '../../lib/api';
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
  const [orderStats, setOrderStats] = useState<{count:number}|null>(null);
  const [vip,setVip]=useState<VipStatus|null>(null);
  useFocusEffect(useCallback(() => {
    let live = true;
    if(!user){setVip(null);setOrderStats({count:0});return()=>{live=false;};}
    getFlagcardCollection(user.id).then(res => { if (live) setFlagProgress(res.progress); }).catch(() => undefined);
    getVipStatus(user.id).then(res=>{if(live)setVip(res.status);}).catch(()=>{if(live)setVip(null);});
    getOrders(user.id).then(orders => {
      if (!live) return;
      setOrderStats({ count: orders.length });
    }).catch(() => undefined);
    return () => { live = false; };
  }, [user?.id]));
  return (
    <SafeAreaView edges={['top']} style={{ flex:1, backgroundColor:C.washi }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal:18, paddingTop:16, paddingBottom:24 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:14 }}>
          <EnsoAvatar size={64} letter="M" />
          <View style={{ flex:1 }}>
            <Text style={{ fontFamily:F.display, fontSize:20, color:C.sumi }}>{user?.name||'Thành viên JAPANO'}</Text>
            <Text style={{ fontFamily:F.body, fontSize:12, color:C.muted }}>{user?.email||''}</Text>
            <View style={[st.memberBadge,vip?.isVip&&st.memberBadgeVip]}><Ionicons name={vip?.isVip?'diamond':'person'} size={11} color={vip?.isVip?'#8A6518':C.muted}/><Text style={[st.memberBadgeT,vip?.isVip&&st.memberBadgeTVip]}>{vip?.isVip?`VIP · còn ${vip.daysRemaining} ngày`:'Thành viên JAPANO'}</Text></View>
          </View>
          <Pressable style={st.editChip} onPress={()=>router.push('/profile')}><Text style={{ fontFamily:F.bodyM, fontSize:11, color:C.ink }}>Sửa</Text></Pressable>
        </View>

        <View style={[st.vipCard,vip?.isVip&&st.vipCardActive]}>
          <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
            <View style={st.vipIcon}><Ionicons name={vip?.isVip?'diamond':'diamond-outline'} size={20} color="#fff"/></View>
            <View style={{flex:1}}><Text style={st.vipTitle}>{vip?.isVip?'Đặc quyền JAPANO VIP':'Tiến độ VIP tháng này'}</Text><Text style={st.vipSub}>{vip?.isVip&&vip.expiresAt?`Hiệu lực đến ${new Date(vip.expiresAt).toLocaleDateString('vi-VN')} · giảm 10% cho 1 sản phẩm mỗi đơn`:`Chi đủ ${money(vip?.currentMonth.threshold||5_000_000)} trong tháng để mở VIP 30 ngày.`}</Text></View>
          </View>
          <View style={st.vipTrack}><View style={[st.vipTrackOn,{width:`${vip?.currentMonth.progressPercent||0}%` as `${number}%`}]}/></View>
          <View style={st.vipMeta}><Text style={st.vipMetaT}>Đã chi {money(vip?.currentMonth.spend||0)}</Text><Text style={st.vipMetaT}>{vip?.isVip?'Đã mở VIP ✓':`Còn ${money(vip?.currentMonth.remaining||5_000_000)}`}</Text></View>
        </View>

        <View style={{ flexDirection:'row', gap:10, marginVertical:14 }}>
          <Stat n={orderStats?String(orderStats.count):'…'} label="Đơn hàng" to="/orders" />
          <Stat n={String(wish.length)} label="Đã lưu" to="/(tabs)/wishlist" />
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
        <Row icon="compass-outline" label="Khám phá Nhật Bản" to="/explore-japan" />
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
  memberBadge:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:4,backgroundColor:C.washi2,borderRadius:999,paddingHorizontal:8,paddingVertical:4,marginTop:5},
  memberBadgeVip:{backgroundColor:'#F7E8B8'},memberBadgeT:{fontFamily:F.bodyB,fontSize:9.5,color:C.muted},memberBadgeTVip:{color:'#8A6518'},
  vipCard:{backgroundColor:'#fff',borderWidth:1,borderColor:C.line,borderRadius:16,padding:14,marginTop:15},vipCardActive:{backgroundColor:'#FFF9EC',borderColor:'#B08D3C'},
  vipIcon:{width:42,height:42,borderRadius:13,backgroundColor:'#9A7423',alignItems:'center',justifyContent:'center'},vipTitle:{fontFamily:F.display,fontSize:15,color:C.sumi},vipSub:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:C.muted,marginTop:2},
  vipTrack:{height:8,borderRadius:5,backgroundColor:C.hair,overflow:'hidden',marginTop:12},vipTrackOn:{height:'100%',borderRadius:5,backgroundColor:'#B08D3C'},vipMeta:{flexDirection:'row',justifyContent:'space-between',marginTop:6},vipMetaT:{fontFamily:F.bodyB,fontSize:10,color:C.muted},
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
