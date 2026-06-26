import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { goBackOrReplace } from "../lib/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { fontFamily, radius, scaleFont, shadow } from "../lib/styles";
import { SafeImage } from "../components/SafeImage";
import { StableTextInput } from "../components/StableTextInput";

type Step = "address" | "shipping" | "payment" | "review";

type ShippingMethod = {
  id: string;
  name: string;
  eta: string;
  date: string;
  fee: number;
  badge: string;
  desc: string;
};

type PaymentMethod = {
  id: string;
  name: string;
  desc: string;
  icon: keyof typeof Feather.glyphMap;
};

const IS_WEB = Platform.OS === "web";

const steps: Array<{
  id: Step;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}> = [
  { id: "address", label: "Địa chỉ", icon: "map-pin" },
  { id: "shipping", label: "Giao hàng", icon: "truck" },
  { id: "payment", label: "Thanh toán", icon: "credit-card" },
  { id: "review", label: "Xác nhận", icon: "check-circle" },
];

function formatDatePlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

const shippingMethods: ShippingMethod[] = [
  {
    id: "standard",
    name: "Tiêu chuẩn",
    eta: "2-4 ngày",
    date: `${formatDatePlus(2)} - ${formatDatePlus(4)}`,
    fee: 28000,
    badge: "Tiết kiệm",
    desc: "Phù hợp đơn thông thường, vẫn có tracking.",
  },
  {
    id: "fast",
    name: "Nhanh",
    eta: "1-2 ngày",
    date: `${formatDatePlus(1)} - ${formatDatePlus(2)}`,
    fee: 45000,
    badge: "Nhanh nhất",
    desc: "Ưu tiên xử lý và giao sớm.",
  },
  {
    id: "gift",
    name: "Gói quà + hẹn giờ",
    eta: "2-5 ngày",
    date: `${formatDatePlus(2)} - ${formatDatePlus(5)}`,
    fee: 69000,
    badge: "Quà tặng",
    desc: "Gói quà, thiệp nhỏ, có thể ghi chú lời chúc.",
  },
];

const paymentMethods: PaymentMethod[] = [
  {
    id: "Stripe",
    name: "Thanh toán Stripe",
    desc: IS_WEB ? "Stripe PaymentSheet chỉ hỗ trợ Android/iOS; web admin nên dùng COD." : "Mở PaymentSheet để thanh toán thẻ bằng @stripe/stripe-react-native.",
    icon: "credit-card",
  },
  {
    id: "COD",
    name: "Thanh toán khi nhận hàng",
    desc: "Chỉ dùng khi muốn đặt hàng COD, không mở Stripe.",
    icon: "package",
  },
];

