// Cùng công thức chấm điểm với backend/lib/auth.js (passwordStrength) — giữ 2
// bản đồng bộ tay vì mobile/backend không share code chung. Dùng để hiện
// thanh đo mạnh/yếu khi gõ VÀ chặn đăng ký/đổi mật khẩu ngay trên app trước
// khi gọi API (backend vẫn là nguồn xác thực cuối cùng, chặn lại lần nữa).
const COMMON_WEAK_PASSWORDS = new Set(['12345678', 'password', '11111111', 'qwerty123', '123456789', 'password1', 'abc12345', 'iloveyou', '87654321', 'letmein11']);

export type PasswordStrength = 'empty' | 'weak' | 'medium' | 'strong';

export function passwordStrength(password: string): PasswordStrength {
  const pw = String(password || '');
  if (!pw) return 'empty';
  if (COMMON_WEAK_PASSWORDS.has(pw.toLowerCase())) return 'weak';
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw)) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}

export const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  empty: '', weak: 'Mật khẩu yếu', medium: 'Mật khẩu trung bình', strong: 'Mật khẩu mạnh',
};
export const STRENGTH_BARS: Record<PasswordStrength, number> = { empty: 0, weak: 1, medium: 2, strong: 4 };
