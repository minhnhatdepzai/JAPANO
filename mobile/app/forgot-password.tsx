import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Btn, Header } from '../components/ui';
import { useStore } from '../lib/store';
import { apiForgotPassword, apiResetPassword } from '../lib/api';
import { passwordStrength, STRENGTH_LABEL, STRENGTH_BARS } from '../lib/passwordStrength';
import { C, F } from '../theme/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const router = useRouter();
  const { showToast } = useStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);
  const strength = passwordStrength(newPassword);
  const emailValid = EMAIL_RE.test(email.trim());

  // Một nhịp đồng hồ chung cho cả hai bộ đếm: thời gian chờ gửi lại mã, và hạn
  // dùng của mã. Khách nhìn thấy con số thay vì phải đoán "bao lâu nữa thì được
  // bấm lại" hay "mã còn hiệu lực không".
  useEffect(() => {
    if (resendIn <= 0 && expiresIn <= 0) return;
    const timer = setInterval(() => {
      setResendIn(v => (v > 0 ? v - 1 : 0));
      setExpiresIn(v => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendIn, expiresIn]);

  const requestCode = async (isResend = false) => {
    if (sending) return;
    if (!emailValid) { showToast('Email chưa đúng định dạng — ví dụ ban@japano.vn','error'); return; }
    if (isResend && resendIn > 0) { showToast(`Vui lòng đợi ${resendIn} giây nữa mới gửi lại được.`,'info'); return; }
    setSending(true);
    try {
      const result = await apiForgotPassword(email.trim());
      showToast(result.message || 'Đã gửi mã đặt lại mật khẩu, vui lòng kiểm tra email.','success');
      setPreviewUrl(result.sandboxPreviewUrl || '');
      setResendIn(Number(result.resendAfterSeconds) || 60);
      setExpiresIn(Number(result.expiresInSeconds) || 30 * 60);
      setCode('');
      setStep(2);
    } catch (error: any) {
      showToast(error?.message || 'Không gửi được mã, vui lòng thử lại.','error');
    } finally { setSending(false); }
  };

  // Quay lại bước 1 để sửa email gõ nhầm — trước đây gõ sai một chữ là phải
  // thoát hẳn màn hình rồi vào lại.
  const editEmail = () => { setStep(1); setCode(''); setPreviewUrl(''); setExpiresIn(0); };

  const submitReset = async () => {
    if (sending) return;
    if (!code.trim() || !newPassword) { showToast('Vui lòng nhập mã và mật khẩu mới','error'); return; }
    if (strength === 'weak') { showToast('Mật khẩu mới quá yếu — hãy kết hợp chữ hoa, chữ thường, số hoặc ký tự đặc biệt.','error'); return; }
    setSending(true);
    try {
      const result = await apiResetPassword({ email: email.trim(), code: code.trim(), newPassword });
      showToast(result.message || 'Đã đặt lại mật khẩu, vui lòng đăng nhập lại.','success');
      // Mang email sang màn đăng nhập để khách khỏi gõ lại.
      router.replace({ pathname: '/login', params: { email: email.trim() } } as any);
    } catch (error: any) {
      showToast(error?.message || 'Không đặt lại được mật khẩu.','error');
    } finally { setSending(false); }
  };

  return (
    <Screen>
      <Header title="Quên mật khẩu" />
      <ScrollView contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <>
            <Text style={st.sub}>Nhập email đã đăng ký, chúng tôi sẽ gửi mã 6 số để đặt lại mật khẩu. Mã có hiệu lực 30 phút.</Text>
            <Text style={st.lbl}>Email</Text>
            <TextInput style={st.input} placeholder="ban@japano.vn" placeholderTextColor={C.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            {!!email.trim() && !emailValid && <Text style={st.warn}>Email chưa đúng định dạng.</Text>}
            <Btn label={sending ? 'Đang gửi…' : 'Gửi mã đặt lại'} onPress={() => void requestCode()} />
          </>
        ) : (
          <>
            <View style={{ flexDirection:'row', alignItems:'center', flexWrap:'wrap', marginBottom:12 }}>
              <Text style={[st.sub,{ marginBottom:0 }]}>Đã gửi mã 6 số tới <Text style={{ color:C.ink, fontFamily:F.bodyB }}>{email}</Text>. </Text>
              <Pressable onPress={editEmail} hitSlop={8}><Text style={{ color:C.ink, fontFamily:F.bodyB, fontSize:13 }}>Sửa email</Text></Pressable>
            </View>
            {expiresIn > 0
              ? <Text style={st.expiry}>Mã còn hiệu lực {Math.floor(expiresIn/60)} phút {String(expiresIn%60).padStart(2,'0')} giây</Text>
              : <Text style={st.warn}>Mã đã hết hạn — hãy bấm “Gửi lại mã”.</Text>}
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
                  {[0, 1, 2, 3].map(i => <View key={i} style={[st.bar, { backgroundColor: i < STRENGTH_BARS[strength] ? (strength === 'weak' ? C.danger : strength === 'medium' ? C.warning : C.matcha) : C.hair }]} />)}
                </View>
                <Text style={{ fontFamily: F.body, fontSize: 10.5, color: strength === 'weak' ? C.danger : strength === 'medium' ? C.warning : C.matcha, marginBottom: 14 }}>{STRENGTH_LABEL[strength]}</Text>
              </>
            )}
            <Btn label={sending ? 'Đang xử lý…' : 'Đặt lại mật khẩu'} onPress={() => void submitReset()} />
            <Pressable onPress={() => void requestCode(true)} hitSlop={8} disabled={resendIn > 0}>
              <Text style={[st.resend, resendIn > 0 && { color: C.muted }]}>
                {resendIn > 0 ? `Gửi lại mã sau ${resendIn} giây` : 'Chưa nhận được mã? Gửi lại mã'}
              </Text>
            </Pressable>
            <Text style={st.hint}>Không thấy thư? Kiểm tra thêm mục Quảng cáo và Spam trong hộp thư.</Text>
          </>
        )}
        {sending && <View style={{ marginTop: 10, alignItems: 'center' }}><ActivityIndicator color={C.ink} size="small" /></View>}
        <Text style={st.foot}>Nhớ ra mật khẩu rồi? <Text style={{ color: C.ink, fontFamily: F.bodyB }} onPress={() => router.replace('/login')}>Đăng nhập</Text></Text>
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
  resend: { textAlign: 'center', marginTop: 14, fontFamily: F.bodyB, fontSize: 12.5, color: C.ink },
  warn: { fontFamily: F.bodyM, fontSize: 11.5, color: C.danger, marginTop: -6, marginBottom: 12 },
  expiry: { fontFamily: F.bodyM, fontSize: 11.5, color: C.muted, marginBottom: 12 },
  hint: { textAlign: 'center', marginTop: 8, fontFamily: F.body, fontSize: 11, color: C.muted, lineHeight: 16 },
  foot: { textAlign: 'center', marginTop: 20, fontFamily: F.body, fontSize: 13, color: C.muted },
});
