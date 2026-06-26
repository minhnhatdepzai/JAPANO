import React, { memo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { goBackOrReplace } from '../lib/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { StableTextInput } from '../components/StableTextInput';
import { fontFamily, radius, scaleFont, shadow } from '../lib/styles';

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

function getSafeRedirect(raw: unknown) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const redirect = typeof value === 'string' ? value.trim() : '';
  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//')) return '';
  if (redirect.includes('login') || redirect.includes('register') || redirect.includes('forgot-password')) return '';
  return redirect;
}

export default function LoginScreen() {
  const { theme, login } = useApp();
  const params = useLocalSearchParams<{ redirectTo?: string }>();
  const redirectTo = getSafeRedirect(params.redirectTo);
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);
      await login(email.trim(), password);
      if (redirectTo) {
        router.replace(redirectTo as any);
      } else {
        goBackOrReplace();
      }
    } catch (e: any) {
      Alert.alert('Không đăng nhập được', e?.message || 'Kiểm tra email/mật khẩu hoặc backend Node.js.');
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
        <Text style={[styles.kicker, { color: theme.primary }]}>JAPANO ACCOUNT</Text>
        <Text style={[styles.title, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 34) }]}>Đăng nhập</Text>
        <Text style={[styles.desc, { color: theme.muted }]}>Đăng nhập để mua hàng, lưu giỏ, thanh toán, yêu thích và đồng bộ dữ liệu với MongoDB.</Text>
        <AuthInput theme={theme} label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
        <AuthInput theme={theme} label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="password" />
        <Pressable disabled={loading} onPress={submit} style={[styles.btn, { backgroundColor: theme.primary, opacity: loading ? 0.7 : 1 }]}>
          <Text style={[styles.btnText, { color: theme.background }]}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/forgot-password')}>
          <Text style={[styles.link, { color: theme.primary }]}>Quên mật khẩu?</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/register')}>
          <Text style={[styles.link, { color: theme.primary }]}>Chưa có tài khoản? Đăng ký</Text>
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
  desc: { fontSize: 14, lineHeight: 21 },
  label: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 0, paddingHorizontal: 14 },
  btn: { minHeight: 54, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '900', letterSpacing: 1.2 },
  link: { textAlign: 'center', fontWeight: '900', paddingVertical: 4 },
});
