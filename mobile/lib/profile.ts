import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StyleProfile } from './api';

const PROFILE_KEY = '@japano/style-profile/v1';

export type SavedStyleProfile = StyleProfile & {
  style: string;
  lastQuizDate?: string;
  streak?: number;
};

export const DEFAULT_STYLE_PROFILE: SavedStyleProfile = {
  style: 'toi-gian',
  height: '165',
  weight: '',
  bust: '',
  waist: '',
  hip: '',
  shoulder: '',
  streak: 0,
};

export async function loadStyleProfile(): Promise<SavedStyleProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? { ...DEFAULT_STYLE_PROFILE, ...JSON.parse(raw) } : DEFAULT_STYLE_PROFILE;
  } catch {
    return DEFAULT_STYLE_PROFILE;
  }
}

export async function saveStyleProfile(patch: Partial<SavedStyleProfile>) {
  const current = await loadStyleProfile();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  return next;
}
