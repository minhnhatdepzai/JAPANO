import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Btn } from '../components/ui';
import { EnsoAvatar } from '../components/ui';
import { C, F } from '../theme/tokens';

const Field = ({ label, def }:{label:string;def:string}) => (
  <View style={{ marginBottom:12 }}>
    <Text style={st.lbl}>{label}</Text>
    <TextInput style={st.input} defaultValue={def} placeholderTextColor={C.muted} />
  </View>
);
const STYLES = ['Tối giản','Đường phố','Nhật cổ','Thanh lịch'];
export default function Profile() {
  const router = useRouter();
  const [sel, setSel] = useState([0,2]);
  const toggle = (i:number)=> setSel(s=> s.includes(i)? s.filter(x=>x!==i): [...s,i]);
  return (
    <Screen>
      <Header title="Thông tin cá nhân" />
      <ScrollView contentContainerStyle={{ paddingHorizontal:18, paddingBottom:90 }}>
        <View style={{ alignItems:'center', marginBottom:16 }}>
          <View>
            <EnsoAvatar size={88} letter="M" />
            <View style={st.editDot}><Ionicons name="pencil" size={13} color="#fff" /></View>
          </View>
        </View>
        <Field label="Họ tên" def="Trần Minh" />
        <Field label="Email" def="minh@japano.vn" />
        <Field label="Số điện thoại" def="0901 234 567" />
        <View style={{ flexDirection:'row', gap:10 }}>
          <View style={{ flex:1 }}><Field label="Giới tính" def="Nam" /></View>
          <View style={{ flex:1 }}><Field label="Ngày sinh" def="12/08/1998" /></View>
        </View>
        <Text style={st.lbl}>Phong cách yêu thích</Text>
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:4 }}>
          {STYLES.map((s,i)=>(
            <Pressable key={s} style={[st.chip, sel.includes(i)&&st.chipOn]} onPress={()=>toggle(i)}>
              <Text style={{ fontFamily:F.bodyM, fontSize:11, color:sel.includes(i)?'#fff':C.ink }}>{s}</Text>
            </Pressable>
          ))}
        </View>
        <Btn label="Lưu thay đổi" style={{ marginTop:18 }} onPress={()=>router.back()} />
      </ScrollView>
    </Screen>
  );
}
const st = StyleSheet.create({
  lbl:{ fontFamily:F.bodyM, color:C.muted, fontSize:11, marginBottom:5 },
  input:{ minHeight:48, borderWidth:1, borderColor:C.line, borderRadius:12, backgroundColor:'#fff', paddingHorizontal:13, fontFamily:F.body, fontSize:14, color:C.ink },
  editDot:{ position:'absolute', bottom:2, right:2, width:28, height:28, borderRadius:14, backgroundColor:C.primary, alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:C.washi },
  chip:{ borderWidth:1, borderColor:C.line, borderRadius:999, paddingVertical:8, paddingHorizontal:12, backgroundColor:'#fff' },
  chipOn:{ backgroundColor:C.primary, borderColor:C.primary },
});
