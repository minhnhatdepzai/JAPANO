// Gợi ý trang phục JAPANO theo địa điểm du lịch Nhật Bản.
//
// Câu hỏi mà tính năng này trả lời: "nếu tôi mặc món này của JAPANO và chụp ở
// đây thì có đẹp không?" — nên điểm số phải dựa vào metadata THẬT của sản phẩm
// (cat, garmentType, tags, colorHex, variants.stock) và của địa điểm, chứ không
// phải một câu quảng cáo chung chung.
//
// KHÔNG gọi LLM. Mỗi lần mở màn hình mà chờ một lượt sinh văn bản thì vừa chậm,
// vừa tốn tiền, vừa cho ra kết quả khác nhau giữa hai lần mở cùng một địa điểm.
// Toàn bộ điểm và lý do đều tính bằng quy tắc, nên có thể kiểm bằng test.
//
// KHÔNG tạo collection MongoDB nào. Kết quả chỉ nằm trong cache RAM có TTL.

const { availableSizesFor } = require('./outfit');

// Thang điểm 100, chia đúng như đặc tả nghiệp vụ.
const WEIGHTS = Object.freeze({
  style: 25,     // phong cách/văn hoá hợp địa điểm
  season: 20,    // mùa và thời tiết
  color: 20,     // màu sản phẩm so với màu chủ đạo của cảnh
  category: 15,  // loại đồ hợp hoạt động ở đó
  size: 15,      // có size vừa người dùng
  quality: 5,    // còn hàng, có ảnh, đủ metadata
});

// Hồ sơ địa điểm. `styleTags` khớp với tags/garmentType thật trong catalog.
// `modest` chặn hẳn đồ bơi — đền, chùa và nơi tưởng niệm.
const SPOT_PROFILES = Object.freeze({
  'Đền Fushimi Inari': {
    styleTags: ['kimono', 'yukata', 'haori', 'truyền thống', 'lễ hội'],
    activity: 'đi bộ leo dốc',
    sceneColors: ['#D64500', '#8C2E1B'],
    sceneColorName: 'son đỏ của cổng torii',
    seasons: ['xuân', 'thu', 'đông'],
    modest: true,
    swimwear: false,
    walkHeavy: true,
    culturalNote: 'Đây là nơi thờ tự đang hoạt động — trang phục kín đáo là phép lịch sự tối thiểu.',
  },
  'Đảo nghệ thuật Naoshima': {
    styleTags: ['tối giản', 'hiện đại', 'linen', 'công sở'],
    activity: 'đi bộ giữa các bảo tàng',
    sceneColors: ['#9AA0A6', '#4C5358'],
    sceneColorName: 'bê tông xám và thép trắng',
    seasons: ['xuân', 'hè', 'thu'],
    modest: false,
    swimwear: false,
    walkHeavy: true,
    culturalNote: 'Kiến trúc Tadao Ando theo hướng tối giản; trang phục ít hoạ tiết ăn nhập hơn.',
  },
  'Rừng tre Arashiyama': {
    styleTags: ['kimono', 'yukata', 'truyền thống'],
    activity: 'đi bộ trong rừng',
    sceneColors: ['#4F7942', '#8FA37A'],
    sceneColorName: 'xanh tre',
    seasons: ['xuân', 'hè', 'thu'],
    modest: true,
    swimwear: false,
    walkHeavy: true,
    culturalNote: 'Lối tre là đường công cộng có người qua lại; đồ quá dài dễ vướng.',
  },
  'Kênh Otaru': {
    styleTags: ['len', 'khoác', 'ấm', 'cổ điển'],
    activity: 'dạo bộ ven kênh',
    sceneColors: ['#6B7B8C', '#C9A227'],
    sceneColorName: 'gạch đá xám và đèn khí vàng',
    seasons: ['thu', 'đông'],
    modest: false,
    swimwear: false,
    walkHeavy: false,
    culturalNote: 'Hokkaido lạnh hơn hẳn Honshu; mùa đông cần đồ giữ nhiệt thật.',
  },
  'Hồ Kawaguchi': {
    styleTags: ['khoác', 'cardigan', 'ấm', 'tối giản'],
    activity: 'ngắm cảnh ngoài trời',
    sceneColors: ['#7FA8D9', '#E8EDF2'],
    sceneColorName: 'xanh hồ và tuyết trắng của Phú Sĩ',
    seasons: ['xuân', 'thu', 'đông'],
    modest: false,
    swimwear: false,
    walkHeavy: false,
    culturalNote: 'Gần núi nên gió mạnh và lạnh hơn dự báo của vùng đồng bằng.',
  },
  'Thuỷ cung Churaumi': {
    styleTags: ['mát', 'nhẹ', 'biển'],
    activity: 'biển và nghỉ dưỡng',
    sceneColors: ['#1CA3C4', '#F2E4C9'],
    sceneColorName: 'xanh biển Okinawa và cát sáng',
    seasons: ['hè'],
    modest: false,
    swimwear: true,
    walkHeavy: false,
    culturalNote: 'Okinawa nóng ẩm quanh năm; vải thoáng quan trọng hơn kiểu dáng.',
  },
});

