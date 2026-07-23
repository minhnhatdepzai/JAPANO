import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Btn, Chip } from '../components/ui';
import { Enso } from '../components/art';
import { useStore } from '../lib/store';
import { useAuth } from '../lib/auth';
import { C, F } from '../theme/tokens';

export default function Login() {
  const router = useRouter();
  const { showToast } = useStore();
  const { signIn, continueAsGuest } = useAuth();
  const [show, setShow] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [email, setEmail] = useState('ban@japano.vn');
  const [password, setPassword] = useState('password');
  const submit = async () => {
    if (signingIn) return;
    if (!email.trim() || !password) {
      showToast('Vui lòng nhập email và mật khẩu');
      return;
    }
    setSigningIn(true);
    await new Promise(resolve => setTimeout(resolve, 350));
    const target = await signIn({ email, name:'Trần Minh' });
    setSigningIn(false);
    router.replace(target || '/daily');
  };
  const soon = (label:string) => showToast(`${label} sẽ sớm ra mắt ✦`);
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding:18, paddingTop:24 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems:'center', marginBottom:16 }}>
          <Enso size={58} />
          <Text style={st.h}>Chào mừng bạn trở lại</Text>
          <Text style={st.sub}>Mở khóa thử đồ thông minh, mục tiêu mua sắm và gợi ý dành riêng cho bạn.</Text>
        </View>
        <Text style={st.lbl}>Email</Text>
        <TextInput style={st.input} placeholder="ban@japano.vn" placeholderTextColor={C.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Text style={st.lbl}>Mật khẩu</Text>
        <View style={[st.input,{ flexDirection:'row', alignItems:'center' }]}>
          <TextInput style={{ flex:1, fontFamily:F.body, fontSize:14, color:C.ink }} placeholder="••••••••" placeholderTextColor={C.muted} secureTextEntry={!show} value={password} onChangeText={setPassword} />
          <Pressable onPress={()=>setShow(s=>!s)}><Text style={{ color:C.muted, fontFamily:F.bodyM }}>{show?'Ẩn':'Hiện'}</Text></Pressable>
        </View>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginVertical:14 }}>
          <Text style={{ color:C.muted, fontFamily:F.body, fontSize:12.5 }}>Ghi nhớ đăng nhập</Text>
          <Pressable onPress={()=>soon('Khôi phục mật khẩu')} hitSlop={8}><Text style={{ color:C.shu, fontFamily:F.bodyB, fontSize:12.5 }}>Quên mật khẩu?</Text></Pressable>
        </View>
        <Btn label={signingIn?'Đang đăng nhập…':'Đăng nhập'} onPress={submit} />
        {signingIn && <View style={{ marginTop:10, alignItems:'center' }}><ActivityIndicator color={C.shu} size="small" /></View>}
        <View style={st.orRow}><View style={st.hr} /><Text style={st.or}>hoặc</Text><View style={st.hr} /></View>
        <View style={{ flexDirection:'row', gap:10 }}>
          <Pressable style={[st.social]} onPress={()=>soon('Đăng nhập bằng Google')}><Ionicons name="logo-google" size={18} color={C.ink} /><Text style={st.socialT}>Bằng Google</Text></Pressable>
          <Pressable style={[st.social]} onPress={()=>soon('Đăng nhập bằng Apple')}><Ionicons name="logo-apple" size={18} color={C.ink} /><Text style={st.socialT}>Bằng Apple</Text></Pressable>
        </View>
        <Text style={st.foot}>Chưa có tài khoản? <Text style={{ color:C.shu, fontFamily:F.bodyB }} onPress={()=>router.push('/register')}>Đăng ký</Text></Text>
        <Pressable style={st.guest} onPress={continueAsGuest}>
          <Ionicons name="grid-outline" size={17} color={C.shu} />
          <Text style={st.guestT}>Tiếp tục xem sản phẩm không cần đăng nhập</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
const st = StyleSheet.create({
  h:{ fontFamily:F.display, fontSize:26, color:C.sumi, marginTop:4 },
  sub:{ fontFamily:F.body, color:C.muted, fontSize:13, marginTop:4, textAlign:'center' },
  lbl:{ fontFamily:F.bodyM, color:C.muted, fontSize:11, marginBottom:5 },
  input:{ minHeight:48, borderWidth:1, borderColor:C.line, borderRadius:12, backgroundColor:'#fff', paddingHorizontal:13, fontFamily:F.body, fontSize:14, color:C.ink, marginBottom:13, justifyContent:'center' },
  orRow:{ flexDirection:'row', alignItems:'center', gap:10, marginVertical:16 },
  hr:{ flex:1, height:1, backgroundColor:C.hair }, or:{ color:C.muted, fontFamily:F.body, fontSize:12 },
  social:{ flex:1, height:46, borderWidth:1, borderColor:C.line, borderRadius:12, backgroundColor:'#fff', flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 },
  socialT:{ fontFamily:F.bodyM, color:C.ink, fontSize:13 },
  foot:{ textAlign:'center', marginTop:18, fontFamily:F.body, fontSize:13, color:C.muted },
  guest:{ marginTop:14, minHeight:46, borderWidth:1, borderColor:C.shu, borderRadius:12, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingHorizontal:12 },
  guestT:{ color:C.shu, fontFamily:F.bodyB, fontSize:12.5, textAlign:'center' },
});
