import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useApp } from "../context/AppContext";
import { api, uploadMediaFile } from "../lib/api";

type ExtendedAdminApi = typeof api & {
  getAdminCategories?: (adminId: string) => Promise<any>;
  saveAdminCategory?: (adminId: string, body: any) => Promise<any>;
  updateAdminCategory?: (adminId: string, categoryId: string, body: any) => Promise<any>;
  deleteAdminCategory?: (adminId: string, categoryId: string) => Promise<any>;
  updateAdminOrderStatus?: (adminId: string, orderId: string, status: string) => Promise<any>;
  getAdminReviews?: (adminId: string) => Promise<any>;
  deleteAdminReview?: (adminId: string, reviewId: string) => Promise<any>;
  getAdminBanners?: (adminId: string) => Promise<any>;
  deleteAdminBanner?: (adminId: string, bannerId: string) => Promise<any>;
};

const adminApi = api as ExtendedAdminApi;

// ─── Kiểu dữ liệu theo ERD ───────────────────────────────────────────────────

type AdminUser = {
  id: string;
  fullName?: string;
  name?: string;
  email: string;
  phone?: string;
  address?: string;
  role: "customer" | "admin";
  status?: string;
  coins?: number;
  vip?: boolean;
  createdAt?: string | null;
  isProtectedAdmin?: boolean;
};

type AdminProduct = {
  _id?: string;
  id: string;
  name: string;
  productName?: string;
  status?: string;
  description?: string;
  categoryId?: string;
  category?: string;
  badge?: string;
  subcategory?: string;
  price?: number;
  originalPrice?: number;
  discountPercent?: number;
  discountLabel?: string;
  image?: string;
  images?: string[];
  sizes?: string[];
  dimensions?: string;
  colors?: string[];
  fit?: string;
  sku?: string;
  stockQuantity?: number;
  visualTags?: string[];
  styleUseCase?: string;
  story?: string;
};

type AdminCategory = {
  id: string;
  categoryId?: string;
  categoryName?: string;
  name?: string;
  description?: string;
};

type AdminReview = {
  id: string;
  reviewId?: string;
  rating?: number;
  comment?: string;
  userId?: string;
  orderItemId?: string;
  reviewDate?: string;
  userName?: string;
  productName?: string;
};

type AdminOrder = {
  id: string;
  orderId?: string;
  orderDate?: string;
  totalAmount?: number;
  total?: number;
  shippingAddress?: string;
  orderStatus?: string;
  status?: string;
  paymentStatus?: string;
  phoneNumber?: string;
  userId?: string;
  discountCodeId?: string;
  paymentId?: string;
  paymentMethod?: string;
  createdAt?: string;
  transactionId?: string;
};

type AdminPayment = {
  id: string;
  amount?: number;
  paymentMethod?: string;
  status?: string;
  createdAt?: string;
  transactionId?: string;
  userId?: string;
};

type AdminDiscountCode = {
  id: string;
  code?: string;
  title?: string;
  discountValue?: number;
  discountType?: string;
  expiryDate?: string;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usedCount?: number;
  status?: string;
  active?: boolean;
  kind?: string;
  description?: string;
  startsAt?: string;
  scope?: string;
  bannerImage?: string;
};

type TabKey =
  | "tongquan"
  | "thongke"
  | "sanpham"
  | "danhmuc"
  | "donhang"
  | "nguoidung"
  | "giamgia"
  | "danhgia"
  | "banner";

type NavItem = {
  key: TabKey;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  group: string;
  badge?: string;
};

// ─── Màu sắc ─────────────────────────────────────────────────────────────────

const ADMIN_GREEN = "#00A76F";
const ADMIN_GREEN_LIGHT = "#E6F7F1";
const ADMIN_GREEN_MID = "#00C984";
const ADMIN_DARK = "#07140F";
const ADMIN_DARK_2 = "#0D1F17";
const ADMIN_MUTED_DARK = "#84918B";
const ADMIN_BG = "#F4F6F9";
const ADMIN_CARD = "#FFFFFF";
const ADMIN_BORDER = "#E8ECF0";
const ADMIN_TEXT = "#1A2228";
const ADMIN_MUTED = "#7A8899";
const ADMIN_BLUE = "#2563EB";
const ADMIN_ORANGE = "#F59E0B";
const ADMIN_RED = "#EF4444";

