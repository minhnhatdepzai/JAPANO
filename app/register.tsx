import React, { memo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { goBackOrReplace } from '../lib/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { StableTextInput } from '../components/StableTextInput';
import { fontFamily, radius, scaleFont, shadow } from '../lib/styles';
import AppButton from '../components/AppButton';

const AuthInput = memo(function AuthInput({ theme, label, ...props }: any) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <StableTextInput
        {...props}
        blurOnSubmit={false}
        autoCorrect={false}
        placeholderTextColor={theme.muted}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
      />
    </View>
  );
});

export default function RegisterScreen() {
  const { theme, register } = useApp();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);
      await register({ name, email: email.trim(), phone, password });
      goBackOrReplace();
    } catch (e: any) {
      Alert.alert('Không đăng ký được', e?.message || 'Kiểm tra backend Node.js hoặc email đã tồn tại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.page, { backgroundColor: theme.background, paddingTop: insets.top + 14 }]}> 
      <Pressable onPress={() => goBackOrReplace()} style={[styles.back, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Feather name="x" size={22} color={theme.text} />
      </Pressable>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
        <Text style={[styles.kicker, { color: theme.primary }]}>NEW CUSTOMER</Text>
        <Text style={[styles.title, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 34) }]}>Đăng ký</Text>
        <AuthInput theme={theme} label="Họ tên" value={name} onChangeText={setName} textContentType="name" autoComplete="name" />
        <AuthInput theme={theme} label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
        <AuthInput theme={theme} label="Số điện thoại" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" />
        <AuthInput theme={theme} label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" autoComplete="password-new" />
        <AppButton title="Tạo tài khoản" icon="user-plus" loading={loading} onPress={submit} />
        <Pressable onPress={() => router.replace('/login')}>
          <Text style={[styles.link, { color: theme.primary }]}>Đã có tài khoản? Đăng nhập</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 18 },
  back: { width: 46, height: 46, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: { marginTop: 20, borderWidth: 1, borderRadius: 0, padding: 18, gap: 13 },
  field: { gap: 6 },
  kicker: { fontSize: 11, letterSpacing: 2.2, fontWeight: '900' },
  title: { fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 0, paddingHorizontal: 14 },
  btn: { minHeight: 54, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '900', letterSpacing: 1.2 },
  link: { textAlign: 'center', fontWeight: '900', paddingVertical: 4 },
});
