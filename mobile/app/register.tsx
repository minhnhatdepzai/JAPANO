import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Btn, Header } from '../components/ui';
import { C, F } from '../theme/tokens';
import { useAuth } from '../lib/auth';
import { useStore } from '../lib/store';
import { passwordStrength, STRENGTH_LABEL, STRENGTH_BARS } from '../lib/passwordStrength';

const Field = ({ label, ph, value, onChangeText, secure }:{label:string;ph:string;value:string;onChangeText:(value:string)=>void;secure?:boolean}) => (
  <View style={{ marginBottom:13 }}>
    <Text style={st.lbl}>{label}</Text>
    <TextInput style={st.input} placeholder={ph} placeholderTextColor={C.muted} value={value} onChangeText={onChangeText} secureTextEntry={secure} autoCapitalize="none" />
  </View>
);
export default function Register() {
  const router = useRouter();
  const { register, continueAsGuest } = useAuth();
  const { showToast } = useStore();
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [phone,setPhone]=useState('');
  const [password,setPassword]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const strength=passwordStrength(password);
  const submit=async()=>{
    if(submitting)return;
    if(!name.trim()||!email.trim()||!phone.trim()||!password){
      showToast('Vui lòng điền đủ thông tin','error');
      return;
    }
    if(password.length<8){
      showToast('Mật khẩu cần ít nhất 8 ký tự','error');
      return;
    }
    if(strength==='weak'){
      showToast('Mật khẩu quá yếu — hãy kết hợp chữ hoa, chữ thường, số hoặc ký tự đặc biệt.','error');
      return;
    }
    setSubmitting(true);
    try{
      const target=await register({name:name.trim(),email:email.trim(),password});
      router.replace(target||'/daily');
    }catch(error:any){
      showToast(error?.message||'Không đăng ký được, vui lòng thử lại.','error');
    }finally{
      setSubmitting(false);
    }
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
        {!!password&&<>
          <View style={{ flexDirection:'row', gap:4, marginBottom:4 }}>
            {[0,1,2,3].map(i=><View key={i} style={[st.bar,{ backgroundColor:i<STRENGTH_BARS[strength]?(strength==='weak'?C.danger:strength==='medium'?C.warning:C.matcha):C.hair }]} />)}
          </View>
          <Text style={{ fontFamily:F.body, fontSize:10.5, color:strength==='weak'?C.danger:strength==='medium'?C.warning:C.matcha, marginBottom:14 }}>{STRENGTH_LABEL[strength]}{strength==='weak'?' — cần ít nhất 8 ký tự, kết hợp chữ hoa/thường/số':''}</Text>
        </>}
        <Btn label={submitting?'Đang đăng ký…':'Đăng ký'} onPress={()=>void submit()} />
        {submitting && <View style={{ marginTop:10, alignItems:'center' }}><ActivityIndicator color={C.ink} size="small" /></View>}
        <Text style={st.foot}>Đã có tài khoản? <Text style={{ color:C.ink, fontFamily:F.bodyB }} onPress={()=>router.replace('/login')}>Đăng nhập</Text></Text>
        <Pressable onPress={continueAsGuest}><Text style={st.guest}>Tiếp tục xem sản phẩm không cần tài khoản</Text></Pressable>
      </ScrollView>
    </Screen>
  );
}
const st = StyleSheet.create({
  sub:{ fontFamily:F.body, color:C.muted, fontSize:13, marginBottom:14 },
  lbl:{ fontFamily:F.bodyM, color:C.muted, fontSize:11, marginBottom:5 },
  input:{ minHeight:48, borderWidth:1, borderColor:C.line, borderRadius:12, backgroundColor:C.card, paddingHorizontal:13, fontFamily:F.body, fontSize:14, color:C.ink },
  bar:{ flex:1, height:4, borderRadius:2 },
  foot:{ textAlign:'center', marginTop:16, fontFamily:F.body, fontSize:13, color:C.muted },
  guest:{ textAlign:'center', marginTop:14, fontFamily:F.bodyB, fontSize:12.5, color:C.ink },
});
