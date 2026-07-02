// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import {
  V49_FALLBACK_PRODUCTS,
  V49_SIZE_CHART,
  v49FirstImage,
  v49Get,
  v49Money,
  v49Post,
  v49ProductId,
  v49RecommendSize,
} from '../lib/japanoV49ShopApi';

const STAR_LIST = [1, 2, 3, 4, 5];

export default function ProductDetailV49ShopeeScreen() {
  const router = useRouter?.();
  const params = useLocalSearchParams?.() || {};
  const { user, addToCart } = useApp?.() || {};
  const productId = String(params.productId || params.id || params._id || params.sku || '');
  const productJson = String(params.product || '');
  const reviewFocus = String(params.review || '') === '1';

  const [product, setProduct] = useState<any | null>(null);
  const [activeImg, setActiveImg] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quiz, setQuiz] = useState({ height: '', weight: '', bust: '', waist: '', hip: '' });
  const [recommendedSize, setRecommendedSize] = useState('');

  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewStats, setReviewStats] = useState({ averageRating: 0, count: 0 });
  const [eligibility, setEligibility] = useState<any>({ canReview: false, reason: 'Đăng nhập và mua hàng thành công để đánh giá.' });
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  const currentUserId = String(user?.id || user?._id || '');

  async function loadProduct() {
    let fromParam = null;
    if (productJson) {
      try { fromParam = JSON.parse(decodeURIComponent(productJson)); } catch {}
    }
    if (fromParam) {
      setProduct(fromParam);
      setActiveImg(v49FirstImage(fromParam));
      return;
    }

    const data = await v49Get(`/api/v49/shop/product/${encodeURIComponent(productId)}`, {
      ok: false,
      item: V49_FALLBACK_PRODUCTS[0],
      offline: true,
    });
    const item = data.item || V49_FALLBACK_PRODUCTS[0];
    setProduct(item);
    setActiveImg(v49FirstImage(item));
  }

  async function loadReviews(item = product) {
    const pid = v49ProductId(item || { id: productId });
    if (!pid) return;
    const data = await v49Get(`/api/products/${encodeURIComponent(pid)}/reviews?userId=${encodeURIComponent(currentUserId)}`, {
      ok: true,
      averageRating: 4.8,
      count: 5,
      reviews: [],
      eligibility: { canReview: false, reason: 'Chỉ khách đã mua hàng thành công mới được đánh giá.' },
    });
    setReviews(Array.isArray(data?.reviews) ? data.reviews : []);
    setReviewStats({ averageRating: Number(data?.averageRating || 0), count: Number(data?.count || 0) });
    setEligibility(data?.eligibility || { canReview: false, reason: 'Chỉ khách đã mua hàng thành công mới được đánh giá.' });
  }

  useEffect(() => { loadProduct(); }, [productId]);
  useEffect(() => { if (product) loadReviews(product); }, [product, currentUserId]);

  const images = useMemo(() => {
    const arr = product?.images?.length ? product.images : [v49FirstImage(product)];
    return arr.filter(Boolean);
  }, [product]);

  const sizes = Array.from(new Set([...(product?.sizes || []), 'S', 'M', 'L', 'XL', '2XL', '3XL']));
  const colors = product?.colors?.length ? product.colors : ['Mặc định'];

  function updateQuiz(key: string, value: string) {
    const next = { ...quiz, [key]: value };
    setQuiz(next);
    const rec = v49RecommendSize(next);
    setRecommendedSize(rec);
    if (!selectedSize) setSelectedSize(rec);
  }

  function goTryOn() {
    if (!product) return;
    router?.push?.({
      pathname: '/thu-do-ai-v49-shop-flow',
      params: {
        productId: v49ProductId(product),
        product: encodeURIComponent(JSON.stringify(product)),
      },
    });
  }

  function addCart() {
    if (!product) return;
    const nextItem = {
      ...product,
      id: v49ProductId(product),
      qty: 1,
      selectedSize: selectedSize || recommendedSize || '',
      selectedColor: selectedColor || '',
    };
    try { addToCart?.(nextItem); } catch {}
    Alert.alert('Đã thêm vào giỏ', `${product?.name || 'Sản phẩm'} - Size ${selectedSize || recommendedSize || 'chưa chọn'}`);
  }

  function buyNow() {
    addCart();
    router?.push?.('/checkout');
  }

  async function submitReview() {
    if (!product) return;
    if (!currentUserId) return Alert.alert('Cần đăng nhập', 'Bạn cần đăng nhập trước khi đánh giá.');
    if (!eligibility?.canReview) return Alert.alert('Chưa đủ điều kiện', eligibility?.reason || 'Chỉ khách đã mua hàng thành công mới được đánh giá.');
    if (!reviewComment.trim() || reviewComment.trim().length < 3) return Alert.alert('Thiếu nội dung', 'Nhập nhận xét rõ hơn một chút.');

    try {
      setReviewLoading(true);
      const pid = v49ProductId(product);
      const data = await v49Post(`/api/products/${encodeURIComponent(pid)}/reviews`, {
        userId: currentUserId,
        userName: user?.name || user?.fullName || 'Khách JAPANO',
        rating: reviewRating,
        comment: reviewComment.trim(),
        orderId: eligibility?.orderId,
        orderItemId: eligibility?.orderItemId,
      }, null);
      if (data?.ok === false) throw new Error(data?.message || 'Không gửi được đánh giá.');
      setReviewComment('');
      Alert.alert('Đã gửi đánh giá', data?.message || 'Cảm ơn bạn đã đánh giá sản phẩm.');
      await loadReviews(product);
    } catch (e: any) {
      Alert.alert('Không gửi được đánh giá', e?.message || 'Kiểm tra backend hoặc trạng thái đơn hàng.');
    } finally {
      setReviewLoading(false);
    }
  }

  if (!product) {
    return <View style={s.center}><Text>Đang tải sản phẩm...</Text></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff7fb' }}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.topbar}>
          <TouchableOpacity style={s.backBtn} onPress={() => router?.back?.()}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <Text style={s.topTitle}>Chi tiết sản phẩm</Text>
          <TouchableOpacity style={s.iconBtn}>
            <Text style={s.iconText}>♡</Text>
          </TouchableOpacity>
        </View>

        <Image source={{ uri: activeImg || 'https://placehold.co/800x1000/fdf2f8/be185d?text=JAPANO' }} style={s.heroImg} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {images.map((img, i) => (
            <TouchableOpacity key={`${img}-${i}`} onPress={() => setActiveImg(img)} style={[s.thumbWrap, activeImg === img && s.thumbActive]}>
              <Image source={{ uri: img }} style={s.thumb} />
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.card}>
          <Text style={s.name}>{product.name}</Text>
          <View style={s.priceRow}>
            <Text style={s.price}>{v49Money(product.price)}</Text>
            {product.originalPrice ? <Text style={s.oldPrice}>{v49Money(product.originalPrice)}</Text> : null}
            {product.discountPercent ? <Text style={s.sale}>-{product.discountPercent}%</Text> : null}
          </View>
          <View style={s.ratingLine}>
            <Text style={s.starText}>★ {reviewStats.averageRating || '4.8'}</Text>
            <Text style={s.note}>{reviewStats.count || reviews.length} đánh giá • Có review ảo + review thật đã mua hàng</Text>
          </View>
          <Text style={s.note}>{product.description || 'Sản phẩm JAPANO. Có thể dùng thử đồ AI bằng ảnh đầu tiên của sản phẩm.'}</Text>
        </View>

        <View style={s.card}>
          <Text style={s.section}>Màu sắc</Text>
          <View style={s.pillWrap}>
            {colors.map((c) => (
              <TouchableOpacity key={c} style={[s.pill, selectedColor === c && s.pillSelected]} onPress={() => setSelectedColor(c)}>
                <Text style={[s.pillText, selectedColor === c && s.pillTextSelected]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.section}>Size</Text>
          <View style={s.pillWrap}>
            {sizes.map((size) => (
              <TouchableOpacity key={size} style={[s.pill, selectedSize === size && s.pillSelected]} onPress={() => setSelectedSize(size)}>
                <Text style={[s.pillText, selectedSize === size && s.pillTextSelected]}>{size}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.section}>Quiz gợi ý size</Text>
          <Text style={s.note}>Nhập số đo để chương trình gợi ý size phù hợp. Gợi ý này dùng lại khi thử đồ.</Text>
          <View style={s.grid2}>
            <TextInput style={s.input} keyboardType="numeric" placeholder="Cao cm" value={quiz.height} onChangeText={(v) => updateQuiz('height', v)} />
            <TextInput style={s.input} keyboardType="numeric" placeholder="Nặng kg" value={quiz.weight} onChangeText={(v) => updateQuiz('weight', v)} />
            <TextInput style={s.input} keyboardType="numeric" placeholder="Ngực cm" value={quiz.bust} onChangeText={(v) => updateQuiz('bust', v)} />
            <TextInput style={s.input} keyboardType="numeric" placeholder="Eo cm" value={quiz.waist} onChangeText={(v) => updateQuiz('waist', v)} />
            <TextInput style={s.input} keyboardType="numeric" placeholder="Hông cm" value={quiz.hip} onChangeText={(v) => updateQuiz('hip', v)} />
          </View>
          <View style={s.recommendBox}>
            <Text style={s.recommendTitle}>Size gợi ý: {recommendedSize || v49RecommendSize(quiz)}</Text>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.section}>Bảng kích thước</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={[s.tableRow, s.tableHead]}>
                <Text style={s.cell}>Size</Text><Text style={s.cell}>Cao</Text><Text style={s.cell}>Nặng</Text><Text style={s.cell}>Ngực</Text><Text style={s.cell}>Eo</Text><Text style={s.cell}>Hông</Text>
              </View>
              {V49_SIZE_CHART.map((r) => (
                <View key={r.size} style={s.tableRow}>
                  <Text style={s.cell}>{r.size}</Text><Text style={s.cell}>{r.height}</Text><Text style={s.cell}>{r.weight}</Text><Text style={s.cell}>{r.bust}</Text><Text style={s.cell}>{r.waist}</Text><Text style={s.cell}>{r.hip}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={[s.card, reviewFocus && s.reviewFocus]}>
          <View style={s.reviewHeader}>
            <Text style={s.section}>Đánh giá sản phẩm</Text>
            <Text style={s.starText}>★ {reviewStats.averageRating || '4.8'}/5</Text>
          </View>

          <View style={s.reviewGate}>
            <Text style={s.reviewGateTitle}>{eligibility?.canReview ? 'Bạn đã mua hàng thành công, có thể review.' : 'Chỉ khách đã mua hàng thành công mới được review.'}</Text>
            <Text style={s.note}>{eligibility?.reason || 'Nếu vừa mua COD, admin cần xác nhận đơn thành công trước.'}</Text>
          </View>

          {eligibility?.canReview ? (
            <View style={s.reviewForm}>
              <Text style={s.sectionSmall}>Chọn sao</Text>
              <View style={s.starRow}>
                {STAR_LIST.map((n) => (
                  <TouchableOpacity key={n} onPress={() => setReviewRating(n)}>
                    <Text style={[s.bigStar, n <= reviewRating ? s.bigStarOn : null]}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[s.input, s.reviewInput]}
                placeholder="Viết cảm nhận sau khi mua hàng..."
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
              />
              <TouchableOpacity disabled={reviewLoading} style={[s.submitReviewBtn, reviewLoading && { opacity: 0.6 }]} onPress={submitReview}>
                <Text style={s.submitReviewText}>{reviewLoading ? 'Đang gửi...' : 'Gửi đánh giá'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={s.reviewList}>
            {reviews.length ? reviews.map((r, index) => (
              <View key={String(r.id || r._id || index)} style={s.reviewItem}>
                <View style={s.avatarCircle}>
                  {r.userAvatar ? <Image source={{ uri: r.userAvatar }} style={s.avatarImg} /> : <Text style={s.avatarText}>{String(r.userName || 'K').slice(0, 1)}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.reviewNameRow}>
                    <Text style={s.reviewName}>{r.userName || 'Khách JAPANO'}</Text>
                    <Text style={s.reviewStars}>{'★'.repeat(Math.max(1, Math.min(5, Number(r.rating || 5))))}</Text>
                  </View>
                  <Text style={s.reviewComment}>{r.comment}</Text>
                  <Text style={s.reviewMeta}>{r.verifiedPurchase ? 'Đã mua hàng' : 'Đánh giá'}{r.isFake ? ' • Review mẫu' : ' • Review thật'}</Text>
                </View>
              </View>
            )) : <Text style={s.note}>Chưa có đánh giá.</Text>}
          </View>
        </View>

        <View style={{ height: 96 }} />
      </ScrollView>

      <View style={s.bottomBar}>
        <TouchableOpacity style={s.cartBtn} onPress={addCart}>
          <Text style={s.cartText}>Thêm giỏ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tryBtn} onPress={goTryOn}>
          <Text style={s.tryText}>Thử đồ AI</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.buyBtn} onPress={buyNow}>
          <Text style={s.buyText}>Mua ngay</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { padding: 14, gap: 12, backgroundColor: '#fff7fb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  backBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#fbcfe8' },
  backText: { fontSize: 24, color: '#9d174d', fontWeight: '900' },
  topTitle: { fontSize: 17, fontWeight: '900', color: '#831843' },
  iconBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#fbcfe8' },
  iconText: { fontSize: 22, color: '#be185d', fontWeight: '900' },
  heroImg: { width: '100%', height: 430, borderRadius: 24, backgroundColor: '#f3f4f6' },
  thumbWrap: { width: 78, height: 94, borderRadius: 14, borderWidth: 1, borderColor: '#fce7f3', padding: 3, backgroundColor: '#fff' },
  thumbActive: { borderColor: '#ec4899', borderWidth: 3 },
  thumb: { width: '100%', height: '100%', borderRadius: 10 },
  card: { backgroundColor: 'white', borderRadius: 22, padding: 14, borderWidth: 1, borderColor: '#fbcfe8', gap: 10 },
  name: { fontSize: 22, fontWeight: '900', color: '#111827' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  price: { color: '#be185d', fontWeight: '900', fontSize: 24 },
  oldPrice: { color: '#9ca3af', textDecorationLine: 'line-through' },
  sale: { backgroundColor: '#fce7f3', color: '#be185d', fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  note: { color: '#374151', lineHeight: 20 },
  section: { fontSize: 18, fontWeight: '900', color: '#9d174d' },
  sectionSmall: { fontSize: 14, fontWeight: '900', color: '#9d174d' },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderColor: '#f9a8d4', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: '#fff' },
  pillSelected: { backgroundColor: '#ec4899', borderColor: '#ec4899' },
  pillText: { color: '#831843', fontWeight: '900' },
  pillTextSelected: { color: '#fff' },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderWidth: 1, borderColor: '#f9a8d4', borderRadius: 14, padding: 12, backgroundColor: '#fff', minWidth: '47%', flexGrow: 1 },
  recommendBox: { backgroundColor: '#fdf2f8', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#fbcfe8' },
  recommendTitle: { color: '#be185d', fontWeight: '900', fontSize: 16 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#fce7f3' },
  tableHead: { backgroundColor: '#fdf2f8' },
  cell: { width: 92, padding: 8, color: '#374151', fontWeight: '700' },
  ratingLine: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  starText: { color: '#f59e0b', fontWeight: '900' },
  reviewFocus: { borderColor: '#ec4899', borderWidth: 2 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reviewGate: { backgroundColor: '#fdf2f8', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#fbcfe8', gap: 4 },
  reviewGateTitle: { color: '#be185d', fontWeight: '900' },
  reviewForm: { gap: 10 },
  starRow: { flexDirection: 'row', gap: 6 },
  bigStar: { fontSize: 30, color: '#d1d5db', fontWeight: '900' },
  bigStarOn: { color: '#f59e0b' },
  reviewInput: { minHeight: 90, textAlignVertical: 'top' },
  submitReviewBtn: { backgroundColor: '#ec4899', borderRadius: 16, padding: 14, alignItems: 'center' },
  submitReviewText: { color: '#fff', fontWeight: '900' },
  reviewList: { gap: 12 },
  reviewItem: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#fce7f3' },
  avatarCircle: { width: 42, height: 42, borderRadius: 999, backgroundColor: '#fdf2f8', borderWidth: 1, borderColor: '#fbcfe8', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: '#be185d', fontWeight: '900' },
  reviewNameRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  reviewName: { color: '#111827', fontWeight: '900' },
  reviewStars: { color: '#f59e0b', fontWeight: '900' },
  reviewComment: { color: '#374151', lineHeight: 20, marginTop: 3 },
  reviewMeta: { color: '#9ca3af', fontSize: 12, fontWeight: '800', marginTop: 4 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#fbcfe8' },
  cartBtn: { flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#ec4899', alignItems: 'center', backgroundColor: '#fff' },
  cartText: { color: '#be185d', fontWeight: '900' },
  tryBtn: { flex: 1, padding: 14, borderRadius: 16, alignItems: 'center', backgroundColor: '#111827' },
  tryText: { color: '#fff', fontWeight: '900' },
  buyBtn: { flex: 1, padding: 14, borderRadius: 16, alignItems: 'center', backgroundColor: '#ec4899' },
  buyText: { color: '#fff', fontWeight: '900' },
});