const DEFAULT_PROFILE = Object.freeze({
  styleTags: [], activity: 'tham quan', sceneColors: ['#8C8C8C'],
  sceneColorName: 'tông trung tính của cảnh', seasons: ['xuân', 'hè', 'thu', 'đông'],
  modest: true, swimwear: false, walkHeavy: false, culturalNote: '',
});

const SWIMWEAR_TYPES = new Set(['bikini_two_piece', 'one_piece_swimsuit', 'crop_top']);

function hexToRgb(hex) {
  const value = String(hex || '').replace('#', '');
  if (value.length !== 6) return null;
  const n = parseInt(value, 16);
  return Number.isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Khoảng cách màu 0..1. Đủ dùng để xếp hạng, không cần chuyển sang Lab. */
function colorDistance(a, b) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return 1;
  const d = Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2);
  return Math.min(1, d / 441.67);
}

function currentSeason(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'xuân';
  if (month >= 6 && month <= 8) return 'hè';
  if (month >= 9 && month <= 11) return 'thu';
  return 'đông';
}

function inStock(product) {
  const variants = product.variants || [];
  if (!variants.length) return true;
  return variants.some((v) => Number(v.stock || 0) > 0);
}

function sizesInStock(product) {
  const variants = product.variants || [];
  if (!variants.length) return availableSizesFor(product);
  return [...new Set(variants.filter((v) => Number(v.stock || 0) > 0).map((v) => String(v.size || '').toUpperCase()))]
    .filter(Boolean);
}

/**
 * Size gợi ý theo hồ sơ cơ thể.
 *
 * Ngưỡng phải TRÙNG KHÍT với `localSize()` trong `mobile/app/tryon.tsx`. Bản
 * đầu ở đây thiếu hai bậc 4XL và 5XL, nên một người 158cm/95kg được màn gợi ý
 * báo XXXL còn màn thử đồ báo 4XL — cùng một người, hai cỡ khác nhau, và không
 * có gì trên giao diện giải thích vì sao.
 */
function sizeFromBody({ height, weight }) {
  const h = Number(height) || 0;
  const w = Number(weight) || 0;
  if (!w) return null;
  const bmi = h ? w / ((h / 100) ** 2) : 21;
  if (w < 48 || bmi < 17.5) return 'S';
  if (w > 125) return '5XL';
  if (w > 112 || bmi > 36) return '4XL';
  if (w > 100 || bmi > 33) return 'XXXL';
  if (w > 88 || bmi > 29) return 'XXL';
  if (w > 78 || bmi > 26) return 'XL';
  if (w > 64 || bmi > 22.5) return 'L';
  return 'M';
}

