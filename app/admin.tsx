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

type AdminUser = {
  id: string;
  name?: string;
  fullName?: string;
  email: string;
  phone?: string;
  role: "customer" | "admin";
  status?: string;
  coins?: number;
  vip?: boolean;
  address?: string;
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
  story?: string;
  badge?: string;
  category?: string;
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
  stock?: number;
  stockQuantity?: number;
  visualTags?: string[];
  styleUseCase?: string;
};

type TabKey = "overview" | "analytics" | "products" | "promotions" | "users" | "transactions" | "games" | "accessories" | "tryon2d" | "model3d" | "botchat" | "moderation" | "system";

type NavItem = { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap; group: string; badge?: string };

const ADMIN_GREEN = "#A33A2F";
const ADMIN_DARK = "#1C140F";
const ADMIN_MUTED_DARK = "#84918B";
const ADMIN_BG = "#F4F6F8";
const ADMIN_CARD = "#FFFFFF";
const ADMIN_BORDER = "#E7ECF0";
const ADMIN_TEXT = "#1D252C";
const ADMIN_MUTED = "#75808A";
const ADMIN_BLUE = "#1E88E5";
const ADMIN_ORANGE = "#F59E0B";
const ADMIN_RED = "#EF4444";
const ADMIN_CARD_SHADOW = Platform.OS === "web"
  ? ({ boxShadow: "0 12px 32px rgba(0,0,0,0.05)" } as any)
  : { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 32, shadowOffset: { width: 0, height: 10 }, elevation: 3 };

const ADMIN_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80",
];

const navItems: NavItem[] = [
  { key: "overview", label: "T?ng quan", icon: "grid", group: "T?NG QUAN" },
  { key: "analytics", label: "Báo cáo & Phân tích", icon: "bar-chart-2", group: "T?NG QUAN" },
  { key: "transactions", label: "Ðon hàng", icon: "shopping-bag", group: "BÁN HÀNG" },
  { key: "products", label: "S?n ph?m", icon: "package", group: "BÁN HÀNG" },
  { key: "accessories", label: "Danh m?c & Ph? ki?n", icon: "watch", group: "BÁN HÀNG" },
  { key: "users", label: "Khách hàng", icon: "users", group: "BÁN HÀNG" },
  { key: "promotions", label: "Khuy?n mãi", icon: "percent", group: "BÁN HÀNG" },
  { key: "tryon2d", label: "Th? d? AI 2D", icon: "camera", group: "AI & 3D" },
  { key: "model3d", label: "T?o m?u 3D", icon: "box", group: "AI & 3D" },
  { key: "botchat", label: "Bot chat & G?i ý", icon: "message-circle", group: "AI & 3D" },
  { key: "moderation", label: "T? c?m", icon: "shield", group: "N?I DUNG" },
  { key: "games", label: "Trò choi", icon: "zap", group: "N?I DUNG" },
  { key: "system", label: "Tr?ng thái & Nh?t ký", icon: "activity", group: "H? TH?NG" },
];

const emptyProductForm = {
  id: "",
  name: "",
  price: "",
  originalPrice: "",
  discountPercent: "",
  discountLabel: "",
  badge: "",
  image: "",
  image2: "",
  image3: "",
  image4: "",
  description: "",
  category: "",
  subcategory: "",
  stockQuantity: "999",
  sku: "",
  visualTags: "",
  styleUseCase: "",
  sizes: "S, M, L, XL",
  dimensions: "",
  colors: "Ðen, Tr?ng, Kem",
  fit: "Regular fit",
};

const emptyVoucherForm = {
  code: "",
  title: "",
  discountType: "percent",
  discountValue: "",
  minOrderValue: "",
  expiryDate: "",
  description: "",
};

const emptyPromotionForm = {
  code: "",
  title: "",
  discountType: "percent",
  discountValue: "",
  minOrderValue: "",
  startsAt: "",
  expiryDate: "",
  scope: "all",
  bannerImage: "",
  description: "",
};

const emptyNotificationForm = { title: "", content: "" };
const emptyGameForm = { slug: "", name: "", description: "", rewardCoins: "" };

function formatMoney(value: any) {
  return `${Number(value || 0).toLocaleString("vi-VN")}d`;
}

