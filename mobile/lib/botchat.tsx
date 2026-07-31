import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from './auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SmartImage } from '../components/SmartImage';
import { useCatalog } from './data';
import { Product } from './catalog';
import { getHomeRecommendations, sendStylistMessage, trackInteraction } from './api';
import { loadStyleProfile } from './profile';
import { useStore } from './store';
import { BotCartItem, subscribeBotEvents } from './botEvents';
import { C, F, money } from '../theme/tokens';

const ENABLED_KEY = '@japano/bot/enabled/v1';
const POSITION_KEY = '@japano/bot/position/v1';
const BUBBLE_SIZE = 62;
const MARGIN = 12;

type BotMessage = { id: string; role: 'ai' | 'me'; text: string; productIds?: string[] };
type BotMode = 'mood' | 'removed' | 'checkout';
type BotContextValue = {
  enabled: boolean;
  ready: boolean;
  setEnabled: (value: boolean) => void;
  openBot: (message?: string) => void;
};

const BotContext = createContext<BotContextValue | null>(null);

export function useBotChat() {
  const value = useContext(BotContext);
  if (!value) throw new Error('useBotChat must be used within BotChatProvider');
  return value;
}

const messageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const productKey = (product?: Product | null) => String(product?.slug || product?.id || '');
const colorFor = (product: Product) => {
  const first = product.colors?.[0];
  return typeof first === 'string' ? first : first?.name || 'Sumi';
};
const sizeFor = (product: Product) => product.sizes?.includes('M') ? 'M' : product.sizes?.[0] || 'M';

function topSuggestions(products: Product[], excluded = '') {
  return products
    .filter(product => productKey(product) && productKey(product) !== excluded && product.cat !== 'phu-kien')
    .sort((a, b) => {
      const saleA = a.old && a.old > a.price ? (a.old - a.price) / a.old : 0;
      const saleB = b.old && b.old > b.price ? (b.old - b.price) / b.old : 0;
      return (saleB * 5 + b.rating + Math.min(b.sold, 250) / 250)
        - (saleA * 5 + a.rating + Math.min(a.sold, 250) / 250);
    })
    .slice(0, 3)
    .map(productKey);
}

function lowerPriceAlternatives(products: Product[], removed?: Product) {
  const pool = products
    .filter(product => productKey(product) !== productKey(removed) && product.cat !== 'phu-kien')
    .sort((a, b) => {
      if (removed && a.cat === removed.cat && b.cat !== removed.cat) return -1;
      if (removed && b.cat === removed.cat && a.cat !== removed.cat) return 1;
      return a.price - b.price;
    });
  return pool.slice(0, 3).map(productKey);
}

