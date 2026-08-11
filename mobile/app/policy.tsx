import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header } from '../components/ui';
import { FulfillmentPolicy, getFulfillmentPolicy, PolicyStage } from '../lib/api';
import { C, F } from '../theme/tokens';

// Chính sách & quy trình mua – giao – nhận – đổi/trả.
//
// Toàn bộ nội dung lấy từ backend (lib/fulfillmentPolicy.js) chứ không viết lại
// trong app: chỉ cần sửa quy trình một chỗ là app, trang quản trị và tài liệu
// đều đổi theo, không bao giờ lệch nhau.

const ACTOR_STYLE: Record<string, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  customer: { color: '#1F5FA8', bg: '#E8F0FA', icon: 'person-outline' },
  shop: { color: '#A33A2F', bg: '#FBEDEA', icon: 'storefront-outline' },
  carrier: { color: '#7A5A15', bg: '#FBF1DA', icon: 'car-outline' },
  gateway: { color: '#4C1D95', bg: '#F2EEFF', icon: 'card-outline' },
};

function StageRow({ stage, index, actors, last }: { stage: PolicyStage; index: number; actors: Record<string, string>; last: boolean }) {
  const skin = ACTOR_STYLE[stage.actor] || ACTOR_STYLE.shop;
  return (
    <View style={st.stageRow}>
      <View style={st.rail}>
        <View style={[st.railDot, { backgroundColor: skin.color }]}><Text style={st.railDotT}>{index + 1}</Text></View>
        {!last && <View style={st.railLine} />}
      </View>
      <View style={[st.stageCard, { borderColor: skin.bg }]}>
        <Text style={st.stageLabel}>{stage.label}{stage.optional ? ' (nếu có)' : ''}</Text>
        <View style={[st.actorTag, { backgroundColor: skin.bg }]}>
          <Ionicons name={skin.icon} size={11} color={skin.color} />
          <Text style={[st.actorTagT, { color: skin.color }]}>Ai xác nhận: {actors[stage.actor] || stage.actor}</Text>
        </View>
        <Text style={st.stageDesc}>{stage.description}</Text>
        {!!stage.customerCan?.length && (
          <View style={st.canBox}>
            <Text style={st.canTitle}>Bạn có thể làm gì ở bước này</Text>
            {stage.customerCan.map(item => <Text key={item} style={st.canItem}>• {item}</Text>)}
          </View>
        )}
      </View>
    </View>
  );
}

function TerminalRow({ stage, actors }: { stage: PolicyStage; actors: Record<string, string> }) {
  const skin = ACTOR_STYLE[stage.actor] || ACTOR_STYLE.shop;
  return (
    <View style={[st.terminal, { backgroundColor: skin.bg }]}>
      <Text style={[st.terminalLabel, { color: skin.color }]}>{stage.label}</Text>
      <Text style={st.terminalDesc}>{stage.description}</Text>
    </View>
  );
}

