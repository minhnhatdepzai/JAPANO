import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Enso } from '../components/art';
import { useCatalog } from '../lib/data';
import { sendStylistMessage, StylistAction, warmStylistChat } from '../lib/api';
import { loadStyleProfile } from '../lib/profile';
import { C, F } from '../theme/tokens';
import { SmartImage } from '../components/SmartImage';
import { useStore } from '../lib/store';
import { Product } from '../lib/catalog';
import { useAuth } from '../lib/auth';
import { getHomeRecommendations } from '../lib/api';
import { useGpuFocus } from '../lib/useGpuFocus';

type Msg = { role: 'ai' | 'me'; text: string; productIds?: string[]; actions?: StylistAction[] };
const GREETING: Msg = {
  role: 'ai',
  text: 'Hôm nay bạn thế nào? Mình là Ori. Bạn kể mình nghe tâm trạng hoặc dịp sắp tới nhé — mình sẽ chọn món phù hợp và bạn có thể thêm giỏ, yêu thích hoặc mua ngay trong cuộc trò chuyện.',
  productIds: ['blazer-kaki', 'kimono-hong', 'ao-len-cardigan'],
};
const SUGGESTIONS = ['Hôm nay vui vẻ', 'Cần đổi mood', 'Phối đồ đi làm', 'Tìm món dễ phối'];

const defaultColor = (product: Product) => {
  const first = product.colors?.[0];
  return typeof first === 'string' ? first : first?.name || 'Sumi';
};
const defaultSize = (product: Product) => product.sizes?.includes('M') ? 'M' : product.sizes?.[0] || 'M';

