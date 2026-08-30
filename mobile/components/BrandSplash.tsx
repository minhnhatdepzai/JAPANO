import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useReduceMotion } from './motion';

const BACKGROUND = require('../assets/brand/japano-splash-bg.png');
const MONOGRAM = require('../assets/brand/japano-monogram.png');
const LETTERS = 'JAPANO'.split('');

type Props = { onFinish: () => void };

function FallingPetal({ index, height, width }: { index: number; height: number; width: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const left = useMemo(() => ((index * 83 + 17) % 100) / 100 * width, [index, width]);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      delay: 120 + index * 82,
      duration: 1700 + (index % 3) * 180,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, progress]);

  return (
    <Animated.Text
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.petal,
        {
          left,
          opacity: progress.interpolate({ inputRange: [0, 0.08, 0.9, 1], outputRange: [0, 0.75, 0.65, 0] }),
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-50, height + 40] }) },
            { translateX: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, index % 2 ? 42 : -36, 8] }) },
            { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${220 + index * 34}deg`] }) },
            { scale: 0.72 + (index % 3) * 0.16 },
          ],
        },
      ]}
    >
      ✿
    </Animated.Text>
  );
}

export function BrandSplash({ onFinish }: Props) {
  const reducedMotion = useReduceMotion();
  const { height, width } = useWindowDimensions();
  const scene = useRef(new Animated.Value(0)).current;
  const monogram = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;
  const letterValues = useRef(LETTERS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (reducedMotion) {
      scene.setValue(1);
      monogram.setValue(1);
      tagline.setValue(1);
      letterValues.forEach((value) => value.setValue(1));
      const timer = setTimeout(onFinish, 520);
      return () => clearTimeout(timer);
    }

    const intro = Animated.parallel([
      Animated.timing(scene, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(monogram, { toValue: 1, delay: 260, duration: 520, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
      ...letterValues.map((value, index) => Animated.timing(value, {
        toValue: 1,
        delay: 690 + index * 72,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })),
      Animated.timing(tagline, { toValue: 1, delay: 1240, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    intro.start();

    const finishTimer = setTimeout(() => {
      Animated.timing(exit, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
        .start(({ finished }) => { if (finished) onFinish(); });
    }, 2050);
    const hardStop = setTimeout(onFinish, 2650);
    return () => {
      intro.stop();
      clearTimeout(finishTimer);
      clearTimeout(hardStop);
    };
  }, [exit, letterValues, monogram, onFinish, reducedMotion, scene, tagline]);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root, { opacity: exit }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: scene }]}>
        <ImageBackground source={BACKGROUND} resizeMode="cover" style={styles.background}>
          <View style={styles.wash} />
        </ImageBackground>
      </Animated.View>

      {!reducedMotion && Array.from({ length: 10 }, (_, index) => (
        <FallingPetal key={index} index={index} height={height} width={width} />
      ))}

      <View style={styles.brand}>
        <Animated.View
          style={{
            opacity: monogram,
            transform: [
              { translateY: monogram.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
              { scale: monogram.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
            ],
          }}
        >
          <Image source={MONOGRAM} resizeMode="contain" style={styles.monogram} />
        </Animated.View>

        <View accessibilityLabel="JAPANO" style={styles.wordmark}>
          {LETTERS.map((letter, index) => (
            <Animated.Text
              key={`${letter}-${index}`}
              style={[
                styles.letter,
                {
                  opacity: letterValues[index],
                  transform: [{ translateY: letterValues[index].interpolate({ inputRange: [0, 1], outputRange: [13, 0] }) }],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          ))}
        </View>

        <Animated.View
          style={[
            styles.taglineRow,
            {
              opacity: tagline,
              transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            },
          ]}
        >
          <View style={styles.rule} />
          <Text style={styles.tagline}>QUẦN ÁO NHẬT BẢN</Text>
          <View style={styles.rule} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 9999, elevation: 9999, backgroundColor: '#F6F0E5' },
  background: { flex: 1 },
  wash: { flex: 1, backgroundColor: 'rgba(255,250,241,0.10)' },
  brand: {
    position: 'absolute',
    left: 22,
    right: 22,
    top: '14%',
    alignItems: 'center',
  },
  monogram: { width: 116, height: 108 },
  wordmark: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  letter: {
    color: '#171411',
    fontFamily: 'serif',
    fontSize: 34,
    lineHeight: 43,
    letterSpacing: 7,
    textShadowColor: 'rgba(255,255,255,0.72)',
    textShadowRadius: 8,
  },
  taglineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  tagline: { color: '#8F211D', fontSize: 10, lineHeight: 14, letterSpacing: 2.2, fontWeight: '700' },
  rule: { width: 32, height: StyleSheet.hairlineWidth, backgroundColor: '#B52C26' },
  petal: { position: 'absolute', top: -30, color: '#D76870', fontSize: 16, textShadowColor: 'rgba(255,255,255,0.7)', textShadowRadius: 2 },
});
