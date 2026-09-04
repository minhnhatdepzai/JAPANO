// Chỗ ĐỨNG của một món đồ trên cơ thể, và bộ đồ đang thiếu chỗ nào.
//
// Vì sao cần module này: dự án đang có HAI hệ phân loại không nói chuyện với nhau.
//   - `garmentCoverage.js` biết rất chi tiết từng loại đồ che vùng nào, nằm lớp
//     nào (upper-base / upper-outer / lower / overall).
//   - `outfit.js` lại suy vai trò từ DANH MỤC sản phẩm và chỉ có bốn giá trị
//     base/outer/accessory/standalone — không hề có "quần" và không hề có "giày".
//
// Hệ quả đo được: không chỗ nào trong hệ thống trả lời được câu "bộ này có áo mà
// chưa có quần", nên không thể gợi ý món còn thiếu. Tệ hơn, `giay-dep`,
// `guoc-geta` và `vo-tat` đều rơi vào profile mặc định và bị coi là
// zone=upper/layer=upper-base — tức là hệ thống nghĩ đôi dép là một cái áo lớp
// trong.
//
// Module này là cầu nối: một hàm duy nhất trả về slot thật của sản phẩm, và một
// hàm đọc ra bộ đồ đang khuyết chỗ nào.
const { coverageProfileFor } = require('./garmentCoverage');
const { accessoryKind } = require('./accessory');

const SLOT_UPPER_BASE = 'upper-base';
const SLOT_UPPER_OUTER = 'upper-outer';
const SLOT_LOWER = 'lower';
const SLOT_OVERALL = 'overall';
const SLOT_FEET = 'feet';

// Slot mặc trên thân — mỗi slot chỉ giữ được một món mỗi lượt.
const BODY_SLOTS = [SLOT_OVERALL, SLOT_UPPER_BASE, SLOT_UPPER_OUTER, SLOT_LOWER, SLOT_FEET];

const SLOT_LABELS = {
  [SLOT_UPPER_BASE]: 'áo lớp trong',
  [SLOT_UPPER_OUTER]: 'áo khoác ngoài',
  [SLOT_LOWER]: 'quần hoặc chân váy',
  [SLOT_OVERALL]: 'bộ liền thân',
  [SLOT_FEET]: 'giày dép',
};

function categoryOf(product = {}) {
  return String(product.cat || product.category || '');
}

/** Slot thật của một sản phẩm. Giày dép nằm ở `feet`, không phải phụ kiện chung. */
function slotOf(product = {}) {
  if (categoryOf(product) === 'phu-kien') {
    // accessoryKind đã nhận diện được giày/dép/guốc/geta/tabi/zori từ trước; chỗ
    // này chỉ nâng nó lên thành một slot cơ thể thật thay vì gộp vào "phụ kiện".
    return accessoryKind(product) === 'shoe' ? SLOT_FEET : `accessory:${accessoryKind(product)}`;
  }
  return coverageProfileFor(product).layer;
}

function isBodySlot(slot) {
  return BODY_SLOTS.includes(slot);
}

/** Thân trên + thân dưới đã được che kín chưa. */
function torsoCovered(slots) {
  if (slots.has(SLOT_OVERALL)) return true;
  return slots.has(SLOT_UPPER_BASE) && slots.has(SLOT_LOWER);
}

/**
 * Đọc một bộ đồ: slot nào đã có, slot nào còn thiếu, có xung đột gì.
 *
 * `missing` chia hai mức:
 *   - required: thiếu là bộ đồ KHÔNG mặc được ngoài đời (có áo khoác mà không có
 *     áo trong, có áo mà không có quần). Đây cũng chính là nguồn gốc của ảnh
 *     "mặc haori trên da trần": người dùng chọn mỗi áo khoác, model không có lớp
 *     trong nào để giữ nên vẽ ra da.
 *   - optional: thiếu thì bộ đồ vẫn hợp lệ, chỉ là chưa trọn vẹn (giày dép).
 */
function analyseOutfit(products = []) {
  const bySlot = new Map();
  const conflicts = [];
  const accessories = [];

  for (const product of products) {
    const slot = slotOf(product);
    if (!isBodySlot(slot)) { accessories.push({ slot, product }); continue; }
    if (bySlot.has(slot)) {
      conflicts.push({
        slot,
        reason: 'duplicate_slot',
        items: [bySlot.get(slot).name, product.name],
        message: `Chỉ mặc được một ${SLOT_LABELS[slot]} mỗi lượt: "${bySlot.get(slot).name}" và "${product.name}".`,
      });
      continue;
    }
    bySlot.set(slot, product);
  }

  const slots = new Set(bySlot.keys());

  // Bộ liền thân đã phủ kín người thì không mặc chồng món thân trên/dưới nào nữa.
  if (slots.has(SLOT_OVERALL)) {
    for (const slot of [SLOT_UPPER_BASE, SLOT_UPPER_OUTER, SLOT_LOWER]) {
      if (!slots.has(slot)) continue;
      conflicts.push({
        slot,
        reason: 'overall_conflict',
        items: [bySlot.get(SLOT_OVERALL).name, bySlot.get(slot).name],
        message: `"${bySlot.get(SLOT_OVERALL).name}" là bộ liền thân nên không mặc chồng thêm ${SLOT_LABELS[slot]}.`,
      });
    }
  }

  const missing = [];
  if (!slots.has(SLOT_OVERALL)) {
    if (!slots.has(SLOT_UPPER_BASE)) {
      missing.push({
        slot: SLOT_UPPER_BASE,
        level: slots.has(SLOT_UPPER_OUTER) ? 'required' : 'optional',
        label: SLOT_LABELS[SLOT_UPPER_BASE],
        // Áo khoác mà không có lớp trong là ca nguy hiểm chứ không chỉ thiếu thẩm mỹ.
        message: slots.has(SLOT_UPPER_OUTER)
          ? 'Bạn đang chọn áo khoác ngoài mà chưa có áo lớp trong. Hãy thêm một chiếc áo mặc bên trong.'
          : 'Chưa có áo cho phần thân trên.',
      });
    }
    if (!slots.has(SLOT_LOWER)) {
      missing.push({
        slot: SLOT_LOWER,
        level: slots.has(SLOT_UPPER_BASE) || slots.has(SLOT_UPPER_OUTER) ? 'required' : 'optional',
        label: SLOT_LABELS[SLOT_LOWER],
        message: 'Chưa có quần hoặc chân váy cho phần thân dưới.',
      });
    }
  }
  if (!slots.has(SLOT_FEET)) {
    missing.push({
      slot: SLOT_FEET,
      level: 'optional',
      label: SLOT_LABELS[SLOT_FEET],
      message: 'Thêm một đôi giày dép để bộ đồ trọn vẹn.',
    });
  }

  return {
    slots: Object.fromEntries([...bySlot].map(([slot, product]) => [slot, { slug: product.slug || product.id, name: product.name }])),
    accessories: accessories.map((item) => ({ slot: item.slot, slug: item.product.slug || item.product.id, name: item.product.name })),
    filled: [...slots],
    missing,
    conflicts,
    complete: torsoCovered(slots) && !conflicts.length,
    torsoCovered: torsoCovered(slots),
  };
}

module.exports = {
  slotOf, analyseOutfit, isBodySlot, torsoCovered,
  BODY_SLOTS, SLOT_LABELS,
  SLOT_UPPER_BASE, SLOT_UPPER_OUTER, SLOT_LOWER, SLOT_OVERALL, SLOT_FEET,
};