export default function CheckoutScreen() {
  const {
    theme,
    cart,
    user,
    formatCurrency,
    checkout,
    payStripeCheckout,
    requireLogin,
    updateProfile,
  } = useApp();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("address");
  const [fullName, setFullName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");
  const [city, setCity] = useState("");
  const [ward, setWard] = useState("");
  const [note, setNote] = useState("");
  const [promo, setPromo] = useState("");
  const [giftWrap, setGiftWrap] = useState(false);
  const [shipping, setShipping] = useState<ShippingMethod>(shippingMethods[0]);
  const [payment, setPayment] = useState<PaymentMethod>(IS_WEB ? paymentMethods[1] : paymentMethods[0]);
  const [submitting, setSubmitting] = useState(false);
  const [stripeOpening, setStripeOpening] = useState(false);
  const [stripePaymentIntentId, setStripePaymentIntentId] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + item.price, 0);
  const autoDiscount = subtotal >= 1500000 ? 80000 : 0;
  const promoDiscount = promo.trim().toUpperCase() === "JAPANO" ? 50000 : 0;
  const giftFee = giftWrap ? 25000 : 0;
  const total = Math.max(
    0,
    subtotal + shipping.fee + giftFee - autoDiscount - promoDiscount,
  );
  const stepIndex = steps.findIndex((item) => item.id === step);
  const missingAddress = !fullName.trim() || !phone.trim() || !address.trim();

  const canContinue = useMemo(() => {
    if (step === "address") return !missingAddress;
    if (step === "payment") return Boolean(payment?.id);
    return true;
  }, [step, missingAddress, payment?.id]);

  const checkoutMeta = () => ({
    customer: { fullName, phone, address, ward, city },
    shipping,
    payment,
    promo,
    giftWrap,
    giftFee,
    note,
    totals: {
      subtotal,
      shippingFee: shipping.fee,
      giftFee,
      autoDiscount,
      promoDiscount,
      total,
    },
  });

  const shippingAddressText = () => [address, ward, city].filter(Boolean).join(", " );

  const openStripeCardNow = async (paymentId = payment.id) => {
    if (paymentId === "COD") return true;
    if (stripePaymentIntentId) return true;
    if (!requireLogin()) return false;
    if (!cart.length) {
      Alert.alert("Giỏ hàng trống", "Bạn cần thêm sản phẩm trước khi thanh toán.");
      return false;
    }
    setStripeOpening(true);
    try {
      const paid = await payStripeCheckout({
        total,
        shippingAddress: shippingAddressText(),
        paymentMethod: paymentId,
        checkoutMeta: checkoutMeta(),
      });
      if (paid?.paymentIntentId) {
        setStripePaymentIntentId(paid.paymentIntentId);
        Alert.alert("Đã nhập thẻ thành công", "Stripe đã xác nhận thanh toán. Bấm Đặt hàng để lưu đơn vào MongoDB.");
        return true;
      }
      return false;
    } catch (e: any) {
      Alert.alert("Chưa thanh toán được Stripe", e?.message || "Kiểm tra backend Stripe và thử lại.");
      return false;
    } finally {
      setStripeOpening(false);
    }
  };

  const selectPayment = async (item: PaymentMethod) => {
    setPayment(item);
    if (item.id === "COD") {
      setStripePaymentIntentId('');
      return;
    }
    await openStripeCardNow(item.id);
  };

  const goNext = async () => {
    if (!requireLogin()) return;
    if (!cart.length)
      return Alert.alert(
        "Giỏ hàng trống",
        "Bạn cần thêm sản phẩm trước khi thanh toán.",
      );
    if (!canContinue)
      return Alert.alert(
        "Thiếu thông tin",
        "Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ nhận hàng.",
      );

    if (step === "address") {
      await updateProfile({ name: fullName, phone, address });
      setStep("shipping");
      return;
    }
    if (step === "shipping") return setStep("payment");
    if (step === "payment") {
      if (payment.id !== "COD") {
        const paid = await openStripeCardNow();
        if (!paid) return;
      }
      return setStep("review");
    }

    try {
      setSubmitting(true);
      const shippingAddress = shippingAddressText();
      await checkout(payment.id, {
        total,
        shippingAddress,
        status: payment.id === "COD" ? "pending_cod" : "paid",
        paymentMethod: payment.id,
        stripePaymentIntentId: payment.id === "COD" ? undefined : stripePaymentIntentId,
        checkoutMeta: checkoutMeta(),
      } as any);
      Alert.alert(
        "Đặt hàng thành công",
        payment.id === 'COD' ? 'Đơn COD đã lưu vào MongoDB.' : 'Thanh toán Stripe thành công. Đơn hàng đã lưu vào MongoDB.',
        [
          {
            text: "Tiếp tục mua",
            onPress: () => router.replace("/(tabs)/shop"),
          },
          {
            text: "Xem lịch sử",
            onPress: () => router.replace("/(tabs)/profile"),
          },
        ],
      );
    } catch (e: any) {
      Alert.alert(
        "Không đặt hàng được",
        e?.message || "Kiểm tra backend hoặc MongoDB.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const goPrev = () => {
    if (step === "address") return goBackOrReplace("/cart");
    const prev = steps[Math.max(0, stepIndex - 1)]?.id || "address";
    setStep(prev);
  };

  const renderStep = () => {
    if (step === "address") {
      return (
        <View style={styles.sectionGap}>
          <Text
            style={[
              styles.stepTitle,
              { color: theme.heading, fontFamily: fontFamily(theme) },
            ]}
          >
            Thông tin nhận hàng
          </Text>
          <Text style={[styles.stepHint, { color: theme.muted }]}>
            Dùng ít trường, nhãn rõ ràng và lưu lại cho lần mua sau.
          </Text>
          <Field
            label="Họ tên người nhận"
            value={fullName}
            setValue={setFullName}
            icon="user"
          />
          <Field
            label="Số điện thoại"
            value={phone}
            setValue={setPhone}
            icon="phone"
            keyboardType="phone-pad"
          />
          <Field
            label="Địa chỉ cụ thể"
            value={address}
            setValue={setAddress}
            icon="home"
          />
          <View style={styles.twoCols}>
            <Field
              label="Phường/xã"
              value={ward}
              setValue={setWard}
              icon="map"
              compact
            />
            <Field
              label="Tỉnh/thành"
              value={city}
              setValue={setCity}
              icon="navigation"
              compact
            />
          </View>
          <Field
            label="Ghi chú giao hàng"
            value={note}
            setValue={setNote}
            icon="edit-3"
            multiline
          />
        </View>
      );
    }

    if (step === "shipping") {
      return (
        <View style={styles.sectionGap}>
          <Text
            style={[
              styles.stepTitle,
              { color: theme.heading, fontFamily: fontFamily(theme) },
            ]}
          >
            Chọn phương thức giao hàng
          </Text>
          <Text style={[styles.stepHint, { color: theme.muted }]}>
            Hiển thị ngày dự kiến rõ ràng để giảm do dự trước khi thanh toán.
          </Text>
          {shippingMethods.map((item) => {
            const active = item.id === shipping.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setShipping(item)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: active ? theme.primary : theme.card,
                    borderColor: active ? theme.primary : theme.border,
                  },
                  shadow(theme),
                ]}
              >
                <View style={styles.optionIcon}>
                  <Feather
                    name="truck"
                    size={20}
                    color={active ? theme.background : theme.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.optionTitleRow}>
                    <Text
                      style={[
                        styles.optionTitle,
                        { color: active ? theme.background : theme.heading },
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.optionBadge,
                        { color: active ? theme.background : theme.primary },
                      ]}
                    >
                      {item.badge}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.optionDesc,
                      { color: active ? theme.background : theme.muted },
                    ]}
                  >
                    {item.desc}
                  </Text>
                  <Text
                    style={[
                      styles.optionDesc,
                      { color: active ? theme.background : theme.text },
                    ]}
                  >
                    Dự kiến: {item.date}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.optionPrice,
                    { color: active ? theme.background : theme.heading },
                  ]}
                >
                  {formatCurrency(item.fee)}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setGiftWrap((v) => !v)}
            style={[
              styles.giftCard,
              {
                backgroundColor: theme.card,
                borderColor: giftWrap ? theme.primary : theme.border,
              },
            ]}
          >
            <Feather
              name={giftWrap ? "check-circle" : "gift"}
              size={20}
              color={theme.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: theme.heading }]}>
                Gói quà JAPANO
              </Text>
              <Text style={[styles.optionDesc, { color: theme.muted }]}>
                Thêm giấy gói, thiệp nhỏ và sticker phong cách Nhật cổ.
              </Text>
            </View>
            <Text style={[styles.optionPrice, { color: theme.primary }]}>
              {formatCurrency(giftFee || 25000)}
            </Text>
          </Pressable>
        </View>
      );
    }

    if (step === "payment") {
      return (
        <View style={styles.sectionGap}>
          <Text
            style={[
              styles.stepTitle,
              { color: theme.heading, fontFamily: fontFamily(theme) },
            ]}
          >
            Thanh toán
          </Text>
          <Text style={[styles.stepHint, { color: theme.muted }]}>
            {IS_WEB ? "Web admin không mở được Stripe native; chọn COD để test đặt hàng." : "Chọn Stripe là thẻ nhập hiện liền. COD không mở Stripe."}
          </Text>
          {paymentMethods.map((item) => {
            const active = item.id === payment.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => selectPayment(item)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: active ? theme.primary : theme.card,
                    borderColor: active ? theme.primary : theme.border,
                  },
                  shadow(theme),
                ]}
              >
                <Feather
                  name={item.icon}
                  size={22}
                  color={active ? theme.background : theme.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.optionTitle,
                      { color: active ? theme.background : theme.heading },
                    ]}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      styles.optionDesc,
                      { color: active ? theme.background : theme.muted },
                    ]}
                  >
                    {item.desc}
                  </Text>
                </View>
                {active ? (
                  <Feather name="check" size={22} color={theme.background} />
                ) : null}
              </Pressable>
            );
          })}
          {payment.id !== "COD" ? (
            <View style={[styles.stripeBox, { backgroundColor: theme.card, borderColor: stripePaymentIntentId ? theme.primary : theme.border }]}> 
              <Feather name={stripePaymentIntentId ? "check-circle" : "credit-card"} size={18} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: theme.heading }]}>Thẻ Stripe</Text>
                <Text style={[styles.optionDesc, { color: theme.muted }]}> 
                  {stripePaymentIntentId
                    ? "Đã nhập và xác nhận thẻ. Qua bước xác nhận để lưu đơn."
                    : stripeOpening
                      ? "Đang mở form nhập thẻ..."
                      : "Bấm vào Stripe hoặc Tiếp tục để mở form nhập thẻ ngay."}
                </Text>
              </View>
              <Pressable disabled={stripeOpening} onPress={() => openStripeCardNow()} style={[styles.miniPayBtn, { backgroundColor: theme.primary, opacity: stripeOpening ? 0.65 : 1 }]}> 
                <Text style={[styles.miniPayText, { color: theme.background }]}>{stripePaymentIntentId ? "Đổi thẻ" : "Nhập thẻ"}</Text>
              </Pressable>
            </View>
          ) : null}
          <View
            style={[
              styles.trustBox,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Feather name="shield" size={18} color={theme.primary} />
            <Text style={[styles.trustText, { color: theme.text }]}>
              Thông tin đơn hàng được lưu trên backend Node.js + MongoDB để web
              và mobile đồng bộ.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.sectionGap}>
        <Text
          style={[
            styles.stepTitle,
            { color: theme.heading, fontFamily: fontFamily(theme) },
          ]}
        >
          Kiểm tra đơn hàng
        </Text>
        <Text style={[styles.stepHint, { color: theme.muted }]}>
          Tất cả thông tin được tổng hợp trước khi tạo đơn để tránh lỗi mua
          nhầm.
        </Text>
        {cart.map((item, index) => (
          <View
            key={`review-${item.id}-${index}`}
            style={[
              styles.reviewItem,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <SafeImage
              source={{ uri: item.image }}
              style={styles.reviewImage}
              resizeMode="contain"
            />
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={2}
                style={[styles.reviewName, { color: theme.heading }]}
              >
                {item.name}
              </Text>
              <Text style={[styles.optionDesc, { color: theme.muted }]}>
                Sản phẩm JAPANO · SL 1
              </Text>
            </View>
            <Text style={[styles.reviewPrice, { color: theme.primary }]}>
              {formatCurrency(item.price)}
            </Text>
          </View>
        ))}
        <Field
          label="Mã giảm giá"
          value={promo}
          setValue={setPromo}
          icon="tag"
        />
        <View
          style={[
            styles.summary,
            { backgroundColor: theme.card, borderColor: theme.border },
            shadow(theme),
          ]}
        >
          <SummaryRow label="Tạm tính" value={formatCurrency(subtotal)} />
          <SummaryRow
            label="Phí vận chuyển"
            value={formatCurrency(shipping.fee)}
          />
          {giftWrap ? (
            <SummaryRow label="Gói quà" value={formatCurrency(giftFee)} />
          ) : null}
          {autoDiscount ? (
            <SummaryRow
              label="Ưu đãi đơn từ 1.5 triệu"
              value={`- ${formatCurrency(autoDiscount)}`}
            />
          ) : null}
          {promoDiscount ? (
            <SummaryRow
              label="Mã JAPANO"
              value={`- ${formatCurrency(promoDiscount)}`}
            />
          ) : null}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SummaryRow
            label="Tổng thanh toán"
            value={formatCurrency(total)}
            strong
          />
          <Text style={[styles.stepHint, { color: theme.muted, marginTop: 8 }]}>
            Giao hàng: {shipping.name} · {shipping.date}. Thanh toán:{" "}
            {payment.name}.
          </Text>
        </View>
      </View>
    );
  };

  const Field = ({
    label,
    value,
    setValue,
    icon,
    keyboardType,
    multiline,
    compact,
  }: any) => (
    <View
      style={[
        styles.field,
        compact && { flex: 1 },
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Feather name={icon} size={18} color={theme.primary} />
      <StableTextInput
        value={value}
        onChangeText={setValue}
        keepKeyboardOnAndroid
        placeholder={label}
        blurOnSubmit={false}
        autoCorrect={false}
        placeholderTextColor={theme.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[
          styles.input,
          multiline && { minHeight: 78, textAlignVertical: "top" },
          { color: theme.text },
        ]}
      />
    </View>
  );

  const SummaryRow = ({
    label,
    value,
    strong,
  }: {
    label: string;
    value: string;
    strong?: boolean;
  }) => (
    <View style={styles.summaryRow}>
      <Text
        style={[
          strong ? styles.summaryStrong : styles.summaryText,
          { color: strong ? theme.heading : theme.muted },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          strong ? styles.summaryStrong : styles.summaryText,
          { color: strong ? theme.primary : theme.text },
        ]}
      >
        {value}
      </Text>
    </View>
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        paddingTop: insets.top + 10,
      }}
    >
      <View style={styles.header}>
        <Pressable
          onPress={goPrev}
          style={[
            styles.round,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Feather name="arrow-left" size={21} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.title,
              {
                color: theme.heading,
                fontFamily: fontFamily(theme),
                fontSize: scaleFont(theme, 27),
              },
            ]}
          >
            Thanh toán
          </Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Quy trình đặt hàng chuyên nghiệp · đồng bộ web/mobile
          </Text>
        </View>
      </View>

      <View style={styles.progressWrap}>
        {steps.map((item, index) => {
          const active = item.id === step;
          const done = index < stepIndex;
          return (
            <View key={item.id} style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  {
                    backgroundColor:
                      active || done ? theme.primary : theme.card,
                    borderColor: active || done ? theme.primary : theme.border,
                  },
                ]}
              >
                <Feather
                  name={done ? "check" : item.icon}
                  size={15}
                  color={active || done ? theme.background : theme.muted}
                />
              </View>
              <Text
                numberOfLines={1}
                style={{
                  color: active ? theme.primary : theme.muted,
                  fontSize: 10,
                  fontWeight: "900",
                }}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 180 + insets.bottom,
        }}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        automaticallyAdjustKeyboardInsets
      >
        {renderStep()}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.card,
            borderTopColor: theme.border,
            paddingBottom: insets.bottom + 14,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.totalLabel, { color: theme.muted }]}>
            Tổng thanh toán
          </Text>
          <Text style={[styles.total, { color: theme.heading }]}>
            {formatCurrency(total)}
          </Text>
          <Text style={[styles.footerSub, { color: theme.muted }]}>
            {cart.length} sản phẩm · {shipping.eta}
          </Text>
        </View>
        <Pressable
          disabled={!canContinue || submitting || stripeOpening}
          onPress={goNext}
          style={[
            styles.checkoutBtn,
            {
              backgroundColor: canContinue ? theme.primary : theme.border,
              opacity: submitting || stripeOpening ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.checkoutText, { color: theme.background }]}>
            {stripeOpening ? "Đang mở thẻ" : step === "review" ? "Đặt hàng" : "Tiếp tục"}
          </Text>
          <Feather
            name={step === "review" ? "check" : "chevron-right"}
            size={18}
            color={theme.background}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  round: {
    width: 46,
    height: 46,
    borderRadius: 0,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontWeight: "900" },
  subtitle: { fontSize: 12, marginTop: 2 },
  progressWrap: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  stepItem: { alignItems: "center", gap: 5, flex: 1 },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 0,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionGap: { gap: 12 },
  stepTitle: { fontSize: 25, fontWeight: "900" },
  stepHint: { fontSize: 13, lineHeight: 20 },
  field: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, minHeight: 54, fontWeight: "700", fontSize: 14 },
  twoCols: { flexDirection: "row", gap: 10 },
  optionCard: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionIcon: { width: 28, alignItems: "center" },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  optionTitle: { fontSize: 15, fontWeight: "900" },
  optionBadge: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  optionDesc: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  optionPrice: { fontWeight: "900", fontSize: 13 },
  giftCard: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stripeBox: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  miniPayBtn: {
    minHeight: 40,
    borderRadius: 0,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  miniPayText: { fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  trustBox: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  trustText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: "700" },
  reviewItem: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reviewImage: { width: 62, height: 62, borderRadius: 0},
  reviewName: { fontSize: 14, fontWeight: "900" },
  reviewPrice: { fontWeight: "900", fontSize: 12 },
  summary: { borderWidth: 1, borderRadius: 0, padding: 15, gap: 9 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryText: { fontSize: 13, fontWeight: "700" },
  summaryStrong: { fontSize: 17, fontWeight: "900" },
  divider: { height: 1, marginVertical: 4 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  totalLabel: { fontSize: 12, fontWeight: "800" },
  total: { fontSize: 22, fontWeight: "900" },
  footerSub: { fontSize: 11, marginTop: 2, fontWeight: "700" },
  checkoutBtn: {
    minWidth: 136,
    height: 56,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  checkoutText: {
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontSize: 12,
  },
});
