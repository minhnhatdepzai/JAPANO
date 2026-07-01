import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import {
  buttonOutline,
  buttonOutlineText,
  buttonPrimary,
  buttonPrimaryText,
  onPrimary,
} from '../lib/styles';

type Variant = 'primary' | 'outline';

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  full = true,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useApp();
  const isOutline = variant === 'outline';
  const base = isOutline ? buttonOutline(theme) : buttonPrimary(theme);
  const textStyle = isOutline ? buttonOutlineText(theme) : buttonPrimaryText(theme);
  const tint = isOutline ? theme.primary : onPrimary(theme);
  const blocked = disabled || loading;

  return (
    <Pressable
      onPress={blocked ? undefined : onPress}
      disabled={blocked}
      style={({ pressed }) => [
        base,
        full ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' },
        { opacity: blocked ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Feather name={icon} size={17} color={tint} /> : null}
          <Text style={textStyle}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default AppButton;
