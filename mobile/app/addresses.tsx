import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Btn } from '../components/ui';
import { getProvinces, getWards, VietnamLocation } from '../lib/api';
import { deleteAddress, listAddresses, SavedAddress, setDefaultAddress, upsertAddress } from '../lib/addresses';
import { useAuth } from '../lib/auth';
import { C, F } from '../theme/tokens';

const emptyDraft = (name = '') => ({
  title: '', name, phone: '', street: '',
  province: null as VietnamLocation | null,
  ward: null as VietnamLocation | null,
});

export default function Addresses() {
  const { user, requireAuth } = useAuth();
  const [items, setItems] = useState<SavedAddress[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [provinces, setProvinces] = useState<VietnamLocation[]>([]);
  const [provinceQuery, setProvinceQuery] = useState('');
  const [provinceOpen, setProvinceOpen] = useState(false);
  const [wards, setWards] = useState<VietnamLocation[]>([]);
  const [wardQuery, setWardQuery] = useState('');
  const [wardOpen, setWardOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => { void listAddresses(user?.id).then(setItems).finally(() => setLoaded(true)); }, [user?.id]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => { void getProvinces().then(setProvinces); }, []);
  useEffect(() => {
    if (!draft.province) { setWards([]); return; }
    let live = true;
    const timer = setTimeout(() => {
      getWards(draft.province!.code, wardQuery, 200).then(data => { if (live) setWards(data.items); }).catch(() => undefined);
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [draft.province?.code, wardQuery]);
  const shownProvinces = provinces.filter(item => !provinceQuery.trim() || item.name.toLocaleLowerCase('vi').normalize('NFD').replace(/[̀-ͯ]/g, '').includes(provinceQuery.toLocaleLowerCase('vi').normalize('NFD').replace(/[̀-ͯ]/g, '')));

  const startNew = () => {
    setDraft(emptyDraft(user?.name || ''));
    setProvinceQuery(''); setWardQuery(''); setProvinceOpen(false); setWardOpen(false);
    setEditing('new');
  };
  const startEdit = (item: SavedAddress) => {
    setDraft({ title: item.title, name: item.name, phone: item.phone, street: item.street, province: { code: item.provinceCode, name: item.province }, ward: { code: item.wardCode, name: item.ward } });
    setProvinceQuery(item.province); setWardQuery(item.ward); setProvinceOpen(false); setWardOpen(false);
    setEditing(item.id);
  };

  const save = async () => {
    if (!requireAuth('/addresses')) return;
    if (!draft.name.trim()) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ tên người nhận.'); return; }
    const phoneDigits = draft.phone.replace(/\D/g, '');
    if (phoneDigits.length < 9 || phoneDigits.length > 11) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập số điện thoại hợp lệ.'); return; }
    if (!draft.province || !draft.ward) { Alert.alert('Thiếu thông tin', 'Vui lòng chọn tỉnh/thành và phường/xã.'); return; }
    if (!draft.street.trim()) { Alert.alert('Thiếu thông tin', 'Vui lòng nhập số nhà và tên đường.'); return; }
    setSaving(true);
    try {
      await upsertAddress({
        id: editing === 'new' ? undefined : editing || undefined,
        title: draft.title.trim() || 'Địa chỉ',
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        street: draft.street.trim(),
        provinceCode: draft.province.code,
        province: draft.province.name,
        wardCode: draft.ward.code,
        ward: draft.ward.name,
        isDefault: items.length === 0,
      }, user?.id);
      refresh();
      setEditing(null);
    } catch (error: any) {
      Alert.alert('Không lưu được địa chỉ', error?.message || 'Vui lòng thử lại.');
    } finally { setSaving(false); }
  };

  const remove = (item: SavedAddress) => {
    Alert.alert('Xoá địa chỉ?', `Xoá "${item.title}" khỏi danh sách địa chỉ nhận hàng.`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => void deleteAddress(item.id,user?.id).then(setItems) },
    ]);
  };

  if (editing) {
    return (
      <Screen>
        <Header title={editing === 'new' ? 'Thêm địa chỉ' : 'Sửa địa chỉ'} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 28 }}>
          <FieldRow label="Đặt tên địa chỉ" value={draft.title} onChangeText={v => setDraft(d => ({ ...d, title: v }))} placeholder="Ví dụ: Nhà riêng, Công ty" />
          <FieldRow label="Họ tên người nhận" value={draft.name} onChangeText={v => setDraft(d => ({ ...d, name: v }))} placeholder="Nhập họ tên" />
          <FieldRow label="Số điện thoại" value={draft.phone} onChangeText={v => setDraft(d => ({ ...d, phone: v }))} placeholder="Nhập số điện thoại" keyboardType="phone-pad" />
          <Text style={st.lbl}>Tỉnh / Thành phố</Text>
          <View style={[st.input, { flexDirection: 'row', alignItems: 'center', borderColor: provinceOpen ? C.shu : C.line, paddingRight: 5 }]}>
            <TextInput value={provinceQuery} onChangeText={v => { setProvinceQuery(v); setDraft(d => ({ ...d, province: null, ward: null })); setWardQuery(''); setProvinceOpen(true); }} onFocus={() => setProvinceOpen(true)} placeholder="Nhập để gợi ý tỉnh/thành" placeholderTextColor={C.muted} style={st.suggestInput} />
            <Pressable style={st.arrow} onPress={() => setProvinceOpen(v => !v)}><Ionicons name={provinceOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} /></Pressable>
          </View>
          {provinceOpen && (
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={st.dropdown}>
              {shownProvinces.map(p => (
                <Pressable key={p.code} style={st.opt} onPress={() => { setDraft(d => ({ ...d, province: p, ward: null })); setProvinceQuery(p.name); setProvinceOpen(false); setWardQuery(''); setWardOpen(true); }}>
                  <Ionicons name="location" size={14} color={C.shu} />
                  <Text style={{ flex: 1, fontFamily: F.body, fontSize: 13, color: C.ink }}>{p.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <View style={{ height: 12 }} />
          <Text style={st.lbl}>Phường / Xã / Đặc khu</Text>
          <View style={[st.input, { flexDirection: 'row', alignItems: 'center', borderColor: wardOpen ? C.shu : C.line, paddingRight: 5, opacity: draft.province ? 1 : .6 }]}>
            <TextInput editable={Boolean(draft.province)} value={wardQuery} onChangeText={v => { setWardQuery(v); setDraft(d => ({ ...d, ward: null })); setWardOpen(true); }} onFocus={() => draft.province && setWardOpen(true)} placeholder={draft.province ? 'Nhập tên phường/xã' : 'Chọn tỉnh/thành trước'} placeholderTextColor={C.muted} style={st.suggestInput} />
            <Pressable disabled={!draft.province} style={st.arrow} onPress={() => setWardOpen(v => !v)}><Ionicons name={wardOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} /></Pressable>
          </View>
          {wardOpen && draft.province && (
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={st.dropdown}>
              {wards.map(item => (
                <Pressable key={item.code} style={st.opt} onPress={() => { setDraft(d => ({ ...d, ward: item })); setWardQuery(item.name); setWardOpen(false); }}>
                  <Ionicons name="navigate" size={14} color={C.shu} />
                  <Text style={{ fontFamily: F.body, fontSize: 13, color: C.ink }}>{item.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <View style={{ height: 12 }} />
          <FieldRow label="Số nhà / Tên đường" value={draft.street} onChangeText={v => setDraft(d => ({ ...d, street: v }))} placeholder="Ví dụ: 123 Lê Lợi" />
          <Btn label={saving ? 'Đang lưu…' : 'Lưu địa chỉ'} onPress={() => { if (!saving) void save(); }} style={{ marginTop: 8 }} />
          <Btn label="Huỷ" variant="ghost" onPress={() => setEditing(null)} style={{ marginTop: 10 }} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Địa chỉ nhận hàng" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}>
        {loaded && !items.length && (
          <Text style={st.emptyText}>Chưa có địa chỉ nào. Thêm một địa chỉ để lần sau thanh toán không cần nhập lại.</Text>
        )}
        {items.map(item => (
          <View key={item.id} style={[st.card, item.isDefault && { borderColor: C.shu }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: F.bodyB, fontSize: 14, color: C.ink }}>{item.title}</Text>
              {item.isDefault && <View style={st.badge}><Text style={{ color: '#fff', fontFamily: F.bodyB, fontSize: 10 }}>Mặc định</Text></View>}
            </View>
            <Text style={{ fontFamily: F.body, fontSize: 12.5, color: C.ink, marginTop: 6 }}>{item.name} · {item.phone}</Text>
            <Text style={{ fontFamily: F.body, fontSize: 12.5, color: C.muted, marginTop: 2 }}>{item.street}, {item.ward}, {item.province}</Text>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
              {!item.isDefault && <Pressable onPress={() => void setDefaultAddress(item.id,user?.id).then(setItems)}><Text style={st.action}>Đặt mặc định</Text></Pressable>}
              <Pressable onPress={() => startEdit(item)}><Text style={st.action}>Sửa</Text></Pressable>
              <Pressable onPress={() => remove(item)}><Text style={[st.action, { color: C.danger }]}>Xoá</Text></Pressable>
            </View>
          </View>
        ))}
        <Btn label="+ Thêm địa chỉ mới" variant="ghost" style={{ marginTop: 6 }} onPress={startNew} />
      </ScrollView>
    </Screen>
  );
}

const FieldRow = ({ label, value, onChangeText, placeholder, keyboardType }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: 'default' | 'phone-pad' }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={st.lbl}>{label}</Text>
    <TextInput style={st.input} value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} placeholderTextColor={C.muted} />
  </View>
);

const st = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, marginBottom: 12 },
  badge: { backgroundColor: C.shu, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  action: { fontFamily: F.bodyB, fontSize: 12, color: C.shu },
  emptyText: { fontFamily: F.body, fontSize: 12.5, lineHeight: 19, color: C.muted, marginBottom: 14 },
  lbl: { fontFamily: F.bodyM, color: C.muted, fontSize: 11, marginBottom: 5 },
  input: { minHeight: 48, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: '#fff', paddingHorizontal: 13, fontFamily: F.body, fontSize: 14, color: C.ink, justifyContent: 'center' },
  suggestInput: { flex: 1, minHeight: 46, fontFamily: F.body, fontSize: 14, color: C.ink, paddingHorizontal: 8 },
  arrow: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  dropdown: { maxHeight: 260, borderWidth: 1, borderColor: C.shu, borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden', marginTop: -2, backgroundColor: '#fff' },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: C.hair, backgroundColor: '#fff' },
});
