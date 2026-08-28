// Phân loại trang phục và ĐỘ CHE PHỦ mà nó tạo ra trên cơ thể.
//
// Vì sao cần module này: pipeline thử đồ cũ chỉ biết ba vùng (upper/lower/
// overall). Với áo crop, áo sát nách hay bikini, thông tin đó không đủ để trả
// lời hai câu hỏi khác nhau hoàn toàn:
//
//   1. Vùng da nào LỘ RA LÀ ĐÚNG THIẾT KẾ?  (bụng của áo crop, vai của áo trễ
//      vai) — cổng chất lượng phải chấp nhận, không được coi là lỗi sinh ảnh.
//   2. Vùng nào BẮT BUỘC PHẢI KÍN trong mọi trường hợp? — ngực, vùng chậu,
//      mông. Đây là sàn an toàn tuyệt đối, không sản phẩm nào được phép hạ.
//
// Trộn hai câu hỏi đó vào một là nguyên nhân khiến hệ thống vừa từ chối nhầm
// ảnh áo crop hợp lệ, vừa không có cơ chế nào chặn ảnh hở vùng nhạy cảm.

// Vùng cơ thể dùng chung cho cả coverage profile lẫn cổng chất lượng.
const BODY_ZONES = ['chest', 'abdomen', 'shoulders', 'upperArms', 'legs', 'pelvis', 'buttocks', 'back'];

// SÀN AN TOÀN: luôn phải kín, bất kể sản phẩm khai báo gì.
// Không có đường nào trong hệ thống được phép ghi đè danh sách này.
const ALWAYS_COVERED_ZONES = ['chest', 'pelvis', 'buttocks'];

const COVERED = 'covered';
const EXPOSED = 'exposed';