export default function PolicyScreen() {
  const [policy, setPolicy] = useState<FulfillmentPolicy | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    void getFulfillmentPolicy()
      .then(data => { if (live) setPolicy(data); })
      .catch(e => { if (live) setError(e?.message || 'Không tải được chính sách.'); });
    return () => { live = false; };
  }, []);

  return (
    <Screen>
      <Header title="Chính sách & quy trình" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>
        {!policy && !error && <ActivityIndicator color={C.shu} style={{ marginTop: 30 }} />}
        {!!error && <Text style={st.error}>{error}</Text>}
        {!!policy && (
          <>
            <View style={st.hero}>
              <Text style={st.heroKicker}>MUA – GIAO – NHẬN – ĐỔI/TRẢ</Text>
              <Text style={st.heroTitle}>Mỗi bước một người chịu trách nhiệm rõ ràng</Text>
              <Text style={st.heroSub}>Đơn hàng JAPANO đi qua bốn bên: bạn, cửa hàng, đơn vị vận chuyển và cổng thanh toán. Trang này ghi rõ ai xác nhận bước nào và trong bao lâu.</Text>
            </View>

            <View style={st.timerGrid}>
              <View style={st.timer}><Text style={st.timerN}>{policy.timers.autoConfirmDays}</Text><Text style={st.timerL}>ngày tự xác nhận sau khi giao</Text></View>
              <View style={st.timer}><Text style={st.timerN}>{policy.timers.returnWindowDays}</Text><Text style={st.timerL}>ngày được đổi/trả</Text></View>
              <View style={st.timer}><Text style={st.timerN}>{policy.timers.shipBackDays}</Text><Text style={st.timerL}>ngày để gửi hàng về</Text></View>
              <View style={st.timer}><Text style={st.timerN}>{policy.timers.refundSettlementDays}</Text><Text style={st.timerL}>ngày tiền hoàn về tài khoản</Text></View>
            </View>

            <Text style={st.section}>QUY TRÌNH ĐƠN HÀNG</Text>
            {policy.order.stages.map((stage, index) => (
              <StageRow key={stage.status} stage={stage} index={index} actors={policy.actors} last={index === policy.order.stages.length - 1} />
            ))}
            <Text style={st.sectionSub}>Trường hợp kết thúc khác</Text>
            {policy.order.terminal.map(stage => <TerminalRow key={stage.status} stage={stage} actors={policy.actors} />)}

            <Text style={st.section}>QUY TRÌNH HUỶ ĐƠN</Text>
            <View style={st.plainBox}><Text style={st.plainText}>{policy.cancel.description}</Text></View>

            <Text style={st.section}>QUY TRÌNH ĐỔI / TRẢ HÀNG</Text>
            {policy.return.stages.map((stage, index) => (
              <StageRow key={stage.status} stage={stage} index={index} actors={policy.actors} last={index === policy.return.stages.length - 1} />
            ))}
            <Text style={st.sectionSub}>Trường hợp kết thúc khác</Text>
            {policy.return.terminal.map(stage => <TerminalRow key={stage.status} stage={stage} actors={policy.actors} />)}

            <Text style={st.section}>ĐIỀU KIỆN ĐỔI / TRẢ</Text>
            <View style={st.plainBox}>
              {policy.return.conditions.map(item => (
                <View key={item} style={st.condRow}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={C.shu} style={{ marginTop: 2 }} />
                  <Text style={st.condText}>{item}</Text>
                </View>
              ))}
            </View>
            <Text style={st.version}>Phiên bản chính sách {policy.version}</Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  error: { fontFamily: F.bodyB, fontSize: 12.5, color: C.danger, textAlign: 'center', marginTop: 24 },
  hero: { backgroundColor: C.sumi, borderRadius: 18, padding: 17, marginTop: 4 },
  heroKicker: { fontFamily: F.bodyX, fontSize: 10, letterSpacing: 1.3, color: '#F6D6B4' },
  heroTitle: { fontFamily: F.display, fontSize: 18, lineHeight: 26, color: '#fff', marginTop: 7 },
  heroSub: { fontFamily: F.body, fontSize: 11.5, lineHeight: 18, color: '#D8D2CB', marginTop: 8 },
  timerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  timer: { width: '48%', backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 11, alignItems: 'center' },
  timerN: { fontFamily: F.displayX, fontSize: 24, color: C.shu },
  timerL: { fontFamily: F.body, fontSize: 10, lineHeight: 14, color: C.muted, textAlign: 'center', marginTop: 3 },
  section: { fontFamily: F.bodyX, fontSize: 10.5, letterSpacing: 1.2, color: C.shuDeep, marginTop: 24, marginBottom: 12 },
  sectionSub: { fontFamily: F.bodyB, fontSize: 11.5, color: C.muted, marginTop: 12, marginBottom: 8 },
  stageRow: { flexDirection: 'row', gap: 10 },
  rail: { alignItems: 'center', width: 26 },
  railDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  railDotT: { fontFamily: F.bodyX, fontSize: 11, color: '#fff' },
  railLine: { flex: 1, width: 2, backgroundColor: C.hair, marginVertical: 2 },
  stageCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderRadius: 14, padding: 12, marginBottom: 10 },
  stageLabel: { fontFamily: F.bodyB, fontSize: 13, color: C.ink },
  actorTag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 },
  actorTagT: { fontFamily: F.bodyB, fontSize: 9.5 },
  stageDesc: { fontFamily: F.body, fontSize: 11.5, lineHeight: 18, color: C.ink, marginTop: 7 },
  canBox: { backgroundColor: C.washi2, borderRadius: 10, padding: 9, marginTop: 8 },
  canTitle: { fontFamily: F.bodyX, fontSize: 9.5, letterSpacing: 0.8, color: C.muted, marginBottom: 4 },
  canItem: { fontFamily: F.body, fontSize: 11, lineHeight: 17, color: C.ink },
  terminal: { borderRadius: 12, padding: 11, marginBottom: 8 },
  terminalLabel: { fontFamily: F.bodyB, fontSize: 12 },
  terminalDesc: { fontFamily: F.body, fontSize: 11, lineHeight: 17, color: C.ink, marginTop: 4 },
  plainBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 13 },
  plainText: { fontFamily: F.body, fontSize: 11.5, lineHeight: 19, color: C.ink },
  condRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  condText: { flex: 1, fontFamily: F.body, fontSize: 11.5, lineHeight: 18, color: C.ink },
  version: { fontFamily: F.body, fontSize: 10, color: C.muted, textAlign: 'center', marginTop: 18 },
});
