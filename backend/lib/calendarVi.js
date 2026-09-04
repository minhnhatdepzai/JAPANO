// Lịch, mùa và ngày lễ — dữ kiện để chatbot trả lời "hôm nay là ngày gì" và
// "mùa này mặc gì".
//
// Vì sao cần: chatbot vốn không có bất kỳ khái niệm nào về thời gian, nên
// "hôm nay là ngày gì" rơi thẳng vào câu "chưa đủ dữ kiện". Còn câu hỏi theo mùa
// thì khớp intent `outfit` chung và trả về một set ghép theo màu, không hề nhắc
// tới mùa — thậm chí chọn Quạt giấy làm món chính cho mùa hè.
//
// Toàn bộ ở đây là tra bảng tất định, không gọi model: ngày lễ là dữ kiện, không
// phải thứ để suy đoán.

const WEEKDAYS = ['Chủ nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'];

// CHỈ ngày lễ dương lịch cố định. Tết Nguyên đán, Trung thu, Vu Lan… theo âm
// lịch nên đổi ngày mỗi năm; muốn trả lời đúng phải có bảng quy đổi âm lịch chứ
// không được đoán, nên tạm không đưa vào đây.
const FIXED_HOLIDAYS = {
  '01-01': 'Tết Dương lịch · Nhật Bản đón Ganjitsu (元日)',
  '02-03': 'Setsubun (節分) của Nhật — lễ xua tà, đón mùa xuân',
  '02-14': 'Valentine',
  '03-03': 'Hinamatsuri (雛祭り) — lễ búp bê cho bé gái ở Nhật',
  '03-08': 'Quốc tế Phụ nữ',
  '04-30': 'Ngày Giải phóng miền Nam, thống nhất đất nước',
  '05-01': 'Quốc tế Lao động',
  '05-05': 'Kodomo no Hi (こどもの日) — Tết thiếu nhi Nhật Bản',
  '07-07': 'Tanabata (七夕) — lễ Thất tịch của Nhật',
  '09-02': 'Quốc khánh Việt Nam',
  '10-20': 'Ngày Phụ nữ Việt Nam',
  '11-15': 'Shichi-Go-San (七五三) — lễ mừng tuổi trẻ em ở Nhật',
  '11-20': 'Ngày Nhà giáo Việt Nam',
  '12-24': 'Đêm Giáng sinh',
  '12-25': 'Giáng sinh',
  '12-31': 'Tất niên',
};

// Mùa theo cảm nhận ở Việt Nam (miền Bắc rõ bốn mùa nhất). Đây là quy ước để
// gợi ý quần áo, không phải định nghĩa khí tượng.
const SEASON_MONTHS = {
  xuân: [2, 3, 4],
  hè: [5, 6, 7, 8],
  thu: [9, 10, 11],
  đông: [12, 1],
};

const SEASON_NOTE = {
  xuân: 'trời ấm dần, hay có mưa phùn và nồm ẩm',
  hè: 'nắng gắt và oi, cần đồ nhẹ thoáng',
  thu: 'trời dịu, sáng tối se lạnh — dễ mặc nhiều lớp nhất trong năm',
  đông: 'lạnh, cần giữ ấm và mặc nhiều lớp',
};

// Từ khoá để nhận ra người dùng đang hỏi về mùa nào.
const SEASON_PATTERNS = [
  { season: 'đông', test: /(mùa đông|mua dong|trời lạnh|troi lanh|lạnh quá|rét|ret buot|giá rét)/i },
  { season: 'hè', test: /(mùa hè|mua he|mùa hạ|trời nóng|troi nong|nóng quá|oi bức|nắng nóng)/i },
  { season: 'thu', test: /(mùa thu|mua thu|se lạnh|chớm lạnh|thu sang)/i },
  { season: 'xuân', test: /(mùa xuân|mua xuan|nồm|nom am|mưa phùn|chớm ấm)/i },
];

function two(value) {
  return String(value).padStart(2, '0');
}

function seasonOfMonth(month) {
  for (const [season, months] of Object.entries(SEASON_MONTHS)) {
    if (months.includes(month)) return season;
  }
  return 'thu';
}

