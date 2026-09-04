/**
 * JAPANO — Hệ token thiết kế.
 *
 * NGUYÊN TẮC
 * Tối giản kiểu Nhật đương đại: nền trung tính, viền mảnh, chữ rõ thứ bậc, và
 * để hình sản phẩm làm nhân vật chính. Trang trí càng ít càng tốt.
 *
 * Bảng màu nền tảng là đen – trắng – xám trung tính. Chỉ có MỘT màu nhấn duy
 * nhất là đỏ chu sa Nhật Bản (vermilion), dùng rất tiết chế cho: trạng thái đang
 * chọn, chấm thông báo, giá khuyến mãi và một vài chi tiết thương hiệu.
 * Nút hành động chính dùng ĐEN, không dùng đỏ — đỏ mà tràn lan thì mất tác dụng nhấn.
 *
 * CÁCH DÙNG
 * Luôn ưu tiên token ngữ nghĩa (`color.textPrimary`) thay vì token thô. Không
 * viết mã màu trực tiếp trong màn hình; nếu thiếu token thì bổ sung vào đây.
 */

// ─────────────────────────── Màu ───────────────────────────

/** Bảng màu thô. Màn hình KHÔNG dùng trực tiếp nhóm này. */
const palette = {
  black: '#111111',
  ink900: '#141414',
  ink700: '#3D3D3D',
  ink500: '#686868',
  ink400: '#929292',
  ink300: '#B4B4B0',

  neutral0: '#FFFFFF',
  neutral50: '#FAFAF8',
  neutral100: '#F7F7F5',
  neutral150: '#F1F1EE',
  neutral200: '#E5E5E0',
  neutral300: '#CFCFC9',

  /** Đỏ chu sa — màu nhấn DUY NHẤT của thương hiệu. */
  vermilion: '#C43A30',
  vermilionDeep: '#9E2B23',
  vermilionSoft: '#FBEEEC',

  success: '#2E7D4F',
  successSoft: '#EDF6F0',
  warning: '#9A6B1F',
  warningSoft: '#FBF3E6',
  error: '#B3261E',
  errorSoft: '#FCEEED',
  info: '#2C5C8A',
  infoSoft: '#EEF3F8',
} as const;

// Android phân giải lại các resource này theo values/values-night mỗi khi cây
// view được remount. Cast về string chỉ để giữ tương thích kiểu với các thư
// viện icon/SVG cũ; giá trị runtime vẫn là OpaqueColorValue của React Native.
/** Token ngữ nghĩa — đây là thứ màn hình nên dùng. */
export const color = {
  background: palette.neutral100,
  backgroundAlt: palette.neutral50,
  surface: palette.neutral0,
  surfaceMuted: palette.neutral150,

  textPrimary: palette.ink900,
  textSecondary: palette.ink500,
  textMuted: palette.ink400,
  textOnDark: palette.neutral0,
  textDisabled: palette.ink300,

  border: palette.neutral200,
  borderStrong: palette.neutral300,
  borderFocus: palette.black,

  /** Nút hành động chính, trạng thái đã chọn. */
  brand: palette.black,
  brandHover: '#000000',
  brandDisabled: palette.neutral300,
  onBrand: palette.neutral0,

  /** Màu nhấn — dùng tiết chế. */
  accent: palette.vermilion,
  accentDeep: palette.vermilionDeep,
  accentSoft: palette.vermilionSoft,

  success: palette.success,
  successSoft: palette.successSoft,
  warning: palette.warning,
  warningSoft: palette.warningSoft,
  error: palette.error,
  errorSoft: palette.errorSoft,
  info: palette.info,
  infoSoft: palette.infoSoft,

  /** Nền chờ khi ảnh sản phẩm đang tải. */
  imagePlaceholder: palette.neutral150,
  skeleton: palette.neutral150,
  skeletonHighlight: palette.neutral200,
  overlay: 'rgba(17,17,17,0.42)',
} as const;

// ───────────────────────── Khoảng cách ─────────────────────────

/** Thang khoảng cách 4pt. Không dùng số lẻ ngoài thang này. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

// ────────────────────────── Bo góc ──────────────────────────

/** Bo góc tiết chế — giao diện thời trang cần cảm giác sắc nét, không tròn trịa. */
export const radius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  /** Chỉ dùng khi hình dạng viên thuốc thực sự có nghĩa (chip lọc, huy hiệu đếm). */
  pill: 999,
} as const;

// ─────────────────────────── Viền ───────────────────────────

export const border = {
  hairline: 1,
  thick: 1.5,
} as const;