function scoreProduct(product, profile, options) {
  const { season, body, spotName } = options;
  const tags = (product.tags || []).map((t) => String(t).toLowerCase());
  const name = String(product.name || '').toLowerCase();
  const garmentType = String(product.garmentType || '');
  const reasons = [];

  // --- Phong cách / văn hoá (25) ---
  const styleHits = profile.styleTags.filter((tag) => {
    const needle = tag.toLowerCase();
    return tags.some((t) => t.includes(needle)) || name.includes(needle) || garmentType.includes(needle);
  });
  const style = profile.styleTags.length
    ? Math.min(WEIGHTS.style, (styleHits.length / Math.min(2, profile.styleTags.length)) * WEIGHTS.style)
    : WEIGHTS.style * 0.5;
  if (styleHits.length) {
    reasons.push(`Kiểu ${styleHits.slice(0, 2).join(' và ')} hợp với không khí ${spotName}.`);
  }

  // --- Mùa và thời tiết (20) ---
  const seasonMatch = profile.seasons.includes(season);
  const warmTags = ['ấm', 'len', 'khoác', 'dày'];
  const coolTags = ['mát', 'nhẹ', 'mỏng', 'linen', 'cotton'];
  const isWarm = tags.some((t) => warmTags.some((w) => t.includes(w)));
  const isCool = tags.some((t) => coolTags.some((c) => t.includes(c)));
  let seasonScore = seasonMatch ? WEIGHTS.season * 0.6 : WEIGHTS.season * 0.25;
  let weatherMatch = false;
  if ((season === 'đông' || season === 'thu') && isWarm) { seasonScore = WEIGHTS.season; weatherMatch = true; }
  if ((season === 'hè' || season === 'xuân') && isCool) { seasonScore = WEIGHTS.season; weatherMatch = true; }
  if (weatherMatch) {
    reasons.push(season === 'đông' || season === 'thu'
      ? `Chất liệu giữ ấm hợp thời tiết ${season} ở ${spotName}.`
      : `Chất liệu nhẹ và thoáng hợp thời tiết ${season}.`);
  }

  // --- Màu so với màu chủ đạo của cảnh (20) ---
  // Ưu tiên TƯƠNG PHẢN vừa phải: đồ cùng tông với nền sẽ chìm, đồ chọi hẳn thì
  // gắt. Khoảng cách khoảng 0,45-0,75 cho ảnh dễ nhìn nhất.
  const distances = profile.sceneColors.map((c) => colorDistance(product.colorHex, c));
  const best = distances.length ? Math.max(...distances) : 0.5;
  const contrastScore = 1 - Math.min(1, Math.abs(best - 0.6) / 0.6);
  const color = WEIGHTS.color * contrastScore;
  let colorHarmony = 'trung tính';
  if (best > 0.75) colorHarmony = 'tương phản mạnh';
  else if (best > 0.45) { colorHarmony = 'tương phản dễ chịu'; reasons.push(`Màu sản phẩm nổi rõ trên nền ${profile.sceneColorName}.`); }
  else { colorHarmony = 'cùng tông'; reasons.push(`Màu gần với ${profile.sceneColorName} nên ảnh sẽ hài hoà, ít nổi khối.`); }

  // --- Loại đồ hợp hoạt động (15) ---
  const isAccessory = String(product.cat || '') === 'phu-kien';
  let category = isAccessory ? WEIGHTS.category * 0.3 : WEIGHTS.category * 0.7;
  const longGarment = ['kimono', 'yukata', 'hakama', 'dáng dài'].some((k) => name.includes(k) || garmentType.includes(k));
  if (profile.walkHeavy && longGarment) {
    category = WEIGHTS.category * 0.5;
    reasons.push(`${spotName} phải đi bộ nhiều — đồ dài đẹp nhưng nên chuẩn bị giày dễ đi.`);
  } else if (!isAccessory) {
    category = WEIGHTS.category;
  }

  // --- Có size vừa người dùng (15) ---
  const available = sizesInStock(product);
  const wanted = body.preferredSize || sizeFromBody(body);
  let sizeScore = WEIGHTS.size * 0.5;
  let recommendedSize = wanted && available.includes(wanted) ? wanted : (available[0] || null);
  let fitConfidence = 'low';
  if (wanted && available.includes(wanted)) {
    sizeScore = WEIGHTS.size;
    fitConfidence = body.preferredSize ? 'high' : 'medium';
    reasons.push(`Còn size ${wanted} — cỡ hệ thống ước lượng cho bạn.`);
  } else if (wanted) {
    sizeScore = WEIGHTS.size * 0.2;
    fitConfidence = 'low';
    reasons.push(`Hết size ${wanted}; còn ${available.join(', ') || 'không còn size nào'}.`);
  }

  // --- Còn hàng, ảnh, metadata (5) ---
  let quality = 0;
  if (inStock(product)) quality += 2;
  if ((product.images || []).length) quality += 2;
  if (tags.length) quality += 1;

  const total = Math.round(style + seasonScore + color + category + sizeScore + quality);
  return {
    score: Math.max(0, Math.min(100, total)),
    recommendedSize,
    fitConfidence,
    reasons: reasons.slice(0, 3),
    seasonMatch,
    weatherMatch,
    colorHarmony,
    culturalNote: profile.culturalNote || null,
    photoTip: profile.sceneColorName
      ? `Chụp ở góc có ${profile.sceneColorName} làm hậu cảnh để tách chủ thể rõ hơn.`
      : null,
  };
}

