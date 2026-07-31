// Thêm đánh giá sản phẩm MẪU (văn minh, đa dạng 3-5 sao) gắn đúng đơn đã mua
// (verified purchase) + vài lượt "hữu ích". Chạy lại an toàn: bỏ qua cặp
// (user, sản phẩm) đã có đánh giá. Không đụng dữ liệu khác.
const path = require('path');
const { createStore } = require('../lib/store');

const store = createStore(path.join(__dirname, '..', 'data', 'db.json'));
const state = store.read();

const uname = Object.fromEntries(state.users.map((u) => [u.id, u.name]));

// Bản đồ: slug -> danh sách {userId, order} đã mua & nhận (completed/shipping)
const buyers = {};
for (const o of state.orders) {
  if (!['completed', 'shipping'].includes(o.status) || !o.userId || String(o.userId).startsWith('o')) continue;
  for (const it of o.items || []) {
    const slug = it.slug || it.productId;
    if (!slug) continue;
    (buyers[slug] = buyers[slug] || []).push({ userId: o.userId, order: o });
  }
}

// Đánh giá mẫu — chỉ nội dung văn minh (phần lớn tích cực, vài góp ý thẳng thắn).
const REVIEWS = [
  ['kimono-hong', 5, 'Vải mềm, lên dáng chuẩn, hoa văn đẹp đúng như hình. Mặc đi lễ hội ai cũng khen.'],
  ['kimono-hong', 4, 'Kimono đẹp, màu hồng nhã. Trừ 1 sao vì phần eo hơi rộng so với mình, nên chọn kỹ size.'],
  ['yukata-xanh', 5, 'Yukata cotton mát, xanh đen rất sang. Đóng gói cẩn thận, giao đúng hẹn.'],
  ['yukata-xanh', 4, 'Chất ổn trong tầm giá, đường may gọn gàng. Giao chậm hơn dự kiến một hôm nhưng shop báo trước nên vẫn ok.'],
  ['haori-dang-dai', 5, 'Haori dáng dài khoác ngoài cực chất, phối với áo trơn là đẹp. Rất đáng tiền.'],
  ['haori-dang-dai', 4, 'Form dài thanh thoát, vải dày dặn. Màu ngoài thực tế trầm hơn hình một chút.'],
  ['cardigan-dai', 5, 'Áo len mềm, ấm, dáng dài che được nhiều khuyết điểm. Đi làm hay dạo phố đều hợp.'],
  ['cardigan-dai', 3, 'Cardigan đẹp và dễ phối, nhưng chất hơi xù nhẹ sau lần giặt đầu. Nên giặt tay cho bền.'],
  ['so-mi-trang', 5, 'Sơ mi trắng basic mà form đẹp, vải không bị mỏng lộ. Sẽ ủng hộ thêm.'],
  ['blazer-kaki', 5, 'Blazer kaki lịch sự, cổ đứng tôn dáng. Mặc đi làm được đồng nghiệp khen nhiều.'],
  ['ao-len-co-lo', 4, 'Áo cổ lọ ấm, ôm vừa người. Mùa đông mặc trong áo khoác rất hợp, màu be dễ phối.'],
  ['guoc-geta', 5, 'Guốc gỗ chắc chắn, đi êm hơn mình nghĩ. Chụp ảnh cùng yukata rất lên hình.'],
  ['mu-nhat', 4, 'Mũ bo đội vừa đầu, form giữ tốt. Chất lượng ổn so với giá.'],
  ['du-nhat', 5, 'Dù đẹp, khung chắc, che nắng che mưa đều tốt. Cầm đi chụp ảnh rất xịn.'],
  ['gang-tay', 5, 'Găng len ấm, co giãn tốt, dùng điện thoại vẫn cảm ứng được. Rất đáng mua.'],
  ['yumeko', 5, 'Bộ cosplay Yumeko chi tiết đẹp, may kỹ. Đi sự kiện được nhiều người xin chụp ảnh.'],
  ['furina', 4, 'Cosplay Furina màu chuẩn, phụ kiện đầy đủ. Váy hơi dày nên mặc lâu hơi nóng nhưng nhìn rất đẹp.'],
  ['kiem-go', 5, 'Kiếm gỗ làm đạo cụ chắc tay, đường vân gỗ đẹp. Giao nhanh, đóng gói kỹ.'],
  ['kep-no', 5, 'Kẹp nơ xinh, giữ tóc chắc. Nhỏ gọn mà tạo điểm nhấn dễ thương.'],
  ['yae-miko', 4, 'Trang phục Yae Miko đẹp, lên đồ chuẩn nhân vật. Cần là ủi nhẹ trước khi mặc cho phẳng.'],
];

state.reviews = state.reviews || [];
state.reviewReactions = state.reviewReactions || [];
const has = (userId, slug) => state.reviews.some((r) => r.userId === userId && r.productId === slug);
const usedPerSlug = {};
const now = Date.now();
let added = 0;

for (const [slug, rating, comment] of REVIEWS) {
  const pool = buyers[slug] || [];
  usedPerSlug[slug] = usedPerSlug[slug] || new Set();
  const pick = pool.find((b) => !usedPerSlug[slug].has(b.userId) && !has(b.userId, slug));
  if (!pick) { console.log('· bỏ qua (không có người mua trống):', slug); continue; }
  usedPerSlug[slug].add(pick.userId);
  const created = Math.min(now - 3600_000, Number(pick.order.createdAt || now) + (2 + Math.floor(Math.random() * 6)) * 86400_000);
  const review = {
    id: `review-seed-${slug}-${pick.userId}`,
    productId: slug,
    userId: pick.userId,
    userName: uname[pick.userId] || pick.order.customer?.name || 'Khách đã mua',
    orderId: pick.order.id,
    orderCode: pick.order.code,
    rating,
    comment,
    media: null,
    status: 'approved',
    moderation: { decision: 'approved', score: 0, engine: 'bộ lọc chống lách luật', reason: 'Không phát hiện công kích hoặc nội dung nhạy cảm.', checkedAt: created },
    createdAt: created,
    updatedAt: created,
  };
  state.reviews.push(review);
  added += 1;

  // Vài lượt "hữu ích" từ người khác (không phải tác giả) cho chân thực.
  const voters = state.users.map((u) => u.id).filter((id) => id !== pick.userId && !String(id).startsWith('o'));
  const nHelpful = Math.floor(Math.random() * 7); // 0..6
  for (let i = 0; i < nHelpful && i < voters.length; i += 1) {
    state.reviewReactions.push({ id: `reaction-seed-${review.id}-${i}`, reviewId: review.id, userId: voters[i], value: 'helpful', updatedAt: created + 3600_000 });
  }
  if (Math.random() < 0.25 && voters[nHelpful]) {
    state.reviewReactions.push({ id: `reaction-seed-${review.id}-nh`, reviewId: review.id, userId: voters[nHelpful], value: 'not_helpful', updatedAt: created + 3600_000 });
  }
}

store.write(state);
const dist = [5, 4, 3, 2, 1].map((r) => r + '★:' + state.reviews.filter((x) => x.rating === r).length).join('  ');
console.log(`\nĐã thêm ${added} đánh giá mẫu. Tổng reviews: ${state.reviews.length} | reactions: ${state.reviewReactions.length}`);
console.log('Phân bố sao:', dist);
