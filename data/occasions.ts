import { products } from './catalog';

export type UserOccasionInput = {
  birthday?: string;
  specialDates?: Array<{ name: string; date: string; productIds?: string[] }>;
};

export type OccasionRecommendation = {
  key: string;
  name: string;
  dateLabel: string;
  daysUntil: number;
  intro: string;
  reason: string;
  productIds: string[];
};

const fixed = [
  { key: 'new-year', name: 'Tết Tây 1/1', month: 1, day: 1, productIds: ['p1', 'p4', 'p8'], intro: 'Năm mới là lúc làm mới tủ đồ và chuẩn bị quà tặng đầu năm.', reason: 'Ưu tiên các món trang trọng, dễ tặng và có câu chuyện đẹp.' },
  { key: 'womens-day', name: 'Ngày Quốc tế Phụ nữ 8/3', month: 3, day: 8, productIds: ['p2', 'p4', 'p9'], intro: 'Dịp 8/3 phù hợp với quà tinh tế và item thanh lịch.', reason: 'Các món này dễ phối, lịch sự và hợp làm quà cho phái nữ.' },
  { key: 'vietnam-japan', name: 'Lễ hội Việt - Nhật', month: 3, day: 9, productIds: ['p1', 'p4', 'p7'], intro: 'Lễ hội Việt Nhật hợp với sản phẩm giao thoa văn hóa.', reason: 'Chọn item mang cảm hứng Việt - Nhật và dễ làm quà lưu niệm.' },
  { key: 'hung-kings', name: 'Giỗ Tổ Hùng Vương', lunarHint: true, month: 4, day: 18, productIds: ['p4', 'p7', 'p8'], intro: 'Giỗ Tổ phù hợp với các món quà trang trọng và sản phẩm mang tinh thần truyền thống.', reason: 'Gợi ý tập trung vào trang phục truyền thống Việt Nam, quà lịch sự và đồ dùng có câu chuyện văn hóa.' },
  { key: '30-4', name: 'Ngày 30/4', month: 4, day: 30, productIds: ['p3', 'p9', 'p16'], intro: 'Kỳ nghỉ 30/4 phù hợp đồ đi chơi, du lịch ngắn ngày.', reason: 'Ưu tiên sự thoải mái, tiện dụng và dễ di chuyển.' },
  { key: '1-5', name: 'Ngày Quốc tế Lao động 1/5', month: 5, day: 1, productIds: ['p3', 'p9', 'p10'], intro: 'Ngày 1/5 hợp với các món thực dụng cho nghỉ ngơi và đi chơi.', reason: 'Chọn sản phẩm bền, dễ dùng và có thể mang theo.' },
  { key: 'children-pre', name: 'Gợi ý quà 1/6 từ 30/5', month: 5, day: 30, productIds: ['p6', 'p13', 'p16'], intro: 'Từ 30/5 JAPANO bắt đầu gợi ý quà thiếu nhi để bạn chuẩn bị sớm.', reason: 'Thẻ bài, quần áo trẻ em và phụ kiện nhỏ dễ tạo niềm vui.' },
  { key: 'children', name: 'Ngày Quốc tế Thiếu nhi 1/6', month: 6, day: 1, productIds: ['p6', 'p13', 'p16'], intro: 'Từ 29/5 đến 1/6 nên ưu tiên quà vui tươi cho trẻ em.', reason: 'Thẻ bài, quần áo trẻ em và album giúp tạo niềm vui rõ ràng.' },
  { key: 'fathers-day', name: 'Ngày của Cha', dynamic: 'third-sunday-june', productIds: ['p3', 'p7', 'p10'], intro: 'Ngày của Cha phù hợp với quà thiết thực, lịch sự và dễ sử dụng hằng ngày.', reason: 'Ưu tiên đồ dùng, phụ kiện và outfit nam có tính ứng dụng cao.' },
  { key: 'national', name: 'Quốc khánh 2/9', month: 9, day: 2, productIds: ['p3', 'p9', 'p16'], intro: 'Kỳ nghỉ Quốc khánh phù hợp outfit linh hoạt và phụ kiện đi chơi.', reason: 'Gợi ý tập trung vào tính tiện dụng trong chuyến đi ngắn ngày.' },
  { key: 'women-vn', name: 'Ngày Phụ nữ Việt Nam 20/10', month: 10, day: 20, productIds: ['p2', 'p4', 'p8'], intro: '20/10 là dịp tốt để chọn quà tinh tế cho mẹ, chị em và người thương.', reason: 'Các món có tính ứng dụng, dịu mắt và dễ tặng.' },
  { key: 'teacher', name: 'Ngày Nhà giáo Việt Nam 20/11', month: 11, day: 20, productIds: ['p8', 'p7', 'p11'], intro: '20/11 phù hợp quà tri ân lịch sự, có tính sử dụng cao.', reason: 'Sổ, trà và dụng cụ thủ công tạo cảm giác chân thành, không phô trương.' },
  { key: 'christmas', name: 'Giáng sinh', month: 12, day: 25, productIds: ['p1', 'p5', 'p13'], intro: 'Giáng sinh hợp với quà cuối năm và outfit nổi bật.', reason: 'Chọn item có điểm nhấn, hợp chụp ảnh và tặng bạn bè.' }
];

