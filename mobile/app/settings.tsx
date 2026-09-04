import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header } from '../components/ui';
import { C, F } from '../theme/tokens';
import { useBotChat } from '../lib/botchat';
import { useToast } from '../lib/toast';
import { syncPushToken } from '../lib/push';
import { sendTestNotification } from '../lib/localNotify';

const Row = ({ icon, label, description, right, onPress }:{icon:string;label:string;description?:string;right:React.ReactNode;onPress?:()=>void}) => {
  const Body = onPress ? Pressable : View;
  return (
  <Body
    style={st.row}
    {...(onPress ? { onPress, accessibilityRole:'button' as const, accessibilityLabel:label } : {})}
  >
    <View style={st.ic}><Ionicons name={icon as any} size={17} color={C.ink} /></View>
    <View style={{ flex:1 }}>
      <Text style={st.lbl}>{label}</Text>
      {!!description && <Text style={st.description}>{description}</Text>}
    </View>
    {right}
  </Body>
  );
};
const Arrow = ({ t }:{t?:string}) => (<Text style={{ fontFamily:F.body, fontSize:12, color:C.muted }}>{t? t+' ›':'›'}</Text>);
export default function Settings() {
  const bot = useBotChat();
  const { toast } = useToast();
  const [ai, setAi] = useState(true);
  const [noti, setNoti] = useState(true);
  const [testing, setTesting] = useState(false);
  const [notiHint, setNotiHint] = useState('Đang kiểm tra trạng thái…');

  // Nói thật trạng thái thay vì để công tắc trang trí: nếu push từ xa chưa bật
  // được (thiếu EAS projectId) thì app vẫn hiện thông báo qua đường cục bộ, và
  // người dùng cần biết điều đó thay vì tưởng là hỏng.
  useEffect(() => {
    let live = true;
    void (async () => {
      const status = await syncPushToken();
      if (!live) return;
      if (status.state === 'ok') setNotiHint('Đã bật đầy đủ — nhận được cả thông báo khi không mở ứng dụng.');
      else if (status.state === 'denied') setNotiHint('Bạn chưa cho phép JAPANO gửi thông báo — hãy bật trong Cài đặt của điện thoại.');
      else setNotiHint('Thông báo hoạt động khi ứng dụng đang mở. Để nhận cả lúc đã đóng ứng dụng, cần bật push từ xa.');
    })();
    return () => { live = false; };
  }, []);

  const onTest = async () => {
    setTesting(true);
    const ok = await sendTestNotification();
    setTesting(false);
    toast({
      message: ok ? 'Đã gửi — kiểm tra khay thông báo của bạn ✓' : 'Chưa gửi được: hãy cho phép JAPANO gửi thông báo.',
      kind: ok ? 'success' : 'error',
    });
  };

  return (
    <Screen>
      <Header title="Cài đặt hệ thống" />
      <ScrollView contentContainerStyle={{ paddingHorizontal:18, paddingBottom:24 }}>
        <Text style={st.grp}>GIAO DIỆN</Text>
        <Row
          icon="moon-outline"
          label="Chế độ tối màu mực"
          description="Tạm tắt ở bản ổn định — ứng dụng luôn dùng giao diện sáng"
          right={<Switch value={false} disabled trackColor={{ false:C.hair, true:C.shu }} />}
        />
        <Row
          icon="text-outline"
          label="Cỡ chữ"
          description="Tạm dùng cỡ chữ vừa để tránh lỗi khởi động"
          right={<Arrow t="Vừa" />}
        />
        <Row icon="language-outline" label="Ngôn ngữ" right={<Arrow t="Tiếng Việt" />} />
        <Text style={st.grp}>TRỢ LÝ & GỢI Ý</Text>
        <Row icon="sparkles-outline" label="Trợ lý thông minh và gợi ý" right={<Switch value={ai} onValueChange={setAi} trackColor={{ true:C.shu }} />} />
        <Row
          icon="chatbubble-ellipses-outline"
          label="Nút botchat Ori"
          description={bot.enabled ? 'Hiện nút tròn có thể kéo trên màn hình' : 'Đang ẩn — bật lại tại đây'}
          right={<Switch value={bot.enabled} onValueChange={bot.setEnabled} trackColor={{ false:C.hair, true:C.shu }} />}
        />
        <Text style={st.grp}>THÔNG BÁO</Text>
        <Row
          icon="notifications-outline"
          label="Thông báo trên điện thoại"
          description={notiHint}
          right={<Switch value={noti} onValueChange={setNoti} trackColor={{ false:C.hair, true:C.shu }} />}
        />
        <Pressable style={st.row} onPress={onTest} disabled={testing}>
          <View style={st.ic}><Ionicons name="send-outline" size={17} color={C.ink} /></View>
          <View style={{ flex:1 }}>
            <Text style={st.lbl}>Gửi thông báo thử</Text>
            <Text style={st.description}>Kiểm tra thông báo có hiện ở khay thông báo máy bạn không</Text>
          </View>
          <Text style={{ fontFamily:F.bodyB, fontSize:12, color:C.ink }}>{testing ? 'Đang gửi…' : 'Gửi thử'}</Text>
        </Pressable>
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
  ic:{ width:34, height:34, borderRadius:10, backgroundColor:C.washi2, alignItems:'center', justifyContent:'center' },
  lbl:{ flex:1, fontFamily:F.bodyM, fontSize:14, color:C.ink },
  description:{ fontFamily:F.body, fontSize:10.5, lineHeight:15, color:C.muted, marginTop:2 },
});
