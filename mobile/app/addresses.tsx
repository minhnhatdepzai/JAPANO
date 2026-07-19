import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Screen, Header, Btn } from '../components/ui';
import { C, F } from '../theme/tokens';

const Addr = ({ title, addr, def, actions }:{title:string;addr:string;def?:boolean;actions:string}) => (
  <View style={[st.card, def&&{ borderColor:C.shu }]}>
    <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
      <Text style={{ fontFamily:F.bodyB, fontSize:14, color:C.ink }}>{title}</Text>
      {def && <View style={st.badge}><Text style={{ color:'#fff', fontFamily:F.bodyB, fontSize:10 }}>Mặc định</Text></View>}
    </View>
    <Text style={{ fontFamily:F.body, fontSize:12.5, color:C.ink, marginTop:6 }}>Trần Minh · 0901 234 567</Text>
    <Text style={{ fontFamily:F.body, fontSize:12.5, color:C.muted, marginTop:2 }}>{addr}</Text>
    <Text style={{ fontFamily:F.bodyB, fontSize:12, color:C.shu, marginTop:8 }}>{actions}</Text>
  </View>
);
export default function Addresses() {
  return (
    <Screen>
      <Header title="Địa chỉ nhận hàng" />
      <ScrollView contentContainerStyle={{ paddingHorizontal:18, paddingBottom:24 }}>
        <Addr title="Nhà riêng" addr="123 Lê Lợi, P. Bến Nghé, Hồ Chí Minh" def actions="Sửa · Xoá" />
        <Addr title="Công ty" addr="Toà Bitexco, P. Bến Nghé, Hồ Chí Minh" actions="Đặt mặc định · Sửa · Xoá" />
        <Btn label="+ Thêm địa chỉ mới" variant="ghost" style={{ marginTop:6 }} />
      </ScrollView>
    </Screen>
  );
}
const st = StyleSheet.create({
  card:{ backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:14, padding:14, marginBottom:12 },
  badge:{ backgroundColor:C.shu, borderRadius:999, paddingVertical:3, paddingHorizontal:9 },
});