const tetDates: Record<number, string> = { 2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26', 2029: '2029-02-13', 2030: '2030-02-03' };
const easterDates: Record<number, string> = { 2026: '2026-04-05', 2027: '2027-03-28', 2028: '2028-04-16', 2029: '2029-04-01', 2030: '2030-04-21' };

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diffDays = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
const toLabel = (d: Date) => d.toLocaleDateString('vi-VN');

function thirdSundayOfJune(year: number) {
  const d = new Date(year, 5, 1);
  const firstSunday = 1 + ((7 - d.getDay()) % 7);
  return new Date(year, 5, firstSunday + 14);
}

function normalizeAnnualDate(dateText?: string, year = new Date().getFullYear()) {
  if (!dateText) return null;
  const parts = dateText.split(/[/-]/).map(Number);
  if (parts.length >= 3) return new Date(year, parts[1] - 1, parts[2]);
  if (parts.length === 2) return new Date(year, parts[1] - 1, parts[0]);
  return null;
}

function addIfActive(candidates: OccasionRecommendation[], item: any, date: Date, now: Date, window = 3) {
  let target = date;
  if (diffDays(target, now) < 0) target = new Date(now.getFullYear() + 1, date.getMonth(), date.getDate());
  const daysUntil = diffDays(target, now);
  if (daysUntil >= 0 && daysUntil <= window) {
    candidates.push({
      key: item.key,
      name: item.name,
      dateLabel: toLabel(target),
      daysUntil,
      intro: item.intro,
      reason: item.reason,
      productIds: item.productIds,
    });
  }
}

export function getSpecialRecommendation(now = new Date(), user?: UserOccasionInput | null): OccasionRecommendation | null {
  const year = now.getFullYear();
  const candidates: OccasionRecommendation[] = [];

  for (const item of fixed) {
    const date = item.dynamic === 'third-sunday-june' ? thirdSundayOfJune(year) : new Date(year, item.month - 1, item.day);
    addIfActive(candidates, item, date, now);
  }

  const tetIso = tetDates[year];
  if (tetIso) {
    const tet = new Date(`${tetIso}T00:00:00`);
    const jan1 = new Date(year, 0, 1);
    if (startOfDay(now) >= jan1 && startOfDay(now) <= tet) {
      candidates.unshift({
        key: 'tet', name: 'Tết Nguyên Đán', dateLabel: toLabel(tet), daysUntil: diffDays(tet, now),
        intro: 'Sau Tết Tây là thời điểm chuẩn bị Tết ta, nên JAPANO ưu tiên quà biếu, outfit lịch sự và phụ kiện may mắn.',
        reason: 'Các sản phẩm được chọn vì hợp không khí Tết, dễ làm quà và có màu sắc trang trọng.',
        productIds: ['p1', 'p4', 'p7', 'p8']
      });
    }
  }

  const easterIso = easterDates[year];
  if (easterIso) {
    addIfActive(candidates, {
      key: 'easter', name: 'Lễ Phục sinh', productIds: ['p4', 'p8', 'p13'],
      intro: 'Phục sinh phù hợp với quà nhẹ nhàng, thanh lịch và các món nhỏ xinh.',
      reason: 'Các item dễ tặng, màu dịu và hợp đi chơi cuối tuần.'
    }, new Date(`${easterIso}T00:00:00`), now);
  }

  if (user?.birthday) {
    const birthday = normalizeAnnualDate(user.birthday, year);
    if (birthday) addIfActive(candidates, {
      key: 'birthday', name: 'Sinh nhật của bạn', productIds: ['p1', 'p2', 'p13'],
      intro: 'Sinh nhật là dịp phù hợp để JAPANO gợi ý outfit mới và món quà tự thưởng.',
      reason: 'Ưu tiên sản phẩm nổi bật, dễ lên hình và có thể phối phụ kiện cá nhân.'
    }, birthday, now, 7);
  }

  user?.specialDates?.forEach((item, index) => {
    const date = normalizeAnnualDate(item.date, year);
    if (date) addIfActive(candidates, {
      key: `custom-${index}`, name: item.name || 'Ngày đặc biệt của bạn', productIds: item.productIds || ['p1', 'p4', 'p8'],
      intro: 'Bạn đã lưu ngày đặc biệt này, JAPANO sẽ ưu tiên gợi ý sản phẩm phù hợp.',
      reason: 'Gợi ý dựa trên ngày bạn tự thiết lập và lịch sử mua sắm trong app/web.'
    }, date, now, 7);
  });

  return candidates[0] || null;
}

export function getOccasionProducts(rec: OccasionRecommendation | null) {
  if (!rec) return products.slice(0, 4);
  return rec.productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as typeof products;
}
