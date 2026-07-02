export const V47_API_BASE =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL)
    ? String(process.env.EXPO_PUBLIC_API_URL)
    : 'http://localhost:4000';

export function v47FirstImage(product: any): string {
  if (!product) return '';
  if (Array.isArray(product.images) && product.images[0]) {
    const first = product.images[0];
    if (typeof first === 'string') return first;
    if (first?.url) return first.url;
    if (first?.secure_url) return first.secure_url;
  }
  if (product.image) return product.image;
  if (product.firstImage) return product.firstImage;
  if (product.thumbnail) return product.thumbnail;
  if (product.photo) return product.photo;
  return '';
}

export function v47ProductId(product: any): string {
  return String(product?._id || product?.id || product?.sku || product?.slug || product?.name || '');
}

export async function v47Get(path: string) {
  const res = await fetch(`${V47_API_BASE}${path}`);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.message || text || `HTTP ${res.status}`);
  return data;
}

export async function v47Post(path: string, body: any) {
  const res = await fetch(`${V47_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.message || text || `HTTP ${res.status}`);
  return data;
}
