import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { goBackOrReplace } from '../lib/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { StableTextInput } from '../components/StableTextInput';
import { fontFamily, radius, scaleFont, shadow } from '../lib/styles';

export default function ForgotPasswordScreen() {
  const { theme, forgotPassword } = useApp();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');

  const submit = async () => {
    try {
      await forgotPassword(email.trim());
      Alert.alert('Đã ghi nhận', 'Backend đã nhận yêu cầu quên mật khẩu. Bạn có thể tích hợp gửi email sau.');
      goBackOrReplace();
    } catch (e: any) {
      Alert.alert('Không gửi được', e?.message || 'Kiểm tra backend.');
    }
  };

  return (
    <View style={[styles.page, { backgroundColor: theme.background, paddingTop: insets.top + 18 }]}> 
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        <Text style={[styles.title, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 32) }]}>Quên mật khẩu</Text>
        <Text style={[styles.desc, { color: theme.muted }]}>Nhập email tài khoản để lưu yêu cầu reset vào database.</Text>
        <StableTextInput
          value={email}
          blurOnSubmit={false}
          autoCorrect={false}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          placeholder="email@example.com"
          placeholderTextColor={theme.muted}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
        />
        <Pressable onPress={submit} style={[styles.btn, { backgroundColor: theme.primary }]}>
          <Text style={[styles.btnText, { color: theme.background }]}>Gửi yêu cầu</Text>
        </Pressable>
        <Pressable onPress={() => goBackOrReplace()}>
          <Text style={[styles.link, { color: theme.primary }]}>Quay lại</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 18 },
  card: { marginTop: 50, borderWidth: 1, borderRadius: 0, padding: 18, gap: 14 },
  title: { fontWeight: '900' },
  desc: { fontSize: 14, lineHeight: 21 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 0, paddingHorizontal: 14 },
  btn: { minHeight: 54, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '900', letterSpacing: 1.2 },
  link: { textAlign: 'center', fontWeight: '900' },
});
