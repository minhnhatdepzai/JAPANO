import React, { useEffect } from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { useApp } from '../context/AppContext';
import { JapanoTheme, defaultTheme } from '../data/themes';
import { fontFamilyForText, getTextScaleForSize, textColorForText } from '../lib/styles';

let activeTheme: JapanoTheme = defaultTheme;
let installed = false;
let originalRender: any = null;

function flatten(style: any): TextStyle {
  return (StyleSheet.flatten(style) || {}) as TextStyle;
}

function isLockedContrastColor(color: any, theme: JapanoTheme) {
  const c = typeof color === 'string' ? color.trim().toLowerCase() : '';
  if (!c) return false;
  const locked = new Set([
    '#fff',
    '#ffffff',
    'white',
    '#000',
    '#000000',
    'black',
    String(theme.background || '').toLowerCase(),
    String(theme.card || '').toLowerCase(),
  ]);
  return locked.has(c);
}

function shouldApplyTextColor(style: any, theme: JapanoTheme) {
  const flat = flatten(style);
  const currentColor = typeof flat.color === 'string' ? flat.color : '';
  if (!currentColor) return true;
  if (isLockedContrastColor(currentColor, theme)) return false;
  return true;
}

function scaleTextStyle(style: any, theme: JapanoTheme): any {
  if (!style) return style;

  if (Array.isArray(style)) {
    return style.map((item) => scaleTextStyle(item, theme));
  }

  if (typeof style !== 'object') return style;

  const fontSize = (style as TextStyle).fontSize;
  const lineHeight = (style as TextStyle).lineHeight;
  const baseFontSize = typeof fontSize === 'number' ? fontSize : 15;
  const scale = getTextScaleForSize(theme, baseFontSize);
  const next: TextStyle = { ...(style as TextStyle) };

  if (typeof fontSize === 'number') {
    next.fontSize = Math.round(fontSize * scale);
  }

  if (typeof lineHeight === 'number') {
    next.lineHeight = Math.round(lineHeight * scale);
  }

  if (shouldApplyTextColor(style, theme)) {
    next.color = textColorForText(theme, baseFontSize, typeof next.color === 'string' ? next.color : undefined);
  }

  next.fontFamily = fontFamilyForText(theme, baseFontSize);

  return next;
}

function installTextPatch() {
  if (installed) return;
  installed = true;

  originalRender = (Text as any).render;
  if (typeof originalRender !== 'function') return;

  (Text as any).render = function patchedTextRender(...args: any[]) {
    const origin = originalRender.apply(this, args);
    const props = origin?.props || {};
    const scaledStyle = scaleTextStyle(props.style, activeTheme);
    const flat = flatten(scaledStyle);
    const baseFontSize = typeof flat.fontSize === 'number' ? flat.fontSize : 15;
    const family = fontFamilyForText(activeTheme, baseFontSize);
    const fallbackColor = flat.color ? null : { color: textColorForText(activeTheme, baseFontSize, activeTheme.text) };

    return React.cloneElement(origin, {
      ...props,
      style: [
        scaledStyle,
        fallbackColor,
        family ? { fontFamily: family } : null,
      ],
    });
  };
}

export function TextThemeRuntime() {
  const { theme } = useApp();

  useEffect(() => {
    activeTheme = theme;
    installTextPatch();
  }, [theme]);

  return null;
}
