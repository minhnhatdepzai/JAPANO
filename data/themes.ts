export type ThemeStyle = 'classic' | 'editorial' | 'minimal' | 'glass';

export type FontFamilyChoice = 'system' | 'serif' | 'mono';

export type JapanoTheme = {
  id: string;
  name: string;
  background: string;
  card: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted: string;
  border: string;
  heading: string;
  fontScale: number;
  smallFontScale: number;
  largeFontScale: number;
  smallTextColor?: string;
  largeTextColor?: string;
  fontFamily: FontFamilyChoice;
  smallFontFamily?: FontFamilyChoice;
  largeFontFamily?: FontFamilyChoice;
  style: ThemeStyle;
  animationPack?: string;
};

/**
 * Default mới: sáng hơn, cổ điển Nhật Bản hơn.
 * Ý tưởng màu: giấy washi ngà, mực sumi, đỏ son torii, matcha nhạt, vàng lồng đèn.
 */
export const defaultTheme: JapanoTheme = {
  id: 'washi-edo-default',
  name: 'Washi Edo Sáng',
  background: '#F7EFE3',
  card: '#FFFDF7',
  primary: '#A33A2F',
  secondary: '#566D4F',
  accent: '#D8A85A',
  text: '#4A3A30',
  muted: '#847267',
  border: '#E7D6C4',
  heading: '#2B211B',
  fontScale: 1,
  smallFontScale: 1,
  largeFontScale: 1,
  smallTextColor: '#847267',
  largeTextColor: '#2B211B',
  fontFamily: 'serif',
  smallFontFamily: 'system',
  largeFontFamily: 'serif',
  style: 'classic',
  animationPack: 'auto',
};

export const builtInThemes: JapanoTheme[] = [
  defaultTheme,
  {
    id: 'sakura-washi-light',
    name: 'Sakura Washi',
    background: '#FFF1F4',
    card: '#FFFBF7',
    primary: '#B54862',
    secondary: '#7A6A92',
    accent: '#E7B7C5',
    text: '#49343B',
    muted: '#876D76',
    border: '#ECD4D8',
    heading: '#2F1C24',
    fontScale: 1,
    smallFontScale: 1,
    largeFontScale: 1,
    fontFamily: 'serif',
    style: 'classic',
    animationPack: 'butterfly-sakura',
  },
  {
    id: 'matcha-ceramic-light',
    name: 'Matcha Gốm Sáng',
    background: '#F2F4E8',
    card: '#FFFFF8',
    primary: '#526B43',
    secondary: '#9D7844',
    accent: '#D9C58B',
    text: '#34382C',
    muted: '#6F7468',
    border: '#DCE1D0',
    heading: '#20281B',
    fontScale: 1,
    smallFontScale: 1,
    largeFontScale: 1,
    fontFamily: 'system',
    style: 'minimal',
    animationPack: 'minimal-spark',
  },
  {
    id: 'indigo-kimono-light',
    name: 'Indigo Kimono',
    background: '#EFECE4',
    card: '#FFF9EF',
    primary: '#2F4A73',
    secondary: '#A33D4B',
    accent: '#D3A76E',
    text: '#35302A',
    muted: '#756B61',
    border: '#DDCFBD',
    heading: '#161B25',
    fontScale: 1.04,
    smallFontScale: 1,
    largeFontScale: 1,
    fontFamily: 'serif',
    style: 'editorial',
    animationPack: 'night-lantern',
  },
  {
    id: 'lantern-cream-glass',
    name: 'Lồng Đèn Kem',
    background: '#F8EEDC',
    card: '#FFF8EA',
    primary: '#B9542F',
    secondary: '#4E6F75',
    accent: '#E2B360',
    text: '#46372C',
    muted: '#7D6B60',
    border: '#EAD6BE',
    heading: '#291F18',
    fontScale: 1,
    smallFontScale: 1,
    largeFontScale: 1,
    fontFamily: 'serif',
    style: 'glass',
    animationPack: 'night-lantern',
  },
  {
    id: 'night-market',
    name: 'Night Market',
    background: '#15110F',
    card: '#241B18',
    primary: '#DFA96A',
    secondary: '#B53B55',
    accent: '#586D8C',
    text: '#F4E8DC',
    muted: '#BCAEA3',
    border: '#3B2F2A',
    heading: '#FFF5EA',
    fontScale: 1,
    smallFontScale: 1,
    largeFontScale: 1,
    fontFamily: 'serif',
    style: 'editorial',
    animationPack: 'night-lantern',
  },
];