function formatCompactMoney(value: any) {
  const n = Number(value || 0);
  if (n >= 1_000_000_000) return `${Math.round(n / 100_000_000) / 10}Bd`;
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}Md`;
  if (n >= 1000) return `${Math.round(n / 1000)}Kd`;
  return `${n.toLocaleString("vi-VN")}d`;
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
  if (original > price && price > 0) return Math.max(1, Math.round((1 - price / original) * 100));
  return Number(product.discountPercent || 0);
}

function splitAdminList(value: any) {
  if (Array.isArray(value)) return value.map((x) => String(x || "").trim()).filter(Boolean);
  return String(value || "").split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
}

function adminGalleryImages(product: Partial<AdminProduct> & Record<string, any>) {
  const seen = new Set<string>();
  const gallery = [product.image, ...(Array.isArray(product.images) ? product.images : [])]
    .map((url) => String(url || "").trim())
    .filter((url) => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  let offset = String(product.id || product.name || product.image || "japano").length;
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
    price: String(product.price || 0),
    originalPrice: String(product.originalPrice || ""),
    discountPercent: String(product.discountPercent || ""),
    discountLabel: product.discountLabel || "",
    badge: product.badge || "",
    image: gallery[0] || product.image || "",
    image2: gallery[1] || "",
    image3: gallery[2] || "",
    image4: gallery[3] || "",
    description: product.description || "",
    category: product.category || "",
    subcategory: product.subcategory || "",
    stockQuantity: String(product.stockQuantity ?? 999),
    sku: product.sku || "",
    visualTags: Array.isArray(product.visualTags) ? product.visualTags.join(", ") : "",
    styleUseCase: product.styleUseCase || "",
    sizes: Array.isArray(product.sizes) ? product.sizes.join(", ") : "S, M, L, XL",
    dimensions: product.dimensions || "",
    colors: Array.isArray(product.colors) ? product.colors.join(", ") : "Ðen, Tr?ng, Kem",
    fit: product.fit || "Regular fit",
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

function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
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

function StatCard({ label, value, change, icon, accent = ADMIN_GREEN, trend = [] }: any) {
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
        <Text style={[styles.statChange, { color: String(change || "").startsWith("-") ? ADMIN_RED : ADMIN_GREEN }]}>{change || "+0%"}</Text>
        <MiniBars data={miniTrendData(trend).slice(-7)} compact accent={accent} />
      </View>
    </View>
  );
}

function MiniBars({ data, compact = false, accent = ADMIN_GREEN, money = false }: any) {
  const rows = Array.isArray(data) && data.length ? data : [];
  const max = Math.max(1, ...rows.map((item: any) => Number(item.value || item.revenue || item.unitsSold || 0)));
  return (
    <View style={[styles.miniBars, compact ? styles.miniBarsCompact : null]}>
      {rows.map((item: any, index: number) => {
        const rawValue = Number(item.value ?? item.revenue ?? item.unitsSold ?? 0);
        const height = `${Math.max(8, Math.round((rawValue / max) * 100))}%` as any;
        return (
          <View key={`${item.label || item.month || index}`} style={styles.miniBarItem}>
            <View style={styles.miniBarTrack}>
              <View style={[styles.miniBarFill, { height, backgroundColor: accent }]} />
            </View>
            {!compact ? <Text style={styles.chartLabel}>{item.label || item.month || "--"}</Text> : null}
            {!compact ? <Text style={styles.chartValue}>{money ? formatCompactMoney(rawValue) : formatNumber(rawValue)}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function fmtVnd(n: any) {
  const v = Number(n || 0);
  if (v >= 1e9) return (v / 1e9).toFixed(1) + ' t?';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + ' tr';
  if (v >= 1e3) return Math.round(v / 1e3) + 'k';
  return String(Math.round(v));
}

function ForecastChart({ forecast }: any) {
  if (!forecast) return <Text style={styles.emptyText}>Chua có d? li?u d? báo.</Text>;
  const hist = forecast.history || [];
  const fc = forecast.forecast || [];
  const all = [...hist.map((h: any) => ({ ...h, kind: 'hist' })), ...fc.map((f: any) => ({ ...f, kind: 'fc' }))];
  const max = Math.max(1, ...all.map((a: any) => Number(a.value || 0)));
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.forecastMetrics}>
        <View style={styles.metricPill}><Text style={styles.metricNum}>{fmtVnd(forecast.nextMonth)}d</Text><Text style={styles.metricCap}>D? báo tháng t?i</Text></View>
        <View style={styles.metricPill}><Text style={styles.metricNum}>R² {forecast.r2}</Text><Text style={styles.metricCap}>Ð? kh?p mô hình</Text></View>
        <View style={styles.metricPill}><Text style={styles.metricNum}>{forecast.trend === 'tang' ? '?' : '?'} {fmtVnd(Math.abs(forecast.slope))}d</Text><Text style={styles.metricCap}>Xu hu?ng/tháng</Text></View>
      </View>
      <View style={styles.forecastChart}>
        {all.map((a: any, i: number) => {
          const h = `${Math.max(6, Math.round((Number(a.value || 0) / max) * 100))}%` as any;
          const isFc = a.kind === 'fc';
          return (
            <View key={i} style={styles.forecastCol}>
              <Text style={styles.forecastVal}>{fmtVnd(a.value)}</Text>
              <View style={styles.forecastTrack}>
                <View style={[styles.forecastFill, { height: h, backgroundColor: isFc ? 'transparent' : ADMIN_GREEN, borderWidth: isFc ? 2 : 0, borderColor: ADMIN_GREEN, borderStyle: isFc ? 'dashed' : 'solid' }]} />
              </View>
              <Text style={styles.forecastLbl}>{String(a.label).slice(5)}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: ADMIN_GREEN }]} /><Text style={styles.legendText}>Th?c t?</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { borderWidth: 2, borderColor: ADMIN_GREEN, backgroundColor: 'transparent' }]} /><Text style={styles.legendText}>D? báo (OLS)</Text></View>
        {forecast.demo ? <Text style={styles.demoTag}>d? li?u minh ho?</Text> : null}
      </View>
    </View>
  );
}

function SegmentsView({ segments }: any) {
  if (!segments || !segments.clusters?.length) return <Text style={styles.emptyText}>Chua d? khách hàng d? phân c?m.</Text>;
  const total = Math.max(1, segments.clusters.reduce((s: number, c: any) => s + c.size, 0));
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.segBar}>
        {segments.clusters.map((c: any, i: number) => (
          <View key={i} style={{ width: `${(c.size / total) * 100}%` as any, backgroundColor: c.color, height: '100%' }} />
        ))}
      </View>
      {segments.clusters.map((c: any, i: number) => (
        <View key={i} style={styles.segRow}>
          <View style={[styles.segDot, { backgroundColor: c.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.segName}>{c.name}</Text>
            <Text style={styles.segMeta}>{c.size} KH • chi TB {fmtVnd(c.avgSpend)}d • {c.avgOrders} don • mua cách {c.avgRecency} ngày</Text>
          </View>
          <Text style={styles.segPct}>{Math.round((c.size / total) * 100)}%</Text>
        </View>
      ))}
      {segments.demo ? <Text style={styles.demoTag}>d? li?u minh ho?</Text> : null}
    </View>
  );
}


function HorizontalBars({ data, accent = ADMIN_GREEN, money = false }: any) {
  const rows = Array.isArray(data) ? data : [];
  const max = Math.max(1, ...rows.map((x: any) => Number(x.value || 0)));
  if (!rows.length) return <Text style={styles.emptyText}>Chua có d? li?u d? d? v? bi?u d?.</Text>;
  return (
    <View style={{ gap: 14 }}>
      {rows.map((item: any, index: number) => {
        const value = Number(item.value || 0);
        const width = `${Math.max(5, Math.round((value / max) * 100))}%` as any;
        return (
          <View key={`${item.label}-${index}`} style={{ gap: 7 }}>
            <View style={styles.barLineTop}>
              <Text numberOfLines={1} style={styles.barName}>{item.label}</Text>
              <Text style={styles.barValue}>{money ? formatMoney(value) : formatNumber(value)}</Text>
            </View>
            <View style={styles.hTrack}>
              <View style={[styles.hFill, { width, backgroundColor: accent }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Funnel({ orders, users }: { orders: number; users: number }) {
  const visitors = Math.max(10000, users * 9, orders * 15);
  const leads = Math.max(users * 2, Math.round(visitors * 0.24));
  const customers = Math.max(users, Math.round(leads * 0.37));
  const paying = Math.max(orders, Math.round(customers * 0.72));
  const rows = [
    { label: "Lu?t truy c?p", value: visitors, color: ADMIN_GREEN, pct: 100 },
    { label: "Ti?m nang", value: leads, color: "#A33A2F", pct: Math.round((leads / visitors) * 100) },
    { label: "Khách hàng", value: customers, color: ADMIN_BLUE, pct: Math.round((customers / visitors) * 100) },
    { label: "Ðã mua", value: paying, color: "#6D5DD3", pct: Math.round((paying / visitors) * 100) },
  ];
  return (
    <View style={{ gap: 13 }}>
      {rows.map((row) => (
        <View key={row.label}>
          <View style={styles.funnelTop}>
            <Text style={styles.funnelLabel}>{row.label}</Text>
            <Text style={styles.funnelValue}>{formatNumber(row.value)}</Text>
          </View>
          <View style={styles.funnelTrack}>
            <View style={[styles.funnelFill, { width: `${Math.max(8, row.pct)}%` as any, backgroundColor: row.color }]} />
          </View>
        </View>
      ))}
      <View style={styles.funnelRates}>
        <Text style={[styles.rateText, { color: ADMIN_GREEN }]}>Truy c?p?Ti?m nang 24%</Text>
        <Text style={[styles.rateText, { color: "#A33A2F" }]}>Ti?m nang?Khách 37%</Text>
        <Text style={[styles.rateText, { color: ADMIN_ORANGE }]}>Customer?Paid 72%</Text>
      </View>
    </View>
  );
}

function ProductDiscountPreview({ name, price, originalPrice, image, images = [], discountPercent, sizes = [], colors = [], dimensions = "" }: any) {
  const percent = Number(discountPercent || (Number(originalPrice) > Number(price) ? Math.round((1 - Number(price || 0) / Number(originalPrice || 1)) * 100) : 0));
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
        {gallery[0] ? <Image source={{ uri: gallery[0] }} style={styles.previewImage} /> : <Feather name="image" size={52} color={ADMIN_MUTED} />}
        {percent > 0 ? <View style={styles.previewDiscount}><Text style={styles.previewDiscountText}>-{percent}%</Text></View> : null}
      </View>
      <View style={styles.previewThumbRow}>
        {gallery.map((url: string, index: number) => (
          <Image key={`preview-${index}`} source={{ uri: url }} style={styles.previewThumb} />
        ))}
      </View>
      <View style={styles.previewBody}>
        <Text numberOfLines={2} style={styles.previewTitle}>{name || "Tên s?n ph?m"}</Text>
        <View style={styles.previewPriceLine}>
          <Text style={styles.previewSalePrice}>{formatMoney(price)}</Text>
          {Number(originalPrice || 0) > Number(price || 0) ? <Text style={styles.previewOldPrice}>{formatMoney(originalPrice)}</Text> : null}
        </View>
        <Text style={styles.previewMeta}>Size: {splitAdminList(sizes).join(' • ') || 'S • M • L • XL'}</Text>
        <Text style={styles.previewMeta}>Màu: {splitAdminList(colors).join(' • ') || 'Ðen • Tr?ng • Kem'}</Text>
        {!!dimensions ? <Text style={styles.previewMeta}>Kích thu?c: {dimensions}</Text> : null}
        <View style={styles.messageBox}>
          <Feather name="message-circle" size={18} color={ADMIN_BLUE} />
          <Text style={styles.messageText}>M?t hàng này còn không?</Text>
          <View style={styles.sendPill}><Text style={styles.sendText}>G?i</Text></View>
        </View>
      </View>
    </View>
  );
}

function Input({ label, style, ...props }: any) {
  return (
    <View style={[styles.inputWrap, style]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput {...props} placeholderTextColor="#A5AFB8" style={[styles.input, props.multiline ? styles.inputMultiline : null]} />
    </View>
  );
}

function SelectChip({ active, label, onPress }: any) {
  return (
    <Pressable onPress={onPress} style={[styles.selectChip, active ? styles.selectChipActive : null]}>
      <Text style={[styles.selectChipText, active ? styles.selectChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

export default function AdminScreen() {
  const { width } = useWindowDimensions();
  const desktop = width >= 920;
  const { user, isLoggedIn } = useApp();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [bannedWords, setBannedWords] = useState<any[]>([]);
  const [bannedInput, setBannedInput] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [orderFilter, setOrderFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [uploadingMediaField, setUploadingMediaField] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [voucherForm, setVoucherForm] = useState(emptyVoucherForm);
  const [promotionForm, setPromotionForm] = useState(emptyPromotionForm);
  const [notificationForm, setNotificationForm] = useState(emptyNotificationForm);
  const [gameForm, setGameForm] = useState(emptyGameForm);
  const [search, setSearch] = useState("");
  const isAdmin = user?.role === "admin" || (user as any)?.isAdmin;
  const openAdminLogin = () => router.replace({ pathname: "/login", params: { redirectTo: "/admin" } } as any);
  const dashboard = overview?.dashboard || {};
  const kpis = dashboard?.kpis || {};

  const load = useCallback(async () => {
    if (!user?.id || !isAdmin) return;
    const [nextOverview, nextUsers, nextProducts, nextOrders, nextPayments, nextVouchers, nextGames, nextBanned] = await Promise.all([
      api.getAdminOverview(user.id),
      api.getAdminUsers(user.id),
      api.getAdminProducts(user.id),
      api.getAdminOrders(user.id),
      api.getAdminPayments(user.id),
      api.getAdminVouchers(user.id),
      api.getAdminGames(user.id),
      api.getBannedWords(user.id).catch(() => ({ words: [] })),
    ]);
    api.getSystemStatus(user.id).then((s) => setSystemStatus(s)).catch(() => setSystemStatus(null));
    setOverview(nextOverview);
    setUsers(Array.isArray(nextUsers?.users) ? nextUsers.users : []);
    setProducts(Array.isArray(nextProducts?.products) ? nextProducts.products : []);
    setOrders(Array.isArray(nextOrders?.orders) ? nextOrders.orders : []);
    setPayments(Array.isArray(nextPayments?.payments) ? nextPayments.payments : []);
    setVouchers(Array.isArray(nextVouchers?.vouchers) ? nextVouchers.vouchers : []);
    setGames(Array.isArray(nextGames?.games) ? nextGames.games : []);
    setBannedWords(Array.isArray(nextBanned?.words) ? nextBanned.words : []);
  }, [user?.id, isAdmin]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e: any) => Alert.alert("Không m? du?c admin", e?.message || "Ki?m tra backend/MongoDB."))
      .finally(() => setLoading(false));
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load().catch((e: any) => Alert.alert("Không t?i l?i du?c", e?.message || "Có l?i x?y ra."));
    setRefreshing(false);
  };


  const quickUpdateOrder = async (order: any, nextStatus: string) => {
    if (!user?.id) return;
    const orderId = String(order.id || order._id || "");
    if (!orderId) return Alert.alert("Thi?u mã don", "Không tìm th?y ID don hàng.");
    const labelMap: any = { paid: "Ðã thanh toán", shipping: "Ðang giao", delivered: "Ðã nh?n", completed: "Hoàn t?t", cancelled: "Ðã h?y", processing: "Ch? x? lý" };
    try {
      setActionId(`order-${nextStatus}-${orderId}`);
      const res = await api.updateAdminOrderStatus(user.id, orderId, nextStatus);
      Alert.alert(labelMap[nextStatus] || "Ðã c?p nh?t", res?.message || "Ðã c?p nh?t don hàng.");
      await load();
    } catch (e: any) {
      Alert.alert("Không c?p nh?t du?c don", e?.message || "Ki?m tra backend.");
    } finally {
      setActionId(null);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => `${p.name} ${p.id} ${p.category} ${p.sku}`.toLowerCase().includes(q));
  }, [products, search]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.name || ""} ${u.fullName || ""} ${u.email}`.toLowerCase().includes(q));
  }, [users, search]);

  const revenueByMonth = Array.isArray(dashboard?.revenueByMonth) ? dashboard.revenueByMonth.map((x: any) => ({ label: String(x.month || x.label || "").slice(5), value: Number(x.value ?? x.revenue ?? 0) })) : [];
  const topProducts = Array.isArray(dashboard?.salesByProduct) ? dashboard.salesByProduct : [];
  const predictions = Array.isArray(dashboard?.ml?.predictions) ? dashboard.ml.predictions : [];
  const customerTrends = Array.isArray(dashboard?.ml?.customerTrends) ? dashboard.ml.customerTrends : [];
  const mlForecast = dashboard?.ml?.revenueForecast || null;
  const mlSegments = dashboard?.ml?.segments || null;
  const mlModels = Array.isArray(dashboard?.ml?.models) ? dashboard.ml.models : [];
  const mlRecommender = dashboard?.ml?.recommender || null;
  const activeProducts = products.filter((p) => (p.status || "active") === "active").length;
  const hiddenProducts = products.filter((p) => (p.status || "active") !== "active").length;
  const activeVouchers = vouchers.filter((v) => v.active !== false && (v.kind || "voucher") === "voucher").length;
  const activePromotions = vouchers.filter((v) => v.active !== false && v.kind === "promotion").length;
  const latestActivity = [
    ...orders.slice(0, 4).map((o) => ({ icon: "shopping-bag", title: `Ðon #${String(o.id || "").slice(-8)}`, meta: `${formatMoney(o.total || o.totalAmount)} • ${o.status || "pending"}` })),
    ...payments.slice(0, 3).map((p) => ({ icon: "credit-card", title: `Thanh toán ${formatMoney(p.amount)}`, meta: `${p.status || "pending"} • ${compactDate(p.createdAt)}` })),
  ].slice(0, 6);

  const saveProduct = async () => {
    if (!user?.id) return;
    if (!productForm.name.trim()) return Alert.alert("Thi?u tên", "Nh?p tên s?n ph?m tru?c khi luu.");
    try {
      setActionId("product-save");
      const body = {
        ...productForm,
        price: Number(productForm.price || 0),
        originalPrice: Number(productForm.originalPrice || 0),
        discountPercent: Number(productForm.discountPercent || 0),
        images: [productForm.image, productForm.image2, productForm.image3, productForm.image4].map((x) => x.trim()).filter(Boolean),
        visualTags: splitAdminList(productForm.visualTags),
        sizes: splitAdminList(productForm.sizes),
        colors: splitAdminList(productForm.colors),
        dimensions: productForm.dimensions.trim(),
        fit: productForm.fit.trim(),
      };
      if (editingProductId) await api.updateAdminProduct(user.id, editingProductId, body);
      else await api.saveAdminProduct(user.id, body);
      setProductForm(emptyProductForm);
      setEditingProductId(null);
      await load();
      Alert.alert("Ðã luu", "S?n ph?m dã du?c c?p nh?t.");
    } catch (e: any) {
      Alert.alert("Không luu du?c", e?.message || "Có l?i x?y ra.");
    } finally {
      setActionId(null);
    }
  };

  const editProduct = (product: AdminProduct) => {
    setProductForm(toProductForm(product));
    setEditingProductId(product.id);
    setActiveTab("products");
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
        discountLabel: `Gi?m ${percent}%`,
        badge: `GI?M ${percent}%`,
      });
      await load();
    } catch (e: any) {
      Alert.alert("Không t?o gi?m giá", e?.message || "Có l?i x?y ra.");
    } finally {
      setActionId(null);
    }
  };

  const changeProductPrice = async (product: AdminProduct, percent: number) => {
    if (!user?.id) return;
    try {
      setActionId(`price-${product.id}`);
      await api.changeAdminProductPrice(user.id, product.id, percent);
      await load();
    } catch (e: any) {
      Alert.alert("Không ch?nh du?c giá", e?.message || "Có l?i x?y ra.");
    } finally {
      setActionId(null);
    }
  };

  const toggleProduct = async (product: AdminProduct) => {
    if (!user?.id) return;
    try {
      setActionId(`hide-${product.id}`);
      await api.setAdminProductHidden(user.id, product.id, (product.status || "active") === "active");
      await load();
    } catch (e: any) {
      Alert.alert("Không ?n/hi?n du?c", e?.message || "Có l?i x?y ra.");
    } finally {
      setActionId(null);
    }
  };

  const pickAndUploadAdminImage = async (target: "image" | "image2" | "image3" | "image4" | "bannerImage") => {
    if (!user?.id) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("C?n quy?n ?nh", "Cho phép truy c?p thu vi?n d? upload ?nh lên Cloudinary.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.86, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const uploadKey = `upload-${target}`;
    try {
      setUploadingMediaField(uploadKey);
      const data = await uploadMediaFile(
        {
          uri: asset.uri,
          name: asset.fileName || `${target}-${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
        },
        user.id,
        target === "bannerImage" ? "admin/banners" : "admin/products",
        target === "bannerImage" ? "admin-banner-image" : "admin-product-image",
        user.id,
      );
      const url = data.secureUrl || data.url;
      if (!url) throw new Error("Cloudinary không tr? v? URL ?nh.");
      if (target === "bannerImage") setPromotionForm((p) => ({ ...p, bannerImage: url }));
      else setProductForm((p) => ({ ...p, [target]: url }));
      Alert.alert("Ðã upload", "?nh dã luu trên Cloudinary và URL dã du?c di?n vào form.");
    } catch (e: any) {
      Alert.alert("Upload Cloudinary l?i", e?.message || "Không upload du?c ?nh.");
    } finally {
      setUploadingMediaField(null);
    }
  };

  const saveVoucher = async () => {
    if (!user?.id) return;
    if (!voucherForm.code.trim()) return Alert.alert("Thi?u mã", "Nh?p mã voucher tru?c.");
    try {
      setActionId("voucher-save");
      await api.saveAdminVoucher(user.id, {
        ...voucherForm,
        kind: "voucher",
        discountValue: Number(voucherForm.discountValue || 0),
        minOrderValue: Number(voucherForm.minOrderValue || 0),
        active: true,
      });
      setVoucherForm(emptyVoucherForm);
      await load();
      Alert.alert("Ðã t?o voucher", "Voucher dã s?n sàng cho ngu?i dùng.");
    } catch (e: any) {
      Alert.alert("Không luu voucher", e?.message || "Có l?i x?y ra.");
    } finally {
      setActionId(null);
    }
  };

  const savePromotion = async () => {
    if (!user?.id) return;
    if (!promotionForm.code.trim()) return Alert.alert("Thi?u mã", "Nh?p mã khuy?n mãi tru?c.");
    try {
      setActionId("promotion-save");
      await api.saveAdminVoucher(user.id, {
        ...promotionForm,
        kind: "promotion",
        discountValue: Number(promotionForm.discountValue || 0),
        minOrderValue: Number(promotionForm.minOrderValue || 0),
        active: true,
      });
      setPromotionForm(emptyPromotionForm);
      await load();
      Alert.alert("Ðã t?o khuy?n mãi", "Chi?n d?ch dã du?c luu trong DiscountCodes theo ERD.");
    } catch (e: any) {
      Alert.alert("Không luu khuy?n mãi", e?.message || "Có l?i x?y ra.");
    } finally {
      setActionId(null);
    }
  };

  const toggleVoucher = async (voucher: any) => {
    if (!user?.id) return;
    try {
      setActionId(`voucher-${voucher.id}`);
      await api.updateAdminVoucher(user.id, voucher.id, { active: !voucher.active });
      await load();
    } catch (e: any) {
      Alert.alert("Không d?i tr?ng thái", e?.message || "Có l?i x?y ra.");
    } finally {
      setActionId(null);
    }
  };

  const sendNotification = async () => {
    if (!user?.id) return;
    if (!notificationForm.title.trim()) return Alert.alert("Thi?u tiêu d?", "Nh?p tiêu d? thông báo.");
    try {
      setActionId("notification-send");
      const data = await api.sendAdminNotification(user.id, notificationForm);
      setNotificationForm(emptyNotificationForm);
      await load();
      Alert.alert("Ðã g?i", data?.message || "Thông báo dã du?c g?i.");
    } catch (e: any) {
      Alert.alert("Không g?i du?c", e?.message || "Có l?i x?y ra.");
    } finally {
      setActionId(null);
    }
  };

  const changeRole = async (target: AdminUser, nextRole: "admin" | "customer") => {
    if (!user?.id) return;
    try {
      setActionId(target.id);
      const data = await api.setAdminUserRole(user.id, target.id, nextRole);
      setUsers((current) => current.map((item) => (item.id === target.id ? { ...item, ...data.user } : item)));
      await load().catch(() => null);
      Alert.alert("Ðã c?p nh?t", data?.message || "Ðã d?i quy?n tài kho?n.");
    } catch (e: any) {
      Alert.alert("Không d?i du?c quy?n", e?.message || "Có l?i x?y ra.");
    } finally {
      setActionId(null);
    }
  };

  const adjustCoins = async (target: AdminUser, delta: number) => {
    if (!user?.id) return;
    try {
      setActionId(`coins-${target.id}`);
      const data = await api.adjustAdminUserCoins(user.id, target.id, delta);
      setUsers((current) => current.map((item) => (item.id === target.id ? { ...item, ...data.user } : item)));
    } catch (e: any) {
      Alert.alert("Không ch?nh du?c xu", e?.message || "Có l?i x?y ra.");
    } finally {
      setActionId(null);
    }
  };

  const saveGame = async () => {
    if (!user?.id) return;
    if (!gameForm.name.trim()) return Alert.alert("Thi?u tên", "Nh?p tên game tru?c.");
    try {
      setActionId("game-save");
      const body = { ...gameForm, rewardCoins: Number(gameForm.rewardCoins || 0), active: true };
      if (editingGameId) await api.updateAdminGame(user.id, editingGameId, body);
      else await api.saveAdminGame(user.id, body);
      setGameForm(emptyGameForm);
      setEditingGameId(null);
      await load();
    } catch (e: any) {
      Alert.alert("Không luu game", e?.message || "Có l?i x?y ra.");
    } finally {
      setActionId(null);
    }
  };

  const editGame = (game: any) => {
    setEditingGameId(String(game._id || game.id));
    setGameForm({ slug: game.slug || "", name: game.name || "", description: game.description || "", rewardCoins: String(game.rewardCoins || 0) });
  };

  const deleteGame = async (game: any) => {
    if (!user?.id) return;
    try {
      setActionId(`game-${game._id || game.id}`);
      await api.deleteAdminGame(user.id, String(game._id || game.id));
      await load();
    } catch (e: any) {
      Alert.alert("Không xoá game", e?.message || "Có l?i x?y ra.");
    } finally {
      setActionId(null);
    }
  };

  if (!isLoggedIn || !isAdmin) {
    return (
      <View style={styles.authPage}>
        <View style={styles.authCard}>
          <View style={styles.logoBox}><Feather name={isLoggedIn ? "lock" : "shield"} size={26} color="#fff" /></View>
          <Text style={styles.authTitle}>{isLoggedIn ? "Không có quy?n admin" : "Ðang nh?p admin"}</Text>
          <Text style={styles.authText}>{isLoggedIn ? `Email hi?n t?i: ${user?.email}. Hãy dùng tài kho?n admin.` : "Tài kho?n admin m?c d?nh: a@gmail.com / m?t kh?u 1."}</Text>
          <Pressable onPress={openAdminLogin} style={styles.authButton}>
            <Text style={styles.authButtonText}>{isLoggedIn ? "Ð?i tài kho?n" : "Ðang nh?p"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const Sidebar = () => {
    let lastGroup = "";
    return (
      <View style={[styles.sidebar, !desktop ? styles.sidebarMobile : null]}>
        <View style={styles.sidebarLogoRow}>
          <View style={styles.sidebarLogo}><Feather name="zap" size={19} color="#fff" /></View>
          <View>
            <Text style={styles.sidebarBrand}>JAPANO</Text>
            <Text style={styles.sidebarSub}>ADMIN DASHBOARD</Text>
          </View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={desktop ? styles.navContent : styles.navContentMobile} horizontal={!desktop}>
          {navItems.map((item) => {
            const showGroup = desktop && item.group !== lastGroup;
            lastGroup = item.group;
            const active = activeTab === item.key;
            return (
              <React.Fragment key={item.key}>
                {showGroup ? <Text style={styles.navGroup}>{item.group}</Text> : null}
                <Pressable onPress={() => setActiveTab(item.key)} style={[styles.navItem, active ? styles.navItemActive : null]}>
                  <Feather name={item.icon} size={17} color={active ? ADMIN_GREEN : ADMIN_MUTED_DARK} />
                  <Text style={[styles.navText, active ? styles.navTextActive : null]}>{item.label}</Text>
                  {item.badge ? <Text style={styles.navBadge}>{item.badge}</Text> : null}
                </Pressable>
              </React.Fragment>
            );
          })}
        </ScrollView>
        {desktop ? (
          <View style={styles.sidebarUser}>
            <View style={styles.sidebarAvatar}><Text style={styles.sidebarAvatarText}>{String(user?.email || "A").slice(0, 1).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.sidebarUserName}>{user?.email}</Text>
              <Text style={styles.sidebarUserRole}>Admin</Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const Topbar = () => (
    <View style={styles.topbar}>
      <View style={styles.searchBox}>
        <Feather name="search" size={18} color={ADMIN_MUTED} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Tìm s?n ph?m, khách hàng, don hàng..." placeholderTextColor={ADMIN_MUTED} style={styles.searchInput} />
      </View>
      <Pressable onPress={refresh} style={styles.topIconBtn}><Feather name="refresh-cw" size={18} color={ADMIN_TEXT} /></Pressable>
      <Pressable onPress={() => setActiveTab("products")} style={styles.newOrderBtn}><Feather name="plus" size={16} color="#fff" /><Text style={styles.newOrderText}>Thêm s?n ph?m</Text></Pressable>
    </View>
  );

  const refreshStatus = async () => {
    if (!user?.id) return;
    setStatusLoading(true);
    try { const s = await api.getSystemStatus(user.id); setSystemStatus(s); } catch {} finally { setStatusLoading(false); }
  };

  const renderOverview = () => (
    <View style={styles.pageGap}>
      <View style={styles.heroCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Chào tr? l?i, {user?.name || "Admin"}</Text>
          <Text style={styles.heroSub}>Hôm nay có {formatNumber(orders.length)} don trong h? th?ng, {activeVouchers + activePromotions} chi?n d?ch dang ho?t d?ng.</Text>
        </View>
        <Pressable onPress={() => setActiveTab("analytics")} style={styles.heroButton}><Text style={styles.heroButtonText}>Xem phân tích</Text><Feather name="arrow-right" size={16} color="#fff" /></Pressable>
      </View>

      {loading ? <View style={[styles.card, { flexDirection: "row", gap: 10, alignItems: "center" }]}><ActivityIndicator color={ADMIN_GREEN} /><Text style={styles.userMeta}>Ðang t?i d? li?u b?ng di?u khi?n...</Text></View> : null}

      {/* KPI hôm nay - d? li?u th?t */}
      <View style={styles.statsGrid}>
        <StatCard label="Doanh thu hôm nay" value={formatCompactMoney(kpis.revenueToday)} change={`${formatNumber(kpis.ordersToday || 0)} don hôm nay`} icon="dollar-sign" accent={ADMIN_GREEN} />
        <StatCard label="Ðon hàng" value={formatNumber(kpis.orders || orders.length)} change={`${formatNumber(kpis.ordersToday || 0)} hôm nay`} icon="shopping-bag" accent={ADMIN_BLUE} />
        <StatCard label="Ngu?i dùng m?i" value={formatNumber(kpis.newUsersToday || 0)} change={`${formatNumber(kpis.users || users.length)} t?ng`} icon="user-plus" accent="#A33A2F" />
        <StatCard label="Lu?t th? d? AI" value={formatNumber(kpis.tryon2d || 0)} change={`${formatNumber(kpis.tryon2dFail || 0)} l?i`} icon="camera" accent={ADMIN_ORANGE} />
        <StatCard label="Lu?t t?o 3D" value={formatNumber(kpis.tryon3d || 0)} change={`${formatNumber(kpis.tryon3dFail || 0)} l?i`} icon="box" accent={ADMIN_BLUE} />
      </View>

      {/* Tr?ng thái server AI + l?i m?i nh?t */}
      <View style={styles.dashboardGrid}>
        <View style={[styles.card, styles.bigChartCard]}>
          <SectionHeader title="Tình tr?ng server AI" subtitle="Ki?m tra nhanh các d?ch v?" right={<Pressable onPress={refreshStatus} style={styles.smallBtn}>{statusLoading ? <ActivityIndicator size="small" color={ADMIN_TEXT} /> : <Feather name="refresh-cw" size={13} color={ADMIN_TEXT} />}<Text style={styles.smallBtnText}>Ki?m tra l?i</Text></Pressable>} />
          {systemStatus?.services ? (
            <View style={{ gap: 8 }}>
              {systemStatus.services.map((s: any) => (
                <View key={s.key} style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: s.online ? "#2E7D32" : ADMIN_RED }]} />
                  <Text style={styles.statusName}>{s.label}</Text>
                  <Text style={[styles.statusVal, { color: s.online ? "#2E7D32" : ADMIN_RED }]}>{s.online ? "Online" : "Offline"}</Text>
                </View>
              ))}
              <Text style={styles.userMeta}>GPU: {systemStatus.gpu} • CUDA: {systemStatus.cuda} • Stripe: {systemStatus.stripe ? "dã c?u hình" : "chua c?u hình"}</Text>
            </View>
          ) : <Text style={styles.emptyText}>{statusLoading ? "Ðang ki?m tra d?ch v?..." : "Chua l?y du?c tr?ng thái. B?m \"Ki?m tra l?i\"."}</Text>}
        </View>
        <View style={styles.card}>
          <SectionHeader title="L?i m?i nh?t" subtitle="Nh?t ký l?i AI/h? th?ng" />
          {systemStatus?.errors?.length ? systemStatus.errors.slice(0, 6).map((e: any, i: number) => (
            <View key={i} style={styles.errRow}>
              <Feather name="alert-triangle" size={13} color={ADMIN_ORANGE} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errScope}>{e.scope}</Text>
                <Text numberOfLines={2} style={styles.errMsg}>{e.message}</Text>
              </View>
            </View>
          )) : <Text style={styles.emptyText}>Chua có l?i nào du?c ghi nh?n. ??</Text>}
        </View>
      </View>

      <View style={styles.dashboardGrid}>
        <View style={[styles.card, styles.bigChartCard]}>
          <SectionHeader title="Tang tru?ng doanh thu" subtitle="Xu hu?ng theo tháng" right={<View style={styles.segment}><Text style={styles.segmentActive}>MRR</Text><Text style={styles.segmentText}>ARR</Text></View>} />
          <MiniBars data={revenueByMonth.length ? revenueByMonth : miniTrendData([])} accent={ADMIN_GREEN} money />
        </View>
        <View style={styles.card}>
          <SectionHeader title="S?n ph?m bán ch?y" subtitle="Top theo s? lu?ng bán" />
          {topProducts.length ? <HorizontalBars data={topProducts.map((x: any) => ({ label: x.name, value: x.unitsSold }))} accent={ADMIN_GREEN} /> : <Text style={styles.emptyText}>Chua có d? li?u bán hàng.</Text>}
        </View>
      </View>

      <View style={styles.dashboardGrid}>
        <View style={styles.card}>
          <SectionHeader title="Ho?t d?ng g?n dây" subtitle="Ðon hàng và thanh toán" />
          <View style={{ gap: 13 }}>
            {latestActivity.length ? latestActivity.map((item, idx) => (
              <View key={`${item.title}-${idx}`} style={styles.activityRow}>
                <View style={styles.activityIcon}><Feather name={item.icon as any} size={16} color={ADMIN_GREEN} /></View>
                <View style={{ flex: 1 }}><Text style={styles.activityTitle}>{item.title}</Text><Text style={styles.activityMeta}>{item.meta}</Text></View>
              </View>
            )) : <Text style={styles.emptyText}>Chua có ho?t d?ng g?n dây.</Text>}
          </View>
        </View>
      </View>
    </View>
  );

  const renderAnalytics = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Phân tích & H?c máy (ML)" subtitle="3 mô hình ch?y tr?c ti?p trên d? li?u don hàng / khách hàng / s?n ph?m, không c?n cài thêm thu vi?n." />

      <View style={styles.modelRow}>
        {(mlModels.length ? mlModels : [{ name: 'Ðang t?i mô hình', type: '—', metric: '' }]).map((m: any, i: number) => (
          <View key={i} style={styles.modelCard}>
            <View style={styles.modelTop}><Feather name="cpu" size={16} color={ADMIN_GREEN} /><Text style={styles.modelName}>{m.name}</Text></View>
            <Text style={styles.modelType}>{m.type}</Text>
            <Text style={styles.modelMetric}>{m.metric}{m.demo ? ' · minh ho?' : ''}</Text>
          </View>
        ))}
      </View>

      <View style={styles.analyticsGrid}>
        <View style={[styles.card, styles.bigChartCard]}>
          <SectionHeader title="D? báo doanh thu — H?i quy tuy?n tính (OLS)" subtitle={mlForecast?.algorithm || 'U?c lu?ng xu hu?ng và d? báo 3 tháng t?i.'} />
          <ForecastChart forecast={mlForecast} />
        </View>
        <View style={styles.card}>
          <SectionHeader title="Phân khúc khách hàng — K-Means" subtitle={mlSegments?.algorithm || 'Gom khách hàng theo hành vi mua.'} />
          <SegmentsView segments={mlSegments} />
        </View>
      </View>

      <View style={styles.analyticsGrid}>
        <View style={[styles.card, styles.bigChartCard]}>
          <SectionHeader title="S?n ph?m n?i b?t — G?i ý (CF + Matrix Factorization)" subtitle={mlRecommender?.algorithm || 'L?c c?ng tác item-based + phân rã ma tr?n d? x?p h?ng s?n ph?m.'} />
          <HorizontalBars data={(mlRecommender?.featured || []).map((x: any) => ({ label: x.name, value: x.score }))} accent="#2F4A73" />
          {mlRecommender?.demo ? <Text style={styles.demoTag}>d? li?u minh ho? — s? chính xác hon khi có nhi?u don/gi?/wishlist</Text> : null}
        </View>
        <View style={styles.card}>
          <SectionHeader title="Ði?m nhu c?u s?n ph?m (DemandScore)" subtitle="Bán ra, wishlist, gi?, dánh giá, d? m?i, nh?c trong AI chat." />
          <View style={styles.featureWrap}>{(dashboard?.ml?.features || ["unitsSold", "wishlist", "cart", "rating", "recency", "chatMention"]).map((f: string) => <Text key={f} style={styles.featureChip}>{f}</Text>)}</View>
          <HorizontalBars data={predictions.map((x: any) => ({ label: x.name, value: x.score }))} accent={ADMIN_GREEN} />
        </View>
      </View>

      <View style={styles.analyticsGrid}>
        <View style={[styles.card, styles.bigChartCard]}>
          <SectionHeader title="Xu hu?ng theo danh m?c" subtitle="T?ng h?p bán ra + wishlist + gi?" />
          <HorizontalBars data={customerTrends.map((x: any) => ({ label: x.category, value: x.score }))} accent="#A33A2F" />
        </View>
      </View>

      <View style={styles.predictionGrid}>
        {predictions.map((item: any) => (
          <View key={item.productId} style={styles.predictionCard}>
            {item.image ? <Image source={{ uri: item.image }} style={styles.predictionImage} /> : <View style={styles.predictionImage}><Feather name="image" size={22} color={ADMIN_MUTED} /></View>}
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.predictionTitle}>{item.name}</Text>
              <Text style={styles.predictionMeta}>{item.category} • {formatMoney(item.price)}</Text>
              <Text style={styles.predictionSuggestion}>{item.predictedDemand} — {item.suggestion}</Text>
              <Text style={styles.predictionSmall}>Bán {item.features?.sold || 0} • Thích {item.features?.wishlist || 0} • Gi? {item.features?.cart || 0} • ? {item.features?.avgRating ?? '-'}</Text>
            </View>
            <View style={styles.scoreBox}><Text style={styles.scoreText}>{item.score}</Text><Text style={styles.scoreLabel}>di?m</Text></View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderProducts = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Qu?n lý s?n ph?m" subtitle="Thêm, ?n, s?a 4 ?nh s?n ph?m, size/kích c?, kích thu?c, màu s?c, mô t?, giá và sale." right={<Text style={styles.counterPill}>{activeProducts} dang bán / {hiddenProducts} dang ?n</Text>} />
      <View style={styles.productManagerGrid}>
        <View style={[styles.card, styles.formCard]}>
          <Text style={styles.formTitle}>{editingProductId ? `Ðang s?a: ${editingProductId}` : "Thêm s?n ph?m m?i"}</Text>
          <View style={styles.formGrid2}>
            <Input label="Mã s?n ph?m" value={productForm.id} onChangeText={(id: string) => setProductForm((p) => ({ ...p, id }))} placeholder="jp-kimono-001" />
            <Input label="SKU" value={productForm.sku} onChangeText={(sku: string) => setProductForm((p) => ({ ...p, sku }))} placeholder="JP-001" />
          </View>
          <Input label="Tên s?n ph?m" value={productForm.name} onChangeText={(name: string) => setProductForm((p) => ({ ...p, name }))} placeholder="Ðàn guitar và giá d? dàn" />
          <View style={styles.formGrid3}>
            <Input label="Giá dang bán" value={productForm.price} keyboardType="numeric" onChangeText={(price: string) => setProductForm((p) => ({ ...p, price }))} placeholder="250000" />
            <Input label="Giá g?c / giá g?ch" value={productForm.originalPrice} keyboardType="numeric" onChangeText={(originalPrice: string) => setProductForm((p) => ({ ...p, originalPrice }))} placeholder="300000" />
            <Input label="% gi?m" value={productForm.discountPercent} keyboardType="numeric" onChangeText={(discountPercent: string) => setProductForm((p) => ({ ...p, discountPercent }))} placeholder="17" />
          </View>
          <View style={styles.formGrid2}>
            <Input label="Nhãn gi?m giá" value={productForm.discountLabel} onChangeText={(discountLabel: string) => setProductForm((p) => ({ ...p, discountLabel }))} placeholder="Flash Sale" />
            <Input label="Nhãn" value={productForm.badge} onChangeText={(badge: string) => setProductForm((p) => ({ ...p, badge }))} placeholder="GI?M 17%" />
          </View>
          <View style={styles.formGrid2}>
            <Input label="?nh l?n / ?nh 1 URL" value={productForm.image} onChangeText={(image: string) => setProductForm((p) => ({ ...p, image }))} placeholder="https://..." />
            <Input label="?nh nh? 2 URL" value={productForm.image2} onChangeText={(image2: string) => setProductForm((p) => ({ ...p, image2 }))} placeholder="https://..." />
          </View>
          <View style={styles.formGrid2}>
            <Input label="?nh nh? 3 URL" value={productForm.image3} onChangeText={(image3: string) => setProductForm((p) => ({ ...p, image3 }))} placeholder="https://..." />
            <Input label="?nh nh? 4 URL" value={productForm.image4} onChangeText={(image4: string) => setProductForm((p) => ({ ...p, image4 }))} placeholder="https://..." />
          </View>
          <View style={styles.mediaUploadBox}>
            <Text style={styles.mediaUploadTitle}>Upload ?nh s?n ph?m lên Cloudinary</Text>
            <Text style={styles.mediaUploadHint}>Ch?n ?nh t? máy, h? th?ng s? upload lên Cloudinary r?i t? di?n URL vào 4 ô ?nh.</Text>
            <View style={styles.actionRow}>
              {(["image", "image2", "image3", "image4"] as const).map((field, index) => {
                const key = `upload-${field}`;
                return (
                  <Pressable key={field} disabled={uploadingMediaField === key} onPress={() => pickAndUploadAdminImage(field)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>{uploadingMediaField === key ? "Ðang upload..." : `Upload ?nh ${index + 1}`}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Input label="Mô t? s?n ph?m" value={productForm.description} onChangeText={(description: string) => setProductForm((p) => ({ ...p, description }))} placeholder="Mô t? ng?n..." multiline />
          <View style={styles.formGrid3}>
            <Input label="Danh m?c" value={productForm.category} onChangeText={(category: string) => setProductForm((p) => ({ ...p, category }))} placeholder="fashion" />
            <Input label="Danh m?c con" value={productForm.subcategory} onChangeText={(subcategory: string) => setProductForm((p) => ({ ...p, subcategory }))} placeholder="streetwear" />
            <Input label="T?n kho" value={productForm.stockQuantity} keyboardType="numeric" onChangeText={(stockQuantity: string) => setProductForm((p) => ({ ...p, stockQuantity }))} placeholder="999" />
          </View>
          <View style={styles.formGrid2}>
            <Input label="Size / kích c?" value={productForm.sizes} onChangeText={(sizes: string) => setProductForm((p) => ({ ...p, sizes }))} placeholder="S, M, L, XL" />
            <Input label="Màu s?c" value={productForm.colors} onChangeText={(colors: string) => setProductForm((p) => ({ ...p, colors }))} placeholder="Ðen, tr?ng, kem ho?c #000000, #FFFFFF" />
            <Text style={[styles.userMeta, { marginTop: 6 }]}>B?ng màu nhanh (b?m d? thêm mã hex):</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {["#000000", "#FFFFFF", "#F5F5DC", "#A33A2F", "#1C140F", "#8B4513", "#2F4A73", "#2E7D32", "#B00020", "#D4AF37", "#808080", "#F28C28"].map((hex) => (
                <Pressable key={hex} onPress={() => setProductForm((p) => { const arr = splitAdminList(p.colors || ""); return arr.map((x: string) => x.toLowerCase()).includes(hex.toLowerCase()) ? p : { ...p, colors: [...arr, hex].join(", ") }; })} style={[styles.swatch, { backgroundColor: hex, borderColor: ADMIN_BORDER }]}>
                  {hex === "#FFFFFF" ? <Feather name="plus" size={13} color="#999" /> : null}
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.formGrid2}>
            <Input label="Kích thu?c" value={productForm.dimensions} onChangeText={(dimensions: string) => setProductForm((p) => ({ ...p, dimensions }))} placeholder="Dài 68cm, ngang vai 46cm..." />
            <Input label="Form / ki?u v?a" value={productForm.fit} onChangeText={(fit: string) => setProductForm((p) => ({ ...p, fit }))} placeholder="Regular fit / Oversize / Slim" />
          </View>
          <Input label="Th? hình ?nh" value={productForm.visualTags} onChangeText={(visualTags: string) => setProductForm((p) => ({ ...p, visualTags }))} placeholder="japanese, black, minimal" />
          <Input label="Ki?u s? d?ng" value={productForm.styleUseCase} onChangeText={(styleUseCase: string) => setProductForm((p) => ({ ...p, styleUseCase }))} placeholder="Ði choi, ch?p ?nh, cosplay nh?" />
          <View style={styles.actionRow}>
            <Pressable disabled={actionId === "product-save"} onPress={saveProduct} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>{actionId === "product-save" ? "Ðang luu..." : editingProductId ? "C?p nh?t s?n ph?m" : "Thêm s?n ph?m"}</Text></Pressable>
            <Pressable onPress={() => { setProductForm(emptyProductForm); setEditingProductId(null); }} style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Xóa form</Text></Pressable>
          </View>
        </View>
        <ProductDiscountPreview name={productForm.name} price={Number(productForm.price || 0)} originalPrice={Number(productForm.originalPrice || 0)} discountPercent={Number(productForm.discountPercent || 0)} image={productForm.image} images={[productForm.image, productForm.image2, productForm.image3, productForm.image4]} sizes={productForm.sizes} colors={productForm.colors} dimensions={productForm.dimensions} />
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
                {gallery[0] ? <Image source={{ uri: gallery[0] }} style={styles.productImage} /> : <View style={styles.productImage}><Feather name="image" size={22} color={ADMIN_MUTED} /></View>}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.productTitle}>{product.name || product.productName}</Text>
                  <Text style={styles.productMeta}>{product.id} • {product.category || "general"}</Text>
                  <View style={styles.productPriceLine}>
                    <Text style={styles.productPrice}>{formatMoney(product.price)}</Text>
                    {Number(product.originalPrice || 0) > Number(product.price || 0) ? <Text style={styles.productOldPrice}>{formatMoney(product.originalPrice)}</Text> : null}
                    {discount > 0 ? <Text style={styles.discountBadge}>-{discount}%</Text> : null}
                  </View>
                  <Text style={styles.productMeta}>Status: {product.status || "active"} • Stock: {product.stockQuantity || 0}</Text>
                </View>
              </View>
              <Text numberOfLines={2} style={styles.productDesc}>{product.description || "Chua có mô t?."}</Text>
              <View style={styles.adminThumbRow}>
                {gallery.map((url, index) => <Image key={`${product.id}-thumb-${index}`} source={{ uri: url }} style={styles.adminThumb} />)}
              </View>
              <Text style={styles.productMeta}>?nh: {gallery.length}/4 • Size: {sizes.join(' / ') || 'S / M / L / XL'} • Màu: {colors.join(' / ') || 'Ðen / Tr?ng / Kem'}</Text>
              {product.dimensions || product.fit ? <Text style={styles.productMeta}>Kích thu?c: {product.dimensions || '--'} • Form: {product.fit || '--'}</Text> : null}
              <View style={styles.actionRow}>
                <Pressable onPress={() => editProduct(product)} style={styles.smallBtn}><Text style={styles.smallBtnText}>S?a</Text></Pressable>
                <Pressable onPress={() => toggleProduct(product)} style={styles.smallBtn}><Text style={styles.smallBtnText}>{hidden ? "Hi?n" : "?n"}</Text></Pressable>
                <Pressable onPress={() => changeProductPrice(product, 10)} style={styles.smallBtn}><Text style={styles.smallBtnText}>+10%</Text></Pressable>
                <Pressable onPress={() => changeProductPrice(product, -10)} style={styles.smallBtn}><Text style={styles.smallBtnText}>-10%</Text></Pressable>
                <Pressable onPress={() => quickDiscount(product, 15)} style={styles.saleBtn}><Text style={styles.saleBtnText}>Sale -15%</Text></Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderPromotions = () => {
    const voucherRows = vouchers.filter((v) => (v.kind || "voucher") === "voucher");
    const promotionRows = vouchers.filter((v) => v.kind === "promotion");
    return (
      <View style={styles.pageGap}>
        <SectionHeader title="Voucher & Khuy?n mãi" subtitle="T?o voucher, khuy?n mãi, flash sale và g?i thông báo chung cho ngu?i dùng." right={<Text style={styles.counterPill}>{activeVouchers} voucher • {activePromotions} chi?n d?ch</Text>} />
        <View style={styles.promoGrid}>
          <View style={styles.card}>
            <Text style={styles.formTitle}>Thêm voucher cho ngu?i dùng</Text>
            <View style={styles.formGrid2}>
              <Input label="Mã voucher" value={voucherForm.code} onChangeText={(code: string) => setVoucherForm((p) => ({ ...p, code }))} placeholder="JAPANO50" />
              <Input label="Tên voucher" value={voucherForm.title} onChangeText={(title: string) => setVoucherForm((p) => ({ ...p, title }))} placeholder="Gi?m cho khách m?i" />
            </View>
            <View style={styles.actionRow}>
              <SelectChip active={voucherForm.discountType === "percent"} label="Theo %" onPress={() => setVoucherForm((p) => ({ ...p, discountType: "percent" }))} />
              <SelectChip active={voucherForm.discountType === "fixed"} label="Theo ti?n" onPress={() => setVoucherForm((p) => ({ ...p, discountType: "fixed" }))} />
            </View>
            <View style={styles.formGrid3}>
              <Input label="Giá tr? gi?m" value={voucherForm.discountValue} keyboardType="numeric" onChangeText={(discountValue: string) => setVoucherForm((p) => ({ ...p, discountValue }))} placeholder="20 ho?c 50000" />
              <Input label="Ðon t?i thi?u" value={voucherForm.minOrderValue} keyboardType="numeric" onChangeText={(minOrderValue: string) => setVoucherForm((p) => ({ ...p, minOrderValue }))} placeholder="300000" />
              <Input label="H?t h?n" value={voucherForm.expiryDate} onChangeText={(expiryDate: string) => setVoucherForm((p) => ({ ...p, expiryDate }))} placeholder="2026-12-31" />
            </View>
            <Input label="Mô t?" value={voucherForm.description} onChangeText={(description: string) => setVoucherForm((p) => ({ ...p, description }))} placeholder="Áp d?ng toàn shop..." multiline />
            <Pressable disabled={actionId === "voucher-save"} onPress={saveVoucher} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>{actionId === "voucher-save" ? "Ðang t?o..." : "T?o voucher"}</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.formTitle}>Thêm khuy?n mãi / chi?n d?ch</Text>
            <View style={styles.formGrid2}>
              <Input label="Mã chi?n d?ch" value={promotionForm.code} onChangeText={(code: string) => setPromotionForm((p) => ({ ...p, code }))} placeholder="FLASHSALE15" />
              <Input label="Tên khuy?n mãi" value={promotionForm.title} onChangeText={(title: string) => setPromotionForm((p) => ({ ...p, title }))} placeholder="Flash Sale cu?i tu?n" />
            </View>
            <View style={styles.actionRow}>
              <SelectChip active={promotionForm.discountType === "percent"} label="Gi?m %" onPress={() => setPromotionForm((p) => ({ ...p, discountType: "percent" }))} />
              <SelectChip active={promotionForm.discountType === "fixed"} label="Gi?m ti?n" onPress={() => setPromotionForm((p) => ({ ...p, discountType: "fixed" }))} />
            </View>
            <View style={styles.formGrid3}>
              <Input label="Giá tr?" value={promotionForm.discountValue} keyboardType="numeric" onChangeText={(discountValue: string) => setPromotionForm((p) => ({ ...p, discountValue }))} placeholder="15" />
              <Input label="Ðon t?i thi?u" value={promotionForm.minOrderValue} keyboardType="numeric" onChangeText={(minOrderValue: string) => setPromotionForm((p) => ({ ...p, minOrderValue }))} placeholder="0" />
              <Input label="Ph?m vi" value={promotionForm.scope} onChangeText={(scope: string) => setPromotionForm((p) => ({ ...p, scope }))} placeholder="all / category:áo" />
            </View>
            <View style={styles.formGrid2}>
              <Input label="B?t d?u" value={promotionForm.startsAt} onChangeText={(startsAt: string) => setPromotionForm((p) => ({ ...p, startsAt }))} placeholder="2026-06-10" />
              <Input label="K?t thúc" value={promotionForm.expiryDate} onChangeText={(expiryDate: string) => setPromotionForm((p) => ({ ...p, expiryDate }))} placeholder="2026-06-30" />
            </View>
            <View style={styles.inputWrap}>
              <Input label="?nh banner (URL)" value={promotionForm.bannerImage} onChangeText={(bannerImage: string) => setPromotionForm((p) => ({ ...p, bannerImage }))} placeholder="https://..." />
              <Pressable disabled={uploadingMediaField === "upload-bannerImage"} onPress={() => pickAndUploadAdminImage("bannerImage")} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>{uploadingMediaField === "upload-bannerImage" ? "Ðang upload..." : "Upload banner Cloudinary"}</Text>
              </Pressable>
            </View>
            <Input label="Mô t? chi?n d?ch" value={promotionForm.description} onChangeText={(description: string) => setPromotionForm((p) => ({ ...p, description }))} placeholder="Gi?m giá cu?i tu?n cho toàn b? s?n ph?m..." multiline />
            <Pressable disabled={actionId === "promotion-save"} onPress={savePromotion} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>{actionId === "promotion-save" ? "Ðang t?o..." : "T?o khuy?n mãi"}</Text></Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.formTitle}>Thông báo chung</Text>
          <View style={styles.formGrid2}>
            <Input label="Tiêu d?" value={notificationForm.title} onChangeText={(title: string) => setNotificationForm((p) => ({ ...p, title }))} placeholder="Flash Sale 50%" />
            <Input label="N?i dung" value={notificationForm.content} onChangeText={(content: string) => setNotificationForm((p) => ({ ...p, content }))} placeholder="M? app nh?n voucher hôm nay..." />
          </View>
          <Pressable disabled={actionId === "notification-send"} onPress={sendNotification} style={styles.secondaryBtnWide}><Text style={styles.secondaryBtnText}>{actionId === "notification-send" ? "Ðang g?i..." : "G?i thông báo cho t?t c? user"}</Text></Pressable>
        </View>

        <View style={styles.listGrid2}>
          <View style={styles.card}>
            <SectionHeader title="Danh sách voucher" subtitle="B?t/t?t mã gi?m giá" />
            {voucherRows.length ? voucherRows.map((voucher) => (
              <View key={voucher.id} style={styles.voucherRow}>
                <View style={styles.voucherIcon}><Feather name="tag" size={17} color={ADMIN_GREEN} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.voucherCode}>{voucher.code}</Text>
                  <Text style={styles.voucherMeta}>{voucher.title || "Voucher"} • {voucher.discountType === "fixed" ? formatMoney(voucher.discountValue) : `${voucher.discountValue}%`} • HSD {compactDate(voucher.expiryDate)}</Text>
                </View>
                <Pressable onPress={() => toggleVoucher(voucher)} style={[styles.statusPill, voucher.active ? styles.statusOn : styles.statusOff]}><Text style={styles.statusText}>{voucher.active ? "ON" : "OFF"}</Text></Pressable>
              </View>
            )) : <Text style={styles.emptyText}>Chua có voucher.</Text>}
          </View>

          <View style={styles.card}>
            <SectionHeader title="Danh sách khuy?n mãi" subtitle="Chi?n d?ch dang ch?y" />
            {promotionRows.length ? promotionRows.map((promo) => (
              <View key={promo.id} style={styles.promoRow}>
                {promo.bannerImage ? <Image source={{ uri: promo.bannerImage }} style={styles.promoThumb} /> : <View style={styles.promoThumb}><Feather name="image" size={18} color={ADMIN_MUTED} /></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.voucherCode}>{promo.title || promo.code}</Text>
                  <Text style={styles.voucherMeta}>{promo.code} • {promo.discountType === "fixed" ? formatMoney(promo.discountValue) : `${promo.discountValue}%`} • {compactDate(promo.startsAt)} ? {compactDate(promo.expiryDate)}</Text>
                  <Text numberOfLines={1} style={styles.voucherMeta}>{promo.description || "Chi?n d?ch khuy?n mãi"}</Text>
                </View>
                <Pressable onPress={() => toggleVoucher(promo)} style={[styles.statusPill, promo.active ? styles.statusOn : styles.statusOff]}><Text style={styles.statusText}>{promo.active ? "ON" : "OFF"}</Text></Pressable>
              </View>
            )) : <Text style={styles.emptyText}>Chua có khuy?n mãi.</Text>}
          </View>
        </View>
      </View>
    );
  };

  const renderUserDetail = () => {
    const u = users.find((x) => String(x.id) === String(selectedUserId));
    if (!u) return null;
    const uid = String(u.id);
    const userOrders = orders.filter((o) => String(o.userId) === uid);
    const userPayments = payments.filter((p) => String(p.userId) === uid);
    const spend = userOrders.reduce((s, o) => s + Number(o.total || o.totalAmount || 0), 0);
    return (
      <View style={[styles.card, { gap: 14 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[styles.userAvatar, u.role === "admin" ? styles.userAvatarAdmin : null]}><Feather name={u.role === "admin" ? "shield" : "user"} size={20} color={u.role === "admin" ? "#fff" : ADMIN_GREEN} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>{u.name || u.fullName || "Khách JAPANO"}</Text>
            <Text style={styles.userEmail}>{u.email} • {u.phone || "chua có SÐT"}</Text>
            <Text style={styles.userMeta}>Ð?a ch?: {u.address || "chua có"} • Xu {formatNumber(u.coins)} {u.vip ? "• VIP" : ""}</Text>
          </View>
          <Pressable onPress={() => setSelectedUserId(null)} style={styles.smallBtn}><Feather name="x" size={14} color={ADMIN_TEXT} /><Text style={styles.smallBtnText}>Ðóng</Text></Pressable>
        </View>

        <View style={styles.statMiniRow}>
          <View style={styles.statMini}><Text style={styles.statMiniNum}>{userOrders.length}</Text><Text style={styles.statMiniCap}>Ðon hàng</Text></View>
          <View style={styles.statMini}><Text style={styles.statMiniNum}>{formatMoney(spend)}</Text><Text style={styles.statMiniCap}>T?ng chi tiêu</Text></View>
          <View style={styles.statMini}><Text style={styles.statMiniNum}>{userPayments.length}</Text><Text style={styles.statMiniCap}>Giao d?ch</Text></View>
        </View>

        <Text style={styles.formTitle}>Ðon hàng & s?n ph?m dã mua</Text>
        {userOrders.length ? userOrders.map((o) => (
          <View key={o.id} style={styles.orderDetailCard}>
            <View style={styles.barLineTop}>
              <Text style={styles.userName}>#{String(o.id).slice(-8)} • {formatMoney(o.total || o.totalAmount)}</Text>
              <View style={[styles.statusChip, o.status === "completed" ? styles.statusOk : o.status === "cancelled" ? styles.statusBad : styles.statusPend]}>
                <Text style={styles.statusChipText}>{o.status || "pending"}</Text>
              </View>
            </View>
            <Text style={styles.userMeta}>Thanh toán: {o.paymentMethod || "--"} • {o.paymentStatus || "pending"} • {compactDate(o.createdAt)}</Text>
            {o.shippingAddress ? <Text numberOfLines={1} style={styles.userMeta}>Giao t?i: {o.shippingAddress} {o.phoneNumber ? `• ${o.phoneNumber}` : ""}</Text> : null}
            {(o.items || []).map((it: any, idx: number) => (
              <View key={idx} style={styles.orderItemRow}>
                {it.image ? <Image source={{ uri: it.image }} style={styles.orderItemImg} /> : <View style={styles.orderItemImg}><Feather name="image" size={14} color={ADMIN_MUTED} /></View>}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.orderItemName}>{it.name}</Text>
                  <Text style={styles.userMeta}>SL {it.quantity} {it.size ? `• size ${it.size}` : ""} {it.color ? `• ${it.color}` : ""}</Text>
                </View>
                <Text style={styles.orderItemPrice}>{formatMoney(it.unitPrice)}</Text>
              </View>
            ))}
            <View style={styles.userActions}>
              <Pressable onPress={() => quickUpdateOrder(o, "paid")} style={styles.smallBtn}><Text style={styles.smallBtnText}>Ðã thanh toán</Text></Pressable>
              <Pressable onPress={() => quickUpdateOrder(o, "shipping")} style={styles.saleBtn}><Feather name="truck" size={13} color="#fff" /><Text style={styles.saleBtnText}>Ðang giao</Text></Pressable>
              <Pressable onPress={() => quickUpdateOrder(o, "delivered")} style={styles.saleBtn}><Feather name="check" size={13} color="#fff" /><Text style={styles.saleBtnText}>Ðã nh?n</Text></Pressable>
              <Pressable onPress={() => quickUpdateOrder(o, "cancelled")} style={styles.dangerBtn}><Feather name="x" size={13} color="#fff" /><Text style={styles.dangerBtnText}>H?y</Text></Pressable>
            </View>
          </View>
        )) : <Text style={styles.emptyText}>Khách này chua có don hàng.</Text>}

        {userPayments.length ? (
          <>
            <Text style={styles.formTitle}>Thông tin thanh toán</Text>
            {userPayments.map((p) => (
              <View key={p.id} style={styles.paymentRow}>
                <View style={styles.paymentIcon}><Feather name="credit-card" size={15} color={ADMIN_GREEN} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentTitle}>{formatMoney(p.amount)} • {p.status}</Text>
                  <Text numberOfLines={1} style={styles.paymentMeta}>{p.method || "--"} • Txn {p.transactionId || "--"} • {compactDate(p.createdAt)}</Text>
                </View>
              </View>
            ))}
          </>
        ) : null}
      </View>
    );
  };

  const renderUsers = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Khách hàng & Phân quy?n" subtitle="B?m m?t khách d? xem don dã mua, s?n ph?m, thanh toán và d?i tr?ng thái giao hàng." right={<Text style={styles.counterPill}>{filteredUsers.length} khách</Text>} />
      {selectedUserId ? renderUserDetail() : null}
      <View style={styles.tableCard}>
        {filteredUsers.map((item) => {
          const isSelf = item.id === user?.id;
          const isItemAdmin = item.role === "admin";
          const canGrant = !isItemAdmin;
          const canRevoke = isItemAdmin && !isSelf && !item.isProtectedAdmin;
          const ordersCount = orders.filter((o) => String(o.userId) === String(item.id)).length;
          return (
            <View key={item.id} style={styles.userRow}>
              <View style={[styles.userAvatar, isItemAdmin ? styles.userAvatarAdmin : null]}><Feather name={isItemAdmin ? "shield" : "user"} size={18} color={isItemAdmin ? "#fff" : ADMIN_GREEN} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.userName}>{item.name || item.fullName || "JAPANO Member"}</Text>
                <Text numberOfLines={1} style={styles.userEmail}>{item.email}</Text>
                <Text style={styles.userMeta}>Tr?ng thái {item.status || "active"} • Xu {formatNumber(item.coins)} • {ordersCount} don {item.vip ? "• VIP" : ""}</Text>
              </View>
              <View style={[styles.rolePill, isItemAdmin ? styles.roleAdmin : null]}><Text style={[styles.rolePillText, isItemAdmin ? styles.rolePillTextAdmin : null]}>{isItemAdmin ? "ADMIN" : "KHÁCH"}</Text></View>
              <View style={styles.userActions}>
                <Pressable onPress={() => setSelectedUserId(String(item.id))} style={styles.saleBtn}><Feather name="eye" size={13} color="#fff" /><Text style={styles.saleBtnText}>Chi ti?t</Text></Pressable>
                <Pressable onPress={() => adjustCoins(item, 100)} style={styles.smallBtn}><Text style={styles.smallBtnText}>+100 xu</Text></Pressable>
                <Pressable onPress={() => adjustCoins(item, -100)} style={styles.smallBtn}><Text style={styles.smallBtnText}>-100 xu</Text></Pressable>
                {canGrant ? <Pressable onPress={() => changeRole(item, "admin")} style={styles.saleBtn}><Text style={styles.saleBtnText}>C?p admin</Text></Pressable> : null}
                {canRevoke ? <Pressable onPress={() => changeRole(item, "customer")} style={styles.dangerBtn}><Text style={styles.dangerBtnText}>G? admin</Text></Pressable> : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderTransactions = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Ðon hàng / Thanh toán" subtitle="Theo dõi thông tin giao d?ch, don hàng và tr?ng thái thanh toán." />
      <View style={styles.listGrid2}>
        <View style={styles.card}>
          <SectionHeader title="Thanh toán" subtitle="Giao d?ch g?n dây" />
          {payments.length ? payments.map((payment) => (
            <View key={payment.id} style={styles.paymentRow}>
              <View style={styles.paymentIcon}><Feather name="credit-card" size={16} color={ADMIN_GREEN} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentTitle}>{formatMoney(payment.amount)}</Text>
                <Text style={styles.paymentMeta}>{payment.method || payment.paymentMethod || "Thanh toán"} • {payment.status} • {compactDate(payment.createdAt)}</Text>
                <Text numberOfLines={1} style={styles.paymentMeta}>User: {payment.userId || "--"} • Txn: {payment.transactionId || "--"}</Text>
              </View>
            </View>
          )) : <Text style={styles.emptyText}>Chua có giao d?ch.</Text>}
        </View>
        <View style={styles.card}>
          <SectionHeader title="Ðon hàng g?n dây" subtitle="Ðon hàng m?i" />
          {orders.length ? orders.map((order) => (
            <View key={order.id} style={styles.paymentRow}>
              <View style={styles.paymentIcon}><Feather name="shopping-bag" size={16} color={ADMIN_BLUE} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentTitle}>#{String(order.id).slice(-8)} • {formatMoney(order.total || order.totalAmount)}</Text>
                <Text style={styles.paymentMeta}>Status: {order.status} • Payment: {order.paymentStatus} • {compactDate(order.createdAt)}</Text>
                <Text numberOfLines={1} style={styles.paymentMeta}>User: {order.userId} • {order.paymentMethod || "COD"}</Text>
                <View style={styles.adminOrderQuickRow}>
                  <Pressable disabled={actionId === `order-completed-${order.id}`} onPress={() => quickUpdateOrder(order, "completed")} style={styles.successBtn}>
                    <Text style={styles.successBtnText}>Xác nh?n thành công</Text>
                  </Pressable>
                  <Pressable disabled={actionId === `order-cancelled-${order.id}`} onPress={() => quickUpdateOrder(order, "cancelled")} style={styles.dangerBtn}>
                    <Text style={styles.dangerBtnText}>H?y nhanh</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )) : <Text style={styles.emptyText}>Chua có don hàng.</Text>}
        </View>
      </View>
    </View>
  );

  const renderGames = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Qu?n lý trò choi" subtitle="Thêm, s?a, xóa game và c?u hình thu?ng xu." />
      <View style={styles.card}>
        <Text style={styles.formTitle}>{editingGameId ? "S?a game" : "Thêm game"}</Text>
        <View style={styles.formGrid2}>
          <Input label="Slug" value={gameForm.slug} onChangeText={(slug: string) => setGameForm((p) => ({ ...p, slug }))} placeholder="quiz-battle" />
          <Input label="Tên game" value={gameForm.name} onChangeText={(name: string) => setGameForm((p) => ({ ...p, name }))} placeholder="Quiz Battle" />
        </View>
        <Input label="Mô t?" value={gameForm.description} onChangeText={(description: string) => setGameForm((p) => ({ ...p, description }))} placeholder="Tr? l?i nhanh nh?n xu" multiline />
        <Input label="Thu?ng xu" value={gameForm.rewardCoins} keyboardType="numeric" onChangeText={(rewardCoins: string) => setGameForm((p) => ({ ...p, rewardCoins }))} placeholder="30" />
        <View style={styles.actionRow}>
          <Pressable onPress={saveGame} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>{editingGameId ? "C?p nh?t game" : "Thêm game"}</Text></Pressable>
          <Pressable onPress={() => { setGameForm(emptyGameForm); setEditingGameId(null); }} style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Xóa form</Text></Pressable>
        </View>
      </View>
      <View style={styles.productListGrid}>
        {games.map((game) => (
          <View key={String(game._id || game.id)} style={styles.productCard}>
            <Text style={styles.productTitle}>{game.name}</Text>
            <Text style={styles.productMeta}>{game.slug} • Thu?ng {formatNumber(game.rewardCoins)} xu</Text>
            <Text style={styles.productDesc}>{game.description || "Chua có mô t?."}</Text>
            <View style={styles.actionRow}>
              <Pressable onPress={() => editGame(game)} style={styles.smallBtn}><Text style={styles.smallBtnText}>S?a</Text></Pressable>
              <Pressable onPress={() => deleteGame(game)} style={styles.dangerBtn}><Text style={styles.dangerBtnText}>Xóa</Text></Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const addBanned = async () => {
    const w = bannedInput.trim();
    if (!w) return;
    if (!user?.id) {
      Alert.alert("L?i", "B?n c?n dang nh?p d? th?c hi?n thao tác này.");
      return;
    }
    try {
      await api.addBannedWord(user.id, w);
      setBannedInput("");
      await load();
    } catch (e: any) {
      Alert.alert("L?i", e?.message || "Không thêm du?c t? c?m.");
    }
  };
  const removeBanned = async (id: string) => {
    if (!user?.id) {
      Alert.alert("L?i", "B?n c?n dang nh?p d? th?c hi?n thao tác này.");
      return;
    }
    try {
      await api.deleteBannedWord(user.id, id);
      await load();
    } catch (e: any) {
      Alert.alert("L?i", e?.message || "Không xoá du?c.");
    }
  };

  const renderModeration = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="T? c?m khi bình lu?n / dánh giá" subtitle="Ðánh giá ch?a các t? này s? b? ch?n t? d?ng trên toàn app." right={<Text style={styles.counterPill}>{bannedWords.length} t?</Text>} />
      <View style={[styles.card, styles.formCard]}>
        <Text style={styles.formTitle}>Thêm t? c?m</Text>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}>
            <Input label="T? / c?m t? c?m" value={bannedInput} onChangeText={setBannedInput} placeholder="ví d?: l?a d?o" />
          </View>
          <Pressable onPress={addBanned} style={styles.newOrderBtn}><Feather name="plus" size={16} color="#fff" /><Text style={styles.newOrderText}>Thêm</Text></Pressable>
        </View>
      </View>
      <View style={styles.card}>
        <SectionHeader title="Danh sách t? c?m" subtitle="B?m vào m?t t? d? xoá" />
        <View style={styles.bannedWrap}>
          {bannedWords.length ? bannedWords.map((b: any) => (
            <Pressable key={b.id} onPress={() => removeBanned(b.id)} style={styles.bannedChip}>
              <Text style={styles.bannedChipText}>{b.word}</Text>
              <Feather name="x" size={13} color={ADMIN_RED} />
            </Pressable>
          )) : <Text style={styles.emptyText}>Chua có t? c?m. H? th?ng t? seed danh sách m?c d?nh khi có dánh giá d?u tiên.</Text>}
        </View>
      </View>
    </View>
  );

  const isAccessoryClient = (p: any) => {
    const hay = `${p?.category || ""} ${p?.subcategory || ""} ${(p?.visualTags || []).join(" ")} ${p?.name || ""}`.toLowerCase();
    return /(phu kien|ph? ki?n|accessor|non|nón|mu |mu|kinh|kính|khan|khan|tui|túi|vong|vòng|dong ho|d?ng h?|hat|cap|bag|watch|necklace|bracelet|scarf|belt|glasses|earring|bong tai|bông tai|du |dù)/.test(hay);
  };
  const accessoryProducts = useMemo(() => products.filter(isAccessoryClient), [products]);

  const addNewAccessory = () => {
    setProductForm({ ...emptyProductForm, category: "phu-kien", subcategory: "phu-kien" });
    setEditingProductId(null);
    setActiveTab("products");
  };

  const renderAccessories = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Qu?n lý ph? ki?n (danh m?c riêng)" subtitle="Nón, mu, vòng tay, túi, kính, khan, d?ng h?... Qu?n lý ?nh, màu, size, t?n kho, giá riêng cho nhóm ph? ki?n." right={<Text style={styles.counterPill}>{accessoryProducts.length} ph? ki?n</Text>} />
      <View style={[styles.card, { gap: 10 }]}>
        <Text style={styles.formTitle}>Thêm ph? ki?n m?i</Text>
        <Text style={styles.userMeta}>M? form s?n ph?m v?i danh m?c dã d?t s?n là "phu-kien". B?n ch? c?n di?n tên, ?nh, màu, size, s? lu?ng và giá.</Text>
        <Pressable onPress={addNewAccessory} style={styles.newOrderBtn}><Feather name="plus" size={16} color="#fff" /><Text style={styles.newOrderText}>Thêm ph? ki?n</Text></Pressable>
      </View>
      <View style={styles.tableCard}>
        {accessoryProducts.length ? accessoryProducts.map((item) => (
          <View key={item.id} style={styles.userRow}>
            {item.image ? <Image source={{ uri: item.image }} style={styles.accThumb} /> : <View style={styles.accThumb}><Feather name="watch" size={18} color={ADMIN_MUTED} /></View>}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.userName}>{item.name}</Text>
              <Text numberOfLines={1} style={styles.userEmail}>{item.category || "phu-kien"} • {formatMoney(item.price)}</Text>
              <Text style={styles.userMeta}>T?n kho {formatNumber(item.stockQuantity || item.stock || 0)} • {(item.status || "active") === "active" ? "Ðang bán" : "Ðang ?n"} {Array.isArray(item.colors) && item.colors.length ? `• ${item.colors.length} màu` : ""} {Array.isArray(item.sizes) && item.sizes.length ? `• ${item.sizes.length} size` : ""}</Text>
            </View>
            <View style={styles.userActions}>
              <Pressable onPress={() => editProduct(item)} style={styles.saleBtn}><Feather name="edit-2" size={13} color="#fff" /><Text style={styles.saleBtnText}>S?a</Text></Pressable>
              <Pressable onPress={() => toggleProduct(item)} style={styles.smallBtn}><Text style={styles.smallBtnText}>{(item.status || "active") === "active" ? "?n" : "Hi?n"}</Text></Pressable>
            </View>
          </View>
        )) : <Text style={styles.emptyText}>Chua có ph? ki?n. B?m "Thêm ph? ki?n" d? t?o, ho?c d?t danh m?c s?n ph?m là "phu-kien".</Text>}
      </View>
    </View>
  );

  const renderSystemStatus = () => {
    const m = systemStatus?.metrics || kpis;
    return (
      <View style={styles.pageGap}>
        <SectionHeader title="Tr?ng thái h? th?ng AI" subtitle="Theo dõi CatVTON, 3D Gateway, Ollama, MongoDB, Backend theo th?i gian th?c." right={<Pressable onPress={refreshStatus} style={styles.newOrderBtn}>{statusLoading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="refresh-cw" size={14} color="#fff" />}<Text style={styles.newOrderText}>Ki?m tra l?i</Text></Pressable>} />
        <View style={styles.tableCard}>
          {systemStatus?.services ? systemStatus.services.map((s: any) => (
            <View key={s.key} style={styles.userRow}>
              <View style={[styles.statusDot, { backgroundColor: s.online ? "#2E7D32" : ADMIN_RED, width: 14, height: 14 }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{s.label}</Text>
                {s.url ? <Text numberOfLines={1} style={styles.userMeta}>{s.url}</Text> : <Text style={styles.userMeta}>D?ch v? n?i b?</Text>}
              </View>
              <View style={[styles.statusChip, s.online ? styles.statusOk : styles.statusBad]}><Text style={styles.statusChipText}>{s.online ? "Online" : "Offline"}</Text></View>
            </View>
          )) : <Text style={styles.emptyText}>{statusLoading ? "Ðang ki?m tra d?ch v?..." : "Chua l?y du?c tr?ng thái — b?m \"Ki?m tra l?i\". N?u backend chua ch?y, hãy kh?i d?ng server c?ng 4000."}</Text>}
          <View style={{ paddingTop: 10 }}>
            <Text style={styles.userMeta}>GPU: {systemStatus?.gpu || "NVIDIA RTX 5060 Ti"} • CUDA: {systemStatus?.cuda || "Available"}</Text>
            <Text style={styles.userMeta}>Hu?ng d?n restart: ch?y l?i ti?n trình tuong ?ng (CatVTON :7861, Gateway :8001, Ollama :11434) r?i b?m Ki?m tra l?i.</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Th? d? 2D" value={formatNumber(m.tryon2d || 0)} change={`${formatNumber(m.tryon2dFail || 0)} l?i`} icon="camera" accent={ADMIN_GREEN} />
          <StatCard label="T?o 3D" value={formatNumber(m.tryon3d || 0)} change={`${formatNumber(m.tryon3dFail || 0)} l?i`} icon="box" accent={ADMIN_BLUE} />
          <StatCard label="T? l? l?i 2D" value={`${m.tryon2d ? Math.round((m.tryon2dFail / m.tryon2d) * 100) : 0}%`} change="AI try-on" icon="alert-triangle" accent={ADMIN_ORANGE} />
          <StatCard label="T? l? l?i 3D" value={`${m.tryon3d ? Math.round((m.tryon3dFail / m.tryon3d) * 100) : 0}%`} change="AI 3D" icon="alert-triangle" accent={ADMIN_RED} />
        </View>

        <View style={styles.card}>
          <SectionHeader title="Nh?t ký l?i g?n dây" subtitle="20 l?i m?i nh?t t? AI/h? th?ng" />
          {systemStatus?.errors?.length ? systemStatus.errors.map((e: any, i: number) => (
            <View key={i} style={styles.errRow}>
              <Feather name="alert-triangle" size={13} color={ADMIN_ORANGE} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errScope}>{e.scope} • {String(e.at).slice(0, 19).replace("T", " ")}</Text>
                <Text style={styles.errMsg}>{e.message}</Text>
              </View>
            </View>
          )) : <Text style={styles.emptyText}>Chua có l?i nào du?c ghi nh?n.</Text>}
        </View>
      </View>
    );
  };

  const renderTryon2d = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Qu?n lý th? d? AI 2D (CatVTON)" subtitle={'Theo dõi s? lu?t, t? l? l?i và c?u hình model. B?m "Ki?m tra l?i" ? tab Tr?ng thái d? c?p nh?t.'} right={<Text style={styles.counterPill}>{formatNumber(kpis.tryon2d || 0)} lu?t</Text>} />
      <View style={styles.statsGrid}>
        <StatCard label="T?ng lu?t th? d?" value={formatNumber(kpis.tryon2d || 0)} change="t?t c? th?i gian" icon="camera" accent={ADMIN_GREEN} />
        <StatCard label="Thành công" value={formatNumber((kpis.tryon2d || 0) - (kpis.tryon2dFail || 0))} change="u?c tính" icon="check-circle" accent={ADMIN_BLUE} />
        <StatCard label="L?i" value={formatNumber(kpis.tryon2dFail || 0)} change="xem nh?t ký" icon="alert-triangle" accent={ADMIN_RED} />
      </View>
      <View style={styles.card}>
        <SectionHeader title="C?u hình engine" subtitle="Chu?i uu tiên model m?nh" />
        <Text style={styles.userMeta}>Uu tiên: CatVTON (JAPANO_CATVTON_URL:7861) ? AI Gateway (:8001, model=strong, steps=50, hd) ? ghép ?nh d? phòng (luôn ra k?t qu?).</Text>
        <Text style={styles.userMeta}>L?y ?nh s?n ph?m: g?i c? gallery (t?i da 6 ?nh) cho model d? th? d? h?p lý hon.</Text>
      </View>
      <View style={styles.card}>
        <SectionHeader title="L?ch s? th? d? (?nh vào / ?nh k?t qu?)" subtitle="C?n b?t luu l?ch s? ? backend" />
        <Text style={styles.emptyText}>Chua b?t luu l?ch s? ?nh. Ð? hi?n danh sách ?nh ngu?i dùng / ?nh qu?n áo / ?nh k?t qu? kèm seed/steps/cfg và nút ch?y l?i, c?n thêm collection luu m?i lu?t th? d? ? backend (mình có th? làm ? vòng sau).</Text>
      </View>
    </View>
  );

  const renderModel3d = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Qu?n lý m?u 3D" subtitle="S? lu?t d?ng 3D và tr?ng thái. GLB storage c?n backend luu file." right={<Text style={styles.counterPill}>{formatNumber(kpis.tryon3d || 0)} lu?t</Text>} />
      <View style={styles.statsGrid}>
        <StatCard label="T?ng lu?t t?o 3D" value={formatNumber(kpis.tryon3d || 0)} change="t?t c? th?i gian" icon="box" accent={ADMIN_GREEN} />
        <StatCard label="Thành công" value={formatNumber((kpis.tryon3d || 0) - (kpis.tryon3dFail || 0))} change="u?c tính" icon="check-circle" accent={ADMIN_BLUE} />
        <StatCard label="L?i" value={formatNumber(kpis.tryon3dFail || 0)} change="xem nh?t ký" icon="alert-triangle" accent={ADMIN_RED} />
      </View>
      <View style={styles.card}>
        <SectionHeader title="Danh sách model .glb" subtitle="C?n b?t luu GLB ? backend" />
        <Text style={styles.emptyText}>Hi?n 3D tr? v? khung hình nhi?u góc (turntable). Ð? có danh sách file .glb + ?nh d?u vào + nút xem/t?i/xóa + tr?ng thái TripoSR + th?i gian d?ng, c?n backend luu file GLB (TripoSR/SF3D) và metadata. Có th? b? sung ? vòng sau.</Text>
      </View>
    </View>
  );

  const renderBotChat = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Bot chat & G?i ý th?i trang" subtitle="Model, embedding và ki?m duy?t." />
      <View style={styles.card}>
        <SectionHeader title="C?u hình model" subtitle="Ðang dùng" />
        <Text style={styles.userMeta}>Chat model: llama3.1:8b (Ollama) • Embedding: nomic-embed-text</Text>
        <Text style={styles.userMeta}>Phong cách: tu v?n th?i trang thân thi?n, g?i ý outfit theo d?p và s?n ph?m trong shop.</Text>
      </View>
      <View style={styles.card}>
        <SectionHeader title="Danh sách t? c?m" subtitle="Áp d?ng cho bình lu?n & chat" right={<Pressable onPress={() => setActiveTab("moderation")} style={styles.smallBtn}><Text style={styles.smallBtnText}>Qu?n lý</Text></Pressable>} />
        <Text style={styles.userMeta}>{formatNumber(bannedWords.length)} t? dang ch?n. Vào tab T? c?m d? thêm/xoá.</Text>
      </View>
      <View style={styles.card}>
        <SectionHeader title="Prompt h? th?ng & l?ch s? h?i dáp" subtitle="C?n backend luu prompt/l?ch s?" />
        <Text style={styles.emptyText}>Ð? ch?nh prompt h? th?ng tr?c ti?p và xem l?ch s? câu h?i/câu tr? l?i + dánh giá h?u ích, c?n thêm API luu prompt & h?i tho?i ? backend. Có th? b? sung ? vòng sau.</Text>
      </View>
    </View>
  );

  const renderActive = () => {
    if (loading) {
      return <View style={styles.loadingCard}><ActivityIndicator color={ADMIN_GREEN} /><Text style={styles.emptyText}>Ðang t?i d? li?u admin...</Text></View>;
    }
    if (activeTab === "overview") return renderOverview();
    if (activeTab === "analytics") return renderAnalytics();
    if (activeTab === "products") return renderProducts();
    if (activeTab === "accessories") return renderAccessories();
    if (activeTab === "promotions") return renderPromotions();
    if (activeTab === "users") return renderUsers();
    if (activeTab === "transactions") return renderTransactions();
    if (activeTab === "moderation") return renderModeration();
    if (activeTab === "system") return renderSystemStatus();
    if (activeTab === "tryon2d") return renderTryon2d();
    if (activeTab === "model3d") return renderModel3d();
    if (activeTab === "botchat") return renderBotChat();
    return renderGames();
  };

  return (
    <View style={styles.appShell}>
      {desktop ? <Sidebar /> : null}
      <View style={styles.mainArea}>
        {!desktop ? <Sidebar /> : null}
        <Topbar />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={ADMIN_GREEN} />}
          showsVerticalScrollIndicator
        >
          {renderActive()}
        </ScrollView>
      </View>
    </View>
  );
}

const textBase = { fontFamily: "System" };
const textHeading = { ...textBase, color: ADMIN_TEXT, fontWeight: "800" };
const textBody = { ...textBase, color: ADMIN_MUTED, fontWeight: "600" };

const styles = StyleSheet.create({
  appShell: { flex: 1, flexDirection: "row", backgroundColor: ADMIN_BG },
  sidebar: { width: 238, backgroundColor: ADMIN_DARK, padding: 20, paddingBottom: 16 },
  sidebarMobile: { width: "100%", padding: 12, paddingBottom: 10 },
  sidebarLogoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  sidebarLogo: { width: 34, height: 34, borderRadius: 16, backgroundColor: ADMIN_GREEN, alignItems: "center", justifyContent: "center" },
  sidebarBrand: { color: "#fff", fontSize: 15, fontWeight: "900" },
  sidebarSub: { color: ADMIN_MUTED_DARK, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginTop: 2 },
  navContent: { gap: 4, paddingBottom: 20 },
  navContentMobile: { gap: 8, alignItems: "center" },
  navGroup: { color: "#52605A", fontSize: 10, fontWeight: "900", letterSpacing: 1.1, marginTop: 14, marginBottom: 5 },
  navItem: { minHeight: 40, borderRadius: 16, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  navItemActive: { backgroundColor: "#3A1410" },
  navText: { color: ADMIN_MUTED_DARK, fontSize: 13, fontWeight: "800" },
  navTextActive: { color: ADMIN_GREEN },
  navBadge: { marginLeft: "auto", backgroundColor: ADMIN_GREEN, color: "#fff", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 16, fontSize: 10, overflow: "hidden" },
  sidebarUser: { marginTop: "auto", paddingTop: 14, borderTopWidth: 1, borderTopColor: "#13221B", flexDirection: "row", alignItems: "center", gap: 10 },
  sidebarAvatar: { width: 34, height: 34, borderRadius: 16, backgroundColor: ADMIN_GREEN, alignItems: "center", justifyContent: "center" },
  sidebarAvatarText: { color: "#fff", fontWeight: "900" },
  sidebarUserName: { color: "#fff", fontSize: 12, fontWeight: "900" },
  sidebarUserRole: { color: ADMIN_MUTED_DARK, fontSize: 11, marginTop: 2 },
  mainArea: { flex: 1, minWidth: 0 },
  topbar: { minHeight: 68, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: ADMIN_BORDER, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", gap: 12 },
  searchBox: { flex: 1, maxWidth: 420, minHeight: 42, borderWidth: 1, borderColor: ADMIN_BORDER, backgroundColor: "#FAFBFC", borderRadius: 16, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  searchInput: { flex: 1, fontSize: 14, color: ADMIN_TEXT },
  topIconBtn: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: ADMIN_BORDER, backgroundColor: "#fff" },
  newOrderBtn: { minHeight: 42, borderRadius: 16, backgroundColor: ADMIN_GREEN, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  newOrderText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  content: { padding: 24, paddingBottom: 80 },
  pageGap: { gap: 18 },
  heroCard: { minHeight: 108, borderRadius: 16, backgroundColor: ADMIN_DARK, padding: 24, flexDirection: "row", alignItems: "center", gap: 18, overflow: "hidden" },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "900" },
  heroSub: { color: "#B9C8C0", fontSize: 14, marginTop: 6, fontWeight: "700" },
  heroButton: { minHeight: 42, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.16)", paddingHorizontal: 15, flexDirection: "row", gap: 8, alignItems: "center" },
  heroButtonText: { color: "#fff", fontWeight: "900" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  statCard: { flexGrow: 1, flexBasis: 220, minHeight: 150, borderRadius: 16, backgroundColor: ADMIN_CARD, borderWidth: 1, borderColor: ADMIN_BORDER, padding: 18 },
  statTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  statLabel: { color: ADMIN_MUTED, fontSize: 12, fontWeight: "800" },
  statValue: { color: ADMIN_TEXT, fontSize: 25, fontWeight: "900", marginTop: 6 },
  statIcon: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  statBottom: { flex: 1, marginTop: 13, flexDirection: "row", alignItems: "flex-end", gap: 10 },
  statChange: { fontSize: 12, fontWeight: "900", minWidth: 70 },
  dashboardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  dashboardGrid3: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  card: { flexGrow: 1, flexBasis: 300, borderRadius: 16, backgroundColor: ADMIN_CARD, borderWidth: 1, borderColor: ADMIN_BORDER, padding: 18, gap: 15, ...ADMIN_CARD_SHADOW },
  bigChartCard: { flexBasis: 560 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { ...textHeading, fontSize: 17 },
  sectionSub: { ...textBody, fontSize: 12, marginTop: 3 },
  segment: { flexDirection: "row", backgroundColor: "#F2F5F7", borderRadius: 16, padding: 4, gap: 3 },
  segmentActive: { backgroundColor: "#fff", color: ADMIN_TEXT, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, fontSize: 12, fontWeight: "900", overflow: "hidden" },
  segmentText: { color: ADMIN_MUTED, paddingHorizontal: 12, paddingVertical: 7, fontSize: 12, fontWeight: "900" },
  miniBars: { height: 220, flexDirection: "row", alignItems: "flex-end", gap: 10, paddingTop: 12 },
  miniBarsCompact: { flex: 1, height: 54, gap: 4, paddingTop: 0 },
  miniBarItem: { flex: 1, minWidth: 14, alignItems: "center", gap: 6 },
  miniBarTrack: { flex: 1, width: "100%", minHeight: 54, borderRadius: 16, backgroundColor: "#EEF3F6", overflow: "hidden", justifyContent: "flex-end" },
  miniBarFill: { width: "100%", borderTopLeftRadius: 6, borderTopRightRadius: 6, opacity: 0.92 },
  chartLabel: { color: ADMIN_MUTED, fontSize: 11, fontWeight: "800" },
  chartValue: { color: ADMIN_TEXT, fontSize: 10, fontWeight: "900" },
  goalCircle: { alignSelf: "center", width: 150, height: 150, borderRadius: 16, borderWidth: 15, borderColor: ADMIN_GREEN, alignItems: "center", justifyContent: "center", marginTop: 10 },
  goalNumber: { color: ADMIN_TEXT, fontSize: 30, fontWeight: "900" },
  goalText: { color: ADMIN_MUTED, fontSize: 12, fontWeight: "800" },
  centerMuted: { color: ADMIN_MUTED, fontSize: 13, fontWeight: "800", textAlign: "center" },
  barLineTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  barName: { flex: 1, color: ADMIN_TEXT, fontSize: 13, fontWeight: "900" },
  barValue: { color: ADMIN_MUTED, fontSize: 12, fontWeight: "900" },
  hTrack: { height: 9, backgroundColor: "#EEF3F6", borderRadius: 16, overflow: "hidden" },
  hFill: { height: "100%", borderRadius: 16 },
  funnelTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  funnelLabel: { color: ADMIN_TEXT, fontSize: 13, fontWeight: "900" },
  funnelValue: { color: ADMIN_MUTED, fontSize: 12, fontWeight: "900" },
  funnelTrack: { height: 10, borderRadius: 16, backgroundColor: "#EEF3F6", overflow: "hidden", marginTop: 6 },
  funnelFill: { height: "100%", borderRadius: 16 },
  funnelRates: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
  rateText: { fontSize: 12, fontWeight: "900" },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  activityIcon: { width: 34, height: 34, borderRadius: 16, backgroundColor: "#E9F8F1", alignItems: "center", justifyContent: "center" },
  activityTitle: { ...textHeading, fontSize: 13 },
  activityMeta: { ...textBody, fontSize: 12, marginTop: 2 },
  emptyText: { ...textBody, fontSize: 12, lineHeight: 20 },
  analyticsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  featureWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  featureChip: { color: ADMIN_TEXT, backgroundColor: "#F2F5F7", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, overflow: "hidden", fontSize: 12, fontWeight: "900" },
  predictionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  predictionCard: { flexGrow: 1, flexBasis: 360, borderRadius: 16, backgroundColor: ADMIN_CARD, borderWidth: 1, borderColor: ADMIN_BORDER, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  predictionImage: { width: 64, height: 64, borderRadius: 16, backgroundColor: "#F2F5F7", alignItems: "center", justifyContent: "center" },
  predictionTitle: { ...textHeading, fontSize: 14 },
  predictionMeta: { ...textBody, fontSize: 12, marginTop: 2 },
  predictionSuggestion: { ...textBody, fontSize: 12, marginTop: 6, lineHeight: 18 },
  predictionSmall: { ...textBody, fontSize: 11, marginTop: 4 },
  scoreBox: { width: 60, height: 60, borderRadius: 16, backgroundColor: "#ECFFF7", alignItems: "center", justifyContent: "center" },
  scoreText: { color: ADMIN_GREEN, fontSize: 19, fontWeight: "900" },
  scoreLabel: { color: ADMIN_MUTED, fontSize: 10, fontWeight: "800" },
  productManagerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" },
  formCard: { flexBasis: 650 },
  formTitle: { ...textHeading, fontSize: 16 },
  formGrid2: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  formGrid3: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  inputWrap: { flex: 1, minWidth: 170, gap: 6 },
  inputLabel: { color: ADMIN_MUTED, fontSize: 12, fontWeight: "900" },
  input: { minHeight: 44, borderWidth: 1, borderColor: ADMIN_BORDER, borderRadius: 16, backgroundColor: "#FAFBFC", color: ADMIN_TEXT, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, fontWeight: "700" },
  inputMultiline: { minHeight: 88, textAlignVertical: "top" },
  mediaUploadBox: { borderWidth: 1, borderColor: "#D8F3E6", backgroundColor: "#F6E7E3", borderRadius: 16, padding: 12, gap: 8 },
  mediaUploadTitle: { color: ADMIN_GREEN, fontSize: 13, fontWeight: "900" },
  mediaUploadHint: { color: ADMIN_MUTED, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 9, alignItems: "center" },
  primaryBtn: { minHeight: 44, borderRadius: 16, backgroundColor: ADMIN_GREEN, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  secondaryBtn: { minHeight: 44, borderRadius: 16, borderWidth: 1, borderColor: ADMIN_BORDER, backgroundColor: "#fff", paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  secondaryBtnWide: { minHeight: 44, borderRadius: 16, borderWidth: 1, borderColor: ADMIN_GREEN, backgroundColor: "#F6E7E3", paddingHorizontal: 16, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  secondaryBtnText: { color: ADMIN_TEXT, fontSize: 13, fontWeight: "900" },
  smallBtn: { minHeight: 36, borderRadius: 16, borderWidth: 1, borderColor: ADMIN_BORDER, paddingHorizontal: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  smallBtnText: { color: ADMIN_TEXT, fontSize: 12, fontWeight: "900" },
  saleBtn: { minHeight: 36, borderRadius: 16, backgroundColor: "#FFF7E6", borderWidth: 1, borderColor: "#F3D38A", paddingHorizontal: 11, alignItems: "center", justifyContent: "center" },
  saleBtnText: { color: "#B45309", fontSize: 12, fontWeight: "900" },
  dangerBtn: { minHeight: 36, borderRadius: 16, backgroundColor: "#FFF1F2", borderWidth: 1, borderColor: "#FBC4C8", paddingHorizontal: 11, alignItems: "center", justifyContent: "center" },
  dangerBtnText: { color: ADMIN_RED, fontSize: 12, fontWeight: "900" },
  marketPreview: { flexGrow: 1, flexBasis: 300, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: ADMIN_BORDER, overflow: "hidden" },
  previewTopIcons: { height: 58, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  previewImageBox: { height: 270, backgroundColor: "#EEF1F3", alignItems: "center", justifyContent: "center" },
  previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
  previewThumbRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff" },
  previewThumb: { flex: 1, height: 58, borderRadius: 16, backgroundColor: "#EEF1F3" },
  previewDiscount: { position: "absolute", left: 16, top: 16, backgroundColor: ADMIN_RED, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16 },
  previewDiscountText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  previewBody: { padding: 18, gap: 11 },
  previewTitle: { ...textHeading, fontSize: 22 },
  previewPriceLine: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  previewSalePrice: { ...textHeading, fontSize: 20 },
  previewOldPrice: { ...textBody, fontSize: 18, textDecorationLine: "line-through" },
  previewMeta: { ...textBody, fontSize: 12 },
  messageBox: { borderWidth: 1, borderColor: ADMIN_BORDER, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  messageText: { flex: 1, color: "#111", backgroundColor: "#F0F1F6", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, fontWeight: "700" },
  sendPill: { backgroundColor: ADMIN_BLUE, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  sendText: { color: "#fff", fontWeight: "900" },
  productListGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  productCard: { flexGrow: 1, flexBasis: 350, borderRadius: 16, backgroundColor: ADMIN_CARD, borderWidth: 1, borderColor: ADMIN_BORDER, padding: 14, gap: 12 },
  productTop: { flexDirection: "row", gap: 12 },
  productImage: { width: 78, height: 78, borderRadius: 16, backgroundColor: "#F2F5F7", alignItems: "center", justifyContent: "center" },
  productTitle: { ...textHeading, fontSize: 15 },
  productMeta: { ...textBody, fontSize: 12, marginTop: 3 },
  productPriceLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 6 },
  productPrice: { color: ADMIN_GREEN, fontSize: 16, fontWeight: "900" },
  productOldPrice: { color: ADMIN_MUTED, fontSize: 14, textDecorationLine: "line-through", fontWeight: "800" },
  discountBadge: { color: "#fff", backgroundColor: ADMIN_RED, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 16, overflow: "hidden", fontSize: 11, fontWeight: "900" },
  productDesc: { color: ADMIN_MUTED, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  adminThumbRow: { flexDirection: "row", gap: 8 },

  adminOrderQuickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  successBtn: { backgroundColor: ADMIN_GREEN, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  successBtnText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  adminThumb: { flex: 1, height: 58, borderRadius: 16, backgroundColor: "#F2F5F7" },
  counterPill: { color: ADMIN_GREEN, backgroundColor: "#E9F8F1", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, overflow: "hidden", fontSize: 12, fontWeight: "900" },
  promoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  selectChip: { borderWidth: 1, borderColor: ADMIN_BORDER, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff" },
  selectChipActive: { borderColor: ADMIN_GREEN, backgroundColor: "#E9F8F1" },
  selectChipText: { color: ADMIN_TEXT, fontSize: 12, fontWeight: "900" },
  selectChipTextActive: { color: ADMIN_GREEN },
  listGrid2: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  voucherRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#F0F2F4" },
  voucherIcon: { width: 36, height: 36, borderRadius: 16, backgroundColor: "#E9F8F1", alignItems: "center", justifyContent: "center" },
  voucherCode: { ...textHeading, fontSize: 14 },
  voucherMeta: { ...textBody, fontSize: 12, marginTop: 2 },
  statusPill: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  statusOn: { backgroundColor: "#E9F8F1" },
  statusOff: { backgroundColor: "#EEF1F3" },
  statusText: { color: ADMIN_TEXT, fontSize: 11, fontWeight: "900" },
  promoRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#F0F2F4" },
  promoThumb: { width: 54, height: 44, borderRadius: 16, backgroundColor: "#F2F5F7", alignItems: "center", justifyContent: "center" },
  tableCard: { borderRadius: 16, backgroundColor: ADMIN_CARD, borderWidth: 1, borderColor: ADMIN_BORDER, overflow: "hidden" },
  userRow: { padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#F0F2F4", flexWrap: "wrap" },
  userAvatar: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#E9F8F1", alignItems: "center", justifyContent: "center" },
  userAvatarAdmin: { backgroundColor: ADMIN_GREEN },
  userName: { ...textHeading, fontSize: 14 },
  userEmail: { ...textBody, fontSize: 12, marginTop: 2 },
  userMeta: { ...textBody, fontSize: 12, marginTop: 3 },
  rolePill: { borderWidth: 1, borderColor: ADMIN_BORDER, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#fff" },
  roleAdmin: { backgroundColor: ADMIN_GREEN, borderColor: ADMIN_GREEN },
  rolePillText: { color: ADMIN_TEXT, fontSize: 11, fontWeight: "900" },
  rolePillTextAdmin: { color: "#fff" },
  userActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  paymentRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F0F2F4" },
  paymentIcon: { width: 38, height: 38, borderRadius: 16, backgroundColor: "#F1F8FF", alignItems: "center", justifyContent: "center" },
  paymentTitle: { ...textHeading, fontSize: 14 },
  paymentMeta: { ...textBody, fontSize: 12, marginTop: 2 },
  loadingCard: { minHeight: 220, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: ADMIN_BORDER, alignItems: "center", justifyContent: "center", gap: 12 },
  authPage: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: ADMIN_BG, padding: 20 },
  authCard: { width: "100%", maxWidth: 420, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: ADMIN_BORDER, padding: 26, alignItems: "center", gap: 14 },
  logoBox: { width: 54, height: 54, borderRadius: 16, backgroundColor: ADMIN_GREEN, alignItems: "center", justifyContent: "center" },
  authTitle: { color: ADMIN_TEXT, fontSize: 24, fontWeight: "900", textAlign: "center" },
  authText: { color: ADMIN_MUTED, fontSize: 14, fontWeight: "700", textAlign: "center", lineHeight: 21 },
  authButton: { minHeight: 46, alignSelf: "stretch", backgroundColor: ADMIN_GREEN, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  authButtonText: { color: "#fff", fontSize: 14, fontWeight: "900" },

  // ML visuals
  modelRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  modelCard: { flexGrow: 1, minWidth: 200, backgroundColor: ADMIN_CARD, borderWidth: 1, borderColor: ADMIN_BORDER, borderRadius: 16, padding: 14, gap: 4 },
  modelTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  modelName: { color: ADMIN_TEXT, fontWeight: "900", fontSize: 14 },
  modelType: { color: ADMIN_GREEN, fontWeight: "900", fontSize: 12 },
  modelMetric: { color: ADMIN_MUTED, fontWeight: "700", fontSize: 12 },
  forecastMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricPill: { flexGrow: 1, minWidth: 120, backgroundColor: ADMIN_BG, borderWidth: 1, borderColor: ADMIN_BORDER, borderRadius: 16, padding: 10, gap: 2 },
  metricNum: { color: ADMIN_TEXT, fontWeight: "900", fontSize: 17 },
  metricCap: { color: ADMIN_MUTED, fontWeight: "700", fontSize: 11 },
  forecastChart: { flexDirection: "row", alignItems: "flex-end", height: 180, gap: 6, paddingTop: 8 },
  forecastCol: { flex: 1, alignItems: "center", gap: 4 },
  forecastVal: { color: ADMIN_MUTED, fontSize: 9, fontWeight: "800" },
  forecastTrack: { width: "100%", height: 130, backgroundColor: ADMIN_BG, justifyContent: "flex-end" },
  forecastFill: { width: "100%" },
  forecastLbl: { color: ADMIN_MUTED, fontSize: 10, fontWeight: "800" },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 16, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 16 },
  legendText: { color: ADMIN_MUTED, fontSize: 12, fontWeight: "800" },
  demoTag: { color: ADMIN_ORANGE, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  segBar: { flexDirection: "row", height: 22, width: "100%", borderWidth: 1, borderColor: ADMIN_BORDER, overflow: "hidden" },
  segRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  segDot: { width: 16, height: 16, borderRadius: 16 },
  segName: { color: ADMIN_TEXT, fontWeight: "900", fontSize: 13 },
  segMeta: { color: ADMIN_MUTED, fontWeight: "700", fontSize: 11 },
  segPct: { color: ADMIN_TEXT, fontWeight: "900", fontSize: 15 },
  bannedWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bannedChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: ADMIN_BORDER, backgroundColor: ADMIN_BG, borderRadius: 16 },
  bannedChipText: { color: ADMIN_TEXT, fontWeight: "800", fontSize: 13 },
  statMiniRow: { flexDirection: "row", gap: 10 },
  statMini: { flex: 1, backgroundColor: ADMIN_BG, borderWidth: 1, borderColor: ADMIN_BORDER, padding: 10, gap: 2 },
  statMiniNum: { color: ADMIN_TEXT, fontWeight: "900", fontSize: 15 },
  statMiniCap: { color: ADMIN_MUTED, fontWeight: "700", fontSize: 11 },
  orderDetailCard: { borderWidth: 1, borderColor: ADMIN_BORDER, backgroundColor: ADMIN_BG, padding: 12, gap: 7 },
  statusChip: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 16 },
  statusChipText: { color: "#fff", fontWeight: "900", fontSize: 10, textTransform: "uppercase" },
  statusOk: { backgroundColor: "#2E7D32" },
  statusBad: { backgroundColor: ADMIN_RED },
  statusPend: { backgroundColor: ADMIN_ORANGE },
  orderItemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: ADMIN_BORDER },
  orderItemImg: { width: 38, height: 38, backgroundColor: ADMIN_CARD, borderWidth: 1, borderColor: ADMIN_BORDER, alignItems: "center", justifyContent: "center" },
  orderItemName: { color: ADMIN_TEXT, fontWeight: "800", fontSize: 13 },
  orderItemPrice: { color: ADMIN_GREEN, fontWeight: "900", fontSize: 13 },
  accThumb: { width: 48, height: 48, backgroundColor: ADMIN_BG, borderWidth: 1, borderColor: ADMIN_BORDER, alignItems: "center", justifyContent: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: ADMIN_BORDER },
  statusDot: { width: 12, height: 12, borderRadius: 16 },
  statusName: { flex: 1, color: ADMIN_TEXT, fontWeight: "800", fontSize: 14 },
  statusVal: { fontWeight: "900", fontSize: 13 },
  errRow: { flexDirection: "row", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: ADMIN_BORDER },
  errScope: { color: ADMIN_TEXT, fontWeight: "900", fontSize: 12 },
  errMsg: { color: ADMIN_MUTED, fontSize: 12, lineHeight: 17 },
  swatch: { width: 34, height: 34, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  hexInput: { flex: 1, height: 44, borderWidth: 1, borderColor: ADMIN_BORDER, backgroundColor: ADMIN_BG, paddingHorizontal: 12, color: ADMIN_TEXT, fontWeight: "700" },
});
