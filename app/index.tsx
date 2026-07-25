import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { fontFamily, scaleFont } from '../lib/styles';
import { LAST_ROUTE_KEY } from '../components/RoutePersistence';
import { SafeImage } from '../components/SafeImage';
import { products } from '../data/catalog';

function getSafeStartRoute(saved?: string | null) {
  if (!saved) return '/(tabs)';

  const blocked =
    saved === '/' ||
    saved.includes('login') ||
    saved.includes('register') ||
    saved.includes('forgot-password') ||
    saved.includes('try-on') ||
    saved.includes('checkout') ||
    saved.includes('cart') ||
    saved.includes('wishlist') ||
    saved.includes('notifications') ||
    saved.includes('stylist-quiz');

  if (blocked) return '/(tabs)';

  return saved;
}


function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getDailyStylistRoute(userId?: string) {
  const key = `japano.stylistQuizDone.${userId || 'guest'}.${todayKey()}`;
  const done = await AsyncStorage.getItem(key).catch(() => null);
  return done ? null : '/stylist-quiz';
}

export default function SplashIntro() {
  const { theme, ready, user } = useApp();
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(rise, { toValue: 0, duration: 520, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1300, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(shimmer, { toValue: 0, duration: 1300, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    ).start();
  }, [fade, rise, shimmer]);

  useEffect(() => {
    if (!ready) return;

    const timer = setTimeout(async () => {
      const quizRoute = await getDailyStylistRoute(user?.id);
      if (quizRoute) {
        router.replace(quizRoute as any);
        return;
      }

      const saved = await AsyncStorage.getItem(LAST_ROUTE_KEY).catch(() => null);
      const target = getSafeStartRoute(saved);

      if (target === '/(tabs)') {
        await AsyncStorage.removeItem(LAST_ROUTE_KEY).catch(() => null);
      }

      router.replace(target as any);
    }, 1250);

    return () => clearTimeout(timer);
  }, [ready, user?.id]);

  const sparkleOpacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });

  return (
    <View
      style={[
        styles.page,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + 28,
          paddingBottom: insets.bottom + 28,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.heroBlob,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            opacity: fade,
            transform: [{ translateY: rise }],
          },
        ]}
      >
        <Animated.Text style={[styles.sparkle, { color: theme.accent, opacity: sparkleOpacity }]}>
          ✦
        </Animated.Text>

        <Text style={[styles.kicker, { color: theme.primary }]}>JAPANO FASHION AI</Text>

        <Text
          style={[
            styles.title,
            {
              color: theme.heading,
              fontFamily: fontFamily(theme),
              fontSize: scaleFont(theme, 48),
            },
          ]}
        >
          Shop thời trang{`\n`}và quà tặng
        </Text>

        <Text style={[styles.desc, { color: theme.muted, fontSize: scaleFont(theme, 15) }]}>
          Mua sắm, thử đồ AI, thẻ bài, phụ kiện và gợi ý theo dịp đặc biệt. Dữ liệu web và app
          đồng bộ qua MongoDB.
        </Text>

        <SafeImage source={{ uri: products[0].image }} style={styles.image} resizeMode="contain" />

        <Pressable
          onPress={async () => {
            const quizRoute = await getDailyStylistRoute(user?.id);
            if (quizRoute) {
              router.replace(quizRoute as any);
              return;
            }

            const saved = await AsyncStorage.getItem(LAST_ROUTE_KEY).catch(() => null);
            const target = getSafeStartRoute(saved);

            if (target === '/(tabs)') {
              await AsyncStorage.removeItem(LAST_ROUTE_KEY).catch(() => null);
            }

            router.replace(target as any);
          }}
          style={[styles.btn, { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.btnText, { color: theme.background }]}>Vào cửa hàng</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  heroBlob: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 24,
    overflow: 'hidden',
  },
  sparkle: {
    position: 'absolute',
    top: 18,
    right: 24,
    fontSize: 28,
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '900',
    marginBottom: 18,
  },
  title: {
    fontWeight: '900',
    lineHeight: 56,
  },
  desc: {
    marginTop: 18,
    lineHeight: 24,
  },
  image: {
    width: '100%',
    height: 170,
    marginTop: 18,
    borderRadius: 0,
  },
  btn: {
    marginTop: 22,
    alignSelf: 'flex-start',
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 0,
  },
  btnText: {
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});