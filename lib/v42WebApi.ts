import { API_URL } from './api';

const LONG_TIMEOUT_MS = Math.max(120000, Number(process.env.EXPO_PUBLIC_AI_TIMEOUT_MS || 360000));

function parseJsonSafely(text: string) {
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text }; }
}

async function postJson(path: string, body: any, timeoutMs = LONG_TIMEOUT_MS) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: controller?.signal,
    });
    const text = await res.text();
    const data = parseJsonSafely(text);
    if (!res.ok) throw new Error(data.message || text || `HTTP ${res.status}`);
    return data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function v42WebHealth() {
  const res = await fetch(`${API_URL}/api/v42/web/health`);
  const text = await res.text();
  const data = parseJsonSafely(text);
  if (!res.ok) throw new Error(data.message || text || `HTTP ${res.status}`);
  return data;
}

export async function v42AnalyzeCameraUrl(body: {
  imageUrl: string;
  userId?: string;
  products?: any[];
  userProfile?: any;
  adultConfirmed?: boolean;
  allowSwimwear?: boolean;
  noExtraCovering?: boolean;
}) {
  return postJson('/api/v42/web/camera-url', body, 240000);
}

export async function v42AnalyzeCameraBase64(body: {
  imageBase64: string;
  userId?: string;
  products?: any[];
  userProfile?: any;
  adultConfirmed?: boolean;
  allowSwimwear?: boolean;
  noExtraCovering?: boolean;
}) {
  return postJson('/api/v42/web/camera-base64', body, 240000);
}

export async function v42TryOnByUrl(body: {
  personImageUrl: string;
  garmentImageUrl: string;
  accessoryImageUrls?: string[];
  productName?: string;
  category?: string;
  prompt?: string;
  adultConfirmed?: boolean;
  preserveVisibleSkin?: boolean;
  noExtraCovering?: boolean;
  realisticRefine?: boolean;
}) {
  return postJson('/api/v42/web/tryon-url', body, 360000);
}

export async function v42GenerateRealistic(body: {
  prompt: string;
  width?: number;
  height?: number;
  steps?: number;
  mode?: string;
  adultConfirmed?: boolean;
  allowSwimwear?: boolean;
  references?: string[];
}) {
  return postJson('/api/v42/web/generate-realistic', body, 360000);
}

export function splitUrlList(text: string) {
  return String(text || '')
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function imageResultUrl(data: any) {
  return data?.url || data?.imageUrl || data?.sourceImageUrl || data?.imageBase64 || data?.dataUrl || '';
}
