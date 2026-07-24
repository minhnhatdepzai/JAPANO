export const V48_API_BASE =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL)
    ? String(process.env.EXPO_PUBLIC_API_URL)
    : 'http://localhost:4000';

export function v48FirstImage(product: any): string {
  if (!product) return '';
  if (Array.isArray(product.images) && product.images[0]) {
    const first = product.images[0];
    if (typeof first === 'string') return first;
    if (first?.url) return first.url;
    if (first?.secure_url) return first.secure_url;
  }
  return product.image || product.firstImage || product.thumbnail || product.photo || '';
}

export function v48ProductId(product: any): string {
  return String(product?._id || product?.id || product?.sku || product?.slug || product?.name || '');
}

export async function v48Get(path: string) {
  const res = await fetch(`${V48_API_BASE}${path}`);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.message || text || `HTTP ${res.status}`);
  return data;
}

export async function v48Post(path: string, body: any) {
  const res = await fetch(`${V48_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.message || text || `HTTP ${res.status}`);
  return data;
}
