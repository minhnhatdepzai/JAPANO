import type { HomePayload, JapanSpot, Product, Shop } from "@/lib/types";

const DEFAULT_ORIGIN = "https://rd-system.tail6502ce.ts.net:4101";

function apiOrigin() {
  return String(process.env.JAPANO_API_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, "");
}

/**
 * Bộ nhớ đệm ngắn trong tiến trình cho các lần đọc catalog công khai.
 *
 * `next: { revalidate }` chỉ có tác dụng khi tầng cache của framework đang bật;
 * ở chế độ dev thì không, nên mỗi lần render một trang lại gọi backend vài lần.
 * Cửa sổ TTL ở đây bằng đúng `revalidate` nên hành vi làm mới không đổi, chỉ bớt
 * số vòng gọi đi. Chỉ dùng cho dữ liệu công khai — không có route cá nhân nào đi
 * qua tệp này, và giỏ hàng/tài khoản/đơn hàng luôn đi thẳng qua BFF `no-store`.
 */
type CacheEntry = { expiresAt: number; value: unknown };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiOrigin()}${path}`, {
    headers: {
      accept: "application/json",
      ...(process.env.CF_ACCESS_CLIENT_ID ? { "CF-Access-Client-Id": process.env.CF_ACCESS_CLIENT_ID } : {}),
      ...(process.env.CF_ACCESS_CLIENT_SECRET ? { "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET } : {}),
    },
  });
  if (!response.ok) throw new Error(`JAPANO API ${response.status} tại ${path}`);
  return response.json() as Promise<T>;
}

async function readJson<T>(path: string, revalidate = 30): Promise<T> {
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expiresAt > now) return cached.value as T;

  // Nhiều mảnh của cùng một trang cùng hỏi một endpoint: gộp thành một request.
  const pending = inFlight.get(path);
  if (pending) return pending as Promise<T>;

  const request = fetchJson<T>(path)
    .then((value) => {
      cache.set(path, { expiresAt: Date.now() + revalidate * 1_000, value });
      return value;
    })
    .finally(() => inFlight.delete(path));
  inFlight.set(path, request);
  return request;
}

export async function getHome(): Promise<HomePayload> {
  return readJson<HomePayload>("/api/storefront/home", 30);
}

export async function getProducts(): Promise<Product[]> {
  return readJson<Product[]>("/api/products", 30);
}

export async function getProduct(slug: string): Promise<Product | null> {
  try {
    const payload = await readJson<{ ok: boolean; product: Product }>(`/api/products/${encodeURIComponent(slug)}`, 30);
    return payload.product;
  } catch {
    return null;
  }
}

export async function getShop(): Promise<Shop> {
  return readJson<Shop>("/api/shop", 30);
}

export async function getJapanSpots(): Promise<JapanSpot[]> {
  const payload = await readJson<{ spots: JapanSpot[] }>("/api/japan-spots/catalog", 120);
  return payload.spots || [];
}

export function backendMediaUrl(path: string) {
  if (!path || path.startsWith("data:") || /^https?:\/\//.test(path)) return path;
  return `${apiOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
