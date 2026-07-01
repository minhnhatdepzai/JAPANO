// Ô địa chỉ gợi ý nhanh: Tỉnh/Thành -> Quận/Huyện -> Phường/Xã (gợi ý theo cấp), Số nhà tự nhập.
// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { fontFamily, inputStyle, scaleFont } from '../lib/styles';
import { AdminUnit, PROVINCES, fetchDistricts, fetchWards, searchUnits } from '../data/vnAddress';

export default function AddressPicker({ value, onChange }) {
  const { theme } = useApp();
  const [province, setProvince] = useState(value?.province || '');
  const [district, setDistrict] = useState(value?.district || '');
  const [ward, setWard] = useState(value?.ward || '');
  const [house, setHouse] = useState(value?.house || '');

  const [provinceCode, setProvinceCode] = useState<any>(null);
  const [districtCode, setDistrictCode] = useState<any>(null);
  const [districts, setDistricts] = useState<AdminUnit[]>([]);
  const [wards, setWards] = useState<AdminUnit[]>([]);
  const [loadingD, setLoadingD] = useState(false);
  const [loadingW, setLoadingW] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  function emit(next: any) {
    const p = { province, district, ward, house, ...next };
    const full = [p.house, p.ward, p.district, p.province].map((x) => String(x || '').trim()).filter(Boolean).join(', ');
    onChange?.({ ...p, full });
  }

  async function pickProvince(u: AdminUnit) {
    setProvince(u.name); setProvinceCode(u.code);
    setDistrict(''); setDistrictCode(null); setWards([]); setWard('');
    setFocused(null);
    emit({ province: u.name, district: '', ward: '' });
    setLoadingD(true);
    const list = await fetchDistricts(u.code);
    setDistricts(list); setLoadingD(false);
  }
  async function pickDistrict(u: AdminUnit) {
    setDistrict(u.name); setDistrictCode(u.code);
    setWard(''); setWards([]);
    setFocused(null);
    emit({ district: u.name, ward: '' });
    setLoadingW(true);
    const list = await fetchWards(u.code);
    setWards(list); setLoadingW(false);
  }
  function pickWard(u: AdminUnit) {
    setWard(u.name); setFocused(null); emit({ ward: u.name });
  }

  const provinceSug = useMemo(() => searchUnits(PROVINCES, province), [province]);
  const districtSug = useMemo(() => searchUnits(districts, district), [districts, district]);
  const wardSug = useMemo(() => searchUnits(wards, ward), [wards, ward]);

  const labelStyle = { color: theme.muted, fontFamily: fontFamily(theme), fontWeight: '800', fontSize: scaleFont(theme, 12), marginBottom: 4 };
  const wrap = { gap: 4 };

  function Dropdown({ data, onPick, loading, empty }) {
    if (loading) return (
      <View style={{ borderWidth: 1, borderColor: theme.border, borderTopWidth: 0, backgroundColor: theme.card, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={theme.primary} /><Text style={{ color: theme.muted, fontSize: scaleFont(theme, 12) }}>Đang tải...</Text>
      </View>
    );
    if (!data.length) return empty ? (
      <View style={{ borderWidth: 1, borderColor: theme.border, borderTopWidth: 0, backgroundColor: theme.card, padding: 10 }}>
        <Text style={{ color: theme.muted, fontSize: scaleFont(theme, 12) }}>{empty}</Text>
      </View>
    ) : null;
    return (
      <View style={{ borderWidth: 1, borderColor: theme.primary, borderTopWidth: 0, backgroundColor: theme.card, maxHeight: 230 }}>
        <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          {data.map((u, i) => (
            <Pressable key={`${u.code}-${i}`} onPress={() => onPick(u)} style={{ paddingVertical: 11, paddingHorizontal: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="map-pin" size={14} color={theme.primary} />
              <Text style={{ color: theme.text, fontFamily: fontFamily(theme), fontWeight: '700', fontSize: scaleFont(theme, 14) }}>{u.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {/* Tỉnh / Thành */}
      <View style={wrap}>
        <Text style={labelStyle}>Tỉnh / Thành phố</Text>
        <TextInput
          value={province}
          onChangeText={(t) => { setProvince(t); setProvinceCode(null); emit({ province: t }); }}
          onFocus={() => setFocused('province')}
          placeholder="Gõ chữ đầu, ví dụ: H → Hồ Chí Minh, Hà Nội..."
          placeholderTextColor={theme.muted}
          style={[inputStyle(theme), focused === 'province' ? { borderColor: theme.primary } : null]}
        />
        {focused === 'province' ? <Dropdown data={provinceSug} onPick={pickProvince} /> : null}
      </View>

      {/* Quận / Huyện */}
      <View style={wrap}>
        <Text style={labelStyle}>Quận / Huyện</Text>
        <TextInput
          value={district}
          onChangeText={(t) => { setDistrict(t); setDistrictCode(null); emit({ district: t }); }}
          onFocus={() => setFocused('district')}
          placeholder={province ? 'Chọn quận/huyện' : 'Chọn tỉnh/thành trước'}
          placeholderTextColor={theme.muted}
          style={[inputStyle(theme), focused === 'district' ? { borderColor: theme.primary } : null]}
        />
        {focused === 'district' ? <Dropdown data={districtSug} onPick={pickDistrict} loading={loadingD} empty={provinceCode ? 'Không tìm thấy, bạn có thể tự nhập.' : 'Hãy chọn tỉnh/thành ở trên.'} /> : null}
      </View>

      {/* Phường / Xã */}
      <View style={wrap}>
        <Text style={labelStyle}>Phường / Xã</Text>
        <TextInput
          value={ward}
          onChangeText={(t) => { setWard(t); emit({ ward: t }); }}
          onFocus={() => setFocused('ward')}
          placeholder={district ? 'Chọn phường/xã' : 'Chọn quận/huyện trước'}
          placeholderTextColor={theme.muted}
          style={[inputStyle(theme), focused === 'ward' ? { borderColor: theme.primary } : null]}
        />
        {focused === 'ward' ? <Dropdown data={wardSug} onPick={pickWard} loading={loadingW} empty={districtCode ? 'Không tìm thấy, bạn có thể tự nhập.' : 'Hãy chọn quận/huyện ở trên.'} /> : null}
      </View>

      {/* Số nhà / Đường */}
      <View style={wrap}>
        <Text style={labelStyle}>Số nhà / Tên đường</Text>
        <TextInput
          value={house}
          onChangeText={(t) => { setHouse(t); emit({ house: t }); }}
          onFocus={() => setFocused(null)}
          placeholder="VD: 123 Lê Lợi"
          placeholderTextColor={theme.muted}
          style={inputStyle(theme)}
        />
      </View>

      {(house || ward || district || province) ? (
        <View style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, padding: 10 }}>
          <Text style={{ color: theme.muted, fontSize: scaleFont(theme, 11), fontWeight: '800' }}>Địa chỉ nhận hàng</Text>
          <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 13), marginTop: 2 }}>
            {[house, ward, district, province].filter(Boolean).join(', ') || '—'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