/** Mùa mà câu hỏi nhắc tới; null nếu người dùng không nói mùa nào. */
function seasonFromMessage(message) {
  const raw = String(message || '');
  return SEASON_PATTERNS.find((item) => item.test.test(raw))?.season || null;
}

/** Dữ kiện về một ngày cụ thể (mặc định là hôm nay). */
function describeDay(now = new Date()) {
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const key = `${two(month)}-${two(day)}`;
  const season = seasonOfMonth(month);
  return {
    weekday: WEEKDAYS[now.getDay()],
    day,
    month,
    year,
    dateText: `${WEEKDAYS[now.getDay()]}, ngày ${two(day)}/${two(month)}/${year}`,
    holiday: FIXED_HOLIDAYS[key] || null,
    season,
    seasonNote: SEASON_NOTE[season],
  };
}

/** Sản phẩm hợp mùa, đọc từ tag/tên thật trong catalog chứ không đoán. */
function seasonKeywords(season) {
  switch (season) {
    case 'đông': return ['mùa đông', 'len', 'khoác', 'hanten', 'dạ', 'nỉ', 'ấm', 'chần bông'];
    case 'hè': return ['mùa hè', 'yukata', 'jinbei', 'cotton', 'linen', 'mỏng', 'thoáng'];
    case 'thu': return ['mùa thu', 'haori', 'cardigan', 'khoác nhẹ', 'len mỏng'];
    default: return ['mùa xuân', 'nhẹ', 'khoác mỏng', 'cardigan'];
  }
}

/**
 * Chọn đồ hợp mùa. Ưu tiên QUẦN ÁO MẶC ĐƯỢC lên trước phụ kiện: bản cũ để
 * "Quạt giấy Nhật Bản" (tag `mùa hè`) làm món chính cho câu hỏi mùa hè, đúng tag
 * nhưng sai câu trả lời — người ta hỏi mặc gì, không hỏi cầm gì.
 */
function seasonalPicks(products, season, limit = 4) {
  const keywords = seasonKeywords(season);
  const scored = [];
  for (const product of products) {
    const haystack = [
      product.name, product.slug,
      ...(product.tags || []), ...(product.visualTags || []),
    ].join(' ').toLowerCase();
    let score = 0;
    for (const [index, keyword] of keywords.entries()) {
      if (haystack.includes(keyword)) score += index === 0 ? 3 : 1;
    }
    if (!score) continue;
    const isAccessory = (product.cat || product.category) === 'phu-kien';
    scored.push({ product, score: score + (isAccessory ? 0 : 2), isAccessory });
  }
  scored.sort((left, right) => right.score - left.score);
  const wearable = scored.filter((item) => !item.isAccessory).map((item) => item.product);
  const accessories = scored.filter((item) => item.isAccessory).map((item) => item.product);
  // Giữ tối đa một phụ kiện để câu trả lời vẫn là "mặc gì" chứ không thành
  // danh sách đồ cầm tay.
  return [...wearable, ...accessories.slice(0, 1)].slice(0, limit);
}

/**
 * Các ngày lễ dương lịch sắp tới trong `days` ngày, kèm số ngày còn lại.
 *
 * Chỉ liệt kê lễ có trong bảng cố định. Không suy đoán lễ âm lịch — nói "còn 12
 * ngày nữa tới Trung thu" mà tính sai còn tệ hơn là không nói.
 */
function upcomingHolidays(now = new Date(), days = 60, limit = 3) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out = [];
  for (let offset = 1; offset <= days; offset += 1) {
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    const key = `${two(cursor.getMonth() + 1)}-${two(cursor.getDate())}`;
    const name = FIXED_HOLIDAYS[key];
    if (!name) continue;
    out.push({
      name,
      inDays: offset,
      dateText: `${two(cursor.getDate())}/${two(cursor.getMonth() + 1)}`,
      season: seasonOfMonth(cursor.getMonth() + 1),
    });
    if (out.length >= limit) break;
  }
  return out;
}

module.exports = {
  WEEKDAYS, FIXED_HOLIDAYS, SEASON_MONTHS, SEASON_NOTE,
  describeDay, seasonFromMessage, seasonOfMonth, seasonalPicks, seasonKeywords,
  upcomingHolidays,
};
