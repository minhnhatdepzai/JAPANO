const { finiteNumber, productId: pid } = require('./analytics');
const { buildTagIndex, trendingList, getHomeRecommendations } = require('./recommend');

const ROLE_BY_CAT = {
  'ao-truyen-thong': 'base',
  'haori': 'outer',
  'trang-phuc': 'base',
  'phu-kien': 'accessory',
  'cosplay': 'standalone',
};

function roleOf(product) {
  return ROLE_BY_CAT[product.cat || product.category] || 'base';
}

function hexToHsl(hex) {
  const clean = String(hex || '#888888').replace('#', '').padEnd(6, '8');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
}

// Hoà sắc kiểu Nhật: trung tính (đen/trắng/be) đi được với mọi màu; tông liền kề (analogous)
// hoặc đối lập vừa phải (không quá gắt) được ưu tiên hơn hai màu cùng sắc độ chọi nhau.
function colorHarmony(hexA, hexB) {
  const a = hexToHsl(hexA);
  const b = hexToHsl(hexB);
  const neutral = (c) => c.s < 0.18 || c.l < 0.16 || c.l > 0.88;
  if (neutral(a) || neutral(b)) return 0.88;
  let diff = Math.abs(a.h - b.h);
  if (diff > 180) diff = 360 - diff;
  if (diff <= 35) return 0.95 - diff / 100;
  if (diff >= 150) return 0.75 + ((diff - 150) / 30) * 0.15;
  return Math.max(0.25, 0.55 - Math.abs(diff - 92) / 160);
}

function publishedProducts(state) {
  return (state.products || []).filter((p) => !['archived', 'hidden'].includes(String(p.status || '')));
}

function trendingScoreMap(state) {
  return new Map(trendingList(state).map((p) => [p.productId, p.score / 100]));
}

function candidateScore(anchor, candidate, tagIndex, trending) {
  const color = colorHarmony(anchor.colorHex, candidate.colorHex);
  const tag = tagIndex.similarity(pid(anchor), pid(candidate));
  const trend = trending.get(pid(candidate)) || 0;
  return 0.4 * color + 0.35 * tag + 0.25 * trend;
}

function pickBest(pool, anchor, tagIndex, trending, exclude) {
  let best = null;
  let bestScore = -1;
  pool.forEach((candidate) => {
    if (exclude.has(pid(candidate))) return;
    const score = candidateScore(anchor, candidate, tagIndex, trending);
    if (score > bestScore) { bestScore = score; best = candidate; }
  });
  return best ? { product: best, score: bestScore } : null;
}

// Ghép 1 set hoàn chỉnh quanh 1 sản phẩm neo: base (đồ chính) + outer (áo khoác ngoài, nếu neo không phải outer)
// + 1-2 phụ kiện — chọn theo hoà sắc + tương đồng chủ đề (tag) + đang thịnh hành, giống logic "complete the look" của các sàn TMĐT lớn.
function composeOutfit(state, anchorSlug, opts = {}) {
  const products = publishedProducts(state);
  const anchor = products.find((p) => pid(p) === String(anchorSlug));
  if (!anchor) return null;
  const tagIndex = buildTagIndex(products);
  const trending = trendingScoreMap(state);
  const exclude = new Set([pid(anchor)]);
  const items = [{ slug: pid(anchor), role: roleOf(anchor), reason: 'Sản phẩm bạn đang xem' }];

  if (roleOf(anchor) === 'standalone') {
    const accCount = opts.accessoryCount ?? 2;
    for (let i = 0; i < accCount; i += 1) {
      const pool = products.filter((p) => roleOf(p) === 'accessory');
      const pick = pickBest(pool, anchor, tagIndex, trending, exclude);
      if (!pick) break;
      exclude.add(pid(pick.product));
      items.push({ slug: pid(pick.product), role: 'accessory', reason: 'Phụ kiện hợp tông với bộ trang phục' });
    }
  } else {
    const wantOuter = roleOf(anchor) !== 'outer';
    const wantBase = roleOf(anchor) !== 'base';
    if (wantOuter) {
      const pick = pickBest(products.filter((p) => roleOf(p) === 'outer'), anchor, tagIndex, trending, exclude);
      if (pick) { exclude.add(pid(pick.product)); items.push({ slug: pid(pick.product), role: 'outer', reason: 'Khoác ngoài hợp màu' }); }
    }
    if (wantBase) {
      const pick = pickBest(products.filter((p) => roleOf(p) === 'base'), anchor, tagIndex, trending, exclude);
      if (pick) { exclude.add(pid(pick.product)); items.push({ slug: pid(pick.product), role: 'base', reason: 'Phối cùng bên trong' }); }
    }
    const accCount = opts.accessoryCount ?? 2;
    for (let i = 0; i < accCount; i += 1) {
      const pick = pickBest(products.filter((p) => roleOf(p) === 'accessory'), anchor, tagIndex, trending, exclude);
      if (!pick) break;
      exclude.add(pid(pick.product));
      items.push({ slug: pid(pick.product), role: 'accessory', reason: 'Điểm nhấn cho bộ trang phục' });
    }
  }

  const byId = new Map(products.map((p) => [pid(p), p]));
  const totalPrice = items.reduce((sum, it) => sum + finiteNumber(byId.get(it.slug)?.price, 0), 0);
  return {
    anchor: pid(anchor),
    title: `Bộ đồ phối cùng ${anchor.name}`,
    items,
    totalPrice,
    algorithm: 'Hoà sắc HSL + tương đồng chủ đề (cosine trên tag) + độ thịnh hành, trọng số 0.4/0.35/0.25',
  };
}

