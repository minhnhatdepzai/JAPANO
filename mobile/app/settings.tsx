import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header } from '../components/ui';
import { C, F } from '../theme/tokens';
import { useBotChat } from '../lib/botchat';

const Row = ({ icon, label, description, right }:{icon:string;label:string;description?:string;right:React.ReactNode}) => (
  <View style={st.row}>
    <View style={st.ic}><Ionicons name={icon as any} size={17} color={C.shu} /></View>
    <View style={{ flex:1 }}>
      <Text style={st.lbl}>{label}</Text>
      {!!description && <Text style={st.description}>{description}</Text>}
    </View>
    {right}
  </View>
);
const Arrow = ({ t }:{t?:string}) => (<Text style={{ fontFamily:F.body, fontSize:12, color:C.muted }}>{t? t+' ›':'›'}</Text>);
export default function Settings() {
  const bot = useBotChat();
  const [dark, setDark] = useState(false);
  const [ai, setAi] = useState(true);
  const [noti, setNoti] = useState(true);
  return (
    <Screen>
      <Header title="Cài đặt hệ thống" />
      <ScrollView contentContainerStyle={{ paddingHorizontal:18, paddingBottom:24 }}>
        <Text style={st.grp}>GIAO DIỆN</Text>
        <Row icon="moon-outline" label="Chế độ tối màu mực" right={<Switch value={dark} onValueChange={setDark} trackColor={{ true:C.shu }} />} />
        <Row icon="text-outline" label="Cỡ chữ" right={<Arrow t="Vừa" />} />
        <Row icon="language-outline" label="Ngôn ngữ" right={<Arrow t="Tiếng Việt" />} />
        <Text style={st.grp}>TRỢ LÝ & GỢI Ý</Text>
        <Row icon="sparkles-outline" label="Trợ lý thông minh và gợi ý" right={<Switch value={ai} onValueChange={setAi} trackColor={{ true:C.shu }} />} />
        <Row
          icon="chatbubble-ellipses-outline"
          label="Nút botchat Ori"
          description={bot.enabled ? 'Hiện nút tròn có thể kéo trên màn hình' : 'Đang ẩn — bật lại tại đây'}
          right={<Switch value={bot.enabled} onValueChange={bot.setEnabled} trackColor={{ false:C.hair, true:C.shu }} />}
        />
        <Row icon="notifications-outline" label="Thông báo đẩy" right={<Switch value={noti} onValueChange={setNoti} trackColor={{ true:C.shu }} />} />
        <Row icon="trash-outline" label="Xoá dữ liệu đã xem" right={<Arrow />} />
        <Text style={st.grp}>KHÁC</Text>
        <Row icon="information-circle-outline" label="Về JAPANO" right={<Arrow />} />
        <Row icon="shield-checkmark-outline" label="Quyền riêng tư" right={<Arrow />} />
      </ScrollView>
    </Screen>
  );
}
const st = StyleSheet.create({
  grp:{ fontFamily:F.display, fontSize:12, color:C.muted, letterSpacing:1.5, marginTop:16, marginBottom:2 },
  row:{ flexDirection:'row', alignItems:'center', gap:12, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.hair },
  ic:{ width:34, height:34, borderRadius:10, backgroundColor:C.shuSoft, alignItems:'center', justifyContent:'center' },
  lbl:{ flex:1, fontFamily:F.bodyM, fontSize:14, color:C.ink },
  description:{ fontFamily:F.body, fontSize:10.5, lineHeight:15, color:C.muted, marginTop:2 },
});
