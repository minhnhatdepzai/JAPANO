import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Btn, Streak } from '../components/ui';
import { C, F } from '../theme/tokens';
import { PRODUCTS } from '../lib/catalog';
import { loadStyleProfile, saveStyleProfile } from '../lib/profile';
import { saveRemoteStyleProfile } from '../lib/api';
import { SmartImage } from '../components/SmartImage';

const OPTS = [
  { k:'toi-gian', label:'Tối giản', img: PRODUCTS.find(p=>p.slug==='cardigan-dai')?.images[0] },
  { k:'duong-pho', label:'Đường phố', img: PRODUCTS.find(p=>p.slug==='dong-phuc-thuy-thu')?.images[0] },
  { k:'thanh-lich', label:'Thanh lịch', img: PRODUCTS.find(p=>p.slug==='blazer-kaki')?.images[0] },
  { k:'nhat-co', label:'Nhật cổ', img: PRODUCTS.find(p=>p.slug==='kimono-hong')?.images[0] },
];
export default function Daily() {
  const router = useRouter();
  const [sel, setSel] = useState('toi-gian');
  const [saving,setSaving]=useState(false);
  const [streak,setStreak]=useState(0);
  useEffect(()=>{ void loadStyleProfile().then(p=>{setSel(p.style||'toi-gian');setStreak(Number(p.streak||0));}); },[]);
  const dateLabel=useMemo(()=>new Intl.DateTimeFormat('vi-VN',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),[]);
  const save=async()=>{
    setSaving(true);
    const today=new Date().toISOString().slice(0,10);
    const current=await loadStyleProfile();
    const nextStreak=current.lastQuizDate===today?Number(current.streak||1):Number(current.streak||0)+1;
    const profile=await saveStyleProfile({style:sel,lastQuizDate:today,streak:nextStreak});
    void saveRemoteStyleProfile(profile).catch(()=>undefined);
    setStreak(nextStreak); setSaving(false); router.replace('/(tabs)');
  };
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding:18 }}>
        <View style={{ paddingVertical:8 }}>
          <Text style={{ fontFamily:F.displaySb, color:C.kin, letterSpacing:3, fontSize:11 }}>HÔM NAY · {dateLabel}</Text>
          <Text style={st.hi}>Xin chào,{'\n'}Minh 👋</Text>
          <Text style={st.sub}>Chớm thu — hợp tông trầm và vải đũi.</Text>
        </View>
        <View style={st.card}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <Text style={{ fontFamily:F.display, fontSize:16, color:C.sumi }}>Câu hỏi hôm nay</Text>
            <Streak label={`🔥 ${streak} ngày`} />
          </View>
          <Text style={st.q}>Hôm nay bạn thích phong cách nào?</Text>
          <View style={st.grid}>
            {OPTS.map(o=>(
              <Pressable key={o.k} style={[st.opt, sel===o.k && st.optSel]} onPress={()=>setSel(o.k)}>
                <SmartImage source={o.img} style={{ height:78, width:'100%' }} recyclingKey={`daily-${o.k}`} />
                <Text style={st.optLbl}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
          <Btn label={saving?'Đang lưu…':'Lưu & xem gợi ý'} onPress={()=>{if(!saving)void save();}} />
          <Text style={st.skip} onPress={()=>router.replace('/(tabs)')}>Bỏ qua hôm nay</Text>
        </View>
        <Text style={{ textAlign:'center', color:C.kin, fontFamily:F.body, fontSize:12, marginTop:14 }}>Trả lời để hệ thống hiểu gu và gợi ý đồ Nhật hợp bạn ✦</Text>
      </ScrollView>
    </Screen>
  );
}
const st = StyleSheet.create({
  hi:{ fontFamily:F.displayX, fontSize:29, color:C.sumi, marginTop:6, lineHeight:34 },
  sub:{ fontFamily:F.body, color:C.muted, fontSize:13.5, marginTop:6 },
  card:{ padding:16, borderRadius:18, backgroundColor:C.card, borderWidth:1, borderColor:C.line },
  q:{ fontFamily:F.bodyM, fontSize:14, color:C.ink, marginTop:10, marginBottom:2 },
  grid:{ flexDirection:'row', flexWrap:'wrap', gap:10, marginVertical:14 },
  opt:{ width:'47%', flexGrow:1, borderWidth:1.5, borderColor:C.line, borderRadius:14, overflow:'hidden', backgroundColor:C.card },
  optSel:{ borderColor:C.primary },
  optLbl:{ padding:8, fontFamily:F.bodyB, fontSize:12, textAlign:'center', color:C.ink },
  skip:{ textAlign:'center', marginTop:10, fontFamily:F.body, fontSize:12.5, color:C.muted },
});
