import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useStripe } from '../lib/stripe';
import { JapanoTheme, builtInThemes, defaultTheme } from '../data/themes';
import { Product, products as localProducts } from '../data/catalog';
import { api } from '../lib/api';
import { toastCart, toastSuccess, toastWishlistOff, toastWishlistOn } from '../lib/toast';

export type GeneratedImage = { id: string; url: string; prompt: string; createdAt: number };
export type User = { id: string; name: string; email: string; phone?: string; address?: string; avatar?: string; coins?: number; birthday?: string; specialDates?: Array<{ name: string; date: string; productIds?: string[] }>; membership?: { tier?: string; price?: number; currency?: string; upgradedAt?: string; expiresAt?: string }; vip?: boolean; vipUntil?: string; tryOnUsed?: number; tryOnLimit?: number; tryOnRemaining?: number | null; role?: 'customer' | 'admin'; permissions?: string[]; status?: string; isAdmin?: boolean } | null;
export type Order = { id?: string; _id?: string; items: Product[]; total: number; status: string; paymentMethod?: string; shippingAddress?: string; stripePaymentIntentId?: string; createdAt?: string | number };

type AppState = {
  ready: boolean;
  user: User;
  isLoggedIn: boolean;
  theme: JapanoTheme;
  themes: JapanoTheme[];
  cart: Product[];
  wishlist: Product[];
  generatedImages: GeneratedImage[];
  orders: Order[];
  searchHistory: string[];
  recentlyViewed: string[];
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<NonNullable<User>>) => Promise<void>;
  upgradeToVip: () => Promise<boolean>;
  payStripeCheckout: (extra: { total: number; shippingAddress?: string; paymentMethod?: string; checkoutMeta?: any }) => Promise<{ paymentIntentId: string } | null>;
  setTheme: (theme: JapanoTheme) => void;
  updateTheme: (patch: Partial<JapanoTheme>) => void;
  importTheme: (theme: Partial<JapanoTheme>) => void;
  addToCart: (p: Product, qty?: number) => boolean;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  checkout: (paymentMethod: string, extra?: Partial<Order>) => Promise<void>;
  toggleWishlist: (p: Product) => void;
  removeFromWishlist: (p: Product) => void;
  addGeneratedImage: (image: GeneratedImage) => void;
  addSearchTerm: (term: string) => void;
  recordView: (productId: string) => void;
  requireLogin: (message?: string) => boolean;
  formatCurrency: (value: number) => string;
};

const AppContext = createContext<AppState | null>(null);
const KEYS = {
  user: 'japano.user', theme: 'japano.theme', themes: 'japano.themes', cart: 'japano.cart', wishlist: 'japano.wishlist', images: 'japano.generatedImages', orders: 'japano.orders', search: 'japano.searchHistory', recentViewed: 'japano.recentViewed'
};

function normalizeTheme(next: Partial<JapanoTheme> = {}): JapanoTheme {
  const merged = { ...defaultTheme, ...next };
  const fontFamily = merged.fontFamily || defaultTheme.fontFamily;
  return {
    ...merged,
    fontScale: Number(merged.fontScale || 1),
    smallFontScale: Number(merged.smallFontScale || merged.fontScale || 1),
    largeFontScale: Number(merged.largeFontScale || merged.fontScale || 1),
    smallTextColor: merged.smallTextColor || merged.muted || merged.text || defaultTheme.smallTextColor,
    largeTextColor: merged.largeTextColor || merged.heading || merged.text || defaultTheme.largeTextColor,
    smallFontFamily: merged.smallFontFamily || fontFamily,
    largeFontFamily: merged.largeFontFamily || fontFamily,
  };
}


