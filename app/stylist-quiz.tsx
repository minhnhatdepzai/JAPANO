import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Header } from '../components/Header';
import { StableTextInput } from '../components/StableTextInput';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { cardStyle, fontFamily, radius, scaleFont, shadow } from '../lib/styles';

const styleOptions = ['Tối giản', 'Streetwear', 'Nhật cổ', 'Công sở', 'Dễ thương', 'Cosplay', 'Thanh lịch'];
const occasionOptions = ['Hôm nay mặc gì', 'Đi chơi', 'Đi học/đi làm', 'Đi tiệc', 'Đi hẹn hò', 'Đi lễ hội'];
const skinOptions = ['Sáng', 'Trung bình', 'Ngăm', 'Không chắc'];
const genderOptions = ['Nữ', 'Nam', 'Unisex'];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function StylistQuizScreen() {
  const { theme, user, requireLogin } = useApp();
  const userId = user?.id || 'guest';
  const [gender, setGender] = useState('Unisex');
  const [styles, setStyles] = useState<string[]>(['Tối giản']);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [skinTone, setSkinTone] = useState('Trung bình');
  const [occasion, setOccasion] = useState('Hôm nay mặc gì');
  const [budget, setBudget] = useState('500000');
  const [saving, setSaving] = useState(false);

  const localDoneKey = useMemo(() => `japano.stylistQuizDone.${userId}.${todayKey()}`, [userId]);

  const toggleStyle = (value: string) => {
    setStyles((prev) => prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value].slice(0, 4));
  };

  const finish = async (skip = false) => {
    if (!skip && !requireLogin('Đăng nhập để AI Stylist lưu quiz hằng ngày, số đo và gợi ý outfit cá nhân hóa.')) return;
    setSaving(true);
    try {
      const answers = {
        gender,
        preferredStyles: styles,
        heightCm: Number(heightCm || 0) || undefined,
        weightKg: Number(weightKg || 0) || undefined,
        skinTone,
        occasion,
        budget: Number(budget || 0) || undefined,
      };
      if (!skip) await api.saveDailyStylistQuiz(userId, { dateKey: todayKey(), answers });
      await AsyncStorage.setItem(localDoneKey, '1');
      router.replace(skip ? '/(tabs)' : '/ai-stylist');
    } catch (error: any) {
      Alert.alert('Chưa lưu được quiz', error?.message || 'Kiểm tra backend rồi thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const Choice = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[stylesCss.choice, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primary : theme.card }]}> 
      <Text style={[stylesCss.choiceText, { color: active ? theme.background : theme.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header title="Quiz AI Stylist" subtitle="Mỗi ngày trả lời nhanh để AI chọn set đồ cá nhân hơn" />
      <ScrollView contentContainerStyle={stylesCss.content} showsVerticalScrollIndicator>
        <View style={[cardStyle(theme), stylesCss.hero]}>
          <Feather name="zap" size={28} color={theme.primary} />
          <Text style={[stylesCss.title, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 28) }]}>Hôm nay bạn muốn mặc theo vibe nào?</Text>
          <Text style={[stylesCss.desc, { color: theme.muted, fontSize: scaleFont(theme, 14) }]}>Quiz này dùng cho AI Stylist, chatbot, gợi ý size và bộ sưu tập outfit. Bạn có thể bỏ qua hôm nay.</Text>
        </View>

        <View style={[cardStyle(theme), stylesCss.card]}>
          <Text style={[stylesCss.label, { color: theme.heading }]}>Giới tính / hướng phối</Text>
          <View style={stylesCss.wrap}>{genderOptions.map((item) => <Choice key={item} label={item} active={gender === item} onPress={() => setGender(item)} />)}</View>
        </View>

        <View style={[cardStyle(theme), stylesCss.card]}>
          <Text style={[stylesCss.label, { color: theme.heading }]}>Phong cách thích</Text>
          <View style={stylesCss.wrap}>{styleOptions.map((item) => <Choice key={item} label={item} active={styles.includes(item)} onPress={() => toggleStyle(item)} />)}</View>
        </View>

        <View style={[cardStyle(theme), stylesCss.card]}>
          <Text style={[stylesCss.label, { color: theme.heading }]}>Số đo cơ bản</Text>
          <View style={stylesCss.twoCols}>
            <StableTextInput placeholder="Chiều cao cm" keyboardType="numeric" value={heightCm} onChangeText={setHeightCm} style={[stylesCss.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]} placeholderTextColor={theme.muted} />
            <StableTextInput placeholder="Cân nặng kg" keyboardType="numeric" value={weightKg} onChangeText={setWeightKg} style={[stylesCss.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]} placeholderTextColor={theme.muted} />
          </View>
        </View>

        <View style={[cardStyle(theme), stylesCss.card]}>
          <Text style={[stylesCss.label, { color: theme.heading }]}>Màu da</Text>
          <View style={stylesCss.wrap}>{skinOptions.map((item) => <Choice key={item} label={item} active={skinTone === item} onPress={() => setSkinTone(item)} />)}</View>
        </View>

        <View style={[cardStyle(theme), stylesCss.card]}>
          <Text style={[stylesCss.label, { color: theme.heading }]}>Dịp cần mặc</Text>
          <View style={stylesCss.wrap}>{occasionOptions.map((item) => <Choice key={item} label={item} active={occasion === item} onPress={() => setOccasion(item)} />)}</View>
        </View>

        <View style={[cardStyle(theme), stylesCss.card]}>
          <Text style={[stylesCss.label, { color: theme.heading }]}>Ngân sách</Text>
          <StableTextInput placeholder="Ví dụ: 500000" keyboardType="numeric" value={budget} onChangeText={setBudget} style={[stylesCss.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]} placeholderTextColor={theme.muted} />
        </View>

        <Pressable disabled={saving} onPress={() => finish(false)} style={[stylesCss.primaryBtn, { backgroundColor: theme.primary }, shadow(theme)]}> 
          <Text style={[stylesCss.primaryText, { color: theme.background }]}>{saving ? 'Đang lưu...' : 'Tạo gợi ý AI Stylist'}</Text>
        </Pressable>
        <Pressable disabled={saving} onPress={() => finish(true)} style={[stylesCss.skipBtn, { borderColor: theme.border }]}> 
          <Text style={[stylesCss.skipText, { color: theme.muted }]}>Bỏ qua hôm nay</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const stylesCss = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 80 },
  hero: { padding: 18, gap: 10 },
  title: { fontWeight: '900', lineHeight: 34 },
  desc: { lineHeight: 21 },
  card: { padding: 14, gap: 12 },
  label: { fontWeight: '900', fontSize: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderRadius: 0, paddingHorizontal: 13, paddingVertical: 9 },
  choiceText: { fontWeight: '900', fontSize: 12 },
  twoCols: { flexDirection: 'row', gap: 10 },
  input: { borderWidth: 1, borderRadius: 0, minHeight: 48, paddingHorizontal: 12, flex: 1, fontWeight: '700' },
  primaryBtn: { height: 54, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontWeight: '900', letterSpacing: 1 },
  skipBtn: { height: 48, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontWeight: '900' },
});
