import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Header } from "../../components/Header";
import { ProductCard } from "../../components/ProductCard";
import { useApp } from "../../context/AppContext";
import { fontFamily, radius, scaleFont, shadow } from "../../lib/styles";
import { SafeImage } from "../../components/SafeImage";
import { StableTextInput } from "../../components/StableTextInput";
import { uploadMediaFile } from "../../lib/api";

export default function ProfileScreen() {
  const {
    theme,
    user,
    isLoggedIn,
    cart,
    wishlist,
    generatedImages,
    orders,
    searchHistory,
    updateProfile,
    logout,
    formatCurrency,
  } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");
  const [birthday, setBirthday] = useState(user?.birthday || "");
  const [specialDateName, setSpecialDateName] = useState(
    user?.specialDates?.[0]?.name || "Ngày đặc biệt của tôi",
  );
  const [specialDate, setSpecialDate] = useState(
    user?.specialDates?.[0]?.date || "",
  );
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const pickAvatar = async () => {
    if (!isLoggedIn) return router.push("/login");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return Alert.alert(
        "Cần quyền ảnh",
        "Cho phép truy cập thư viện để đổi avatar.",
      );
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.75,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      try {
        setUploadingAvatar(true);
        const data = await uploadMediaFile(
          {
            uri: asset.uri,
            name: asset.fileName || `avatar-${user?.id || "guest"}-${Date.now()}.jpg`,
            type: asset.mimeType || "image/jpeg",
          },
          user?.id || "guest",
          "avatars",
          "profile-avatar",
        );
        await updateProfile({ avatar: data.secureUrl || data.url || asset.uri });
        Alert.alert("Đã đổi avatar", "Ảnh đại diện đã lưu trên Cloudinary.");
      } catch (e: any) {
        await updateProfile({ avatar: asset.uri });
        Alert.alert("Upload Cloudinary lỗi", e?.message || "Tạm dùng ảnh local, hãy kiểm tra backend/Cloudinary rồi thử lại.");
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const save = async () => {
    const specialDates = specialDate.trim()
      ? [
          {
            name: specialDateName.trim() || "Ngày đặc biệt của tôi",
            date: specialDate.trim(),
          },
        ]
      : [];
    await updateProfile({ name, phone, address, birthday, specialDates });
    setEditing(false);
    Alert.alert(
      "Đã lưu",
      "Thông tin cá nhân, sinh nhật, ngày đặc biệt và thông tin mua hàng đã được cập nhật.",
    );
  };

  if (!isLoggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Header
          title="Tài khoản"
          subtitle="Bạn có thể lướt app tự do, nhưng cần đăng nhập để mua hàng, lưu giỏ, yêu thích và thanh toán."
        />
        <ScrollView contentContainerStyle={styles.content}>
          <View
            style={[
              styles.panel,
              { backgroundColor: theme.card, borderColor: theme.border },
              shadow(theme),
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Feather name="user" size={32} color={theme.background} />
            </View>
            <Text
              style={[
                styles.name,
                {
                  color: theme.heading,
                  fontFamily: fontFamily(theme),
                  fontSize: scaleFont(theme, 26),
                },
              ]}
            >
              Đăng nhập JAPANO
            </Text>
            <Text style={[styles.empty, { color: theme.muted }]}>
              Đăng nhập để đồng bộ giỏ hàng, yêu thích, lịch sử mua, ảnh AI,
              thông tin giao hàng và cài đặt giao diện lên MongoDB.
            </Text>
            <Pressable
              onPress={() => router.push("/login")}
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.primaryText, { color: theme.background }]}>
                Đăng nhập
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/register")}
              style={[styles.secondaryBtn, { borderColor: theme.primary }]}
            >
              <Text style={[styles.secondaryText, { color: theme.primary }]}>
                Tạo tài khoản mới
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header
        title="Hồ sơ"
        subtitle="Thông tin tài khoản, mua hàng, yêu thích, thanh toán và lịch sử đều được đồng bộ database."
        right={
          <Pressable onPress={logout}>
            <Feather name="log-out" size={22} color={theme.primary} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        automaticallyAdjustKeyboardInsets
      >
        <View
          style={[
            styles.profileCard,
            { backgroundColor: theme.card, borderColor: theme.border },
            shadow(theme),
          ]}
        >
          <Pressable
            onPress={uploadingAvatar ? undefined : pickAvatar}
            style={[
              styles.avatar,
              { backgroundColor: theme.primary, overflow: "hidden" },
            ]}
          >
            {user?.avatar ? (
              <SafeImage
                source={{ uri: user.avatar }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <Text style={[styles.avatarText, { color: theme.background }]}>
                {(user?.name || "J").slice(0, 1).toUpperCase()}
              </Text>
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.name,
                {
                  color: theme.heading,
                  fontFamily: fontFamily(theme),
                  fontSize: scaleFont(theme, 24),
                },
              ]}
            >
              {user?.name || "JAPANO Member"}
            </Text>
            <Text style={[styles.meta, { color: theme.muted }]}>
              {user?.email}
            </Text>
            <Text style={[styles.meta, { color: theme.primary }]}>
              {user?.coins || 0} xu JAPANO
            </Text>
            <Text style={[styles.meta, { color: theme.muted }]}>
              {uploadingAvatar ? "Đang upload avatar lên Cloudinary..." : "Bấm avatar để đổi ảnh Cloudinary"}
            </Text>
          </View>
          <Pressable onPress={() => setEditing((v) => !v)}>
            <Feather name="edit-3" size={22} color={theme.primary} />
          </Pressable>
        </View>

        {user?.role === "admin" || user?.isAdmin ? (
          <Pressable
            onPress={() => router.push("/admin")}
            style={[
              styles.adminButton,
              { backgroundColor: theme.primary, borderColor: theme.primary },
              shadow(theme),
            ]}
          >
            <Feather name="shield" size={20} color={theme.background} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.adminButtonTitle, { color: theme.background }]}>
                Mở trang Admin
              </Text>
              <Text style={[styles.adminButtonSubtitle, { color: theme.background }]}>
                Quản lý user, cấp quyền và xem tổng quan database ERD
              </Text>
            </View>
            <Feather name="chevron-right" size={22} color={theme.background} />
          </Pressable>
        ) : null}

        {editing && (
          <View
            style={[
              styles.panel,
              { backgroundColor: theme.card, borderColor: theme.border },
              shadow(theme),
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.heading, fontFamily: fontFamily(theme) },
              ]}
            >
              Thông tin mua hàng
            </Text>
            <Input label="Họ tên" value={name} onChangeText={setName} />
            <Input
              label="Số điện thoại"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Input
              label="Địa chỉ giao hàng"
              value={address}
              onChangeText={setAddress}
              multiline
            />
            <Input
              label="Sinh nhật (DD/MM hoặc YYYY-MM-DD)"
              value={birthday}
              onChangeText={setBirthday}
              placeholder="Ví dụ: 20/10 hoặc 2002-10-20"
            />
            <Input
              label="Tên ngày đặc biệt"
              value={specialDateName}
              onChangeText={setSpecialDateName}
              placeholder="Ví dụ: Kỷ niệm, sinh nhật người yêu..."
            />
            <Input
              label="Ngày đặc biệt (DD/MM hoặc YYYY-MM-DD)"
              value={specialDate}
              onChangeText={setSpecialDate}
              placeholder="Ví dụ: 14/02 hoặc 2026-02-14"
            />
            <Pressable
              onPress={save}
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.primaryText, { color: theme.background }]}>
                Lưu thông tin
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.stats}>
          <Stat
            icon="shopping-bag"
            label="Giỏ hàng"
            value={String(cart.length)}
            onPress={() => router.push("/cart")}
          />
          <Stat
            icon="heart"
            label="Yêu thích"
            value={String(wishlist.length)}
          />
          <Stat
            icon="image"
            label="Ảnh AI"
            value={String(generatedImages.length)}
          />
        </View>

        <View
          style={[
            styles.paymentCard,
            { backgroundColor: theme.card, borderColor: theme.border },
            shadow(theme),
          ]}
        >
          <Feather name="credit-card" size={22} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.paymentTitle, { color: theme.heading }]}>
              Thanh toán
            </Text>
            <Text style={[styles.empty, { color: theme.muted }]}>
              Hỗ trợ COD, ví điện tử và chuyển khoản. Vào giỏ hàng để thanh toán
              đơn.
            </Text>
          </View>
          <Pressable onPress={() => router.push("/checkout")}>
            <Text style={{ color: theme.primary, fontWeight: "900" }}>Mở</Text>
          </Pressable>
        </View>

        <Text
          style={[
            styles.sectionTitle,
            { color: theme.heading, fontFamily: fontFamily(theme) },
          ]}
        >
          Lịch sử mua hàng
        </Text>
        {orders.length ? (
          orders.map((order: any, idx) => {
            const orderKey = String(order._id || order.id || idx);
            const isOpen = expandedOrderId === orderKey;
            const items = Array.isArray(order.items) ? order.items : [];
            const canReviewOrder = /paid|completed|delivered|confirmed|success/i.test(`${order.status || ""} ${order.orderStatus || ""} ${order.paymentStatus || ""}`);
            const created = order.createdAt
              ? new Date(order.createdAt).toLocaleString("vi-VN")
              : "Chưa có ngày tạo";
            return (
              <Pressable
                key={orderKey}
                onPress={() => setExpandedOrderId(isOpen ? null : orderKey)}
                style={[
                  styles.order,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <View style={styles.orderHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.orderTitle, { color: theme.heading }]}>
                      Đơn #{orderKey.slice(-6)}
                    </Text>
                    <Text style={[styles.empty, { color: theme.muted }]}>
                      {order.status || "pending"} ·{" "}
                      {formatCurrency(order.total || 0)}
                    </Text>
                    <Text style={[styles.orderMeta, { color: theme.muted }]}>
                      {created}
                    </Text>
                  </View>
                  <Feather
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={theme.primary}
                  />
                </View>
                {isOpen ? (
                  <View style={styles.orderDetail}>
                    <Text
                      style={[styles.detailLabel, { color: theme.heading }]}
                    >
                      Sản phẩm đã mua
                    </Text>
                    {items.length ? (
                      items.map((item: any, itemIndex: number) => (
                        <View
                          key={`order-item-${orderKey}-${String(item.id || item._id || item.name)}-${itemIndex}`}
                          style={[
                            styles.orderItem,
                            {
                              borderColor: theme.border,
                              backgroundColor: theme.background,
                            },
                          ]}
                        >
                          {item.image ? (
                            <SafeImage
                              source={{ uri: item.image }}
                              style={styles.orderItemImage}
                              resizeMode="contain"
                            />
                          ) : null}
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              numberOfLines={2}
                              style={[
                                styles.orderItemName,
                                { color: theme.heading },
                              ]}
                            >
                              {item.name || "Sản phẩm JAPANO"}
                            </Text>
                            <Text
                              style={[styles.orderMeta, { color: theme.muted }]}
                            >
                              SL: {item.qty || 1} ·{" "}
                              {formatCurrency(
                                Number(item.price || item.unitPrice || 0),
                              )}
                            </Text>
                            {item.selectedSize || item.selectedColor ? (
                              <Text
                                style={[
                                  styles.orderMeta,
                                  { color: theme.muted },
                                ]}
                              >
                                Size: {item.selectedSize || "-"} · Màu:{" "}
                                {item.selectedColor || "-"}
                              </Text>
                            ) : null}
                            {canReviewOrder ? (
                              <Pressable
                                onPress={(event: any) => {
                                  event?.stopPropagation?.();
                                  const pid = String(item.id || item.productId || "");
                                  router.push({ pathname: "/product-detail-v49-shopee", params: { productId: pid, product: encodeURIComponent(JSON.stringify(item)), review: "1" } } as any);
                                }}
                                style={styles.reviewOrderBtn}
                              >
                                <Text style={styles.reviewOrderBtnText}>Đánh giá sản phẩm</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={[styles.empty, { color: theme.muted }]}>
                        Đơn này chưa lưu chi tiết sản phẩm. Các đơn mới sẽ lưu
                        đầy đủ tên, ảnh, giá và số lượng.
                      </Text>
                    )}
                    <View
                      style={[
                        styles.orderInfoBox,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.background,
                        },
                      ]}
                    >
                      <Text style={[styles.orderMeta, { color: theme.muted }]}>
                        Thanh toán:{" "}
                        {order.paymentMethod ||
                          order.payment?.method ||
                          "Chưa rõ"}
                      </Text>
                      <Text style={[styles.orderMeta, { color: theme.muted }]}>
                        Địa chỉ:{" "}
                        {order.shippingAddress ||
                          order.address?.line1 ||
                          user?.address ||
                          "Chưa lưu địa chỉ"}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </Pressable>
            );
          })
        ) : (
          <Text style={[styles.empty, { color: theme.muted }]}>
            Chưa có lịch sử mua hàng.
          </Text>
        )}

        <Text
          style={[
            styles.sectionTitle,
            { color: theme.heading, fontFamily: fontFamily(theme) },
          ]}
        >
          Lịch sử tìm kiếm
        </Text>
        {searchHistory.length ? (
          <View style={styles.chips}>
            {searchHistory.slice(0, 12).map((term) => (
              <View
                key={term}
                style={[
                  styles.chip,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={{ color: theme.text, fontWeight: "800" }}>
                  {term}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.empty, { color: theme.muted }]}>
            Chưa có tìm kiếm nào.
          </Text>
        )}

        <Text
          style={[
            styles.sectionTitle,
            { color: theme.heading, fontFamily: fontFamily(theme) },
          ]}
        >
          Ảnh AI đã lưu
        </Text>
        {generatedImages.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={{ gap: 12 }}
          >
            {generatedImages.map((img, index) => (
              <SafeImage
                key={`profile-img-${String(img.id || img.url)}-${index}`}
                source={{ uri: img.url }}
                style={[styles.aiImage, { backgroundColor: theme.card }]}
                resizeMode="contain"
              />
            ))}
          </ScrollView>
        ) : (
          <Text style={[styles.empty, { color: theme.muted }]}>
            Chưa có ảnh AI. Vào Chat → Tạo ảnh để lưu lại.
          </Text>
        )}

        <Text
          style={[
            styles.sectionTitle,
            { color: theme.heading, fontFamily: fontFamily(theme) },
          ]}
        >
          Yêu thích
        </Text>
        {wishlist.length ? (
          wishlist.map((p, index) => (
            <ProductCard
              key={`wishlist-${String(p.id || p.name)}-${index}`}
              product={p}
            />
          ))
        ) : (
          <Text style={[styles.empty, { color: theme.muted }]}>
            Chưa có sản phẩm yêu thích.
          </Text>
        )}
      </ScrollView>
    </View>
  );

  function Input(props: any) {
    return (
      <View style={{ gap: 6 }}>
        <Text style={[styles.inputLabel, { color: theme.muted }]}>
          {props.label}
        </Text>
        <StableTextInput
          {...props}
          keepKeyboardOnAndroid
          placeholderTextColor={theme.muted}
          blurOnSubmit={false}
          autoCorrect={false}
          style={[
            styles.input,
            {
              color: theme.text,
              borderColor: theme.border,
              backgroundColor: theme.background,
            },
          ]}
        />
      </View>
    );
  }
  function Stat({
    icon,
    label,
    value,
    onPress,
  }: {
    icon: any;
    label: string;
    value: string;
    onPress?: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.stat,
          { backgroundColor: theme.card, borderColor: theme.border },
          shadow(theme),
        ]}
      >
        <Feather name={icon} size={20} color={theme.primary} />
        <Text style={[styles.statValue, { color: theme.heading }]}>
          {value}
        </Text>
        <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 150, gap: 16 },
  profileCard: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  panel: { borderWidth: 1, borderRadius: 0, padding: 16, gap: 12 },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 30, fontWeight: "900" },
  name: { fontWeight: "900" },
  meta: { marginTop: 4, fontSize: 13 },
  adminButton: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  adminButtonTitle: { fontSize: 16, fontWeight: "900" },
  adminButtonSubtitle: { marginTop: 2, fontSize: 12, fontWeight: "700", opacity: 0.88 },
  stats: { flexDirection: "row", gap: 10 },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 0,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 11, fontWeight: "700" },
  sectionTitle: { fontSize: 22, fontWeight: "900", marginTop: 8 },
  aiImage: { width: 160, height: 160, borderRadius: 0},
  empty: { fontSize: 14, lineHeight: 20 },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryText: { fontWeight: "900", letterSpacing: 1.2 },
  secondaryBtn: {
    minHeight: 52,
    borderRadius: 0,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryText: { fontWeight: "900", letterSpacing: 1.2 },
  inputLabel: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  paymentCard: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  paymentTitle: { fontSize: 18, fontWeight: "900" },
  order: { borderWidth: 1, borderRadius: 0, padding: 14, gap: 8 },
  orderHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  orderTitle: { fontSize: 16, fontWeight: "900" },
  orderMeta: { fontSize: 12, lineHeight: 17 },
  orderDetail: { gap: 10, marginTop: 8 },
  detailLabel: { fontSize: 14, fontWeight: "900" },
  orderItem: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  orderItemImage: { width: 62, height: 62, borderRadius: 0},
  orderItemName: { fontSize: 14, fontWeight: "900" },
  orderInfoBox: { borderWidth: 1, borderRadius: 0, padding: 10, gap: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 0,
  },
  reviewOrderBtn: { alignSelf: "flex-start", marginTop: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#ec4899" },
  reviewOrderBtnText: { color: "#fff", fontSize: 12, fontWeight: "900" },

});