// Set "hôm nay mặc gì": neo là 1 sản phẩm đang thịnh hành, chọn theo ngày trong năm nên đổi mỗi ngày —
// tạo lý do quay lại app hằng ngày dù không mua sắm ngay.
function todaysOutfit(state) {
  const trending = trendingList(state);
  if (!trending.length) return null;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const anchor = trending[dayOfYear % trending.length];
  return composeOutfit(state, anchor.productId, { accessoryCount: 1 });
}

function sizeFromMeasurements({ bust, waist, hip }) {
  const table = [
    { size: 'S', bust: 84, waist: 66, hip: 90 },
    { size: 'M', bust: 90, waist: 72, hip: 96 },
    { size: 'L', bust: 96, waist: 80, hip: 102 },
    { size: 'XL', bust: 104, waist: 88, hip: 110 },
    { size: 'XXL', bust: 112, waist: 98, hip: 118 },
    { size: 'XXXL', bust: 120, waist: 108, hip: 126 },
    { size: '4XL', bust: 128, waist: 118, hip: 134 },
    { size: '5XL', bust: 999, waist: 999, hip: 999 },
  ];
  const votes = [];
  [['bust', bust], ['waist', waist], ['hip', hip]].forEach(([key, value]) => {
    const v = finiteNumber(value, 0);
    if (!v) return;
    const row = table.find((t) => v <= t[key]);
    votes.push(row ? row.size : 'XL');
  });
  if (!votes.length) return null;
  const tally = votes.reduce((acc, s) => ({ ...acc, [s]: (acc[s] || 0) + 1 }), {});
  return Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
}

function sizeFromHeightWeight(height, weight) {
  const h = finiteNumber(height, 0);
  const w = finiteNumber(weight, 0);
  if (!h && !w) return 'M';
  const bmi = h && w ? w / ((h / 100) ** 2) : 21;
  if ((h && h < 158) || (w && w < 48) || bmi < 17.5) return 'S';
  if ((w && w > 125) || bmi > 40) return '5XL';
  if ((w && w > 112) || bmi > 36) return '4XL';
  if ((w && w > 100) || bmi > 33) return 'XXXL';
  if ((w && w > 88) || bmi > 29) return 'XXL';
  if ((h && h > 177) || (w && w > 78) || bmi > 26) return 'XL';
  if ((h && h > 168) || (w && w > 64) || bmi > 22.5) return 'L';
  return 'M';
}

// Hệ thống gợi ý size dạng "expert system": ưu tiên số đo vòng (bust/waist/hip) khi có, nếu
// không thì suy ra từ chiều cao/cân nặng theo ngưỡng + BMI ước lượng — minh bạch, không cần ảnh.
function adviseSize(payload = {}) {
  const height = payload.height ?? payload.heightCm;
  const weight = payload.weight ?? payload.weightKg;
  const measured = sizeFromMeasurements(payload);
  const size = measured || sizeFromHeightWeight(height, weight);
  const usedMeasurements = Boolean(measured);
  const advice = usedMeasurements
    ? `Theo số đo vòng ngực, eo và hông bạn nhập, kích cỡ ${size} là lựa chọn sát nhất.`
    : `Chưa có số đo vòng cụ thể — tạm tính theo chiều cao và cân nặng: kích cỡ ${size}. Nhập thêm vòng ngực, eo và hông để chính xác hơn.`;
  return { size, advice, usedMeasurements };
}

// Tư vấn phong cách cho màn "Ống kính JAPANO": tái dùng engine gợi ý (recommend.js) theo hồ sơ,
// rồi sắp lại theo tông màu chủ đạo trích từ ảnh (nếu có) — không cần model thị giác nặng.
function styleRecommendation(state, { userId = 'guest', profile, dominantHex, limit = 8 } = {}) {
  const base = getHomeRecommendations(state, { userId, limit: limit * 2, profile });
  const byId = new Map(publishedProducts(state).map((p) => [pid(p), p]));
  let ranked = base.items.map((slug) => byId.get(slug)).filter(Boolean);
  if (dominantHex) ranked = ranked.slice().sort((a, b) => colorHarmony(dominantHex, b.colorHex) - colorHarmony(dominantHex, a.colorHex));
  const top = ranked.slice(0, limit);
  const styleWords = (profile?.preferredStyles || []).join(', ');
  const parts = [styleWords ? `phong cách ${styleWords} bạn chọn` : 'gu và hành vi của bạn'];
  if (dominantHex) parts.push(`tông màu chủ đạo trong ảnh (${dominantHex})`);
  const summary = `Theo ${parts.join(' và ')}, Ori gợi ý những món sau:`;
  return {
    summary,
    tags: profile?.preferredStyles || [],
    products: top.filter((p) => roleOf(p) !== 'accessory').map(pid),
    accessories: top.filter((p) => roleOf(p) === 'accessory').map(pid),
  };
}

module.exports = { composeOutfit, todaysOutfit, adviseSize, styleRecommendation, roleOf, colorHarmony };
