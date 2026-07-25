import { getSpecialRecommendation, UserOccasionInput } from './occasions';

export type AnimationPack = {
  id: string;
  name: string;
  description: string;
  glyphs: string[];
  density: number;
  speed: 'slow' | 'normal' | 'fast';
};

export const animationPacks: AnimationPack[] = [
  { id: 'auto', name: 'Tự động theo dịp lễ', description: 'App tự đổi hiệu ứng theo ngày đặc biệt và campaign đang chạy.', glyphs: ['🦋', '❀', '✦'], density: 4, speed: 'normal' },
  { id: 'butterfly-sakura', name: 'Bướm & Sakura', description: 'Bướm và cánh hoa bay nhẹ cho giao diện Nhật cổ.', glyphs: ['🦋', '🌸', '❀', '✦'], density: 6, speed: 'normal' },
  { id: 'national-flags', name: 'Cờ bay Quốc gia', description: 'Cờ và sao bay cho 30/4, 2/9, Giỗ Tổ.', glyphs: ['🇻🇳', '⭐', '🎗️', '🇻🇳'], density: 7, speed: 'normal' },
  { id: 'tet-lixi', name: 'Lì xì Tết', description: 'Bao lì xì, hoa đào, pháo hoa nhỏ từ tháng 1-2.', glyphs: ['🧧', '🌸', '🏮', '✨'], density: 8, speed: 'normal' },
  { id: 'christmas-snow', name: 'Noel tuyết rơi', description: 'Tuyết, chuông và ánh sao cho Giáng sinh.', glyphs: ['❄️', '🔔', '⭐', '🎄'], density: 7, speed: 'slow' },
  { id: 'children-bubbles', name: 'Bong bóng thiếu nhi', description: 'Bong bóng, diều và sao vui tươi cho 1/6.', glyphs: ['🪁', '⭐', '🫧', '🎈'], density: 7, speed: 'normal' },
  { id: 'women-petals', name: 'Cánh hoa dịu dàng', description: 'Hoa và trái tim cho 8/3, 20/10.', glyphs: ['🌹', '🌷', '💗', '❀'], density: 6, speed: 'slow' },
  { id: 'teacher-paper', name: 'Tri ân thầy cô', description: 'Sổ, bút và sao nhẹ cho 20/11.', glyphs: ['📘', '✏️', '⭐', '🍂'], density: 5, speed: 'slow' },
  { id: 'father-ribbon', name: 'Ngày của Cha', description: 'Ruy băng, đồng hồ và sao trang trọng.', glyphs: ['🎗️', '⌚', '⭐', '👜'], density: 5, speed: 'slow' },
  { id: 'easter-soft', name: 'Phục sinh pastel', description: 'Trứng, thỏ và hoa pastel.', glyphs: ['🥚', '🐰', '🌼', '✨'], density: 6, speed: 'normal' },
  { id: 'night-lantern', name: 'Đèn lồng đêm Nhật', description: 'Đèn lồng và ánh sáng phố đêm.', glyphs: ['🏮', '✨', '🌙', '❖'], density: 6, speed: 'slow' },
  { id: 'card-spark', name: 'Thẻ bài lấp lánh', description: 'Hiệu ứng dành cho trading card và game.', glyphs: ['🃏', '✨', '⭐', '💠'], density: 7, speed: 'fast' },
  { id: 'minimal-spark', name: 'Tối giản lấp lánh', description: 'Chỉ có vài hạt sáng nhỏ để giao diện nhẹ hơn.', glyphs: ['✦', '•', '⋆'], density: 4, speed: 'slow' },
  { id: 'fireworks-night', name: 'Pháo hoa đêm lễ', description: 'Pháo hoa mini cho đêm giao thừa, Quốc khánh và ngày chiến thắng.', glyphs: ['🎆', '✨', '⭐', '🎇'], density: 6, speed: 'normal' },
  { id: 'gold-coins', name: 'Xu thưởng bay', description: 'Xu, ánh vàng và quà cho gamification, voucher, nhận thưởng.', glyphs: ['🪙', '✨', '🎁', '⭐'], density: 7, speed: 'fast' },
  { id: 'paper-fans', name: 'Quạt giấy Nhật cổ', description: 'Quạt, sóng và hoa văn cổ cho bộ sưu tập truyền thống.', glyphs: ['扇', '🌊', '❀', '✨'], density: 5, speed: 'slow' },
  { id: 'love-letters', name: 'Thư tay yêu thương', description: 'Phong thư, hoa và tim cho ngày tặng quà cá nhân.', glyphs: ['💌', '🌷', '💗', '✨'], density: 6, speed: 'slow' },
  { id: 'rainy-cozy', name: 'Mưa nhẹ cozy', description: 'Giọt mưa và ánh đèn cho outfit mùa mưa, áo khoác, cardigan.', glyphs: ['☔', '💧', '✨', '🧥'], density: 6, speed: 'slow' },
  { id: 'starry-game', name: 'Game night pixel', description: 'Sao pixel và thẻ bài cho khu game, trading card và phụ kiện gaming.', glyphs: ['✦', '🎮', '🃏', '💠'], density: 8, speed: 'fast' },
];

export function getAnimationPackById(id?: string) {
  return animationPacks.find((pack) => pack.id === id) || animationPacks[0];
}

export function resolveOccasionAnimation(user?: UserOccasionInput | null, now = new Date()) {
  const occasion = getSpecialRecommendation(now, user || undefined);
  const key = occasion?.key || '';
  const month = now.getMonth() + 1;

  if (key === 'tet' || month === 1 || month === 2) return 'tet-lixi';
  if (['national', '30-4', '1-5', 'hung-kings'].includes(key)) return 'national-flags';
  if (key === 'christmas') return 'christmas-snow';
  if (key === 'children' || key === 'children-pre') return 'children-bubbles';
  if (key === 'womens-day' || key === 'women-vn') return 'women-petals';
  if (key === 'teacher') return 'teacher-paper';
  if (key === 'fathers-day') return 'father-ribbon';
  if (key === 'easter') return 'easter-soft';
  if (key === 'birthday' || key.startsWith('custom-')) return 'love-letters';
  return 'butterfly-sakura';
}
