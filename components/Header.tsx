import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { fontFamily, radius, scaleFont, shadow } from '../lib/styles';
import { goBackOrReplace } from '../lib/navigation';

export function Header({
  title,
  subtitle,
  right,
  showBack = true,
  backFallback = '/(tabs)',
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showBack?: boolean;
  backFallback?: string;
}) {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12, borderBottomColor: theme.border, backgroundColor: theme.background }]}> 
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            onPress={() => goBackOrReplace(backFallback)}
            accessibilityLabel="Quay lại"
            style={[styles.backButton, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: Math.min(scaleFont(theme, 25), 29), lineHeight: Math.min(scaleFont(theme, 30), 34) }]}>{title}</Text>
          {subtitle ? <Text numberOfLines={2} style={[styles.subtitle, { color: theme.muted, fontSize: Math.min(scaleFont(theme, 12), 14) }]}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '900' },
  subtitle: { marginTop: 4, lineHeight: 18 },
  right: { alignSelf: 'center' },
});