export default function Chat() {
  useGpuFocus('chat');
  const router = useRouter();
  const { user } = useAuth();
  const { products } = useCatalog();
  const { addToCart, isWished, toggleWish, showToast } = useStore();
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const bySlug = (key: string) => products.find(p => p.slug === key || p.id === key);

  const runAction = (action: StylistAction) => {
    Keyboard.dismiss();
    switch (action.id) {
      case 'open_shop': router.push('/(tabs)/products'); break;
      case 'open_checkout': router.push('/checkout'); break;
      case 'open_cart': router.push('/cart'); break;
      case 'open_wishlist': router.push('/(tabs)/wishlist'); break;
      case 'open_orders': router.push('/orders'); break;
      case 'open_explore_japan': router.push('/explore-japan'); break;
      case 'open_tryon': router.push(action.productId ? { pathname:'/tryon', params:{ productId:action.productId } } as any : '/tryon'); break;
      case 'open_product': if (action.productId) router.push(`/product/${action.productId}`); break;
    }
  };

  useEffect(() => { void warmStylistChat(); }, []);

  useEffect(() => {
    if (!user?.id) return;
    let live = true;
    getHomeRecommendations(user.id, 3)
      .then(result => {
        if (!live) return;
        const productIds = result.items
          .map(item => typeof item === 'string' ? item : String(item.slug || item.productId || item.id || ''))
          .filter(Boolean);
        if (productIds.length) setMessages(current => current.map((message, index) => index === 0 ? { ...message, productIds } : message));
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [user?.id]);

  const addFavorite = (product: Product) => {
    if (!isWished(product.slug)) {
      toggleWish(product.slug);
      showToast('Đã thêm vào yêu thích ♥','success');
    } else {
      showToast('Sản phẩm đã có trong yêu thích');
    }
  };
  const addCart = (product: Product) => addToCart(product.slug, defaultColor(product), defaultSize(product));
  const buyNow = (product: Product) => {
    addCart(product);
    router.push('/checkout');
  };

  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [messages, loading]);

  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const subscription = Keyboard.addListener(event, () => {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    });
    return () => subscription.remove();
  }, []);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput('');
    const history = [...messages, { role: 'me' as const, text: trimmed }];
    setMessages(history);
    setLoading(true);
    try {
      const profile = await loadStyleProfile();
      const result = await sendStylistMessage({
        userId: user?.id,
        message: trimmed,
        profile,
        history: history.slice(-8).map(m => ({
          role: m.role === 'me' ? 'user' : 'assistant',
          content: m.text,
          productIds: m.productIds,
        })),
      });
      setMessages(m => [...m, {
        role: 'ai', text: result.message,
        productIds: result.products?.map(String), actions: result.actions,
      }]);
      const automatic = result.actions.find(action => action.auto);
      if (automatic) setTimeout(() => runAction(automatic), 280);
    } catch (e: any) {
      setMessages(m => [...m, { role: 'ai', text: e?.message || 'Ori chưa kết nối được, bạn thử lại nhé.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.washi }}>
      <View style={st.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={22} color={C.sumi} /></Pressable>
        <Enso size={38} sw={7} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.display, fontSize: 16, color: C.sumi }}>Trợ lý Ori</Text>
          <Text style={{ fontFamily: F.bodyB, fontSize: 11, color: C.matcha }}>● Qwen3-VL tools · catalog-grounded</Text>
        </View>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={st.messageList}
          contentContainerStyle={st.messageContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m, i) => (
            <View key={i} style={[st.bubble, m.role === 'ai' ? st.ai : st.me]}>
              <Text style={m.role === 'ai' ? st.aiT : st.meT}>{m.text}</Text>
              {!!m.productIds?.length && (
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  style={st.productCarousel}
                  contentContainerStyle={st.productCarouselContent}
                >
                  {m.productIds.map(slug => {
                    const p = bySlug(slug);
                    if (!p) return null;
                    return (
                      <Pressable key={slug} style={st.mini} onPress={() => router.push(`/product/${p.slug}`)}>
                        <SmartImage source={p.images[0]} style={{ width: 54, height: 66, borderRadius: 9 }} recyclingKey={`${p.slug}-chat`} />
                        <View style={st.miniBody}>
                          <Text style={{ fontFamily: F.bodyB, fontSize: 12.5, color: C.ink }} numberOfLines={1}>{p.name}</Text>
                          <Text style={{ fontFamily: F.bodyX, fontSize: 12, color: C.ink }}>{p.price.toLocaleString('vi-VN')}₫</Text>
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                            <Pressable accessibilityLabel="Thêm vào yêu thích" style={[st.miniBtn, isWished(p.slug) && st.wishOn]} onPress={() => addFavorite(p)}>
                              <Ionicons name={isWished(p.slug) ? 'heart' : 'heart-outline'} size={13} color={isWished(p.slug) ? '#fff' : C.shu} />
                            </Pressable>
                            <Pressable style={st.miniBtn} onPress={() => addCart(p)}><Text style={st.miniBtnT}>Giỏ</Text></Pressable>
                            <Pressable style={[st.miniBtn, st.miniOn]} onPress={() => router.push({ pathname: '/tryon', params: { productId: p.slug } } as any)}><Text style={[st.miniBtnT, { color: '#fff' }]}>Thử đồ</Text></Pressable>
                            <Pressable style={[st.miniBtn, st.buyBtn]} onPress={() => buyNow(p)}><Text style={[st.miniBtnT, { color: '#fff' }]}>Mua</Text></Pressable>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              {!!m.actions?.length && (
                <View style={st.actionRow}>
                  {m.actions.filter(action => !action.auto).map(action => (
                    <Pressable
                      key={`${action.id}-${action.productId || ''}`}
                      accessibilityRole="button"
                      accessibilityLabel={action.label}
                      style={st.actionBtn}
                      onPress={() => runAction(action)}
                    >
                      <Ionicons name="arrow-forward-circle-outline" size={16} color="#fff" />
                      <Text style={st.actionText}>{action.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ))}
          {loading && (
            <View style={[st.bubble, st.ai, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <ActivityIndicator size="small" color={C.ink} />
              <Text style={st.aiT}>Ori đang nghĩ…</Text>
            </View>
          )}
          {messages.length <= 1 && (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {SUGGESTIONS.map(t => (
                <Pressable key={t} style={st.sug} onPress={() => void send(t)}><Text style={{ fontFamily: F.bodyM, fontSize: 11, color: C.ink }}>{t}</Text></Pressable>
              ))}
            </View>
          )}
        </ScrollView>
        <View style={st.inputBar}>
          <View style={st.input}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Nhắn cho Ori…"
              placeholderTextColor={C.muted}
              style={st.textInput}
              onSubmitEditing={() => void send(input)}
              returnKeyType="send"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gửi tin nhắn cho Ori"
            disabled={!input.trim() || loading}
            style={({ pressed }) => [st.send, (!input.trim() || loading) && st.sendDisabled, pressed && input.trim() && !loading && st.sendPressed]}
            onPress={() => void send(input)}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.hair },
  messageList: { flex: 1 },
  messageContent: { padding: 16, gap: 10 },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 16 },
  ai: { alignSelf: 'flex-start', backgroundColor:C.card, borderWidth: 1, borderColor: C.line, borderTopLeftRadius: 4 },
  me: { alignSelf: 'flex-end', backgroundColor: C.primary, borderTopRightRadius: 4 },
  aiT: { fontFamily: F.body, fontSize: 13.5, color: C.ink, lineHeight: 20 },
  meT: { fontFamily: F.body, fontSize: 13.5, color: '#fff', lineHeight: 20 },
  productCarousel: { height: 92, flexGrow: 0, alignSelf: 'stretch' },
  productCarouselContent: { gap: 8, paddingTop: 10, paddingRight: 4 },
  mini: { flexDirection: 'row', backgroundColor: C.paper, borderRadius: 12, padding: 8, width: 280, height: 82 },
  miniBody: { flex: 1, minWidth: 0, marginLeft: 10 },
  miniBtn: { borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, backgroundColor:C.card },
  miniOn: { backgroundColor: C.primary, borderColor: C.primary },
  wishOn: { backgroundColor: C.primary, borderColor: C.primary },
  buyBtn: { backgroundColor: C.ai, borderColor: C.ai },
  miniBtnT: { fontFamily: F.bodyB, fontSize: 10.5, color: C.ink },
  sug: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, backgroundColor:C.card },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: C.ai, paddingVertical: 8, paddingHorizontal: 12 },
  actionText: { fontFamily: F.bodyB, fontSize: 11.5, color: '#fff' },
  inputBar: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.hair, backgroundColor: C.washi },
  input: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor:C.card, paddingHorizontal: 16, justifyContent: 'center' },
  textInput: { flex: 1, fontFamily: F.body, fontSize: 14, color: C.ink, paddingVertical: 0 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.42 },
  sendPressed: { opacity: 0.72 },
});
