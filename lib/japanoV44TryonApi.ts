export const V44_API_BASE =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL)
    ? String(process.env.EXPO_PUBLIC_API_URL)
    : 'http://localhost:4000';

export async function v44Post(path: string, body: any) {
  const res = await fetch(`${V44_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data?.message || text || `HTTP ${res.status}`);
  }
  return data;
}
