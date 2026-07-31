import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestJson } from './api';

const READ_KEY = '@japano/notifications/read/v1';

export type Noti = { id: string; title: string; body: string; type?: string; at: number; action?: string };

const arrayFrom = (data: any) => Array.isArray(data) ? data : (data?.items || data?.notifications || []);

export async function fetchNotifications(): Promise<Noti[]> {
  const data = await requestJson('/api/notifications', { timeoutMs: 6000 });
  return arrayFrom(data)
    .map((n: any) => ({ id: String(n.id), title: String(n.title || ''), body: String(n.body || ''), type: n.type, at: Number(n.at || n.createdAt || Date.now()), action: n.action ? String(n.action) : undefined }))
    .sort((a: Noti, b: Noti) => b.at - a.at);
}

export async function getReadIds(): Promise<Set<string>> {
  try { const raw = await AsyncStorage.getItem(READ_KEY); return new Set(raw ? JSON.parse(raw) : []); }
  catch { return new Set(); }
}

export async function markAllRead(ids: string[]) {
  const current = await getReadIds();
  ids.forEach(id => current.add(id));
  await AsyncStorage.setItem(READ_KEY, JSON.stringify([...current]));
}

export async function unreadCount(): Promise<number> {
  try {
    const [list, read] = await Promise.all([fetchNotifications(), getReadIds()]);
    return list.filter(n => !read.has(n.id)).length;
  } catch { return 0; }
}
