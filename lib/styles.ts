import { Platform, TextStyle, ViewStyle } from 'react-native';
import { FontFamilyChoice, JapanoTheme } from '../data/themes';

export const radius = { sm: 0, md: 0, lg: 0, xl: 0, pill: 0 };

export function fontFamilyFromChoice(choice?: FontFamilyChoice): TextStyle['fontFamily'] {
  if (choice === 'mono') {
    return Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
  }

  if (choice === 'serif') {
    return Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
  }

  return Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' });
}

export function fontFamily(theme: Partial<JapanoTheme>): TextStyle['fontFamily'] {
  return fontFamilyFromChoice(theme.fontFamily || 'system');
}

export function getTextKind(size?: number): 'small' | 'normal' | 'large' {
  const fontSize = typeof size === 'number' ? size : 15;
  if (fontSize <= 13) return 'small';
  if (fontSize >= 20) return 'large';
  return 'normal';
}

export function fontFamilyForText(theme: Partial<JapanoTheme>, size?: number): TextStyle['fontFamily'] {
  // Đồng nhất phông chữ: mọi cỡ chữ, mọi trang (app + web admin) dùng CHUNG một font theo theme.
  return fontFamily(theme);
}

export function textColorForText(theme: Partial<JapanoTheme>, size?: number, fallback?: string): string {
  const kind = getTextKind(size);
  if (kind === 'small') return theme.smallTextColor || fallback || theme.muted || theme.text || '#4A3A30';
  if (kind === 'large') return theme.largeTextColor || fallback || theme.heading || theme.text || '#2B211B';
  return fallback || theme.text || '#4A3A30';
}

export function clampFontScale(scale?: number) {
  const value = Number(scale || 1);
  if (Number.isNaN(value)) return 1;
  return Math.min(1.8, Math.max(0.7, value));
}

export function getTextScaleForSize(theme: Partial<JapanoTheme>, size?: number) {
  const base = clampFontScale(theme.fontScale || 1);
  const small = clampFontScale(theme.smallFontScale || base);
  const large = clampFontScale(theme.largeFontScale || base);
  const fontSize = typeof size === 'number' ? size : 15;

  if (fontSize <= 13) return small;
  if (fontSize >= 20) return large;

  const middleWeight = (fontSize - 13) / 7;
  const target = small + (large - small) * middleWeight;
  return clampFontScale((base + target) / 2);
}

/**
 * Hàm này trả về size gốc. TextThemeRuntime sẽ scale toàn app theo slider:
 * - Chữ nhỏ dùng smallFontScale.
 * - Chữ lớn/tiêu đề dùng largeFontScale.
 * - Chữ trung bình nội suy để không bị vỡ layout.
 */
export function scaleFont(_theme: JapanoTheme, size: number) {
  return Math.round(size);
}

export function scaleNumber(theme: JapanoTheme, size: number) {
  return Math.round(size * getTextScaleForSize(theme, size));
}

export function lineHeight(theme: JapanoTheme, size: number, ratio = 1.38) {
  return Math.round(scaleNumber(theme, size) * ratio);
}

export function textBase(theme: JapanoTheme, size = 15): TextStyle {
  return {
    color: textColorForText(theme, size, theme.text),
    fontFamily: fontFamilyForText(theme, size),
    fontSize: scaleFont(theme, size),
  };
}

export function textMuted(theme: JapanoTheme, size = 13): TextStyle {
  return {
    color: textColorForText(theme, size, theme.muted),
    fontFamily: fontFamilyForText(theme, size),
    fontSize: scaleFont(theme, size),
  };
}

export function textHeading(theme: JapanoTheme, size = 28): TextStyle {
  return {
    color: textColorForText(theme, size, theme.heading),
    fontFamily: fontFamilyForText(theme, size),
    fontSize: scaleFont(theme, size),
    fontWeight: '900',
  };
}