const CARD_SHADOW =
  Platform.OS === "web"
    ? ({ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" } as any)
    : {
        shadowColor: "#000",
        shadowOpacity: 0.07,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      };

const ADMIN_CARD_SHADOW = CARD_SHADOW;

// ─── Danh sách nav theo Use Case ─────────────────────────────────────────────

const navItems: NavItem[] = [
  { key: "tongquan", label: "Tổng quan", icon: "grid", group: "BÁO CÁO" },
  { key: "thongke", label: "Thống kê doanh thu", icon: "bar-chart-2", group: "BÁO CÁO" },
  { key: "sanpham", label: "Quản lý sản phẩm", icon: "package", group: "THƯƠNG MẠI" },
  { key: "danhmuc", label: "Quản lý danh mục", icon: "layers", group: "THƯƠNG MẠI" },
  { key: "donhang", label: "Quản lý đơn hàng", icon: "shopping-bag", group: "THƯƠNG MẠI" },
  { key: "nguoidung", label: "Quản lý người dùng", icon: "users", group: "THƯƠNG MẠI" },
  { key: "giamgia", label: "Quản lý mã giảm giá", icon: "percent", group: "THƯƠNG MẠI" },
  { key: "danhgia", label: "Quản lý đánh giá", icon: "star", group: "NỘI DUNG" },
  { key: "banner", label: "Banner / Nổi bật", icon: "image", group: "NỘI DUNG" },
];

// ─── Form trống ───────────────────────────────────────────────────────────────

const emptyProductForm = {
  id: "",
  name: "",
  categoryId: "",
  description: "",
  status: "active",
  price: "",
  originalPrice: "",
  discountPercent: "",
  discountLabel: "",
  badge: "",
  image: "",
  image2: "",
  image3: "",
  image4: "",
  stockQuantity: "999",
  sku: "",
  visualTags: "",
  styleUseCase: "",
  sizes: "S, M, L, XL",
  dimensions: "",
  colors: "Đen, Trắng, Kem",
  fit: "Regular fit",
  story: "",
};

const emptyCategoryForm = {
  categoryId: "",
  categoryName: "",
  description: "",
};

const emptyDiscountForm = {
  code: "",
  title: "",
  discountType: "percent",
  discountValue: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  usageLimit: "",
  expiryDate: "",
  description: "",
  status: "active",
  kind: "voucher",
  scope: "all",
  bannerImage: "",
  startsAt: "",
};

const emptyNotificationForm = { title: "", content: "" };

// ─── Tiện ích ─────────────────────────────────────────────────────────────────

const ADMIN_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80",
];

function formatMoney(value: any) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function formatCompactMoney(value: any) {
  const n = Number(value || 0);
  if (n >= 1_000_000_000) return `${Math.round(n / 100_000_000) / 10}Tỷ`;
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}Tr`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return `${n.toLocaleString("vi-VN")}đ`;
}

function formatNumber(value: any) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function compactDate(value: any) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("vi-VN");
}

function calcDiscount(product: AdminProduct) {
  const price = Number(product.price || 0);
  const original = Number(product.originalPrice || 0);
  if (original > price && price > 0)
    return Math.max(1, Math.round((1 - price / original) * 100));
  return Number(product.discountPercent || 0);
}

function splitAdminList(value: any) {
  if (Array.isArray(value)) return value.map((x) => String(x || "").trim()).filter(Boolean);
  return String(value || "")
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function adminGalleryImages(
  product: Partial<AdminProduct> & Record<string, any>
) {
  const seen = new Set<string>();
  const gallery = [product.image, ...(Array.isArray(product.images) ? product.images : [])]
    .map((url) => String(url || "").trim())
    .filter((url) => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  let offset = String(
    product.id || product.name || product.image || "japano"
  ).length;
  while (gallery.length < 4) {
    const fallback = ADMIN_FALLBACK_IMAGES[offset % ADMIN_FALLBACK_IMAGES.length];
    if (!seen.has(fallback)) {
      gallery.push(fallback);
      seen.add(fallback);
    }
    offset += 1;
  }
  return gallery.slice(0, 4);
}

function toProductForm(product: AdminProduct) {
  const gallery = adminGalleryImages(product);
  return {
    id: product.id || "",
    name: product.name || product.productName || "",
    categoryId: product.categoryId || product.category || "",
    description: product.description || "",
    status: product.status || "active",
    price: String(product.price || 0),
    originalPrice: String(product.originalPrice || ""),
    discountPercent: String(product.discountPercent || ""),
    discountLabel: product.discountLabel || "",
    badge: product.badge || "",
    image: gallery[0] || product.image || "",
    image2: gallery[1] || "",
    image3: gallery[2] || "",
    image4: gallery[3] || "",
    stockQuantity: String(product.stockQuantity ?? 999),
    sku: product.sku || "",
    visualTags: Array.isArray(product.visualTags)
      ? product.visualTags.join(", ")
      : "",
    styleUseCase: product.styleUseCase || "",
    sizes: Array.isArray(product.sizes)
      ? product.sizes.join(", ")
      : "S, M, L, XL",
    dimensions: product.dimensions || "",
    colors: Array.isArray(product.colors)
      ? product.colors.join(", ")
      : "Đen, Trắng, Kem",
    fit: product.fit || "Regular fit",
    story: product.story || "",
  };
}

function miniTrendData(input: any[]) {
  if (Array.isArray(input) && input.length) return input;
  return [
    { label: "T2", value: 18 },
    { label: "T3", value: 24 },
    { label: "T4", value: 21 },
    { label: "T5", value: 32 },
    { label: "T6", value: 39 },
    { label: "T7", value: 34 },
    { label: "CN", value: 46 },
  ];
}

// ─── Component nhỏ ────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function StatCard({
  label,
  value,
  change,
  icon,
  accent = ADMIN_GREEN,
  trend = [],
  positiveChange = true,
}: any) {
  const isNeg = String(change || "").startsWith("-");
  return (
    <View style={styles.statCard}>
      <View style={styles.statTop}>
        <View>
          <Text style={styles.statLabel}>{label}</Text>
          <Text style={styles.statValue}>{value}</Text>
        </View>
        <View style={[styles.statIcon, { backgroundColor: `${accent}18` }]}>
          <Feather name={icon || "activity"} size={20} color={accent} />
        </View>
      </View>
      <View style={styles.statBottom}>
        <Text
          style={[
            styles.statChange,
            { color: isNeg ? ADMIN_RED : ADMIN_GREEN },
          ]}
        >
          {change || "+0%"}
        </Text>
        <MiniBars
          data={miniTrendData(trend).slice(-7)}
          compact
          accent={accent}
        />
      </View>
    </View>
  );
}

function MiniBars({
  data,
  compact = false,
  accent = ADMIN_GREEN,
  money = false,
}: any) {
  const rows = Array.isArray(data) && data.length ? data : [];
  const max = Math.max(
    1,
    ...rows.map((item: any) =>
      Number(item.value || item.revenue || item.unitsSold || 0)
    )
  );
  return (
    <View
      style={[styles.miniBars, compact ? styles.miniBarsCompact : null]}
    >
      {rows.map((item: any, index: number) => {
        const rawValue = Number(
          item.value ?? item.revenue ?? item.unitsSold ?? 0
        );
        const height = `${Math.max(8, Math.round((rawValue / max) * 100))}%` as any;
        return (
          <View
            key={`${item.label || item.month || index}`}
            style={styles.miniBarItem}
          >
            <View style={styles.miniBarTrack}>
              <View
                style={[
                  styles.miniBarFill,
                  { height, backgroundColor: accent },
                ]}
              />
            </View>
            {!compact ? (
              <Text style={styles.chartLabel}>
                {item.label || item.month || "--"}
              </Text>
            ) : null}
            {!compact ? (
              <Text style={styles.chartValue}>
                {money ? formatCompactMoney(rawValue) : formatNumber(rawValue)}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function HorizontalBars({
  data,
  accent = ADMIN_GREEN,
  money = false,
}: any) {
  const rows = Array.isArray(data) ? data : [];
  const max = Math.max(1, ...rows.map((x: any) => Number(x.value || 0)));
  if (!rows.length)
    return (
      <Text style={styles.emptyText}>Chưa có dữ liệu đủ để vẽ biểu đồ.</Text>
    );
  return (
    <View style={{ gap: 14 }}>
      {rows.map((item: any, index: number) => {
        const value = Number(item.value || 0);
        const width = `${Math.max(5, Math.round((value / max) * 100))}%` as any;
        return (
          <View key={`${item.label}-${index}`} style={{ gap: 7 }}>
            <View style={styles.barLineTop}>
              <Text numberOfLines={1} style={styles.barName}>
                {item.label}
              </Text>
              <Text style={styles.barValue}>
                {money ? formatMoney(value) : formatNumber(value)}
              </Text>
            </View>
            <View style={styles.hTrack}>
              <View
                style={[styles.hFill, { width, backgroundColor: accent }]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ProductPreview({
  name,
  price,
  originalPrice,
  image,
  images = [],
  discountPercent,
  sizes = [],
  colors = [],
  dimensions = "",
}: any) {
  const percent = Number(
    discountPercent ||
    (Number(originalPrice) > Number(price)
      ? Math.round(
        (1 - Number(price || 0) / Number(originalPrice || 1)) * 100
      )
      : 0)
  );
  const gallery = adminGalleryImages({ image, images });
  return (
    <View style={styles.marketPreview}>
      <View style={styles.previewTopIcons}>
        <Feather name="x" size={22} color={ADMIN_TEXT} />
        <View style={{ flexDirection: "row", gap: 20 }}>
          <Feather name="search" size={22} color={ADMIN_TEXT} />
          <Feather name="more-horizontal" size={22} color={ADMIN_TEXT} />
        </View>
      </View>
      <View style={styles.previewImageBox}>
        {gallery[0] ? (
          <Image
            source={{ uri: gallery[0] }}
            style={styles.previewImage}
          />
        ) : (
          <Feather name="image" size={52} color={ADMIN_MUTED} />
        )}
        {percent > 0 ? (
          <View style={styles.previewDiscount}>
            <Text style={styles.previewDiscountText}>-{percent}%</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.previewThumbRow}>
        {gallery.map((url: string, index: number) => (
          <Image
            key={`preview-${index}`}
            source={{ uri: url }}
            style={styles.previewThumb}
          />
        ))}
      </View>
      <View style={styles.previewBody}>
        <Text numberOfLines={2} style={styles.previewTitle}>
          {name || "Tên sản phẩm"}
        </Text>
        <View style={styles.previewPriceLine}>
          <Text style={styles.previewSalePrice}>{formatMoney(price)}</Text>
          {Number(originalPrice || 0) > Number(price || 0) ? (
            <Text style={styles.previewOldPrice}>
              {formatMoney(originalPrice)}
            </Text>
          ) : null}
        </View>
        <Text style={styles.previewMeta}>
          Size: {splitAdminList(sizes).join(" • ") || "S • M • L • XL"}
        </Text>
        <Text style={styles.previewMeta}>
          Màu: {splitAdminList(colors).join(" • ") || "Đen • Trắng • Kem"}
        </Text>
        {!!dimensions ? (
          <Text style={styles.previewMeta}>Kích thước: {dimensions}</Text>
        ) : null}
      </View>
    </View>
  );
}

function Input({ label, style, ...props }: any) {
  return (
    <View style={[styles.inputWrap, style]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#B0BAC4"
        style={[
          styles.input,
          props.multiline ? styles.inputMultiline : null,
        ]}
      />
    </View>
  );
}

function SelectChip({ active, label, onPress }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.selectChip, active ? styles.selectChipActive : null]}
    >
      <Text
        style={[
          styles.selectChipText,
          active ? styles.selectChipTextActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RatingStars({ rating }: { rating?: number }) {
  const r = Number(rating || 0);
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Feather
          key={star}
          name="star"
          size={14}
          color={star <= r ? ADMIN_ORANGE : ADMIN_BORDER}
        />
      ))}
    </View>
  );
}

// ─── Màn hình chính ───────────────────────────────────────────────────────────

export default function AdminScreen() {
  const { width } = useWindowDimensions();
  const desktop = width >= 920;
  const { user, isLoggedIn } = useApp();
  const [activeTab, setActiveTab] = useState<TabKey>("tongquan");

  // Dữ liệu từ API
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [discountCodes, setDiscountCodes] = useState<AdminDiscountCode[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [banners, setBanners] = useState<any[]>([]);

  // Trạng thái UI
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Form sản phẩm
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState(emptyProductForm);

  // Form danh mục
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);

  // Form mã giảm giá
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [discountForm, setDiscountForm] = useState(emptyDiscountForm);

  // Form thông báo
  const [notificationForm, setNotificationForm] = useState(emptyNotificationForm);

  // Form banner
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerLink, setBannerLink] = useState("");

  const isAdmin = user?.role === "admin" || (user as any)?.isAdmin;

  const openAdminLogin = () =>
    router.replace({
      pathname: "/login",
      params: { redirectTo: "/admin" },
    } as any);

  const dashboard = overview?.dashboard || {};
  const kpis = dashboard?.kpis || {};

  // ─── Load dữ liệu ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!user?.id || !isAdmin) return;
    const [
      nextOverview,
      nextUsers,
      nextProducts,
      nextCategories,
      nextOrders,
      nextPayments,
      nextDiscounts,
      nextReviews,
      nextBanners,
    ] = await Promise.all([
      api.getAdminOverview(user.id),
      api.getAdminUsers(user.id),
      api.getAdminProducts(user.id),
      adminApi.getAdminCategories?.(user.id).catch(() => ({ categories: [] })),
      api.getAdminOrders(user.id),
      api.getAdminPayments(user.id),
      api.getAdminVouchers(user.id),
      adminApi.getAdminReviews?.(user.id).catch(() => ({ reviews: [] })),
      adminApi.getAdminBanners?.(user.id).catch(() => ({ banners: [] })),
    ]);
    setOverview(nextOverview);
    setUsers(Array.isArray(nextUsers?.users) ? nextUsers.users : []);
    setProducts(
      Array.isArray(nextProducts?.products) ? nextProducts.products : []
    );
    setCategories(
      Array.isArray(nextCategories?.categories) ? nextCategories.categories : []
    );
    setOrders(Array.isArray(nextOrders?.orders) ? nextOrders.orders : []);
    setPayments(
      Array.isArray(nextPayments?.payments) ? nextPayments.payments : []
    );
    setDiscountCodes(
      Array.isArray(nextDiscounts?.vouchers)
        ? nextDiscounts.vouchers
        : Array.isArray(nextDiscounts?.discountCodes)
          ? nextDiscounts.discountCodes
          : []
    );
    setReviews(Array.isArray(nextReviews?.reviews) ? nextReviews.reviews : []);
    setBanners(Array.isArray(nextBanners?.banners) ? nextBanners.banners : []);
  }, [user?.id, isAdmin]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e: any) =>
        Alert.alert("Không mở được admin", e?.message || "Kiểm tra backend/MongoDB.")
      )
      .finally(() => setLoading(false));
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load().catch((e: any) =>
      Alert.alert("Không tải lại được", e?.message || "Có lỗi xảy ra.")
    );
    setRefreshing(false);
  };

  // ─── Lọc dữ liệu ─────────────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      `${p.name} ${p.id} ${p.category} ${p.sku}`.toLowerCase().includes(q)
    );
  }, [products, search]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.name || ""} ${u.fullName || ""} ${u.email}`.toLowerCase().includes(q)
    );
  }, [users, search]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      `${o.id} ${o.userId} ${o.orderStatus || o.status}`.toLowerCase().includes(q)
    );
  }, [orders, search]);

  // ─── Thống kê ─────────────────────────────────────────────────────────────────

  const revenueByMonth = Array.isArray(dashboard?.revenueByMonth)
    ? dashboard.revenueByMonth.map((x: any) => ({
      label: String(x.month || x.label || "").slice(5),
      value: Number(x.value ?? x.revenue ?? 0),
    }))
    : [];
  const topProducts = Array.isArray(dashboard?.salesByProduct)
    ? dashboard.salesByProduct
    : [];
  const predictions = Array.isArray(dashboard?.ml?.predictions)
    ? dashboard.ml.predictions
    : [];

  const activeProducts = products.filter(
    (p) => (p.status || "active") === "active"
  ).length;
  const hiddenProducts = products.filter(
    (p) => (p.status || "active") !== "active"
  ).length;
  const activeDiscounts = discountCodes.filter(
    (d) => d.active !== false && d.status !== "inactive"
  ).length;

  const pendingOrders = orders.filter(
    (o) => (o.orderStatus || o.status) === "pending"
  ).length;
  const totalRevenue = payments
    .filter((p) => p.status === "success" || p.status === "completed")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // ─── CRUD Sản phẩm ────────────────────────────────────────────────────────────

  const saveProduct = async () => {
    if (!user?.id) return;
    if (!productForm.name.trim())
      return Alert.alert("Thiếu tên", "Nhập tên sản phẩm trước khi lưu.");
    try {
      setActionId("product-save");
      const body = {
        ...productForm,
        price: Number(productForm.price || 0),
        originalPrice: Number(productForm.originalPrice || 0),
        discountPercent: Number(productForm.discountPercent || 0),
        stockQuantity: Number(productForm.stockQuantity || 999),
        images: [
          productForm.image,
          productForm.image2,
          productForm.image3,
          productForm.image4,
        ]
          .map((x) => x.trim())
          .filter(Boolean),
        visualTags: splitAdminList(productForm.visualTags),
        sizes: splitAdminList(productForm.sizes),
        colors: splitAdminList(productForm.colors),
      };
      if (editingProductId)
        await api.updateAdminProduct(user.id, editingProductId, body);
      else await api.saveAdminProduct(user.id, body);
      setProductForm(emptyProductForm);
      setEditingProductId(null);
      await load();
      Alert.alert("Đã lưu", "Sản phẩm đã được cập nhật.");
    } catch (e: any) {
      Alert.alert("Không lưu được", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  const editProduct = (product: AdminProduct) => {
    setProductForm(toProductForm(product));
    setEditingProductId(product.id);
    setActiveTab("sanpham");
  };

  const toggleProduct = async (product: AdminProduct) => {
    if (!user?.id) return;
    try {
      setActionId(`hide-${product.id}`);
      await api.setAdminProductHidden(
        user.id,
        product.id,
        (product.status || "active") === "active"
      );
      await load();
    } catch (e: any) {
      Alert.alert("Không ẩn/hiện được", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  const quickDiscount = async (product: AdminProduct, percent: number) => {
    if (!user?.id) return;
    const base = Number(product.originalPrice || product.price || 0);
    const nextPrice = Math.max(0, Math.round(base * (1 - percent / 100)));
    try {
      setActionId(`discount-${product.id}`);
      await api.updateAdminProduct(user.id, product.id, {
        price: nextPrice,
        originalPrice: base,
        discountPercent: percent,
        discountLabel: `Giảm ${percent}%`,
        badge: `GIẢM ${percent}%`,
      });
      await load();
    } catch (e: any) {
      Alert.alert("Không tạo giảm giá", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  // ─── CRUD Danh mục ────────────────────────────────────────────────────────────

  const saveCategory = async () => {
    if (!user?.id) return;
    if (!categoryForm.categoryName.trim())
      return Alert.alert("Thiếu tên", "Nhập tên danh mục trước.");
    try {
      setActionId("category-save");
      if (editingCategoryId)
        await adminApi.updateAdminCategory?.(user.id, editingCategoryId, categoryForm);
      else await adminApi.saveAdminCategory?.(user.id, categoryForm);
      setCategoryForm(emptyCategoryForm);
      setEditingCategoryId(null);
      await load();
      Alert.alert("Đã lưu", "Danh mục đã được lưu.");
    } catch (e: any) {
      Alert.alert("Không lưu được", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  const deleteCategory = async (cat: AdminCategory) => {
    if (!user?.id) return;
    Alert.alert("Xác nhận", `Xóa danh mục "${cat.categoryName || cat.name}"?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            setActionId(`cat-${cat.id}`);
            await adminApi.deleteAdminCategory?.(user.id!, cat.id);
            await load();
          } catch (e: any) {
            Alert.alert("Không xóa được", e?.message || "Có lỗi xảy ra.");
          } finally {
            setActionId(null);
          }
        },
      },
    ]);
  };

  // ─── Cập nhật trạng thái đơn hàng ────────────────────────────────────────────

  const updateOrderStatus = async (order: AdminOrder, status: string) => {
    if (!user?.id) return;
    try {
      setActionId(`order-${order.id}`);
      await adminApi.updateAdminOrderStatus?.(user.id, order.id, status);
      await load();
    } catch (e: any) {
      Alert.alert("Không cập nhật được", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  // ─── CRUD Mã giảm giá ─────────────────────────────────────────────────────────

  const saveDiscount = async () => {
    if (!user?.id) return;
    if (!discountForm.code.trim())
      return Alert.alert("Thiếu mã", "Nhập mã giảm giá trước.");
    try {
      setActionId("discount-save");
      const body = {
        ...discountForm,
        discountValue: Number(discountForm.discountValue || 0),
        minOrderAmount: Number(discountForm.minOrderAmount || 0),
        maxDiscountAmount: Number(discountForm.maxDiscountAmount || 0),
        usageLimit: Number(discountForm.usageLimit || 0),
        active: true,
      };
      if (editingDiscountId)
        await api.updateAdminVoucher(user.id, editingDiscountId, body);
      else await api.saveAdminVoucher(user.id, body);
      setDiscountForm(emptyDiscountForm);
      setEditingDiscountId(null);
      await load();
      Alert.alert("Đã lưu", "Mã giảm giá đã được lưu.");
    } catch (e: any) {
      Alert.alert("Không lưu được", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  const toggleDiscount = async (discount: AdminDiscountCode) => {
    if (!user?.id) return;
    try {
      setActionId(`discount-toggle-${discount.id}`);
      await api.updateAdminVoucher(user.id, discount.id, {
        active: !discount.active,
        status: discount.active ? "inactive" : "active",
      });
      await load();
    } catch (e: any) {
      Alert.alert("Không đổi trạng thái", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  // ─── Quản lý đánh giá ─────────────────────────────────────────────────────────

  const deleteReview = async (review: AdminReview) => {
    if (!user?.id) return;
    Alert.alert("Xác nhận", "Xóa đánh giá này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            setActionId(`review-${review.id}`);
            await adminApi.deleteAdminReview?.(user.id!, review.id);
            await load();
          } catch (e: any) {
            Alert.alert("Không xóa được", e?.message || "Có lỗi xảy ra.");
          } finally {
            setActionId(null);
          }
        },
      },
    ]);
  };

  // ─── Quản lý người dùng ───────────────────────────────────────────────────────

  const changeRole = async (
    target: AdminUser,
    nextRole: "admin" | "customer"
  ) => {
    if (!user?.id) return;
    try {
      setActionId(target.id);
      const data = await api.setAdminUserRole(user.id, target.id, nextRole);
      setUsers((current) =>
        current.map((item) =>
          item.id === target.id ? { ...item, ...data.user } : item
        )
      );
      await load().catch(() => null);
      Alert.alert("Đã cập nhật", data?.message || "Đã đổi quyền tài khoản.");
    } catch (e: any) {
      Alert.alert("Không đổi được quyền", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  const adjustCoins = async (target: AdminUser, delta: number) => {
    if (!user?.id) return;
    try {
      setActionId(`coins-${target.id}`);
      const data = await api.adjustAdminUserCoins(user.id, target.id, delta);
      setUsers((current) =>
        current.map((item) =>
          item.id === target.id ? { ...item, ...data.user } : item
        )
      );
    } catch (e: any) {
      Alert.alert("Không chỉnh được xu", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  // ─── Banner ───────────────────────────────────────────────────────────────────

  const saveBanner = async () => {
    if (!user?.id || !bannerUrl.trim()) return;
    try {
      setActionId("banner-save");
      await api.saveAdminGame?.(user.id, { url: bannerUrl, link: bannerLink });
      setBannerUrl("");
      setBannerLink("");
      await load();
      Alert.alert("Đã lưu banner");
    } catch (e: any) {
      Alert.alert("Không lưu được", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  const deleteBanner = async (bannerId: string) => {
    if (!user?.id) return;
    try {
      setActionId(`banner-${bannerId}`);
      await adminApi.deleteAdminBanner?.(user.id, bannerId);
      await load();
    } catch (e: any) {
      Alert.alert("Không xóa được", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  // ─── Thông báo ────────────────────────────────────────────────────────────────

  const sendNotification = async () => {
    if (!user?.id) return;
    if (!notificationForm.title.trim())
      return Alert.alert("Thiếu tiêu đề", "Nhập tiêu đề thông báo.");
    try {
      setActionId("notification-send");
      const data = await api.sendAdminNotification(user.id, notificationForm);
      setNotificationForm(emptyNotificationForm);
      Alert.alert("Đã gửi", data?.message || "Thông báo đã được gửi.");
    } catch (e: any) {
      Alert.alert("Không gửi được", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  // ─── Upload ảnh Cloudinary ────────────────────────────────────────────────────

  const pickAndUpload = async (
    target:
      | "image"
      | "image2"
      | "image3"
      | "image4"
      | "bannerUrl"
      | "discountBanner"
  ) => {
    if (!user?.id) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return Alert.alert(
        "Cần quyền ảnh",
        "Cho phép truy cập thư viện để upload ảnh."
      );
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.86,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      setUploadingField(target);
      const data = await uploadMediaFile(
        {
          uri: asset.uri,
          name: asset.fileName || `${target}-${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
        },
        user.id,
        target === "bannerUrl" || target === "discountBanner"
          ? "admin/banners"
          : "admin/products",
        "admin-upload",
        user.id
      );
      const url = data.secureUrl || data.url;
      if (!url) throw new Error("Cloudinary không trả về URL ảnh.");
      if (target === "bannerUrl") setBannerUrl(url);
      else if (target === "discountBanner")
        setDiscountForm((p) => ({ ...p, bannerImage: url }));
      else setProductForm((p) => ({ ...p, [target]: url }));
      Alert.alert("Upload thành công", "Ảnh đã được lưu trên Cloudinary.");
    } catch (e: any) {
      Alert.alert("Upload lỗi", e?.message || "Không upload được ảnh.");
    } finally {
      setUploadingField(null);
    }
  };

  // ─── Guard ────────────────────────────────────────────────────────────────────

  if (!isLoggedIn || !isAdmin) {
    return (
      <View style={styles.authPage}>
        <View style={styles.authCard}>
          <View style={styles.logoBox}>
            <Feather
              name={isLoggedIn ? "lock" : "shield"}
              size={26}
              color="#fff"
            />
          </View>
          <Text style={styles.authTitle}>
            {isLoggedIn ? "Không có quyền admin" : "Đăng nhập admin"}
          </Text>
          <Text style={styles.authText}>
            {isLoggedIn
              ? `Email hiện tại: ${user?.email}. Hãy dùng tài khoản admin.`
              : "Tài khoản admin mặc định: a@gmail.com / mật khẩu 1."}
          </Text>
          <Pressable onPress={openAdminLogin} style={styles.authButton}>
            <Text style={styles.authButtonText}>
              {isLoggedIn ? "Đổi tài khoản" : "Đăng nhập"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Sidebar ──────────────────────────────────────────────────────────────────

  const Sidebar = () => {
    let lastGroup = "";
    return (
      <View
        style={[styles.sidebar, !desktop ? styles.sidebarMobile : null]}
      >
        <View style={styles.sidebarLogoRow}>
          <View style={styles.sidebarLogo}>
            <Feather name="zap" size={19} color="#fff" />
          </View>
          <View>
            <Text style={styles.sidebarBrand}>JAPANO</Text>
            <Text style={styles.sidebarSub}>QUẢN TRỊ</Text>
          </View>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            desktop ? styles.navContent : styles.navContentMobile
          }
          horizontal={!desktop}
        >
          {navItems.map((item) => {
            const showGroup = desktop && item.group !== lastGroup;
            lastGroup = item.group;
            const active = activeTab === item.key;
            return (
              <React.Fragment key={item.key}>
                {showGroup ? (
                  <Text style={styles.navGroup}>{item.group}</Text>
                ) : null}
                <Pressable
                  onPress={() => setActiveTab(item.key)}
                  style={[
                    styles.navItem,
                    active ? styles.navItemActive : null,
                  ]}
                >
                  <Feather
                    name={item.icon}
                    size={17}
                    color={active ? ADMIN_GREEN : ADMIN_MUTED_DARK}
                  />
                  <Text
                    style={[
                      styles.navText,
                      active ? styles.navTextActive : null,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.badge ? (
                    <Text style={styles.navBadge}>{item.badge}</Text>
                  ) : null}
                </Pressable>
              </React.Fragment>
            );
          })}
        </ScrollView>
        {desktop ? (
          <View style={styles.sidebarUser}>
            <View style={styles.sidebarAvatar}>
              <Text style={styles.sidebarAvatarText}>
                {String(user?.email || "A")
                  .slice(0, 1)
                  .toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.sidebarUserName}>
                {user?.email}
              </Text>
              <Text style={styles.sidebarUserRole}>Quản trị viên</Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  // ─── Topbar ───────────────────────────────────────────────────────────────────

  const Topbar = () => (
    <View style={styles.topbar}>
      <View style={styles.searchBox}>
        <Feather name="search" size={18} color={ADMIN_MUTED} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm sản phẩm, người dùng, đơn hàng..."
          placeholderTextColor={ADMIN_MUTED}
          style={styles.searchInput}
        />
      </View>
      <Pressable onPress={refresh} style={styles.topIconBtn}>
        <Feather name="refresh-cw" size={18} color={ADMIN_TEXT} />
      </Pressable>
      <Pressable
        onPress={() => setActiveTab("sanpham")}
        style={styles.newOrderBtn}
      >
        <Feather name="plus" size={16} color="#fff" />
        <Text style={styles.newOrderText}>Thêm sản phẩm</Text>
      </Pressable>
    </View>
  );

  // ─── Tab: Tổng quan ───────────────────────────────────────────────────────────

  const renderTongQuan = () => (
    <View style={styles.pageGap}>
      <View style={styles.heroCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>
            Chào mừng, {user?.name || user?.email?.split("@")[0] || "Admin"}!
          </Text>
          <Text style={styles.heroSub}>
            {formatNumber(orders.length)} đơn hàng • {formatNumber(products.length)} sản phẩm •{" "}
            {formatNumber(users.length)} khách hàng
          </Text>
        </View>
        <Pressable
          onPress={() => setActiveTab("thongke")}
          style={styles.heroButton}
        >
          <Text style={styles.heroButtonText}>Xem thống kê</Text>
          <Feather name="arrow-right" size={16} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          label="Tổng doanh thu"
          value={formatCompactMoney(kpis.revenueTotal || totalRevenue)}
          change="↗ +12.5%"
          icon="dollar-sign"
          accent={ADMIN_GREEN}
          trend={revenueByMonth}
        />
        <StatCard
          label="Đơn hàng"
          value={formatNumber(kpis.orders || orders.length)}
          change={`${pendingOrders} chờ xử lý`}
          icon="shopping-bag"
          accent={ADMIN_BLUE}
        />
        <StatCard
          label="Khách hàng"
          value={formatNumber(kpis.users || users.length)}
          change="↗ +5.1%"
          icon="users"
          accent="#00A6A6"
        />
        <StatCard
          label="Sản phẩm"
          value={formatNumber(kpis.products || products.length)}
          change={`${activeProducts} đang bán`}
          icon="package"
          accent={ADMIN_ORANGE}
        />
      </View>

      <View style={styles.dashboardGrid}>
        <View style={[styles.card, styles.bigChartCard]}>
          <SectionHeader
            title="Doanh thu theo tháng"
            subtitle="Tăng trưởng doanh thu"
            right={
              <View style={styles.segment}>
                <Text style={styles.segmentActive}>Tháng</Text>
                <Text style={styles.segmentText}>Năm</Text>
              </View>
            }
          />
          <MiniBars
            data={
              revenueByMonth.length ? revenueByMonth : miniTrendData([])
            }
            accent={ADMIN_GREEN}
            money
          />
        </View>
        <View style={styles.card}>
          <SectionHeader title="Mục tiêu tháng" subtitle="Tiến độ doanh thu" />
          <View style={styles.goalCircle}>
            <Text style={styles.goalNumber}>72%</Text>
            <Text style={styles.goalText}>Mục tiêu</Text>
          </View>
          <Text style={styles.centerMuted}>
            {formatCompactMoney(kpis.monthRevenue)} /{" "}
            {formatCompactMoney(
              Number(kpis.monthRevenue || 0) / 0.72 || 0
            )}
          </Text>
        </View>
      </View>

      <View style={styles.dashboardGrid3}>
        <View style={styles.card}>
          <SectionHeader
            title="Sản phẩm bán chạy"
            subtitle="Theo số lượng đã bán"
          />
          <HorizontalBars
            data={topProducts.map((x: any) => ({
              label: x.name,
              value: x.unitsSold,
            }))}
            accent={ADMIN_GREEN}
          />
        </View>
        <View style={styles.card}>
          <SectionHeader
            title="Đơn hàng gần đây"
            subtitle="5 đơn mới nhất"
          />
          <View style={{ gap: 13 }}>
            {orders.slice(0, 5).map((order, idx) => (
              <View
                key={`${order.id}-${idx}`}
                style={styles.activityRow}
              >
                <View style={styles.activityIcon}>
                  <Feather
                    name="shopping-bag"
                    size={16}
                    color={ADMIN_GREEN}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle}>
                    #{String(order.id).slice(-8)}{" "}
                    •{" "}
                    {formatMoney(order.totalAmount || order.total)}
                  </Text>
                  <Text style={styles.activityMeta}>
                    {order.orderStatus || order.status || "pending"} •{" "}
                    {compactDate(order.orderDate || order.createdAt)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setActiveTab("donhang")}
                  style={styles.smallBtn}
                >
                  <Text style={styles.smallBtnText}>Xem</Text>
                </Pressable>
              </View>
            ))}
            {!orders.length ? (
              <Text style={styles.emptyText}>Chưa có đơn hàng.</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.card}>
          <SectionHeader
            title="Đánh giá gần đây"
            subtitle="Phản hồi của khách"
          />
          <View style={{ gap: 13 }}>
            {reviews.slice(0, 4).map((r, idx) => (
              <View key={`${r.id}-${idx}`} style={styles.activityRow}>
                <View style={styles.activityIcon}>
                  <Feather name="star" size={16} color={ADMIN_ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <RatingStars rating={r.rating} />
                  <Text
                    numberOfLines={1}
                    style={styles.activityMeta}
                  >
                    {r.comment || "Không có nhận xét"}
                  </Text>
                </View>
              </View>
            ))}
            {!reviews.length ? (
              <Text style={styles.emptyText}>Chưa có đánh giá.</Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );

  // ─── Tab: Thống kê doanh thu ──────────────────────────────────────────────────

  const renderThongKe = () => (
    <View style={styles.pageGap}>
      <SectionHeader
        title="Thống kê doanh thu"
        subtitle="Phân tích chi tiết doanh thu, đơn hàng và sản phẩm."
      />
      <View style={styles.statsGrid}>
        <StatCard
          label="Tổng doanh thu"
          value={formatCompactMoney(kpis.revenueTotal || totalRevenue)}
          change="↗ +12.5%"
          icon="dollar-sign"
          accent={ADMIN_GREEN}
        />
        <StatCard
          label="Tổng đơn hàng"
          value={formatNumber(orders.length)}
          change={`${pendingOrders} chờ`}
          icon="shopping-bag"
          accent={ADMIN_BLUE}
        />
        <StatCard
          label="Đơn thành công"
          value={formatNumber(
            orders.filter(
              (o) =>
                o.orderStatus === "completed" || o.status === "completed"
            ).length
          )}
          change="↗ +8.2%"
          icon="check-circle"
          accent={ADMIN_GREEN}
        />
        <StatCard
          label="Tổng thanh toán"
          value={formatNumber(payments.length)}
          change={`${formatCompactMoney(totalRevenue)} thành công`}
          icon="credit-card"
          accent={ADMIN_ORANGE}
        />
      </View>
      <View style={styles.dashboardGrid}>
        <View style={[styles.card, styles.bigChartCard]}>
          <SectionHeader
            title="Doanh thu theo tháng"
            subtitle="Biểu đồ tăng trưởng"
          />
          <MiniBars
            data={
              revenueByMonth.length ? revenueByMonth : miniTrendData([])
            }
            accent={ADMIN_GREEN}
            money
          />
        </View>
        <View style={styles.card}>
          <SectionHeader
            title="Sản phẩm bán chạy"
            subtitle="Top theo doanh số"
          />
          <HorizontalBars
            data={topProducts.slice(0, 6).map((x: any) => ({
              label: x.name,
              value: x.unitsSold || x.revenue,
            }))}
            accent={ADMIN_GREEN}
          />
        </View>
      </View>
      <View style={[styles.card]}>
        <SectionHeader
          title="Danh sách thanh toán"
          subtitle="Giao dịch gần đây"
        />
        {payments.length ? (
          payments.map((payment) => (
            <View key={payment.id} style={styles.paymentRow}>
              <View style={styles.paymentIcon}>
                <Feather name="credit-card" size={16} color={ADMIN_GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentTitle}>
                  {formatMoney(payment.amount)}
                </Text>
                <Text style={styles.paymentMeta}>
                  {payment.paymentMethod || "Thanh toán"} •{" "}
                  {payment.status} •{" "}
                  {compactDate(payment.createdAt)}
                </Text>
                <Text numberOfLines={1} style={styles.paymentMeta}>
                  Mã GD: {payment.transactionId || "--"} • User:{" "}
                  {payment.userId || "--"}
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  payment.status === "success" ||
                    payment.status === "completed"
                    ? styles.statusOn
                    : styles.statusOff,
                ]}
              >
                <Text style={styles.statusText}>
                  {payment.status === "success" ||
                    payment.status === "completed"
                    ? "Thành công"
                    : payment.status || "Chờ"}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Chưa có giao dịch.</Text>
        )}
      </View>
    </View>
  );

  // ─── Tab: Quản lý sản phẩm ───────────────────────────────────────────────────

  const renderSanPham = () => (
    <View style={styles.pageGap}>
      <SectionHeader
        title="Quản lý sản phẩm"
        subtitle="Thêm, sửa, ẩn sản phẩm. Quản lý ảnh, size, màu sắc, giá và khuyến mãi."
        right={
          <Text style={styles.counterPill}>
            {activeProducts} đang bán / {hiddenProducts} ẩn
          </Text>
        }
      />
      <View style={styles.productManagerGrid}>
        <View style={[styles.card, styles.formCard]}>
          <Text style={styles.formTitle}>
            {editingProductId
              ? `Đang sửa: ${editingProductId}`
              : "Thêm sản phẩm mới"}
          </Text>
          <View style={styles.formGrid2}>
            <Input
              label="Mã sản phẩm (ProductID)"
              value={productForm.id}
              onChangeText={(id: string) =>
                setProductForm((p) => ({ ...p, id }))
              }
              placeholder="jp-kimono-001"
            />
            <Input
              label="Mã SKU"
              value={productForm.sku}
              onChangeText={(sku: string) =>
                setProductForm((p) => ({ ...p, sku }))
              }
              placeholder="JP-001"
            />
          </View>
          <Input
            label="Tên sản phẩm (ProductName)"
            value={productForm.name}
            onChangeText={(name: string) =>
              setProductForm((p) => ({ ...p, name }))
            }
            placeholder="Áo kimono truyền thống Nhật"
          />
          <View style={styles.formGrid2}>
            <Input
              label="Danh mục (CategoryID)"
              value={productForm.categoryId}
              onChangeText={(categoryId: string) =>
                setProductForm((p) => ({ ...p, categoryId }))
              }
              placeholder={
                categories.length
                  ? categories[0].id || ""
                  : "fashion"
              }
            />
            <Input
              label="Trạng thái"
              value={productForm.status}
              onChangeText={(status: string) =>
                setProductForm((p) => ({ ...p, status }))
              }
              placeholder="active / inactive"
            />
          </View>
          <View style={styles.formGrid3}>
            <Input
              label="Giá bán (Price)"
              value={productForm.price}
              keyboardType="numeric"
              onChangeText={(price: string) =>
                setProductForm((p) => ({ ...p, price }))
              }
              placeholder="250000"
            />
            <Input
              label="Giá gốc (gạch)"
              value={productForm.originalPrice}
              keyboardType="numeric"
              onChangeText={(originalPrice: string) =>
                setProductForm((p) => ({ ...p, originalPrice }))
              }
              placeholder="300000"
            />
            <Input
              label="% giảm giá"
              value={productForm.discountPercent}
              keyboardType="numeric"
              onChangeText={(discountPercent: string) =>
                setProductForm((p) => ({ ...p, discountPercent }))
              }
              placeholder="17"
            />
          </View>
          <View style={styles.formGrid2}>
            <Input
              label="Nhãn giảm giá"
              value={productForm.discountLabel}
              onChangeText={(discountLabel: string) =>
                setProductForm((p) => ({ ...p, discountLabel }))
              }
              placeholder="Flash Sale"
            />
            <Input
              label="Badge hiển thị"
              value={productForm.badge}
              onChangeText={(badge: string) =>
                setProductForm((p) => ({ ...p, badge }))
              }
              placeholder="GIẢM 17%"
            />
          </View>
          <View style={styles.formGrid2}>
            <Input
              label="Ảnh chính (Image 1)"
              value={productForm.image}
              onChangeText={(image: string) =>
                setProductForm((p) => ({ ...p, image }))
              }
              placeholder="https://..."
            />
            <Input
              label="Ảnh 2"
              value={productForm.image2}
              onChangeText={(image2: string) =>
                setProductForm((p) => ({ ...p, image2 }))
              }
              placeholder="https://..."
            />
          </View>
          <View style={styles.formGrid2}>
            <Input
              label="Ảnh 3"
              value={productForm.image3}
              onChangeText={(image3: string) =>
                setProductForm((p) => ({ ...p, image3 }))
              }
              placeholder="https://..."
            />
            <Input
              label="Ảnh 4"
              value={productForm.image4}
              onChangeText={(image4: string) =>
                setProductForm((p) => ({ ...p, image4 }))
              }
              placeholder="https://..."
            />
          </View>
          <View style={styles.mediaUploadBox}>
            <Text style={styles.mediaUploadTitle}>
              Upload ảnh sản phẩm lên Cloudinary
            </Text>
            <Text style={styles.mediaUploadHint}>
              Chọn ảnh từ thiết bị, hệ thống upload lên Cloudinary và tự điền URL.
            </Text>
            <View style={styles.actionRow}>
              {(["image", "image2", "image3", "image4"] as const).map(
                (field, index) => (
                  <Pressable
                    key={field}
                    disabled={uploadingField === field}
                    onPress={() => pickAndUpload(field)}
                    style={styles.smallBtn}
                  >
                    <Text style={styles.smallBtnText}>
                      {uploadingField === field
                        ? "Đang upload..."
                        : `Upload ảnh ${index + 1}`}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          </View>
          <Input
            label="Mô tả sản phẩm (Description)"
            value={productForm.description}
            onChangeText={(description: string) =>
              setProductForm((p) => ({ ...p, description }))
            }
            placeholder="Mô tả chi tiết sản phẩm..."
            multiline
          />
          <Input
            label="Câu chuyện sản phẩm (Story)"
            value={productForm.story}
            onChangeText={(story: string) =>
              setProductForm((p) => ({ ...p, story }))
            }
            placeholder="Nguồn gốc, ý nghĩa sản phẩm..."
            multiline
          />
          <View style={styles.formGrid3}>
            <Input
              label="Tồn kho (StockQuantity)"
              value={productForm.stockQuantity}
              keyboardType="numeric"
              onChangeText={(stockQuantity: string) =>
                setProductForm((p) => ({ ...p, stockQuantity }))
              }
              placeholder="999"
            />
            <Input
              label="Size / kích cỡ"
              value={productForm.sizes}
              onChangeText={(sizes: string) =>
                setProductForm((p) => ({ ...p, sizes }))
              }
              placeholder="S, M, L, XL"
            />
            <Input
              label="Màu sắc"
              value={productForm.colors}
              onChangeText={(colors: string) =>
                setProductForm((p) => ({ ...p, colors }))
              }
              placeholder="Đen, Trắng, Kem"
            />
          </View>
          <View style={styles.formGrid2}>
            <Input
              label="Kích thước (Dimensions)"
              value={productForm.dimensions}
              onChangeText={(dimensions: string) =>
                setProductForm((p) => ({ ...p, dimensions }))
              }
              placeholder="Dài 68cm, vai 46cm..."
            />
            <Input
              label="Form / kiểu dáng (Fit)"
              value={productForm.fit}
              onChangeText={(fit: string) =>
                setProductForm((p) => ({ ...p, fit }))
              }
              placeholder="Regular / Oversize / Slim"
            />
          </View>
          <View style={styles.formGrid2}>
            <Input
              label="Thẻ hình ảnh (VisualTags)"
              value={productForm.visualTags}
              onChangeText={(visualTags: string) =>
                setProductForm((p) => ({ ...p, visualTags }))
              }
              placeholder="japanese, black, minimal"
            />
            <Input
              label="Phong cách sử dụng"
              value={productForm.styleUseCase}
              onChangeText={(styleUseCase: string) =>
                setProductForm((p) => ({ ...p, styleUseCase }))
              }
              placeholder="Đi chơi, chụp ảnh, cosplay"
            />
          </View>
          <View style={styles.actionRow}>
            <Pressable
              disabled={actionId === "product-save"}
              onPress={saveProduct}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>
                {actionId === "product-save"
                  ? "Đang lưu..."
                  : editingProductId
                    ? "Cập nhật sản phẩm"
                    : "Thêm sản phẩm"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setProductForm(emptyProductForm);
                setEditingProductId(null);
              }}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>Xóa form</Text>
            </Pressable>
          </View>
        </View>
        <ProductPreview
          name={productForm.name}
          price={Number(productForm.price || 0)}
          originalPrice={Number(productForm.originalPrice || 0)}
          discountPercent={Number(productForm.discountPercent || 0)}
          image={productForm.image}
          images={[
            productForm.image,
            productForm.image2,
            productForm.image3,
            productForm.image4,
          ]}
          sizes={productForm.sizes}
          colors={productForm.colors}
          dimensions={productForm.dimensions}
        />
      </View>

      <View style={styles.productListGrid}>
        {filteredProducts.map((product) => {
          const hidden = (product.status || "active") !== "active";
          const discount = calcDiscount(product);
          const gallery = adminGalleryImages(product);
          const sizes = splitAdminList(product.sizes);
          const colors = splitAdminList(product.colors);
          return (
            <View key={product.id} style={styles.productCard}>
              <View style={styles.productTop}>
                {gallery[0] ? (
                  <Image
                    source={{ uri: gallery[0] }}
                    style={styles.productImage}
                  />
                ) : (
                  <View style={styles.productImage}>
                    <Feather name="image" size={22} color={ADMIN_MUTED} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.productTitle}>
                    {product.name || product.productName}
                  </Text>
                  <Text style={styles.productMeta}>
                    ID: {product.id} • SKU: {product.sku || "--"}
                  </Text>
                  <Text style={styles.productMeta}>
                    Danh mục: {product.categoryId || product.category || "--"}
                  </Text>
                  <View style={styles.productPriceLine}>
                    <Text style={styles.productPrice}>
                      {formatMoney(product.price)}
                    </Text>
                    {Number(product.originalPrice || 0) >
                      Number(product.price || 0) ? (
                      <Text style={styles.productOldPrice}>
                        {formatMoney(product.originalPrice)}
                      </Text>
                    ) : null}
                    {discount > 0 ? (
                      <Text style={styles.discountBadge}>
                        -{discount}%
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.productMeta}>
                    Trạng thái:{" "}
                    {hidden ? "Đang ẩn" : "Đang bán"} • Tồn kho:{" "}
                    {product.stockQuantity ?? "--"}
                  </Text>
                </View>
              </View>
              <Text numberOfLines={2} style={styles.productDesc}>
                {product.description || "Chưa có mô tả."}
              </Text>
              <View style={styles.adminThumbRow}>
                {gallery.map((url, index) => (
                  <Image
                    key={`${product.id}-thumb-${index}`}
                    source={{ uri: url }}
                    style={styles.adminThumb}
                  />
                ))}
              </View>
              <Text style={styles.productMeta}>
                Size:{" "}
                {sizes.length ? sizes.join(" / ") : "S / M / L / XL"} •
                Màu:{" "}
                {colors.length ? colors.join(" / ") : "Đen / Trắng / Kem"}
              </Text>
              {product.dimensions || product.fit ? (
                <Text style={styles.productMeta}>
                  Kích thước: {product.dimensions || "--"} • Form:{" "}
                  {product.fit || "--"}
                </Text>
              ) : null}
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => editProduct(product)}
                  style={styles.smallBtn}
                >
                  <Text style={styles.smallBtnText}>Sửa</Text>
                </Pressable>
                <Pressable
                  disabled={!!actionId?.startsWith(`hide-${product.id}`)}
                  onPress={() => toggleProduct(product)}
                  style={styles.smallBtn}
                >
                  <Text style={styles.smallBtnText}>
                    {hidden ? "Hiện" : "Ẩn"}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={!!actionId?.startsWith(`discount-${product.id}`)}
                  onPress={() => quickDiscount(product, 10)}
                  style={styles.saleBtn}
                >
                  <Text style={styles.saleBtnText}>Sale -10%</Text>
                </Pressable>
                <Pressable
                  onPress={() => quickDiscount(product, 20)}
                  style={styles.saleBtn}
                >
                  <Text style={styles.saleBtnText}>Sale -20%</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        {!filteredProducts.length ? (
          <Text style={styles.emptyText}>Chưa có sản phẩm nào.</Text>
        ) : null}
      </View>
    </View>
  );

  // ─── Tab: Quản lý danh mục ────────────────────────────────────────────────────

  const renderDanhMuc = () => (
    <View style={styles.pageGap}>
      <SectionHeader
        title="Quản lý danh mục"
        subtitle="Thêm, sửa, xóa danh mục sản phẩm (Categories)."
        right={
          <Text style={styles.counterPill}>
            {categories.length} danh mục
          </Text>
        }
      />
      <View style={styles.promoGrid}>
        <View style={styles.card}>
          <Text style={styles.formTitle}>
            {editingCategoryId ? "Sửa danh mục" : "Thêm danh mục mới"}
          </Text>
          <Input
            label="Mã danh mục (CategoryID)"
            value={categoryForm.categoryId}
            onChangeText={(categoryId: string) =>
              setCategoryForm((p) => ({ ...p, categoryId }))
            }
            placeholder="fashion, home-decor..."
          />
          <Input
            label="Tên danh mục (CategoryName)"
            value={categoryForm.categoryName}
            onChangeText={(categoryName: string) =>
              setCategoryForm((p) => ({ ...p, categoryName }))
            }
            placeholder="Thời trang, Đồ gia dụng..."
          />
          <Input
            label="Mô tả"
            value={categoryForm.description}
            onChangeText={(description: string) =>
              setCategoryForm((p) => ({ ...p, description }))
            }
            placeholder="Mô tả danh mục..."
            multiline
          />
          <View style={styles.actionRow}>
            <Pressable
              disabled={actionId === "category-save"}
              onPress={saveCategory}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>
                {actionId === "category-save"
                  ? "Đang lưu..."
                  : editingCategoryId
                    ? "Cập nhật"
                    : "Thêm danh mục"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setCategoryForm(emptyCategoryForm);
                setEditingCategoryId(null);
              }}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>Xóa form</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <SectionHeader
            title="Danh sách danh mục"
            subtitle="Tất cả danh mục hiện có"
          />
          {categories.length ? (
            categories.map((cat) => (
              <View key={cat.id} style={styles.voucherRow}>
                <View style={styles.voucherIcon}>
                  <Feather name="layers" size={17} color={ADMIN_GREEN} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.voucherCode}>
                    {cat.categoryName || cat.name}
                  </Text>
                  <Text style={styles.voucherMeta}>
                    ID: {cat.id || cat.categoryId} •{" "}
                    {cat.description || "Không có mô tả"}
                  </Text>
                </View>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => {
                      setEditingCategoryId(cat.id);
                      setCategoryForm({
                        categoryId: cat.categoryId || cat.id || "",
                        categoryName: cat.categoryName || cat.name || "",
                        description: cat.description || "",
                      });
                    }}
                    style={styles.smallBtn}
                  >
                    <Text style={styles.smallBtnText}>Sửa</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => deleteCategory(cat)}
                    style={styles.dangerBtn}
                  >
                    <Text style={styles.dangerBtnText}>Xóa</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Chưa có danh mục.</Text>
          )}
        </View>
      </View>
    </View>
  );

  // ─── Tab: Quản lý đơn hàng ───────────────────────────────────────────────────

  const ORDER_STATUSES = [
    "pending",
    "confirmed",
    "shipping",
    "completed",
    "cancelled",
  ];
  const ORDER_STATUS_LABELS: Record<string, string> = {
    pending: "Chờ xử lý",
    confirmed: "Đã xác nhận",
    shipping: "Đang giao",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
  };
  const ORDER_STATUS_COLORS: Record<string, string> = {
    pending: ADMIN_ORANGE,
    confirmed: ADMIN_BLUE,
    shipping: "#00A6A6",
    completed: ADMIN_GREEN,
    cancelled: ADMIN_RED,
  };

  const renderDonHang = () => (
    <View style={styles.pageGap}>
      <SectionHeader
        title="Quản lý đơn hàng"
        subtitle="Xem và cập nhật trạng thái đơn hàng, thông tin giao hàng, thanh toán."
        right={
          <Text style={styles.counterPill}>
            {orders.length} đơn • {pendingOrders} chờ xử lý
          </Text>
        }
      />
      <View style={styles.statsGrid}>
        {ORDER_STATUSES.map((status) => {
          const count = orders.filter(
            (o) => (o.orderStatus || o.status) === status
          ).length;
          return (
            <View key={status} style={styles.statCard}>
              <View style={styles.statTop}>
                <View>
                  <Text style={styles.statLabel}>
                    {ORDER_STATUS_LABELS[status]}
                  </Text>
                  <Text
                    style={[
                      styles.statValue,
                      { color: ORDER_STATUS_COLORS[status] },
                    ]}
                  >
                    {formatNumber(count)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statIcon,
                    {
                      backgroundColor: `${ORDER_STATUS_COLORS[status]}18`,
                    },
                  ]}
                >
                  <Feather
                    name="shopping-bag"
                    size={20}
                    color={ORDER_STATUS_COLORS[status]}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.tableCard}>
        {filteredOrders.length ? (
          filteredOrders.map((order) => {
            const status = order.orderStatus || order.status || "pending";
            const statusColor =
              ORDER_STATUS_COLORS[status] || ADMIN_MUTED;
            return (
              <View key={order.id} style={styles.orderRow}>
                <View style={styles.paymentIcon}>
                  <Feather
                    name="shopping-bag"
                    size={16}
                    color={statusColor}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.paymentTitle}>
                    Đơn #{String(order.id).slice(-10)} •{" "}
                    {formatMoney(order.totalAmount || order.total)}
                  </Text>
                  <Text style={styles.paymentMeta}>
                    Khách: {order.userId || "--"} • SĐT:{" "}
                    {order.phoneNumber || "--"}
                  </Text>
                  <Text numberOfLines={1} style={styles.paymentMeta}>
                    Địa chỉ:{" "}
                    {order.shippingAddress || "--"} •{" "}
                    {compactDate(order.orderDate || order.createdAt)}
                  </Text>
                  <Text style={styles.paymentMeta}>
                    Thanh toán: {order.paymentStatus || "--"} • Mã giảm
                    giá: {order.discountCodeId || "Không có"}
                  </Text>
                </View>
                <View style={{ gap: 8, alignItems: "flex-end" }}>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: `${statusColor}18` },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {ORDER_STATUS_LABELS[status] || status}
                    </Text>
                  </View>
                  <View style={styles.actionRow}>
                    {ORDER_STATUSES.filter((s) => s !== status).map(
                      (nextStatus) => (
                        <Pressable
                          key={nextStatus}
                          disabled={
                            actionId === `order-${order.id}`
                          }
                          onPress={() =>
                            updateOrderStatus(order, nextStatus)
                          }
                          style={[
                            styles.smallBtn,
                            {
                              borderColor:
                                ORDER_STATUS_COLORS[nextStatus],
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.smallBtnText,
                              {
                                color:
                                  ORDER_STATUS_COLORS[nextStatus],
                              },
                            ]}
                          >
                            → {ORDER_STATUS_LABELS[nextStatus]}
                          </Text>
                        </Pressable>
                      )
                    )}
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={{ padding: 20 }}>
            <Text style={styles.emptyText}>Chưa có đơn hàng.</Text>
          </View>
        )}
      </View>
    </View>
  );

  // ─── Tab: Quản lý người dùng ─────────────────────────────────────────────────

  const renderNguoiDung = () => (
    <View style={styles.pageGap}>
      <SectionHeader
        title="Quản lý người dùng"
        subtitle="Xem thông tin, phân quyền admin và điều chỉnh xu của khách hàng."
        right={
          <Text style={styles.counterPill}>
            {users.length} tài khoản
          </Text>
        }
      />
      <View style={styles.card}>
        <SectionHeader
          title="Gửi thông báo chung"
          subtitle="Thông báo đến tất cả người dùng (Notifications)"
        />
        <View style={styles.formGrid2}>
          <Input
            label="Tiêu đề (Title)"
            value={notificationForm.title}
            onChangeText={(title: string) =>
              setNotificationForm((p) => ({ ...p, title }))
            }
            placeholder="Flash Sale 50% hôm nay!"
          />
          <Input
            label="Nội dung (Content)"
            value={notificationForm.content}
            onChangeText={(content: string) =>
              setNotificationForm((p) => ({ ...p, content }))
            }
            placeholder="Mở app ngay để nhận voucher..."
          />
        </View>
        <Pressable
          disabled={actionId === "notification-send"}
          onPress={sendNotification}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>
            {actionId === "notification-send"
              ? "Đang gửi..."
              : "Gửi thông báo cho tất cả"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.tableCard}>
        {filteredUsers.map((item) => {
          const isSelf = item.id === user?.id;
          const isItemAdmin = item.role === "admin";
          const canGrant = !isItemAdmin;
          const canRevoke =
            isItemAdmin && !isSelf && !item.isProtectedAdmin;
          return (
            <View key={item.id} style={styles.userRow}>
              <View
                style={[
                  styles.userAvatar,
                  isItemAdmin ? styles.userAvatarAdmin : null,
                ]}
              >
                <Feather
                  name={isItemAdmin ? "shield" : "user"}
                  size={18}
                  color={isItemAdmin ? "#fff" : ADMIN_GREEN}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.userName}>
                  {item.fullName || item.name || "Thành viên JAPANO"}
                </Text>
                <Text numberOfLines={1} style={styles.userEmail}>
                  {item.email}
                </Text>
                <Text style={styles.userMeta}>
                  SĐT: {item.phone || "--"} • Trạng thái:{" "}
                  {item.status || "active"} • Xu:{" "}
                  {formatNumber(item.coins)}
                  {item.vip ? " • VIP" : ""}
                </Text>
                {item.address ? (
                  <Text numberOfLines={1} style={styles.userMeta}>
                    Địa chỉ: {item.address}
                  </Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.rolePill,
                  isItemAdmin ? styles.roleAdmin : null,
                ]}
              >
                <Text
                  style={[
                    styles.rolePillText,
                    isItemAdmin ? styles.rolePillTextAdmin : null,
                  ]}
                >
                  {isItemAdmin ? "ADMIN" : "KHÁCH"}
                </Text>
              </View>
              <View style={styles.userActions}>
                <Pressable
                  onPress={() => adjustCoins(item, 100)}
                  style={styles.smallBtn}
                >
                  <Text style={styles.smallBtnText}>+100 xu</Text>
                </Pressable>
                <Pressable
                  onPress={() => adjustCoins(item, -100)}
                  style={styles.smallBtn}
                >
                  <Text style={styles.smallBtnText}>-100 xu</Text>
                </Pressable>
                {canGrant ? (
                  <Pressable
                    onPress={() => changeRole(item, "admin")}
                    style={styles.saleBtn}
                  >
                    <Text style={styles.saleBtnText}>Cấp admin</Text>
                  </Pressable>
                ) : null}
                {canRevoke ? (
                  <Pressable
                    onPress={() => changeRole(item, "customer")}
                    style={styles.dangerBtn}
                  >
                    <Text style={styles.dangerBtnText}>Gỡ admin</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
        {!filteredUsers.length ? (
          <View style={{ padding: 20 }}>
            <Text style={styles.emptyText}>Không tìm thấy người dùng.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  // ─── Tab: Quản lý mã giảm giá ────────────────────────────────────────────────

  const renderGiamGia = () => (
    <View style={styles.pageGap}>
      <SectionHeader
        title="Quản lý mã giảm giá"
        subtitle="Tạo và quản lý DiscountCodes theo ERD: Code, DiscountValue/Type, ExpiryDate, MinOrderAmount, MaxDiscountAmount, UsageLimit."
        right={
          <Text style={styles.counterPill}>
            {activeDiscounts} đang hoạt động / {discountCodes.length} tổng
          </Text>
        }
      />
      <View style={styles.promoGrid}>
        <View style={[styles.card, styles.formCard]}>
          <Text style={styles.formTitle}>
            {editingDiscountId
              ? "Sửa mã giảm giá"
              : "Thêm mã giảm giá mới"}
          </Text>
          <View style={styles.formGrid2}>
            <Input
              label="Mã giảm giá (Code)"
              value={discountForm.code}
              onChangeText={(code: string) =>
                setDiscountForm((p) => ({ ...p, code }))
              }
              placeholder="JAPANO50"
            />
            <Input
              label="Tên / tiêu đề"
              value={discountForm.title}
              onChangeText={(title: string) =>
                setDiscountForm((p) => ({ ...p, title }))
              }
              placeholder="Giảm cho khách mới"
            />
          </View>
          <View style={styles.actionRow}>
            <Text style={[styles.inputLabel, { marginRight: 8 }]}>
              Loại giảm giá:
            </Text>
            <SelectChip
              active={discountForm.discountType === "percent"}
              label="Theo % (Percent)"
              onPress={() =>
                setDiscountForm((p) => ({
                  ...p,
                  discountType: "percent",
                }))
              }
            />
            <SelectChip
              active={discountForm.discountType === "fixed"}
              label="Theo tiền (Fixed)"
              onPress={() =>
                setDiscountForm((p) => ({
                  ...p,
                  discountType: "fixed",
                }))
              }
            />
          </View>
          <View style={styles.formGrid3}>
            <Input
              label="Giá trị giảm (DiscountValue)"
              value={discountForm.discountValue}
              keyboardType="numeric"
              onChangeText={(discountValue: string) =>
                setDiscountForm((p) => ({ ...p, discountValue }))
              }
              placeholder="20 hoặc 50000"
            />
            <Input
              label="Đơn tối thiểu (MinOrderAmount)"
              value={discountForm.minOrderAmount}
              keyboardType="numeric"
              onChangeText={(minOrderAmount: string) =>
                setDiscountForm((p) => ({ ...p, minOrderAmount }))
              }
              placeholder="300000"
            />
            <Input
              label="Giảm tối đa (MaxDiscountAmount)"
              value={discountForm.maxDiscountAmount}
              keyboardType="numeric"
              onChangeText={(maxDiscountAmount: string) =>
                setDiscountForm((p) => ({
                  ...p,
                  maxDiscountAmount,
                }))
              }
              placeholder="100000"
            />
          </View>
          <View style={styles.formGrid3}>
            <Input
              label="Giới hạn dùng (UsageLimit)"
              value={discountForm.usageLimit}
              keyboardType="numeric"
              onChangeText={(usageLimit: string) =>
                setDiscountForm((p) => ({ ...p, usageLimit }))
              }
              placeholder="100"
            />
            <Input
              label="Ngày bắt đầu"
              value={discountForm.startsAt}
              onChangeText={(startsAt: string) =>
                setDiscountForm((p) => ({ ...p, startsAt }))
              }
              placeholder="2026-06-01"
            />
            <Input
              label="Ngày hết hạn (ExpiryDate)"
              value={discountForm.expiryDate}
              onChangeText={(expiryDate: string) =>
                setDiscountForm((p) => ({ ...p, expiryDate }))
              }
              placeholder="2026-12-31"
            />
          </View>
          <View style={styles.formGrid2}>
            <Input
              label="Phạm vi áp dụng"
              value={discountForm.scope}
              onChangeText={(scope: string) =>
                setDiscountForm((p) => ({ ...p, scope }))
              }
              placeholder="all / category:áo"
            />
            <Input
              label="Loại (voucher / promotion)"
              value={discountForm.kind}
              onChangeText={(kind: string) =>
                setDiscountForm((p) => ({ ...p, kind }))
              }
              placeholder="voucher"
            />
          </View>
          <View style={styles.inputWrap}>
            <Input
              label="URL ảnh banner (tùy chọn)"
              value={discountForm.bannerImage}
              onChangeText={(bannerImage: string) =>
                setDiscountForm((p) => ({ ...p, bannerImage }))
              }
              placeholder="https://..."
            />
            <Pressable
              disabled={uploadingField === "discountBanner"}
              onPress={() => pickAndUpload("discountBanner")}
              style={styles.smallBtn}
            >
              <Text style={styles.smallBtnText}>
                {uploadingField === "discountBanner"
                  ? "Đang upload..."
                  : "Upload banner"}
              </Text>
            </Pressable>
          </View>
          <Input
            label="Mô tả"
            value={discountForm.description}
            onChangeText={(description: string) =>
              setDiscountForm((p) => ({ ...p, description }))
            }
            placeholder="Áp dụng toàn shop, không áp dụng với hàng giảm giá..."
            multiline
          />
          <View style={styles.actionRow}>
            <Pressable
              disabled={actionId === "discount-save"}
              onPress={saveDiscount}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>
                {actionId === "discount-save"
                  ? "Đang lưu..."
                  : editingDiscountId
                    ? "Cập nhật mã"
                    : "Tạo mã giảm giá"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setDiscountForm(emptyDiscountForm);
                setEditingDiscountId(null);
              }}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>Xóa form</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <SectionHeader
            title="Danh sách mã giảm giá"
            subtitle="Bật/tắt từng mã, theo dõi lượt dùng"
          />
          {discountCodes.length ? (
            discountCodes.map((dc) => (
              <View key={dc.id} style={styles.voucherRow}>
                {dc.bannerImage ? (
                  <Image
                    source={{ uri: dc.bannerImage }}
                    style={styles.promoThumb}
                  />
                ) : (
                  <View style={styles.voucherIcon}>
                    <Feather
                      name="tag"
                      size={17}
                      color={ADMIN_GREEN}
                    />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.voucherCode}>
                    {dc.code}{" "}
                    {dc.kind === "promotion" ? "🎯 Campaign" : "🎟 Voucher"}
                  </Text>
                  <Text style={styles.voucherMeta}>
                    {dc.title || "Mã giảm giá"} •{" "}
                    {dc.discountType === "fixed"
                      ? formatMoney(dc.discountValue)
                      : `${dc.discountValue}%`}{" "}
                    • HSD: {compactDate(dc.expiryDate)}
                  </Text>
                  <Text style={styles.voucherMeta}>
                    Tối thiểu: {formatMoney(dc.minOrderAmount)} • Giảm
                    tối đa: {formatMoney(dc.maxDiscountAmount)} •
                    Dùng: {dc.usedCount || 0}/{dc.usageLimit || "∞"}
                  </Text>
                </View>
                <View style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => toggleDiscount(dc)}
                    style={[
                      styles.statusPill,
                      dc.active !== false &&
                        dc.status !== "inactive"
                        ? styles.statusOn
                        : styles.statusOff,
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {dc.active !== false &&
                        dc.status !== "inactive"
                        ? "BẬT"
                        : "TẮT"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setEditingDiscountId(dc.id);
                      setDiscountForm({
                        code: dc.code || "",
                        title: dc.title || "",
                        discountType: dc.discountType || "percent",
                        discountValue: String(dc.discountValue || ""),
                        minOrderAmount: String(dc.minOrderAmount || ""),
                        maxDiscountAmount: String(
                          dc.maxDiscountAmount || ""
                        ),
                        usageLimit: String(dc.usageLimit || ""),
                        expiryDate: dc.expiryDate || "",
                        description: dc.description || "",
                        status: dc.status || "active",
                        kind: dc.kind || "voucher",
                        scope: dc.scope || "all",
                        bannerImage: dc.bannerImage || "",
                        startsAt: dc.startsAt || "",
                      });
                    }}
                    style={styles.smallBtn}
                  >
                    <Text style={styles.smallBtnText}>Sửa</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Chưa có mã giảm giá.</Text>
          )}
        </View>
      </View>
    </View>
  );

  // ─── Tab: Quản lý đánh giá ────────────────────────────────────────────────────

  const renderDanhGia = () => (
    <View style={styles.pageGap}>
      <SectionHeader
        title="Quản lý đánh giá"
        subtitle="Xem và xóa đánh giá của khách hàng (Reviews: Rating, Comment, ReviewDate)."
        right={
          <Text style={styles.counterPill}>
            {reviews.length} đánh giá
          </Text>
        }
      />
      <View style={styles.statsGrid}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = reviews.filter(
            (r) => Number(r.rating) === star
          ).length;
          return (
            <View key={star} style={styles.statCard}>
              <View style={styles.statTop}>
                <View>
                  <Text style={styles.statLabel}>{star} sao</Text>
                  <Text
                    style={[
                      styles.statValue,
                      { color: ADMIN_ORANGE },
                    ]}
                  >
                    {formatNumber(count)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statIcon,
                    { backgroundColor: `${ADMIN_ORANGE}18` },
                  ]}
                >
                  <Feather name="star" size={20} color={ADMIN_ORANGE} />
                </View>
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.tableCard}>
        {reviews.length ? (
          reviews.map((review) => (
            <View key={review.id} style={styles.reviewRow}>
              <View style={styles.reviewLeft}>
                <RatingStars rating={review.rating} />
                <Text style={styles.reviewDate}>
                  {compactDate(review.reviewDate)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentTitle}>
                  {review.comment || "Không có nhận xét"}
                </Text>
                <Text style={styles.paymentMeta}>
                  Người dùng: {review.userId || "--"} • Sản phẩm:{" "}
                  {review.productName || review.orderItemId || "--"}
                </Text>
              </View>
              <Pressable
                disabled={actionId === `review-${review.id}`}
                onPress={() => deleteReview(review)}
                style={styles.dangerBtn}
              >
                <Text style={styles.dangerBtnText}>
                  {actionId === `review-${review.id}`
                    ? "Đang xóa..."
                    : "Xóa"}
                </Text>
              </Pressable>
            </View>
          ))
        ) : (
          <View style={{ padding: 20 }}>
            <Text style={styles.emptyText}>Chưa có đánh giá.</Text>
          </View>
        )}
      </View>
    </View>
  );

  // ─── Tab: Banner / Sản phẩm nổi bật ─────────────────────────────────────────

  const renderBanner = () => (
    <View style={styles.pageGap}>
      <SectionHeader
        title="Quản lý Banner & Sản phẩm nổi bật"
        subtitle="Thêm, xóa ảnh banner hiển thị trên trang chủ và đánh dấu sản phẩm nổi bật."
        right={
          <Text style={styles.counterPill}>
            {banners.length} banner
          </Text>
        }
      />
      <View style={styles.promoGrid}>
        <View style={styles.card}>
          <Text style={styles.formTitle}>Thêm banner mới</Text>
          <Input
            label="URL ảnh banner"
            value={bannerUrl}
            onChangeText={setBannerUrl}
            placeholder="https://..."
          />
          <Pressable
            disabled={uploadingField === "bannerUrl"}
            onPress={() => pickAndUpload("bannerUrl")}
            style={styles.smallBtn}
          >
            <Text style={styles.smallBtnText}>
              {uploadingField === "bannerUrl"
                ? "Đang upload..."
                : "Upload ảnh từ thiết bị"}
            </Text>
          </Pressable>
          <Input
            label="Liên kết khi bấm vào banner (tùy chọn)"
            value={bannerLink}
            onChangeText={setBannerLink}
            placeholder="https://... hoặc /products/sale"
          />
          <Pressable
            disabled={actionId === "banner-save"}
            onPress={saveBanner}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>
              {actionId === "banner-save" ? "Đang lưu..." : "Lưu banner"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <SectionHeader
            title="Banner hiện tại"
            subtitle="Ảnh đang hiển thị trên trang chủ"
          />
          {banners.length ? (
            <View style={{ gap: 12 }}>
              {banners.map((b, idx) => (
                <View key={b.id || idx} style={styles.bannerRow}>
                  {b.url ? (
                    <Image
                      source={{ uri: b.url }}
                      style={styles.bannerThumb}
                    />
                  ) : (
                    <View style={styles.bannerThumb}>
                      <Feather name="image" size={24} color={ADMIN_MUTED} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={styles.paymentTitle}
                    >
                      Banner #{idx + 1}
                    </Text>
                    {b.link ? (
                      <Text numberOfLines={1} style={styles.paymentMeta}>
                        Link: {b.link}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    disabled={actionId === `banner-${b.id}`}
                    onPress={() => deleteBanner(b.id)}
                    style={styles.dangerBtn}
                  >
                    <Text style={styles.dangerBtnText}>Xóa</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Chưa có banner nào.</Text>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <SectionHeader
          title="Đánh dấu sản phẩm nổi bật"
          subtitle="Chọn sản phẩm hiển thị nổi bật trên trang chủ (badge = FEATURED)"
        />
        <View style={styles.productListGrid}>
          {products.slice(0, 12).map((product) => {
            const isFeatured =
              product.badge === "FEATURED" ||
              product.badge === "NỔI BẬT";
            return (
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productTop}>
                  <Image
                    source={{
                      uri:
                        product.image || ADMIN_FALLBACK_IMAGES[0],
                    }}
                    style={styles.productImage}
                  />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.productTitle}>
                      {product.name}
                    </Text>
                    <Text style={styles.productMeta}>
                      {product.category || "--"} •{" "}
                      {formatMoney(product.price)}
                    </Text>
                    {isFeatured ? (
                      <View style={styles.featuredBadge}>
                        <Text style={styles.featuredBadgeText}>
                          ⭐ NỔI BẬT
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Pressable
                  onPress={async () => {
                    if (!user?.id) return;
                    try {
                      await api.updateAdminProduct(
                        user.id,
                        product.id,
                        {
                          badge: isFeatured ? "" : "NỔI BẬT",
                        }
                      );
                      await load();
                    } catch (e: any) {
                      Alert.alert("Lỗi", e?.message);
                    }
                  }}
                  style={[
                    isFeatured ? styles.dangerBtn : styles.saleBtn,
                  ]}
                >
                  <Text
                    style={
                      isFeatured
                        ? styles.dangerBtnText
                        : styles.saleBtnText
                    }
                  >
                    {isFeatured ? "Bỏ nổi bật" : "Đánh dấu nổi bật"}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );

  // ─── Render tab ───────────────────────────────────────────────────────────────

  const renderActive = () => {
    if (loading) {
      return (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={ADMIN_GREEN} size="large" />
          <Text style={styles.emptyText}>Đang tải dữ liệu admin...</Text>
        </View>
      );
    }
    switch (activeTab) {
      case "tongquan":
        return renderTongQuan();
      case "thongke":
        return renderThongKe();
      case "sanpham":
        return renderSanPham();
      case "danhmuc":
        return renderDanhMuc();
      case "donhang":
        return renderDonHang();
      case "nguoidung":
        return renderNguoiDung();
      case "giamgia":
        return renderGiamGia();
      case "danhgia":
        return renderDanhGia();
      case "banner":
        return renderBanner();
      default:
        return renderTongQuan();
    }
  };

  // ─── Layout chính ─────────────────────────────────────────────────────────────

  return (
    <View style={styles.appShell}>
      {desktop ? <Sidebar /> : null}
      <View style={styles.mainArea}>
        {!desktop ? <Sidebar /> : null}
        <Topbar />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={ADMIN_GREEN}
            />
          }
          showsVerticalScrollIndicator
        >
          {renderActive()}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Styles (Refined & Polished) ─────────────────────────────────────────────

const R = 16; // base border radius token
const R_SM = 10;
const R_MD = 14;
const R_LG = 20;
const R_XL = 24;

const styles = StyleSheet.create({
  // ── Shell & Layout ──────────────────────────────────────────────────────────
  appShell: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: ADMIN_BG,
  },

  // ── Sidebar ─────────────────────────────────────────────────────────────────
  sidebar: {
    width: 244,
    backgroundColor: ADMIN_DARK,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 16,
  },
  sidebarMobile: {
    width: "100%",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  sidebarLogoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  sidebarLogo: {
    width: 38,
    height: 38,
    borderRadius: R_MD,
    backgroundColor: ADMIN_GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  sidebarBrand: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  sidebarSub: {
    color: ADMIN_MUTED_DARK,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 1,
  },
  navContent: {
    gap: 2,
    paddingBottom: 20,
  },
  navContentMobile: {
    gap: 6,
    alignItems: "center",
  },
  navGroup: {
    color: "#4A5A50",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 18,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  navItem: {
    minHeight: 42,
    borderRadius: R_MD,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  navItemActive: {
    backgroundColor: "#0F2218",
  },
  navText: {
    color: ADMIN_MUTED_DARK,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  navTextActive: {
    color: ADMIN_GREEN,
    fontWeight: "800",
  },
  navBadge: {
    backgroundColor: ADMIN_GREEN,
    color: "#fff",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
  },
  sidebarUser: {
    marginTop: "auto",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#0F2218",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sidebarAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: ADMIN_GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  sidebarAvatarText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },
  sidebarUserName: {
    color: "#E8F0EC",
    fontSize: 12,
    fontWeight: "800",
  },
  sidebarUserRole: {
    color: ADMIN_MUTED_DARK,
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },

  // ── Main area ───────────────────────────────────────────────────────────────
  mainArea: {
    flex: 1,
    minWidth: 0,
  },

  // ── Topbar ──────────────────────────────────────────────────────────────────
  topbar: {
    minHeight: 66,
    backgroundColor: ADMIN_CARD,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_BORDER,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchBox: {
    flex: 1,
    maxWidth: 420,
    minHeight: 42,
    borderWidth: 1,
    borderColor: ADMIN_BORDER,
    backgroundColor: ADMIN_BG,
    borderRadius: R_MD,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: ADMIN_TEXT,
    fontWeight: "500",
  },
  topIconBtn: {
    width: 42,
    height: 42,
    borderRadius: R_MD,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: ADMIN_BORDER,
    backgroundColor: ADMIN_CARD,
  },
  newOrderBtn: {
    minHeight: 42,
    borderRadius: R_MD,
    backgroundColor: ADMIN_GREEN,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  newOrderText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },

  // ── Content area ────────────────────────────────────────────────────────────
  content: {
    padding: 22,
    paddingBottom: 80,
  },
  pageGap: {
    gap: 20,
  },

  // ── Section header ──────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: ADMIN_TEXT,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  sectionSub: {
    color: ADMIN_MUTED,
    fontSize: 13,
    marginTop: 3,
    fontWeight: "600",
    lineHeight: 18,
  },

  // ── Hero card ───────────────────────────────────────────────────────────────
  heroCard: {
    minHeight: 112,
    borderRadius: R_XL,
    backgroundColor: ADMIN_DARK,
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    overflow: "hidden",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  heroSub: {
    color: "#A8C4B8",
    fontSize: 14,
    marginTop: 6,
    fontWeight: "600",
  },
  heroButton: {
    minHeight: 42,
    borderRadius: R_MD,
    backgroundColor: "rgba(255,255,255,0.13)",
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  heroButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },

  // ── Stat cards ──────────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 200,
    minHeight: 130,
    borderRadius: R_LG,
    backgroundColor: ADMIN_CARD,
    borderWidth: 1,
    borderColor: ADMIN_BORDER,
    padding: 18,
    ...CARD_SHADOW,
  },
  statTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  statLabel: {
    color: ADMIN_MUTED,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  statValue: {
    color: ADMIN_TEXT,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 5,
    letterSpacing: -0.5,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: R_MD,
    alignItems: "center",
    justifyContent: "center",
  },
  statBottom: {
    flex: 1,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  statChange: {
    fontSize: 12,
    fontWeight: "800",
    minWidth: 70,
  },

  // ── Cards ───────────────────────────────────────────────────────────────────
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  dashboardGrid3: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  card: {
    flexGrow: 1,
    flexBasis: 300,
    borderRadius: R_LG,
    backgroundColor: ADMIN_CARD,
    borderWidth: 1,
    borderColor: ADMIN_BORDER,
    padding: 20,
    gap: 16,
    ...CARD_SHADOW,
  },
  bigChartCard: {
    flexBasis: 560,
  },

  // ── Segment control ─────────────────────────────────────────────────────────
  segment: {
    flexDirection: "row",
    backgroundColor: ADMIN_BG,
    borderRadius: R_MD,
    padding: 4,
    gap: 2,
  },
  segmentActive: {
    backgroundColor: ADMIN_CARD,
    color: ADMIN_TEXT,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: R_SM,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    ...Platform.select({ web: { boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } as any, default: {} }),
  },
  segmentText: {
    color: ADMIN_MUTED,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: "700",
  },

  // ── Mini bar chart ──────────────────────────────────────────────────────────
  miniBars: {
    height: 220,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingTop: 12,
  },
  miniBarsCompact: {
    flex: 1,
    height: 54,
    gap: 3,
    paddingTop: 0,
  },
  miniBarItem: {
    flex: 1,
    minWidth: 14,
    alignItems: "center",
    gap: 6,
  },
  miniBarTrack: {
    flex: 1,
    width: "100%",
    minHeight: 54,
    borderRadius: R_SM,
    backgroundColor: "#EDF0F4",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  miniBarFill: {
    width: "100%",
    borderTopLeftRadius: R_SM,
    borderTopRightRadius: R_SM,
    opacity: 0.9,
  },
  chartLabel: {
    color: ADMIN_MUTED,
    fontSize: 11,
    fontWeight: "700",
  },
  chartValue: {
    color: ADMIN_TEXT,
    fontSize: 10,
    fontWeight: "800",
  },

  // ── Goal circle ─────────────────────────────────────────────────────────────
  goalCircle: {
    alignSelf: "center",
    width: 148,
    height: 148,
    borderRadius: 999,
    borderWidth: 14,
    borderColor: ADMIN_GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  goalNumber: {
    color: ADMIN_TEXT,
    fontSize: 30,
    fontWeight: "900",
  },
  goalText: {
    color: ADMIN_MUTED,
    fontSize: 12,
    fontWeight: "700",
  },
  centerMuted: {
    color: ADMIN_MUTED,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },

  // ── Horizontal bar ──────────────────────────────────────────────────────────
  barLineTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  barName: {
    flex: 1,
    color: ADMIN_TEXT,
    fontSize: 13,
    fontWeight: "800",
  },
  barValue: {
    color: ADMIN_MUTED,
    fontSize: 12,
    fontWeight: "800",
  },
  hTrack: {
    height: 8,
    backgroundColor: "#EDF0F4",
    borderRadius: 999,
    overflow: "hidden",
  },
  hFill: {
    height: "100%",
    borderRadius: 999,
  },

  // ── Activity rows ───────────────────────────────────────────────────────────
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: R_SM,
    backgroundColor: ADMIN_GREEN_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTitle: {
    color: ADMIN_TEXT,
    fontSize: 13,
    fontWeight: "800",
  },
  activityMeta: {
    color: ADMIN_MUTED,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },

  // ── Empty state ─────────────────────────────────────────────────────────────
  emptyText: {
    color: ADMIN_MUTED,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
  },

  // ── Product manager ─────────────────────────────────────────────────────────
  productManagerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "flex-start",
  },
  formCard: {
    flexBasis: 650,
  },
  formTitle: {
    color: ADMIN_TEXT,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  formGrid2: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  formGrid3: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  // ── Input ───────────────────────────────────────────────────────────────────
  inputWrap: {
    flex: 1,
    minWidth: 170,
    gap: 6,
  },
  inputLabel: {
    color: ADMIN_MUTED,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  input: {
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: ADMIN_BORDER,
    borderRadius: R_MD,
    backgroundColor: "#FAFBFC",
    color: ADMIN_TEXT,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },

  // ── Media upload box ────────────────────────────────────────────────────────
  mediaUploadBox: {
    borderWidth: 1.5,
    borderColor: "#C6EDD9",
    backgroundColor: "#F0FBF5",
    borderRadius: R_LG,
    padding: 14,
    gap: 8,
  },
  mediaUploadTitle: {
    color: ADMIN_GREEN,
    fontSize: 13,
    fontWeight: "800",
  },
  mediaUploadHint: {
    color: ADMIN_MUTED,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },

  // ── Action rows & buttons ───────────────────────────────────────────────────
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  primaryBtn: {
    minHeight: 44,
    borderRadius: R_MD,
    backgroundColor: ADMIN_GREEN,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryBtn: {
    minHeight: 44,
    borderRadius: R_MD,
    borderWidth: 1.5,
    borderColor: ADMIN_BORDER,
    backgroundColor: ADMIN_CARD,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: ADMIN_TEXT,
    fontSize: 13,
    fontWeight: "700",
  },
  smallBtn: {
    minHeight: 34,
    borderRadius: R_SM,
    borderWidth: 1.5,
    borderColor: ADMIN_BORDER,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ADMIN_CARD,
  },
  smallBtnText: {
    color: ADMIN_TEXT,
    fontSize: 12,
    fontWeight: "700",
  },
  saleBtn: {
    minHeight: 34,
    borderRadius: R_SM,
    backgroundColor: "#FFFBEB",
    borderWidth: 1.5,
    borderColor: "#FDE68A",
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  saleBtnText: {
    color: "#92400E",
    fontSize: 12,
    fontWeight: "800",
  },
  dangerBtn: {
    minHeight: 34,
    borderRadius: R_SM,
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#FECACA",
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerBtnText: {
    color: ADMIN_RED,
    fontSize: 12,
    fontWeight: "800",
  },

  // ── Product preview (marketplace) ───────────────────────────────────────────
  marketPreview: {
    flexGrow: 1,
    flexBasis: 300,
    borderRadius: R_XL,
    backgroundColor: ADMIN_CARD,
    borderWidth: 1,
    borderColor: ADMIN_BORDER,
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  previewTopIcons: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewImageBox: {
    height: 270,
    backgroundColor: "#ECEEF2",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  previewThumbRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: ADMIN_CARD,
  },
  previewThumb: {
    flex: 1,
    height: 58,
    borderRadius: R_MD,
    backgroundColor: "#ECEEF2",
  },
  previewDiscount: {
    position: "absolute",
    left: 14,
    top: 14,
    backgroundColor: ADMIN_RED,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R_SM,
  },
  previewDiscountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  previewBody: {
    padding: 18,
    gap: 10,
  },
  previewTitle: {
    color: "#000",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  previewPriceLine: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  previewSalePrice: {
    color: "#111",
    fontSize: 22,
    fontWeight: "700",
  },
  previewOldPrice: {
    color: "#9CA3AF",
    fontSize: 18,
    textDecorationLine: "line-through",
    fontWeight: "500",
  },
  previewMeta: {
    color: ADMIN_MUTED,
    fontSize: 12,
    fontWeight: "700",
  },

  // ── Product list & cards ────────────────────────────────────────────────────
  productListGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  productCard: {
    flexGrow: 1,
    flexBasis: 350,
    borderRadius: R_LG,
    backgroundColor: ADMIN_CARD,
    borderWidth: 1,
    borderColor: ADMIN_BORDER,
    padding: 14,
    gap: 11,
    ...CARD_SHADOW,
  },
  productTop: {
    flexDirection: "row",
    gap: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: R_MD,
    backgroundColor: "#F1F4F7",
    alignItems: "center",
    justifyContent: "center",
  },
  productTitle: {
    color: ADMIN_TEXT,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.1,
  },
  productMeta: {
    color: ADMIN_MUTED,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  productPriceLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 6,
  },
  productPrice: {
    color: ADMIN_GREEN,
    fontSize: 15,
    fontWeight: "900",
  },
  productOldPrice: {
    color: ADMIN_MUTED,
    fontSize: 13,
    textDecorationLine: "line-through",
    fontWeight: "600",
  },
  discountBadge: {
    color: "#fff",
    backgroundColor: ADMIN_RED,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: R_SM,
    overflow: "hidden",
    fontSize: 11,
    fontWeight: "800",
  },
  productDesc: {
    color: ADMIN_MUTED,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  adminThumbRow: {
    flexDirection: "row",
    gap: 7,
  },
  adminThumb: {
    flex: 1,
    height: 56,
    borderRadius: R_MD,
    backgroundColor: "#F1F4F7",
  },

  // ── Counter pill ────────────────────────────────────────────────────────────
  counterPill: {
    color: ADMIN_GREEN,
    backgroundColor: ADMIN_GREEN_LIGHT,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "800",
  },

  // ── Promo / Voucher ─────────────────────────────────────────────────────────
  promoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  selectChip: {
    borderWidth: 1.5,
    borderColor: ADMIN_BORDER,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: ADMIN_CARD,
  },
  selectChipActive: {
    borderColor: ADMIN_GREEN,
    backgroundColor: ADMIN_GREEN_LIGHT,
  },
  selectChipText: {
    color: ADMIN_TEXT,
    fontSize: 12,
    fontWeight: "700",
  },
  selectChipTextActive: {
    color: ADMIN_GREEN,
    fontWeight: "800",
  },
  voucherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F3F6",
  },
  voucherIcon: {
    width: 38,
    height: 38,
    borderRadius: R_MD,
    backgroundColor: ADMIN_GREEN_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  voucherCode: {
    color: ADMIN_TEXT,
    fontSize: 14,
    fontWeight: "800",
  },
  voucherMeta: {
    color: ADMIN_MUTED,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },

  // ── Status pills ────────────────────────────────────────────────────────────
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  statusOn: {
    backgroundColor: ADMIN_GREEN_LIGHT,
  },
  statusOff: {
    backgroundColor: "#F0F3F6",
  },
  statusText: {
    color: ADMIN_TEXT,
    fontSize: 11,
    fontWeight: "800",
  },

  // ── Promo thumb ─────────────────────────────────────────────────────────────
  promoThumb: {
    width: 56,
    height: 44,
    borderRadius: R_MD,
    backgroundColor: "#F1F4F7",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Table cards ─────────────────────────────────────────────────────────────
  tableCard: {
    borderRadius: R_LG,
    backgroundColor: ADMIN_CARD,
    borderWidth: 1,
    borderColor: ADMIN_BORDER,
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  orderRow: {
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F3F6",
    flexWrap: "wrap",
  },
  userRow: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F3F6",
    flexWrap: "wrap",
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: ADMIN_GREEN_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarAdmin: {
    backgroundColor: ADMIN_GREEN,
  },
  userName: {
    color: ADMIN_TEXT,
    fontSize: 14,
    fontWeight: "800",
  },
  userEmail: {
    color: ADMIN_MUTED,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },
  userMeta: {
    color: ADMIN_MUTED,
    fontSize: 11,
    marginTop: 3,
    fontWeight: "600",
  },
  rolePill: {
    borderWidth: 1.5,
    borderColor: ADMIN_BORDER,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: ADMIN_CARD,
  },
  roleAdmin: {
    backgroundColor: ADMIN_GREEN,
    borderColor: ADMIN_GREEN,
  },
  rolePillText: {
    color: ADMIN_TEXT,
    fontSize: 11,
    fontWeight: "800",
  },
  rolePillTextAdmin: {
    color: "#fff",
  },
  userActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  // ── Payment rows ────────────────────────────────────────────────────────────
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F3F6",
  },
  paymentIcon: {
    width: 38,
    height: 38,
    borderRadius: R_MD,
    backgroundColor: "#EEF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentTitle: {
    color: ADMIN_TEXT,
    fontSize: 14,
    fontWeight: "800",
  },
  paymentMeta: {
    color: ADMIN_MUTED,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },

  // ── Review rows ─────────────────────────────────────────────────────────────
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F3F6",
  },
  reviewLeft: {
    alignItems: "center",
    gap: 4,
  },
  reviewDate: {
    color: ADMIN_MUTED,
    fontSize: 10,
    fontWeight: "700",
  },

  // ── Banner rows ─────────────────────────────────────────────────────────────
  bannerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bannerThumb: {
    width: 100,
    height: 60,
    borderRadius: R_MD,
    backgroundColor: "#F1F4F7",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Featured badge ──────────────────────────────────────────────────────────
  featuredBadge: {
    marginTop: 5,
    backgroundColor: "#FFFBEB",
    borderRadius: R_SM,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  featuredBadgeText: {
    color: "#92400E",
    fontSize: 11,
    fontWeight: "800",
  },

  // ── Loading card ────────────────────────────────────────────────────────────
  loadingCard: {
    minHeight: 240,
    borderRadius: R_XL,
    backgroundColor: ADMIN_CARD,
    borderWidth: 1,
    borderColor: ADMIN_BORDER,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    ...CARD_SHADOW,
  },

  // ── Auth page ───────────────────────────────────────────────────────────────
  authPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ADMIN_BG,
    padding: 20,
  },
  authCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: R_XL,
    backgroundColor: ADMIN_CARD,
    borderWidth: 1,
    borderColor: ADMIN_BORDER,
    padding: 28,
    alignItems: "center",
    gap: 14,
    ...CARD_SHADOW,
  },
  logoBox: {
    width: 58,
    height: 58,
    borderRadius: R_LG,
    backgroundColor: ADMIN_GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  authTitle: {
    color: ADMIN_TEXT,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  authText: {
    color: ADMIN_MUTED,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 21,
  },
  authButton: {
    minHeight: 46,
    alignSelf: "stretch",
    backgroundColor: ADMIN_GREEN,
    borderRadius: R_MD,
    alignItems: "center",
    justifyContent: "center",
  },
  authButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
});
