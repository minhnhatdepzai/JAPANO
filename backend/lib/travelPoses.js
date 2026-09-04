// Các dáng du lịch được FLUX.2 dựng trước khi FASHN mặc trang phục.
//
// Placement và pose là hai bài toán tách biệt:
// - poseId điều khiển hình học cơ thể bằng AI;
// - scene/slot điều khiển vị trí bàn chân bằng metadata đã duyệt.
// Không bao giờ để model sinh ảnh tự đoán chỗ đứng vì nó không có cam kết rằng
// bàn chân sẽ nằm trên mặt đất thay vì nước, mái nhà hoặc bầu trời.
const TRAVEL_POSES = Object.freeze([
  {
    id: 'relaxed',
    label: 'Đứng thư giãn',
    description: 'Trọng tâm nhẹ sang một chân, hai tay tự nhiên; hợp sân rộng và bãi cỏ.',
  },
  {
    id: 'stroll',
    label: 'Bước dạo nhẹ',
    description: 'Một bước ngắn, tay đánh nhẹ; hợp phố, lối đi và đường hoa.',
  },
  {
    id: 'three-quarter',
    label: 'Nghiêng 3/4',
    description: 'Vai và hông xoay nhẹ về máy ảnh; hợp cảnh có landmark lớn.',
  },
  {
    id: 'greeting',
    label: 'Chào duyên dáng',
    description: 'Một tay chào thấp không che thân, dáng đứng kín đáo; hợp đền, chùa và phố cổ.',
  },
]);

const BY_ID = new Map(TRAVEL_POSES.map((pose) => [pose.id, pose]));

function findTravelPose(id) {
  return BY_ID.get(String(id || '').trim()) || null;
}

function recommendedTravelPose(scene = {}) {
  const text = [scene.spotPlace, scene.name, scene.mood, scene.groundType].join(' ').toLowerCase();
  const safeWidth = Number(scene.composition?.safeZone?.width || 0);
  if (scene.modestDress || /đền|chùa|temple|shrine/.test(text)) return 'greeting';
  if (/phố|đường|lối|street|path|avenue/.test(text) && safeWidth >= 0.25) return 'stroll';
  if (/lãng mạn|hoa|cổ điển|hoài cổ/.test(text)) return 'three-quarter';
  return 'relaxed';
}

function publicTravelPoses(scene = {}) {
  const recommendedId = recommendedTravelPose(scene);
  return TRAVEL_POSES.map((pose) => ({ ...pose, recommended: pose.id === recommendedId }));
}

module.exports = {
  TRAVEL_POSES,
  findTravelPose,
  recommendedTravelPose,
  publicTravelPoses,
};