export function AppProvider({ children }: { children: React.ReactNode }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User>(null);
  const [theme, setThemeState] = useState<JapanoTheme>(normalizeTheme(defaultTheme));
  const [themes, setThemes] = useState<JapanoTheme[]>(builtInThemes);
  const [cart, setCart] = useState<Product[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const sessionRef = useRef(0);

  useEffect(() => {
    (async () => {
      const values = await Promise.all(Object.values(KEYS).map((key) => AsyncStorage.getItem(key)));
      const [savedUser, savedTheme, savedThemes, savedCart, savedWishlist, savedImages, savedOrders, savedSearch, savedRecent] = values;
      if (savedUser) setUser(JSON.parse(savedUser));
      if (savedTheme) {
        const parsedTheme = JSON.parse(savedTheme);
        setThemeState(normalizeTheme(parsedTheme?.id === 'suoh-shop' ? defaultTheme : parsedTheme));
      }
      if (savedThemes) setThemes(JSON.parse(savedThemes).map((item: Partial<JapanoTheme>) => normalizeTheme(item)));
      if (savedCart) setCart(JSON.parse(savedCart));
      if (savedWishlist) setWishlist(JSON.parse(savedWishlist));
      if (savedImages) setGeneratedImages(JSON.parse(savedImages));
      if (savedOrders) setOrders(JSON.parse(savedOrders));
      if (savedSearch) setSearchHistory(JSON.parse(savedSearch));
      if (savedRecent) setRecentlyViewed(JSON.parse(savedRecent));
    })().finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) api.seedProducts(localProducts).catch(() => null);
  }, [ready]);

  useEffect(() => {
    if (ready && user?.id) {
      api.saveUserSettings(user.id, { theme }).catch(() => null);
    }
  }, [theme, ready, user?.id]);

  const persist = async (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));

  const productIdentity = (product: any) => String(product?.id || product?.slug || product?._id || product?.sku || product?.name || '').trim();
  const isCurrentSession = (sessionVersion: number) => sessionVersion === sessionRef.current;

  const hydrateRemote = async (nextUser: NonNullable<User>, sessionVersion = sessionRef.current) => {
    try {
      const [customer, remoteCart, remoteWishlist, remoteOrders, remoteSearch, remoteImages] = await Promise.all([
        api.getCustomer(nextUser.id).catch(() => null),
        api.getCart(nextUser.id).catch(() => null),
        api.getWishlist(nextUser.id).catch(() => null),
        api.getOrders(nextUser.id).catch(() => []),
        api.getSearch(nextUser.id).catch(() => []),
        api.getGeneratedImages(nextUser.id).catch(() => []),
      ]);
      if (!isCurrentSession(sessionVersion)) return;
      if (customer) {
        const merged = { ...nextUser, ...customer };
        setUser(merged);
        await persist(KEYS.user, merged);
      }
      if (!isCurrentSession(sessionVersion)) return;
      if (Array.isArray(remoteCart?.items)) { setCart(remoteCart.items); await persist(KEYS.cart, remoteCart.items); }
      if (!isCurrentSession(sessionVersion)) return;
      if (Array.isArray(remoteWishlist?.items)) { setWishlist(remoteWishlist.items); await persist(KEYS.wishlist, remoteWishlist.items); }
      if (!isCurrentSession(sessionVersion)) return;
      if (Array.isArray(remoteOrders)) { setOrders(remoteOrders); await persist(KEYS.orders, remoteOrders); }
      if (!isCurrentSession(sessionVersion)) return;
      if (Array.isArray(remoteSearch)) { const terms = remoteSearch.map((x: any) => x.term || x.query).filter(Boolean); setSearchHistory(terms); await persist(KEYS.search, terms); }
      if (!isCurrentSession(sessionVersion)) return;
      if (Array.isArray(remoteImages)) { const imgs = remoteImages.map((x: any) => ({ id: x._id || x.id || x.url, url: x.url, prompt: x.prompt || '', createdAt: x.createdAt ? new Date(x.createdAt).getTime() : Date.now() })).filter((x: any) => x.url); setGeneratedImages(imgs); await persist(KEYS.images, imgs); }
      if (!isCurrentSession(sessionVersion)) return;
      if (customer?.settings?.theme) setTheme(normalizeTheme(customer.settings.theme));
    } catch {}
  };

  useEffect(() => {
    if (ready && user?.id) {
      hydrateRemote(user, sessionRef.current).catch(() => null);
    }
  }, [ready, user?.id]);

  const login = async (email: string, password: string) => {
    const sessionVersion = sessionRef.current + 1;
    sessionRef.current = sessionVersion;
    const data = await api.login({ email, password });
    if (!isCurrentSession(sessionVersion)) return;
    const nextUser = data.user;
    setUser(nextUser);
    await persist(KEYS.user, nextUser);
    await hydrateRemote(nextUser, sessionVersion);
  };

  const register = async (payload: { name: string; email: string; password: string; phone?: string }) => {
    const sessionVersion = sessionRef.current + 1;
    sessionRef.current = sessionVersion;
    const data = await api.register(payload);
    if (!isCurrentSession(sessionVersion)) return;
    const nextUser = data.user;
    setUser(nextUser);
    await persist(KEYS.user, nextUser);
    await hydrateRemote(nextUser, sessionVersion);
  };

  const forgotPassword = async (email: string) => { await api.forgotPassword({ email }); };

  const logout = async () => {
    sessionRef.current += 1;
    setUser(null);
    setCart([]); setWishlist([]); setOrders([]); setGeneratedImages([]); setSearchHistory([]);
    await Promise.all([
      AsyncStorage.removeItem(KEYS.user),
      AsyncStorage.removeItem(KEYS.cart),
      AsyncStorage.removeItem(KEYS.wishlist),
      AsyncStorage.removeItem(KEYS.orders),
      AsyncStorage.removeItem(KEYS.images),
      AsyncStorage.removeItem(KEYS.search),
      AsyncStorage.removeItem('japano.lastRoute'),
    ]);
    router.replace('/(tabs)');
  };

  const requireLogin = (message = 'Bạn cần đăng nhập để mua hàng, thanh toán, lưu giỏ hàng và đồng bộ dữ liệu.') => {
    if (user?.id) return true;
    Alert.alert('Cần đăng nhập', message, [
      { text: 'Để sau', style: 'cancel' },
      { text: 'Đăng nhập', onPress: () => router.push('/login') },
    ]);
    return false;
  };

  const updateProfile = async (patch: Partial<NonNullable<User>>) => {
    if (!user) return;
    const next = { ...user, ...patch };
    setUser(next); await persist(KEYS.user, next);
    await api.saveCustomer({ ...next, userId: next.id }).catch(() => null);
  };

  const payStripeCheckout = async (extra: { total: number; shippingAddress?: string; paymentMethod?: string; checkoutMeta?: any }) => {
    if (!requireLogin('Bạn cần đăng nhập để thanh toán bằng thẻ Stripe.')) return null;
    if (!cart.length) throw new Error('Giỏ hàng đang trống.');
    const total = Number(extra.total || cart.reduce((sum, item) => sum + item.price, 0));
    const sheet = await api.createStripePaymentSheet({
      userId: user!.id,
      purpose: 'checkout',
      amount: total,
      currency: 'vnd',
      items: cart.map((item) => ({ id: item.id, name: item.name, price: item.price, qty: 1 })),
      metadata: {
        paymentMethod: extra.paymentMethod || 'Stripe',
        shippingAddress: extra.shippingAddress || user?.address || '',
      },
    });

    const init = await initPaymentSheet({
      merchantDisplayName: sheet.merchantDisplayName || 'JAPANO Fashion AI',
      customerId: sheet.customer,
      customerEphemeralKeySecret: sheet.ephemeralKey,
      paymentIntentClientSecret: sheet.paymentIntent,
      allowsDelayedPaymentMethods: false,
      defaultBillingDetails: { name: user?.name || 'JAPANO Member', email: user?.email || undefined },
    });
    if (init.error) throw new Error(init.error.message);

    const presented = await presentPaymentSheet();
    if (presented.error) throw new Error(presented.error.message);

    return { paymentIntentId: sheet.paymentIntentId };
  };

  const upgradeToVip = async () => {
    if (!requireLogin('Bạn cần đăng nhập để nâng cấp VIP thử đồ AI.')) return false;
    try {
      const sheet = await api.createStripePaymentSheet({
        userId: user!.id,
        purpose: 'vip',
        amount: 500000,
        currency: 'vnd',
        items: [{ id: 'vip-try-on-unlimited', name: 'VIP thử đồ AI không giới hạn', price: 500000, qty: 1 }],
      });

      const init = await initPaymentSheet({
        merchantDisplayName: sheet.merchantDisplayName || 'JAPANO Fashion AI',
        customerId: sheet.customer,
        customerEphemeralKeySecret: sheet.ephemeralKey,
        paymentIntentClientSecret: sheet.paymentIntent,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: { name: user?.name || 'JAPANO Member', email: user?.email || undefined },
      });
      if (init.error) throw new Error(init.error.message);

      const presented = await presentPaymentSheet();
      if (presented.error) throw new Error(presented.error.message);

      const data = await api.confirmVipPayment({ userId: user!.id, paymentIntentId: sheet.paymentIntentId });
      if (data?.user) {
        const next = { ...user!, ...data.user };
        setUser(next);
        await persist(KEYS.user, next);
      }
      Alert.alert('Thanh toán thành công', 'Bạn đã nâng cấp VIP 500.000đ và mở khóa thử đồ AI không giới hạn.');
      return true;
    } catch (error: any) {
      Alert.alert('Chưa thanh toán được VIP', error?.message || 'Hãy kiểm tra Stripe/backend và thử lại.');
      return false;
    }
  };

  const setTheme = (next: JapanoTheme) => {
    const normalized = normalizeTheme(next);
    setThemeState(normalized);
    persist(KEYS.theme, normalized).catch(() => null);
  };

  const updateTheme = (patch: Partial<JapanoTheme>) => setTheme(normalizeTheme({ ...theme, ...patch, id: 'custom-current', name: 'Giao diện tuỳ chỉnh' }));

  const importTheme = (partial: Partial<JapanoTheme>) => {
    const next = normalizeTheme({ ...defaultTheme, ...partial, id: partial.id || `theme-${Date.now()}`, name: partial.name || 'Theme nhập vào' });
    const nextThemes = [next, ...themes.filter((item) => item.id !== next.id)];
    setThemes(nextThemes); persist(KEYS.themes, nextThemes).catch(() => null); setTheme(next);
  };

  const addToCart = (p: Product, qty: number = 1) => {
    if (!requireLogin()) return false;
    const copies = Array.from({ length: Math.max(1, Math.floor(qty)) }, () => p);
    const next = [...cart, ...copies]; setCart(next); persist(KEYS.cart, next).catch(() => null);
    if (user?.id) api.saveCart(user.id, next).catch(() => null);
    toastCart(qty > 1 ? `${p?.name || 'Sản phẩm'} × ${qty}` : (p?.name || 'Sản phẩm'));
    return true;
  };

  const removeFromCart = (id: string) => {
    const next = cart.filter((p, idx) => `${p.id}-${idx}` !== id && p.id !== id); setCart(next); persist(KEYS.cart, next).catch(() => null);
    if (user?.id) api.saveCart(user.id, next).catch(() => null);
  };

  const clearCart = () => { setCart([]); persist(KEYS.cart, []).catch(() => null); if (user?.id) api.saveCart(user.id, []).catch(() => null); };

  const checkout = async (paymentMethod: string, extra: Partial<Order> = {}) => {
    if (!requireLogin('Bạn cần đăng nhập để thanh toán và lưu lịch sử mua hàng.')) return;
    if (!cart.length) throw new Error('Giỏ hàng đang trống.');
    const total = extra.total || cart.reduce((sum, item) => sum + item.price, 0);
    const normalizedPaymentId = String((extra as any).paymentMethod || paymentMethod).toUpperCase();
    const isCod = normalizedPaymentId === 'COD';

    if (!isCod) {
      let paymentIntentId = String((extra as any).stripePaymentIntentId || '');

      if (!paymentIntentId) {
        const paid = await payStripeCheckout({
          total,
          shippingAddress: extra.shippingAddress || user?.address || '',
          paymentMethod,
          checkoutMeta: extra,
        });
        paymentIntentId = paid?.paymentIntentId || '';
      }

      if (!paymentIntentId) throw new Error('Chưa có mã thanh toán Stripe.');

      const data = await api.confirmStripeOrderPayment({
        userId: user!.id,
        paymentIntentId,
        items: cart,
        total,
        paymentMethod: 'stripe',
        shippingAddress: extra.shippingAddress || user?.address || '',
        checkoutMeta: extra,
      });
      const saved = data?.order || { userId: user!.id, items: cart, total, status: 'paid', paymentMethod: 'stripe', stripePaymentIntentId: paymentIntentId, createdAt: Date.now() };
      const nextOrders = [saved, ...orders];
      setOrders(nextOrders);
      await persist(KEYS.orders, nextOrders);
      clearCart();
      toastSuccess('Thanh toán thành công 🎉', `Đơn ${formatCurrency(total)} đã được ghi nhận.`);
      return;
    }

    const order = { userId: user!.id, items: cart, total, status: extra.status || 'pending_cod', paymentMethod: (extra as any).paymentMethod || paymentMethod, shippingAddress: extra.shippingAddress || user?.address || '', checkoutMeta: extra };
    const saved = await api.createOrder(order).catch(() => ({ ...order, id: String(Date.now()), createdAt: Date.now() }));
    const nextOrders = [saved, ...orders]; setOrders(nextOrders); await persist(KEYS.orders, nextOrders); clearCart();
    toastSuccess('Đặt hàng thành công 🎉', `Đơn COD ${formatCurrency(total)} đã được tạo.`);
  };

  const toggleWishlist = (p: Product) => {
    if (!requireLogin('Bạn cần đăng nhập để lưu danh sách yêu thích.')) return;
    const id = productIdentity(p);
    const exists = wishlist.some((item) => productIdentity(item) === id);
    const next = exists ? wishlist.filter((item) => productIdentity(item) !== id) : [...wishlist.filter((item) => productIdentity(item) !== id), p];
    setWishlist(next);
    persist(KEYS.wishlist, next).catch(() => null);
    if (user?.id) api.saveWishlist(user.id, next).catch(() => null);
    if (exists) toastWishlistOff(p?.name || 'Sản phẩm'); else toastWishlistOn(p?.name || 'Sản phẩm');
  };

  const removeFromWishlist = (p: Product) => {
    const id = productIdentity(p);
    const next = wishlist.filter((item) => productIdentity(item) !== id);
    if (next.length === wishlist.length) return;
    setWishlist(next);
    persist(KEYS.wishlist, next).catch(() => null);
    if (user?.id) api.saveWishlist(user.id, next).catch(() => null);
    toastWishlistOff(p?.name || 'Sản phẩm');
  };

  const addGeneratedImage = (image: GeneratedImage) => { const next = [image, ...generatedImages].slice(0, 80); setGeneratedImages(next); persist(KEYS.images, next).catch(() => null); if (user?.id) api.saveGeneratedImage({ userId: user.id, ...image }).catch(() => null); };

  const addSearchTerm = (term: string) => {
    const normalized = term.trim(); if (!normalized) return;
    const next = [normalized, ...searchHistory.filter((x) => x !== normalized)].slice(0, 30);
    setSearchHistory(next); persist(KEYS.search, next).catch(() => null);
    if (user?.id) api.addSearch({ userId: user.id, term: normalized }).catch(() => null);
  };

  const recordView = (productId: string) => {
    const id = String(productId || ''); if (!id) return;
    setRecentlyViewed((old) => {
      const next = [id, ...old.filter((x) => x !== id)].slice(0, 40);
      persist(KEYS.recentViewed, next).catch(() => null);
      return next;
    });
  };

  const value = useMemo<AppState>(() => ({
    ready, user, isLoggedIn: Boolean(user?.id), theme, themes, cart, wishlist, generatedImages, orders, searchHistory, recentlyViewed,
    login, register, forgotPassword, logout, updateProfile, upgradeToVip, payStripeCheckout, setTheme, updateTheme, importTheme,
    addToCart, removeFromCart, clearCart, checkout, toggleWishlist, removeFromWishlist, addGeneratedImage, addSearchTerm, recordView, requireLogin,
    formatCurrency: (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value),
  }), [ready, user, theme, themes, cart, wishlist, generatedImages, orders, searchHistory, recentlyViewed]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() { const ctx = useContext(AppContext); if (!ctx) throw new Error('useApp must be used inside AppProvider'); return ctx; }