// Mỗi loại khai báo tường minh, không suy đoán. `adultOnlyTryOn` bật cho đồ bơi
// và đồ hở nhiều; `tearAllowed` là quyền được mô phỏng bục đường may khi quá
// chật — đồ bơi và đồ ngắn KHÔNG BAO GIỜ được phép.
const GARMENT_PROFILES = {
  bikini_top: {
    zone: 'upper', layer: 'upper-base', fashnCategory: 'tops',
    adultOnlyTryOn: true, tearAllowed: false, swimwear: true,
    coverage: { chest: COVERED, abdomen: EXPOSED, shoulders: EXPOSED, upperArms: EXPOSED,
                legs: EXPOSED, pelvis: COVERED, buttocks: COVERED, back: EXPOSED },
  },
  bikini_bottom: {
    zone: 'lower', layer: 'lower', fashnCategory: 'bottoms',
    adultOnlyTryOn: true, tearAllowed: false, swimwear: true,
    coverage: { chest: COVERED, abdomen: EXPOSED, shoulders: EXPOSED, upperArms: EXPOSED,
                legs: EXPOSED, pelvis: COVERED, buttocks: COVERED, back: EXPOSED },
  },
  bikini_two_piece: {
    zone: 'overall', layer: 'overall', fashnCategory: 'one-pieces',
    adultOnlyTryOn: true, tearAllowed: false, swimwear: true, twoPiece: true,
    coverage: { chest: COVERED, abdomen: EXPOSED, shoulders: EXPOSED, upperArms: EXPOSED,
                legs: EXPOSED, pelvis: COVERED, buttocks: COVERED, back: EXPOSED },
  },
  one_piece_swimsuit: {
    zone: 'overall', layer: 'overall', fashnCategory: 'one-pieces',
    adultOnlyTryOn: true, tearAllowed: false, swimwear: true,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: EXPOSED, upperArms: EXPOSED,
                legs: EXPOSED, pelvis: COVERED, buttocks: COVERED, back: EXPOSED },
  },
  crop_top: {
    zone: 'upper', layer: 'upper-base', fashnCategory: 'tops',
    adultOnlyTryOn: true, tearAllowed: false, preserveHemLength: true,
    coverage: { chest: COVERED, abdomen: EXPOSED, shoulders: COVERED, upperArms: COVERED,
                legs: COVERED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  sleeveless_top: {
    zone: 'upper', layer: 'upper-base', fashnCategory: 'tops',
    adultOnlyTryOn: false, tearAllowed: false,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: EXPOSED, upperArms: EXPOSED,
                legs: COVERED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  off_shoulder_top: {
    zone: 'upper', layer: 'upper-base', fashnCategory: 'tops',
    adultOnlyTryOn: false, tearAllowed: false,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: EXPOSED, upperArms: COVERED,
                legs: COVERED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  shorts: {
    zone: 'lower', layer: 'lower', fashnCategory: 'bottoms',
    adultOnlyTryOn: false, tearAllowed: false, preserveHemLength: true,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: COVERED, upperArms: COVERED,
                legs: EXPOSED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  short_skirt: {
    zone: 'lower', layer: 'lower', fashnCategory: 'bottoms',
    adultOnlyTryOn: false, tearAllowed: false, preserveHemLength: true,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: COVERED, upperArms: COVERED,
                legs: EXPOSED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  tops: {
    zone: 'upper', layer: 'upper-base', fashnCategory: 'tops',
    adultOnlyTryOn: false, tearAllowed: true,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: COVERED, upperArms: COVERED,
                legs: COVERED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  cardigan: {
    zone: 'upper', layer: 'upper-outer', fashnCategory: 'tops',
    adultOnlyTryOn: false, tearAllowed: true, outerwear: true,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: COVERED, upperArms: COVERED,
                legs: COVERED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  bottoms: {
    zone: 'lower', layer: 'lower', fashnCategory: 'bottoms',
    adultOnlyTryOn: false, tearAllowed: false,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: COVERED, upperArms: COVERED,
                legs: COVERED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  'one-pieces': {
    zone: 'overall', layer: 'overall', fashnCategory: 'one-pieces',
    adultOnlyTryOn: false, tearAllowed: true,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: COVERED, upperArms: COVERED,
                legs: COVERED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  // --- Trang phục Nhật Bản ------------------------------------------------
  kimono: {
    zone: 'overall', layer: 'overall', fashnCategory: 'one-pieces', japanese: true,
    adultOnlyTryOn: false, tearAllowed: false, preserveConstruction: true,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: COVERED, upperArms: COVERED,
                legs: COVERED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  yukata: {
    zone: 'overall', layer: 'overall', fashnCategory: 'one-pieces', japanese: true,
    adultOnlyTryOn: false, tearAllowed: false, preserveConstruction: true,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: COVERED, upperArms: COVERED,
                legs: COVERED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  haori: {
    zone: 'upper', layer: 'upper-outer', fashnCategory: 'tops', japanese: true,
    adultOnlyTryOn: false, tearAllowed: false, preserveConstruction: true, outerwear: true,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: COVERED, upperArms: COVERED,
                legs: COVERED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  hakama: {
    zone: 'lower', layer: 'lower', fashnCategory: 'bottoms', japanese: true,
    adultOnlyTryOn: false, tearAllowed: false, preserveConstruction: true,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: COVERED, upperArms: COVERED,
                legs: COVERED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  jinbei: {
    zone: 'overall', layer: 'overall', fashnCategory: 'one-pieces', japanese: true,
    adultOnlyTryOn: false, tearAllowed: false, preserveConstruction: true,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: COVERED, upperArms: EXPOSED,
                legs: EXPOSED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  samue: {
    zone: 'overall', layer: 'overall', fashnCategory: 'one-pieces', japanese: true,
    adultOnlyTryOn: false, tearAllowed: false, preserveConstruction: true,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: COVERED, upperArms: COVERED,
                legs: COVERED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  noragi: {
    zone: 'upper', layer: 'upper-outer', fashnCategory: 'tops', japanese: true,
    adultOnlyTryOn: false, tearAllowed: false, preserveConstruction: true, outerwear: true,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: COVERED, upperArms: COVERED,
                legs: COVERED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
  happi: {
    zone: 'upper', layer: 'upper-outer', fashnCategory: 'tops', japanese: true,
    adultOnlyTryOn: false, tearAllowed: false, preserveConstruction: true, outerwear: true,
    coverage: { chest: COVERED, abdomen: COVERED, shoulders: COVERED, upperArms: COVERED,
                legs: COVERED, pelvis: COVERED, buttocks: COVERED, back: COVERED },
  },
};

// Nhận dạng theo TỪNG loại một, xét từ cụ thể tới tổng quát. Cố ý không dùng
// một biểu thức chung: "bikini hai mảnh" và "bikini top" phải ra hai kết quả
// khác nhau, và "áo tắm một mảnh" không được rơi vào nhánh bikini.
// Ranh giới từ ở đầu mẫu là BẮT BUỘC với các từ ngắn tiếng Việt. Không có nó,
// "lưng cao bikini" khớp nhầm mẫu "áo bikini" (vì "c-ao" chứa "ao") và một
// chiếc quần bikini bị phân loại thành áo bikini. Cùng loại lỗi chuỗi con đã
// từng khiến "ba lô" bị nhận thành cái dù trong lib/accessory.js.
const W = '(?:^|[\\s\\-_])';
const TYPE_PATTERNS = [
  ['bikini_two_piece', /(bikini\s*(hai|2)\s*m[ảa]nh|two[- ]?piece\s*bikini|set\s*bikini|bikini\s*set)/i],
  ['one_piece_swimsuit', new RegExp(`(${W}[áa]o\\s*t[ắa]m\\s*(m[ộo]t|1)\\s*m[ảa]nh|one[- ]?piece\\s*swim|monokini|swimsuit\\s*li[eề]n)`, 'i')],
  ['bikini_top', new RegExp(`(bikini\\s*(top|tr[êe]n)|${W}[áa]o\\s*bikini)`, 'i')],
  ['bikini_bottom', new RegExp(`(bikini\\s*(bottom|d[uư][ơo]i)|${W}qu[ầa]n\\s*bikini)`, 'i')],
  ['bikini_two_piece', /\bbikini\b/i],
  ['one_piece_swimsuit', new RegExp(`(${W}[đd][ồo]\\s*b[ơo]i|swimwear|swimsuit|${W}[áa]o\\s*t[ắa]m)`, 'i')],
  ['crop_top', new RegExp(`(crop\\s*top|${W}[áa]o\\s*croptop|${W}[áa]o\\s*l[ửu]ng|${W}[áa]o\\s*ng[ắa]n\\s*(th[âa]n|eo))`, 'i')],
  ['off_shoulder_top', /(tr[ễe]\s*vai|off[- ]?shoulder|b[ẹe]t\s*vai)/i],
  ['sleeveless_top', new RegExp(`(${W}s[áa]t\\s*n[áa]ch|${W}kh[oô]ng\\s*tay|sleeveless|tank\\s*top|${W}ba\\s*l[ỗo])`, 'i')],
  ['short_skirt', /(ch[âa]n\s*v[áa]y\s*ng[ắa]n|v[áa]y\s*ng[ắa]n|mini\s*skirt|short\s*skirt)/i],
  ['shorts', /(qu[ầa]n\s*(short|đùi|[đd]ui|ng[ắa]n)|shorts\b)/i],
  // Tên/slug hiện đại phải thắng category nhóm hàng cũ. Ví dụ cardigan p6
  // từng nằm trong cat="haori" và bị cấm hiệu ứng bục đường may như Haori.
  ['cardigan', /(cardigan|[áa]o\s*len\s*kho[áa]c)/i],
  ['hakama', /\bhakama\b/i],
  ['jinbei', /\bjinbei\b/i],
  ['samue', /\bsamue\b/i],
  ['noragi', /\bnoragi\b/i],
  ['happi', /\bhappi\b/i],
  ['haori', /(\bhaori\b|[áa]o\s*cho[àa]ng\s*nh[ậa]t)/i],
  ['yukata', /\byukata\b/i],
  ['kimono', /(\bkimono\b|furisode|tomesode)/i],
];

const normalize = (product = {}) => [
  product.name, product.nameJa, product.slug, product.cat, product.category,
  Array.isArray(product.tags) ? product.tags.join(' ') : product.tags,
].filter(Boolean).join(' ').toLowerCase();

/**
 * Loại trang phục. Ưu tiên `product.garmentType` nếu catalog đã khai báo —
 * dữ liệu tường minh luôn thắng suy đoán từ tên.
 */
function garmentTypeFor(product = {}) {
  const declared = String(product.garmentType || '').trim();
  if (declared && GARMENT_PROFILES[declared]) return declared;
  const text = normalize(product);
  for (const [type, pattern] of TYPE_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  // Không nhận ra thì rơi về ba vùng cũ, giữ nguyên hành vi cho catalog cũ.
  if (/(qu[ầa]n|ch[âa]n\s*v[áa]y|lower)/i.test(text)) return 'bottoms';
  if (/([đd][ầa]m|dress|outfit|[đd][ồo]ng\s*ph[ụu]c|uniform|b[ộo]\s*[đd][ồo]|cosplay)/i.test(text)) return 'one-pieces';
  return 'tops';
}

/** Hồ sơ độ che phủ đầy đủ của một sản phẩm. */
function coverageProfileFor(product = {}) {
  const type = garmentTypeFor(product);
  const profile = GARMENT_PROFILES[type] || GARMENT_PROFILES.tops;
  // Catalog được phép khai báo đè coverage cho từng sản phẩm cụ thể, nhưng
  // KHÔNG được hạ sàn an toàn.
  const coverage = { ...profile.coverage, ...(product.coverageProfile || {}) };
  for (const zone of ALWAYS_COVERED_ZONES) coverage[zone] = COVERED;
  return {
    garmentType: type,
    coverageProfile: coverage,
    zone: profile.zone,
    layer: profile.layer,
    fashnCategory: profile.fashnCategory,
    adultOnlyTryOn: Boolean(product.adultOnlyTryOn ?? profile.adultOnlyTryOn),
    // tearAllowed của sản phẩm chỉ được phép SIẾT chặt hơn, không nới lỏng.
    tearAllowed: Boolean(profile.tearAllowed) && product.tearAllowed !== false,
    swimwear: Boolean(profile.swimwear),
    twoPiece: Boolean(profile.twoPiece),
    japanese: Boolean(profile.japanese),
    outerwear: Boolean(profile.outerwear),
    preserveHemLength: Boolean(profile.preserveHemLength),
    preserveConstruction: Boolean(profile.preserveConstruction),
  };
}

const exposedZonesOf = (coverage) => BODY_ZONES.filter((zone) => coverage[zone] === EXPOSED);

/**
 * Chính sách an toàn cho cả một lượt thử (có thể gồm nhiều món).
 *
 * Gộp theo hướng AN TOÀN NHẤT: chỉ cần một món là đồ bơi thì cả lượt phải xác
 * nhận 18+, và chỉ cần một món cấm rách thì cả lượt cấm rách.
 */
function safetyPolicyFor(products = []) {
  const profiles = (Array.isArray(products) ? products : [products]).map(coverageProfileFor);
  const exposed = new Set();
  for (const profile of profiles) {
    for (const zone of exposedZonesOf(profile.coverageProfile)) exposed.add(zone);
  }
  return {
    garmentTypes: profiles.map((profile) => profile.garmentType),
    requires18Plus: profiles.some((profile) => profile.adultOnlyTryOn),
    containsSwimwear: profiles.some((profile) => profile.swimwear),
    // Da lộ ra ở các vùng này là ĐÚNG THIẾT KẾ — cổng chất lượng không được
    // coi là lỗi.
    intentionalSkinExposure: exposed.size > 0,
    allowedExposedZones: [...exposed],
    // Sàn an toàn tuyệt đối, không phụ thuộc sản phẩm.
    requiredCoveredZones: [...ALWAYS_COVERED_ZONES],
    tearAllowed: profiles.every((profile) => profile.tearAllowed),
    // VÌ SAO bị cấm bục — hai lý do rất khác nhau, và chỉ một trong hai là tuyệt đối.
    //
    //   'safety'       — bục là làm hở thêm cơ thể: đồ bơi, bikini, crop top,
    //                    short, chân váy ngắn. KHÔNG bao giờ được nới, kể cả khi
    //                    catalog không còn size nào đủ lớn.
    //   'construction' — bục làm sai kết cấu trang phục: kimono, yukata, haori,
    //                    áo khoác. Đây là yêu cầu về độ trung thực, không phải an
    //                    toàn; khi cơ thể đã vượt mọi size đang bán thì cho thấy
    //                    đường may bục vẫn trung thực hơn là một tấm ảnh phẳng lì.
    //   null           — không bị cấm.
    tearBlockReason: profiles.every((profile) => profile.tearAllowed)
      ? null
      : (profiles.some((profile) => !profile.tearAllowed
          && (profile.swimwear || profile.adultOnlyTryOn || profile.preserveHemLength))
        ? 'safety'
        : 'construction'),
    preserveHemLength: profiles.some((profile) => profile.preserveHemLength),
    preserveConstruction: profiles.some((profile) => profile.preserveConstruction),
  };
}

module.exports = {
  BODY_ZONES,
  ALWAYS_COVERED_ZONES,
  GARMENT_PROFILES,
  garmentTypeFor,
  coverageProfileFor,
  safetyPolicyFor,
  exposedZonesOf,
};
