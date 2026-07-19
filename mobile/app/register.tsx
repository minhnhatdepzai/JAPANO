import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Btn, Header } from '../components/ui';
import { C, F } from '../theme/tokens';
import { useAuth } from '../lib/auth';

const Field = ({ label, ph, value, onChangeText, secure }:{label:string;ph:string;value:string;onChangeText:(value:string)=>void;secure?:boolean}) => (
  <View style={{ marginBottom:13 }}>
    <Text style={st.lbl}>{label}</Text>
    <TextInput style={st.input} placeholder={ph} placeholderTextColor={C.muted} value={value} onChangeText={onChangeText} secureTextEntry={secure} autoCapitalize="none" />
  </View>
);
export default function Register() {
  const router = useRouter();
  const { register, continueAsGuest } = useAuth();
  const [name,setName]=useState('Trần Minh');
  const [email,setEmail]=useState('minh@japano.vn');
  const [phone,setPhone]=useState('0901234567');
  const [password,setPassword]=useState('password');
  const submit=async()=>{
    if(!name.trim()||!email.trim()||!phone.trim()||!password)return;
    const target=await register({name,email});
    router.replace(target||'/daily');
  };
  return (
    <Screen>
      <Header title="Tạo tài khoản" />
      <ScrollView contentContainerStyle={{ padding:18 }} keyboardShouldPersistTaps="handled">
        <Text style={st.sub}>Gia nhập JAPANO — mở khóa thử đồ thông minh, lộ trình mục tiêu và gợi ý theo gu.</Text>
        <Field label="Họ tên" ph="Trần Minh" value={name} onChangeText={setName} />
        <Field label="Email" ph="minh@japano.vn" value={email} onChangeText={setEmail} />
        <Field label="Số điện thoại" ph="0901 234 567" value={phone} onChangeText={setPhone} />
        <Field label="Mật khẩu" ph="••••••••" secure value={password} onChangeText={setPassword} />
        <View style={{ flexDirection:'row', gap:4, marginBottom:4 }}>
          <View style={[st.bar,{ backgroundColor:C.shu }]} /><View style={[st.bar,{ backgroundColor:C.shu }]} /><View style={[st.bar,{ backgroundColor:C.matcha }]} /><View style={[st.bar,{ backgroundColor:C.hair }]} />
        </View>
        <Text style={{ fontFamily:F.body, fontSize:10.5, color:C.matcha, marginBottom:14 }}>Mật khẩu mạnh vừa</Text>
        <Btn label="Đăng ký" onPress={()=>void submit()} />
        <Text style={st.foot}>Đã có tài khoản? <Text style={{ color:C.shu, fontFamily:F.bodyB }} onPress={()=>router.replace('/login')}>Đăng nhập</Text></Text>
        <Pressable onPress={continueAsGuest}><Text style={st.guest}>Tiếp tục xem sản phẩm không cần tài khoản</Text></Pressable>
      </ScrollView>
    </Screen>
  );
}
const st = StyleSheet.create({
  sub:{ fontFamily:F.body, color:C.muted, fontSize:13, marginBottom:14 },
  lbl:{ fontFamily:F.bodyM, color:C.muted, fontSize:11, marginBottom:5 },
  input:{ minHeight:48, borderWidth:1, borderColor:C.line, borderRadius:12, backgroundColor:'#fff', paddingHorizontal:13, fontFamily:F.body, fontSize:14, color:C.ink },
  bar:{ flex:1, height:4, borderRadius:2 },
  foot:{ textAlign:'center', marginTop:16, fontFamily:F.body, fontSize:13, color:C.muted },
  guest:{ textAlign:'center', marginTop:14, fontFamily:F.bodyB, fontSize:12.5, color:C.shu },
});