export function shadow(theme: JapanoTheme): ViewStyle {
  if (theme.style === 'minimal') return Platform.OS === 'web' ? ({} as ViewStyle) : { elevation: 0 };

  if (Platform.OS === 'web') {
    const opacity = theme.style === 'glass' ? 0.18 : 0.12;
    return { boxShadow: `0 8px 24px ${theme.primary}${Math.round(opacity * 255).toString(16).padStart(2, '0')}` } as ViewStyle;
  }

  return {
    shadowColor: theme.primary,
    shadowOpacity: theme.style === 'glass' ? 0.18 : 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 4,
  };
}

export function cardStyle(theme: JapanoTheme): ViewStyle {
  return {
    backgroundColor: theme.style === 'glass' ? `${theme.card}E8` : theme.card,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 0,
    ...shadow(theme),
  };
}

export function createThemedStyles(theme: JapanoTheme) {
  return {
    page: { flex: 1, backgroundColor: theme.background } as ViewStyle,
    card: cardStyle(theme),
    heading: textHeading(theme, 28),
    text: textBase(theme, 15),
    muted: textMuted(theme, 13),
  };
}

/* =============================================================
 * JAPANO UNIFIED CONTROLS
 * Mọi nút (đăng nhập, thanh toán, mua, yêu thích, thử đồ...) phải:
 *  - cùng màu (theme.primary), chữ trên nền primary = theme.background
 *  - cùng kiểu chữ (fontFamily theo theme), cùng độ đậm (900)
 *  - KHÔNG bo góc (radius 0)
 * Dùng các helper này hoặc <AppButton> để giữ đồng bộ toàn app + admin.
 * ============================================================= */

export const control = { height: 50, smallHeight: 42, padH: 18, gap: 8 };

export function onPrimary(theme: Partial<JapanoTheme>): string {
  return theme.background || '#FFFFFF';
}

export function buttonPrimary(theme: JapanoTheme): ViewStyle {
  return {
    minHeight: control.height,
    backgroundColor: theme.primary,
    borderRadius: 0,
    borderWidth: 0,
    paddingHorizontal: control.padH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: control.gap,
  };
}

export function buttonPrimaryText(theme: JapanoTheme): TextStyle {
  return {
    color: onPrimary(theme),
    fontFamily: fontFamily(theme),
    fontWeight: '900',
    fontSize: scaleFont(theme, 15),
    letterSpacing: 0.3,
  };
}

export function buttonOutline(theme: JapanoTheme): ViewStyle {
  return {
    minHeight: control.height,
    backgroundColor: theme.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: theme.primary,
    paddingHorizontal: control.padH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: control.gap,
  };
}

export function buttonOutlineText(theme: JapanoTheme): TextStyle {
  return {
    color: theme.primary,
    fontFamily: fontFamily(theme),
    fontWeight: '900',
    fontSize: scaleFont(theme, 15),
    letterSpacing: 0.3,
  };
}

export function iconButton(theme: JapanoTheme): ViewStyle {
  return {
    width: 44,
    height: 44,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
  };
}

export function inputStyle(theme: JapanoTheme): ViewStyle & TextStyle {
  return {
    minHeight: control.height,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    paddingHorizontal: 14,
    color: theme.text,
    fontFamily: fontFamily(theme),
    fontSize: scaleFont(theme, 15),
  };
}

export function pill(theme: JapanoTheme, active = false): ViewStyle {
  return {
    minHeight: control.smallHeight,
    paddingHorizontal: 16,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: active ? theme.primary : theme.border,
    backgroundColor: active ? theme.primary : theme.card,
    alignItems: 'center',
    justifyContent: 'center',
  };
}

export function pillText(theme: JapanoTheme, active = false): TextStyle {
  return {
    color: active ? onPrimary(theme) : theme.text,
    fontFamily: fontFamily(theme),
    fontWeight: '900',
    fontSize: scaleFont(theme, 13),
  };
}
