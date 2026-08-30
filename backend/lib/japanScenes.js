// Góc chụp ("scene") dùng để ghép người vào phong cảnh Nhật Bản.
//
// KHÁC với japanSceneBackgrounds.js: file kia là ảnh minh hoạ ĐỊA ĐIỂM cho màn
// Khám phá; file này là ảnh đã được duyệt để ĐẶT NGƯỜI vào. Hai việc khác nhau,
// và trộn lẫn chúng chính là nguyên nhân của ảnh Naoshima cũ: một bức chụp từ
// trên thuyền, 45% dưới khung là mặt biển, nên người bị đặt đứng giữa nước.
//
// Vì sao mỗi scene cần toạ độ riêng: dùng một điểm đặt chân chung (giữa khung,
// sát đáy) chỉ đúng khi mọi ảnh đều có mặt đất ở đáy khung — điều gần như không
// bao giờ xảy ra. Ảnh chụp ngang tầm mắt có đường chân trời khác nhau, mặt đất
// bắt đầu ở độ cao khác nhau, và landmark nằm ở chỗ khác nhau.
//
// Ảnh phải tự tải từ nguồn có giấy phép rõ ràng. KHÔNG mặc định mọi ảnh
// Wikimedia đều dùng được — mỗi file dưới đây đã được tra giấy phép riêng.
//
// Tỉ lệ đều là 0..1 theo khung ảnh, không phải pixel, nên đổi độ phân giải ảnh
// không làm sai vị trí.
//
// Ảnh được TẢI VỀ và phục vụ từ mobile/assets/japan-scenes/ thay vì hotlink
// Wikimedia. Ba lý do: Wikimedia chỉ trả về đúng những kích thước đã render sẵn
// (xin 1800px cho ra HTTP 400 trong khi 1920px thì được), hotlink phụ thuộc một
// dịch vụ ngoài tầm kiểm soát, và tự phục vụ thì lúc ghép ảnh không cần gọi
// mạng ra ngoài lần nào. Giấy phép vẫn phải ghi công đầy đủ ở dưới.
const path = require('path');

const SCENE_DIR = path.join(__dirname, '..', '..', 'mobile', 'assets', 'japan-scenes');

