import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Header, Btn } from '../components/ui';
import { Torii } from '../components/art';
import { C, F } from '../theme/tokens';

const Block = ({ kanji: _kanji, title, text }:{kanji:string;title:string;text:string}) => (
  <View style={st.blk}>
    <View style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
      <Text style={{ fontFamily:F.display, fontSize:16, color:C.sumi, flex:1 }}>{title}</Text>
    </View>
    <Text style={st.p}>{text}</Text>
  </View>
);
export default function Culture() {
  const router = useRouter();
  return (
    <Screen wave={false} edges={[]}>
      <View style={{ height:210 }}>
        <Torii height={210} />
        <LinearGradient colors={['rgba(26,20,16,0.35)','rgba(26,20,16,0.65)']} style={StyleSheet.absoluteFill} />
        <View style={{ position:'absolute', top:8, left:0, right:0 }}><Header /></View>
        <View style={{ position:'absolute', left:18, bottom:16 }}>
          <Text style={{ fontFamily:F.displaySb, letterSpacing:4, fontSize:11, color:'#f0d9b6' }}>VĂN HOÁ</Text>
          <Text style={{ fontFamily:F.displayX, fontSize:28, color:'#fff', marginTop:4 }}>Tinh thần Nhật Bản</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding:18 }}>
        <Text style={st.lead}>Người Nhật mặc đẹp không vì phô trương, mà vì sự vừa vặn, bền bỉ và tinh tế. JAPANO đưa triết lý đó vào tủ đồ của bạn — mỗi món là một lựa chọn có ý nghĩa.</Text>
        <Block kanji="" title="Đẹp trong sự mộc mạc" text="Vẻ đẹp của điều không hoàn hảo, giản dị và tự nhiên. Chọn chất vải thô, màu trầm, phom rủ — càng mặc càng đẹp theo thời gian." />
        <Block kanji="" title="Thanh lịch kín đáo" text="Sự sành điệu kín đáo: cắt cúp gọn, chi tiết tinh, không thừa. Cách tân tủ đồ theo hướng tiết chế giúp bạn nổi bật mà không ồn ào." />
        <Block kanji="" title="Khoảng lặng và tối giản" text="Ít hơn nhưng chất hơn. Mua đúng vài món phối được nhiều cách — tiết kiệm mà vẫn phong cách." />
        <Block kanji="" title="Tinh thần người thợ" text="Từng đường kim của người thợ. JAPANO chọn đối tác may đo kỹ lưỡng, ưu tiên độ bền và sự tử tế với người mặc." />
        <View style={st.cta}>
          <Text style={{ fontFamily:F.displaySb, color:'#f0d9b6', letterSpacing:3, fontSize:11 }}>PHONG CÁCH CÁCH TÂN</Text>
          <Text style={{ fontFamily:F.displayX, color:'#fff', fontSize:19, marginTop:6, marginBottom:10 }}>Đổi mới phong cách hôm nay</Text>
          <Btn label="Khám phá bộ sưu tập Nhật" onPress={()=>router.push('/(tabs)/products')} />
        </View>
      </ScrollView>
    </Screen>
  );
}
const st = StyleSheet.create({
  lead:{ fontFamily:F.body, fontSize:14, lineHeight:24, color:C.ink },
  blk:{ paddingVertical:14, borderTopWidth:1, borderTopColor:C.hair },
  p:{ fontFamily:F.body, fontSize:13, lineHeight:22, color:C.ink },
  cta:{ backgroundColor:C.ai, borderRadius:16, padding:16, alignItems:'center', marginVertical:16 },
});
