import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useApp } from '../context/AppContext';
import { getAnimationPackById, resolveOccasionAnimation } from '../data/animations';

type FlutterProps = { index: number; glyph: string; startX: number; duration: number; delay: number; size: number };

function Flutter({ index, glyph, startX, duration, delay, size }: FlutterProps) {
  const { height } = useWindowDimensions();
  const { theme } = useApp();
  const progress = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const flight = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(progress, { toValue: 0, duration: 1, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    const wave = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 1700 + index * 150, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(sway, { toValue: 0, duration: 1700 + index * 150, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    flight.start();
    wave.start();
    return () => { flight.stop(); wave.stop(); };
  }, [delay, duration, index, progress, sway]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height + 90, -90] });
  const translateX = sway.interpolate({ inputRange: [0, 1], outputRange: [-24, 24] });
  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '16deg'] });
  const opacity = progress.interpolate({ inputRange: [0, 0.08, 0.9, 1], outputRange: [0, 0.82, 0.72, 0] });

  return (
    <Animated.View style={[styles.flutter, { left: startX, opacity, transform: [{ translateY }, { translateX }, { rotate }], pointerEvents: 'none' }]}> 
      <Text style={[styles.glyph, { color: theme.accent, fontSize: size }]}>{glyph}</Text>
    </Animated.View>
  );
}

export function FloatingButterflies() {
  const { width } = useWindowDimensions();
  const { theme, user } = useApp();
  const packId = theme.animationPack === 'auto' ? resolveOccasionAnimation(user || undefined) : theme.animationPack;
  const pack = getAnimationPackById(packId);
  const durationBase = pack.speed === 'fast' ? 9000 : pack.speed === 'slow' ? 16500 : 12800;
  const items = useMemo(() => Array.from({ length: pack.density }).map((_, index) => ({
    glyph: pack.glyphs[index % pack.glyphs.length],
    startX: width * ((0.12 + ((index * 0.21) % 0.82)) % 0.96),
    duration: durationBase + index * 850,
    delay: 450 + index * 1100,
    size: 18 + (index % 3) * 3,
  })), [width, pack.id, durationBase]);

  if (theme.style === 'minimal' && theme.animationPack !== 'minimal-spark') return null;
  return <>{items.map((item, index) => <Flutter key={`${pack.id}-${item.glyph}-${index}`} index={index} {...item} />)}</>;
}

const styles = StyleSheet.create({
  flutter: { position: 'absolute', zIndex: 20 },
  glyph: { opacity: 0.78, ...(Platform.OS === 'web' ? ({ textShadow: '0 0 5px #00000022' } as any) : { textShadowColor: '#00000022', textShadowRadius: 5 }) },
});