/**
 * Trả về danh sách gợi ý đã xếp hạng.
 *
 * `products` là catalog thật đang bán — hàm này không tự bịa sản phẩm nào.
 */
function recommendForSpot(products, { place, prefecture, season, body = {}, limit = 12, adultAllowed = false }) {
  const profile = SPOT_PROFILES[place] || DEFAULT_PROFILE;
  const activeSeason = season || currentSeason();
  const spotName = place;

  const eligible = (products || []).filter((product) => {
    // Catalog thật dùng 'published'/'draft', KHÔNG phải 'active'. Đoán nhầm giá
    // trị này lọc sạch 54/54 sản phẩm và danh sách gợi ý trả về rỗng.
    if (!['published', 'active', ''].includes(String(product.status ?? ''))) return false;
    // Hết hàng thì không gợi ý: để khách bấm "Thử ngay" rồi mới báo hết hàng là
    // một trải nghiệm tệ và làm mất niềm tin vào cả danh sách.
    if (!inStock(product)) return false;
    const swim = SWIMWEAR_TYPES.has(String(product.garmentType || ''));
    if (swim) {
      // Đồ bơi chỉ xuất hiện ở địa điểm biển/nghỉ dưỡng, và chỉ khi lượt này đã
      // qua cổng người lớn. Đền, chùa và nơi tưởng niệm thì không bao giờ.
      if (profile.modest || !profile.swimwear) return false;
      if (!adultAllowed) return false;
    }
    return true;
  });

  const scored = eligible.map((product) => ({
    product,
    ...scoreProduct(product, profile, { season: activeSeason, body, spotName }),
  }));
  scored.sort((a, b) => b.score - a.score || String(a.product.slug).localeCompare(String(b.product.slug)));
  return {
    season: activeSeason,
    profile: {
      activity: profile.activity,
      sceneColorName: profile.sceneColorName,
      modest: profile.modest,
      swimwearAllowed: Boolean(profile.swimwear),
      culturalNote: profile.culturalNote || null,
    },
    recommendations: scored.slice(0, Math.max(1, Math.min(40, Number(limit) || 12))),
  };
}

module.exports = {
  WEIGHTS, SPOT_PROFILES, SWIMWEAR_TYPES,
  currentSeason, sizeFromBody, colorDistance, inStock, sizesInStock,
  recommendForSpot,
};
