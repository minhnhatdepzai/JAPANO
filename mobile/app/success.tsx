import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Btn, money } from '../components/ui';
import { Enso } from '../components/art';
import { C, F } from '../theme/tokens';

export default function Success() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?:string; total?:string; qualifies?:string; threshold?:string; flagcardId?:string; flagcardTitle?:string; flagcardGlyph?:string; flagcardRegion?:string }>();
  const code = params.code || 'JP240706';
  const qualifies = params.qualifies === 'true';
  const threshold = Number(params.threshold) || 0;
  const receivedCard = Boolean(params.flagcardId);

  return (
    <Screen>
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:22 }}>
        <View style={{ width:120, height:120, alignItems:'center', justifyContent:'center' }}>
          <View style={{ position:'absolute' }}><Enso size={120} sw={7} /></View>
          <Ionicons name="checkmark" size={44} color={C.shu} />
        </View>
        <Text style={{ fontFamily:F.display, fontSize:24, color:C.sumi, marginTop:6 }}>Đặt hàng thành công</Text>
        <Text style={{ fontFamily:F.displaySb, color:C.kin, fontSize:13, marginTop:2 }}>Cảm ơn bạn</Text>
        <Text style={{ fontFamily:F.body, fontSize:13, color:C.muted, marginTop:10, textAlign:'center', maxWidth:260, lineHeight:20 }}>
          Đơn <Text style={{ color:C.ink, fontFamily:F.bodyB }}>#{code}</Text> đã được tạo. Chúng tôi sẽ đóng gói tỉ mỉ theo tinh thần omotenashi.
        </Text>

        {receivedCard && (
          <View style={st.awardCard}>
            <Text style={st.awardEyebrow}>✦ BẠN VỪA NHẬN FLAGCARD</Text>
            <Text style={st.awardGlyph}>{params.flagcardGlyph || '🚩'}</Text>
            <Text style={st.awardTitle}>{params.flagcardTitle}</Text>
            <Text style={st.awardRegion}>{params.flagcardRegion} · từ đơn #{code}</Text>
            <Pressable style={st.awardButton} onPress={()=>router.replace('/flagcards')}>
              <Text style={st.awardButtonText}>Mở thẻ và xem câu chuyện</Text>
            </Pressable>
          </View>
        )}
        {qualifies && !receivedCard && (
          <View style={st.flagBanner}>
            <Ionicons name="flag" size={18} color="#F6D6B4" />
            <Text style={st.flagText}>
              Đơn này đủ điều kiện nhận <Text style={st.flagStrong}>thẻ địa danh</Text> — thẻ sẽ hiện ngay khi thanh toán được xác nhận.
            </Text>
          </View>
        )}
        {!qualifies && threshold > 0 && (
          <Text style={st.flagHint}>Mua đơn từ {money(threshold)} để có cơ hội nhận thẻ sưu tầm địa danh Nhật Bản.</Text>
        )}

        <View style={{ width:'100%', marginTop:22 }}>
          <Btn label="Theo dõi đơn hàng" onPress={()=>router.replace(`/order/${code}`)} />
          {qualifies && !receivedCard && <Btn label="Xem bộ sưu tập thẻ địa danh" variant="ink" style={{ marginTop:10 }} onPress={()=>router.replace('/flagcards')} />}
          <Btn label="Về trang chủ" variant="ghost" style={{ marginTop:10 }} onPress={()=>router.replace('/(tabs)')} />
        </View>
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  awardCard:{ width:'100%', maxWidth:330, backgroundColor:C.sumi, borderWidth:1, borderColor:C.kin, borderRadius:20, padding:17, marginTop:16, alignItems:'center' },
  awardEyebrow:{ fontFamily:F.bodyX, fontSize:10, letterSpacing:1.1, color:'#F6D6B4' },
  awardGlyph:{ fontSize:42, marginTop:6 },
  awardTitle:{ fontFamily:F.display, fontSize:18, color:'#fff', textAlign:'center', marginTop:3 },
  awardRegion:{ fontFamily:F.body, fontSize:11, color:'#D8D2CB', marginTop:3 },
  awardButton:{ backgroundColor:C.shu, borderRadius:12, paddingVertical:10, paddingHorizontal:18, marginTop:12 },
  awardButtonText:{ fontFamily:F.bodyB, fontSize:11.5, color:'#fff' },
  flagBanner:{ flexDirection:'row', alignItems:'center', gap:10, backgroundColor:C.sumi, borderRadius:14, padding:13, marginTop:16, maxWidth:320 },
  flagText:{ flex:1, fontFamily:F.body, fontSize:11.5, lineHeight:17, color:'#D8D2CB' },
  flagStrong:{ fontFamily:F.bodyB, color:'#F6D6B4' },
  flagHint:{ fontFamily:F.body, fontSize:11.5, lineHeight:17, color:C.muted, textAlign:'center', marginTop:14, maxWidth:280 },
});
