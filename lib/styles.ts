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
  const kind = getTextKind(size);
  if (kind === 'small') return fontFamilyFromChoice(theme.smallFontFamily || theme.fontFamily || 'system');
  if (kind === 'large') return fontFamilyFromChoice(theme.largeFontFamily || theme.fontFamily || 'system');
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
