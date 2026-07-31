import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Btn, Header } from '../components/ui';
import { useStore } from '../lib/store';
import { apiForgotPassword, apiResetPassword } from '../lib/api';
import { passwordStrength, STRENGTH_LABEL, STRENGTH_BARS } from '../lib/passwordStrength';
import { C, F } from '../theme/tokens';

export default function ForgotPassword() {
  const router = useRouter();
  const { showToast } = useStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const strength = passwordStrength(newPassword);

  const requestCode = async () => {
    if (sending || !email.trim()) { showToast('Vui lòng nhập email'); return; }
    setSending(true);
    try {
      const result = await apiForgotPassword(email.trim());
      showToast(result.message || 'Đã gửi mã đặt lại mật khẩu, vui lòng kiểm tra email.');
      setPreviewUrl(result.sandboxPreviewUrl || '');
      setStep(2);
    } catch (error: any) {
      showToast(error?.message || 'Không gửi được mã, vui lòng thử lại.');
    } finally { setSending(false); }
  };

  const submitReset = async () => {
    if (sending) return;
    if (!code.trim() || !newPassword) { showToast('Vui lòng nhập mã và mật khẩu mới'); return; }
    if (strength === 'weak') { showToast('Mật khẩu mới quá yếu — hãy kết hợp chữ hoa, chữ thường, số hoặc ký tự đặc biệt.'); return; }
    setSending(true);
    try {
      const result = await apiResetPassword({ email: email.trim(), code: code.trim(), newPassword });
      showToast(result.message || 'Đã đặt lại mật khẩu, vui lòng đăng nhập lại.');
      router.replace('/login');
    } catch (error: any) {
      showToast(error?.message || 'Không đặt lại được mật khẩu.');
    } finally { setSending(false); }
  };

  return (
    <Screen>
      <Header title="Quên mật khẩu" />
      <ScrollView contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <>
            <Text style={st.sub}>Nhập email đã đăng ký, chúng tôi sẽ gửi mã 6 số để đặt lại mật khẩu.</Text>
            <Text style={st.lbl}>Email</Text>
            <TextInput style={st.input} placeholder="ban@japano.vn" placeholderTextColor={C.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <Btn label={sending ? 'Đang gửi…' : 'Gửi mã đặt lại'} onPress={() => void requestCode()} />
          </>
        ) : (
          <>
            <Text style={st.sub}>Đã gửi mã 6 số tới {email}. Nhập mã và mật khẩu mới bên dưới.</Text>
            {!!previewUrl && (
              <Pressable style={st.previewBox} onPress={() => Linking.openURL(previewUrl)}>
                <Text style={st.previewT}>Môi trường thử nghiệm chưa gắn hộp thư thật — chạm để xem email vừa gửi ✦</Text>
              </Pressable>
            )}
            <Text style={st.lbl}>Mã xác nhận (6 số)</Text>
            <TextInput style={st.input} placeholder="123456" placeholderTextColor={C.muted} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
            <Text style={st.lbl}>Mật khẩu mới</Text>
            <TextInput style={st.input} placeholder="••••••••" placeholderTextColor={C.muted} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
            {!!newPassword && (
              <>
                <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
                  {[0, 1, 2, 3].map(i => <View key={i} style={[st.bar, { backgroundColor: i < STRENGTH_BARS[strength] ? (strength === 'weak' ? C.danger : strength === 'medium' ? '#D98A2E' : C.matcha) : C.hair }]} />)}
                </View>
                <Text style={{ fontFamily: F.body, fontSize: 10.5, color: strength === 'weak' ? C.danger : strength === 'medium' ? '#D98A2E' : C.matcha, marginBottom: 14 }}>{STRENGTH_LABEL[strength]}</Text>
              </>
            )}
            <Btn label={sending ? 'Đang xử lý…' : 'Đặt lại mật khẩu'} onPress={() => void submitReset()} />
            <Pressable onPress={() => void requestCode()} hitSlop={8}><Text style={st.resend}>Chưa nhận được mã? Gửi lại</Text></Pressable>
          </>
        )}
        {sending && <View style={{ marginTop: 10, alignItems: 'center' }}><ActivityIndicator color={C.shu} size="small" /></View>}
        <Text style={st.foot}>Nhớ ra mật khẩu rồi? <Text style={{ color: C.shu, fontFamily: F.bodyB }} onPress={() => router.replace('/login')}>Đăng nhập</Text></Text>
      </ScrollView>
    </Screen>
  );
}
const st = StyleSheet.create({
  sub: { fontFamily: F.body, color: C.muted, fontSize: 13, marginBottom: 16, lineHeight: 19 },
  lbl: { fontFamily: F.bodyM, color: C.muted, fontSize: 11, marginBottom: 5 },
  input: { minHeight: 48, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: '#fff', paddingHorizontal: 13, fontFamily: F.body, fontSize: 14, color: C.ink, marginBottom: 13 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  previewBox: { backgroundColor: C.aiSoft, borderRadius: 11, padding: 11, marginBottom: 14 },
  previewT: { fontFamily: F.bodyM, fontSize: 11.5, color: C.ai, lineHeight: 16 },
  resend: { textAlign: 'center', marginTop: 14, fontFamily: F.bodyB, fontSize: 12.5, color: C.shu },
  foot: { textAlign: 'center', marginTop: 20, fontFamily: F.body, fontSize: 13, color: C.muted },
});
