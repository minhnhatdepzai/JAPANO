// JAPANO - TRANG CHI TIẾT SẢN PHẨM (biến thể size/màu, ảnh, đánh giá, mua hàng)
// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { products as localProducts } from '../../data/catalog';
import { api } from '../../lib/api';
import AppButton from '../../components/AppButton';
import { SafeImage } from '../../components/SafeImage';
import {
  cardStyle,
  control,
  fontFamily,
  inputStyle,
  onPrimary,
  pill,
  pillText,
  scaleFont,
  shadow,
} from '../../lib/styles';

function firstImage(p) {
  if (!p) return '';
  if (Array.isArray(p.images) && p.images[0]) {
    const f = p.images[0];
    if (typeof f === 'string') return f;
    if (f?.url) return f.url;
    if (f?.secure_url) return f.secure_url;
  }
  return p.image || p.firstImage || p.thumbnail || '';
}

function gallery(p) {
  const list = [];
  if (Array.isArray(p?.images)) {
    p.images.forEach((x) => list.push(typeof x === 'string' ? x : x?.url || x?.secure_url));
  }
  if (p?.image) list.push(p.image);
  return Array.from(new Set(list.filter(Boolean)));
}

function idOf(p) {
  return String(p?._id || p?.id || p?.sku || p?.slug || p?.name || '');
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() || {};
  const { theme, formatCurrency, addToCart, wishlist, toggleWishlist, user, requireLogin, recordView } = useApp();

  const wantedId = String(params.id || params.productId || params._id || params.sku || '');

  const fromParam = useMemo(() => {
    if (!params.product) return null;
    try { return JSON.parse(decodeURIComponent(String(params.product))); } catch { return null; }
  }, [params.product]);

  const baseProduct = useMemo(() => {
    if (fromParam) return fromParam;
    return (
      localProducts.find((p) => idOf(p) === wantedId) ||
      localProducts.find((p) => String(p.id) === wantedId) ||
      null
    );
  }, [fromParam, wantedId]);

  const [product, setProduct] = useState(baseProduct);
  const [activeImg, setActiveImg] = useState(firstImage(baseProduct));

  const sizes = useMemo(() => {
    const s = Array.isArray(product?.sizes) ? product.sizes.map(String) : [];
    if (Array.isArray(product?.variants)) {
      product.variants.forEach((v) => v?.size && s.push(String(v.size)));
    }
    return Array.from(new Set(s.filter(Boolean)));
  }, [product]);

  const colors = useMemo(() => {
    const c = Array.isArray(product?.colors) ? product.colors.map(String) : [];
    if (Array.isArray(product?.variants)) {
      product.variants.forEach((v) => v?.color && c.push(String(v.color)));
    }
    return Array.from(new Set(c.filter(Boolean)));
  }, [product]);

  const [selectedSize, setSelectedSize] = useState(String(params.selectedSize || ''));
  const [selectedColor, setSelectedColor] = useState(String(params.selectedColor || ''));
  const [qty, setQty] = useState(1);

  const selectedVariant = useMemo(() => {
    const vs = Array.isArray(product?.variants) ? product.variants : [];
    if (!vs.length) return null;
    return (
      vs.find((v) => (!selectedSize || String(v.size) === selectedSize) && (!selectedColor || String(v.color) === selectedColor)) ||
      null
    );
  }, [product, selectedSize, selectedColor]);

  const unitPrice = Number(selectedVariant?.price ?? product?.price ?? 0);
  const oldPrice = Number(selectedVariant?.originalPrice ?? product?.originalPrice ?? 0);
  const hasDiscount = oldPrice > unitPrice;
  const stock = Number(selectedVariant?.stockQuantity ?? product?.stock ?? 99);

  // ---- Đánh giá ----
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ averageRating: 0, count: 0 });
  const [canReview, setCanReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [sending, setSending] = useState(false);

  async function loadReviews() {
    const pid = idOf(product);
    if (!pid) return;
    try {
      const data = await api.getProductReviews(pid, String(user?.id || ''));
      const list = data?.reviews || data?.items || (Array.isArray(data) ? data : []);
      setReviews(list);
      setReviewStats({
        averageRating: Number(data?.averageRating || data?.stats?.averageRating || 0),
        count: Number(data?.count || data?.stats?.count || list.length || 0),
      });
    } catch {}
    if (user?.id) {
      try {
        const elig = await api.getReviewEligibility(pid, String(user.id));
        setCanReview(Boolean(elig?.canReview));
      } catch { setCanReview(false); }
    }
  }

  useEffect(() => { loadReviews(); }, [product, user?.id]);
  useEffect(() => { if (product) recordView(idOf(product)); }, [product]);

  // Gợi ý "Sản phẩm liên quan" bằng recommender ML (map id -> catalog local)
  const [related, setRelated] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const pidStr = idOf(product);
      if (!pidStr) return;
      let ids = [];
      try {
        const r = await api.getRelatedProducts(pidStr);
        ids = Array.isArray(r?.productIds) ? r.productIds : [];
      } catch {}
      let list = ids.map((x) => localProducts.find((p) => idOf(p) === String(x) || String(p.id) === String(x))).filter(Boolean);
      if (list.length < 4) {
        const cat = product?.category;
        const extra = localProducts.filter((p) => idOf(p) !== pidStr && (!cat || p.category === cat));
        for (const p of extra) { if (!list.find((x) => idOf(x) === idOf(p))) list.push(p); if (list.length >= 8) break; }
      }
      if (alive) setRelated(list.slice(0, 8));
    })();
    return () => { alive = false; };
  }, [product]);

  async function submitReview() {
    if (!requireLogin('Bạn cần đăng nhập để gửi đánh giá.')) return;
    if (!reviewComment.trim()) { Alert.alert('Thiếu nội dung', 'Hãy nhập nhận xét của bạn.'); return; }
    try {
      setSending(true);
      await api.createProductReview(idOf(product), {
        userId: user.id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviewComment('');
      await loadReviews();
      Alert.alert('Đã gửi', 'Cảm ơn bạn đã đánh giá sản phẩm.');
    } catch (e) {
      Alert.alert('Chưa gửi được', e?.message || 'Hãy thử lại sau.');
    } finally {
      setSending(false);
    }
  }

  function requireOptions() {
    if (sizes.length && !selectedSize) { Alert.alert('Chưa chọn size', 'Vui lòng chọn size.'); return false; }
    if (colors.length && !selectedColor) { Alert.alert('Chưa chọn màu', 'Vui lòng chọn màu sắc.'); return false; }
    return true;
  }

  function buildCartItem() {
    return {
      ...product,
      price: unitPrice,
      image: activeImg || firstImage(product),
      selectedSize,
      selectedColor,
      variantId: String(selectedVariant?.id || selectedVariant?._id || selectedVariant?.variantId || ''),
    };
  }

  function onAddToCart() {
    if (!requireOptions()) return;
    addToCart(buildCartItem(), Math.max(1, qty));
  }

  function onBuyNow() {
    if (!requireOptions()) return;
    if (addToCart(buildCartItem(), Math.max(1, qty))) router.push('/checkout');
  }

  function onTryOn() {
    router.push({
      pathname: '/thu-do-ai-v49-shop-flow',
      params: {
        id: idOf(product),
        product: encodeURIComponent(JSON.stringify(product || {})),
        selectedSize,
        selectedColor,
      },
    });
  }

  function onView3D() {
    router.push({
      pathname: '/thu-do-3d',
      params: {
        id: idOf(product),
        product: encodeURIComponent(JSON.stringify(product || {})),
        selectedSize,
        selectedColor,
      },
    });
  }

  const liked = wishlist.some((p) => idOf(p) === idOf(product));

  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
        <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 18) }}>Không tìm thấy sản phẩm</Text>
        <AppButton title="Quay lại cửa hàng" icon="arrow-left" full={false} onPress={() => router.replace('/(tabs)/shop')} />
      </View>
    );
  }

  const imgs = gallery(product);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Pressable onPress={() => (router.canGoBack?.() ? router.back() : router.replace('/(tabs)/shop'))} style={{ width: 42, height: 42, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>
        <Text numberOfLines={1} style={{ flex: 1, color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 17) }}>Chi tiết sản phẩm</Text>
        <Pressable onPress={() => toggleWishlist(product)} style={{ width: 42, height: 42, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="heart" size={20} color={liked ? theme.primary : theme.muted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 150, gap: 14 }}>
        <View style={[{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, height: 380, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }]}>
          <SafeImage source={{ uri: activeImg || firstImage(product) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          {hasDiscount ? (
            <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: theme.primary, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: onPrimary(theme), fontWeight: '900', fontSize: 11 }}>GIẢM {Math.round((1 - unitPrice / oldPrice) * 100)}%</Text>
            </View>
          ) : null}
        </View>

        {imgs.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {imgs.map((u) => (
              <Pressable key={u} onPress={() => setActiveImg(u)} style={{ width: 70, height: 70, borderWidth: activeImg === u ? 2 : 1, borderColor: activeImg === u ? theme.primary : theme.border, backgroundColor: theme.card }}>
                <SafeImage source={{ uri: u }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={[cardStyle(theme), { padding: 14, gap: 8 }]}>
          <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 22) }}>{product.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Text style={{ color: theme.primary, fontWeight: '900', fontSize: scaleFont(theme, 22) }}>{formatCurrency(unitPrice)}</Text>
            {hasDiscount ? <Text style={{ color: theme.muted, textDecorationLine: 'line-through', fontSize: scaleFont(theme, 15) }}>{formatCurrency(oldPrice)}</Text> : null}
          </View>
          <Text style={{ color: theme.muted, fontSize: scaleFont(theme, 13) }}>Kho: {stock > 0 ? `còn ${stock} sản phẩm` : 'tạm hết hàng'}{reviewStats.count ? ` • ★ ${reviewStats.averageRating.toFixed(1)} (${reviewStats.count} đánh giá)` : ''}</Text>
        </View>

        {colors.length ? (
          <View style={[cardStyle(theme), { padding: 14, gap: 10 }]}>
            <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 15) }}>Màu sắc</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {colors.map((c) => (
                <Pressable key={c} onPress={() => setSelectedColor(c)} style={pill(theme, selectedColor === c)}>
                  <Text style={pillText(theme, selectedColor === c)}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {sizes.length ? (
          <View style={[cardStyle(theme), { padding: 14, gap: 10 }]}>
            <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 15) }}>Kích cỡ</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {sizes.map((sz) => (
                <Pressable key={sz} onPress={() => setSelectedSize(sz)} style={pill(theme, selectedSize === sz)}>
                  <Text style={pillText(theme, selectedSize === sz)}>{sz}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={[cardStyle(theme), { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 15) }}>Số lượng</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0, borderWidth: 1, borderColor: theme.border }}>
            <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Feather name="minus" size={18} color={theme.text} /></Pressable>
            <Text style={{ width: 48, textAlign: 'center', color: theme.heading, fontWeight: '900', fontSize: scaleFont(theme, 16) }}>{qty}</Text>
            <Pressable onPress={() => setQty((q) => Math.min(stock || 99, q + 1))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Feather name="plus" size={18} color={theme.text} /></Pressable>
          </View>
        </View>

        {product.story ? (
          <View style={[cardStyle(theme), { padding: 14, gap: 6 }]}>
            <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 15) }}>Câu chuyện sản phẩm</Text>
            <Text style={{ color: theme.text, lineHeight: 21, fontSize: scaleFont(theme, 14) }}>{product.story}</Text>
          </View>
        ) : null}

        <View style={[cardStyle(theme), { padding: 14, gap: 6 }]}>
          <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 15) }}>Mô tả</Text>
          <Text style={{ color: theme.text, lineHeight: 21, fontSize: scaleFont(theme, 14) }}>{product.description || 'Chưa có mô tả cho sản phẩm này.'}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><AppButton title="Thử đồ AI (ảnh)" icon="camera" variant="outline" onPress={onTryOn} /></View>
          <View style={{ flex: 1 }}><AppButton title="Xem 3D" icon="box" variant="outline" onPress={onView3D} /></View>
        </View>

        {/* ---- Sản phẩm liên quan (gợi ý ML) ---- */}
        {related.length ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 16) }}>Có thể bạn cũng thích</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {related.map((rp) => {
                const ri = idOf(rp);
                return (
                  <Pressable key={ri} onPress={() => router.push(`/product/${ri}`)} style={[cardStyle(theme), { width: 150, overflow: 'hidden' }]}>
                    <SafeImage source={{ uri: firstImage(rp) }} style={{ width: '100%', height: 150, backgroundColor: theme.background }} resizeMode="cover" />
                    <View style={{ padding: 8, gap: 3 }}>
                      <Text numberOfLines={2} style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 12), minHeight: 32 }}>{rp.name}</Text>
                      <Text style={{ color: theme.primary, fontWeight: '900', fontSize: scaleFont(theme, 13) }}>{formatCurrency(Number(rp.price || 0))}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* ---- Đánh giá ---- */}
        <View style={[cardStyle(theme), { padding: 14, gap: 12 }]}>
          <Text style={{ color: theme.heading, fontFamily: fontFamily(theme), fontWeight: '900', fontSize: scaleFont(theme, 16) }}>
            Đánh giá {reviewStats.count ? `(★ ${reviewStats.averageRating.toFixed(1)} • ${reviewStats.count})` : ''}
          </Text>

          {reviews.length ? reviews.slice(0, 10).map((r, i) => (
            <View key={r._id || r.id || i} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border, paddingTop: i === 0 ? 0 : 10, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: theme.heading, fontWeight: '900', fontSize: scaleFont(theme, 13) }}>{r.userName || r.name || 'Khách hàng'}</Text>
                <Text style={{ color: theme.accent, fontWeight: '900' }}>{'★'.repeat(Math.max(1, Math.min(5, Number(r.rating || 5))))}</Text>
              </View>
              <Text style={{ color: theme.text, fontSize: scaleFont(theme, 13), lineHeight: 19 }}>{r.comment || r.content}</Text>
            </View>
          )) : <Text style={{ color: theme.muted, fontSize: scaleFont(theme, 13) }}>Chưa có đánh giá. Hãy là người đầu tiên đánh giá sau khi mua hàng.</Text>}

          {canReview ? (
            <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setReviewRating(n)}>
                    <Feather name="star" size={26} color={n <= reviewRating ? theme.accent : theme.border} />
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={reviewComment}
                onChangeText={setReviewComment}
                placeholder="Nhận xét của bạn về sản phẩm..."
                placeholderTextColor={theme.muted}
                multiline
                style={[inputStyle(theme), { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }]}
              />
              <AppButton title="Gửi đánh giá" icon="send" loading={sending} onPress={submitReview} />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Thanh mua cố định: CHỈ ở trang chi tiết mới mua được */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 12, paddingBottom: 26, backgroundColor: theme.card, borderTopWidth: 1, borderTopColor: theme.border }}>
        <View style={{ flex: 1 }}>
          <AppButton title="Thêm vào giỏ" icon="shopping-bag" variant="outline" onPress={onAddToCart} />
        </View>
        <View style={{ flex: 1 }}>
          <AppButton title="Mua ngay" icon="credit-card" onPress={onBuyNow} />
        </View>
      </View>
    </View>
  );
}