const SCENES = Object.freeze([
  {
    id: 'naoshima-miyanoura-promenade',
    spotPlace: 'Đảo nghệ thuật Naoshima',
    spotPrefecture: 'Kagawa',
    name: 'Quảng trường cảng Miyanoura',
    mood: 'Biểu tượng',
    timeOfDay: 'day',
    season: 'all',
    imageFile: 'naoshima-miyanoura-promenade.jpg',
    thumbnailUrl: '/assets/japan-scenes/naoshima-miyanoura-promenade-thumb.webp',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Miyanoura_port06s3872.jpg',
    author: '663highland',
    license: 'CC BY 2.5',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.5/',
    attribution: '663highland, CC BY 2.5, qua Wikimedia Commons',
    checkedAt: '2026-08-29',
    groundType: 'bê tông',
    wardrobeNote: 'Nền bê tông xám và mái thép trắng làm nổi màu sáng và màu pastel.',
    composition: {
      horizonY: 0.31,
      groundLineY: 0.44,
      // Đặt lệch trái: mái canopy của bến phà là landmark, trải từ x≈0.28 sang phải.
      footAnchor: { x: 0.22, y: 0.86 },
      personHeightRatio: { min: 0.34, preferred: 0.50, max: 0.62 },
      safeZone: { x: 0.05, y: 0.30, width: 0.34, height: 0.66 },
      landmarkAvoidRects: [{ x: 0.28, y: 0.10, width: 0.72, height: 0.36 }],
      groundPolygon: [[0.0, 0.46], [1.0, 0.44], [1.0, 1.0], [0.0, 1.0]],
      lightDirection: 'upper-right',
      lightTemperature: 'neutral',
      shadowOpacity: 0.16,
      shadowBlur: 22,
      shadowAngle: -14,
      personSlots: [
        { id: 'left', label: 'Bên trái', x: 0.22 },
        { id: 'center', label: 'Giữa', x: 0.42 },
      ],
    },
  },
  {
    id: 'naoshima-honmura-street',
    spotPlace: 'Đảo nghệ thuật Naoshima',
    spotPrefecture: 'Kagawa',
    name: 'Phố cổ Honmura',
    mood: 'Yên tĩnh',
    timeOfDay: 'day',
    season: 'all',
    imageFile: 'naoshima-honmura-street.jpg',
    thumbnailUrl: '/assets/japan-scenes/naoshima-honmura-street-thumb.webp',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Naoshima_honmura_gallery.jpg',
    author: 'Artandgeograph',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution: 'Artandgeograph, CC BY-SA 4.0, qua Wikimedia Commons',
    checkedAt: '2026-08-29',
    groundType: 'đường nhựa',
    wardrobeNote: 'Gỗ cháy yakisugi màu tối làm nền tương phản mạnh cho kimono và đồ sáng màu.',
    composition: {
      horizonY: 0.55,
      groundLineY: 0.76,
      footAnchor: { x: 0.17, y: 0.94 },
      personHeightRatio: { min: 0.34, preferred: 0.46, max: 0.58 },
      safeZone: { x: 0.03, y: 0.34, width: 0.28, height: 0.62 },
      landmarkAvoidRects: [{ x: 0.30, y: 0.02, width: 0.68, height: 0.76 }],
      groundPolygon: [[0.0, 0.80], [1.0, 0.74], [1.0, 1.0], [0.0, 1.0]],
      lightDirection: 'upper-left',
      lightTemperature: 'neutral',
      shadowOpacity: 0.20,
      shadowBlur: 16,
      shadowAngle: 18,
      personSlots: [{ id: 'left', label: 'Bên trái', x: 0.17 }],
    },
  },
  {
    id: 'fushimi-inari-senbon-torii',
    spotPlace: 'Đền Fushimi Inari',
    spotPrefecture: 'Kyoto',
    name: 'Lối Senbon Torii',
    mood: 'Biểu tượng',
    timeOfDay: 'day',
    season: 'all',
    imageFile: 'fushimi-inari-senbon-torii.jpg',
    thumbnailUrl: '/assets/japan-scenes/fushimi-inari-senbon-torii-thumb.webp',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fushimi-Inari-Shrine-Senbon-Torii-2018-Luka-Peternel.jpg',
    author: 'Luka Peternel',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution: 'Luka Peternel, CC BY-SA 4.0, qua Wikimedia Commons',
    checkedAt: '2026-08-29',
    groundType: 'đá lát',
    wardrobeNote: 'Cổng son đỏ rất mạnh màu: đồ trung tính, trắng hoặc chàm nổi hơn đồ đỏ/cam.',
    // Đền thờ — trang phục phải kín đáo. Cờ này chặn gợi ý đồ bơi ở bước
    // recommendations, không phải ở bước ghép ảnh.
    modestDress: true,
    composition: {
      horizonY: 0.44,
      groundLineY: 0.70,
      footAnchor: { x: 0.45, y: 0.95 },
      personHeightRatio: { min: 0.42, preferred: 0.60, max: 0.72 },
      safeZone: { x: 0.24, y: 0.26, width: 0.42, height: 0.70 },
      // Hành lang torii bao quanh chứ không nằm sau lưng, nên vùng "tránh" là
      // hai bên cột: đứng giữa lối là đúng chỗ và không che gì.
      landmarkAvoidRects: [
        { x: 0.0, y: 0.0, width: 0.22, height: 1.0 },
        { x: 0.70, y: 0.0, width: 0.30, height: 1.0 },
      ],
      groundPolygon: [[0.22, 0.72], [0.72, 0.70], [1.0, 1.0], [0.0, 1.0]],
      lightDirection: 'upper-left',
      lightTemperature: 'warm',
      shadowOpacity: 0.24,
      shadowBlur: 14,
      shadowAngle: 22,
      personSlots: [
        { id: 'center', label: 'Giữa lối', x: 0.45 },
        { id: 'right', label: 'Bên phải', x: 0.58 },
      ],
    },
  },
]);

const BY_ID = new Map(SCENES.map((scene) => [scene.id, scene]));

function spotKey(place, prefecture) {
  return `${String(place || '').trim()}::${String(prefecture || '').trim()}`;
}

const BY_SPOT = new Map();
for (const scene of SCENES) {
  const key = spotKey(scene.spotPlace, scene.spotPrefecture);
  if (!BY_SPOT.has(key)) BY_SPOT.set(key, []);
  BY_SPOT.get(key).push(scene);
}

/** Thông tin scene an toàn để trả cho app: không có toạ độ nội bộ nào bị giấu. */
function publicScene(scene) {
  const { composition, imageFile, ...rest } = scene;
  return {
    ...rest,
    // App cần biết vị trí đặt người để vẽ hình bóng mờ lên thumbnail.
    footAnchor: composition.footAnchor,
    personHeightRatio: composition.personHeightRatio,
    safeZone: composition.safeZone,
    personSlots: composition.personSlots,
  };
}

function scenesForSpot(place, prefecture) {
  return (BY_SPOT.get(spotKey(place, prefecture)) || []).map(publicScene);
}

/** Đường dẫn đĩa của ảnh nền. Chỉ dùng trong tiến trình backend. */
function sceneImagePath(scene) {
  return path.join(SCENE_DIR, scene.imageFile);
}

function findScene(id) {
  return BY_ID.get(String(id || '').trim()) || null;
}

/** Địa điểm nào đã có góc chụp được duyệt. */
function spotsWithScenes() {
  return [...BY_SPOT.keys()].map((key) => {
    const [place, prefecture] = key.split('::');
    return { place, prefecture, sceneCount: BY_SPOT.get(key).length };
  });
}

module.exports = { SCENES, SCENE_DIR, sceneImagePath, publicScene, scenesForSpot, findScene, spotsWithScenes, spotKey };
