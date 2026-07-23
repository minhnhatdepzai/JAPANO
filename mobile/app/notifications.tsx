import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header } from '../components/ui';
import { C, F } from '../theme/tokens';
import { fetchNotifications, getReadIds, markAllRead, Noti } from '../lib/notifications';

const FALLBACK: Noti[] = [
  { id: 'flagcard-promo', title: '🚩 Sưu tầm 7 thẻ địa danh — nhận mã giảm 50%!', body: 'Mỗi đơn hàng đủ điều kiện tặng một thẻ địa danh Nhật Bản. Đủ bộ 7 thẻ, giảm ngay 50% mọi sản phẩm. Chạm để xem trước bộ thẻ.', type: 'Khuyến mãi', at: Date.now() - 30 * 60000, action: 'flagcard-intro' },
  { id: 'f1', title: 'Ưu đãi Thu — giảm 20% Haori', body: 'Cách tân tủ đồ mùa lá đỏ, dùng mã THU20', type: 'Khuyến mãi', at: Date.now() - 3 * 3600000 },
  { id: 'f2', title: 'Câu hỏi hôm nay đã sẵn sàng', body: 'Trả lời để nhận gợi ý đồ Nhật hợp gu', type: 'Hệ thống', at: Date.now() - 3600000 },
];
const ICON: Record<string, { ic: string; bg: string }> = {
  'Khuyến mãi': { ic: '🎁', bg: C.shuSoft },
  'Hệ thống': { ic: '✦', bg: C.aiSoft },
  'Đơn hàng': { ic: '📦', bg: C.aiSoft },
};
const ROUTE: Record<string,string> = { 'flagcard-intro': '/flagcard-intro' };
const timeAgo = (at: number) => {
  const mins = Math.max(1, Math.round((Date.now() - at) / 60000));
  if (mins < 60) return `${mins} phút`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} giờ`;
  return `${Math.round(hours / 24)} ngày`;
};

export default function Notifications() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [list, setList] = useState<Noti[]>(FALLBACK);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [remote, read] = await Promise.all([fetchNotifications(), getReadIds()]);
      setList(remote.length ? remote : FALLBACK);
      setReadIds(read);
    } catch {
      setList(FALLBACK);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = useMemo(() => {
    if (tab === 1) return list.filter(n => n.type === 'Đơn hàng');
    if (tab === 2) return list.filter(n => n.type === 'Khuyến mãi');
    return list;
  }, [list, tab]);

  const markRead = async () => {
    await markAllRead(list.map(n => n.id));
    setReadIds(new Set(list.map(n => n.id)));
  };

  const openNoti = async (n: Noti) => {
    await markAllRead([n.id]);
    setReadIds(prev => new Set([...prev, n.id]));
    if (n.action && ROUTE[n.action]) router.push(ROUTE[n.action] as any);
  };

  return (
    <Screen>
      <Header title="Thông báo" right={<Pressable onPress={() => void markRead()}><Text style={{ fontFamily: F.bodyB, fontSize: 11, color: C.shu }}>Đọc hết</Text></Pressable>} />
      <View style={st.seg}>
        {['Tất cả', 'Đơn hàng', 'Khuyến mãi'].map((t, i) => (
          <Pressable key={t} style={[st.segItem, tab === i && st.segOn]} onPress={() => setTab(i)}><Text style={[st.segT, tab === i && st.segTOn]}>{t}</Text></Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}>
        {loading && <ActivityIndicator style={{ marginTop: 20 }} color={C.shu} />}
        {!loading && !filtered.length && <Text style={{ textAlign: 'center', marginTop: 30, color: C.muted, fontFamily: F.body }}>Chưa có thông báo nào.</Text>}
        {filtered.map((n) => {
          const meta = ICON[n.type || ''] || { ic: '✦', bg: C.aiSoft };
          const unread = !readIds.has(n.id);
          const actionable = !!(n.action && ROUTE[n.action]);
          return (
            <Pressable key={n.id} style={st.row} onPress={()=>openNoti(n)}>
              <View style={[st.ic, { backgroundColor: meta.bg }]}><Text style={{ fontSize: 16 }}>{meta.ic}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: F.bodyB, fontSize: 13, color: C.ink }}>{n.title}</Text>
                  {unread && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.shu }} />}
                </View>
                <Text style={{ fontFamily: F.body, fontSize: 11.5, color: C.muted, marginTop: 2 }}>{n.body}</Text>
              </View>
              {actionable ? <Ionicons name="chevron-forward" size={16} color={C.muted} /> : <Text style={{ fontFamily: F.body, fontSize: 10, color: C.muted }}>{timeAgo(n.at)}</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
const st = StyleSheet.create({
  seg: { flexDirection: 'row', marginHorizontal: 18, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: C.hair },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  segOn: { borderBottomWidth: 2, borderBottomColor: C.shu },
  segT: { fontFamily: F.bodyM, fontSize: 13, color: C.muted }, segTOn: { color: C.shu, fontFamily: F.bodyB },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.hair },
  ic: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
