// Gợi ý địa chỉ Việt Nam: 63 tỉnh/thành gói sẵn (gợi ý tức thì, chạy cả offline),
// Quận/Huyện & Phường/Xã lấy theo mã qua API công khai provinces.open-api.vn (có cache + fallback gõ tay).

export type AdminUnit = { code: number | string; name: string };

export const PROVINCES: AdminUnit[] = [
  { code: 1, name: 'Hà Nội' }, { code: 2, name: 'Hà Giang' }, { code: 4, name: 'Cao Bằng' },
  { code: 6, name: 'Bắc Kạn' }, { code: 8, name: 'Tuyên Quang' }, { code: 10, name: 'Lào Cai' },
  { code: 11, name: 'Điện Biên' }, { code: 12, name: 'Lai Châu' }, { code: 14, name: 'Sơn La' },
  { code: 15, name: 'Yên Bái' }, { code: 17, name: 'Hòa Bình' }, { code: 19, name: 'Thái Nguyên' },
  { code: 20, name: 'Lạng Sơn' }, { code: 22, name: 'Quảng Ninh' }, { code: 24, name: 'Bắc Giang' },
  { code: 25, name: 'Phú Thọ' }, { code: 26, name: 'Vĩnh Phúc' }, { code: 27, name: 'Bắc Ninh' },
  { code: 30, name: 'Hải Dương' }, { code: 31, name: 'Hải Phòng' }, { code: 33, name: 'Hưng Yên' },
  { code: 34, name: 'Thái Bình' }, { code: 35, name: 'Hà Nam' }, { code: 36, name: 'Nam Định' },
  { code: 37, name: 'Ninh Bình' }, { code: 38, name: 'Thanh Hóa' }, { code: 40, name: 'Nghệ An' },
  { code: 42, name: 'Hà Tĩnh' }, { code: 44, name: 'Quảng Bình' }, { code: 45, name: 'Quảng Trị' },
  { code: 46, name: 'Thừa Thiên Huế' }, { code: 48, name: 'Đà Nẵng' }, { code: 49, name: 'Quảng Nam' },
  { code: 51, name: 'Quảng Ngãi' }, { code: 52, name: 'Bình Định' }, { code: 54, name: 'Phú Yên' },
  { code: 56, name: 'Khánh Hòa' }, { code: 58, name: 'Ninh Thuận' }, { code: 60, name: 'Bình Thuận' },
  { code: 62, name: 'Kon Tum' }, { code: 64, name: 'Gia Lai' }, { code: 66, name: 'Đắk Lắk' },
  { code: 67, name: 'Đắk Nông' }, { code: 68, name: 'Lâm Đồng' }, { code: 70, name: 'Bình Phước' },
  { code: 72, name: 'Tây Ninh' }, { code: 74, name: 'Bình Dương' }, { code: 75, name: 'Đồng Nai' },
  { code: 77, name: 'Bà Rịa - Vũng Tàu' }, { code: 79, name: 'Hồ Chí Minh' }, { code: 80, name: 'Long An' },
  { code: 82, name: 'Tiền Giang' }, { code: 83, name: 'Bến Tre' }, { code: 84, name: 'Trà Vinh' },
  { code: 86, name: 'Vĩnh Long' }, { code: 87, name: 'Đồng Tháp' }, { code: 89, name: 'An Giang' },
  { code: 91, name: 'Kiên Giang' }, { code: 92, name: 'Cần Thơ' }, { code: 93, name: 'Hậu Giang' },
  { code: 94, name: 'Sóc Trăng' }, { code: 95, name: 'Bạc Liêu' }, { code: 96, name: 'Cà Mau' },
];

// Bỏ dấu để tìm kiếm "khong dau" cũng ra (gõ "ha noi" hay "Hà Nội" đều được)
export function noAccent(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().trim();
}

export function searchUnits(list: AdminUnit[], query: string, limit = 8): AdminUnit[] {
  const q = noAccent(query);
  if (!q) return list.slice(0, limit);
  const starts: AdminUnit[] = [];
  const contains: AdminUnit[] = [];
  for (const u of list) {
    const n = noAccent(u.name);
    if (n.startsWith(q)) starts.push(u);
    else if (n.includes(q)) contains.push(u);
  }
  return [...starts, ...contains].slice(0, limit);
}

const API = 'https://provinces.open-api.vn/api';
const districtCache = new Map<string, AdminUnit[]>();
const wardCache = new Map<string, AdminUnit[]>();

async function getJson(url: string, timeoutMs = 9000): Promise<any> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function fetchDistricts(provinceCode: number | string): Promise<AdminUnit[]> {
  const key = String(provinceCode);
  if (districtCache.has(key)) return districtCache.get(key)!;
  try {
    const data = await getJson(`${API}/p/${key}?depth=2`);
    const list = (data?.districts || []).map((d: any) => ({ code: d.code, name: d.name }));
    districtCache.set(key, list);
    return list;
  } catch {
    return [];
  }
}

export async function fetchWards(districtCode: number | string): Promise<AdminUnit[]> {
  const key = String(districtCode);
  if (wardCache.has(key)) return wardCache.get(key)!;
  try {
    const data = await getJson(`${API}/d/${key}?depth=2`);
    const list = (data?.wards || []).map((w: any) => ({ code: w.code, name: w.name }));
    wardCache.set(key, list);
    return list;
  } catch {
    return [];
  }
}
