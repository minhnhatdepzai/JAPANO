import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { StableTextInput } from '../components/StableTextInput';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { cardStyle, fontFamily, radius, scaleFont, shadow } from '../lib/styles';

const fields = [
  ['heightCm', 'Chiều cao cm'],
  ['weightKg', 'Cân nặng kg'],
  ['shoulderCm', 'Vai cm'],
  ['chestCm', 'Ngực cm'],
  ['waistCm', 'Eo cm'],
  ['hipCm', 'Mông cm'],
] as const;

const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const fits = ['regular', 'slim', 'oversize'];

export default function BodyProfileScreen() {
  const { theme, user, requireLogin } = useApp();
  const userId = user?.id || 'guest';
  const [form, setForm] = useState<Record<string, string>>({ usualSize: 'M', fitPreference: 'regular' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    api.getBodyProfile(user.id).then((data: any) => {
      const body = data?.bodyProfile || {};
      const next: Record<string, string> = { usualSize: body.usualSize || 'M', fitPreference: body.fitPreference || 'regular' };
      fields.forEach(([key]) => { if (body[key]) next[key] = String(body[key]); });
      setForm(next);
    }).catch(() => null);
  }, [user?.id]);

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!requireLogin('Đăng nhập để lưu hồ sơ số đo và dùng AI gợi ý size khi xem sản phẩm.')) return;
    setSaving(true);
    try {
      const payload: any = { usualSize: form.usualSize, fitPreference: form.fitPreference };
      fields.forEach(([key]) => { payload[key] = Number(form[key] || 0) || undefined; });
      await api.saveBodyProfile(userId, payload);
      Alert.alert('Đã lưu', 'Từ giờ khi vào sản phẩm, app sẽ gợi ý size và độ vừa dựa trên số đo này.');
    } catch (error: any) {
      Alert.alert('Chưa lưu được', error?.message || 'Kiểm tra backend rồi thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const Choice = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[styles.choice, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primary : theme.card }]}> 
      <Text style={[styles.choiceText, { color: active ? theme.background : theme.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header title="Hồ sơ số đo" subtitle="Dùng để gợi ý size khi xem sản phẩm và thử đồ AI" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[cardStyle(theme), styles.hero]}>
          <Feather name="user-check" size={26} color={theme.primary} />
          <Text style={[styles.title, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 27) }]}>Nhập số đo một lần, AI dùng toàn app</Text>
          <Text style={[styles.desc, { color: theme.muted }]}>App sẽ báo “nên chọn size M”, “áo này hơi rộng”, hoặc “quần hợp dáng người của bạn” khi xem sản phẩm.</Text>
        </View>

        <View style={[cardStyle(theme), styles.card]}>
          {fields.map(([key, label]) => (
            <StableTextInput key={key} placeholder={label} keyboardType="numeric" value={form[key] || ''} onChangeText={(v) => set(key, v)} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} placeholderTextColor={theme.muted} />
          ))}
        </View>

        <View style={[cardStyle(theme), styles.card]}>
          <Text style={[styles.label, { color: theme.heading }]}>Size thường mặc</Text>
          <View style={styles.wrap}>{sizes.map((item) => <Choice key={item} label={item} active={form.usualSize === item} onPress={() => set('usualSize', item)} />)}</View>
        </View>

        <View style={[cardStyle(theme), styles.card]}>
          <Text style={[styles.label, { color: theme.heading }]}>Form thích mặc</Text>
          <View style={styles.wrap}>{fits.map((item) => <Choice key={item} label={item} active={form.fitPreference === item} onPress={() => set('fitPreference', item)} />)}</View>
        </View>

        <Pressable disabled={saving} onPress={save} style={[styles.primaryBtn, { backgroundColor: theme.primary }, shadow(theme)]}> 
          <Text style={[styles.primaryText, { color: theme.background }]}>{saving ? 'Đang lưu...' : 'Lưu hồ sơ số đo'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 80 },
  hero: { padding: 18, gap: 10 },
  title: { fontWeight: '900', lineHeight: 33 },
  desc: { lineHeight: 21 },
  card: { padding: 14, gap: 10 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 0, paddingHorizontal: 12, fontWeight: '800' },
  label: { fontSize: 16, fontWeight: '900' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderRadius: 0, paddingHorizontal: 13, paddingVertical: 9 },
  choiceText: { fontWeight: '900', fontSize: 12 },
  primaryBtn: { height: 54, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontWeight: '900', letterSpacing: 1 },
});
