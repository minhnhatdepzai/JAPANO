import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, TextInput, TextInputProps, TextStyle } from 'react-native';
import { useApp } from '../context/AppContext';
import { clampFontScale, fontFamily } from '../lib/styles';

export type StableTextInputProps = TextInputProps & {
  keepKeyboardOnAndroid?: boolean;
};

function scaleInputStyle(style: any, scale: number): any {
  if (!style) return style;
  if (Array.isArray(style)) return style.map((item) => scaleInputStyle(item, scale));
  if (typeof style !== 'object') return style;

  const next: TextStyle = { ...(style as TextStyle) };
  if (typeof next.fontSize === 'number') next.fontSize = Math.round(next.fontSize * scale);
  if (typeof next.lineHeight === 'number') next.lineHeight = Math.round(next.lineHeight * scale);
  return next;
}

/**
 * TextInput ổn định cho Android / Expo Go.
 * Không tự focus lại sau mỗi ký tự, tránh lỗi bàn phím nhập 1 chữ rồi tự tắt.
 * Đồng thời nhận theme font/màu/cỡ chữ giống toàn app.
 */
export const StableTextInput = forwardRef<TextInput, StableTextInputProps>(
  ({ blurOnSubmit, autoCorrect, keepKeyboardOnAndroid: _ignored, style, placeholderTextColor, ...props }, ref) => {
    const { theme } = useApp();
    const themedStyle = useMemo(() => {
      const flat = StyleSheet.flatten(style) || {};
      const hasColor = typeof flat.color === 'string' && flat.color.length > 0;
      const scale = clampFontScale(theme.fontScale);

      return [
        scaleInputStyle(style, scale),
        {
          color: hasColor ? flat.color : theme.text,
          fontFamily: fontFamily(theme),
        },
      ];
    }, [style, theme]);

    return (
      <TextInput
        ref={ref}
        blurOnSubmit={blurOnSubmit ?? false}
        autoCorrect={autoCorrect ?? false}
        disableFullscreenUI
        placeholderTextColor={placeholderTextColor || theme.muted}
        style={themedStyle}
        {...props}
      />
    );
  },
);

StableTextInput.displayName = 'StableTextInput';