// ────────────────────────── Đổ bóng ──────────────────────────

/**
 * Chỉ dùng đổ bóng khi độ cao thực sự có nghĩa: hộp thoại, bảng trượt từ dưới,
 * nút nổi, danh sách xổ xuống. Thẻ sản phẩm KHÔNG cần bóng — viền và khoảng
 * trắng là đủ.
 */
export const shadow = {
  none: {},
  sheet: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  modal: {
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
} as const;

// ───────────────────────── Chuyển động ─────────────────────────

export const motion = {
  fast: 140,
  base: 200,
  slow: 320,
} as const;

// ───────────────────────── Chữ ─────────────────────────

/**
 * Họ phông. Arimo là bản thay thế tương thích Arial theo giấy phép Apache 2.0,
 * phủ đủ tiếng Việt và tiếng Anh. Ký tự tiếng Nhật rơi về phông hệ thống, vốn
 * luôn có sẵn trên cả iOS lẫn Android.
 */
export const F = {
  display: 'Arimo_700Bold',
  displaySb: 'Arimo_600SemiBold',
  displayX: 'Arimo_700Bold',
  body: 'Arimo_400Regular',
  bodyM: 'Arimo_600SemiBold',
  bodyB: 'Arimo_700Bold',
  bodyX: 'Arimo_700Bold',
} as const;

/** Thang chữ — mỗi bậc có đúng một mục đích. */
export const type = {
  display: { fontFamily: F.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.4 },
  h1: { fontFamily: F.display, fontSize: 23, lineHeight: 29, letterSpacing: -0.3 },
  h2: { fontFamily: F.displaySb, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  h3: { fontFamily: F.bodyM, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: F.body, fontSize: 14, lineHeight: 21 },
  bodySm: { fontFamily: F.body, fontSize: 12.5, lineHeight: 18 },
  caption: { fontFamily: F.body, fontSize: 11.5, lineHeight: 16 },
  /** Nhãn phần, chip, huy hiệu — viết hoa kèm giãn chữ. */
  label: { fontFamily: F.bodyM, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.8 },
  price: { fontFamily: F.bodyB, fontSize: 15, lineHeight: 20 },
  priceSm: { fontFamily: F.bodyB, fontSize: 13, lineHeight: 18 },
  meta: { fontFamily: F.body, fontSize: 11, lineHeight: 15 },
} as const;

// ─────────────── Tương thích ngược với mã cũ ───────────────

/**
 * Các màn hình hiện có đang dùng bộ token cũ (`C.washi`, `C.ink`, `C.shu`…).
 * Ánh xạ lại chúng sang bảng màu mới để toàn bộ ứng dụng đổi diện mạo ngay,
 * thay vì phải sửa 44 tệp cùng lúc rồi để lại một giai đoạn nửa vời.
 *
 * Mã mới nên dùng `color.*`. Nhóm alias này sẽ được gỡ dần khi từng màn hình
 * được chuyển sang token ngữ nghĩa.
 */
export const C = {
  // nền — trước đây là các sắc kem/washi ngả vàng
  washi: color.background,
  washi2: color.surfaceMuted,
  paper: color.backgroundAlt,
  card: color.surface,
  white: color.surface,

  // chữ — trước đây là đen ngả nâu
  sumi: color.textPrimary,
  ink: color.textPrimary,
  muted: color.textSecondary,

  // viền — trước đây ngả vàng
  line: color.border,
  hair: color.border,
  borderStrong: color.borderStrong,
  overlay: color.overlay,

  // màu nhấn
  shu: color.accent,
  shuDeep: color.accentDeep,
  shuSoft: color.accentSoft,

  // nút hành động chính
  primary: color.brand,
  onPrimary: color.onBrand,
  inverseSurface: palette.black,
  inverseText: palette.neutral0,

  // trạng thái
  ok: color.success,
  okSoft: color.successSoft,
  warning: color.warning,
  warningSoft: color.warningSoft,
  danger: color.error,
  dangerSoft: color.errorSoft,

  /**
   * `kin` từng là màu vàng kim của giao diện cũ. Không còn màu vàng trong hệ
   * thống nữa, nên nó trở thành chữ phụ để các màn hình chưa chuyển đổi vẫn
   * hiển thị trung tính thay vì ngả vàng.
   */
  kin: color.textMuted,
  ai: color.info,
  aiSoft: color.infoSoft,
  matcha: color.success,
  sakura: color.accent,
  blue: color.info,
} as const;

export const money = (n: number) => n.toLocaleString('vi-VN') + '₫';