function BotProductCard({
  product,
  wished,
  onView,
  onWish,
  onCart,
  onBuy,
}: {
  product: Product;
  wished: boolean;
  onView: () => void;
  onWish: () => void;
  onCart: () => void;
  onBuy: () => void;
}) {
  return (
    <View style={styles.productCard}>
      <Pressable onPress={onView} style={{ flexDirection: 'row' }}>
        <SmartImage source={product.images[0]} style={styles.productImage} recyclingKey={`${product.slug}-bot`} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
          <Text style={styles.productPrice}>{money(product.price)}</Text>
          <Text style={styles.productReason} numberOfLines={1}>★ {product.rating.toFixed(1)} · dễ phối theo phong cách Nhật</Text>
        </View>
      </Pressable>
      <View style={styles.productActions}>
        <Pressable accessibilityLabel="Thêm vào yêu thích" style={[styles.iconAction, wished && styles.wishedAction]} onPress={onWish}>
          <Ionicons name={wished ? 'heart' : 'heart-outline'} size={16} color={wished ? '#fff' : C.shu} />
        </Pressable>
        <Pressable style={styles.cartAction} onPress={onCart}>
          <Ionicons name="bag-add-outline" size={15} color={C.ink} />
          <Text style={styles.actionText}>Thêm giỏ</Text>
        </Pressable>
        <Pressable style={styles.buyAction} onPress={onBuy}>
          <Text style={[styles.actionText, { color: '#fff' }]}>Mua ngay</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function BotChatProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { products } = useCatalog();
  const { addToCart, isWished, toggleWish, showToast } = useStore();
  const { user, isAuthenticated, requireAuth } = useAuth();
  const localInitialProducts = useMemo(() => topSuggestions(products), [products]);
  const [initialProducts, setInitialProducts] = useState<string[]>(localInitialProducts);
  const [enabled, setEnabledState] = useState(true);
  const enabledRef = useRef(true);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(true);
  const [mode, setMode] = useState<BotMode>('mood');
  const [removedItem, setRemovedItem] = useState<BotCartItem | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<BotMessage[]>(() => [
    { id: messageId(), role: 'ai', text: 'Hôm nay bạn thế nào? Kể Ori nghe một chút để mình chọn đồ đúng tâm trạng của bạn nhé.' },
    { id: messageId(), role: 'ai', text: 'Mình chọn trước vài món được đánh giá tốt trong shop. Bạn có thể yêu thích, thêm giỏ hoặc mua ngay tại đây.', productIds: topSuggestions(products) },
  ]);
  const listRef = useRef<ScrollView>(null);
  const drag = useRef(new Animated.ValueXY()).current;
  const [position, setPosition] = useState({ x: Math.max(MARGIN, width - BUBBLE_SIZE - 18), y: Math.max(120, height - 220) });

  useEffect(() => {
    setInitialProducts(localInitialProducts);
    if (!user?.id) return;
    let live = true;
    getHomeRecommendations(user.id, 3)
      .then(result => {
        if (!live) return;
        const slugs = result.items
          .map(item => typeof item === 'string' ? item : String(item.slug || item.productId || item.id || ''))
          .filter(Boolean);
        if (slugs.length) setInitialProducts(slugs);
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [localInitialProducts, user?.id]);

  const clampPosition = useCallback((x: number, y: number) => ({
    x: Math.max(MARGIN, Math.min(Math.max(MARGIN, width - BUBBLE_SIZE - MARGIN), x)),
    y: Math.max(insets.top + 52, Math.min(Math.max(insets.top + 52, height - BUBBLE_SIZE - insets.bottom - 78), y)),
  }), [height, insets.bottom, insets.top, width]);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(ENABLED_KEY), AsyncStorage.getItem(POSITION_KEY)])
      .then(([savedEnabled, savedPosition]) => {
        const nextEnabled = savedEnabled !== 'false';
        enabledRef.current = nextEnabled;
        setEnabledState(nextEnabled);
        if (savedPosition) {
          const parsed = JSON.parse(savedPosition);
          if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) setPosition(clampPosition(parsed.x, parsed.y));
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [clampPosition]);

  useEffect(() => {
    setPosition(current => clampPosition(current.x, current.y));
  }, [clampPosition]);

  useEffect(() => {
    if (!ready || !enabled) return;
    setTeaser(true);
    const timer = setTimeout(() => setTeaser(false), 9000);
    return () => clearTimeout(timer);
  }, [enabled, ready]);

  useEffect(() => {
    if (!initialProducts.length) return;
    setMessages(current => current.map((message, index) => index === 1 && !message.productIds?.length
      ? { ...message, productIds: initialProducts }
      : message));
  }, [initialProducts]);

  useEffect(() => {
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [loading, messages, open]);

  const setEnabled = useCallback((value: boolean) => {
    enabledRef.current = value;
    setEnabledState(value);
    if (!value) {
      setOpen(false);
      setTeaser(false);
    } else {
      setTeaser(true);
    }
    void AsyncStorage.setItem(ENABLED_KEY, String(value)).catch(() => undefined);
  }, []);

  const openBot = useCallback((message?: string) => {
    if (!isAuthenticated) { requireAuth('/chat'); return; }
    if (!enabledRef.current) return;
    if (message) setMessages(current => [...current, { id: messageId(), role: 'ai', text: message }]);
    setTeaser(false);
    setOpen(true);
  }, [isAuthenticated, requireAuth]);

  useEffect(() => {
    if (!isAuthenticated) setOpen(false);
  }, [isAuthenticated]);

  useEffect(() => subscribeBotEvents(event => {
    if (!enabledRef.current) return;
    if (event.type === 'cart_removed') {
      const product = products.find(item => productKey(item) === event.item.slug);
      setRemovedItem(event.item);
      setMode('removed');
      setMessages(current => [...current, {
        id: messageId(),
        role: 'ai',
        text: `Mình thấy bạn vừa bỏ ${product?.name || 'một sản phẩm'} khỏi giỏ. Lý do nào khiến bạn đổi ý? Ori sẽ dùng câu trả lời để gợi ý sát hơn.`,
      }]);
      setTeaser(false);
      setOpen(true);
      return;
    }
    if (event.type === 'checkout_failed') {
      setMode('checkout');
      setMessages(current => [...current, {
        id: messageId(),
        role: 'ai',
        text: `Thanh toán chưa hoàn tất: ${event.reason} Mình có thể giúp bạn thử lại, đổi sang COD hoặc kiểm tra giỏ hàng.`,
      }]);
      setTeaser(false);
      setOpen(true);
      return;
    }
    openBot(event.message);
  }), [openBot, products]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
    onPanResponderGrant: () => drag.setValue({ x: 0, y: 0 }),
    onPanResponderMove: Animated.event([null, { dx: drag.x, dy: drag.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => {
      const next = clampPosition(position.x + gesture.dx, position.y + gesture.dy);
      drag.setValue({ x: 0, y: 0 });
      setPosition(next);
      void AsyncStorage.setItem(POSITION_KEY, JSON.stringify(next)).catch(() => undefined);
    },
    onPanResponderTerminate: () => drag.setValue({ x: 0, y: 0 }),
  }), [clampPosition, drag, position.x, position.y]);

  const navigate = useCallback((target: string | object) => {
    setOpen(false);
    setTimeout(() => router.push(target as any), 100);
  }, [router]);

  const addMessage = useCallback((message: BotMessage) => setMessages(current => [...current, message]), []);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) return;
    setInput('');
    setMode('mood');
    const mine: BotMessage = { id: messageId(), role: 'me', text };
    const history = [...messages, mine];
    setMessages(history);
    setLoading(true);
    try {
      const profile = await loadStyleProfile();
      const result = await sendStylistMessage({
        userId: user?.id,
        message: text,
        profile,
        history: history.slice(-8).map(message => ({
          role: message.role === 'me' ? 'user' : 'assistant',
          content: message.text,
        })),
      });
      addMessage({
        id: messageId(),
        role: 'ai',
        text: result.message,
        productIds: result.products,
      });
    } catch {
      addMessage({
        id: messageId(),
        role: 'ai',
        text: 'Kết nối tư vấn đang bận, nhưng Ori vẫn chọn được vài món dễ phối và được đánh giá tốt để bạn xem trước.',
        productIds: initialProducts,
      });
    } finally {
      setLoading(false);
    }
  }, [addMessage, initialProducts, loading, messages, user?.id]);

  const answerQuick = useCallback((label: string) => {
    if (mode === 'removed' && removedItem) {
      const removedProduct = products.find(product => productKey(product) === removedItem.slug);
      const alternatives = label === 'Giá chưa phù hợp'
        ? lowerPriceAlternatives(products, removedProduct)
        : topSuggestions(products, removedItem.slug);
      addMessage({ id: messageId(), role: 'me', text: label });
      void trackInteraction({
        userId: user?.id,
        type: 'cart',
        productId: removedItem.slug,
        value: 0,
        metadata: { removedReason: label, source: 'botchat-feedback' },
      }).catch(() => undefined);
      addMessage({
        id: messageId(),
        role: 'ai',
        text: label === 'Giá chưa phù hợp'
          ? 'Cảm ơn bạn. Mình ưu tiên vài lựa chọn dễ tiếp cận hơn về giá nhé.'
          : 'Cảm ơn bạn, Ori đã ghi nhận để những lần gợi ý sau sát gu hơn. Bạn có thể xem các lựa chọn này:',
        productIds: alternatives,
      });
      setRemovedItem(null);
      setMode('mood');
      return;
    }
    if (mode === 'checkout') {
      addMessage({ id: messageId(), role: 'me', text: label });
      setMode('mood');
      if (label === 'Đổi sang COD') {
        navigate({ pathname: '/checkout', params: { pay: 'cod' } });
      } else if (label === 'Kiểm tra giỏ') {
        navigate('/cart');
      } else {
        navigate('/checkout');
      }
      return;
    }
    void send(label);
  }, [addMessage, mode, navigate, products, removedItem, send, user?.id]);

  const quickLabels = mode === 'removed'
    ? ['Không hợp gu', 'Giá chưa phù hợp', 'Sai kích cỡ hoặc màu', 'Chỉ xem thử']
    : mode === 'checkout'
      ? ['Thử thanh toán lại', 'Đổi sang COD', 'Kiểm tra giỏ']
      : ['Hôm nay vui vẻ', 'Cần đổi mood', 'Phối đồ đi làm', 'Tìm món dễ phối'];

  const wishProduct = useCallback((product: Product) => {
    if (!isWished(product.slug)) {
      toggleWish(product.slug);
      showToast('Đã thêm vào yêu thích ♥');
      addMessage({ id: messageId(), role: 'ai', text: `${product.name} đã được lưu vào yêu thích của bạn.` });
    } else {
      showToast('Sản phẩm đã có trong yêu thích');
    }
  }, [addMessage, isWished, showToast, toggleWish]);

  const cartProduct = useCallback((product: Product) => {
    addToCart(product.slug, colorFor(product), sizeFor(product));
    addMessage({ id: messageId(), role: 'ai', text: `Đã thêm ${product.name} vào giỏ. Khi sẵn sàng, bạn có thể thanh toán ngay trong bot.` });
  }, [addMessage, addToCart]);

  const buyProduct = useCallback((product: Product) => {
    addToCart(product.slug, colorFor(product), sizeFor(product));
    navigate('/checkout');
  }, [addToCart, navigate]);

  // Giữ bubble qua mọi lần điều hướng. Nó chỉ ẩn khi panel đang mở hoặc khi
  // người dùng chủ động bấm dấu × (enabled=false).
  const showFloating = ready && enabled && !open;

  const value = useMemo(() => ({ enabled, ready, setEnabled, openBot }), [enabled, openBot, ready, setEnabled]);

  return (
    <BotContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}

        {showFloating && (
          <Animated.View
            {...panResponder.panHandlers}
            pointerEvents="box-none"
            style={[styles.floatingFrame, {
              left: position.x,
              top: position.y,
              transform: [{ translateX: drag.x }, { translateY: drag.y }],
            }]}
          >
            {teaser && (
              <Pressable
                onPress={() => openBot()}
                style={[styles.teaser, position.x > width / 2 ? { right: BUBBLE_SIZE + 8 } : { left: BUBBLE_SIZE + 8 }]}
              >
                <Text style={styles.teaserTitle}>Hôm nay bạn thế nào?</Text>
                <Text style={styles.teaserText}>Ori có vài gợi ý cho bạn ✨</Text>
              </Pressable>
            )}
            <Pressable accessibilityLabel="Mở trợ lý Ori" style={styles.floatingButton} onPress={() => openBot()}>
              <Ionicons name="chatbubble-ellipses" size={27} color="#fff" />
              <View style={styles.onlineDot} />
            </Pressable>
            <Pressable accessibilityLabel="Ẩn nút botchat" hitSlop={7} style={styles.closeBubble} onPress={() => setEnabled(false)}>
              <Ionicons name="close" size={13} color="#fff" />
            </Pressable>
          </Animated.View>
        )}

        <Modal visible={isAuthenticated && open && enabled} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setOpen(false)}>
          <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
            <View style={[styles.panel, { paddingBottom: Math.max(12, insets.bottom) }]}>
              <View style={styles.panelHeader}>
                <View style={styles.oriAvatar}><Text style={styles.oriLetter}>織</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.panelTitle}>Ori · Botchat mua sắm</Text>
                  <Text style={styles.panelStatus}>● mLSTM memory · MoE · catalog-grounded</Text>
                </View>
                <Pressable accessibilityLabel="Mở chat toàn màn hình" style={styles.headerIcon} onPress={() => navigate('/chat')}>
                  <Ionicons name="expand-outline" size={19} color={C.ink} />
                </Pressable>
                <Pressable accessibilityLabel="Thu nhỏ botchat" style={styles.headerIcon} onPress={() => setOpen(false)}>
                  <Ionicons name="remove" size={21} color={C.ink} />
                </Pressable>
              </View>

              <ScrollView ref={listRef} style={styles.messageList} contentContainerStyle={{ padding: 12, gap: 9 }} keyboardShouldPersistTaps="handled">
                {messages.map(message => (
                  <View key={message.id} style={[styles.message, message.role === 'ai' ? styles.aiMessage : styles.meMessage]}>
                    <Text style={message.role === 'ai' ? styles.aiText : styles.meText}>{message.text}</Text>
                    {!!message.productIds?.length && (
                      <ScrollView
                        horizontal
                        nestedScrollEnabled
                        showsHorizontalScrollIndicator={false}
                        style={styles.productCarousel}
                        contentContainerStyle={{ gap: 9, paddingTop: 10 }}
                      >
                        {message.productIds.map(key => {
                          const product = products.find(item => productKey(item) === key);
                          if (!product) return null;
                          return (
                            <BotProductCard
                              key={`${message.id}-${key}`}
                              product={product}
                              wished={isWished(product.slug)}
                              onView={() => navigate(`/product/${product.slug}`)}
                              onWish={() => wishProduct(product)}
                              onCart={() => cartProduct(product)}
                              onBuy={() => buyProduct(product)}
                            />
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>
                ))}
                {loading && (
                  <View style={[styles.message, styles.aiMessage, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                    <ActivityIndicator size="small" color={C.shu} />
                    <Text style={styles.aiText}>Ori đang chọn đồ…</Text>
                  </View>
                )}
                <View style={styles.quickWrap}>
                  {quickLabels.map(label => (
                    <Pressable key={label} style={styles.quickChip} onPress={() => answerQuick(label)}>
                      <Text style={styles.quickText}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.inputRow}>
                <View style={styles.inputBox}>
                  <TextInput
                    value={input}
                    onChangeText={setInput}
                    placeholder="Nhắn cho Ori…"
                    placeholderTextColor={C.muted}
                    style={styles.textInput}
                    returnKeyType="send"
                    onSubmitEditing={() => void send(input)}
                  />
                </View>
                <Pressable style={styles.sendButton} onPress={() => void send(input)}>
                  <Ionicons name="send" size={18} color="#fff" />
                </Pressable>
              </View>
              <Pressable style={styles.disableRow} onPress={() => setEnabled(false)}>
                <Ionicons name="eye-off-outline" size={14} color={C.muted} />
                <Text style={styles.disableText}>Ẩn nút botchat · mở lại trong Cài đặt</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </BotContext.Provider>
  );
}

const styles = StyleSheet.create({
  floatingFrame: { position: 'absolute', width: BUBBLE_SIZE, height: BUBBLE_SIZE, zIndex: 1000, elevation: 18 },
  floatingButton: {
    width: BUBBLE_SIZE, height: BUBBLE_SIZE, borderRadius: BUBBLE_SIZE / 2, backgroundColor: C.shu,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.26, shadowRadius: 9, shadowOffset: { width: 0, height: 5 }, elevation: 14,
  },
  onlineDot: { position: 'absolute', right: 4, bottom: 4, width: 13, height: 13, borderRadius: 8, backgroundColor: C.ok, borderWidth: 2, borderColor: '#fff' },
  closeBubble: { position: 'absolute', right: -5, top: -6, width: 23, height: 23, borderRadius: 12, backgroundColor: C.sumi, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', elevation: 16 },
  teaser: { position: 'absolute', top: 5, width: 190, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12, elevation: 13, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 7, shadowOffset: { width: 0, height: 3 } },
  teaserTitle: { fontFamily: F.bodyB, fontSize: 12.5, color: C.ink },
  teaserText: { fontFamily: F.body, fontSize: 10.5, color: C.muted, marginTop: 2 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,14,10,0.42)' },
  panel: { height: '84%', backgroundColor: C.washi, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  panelHeader: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.hair, backgroundColor: C.paper },
  oriAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.ai, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.kin },
  oriLetter: { color: '#fff', fontFamily: F.display, fontSize: 19 },
  panelTitle: { fontFamily: F.display, fontSize: 15, color: C.sumi },
  panelStatus: { fontFamily: F.bodyB, fontSize: 10.5, color: C.ok, marginTop: 2 },
  headerIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  messageList: { flex: 1 },
  message: { maxWidth: '94%', padding: 10, borderRadius: 15 },
  aiMessage: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderTopLeftRadius: 4 },
  meMessage: { alignSelf: 'flex-end', backgroundColor: C.shu, borderTopRightRadius: 4 },
  aiText: { fontFamily: F.body, fontSize: 12.5, lineHeight: 18, color: C.ink },
  meText: { fontFamily: F.body, fontSize: 12.5, lineHeight: 18, color: '#fff' },
  productCarousel: { height: 142, flexGrow: 0 },
  productCard: { width: 272, height: 132, borderRadius: 13, padding: 9, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line },
  productImage: { width: 58, height: 70, borderRadius: 9 },
  productName: { fontFamily: F.bodyB, fontSize: 12.5, lineHeight: 16, color: C.ink },
  productPrice: { fontFamily: F.bodyX, fontSize: 12.5, color: C.shu, marginTop: 3 },
  productReason: { fontFamily: F.body, fontSize: 9.5, color: C.muted, marginTop: 3 },
  productActions: { flexDirection: 'row', gap: 6, marginTop: 8 },
  iconAction: { width: 34, height: 31, borderRadius: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: C.shu, alignItems: 'center', justifyContent: 'center' },
  wishedAction: { backgroundColor: C.shu },
  cartAction: { flex: 1, height: 31, borderRadius: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  buyAction: { flex: 1, height: 31, borderRadius: 9, backgroundColor: C.ai, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: F.bodyB, fontSize: 10.5, color: C.ink },
  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingTop: 2 },
  quickChip: { borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, paddingVertical: 7, paddingHorizontal: 10 },
  quickText: { fontFamily: F.bodyM, fontSize: 10.5, color: C.ink },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 12, paddingTop: 9, borderTopWidth: 1, borderTopColor: C.hair },
  inputBox: { flex: 1, height: 42, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, justifyContent: 'center', paddingHorizontal: 14 },
  textInput: { fontFamily: F.body, fontSize: 13, color: C.ink, paddingVertical: 0 },
  sendButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.shu, alignItems: 'center', justifyContent: 'center' },
  disableRow: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8 },
  disableText: { fontFamily: F.body, fontSize: 10.5, color: C.muted },
});
