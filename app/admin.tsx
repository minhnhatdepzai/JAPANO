
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
  createdAt?: string | null;
  isProtectedAdmin?: boolean;
  address?: string;
  banned?: boolean;
  notes?: string;
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
  stock?: number;
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
};

type TabKey =
  | "overview" | "analytics" | "products" | "promotions" | "users"
  | "transactions" | "orders" | "games" | "accessories" | "moderation"
  | "tryon2d" | "model3d" | "botchat" | "system" | "reviews" | "inventory"
  | "settings" | "reports" | "staff" | "newsletter" | "auditlog" | "refunds";

type NavItem = { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap; group: string; badge?: string };

const ADMIN_GREEN = "#A33A2F";
const ADMIN_DARK = "#1C140F";
const ADMIN_MUTED_DARK = "#84918B";
const ADMIN_BG = "#F5F7FA";
const ADMIN_CARD = "#FFFFFF";
const ADMIN_BORDER = "#E7ECF0";
const ADMIN_TEXT = "#1D252C";
const ADMIN_MUTED = "#75808A";
const ADMIN_BLUE = "#1E88E5";
const ADMIN_ORANGE = "#F59E0B";
const ADMIN_RED = "#EF4444";
const ADMIN_PURPLE = "#8B5CF6";
const ADMIN_CARD_SHADOW = Platform.OS === "web"
  ? ({ boxShadow: "0 10px 22px rgba(94,107,120,0.08)" } as any)
  : { shadowColor: "#5E6B78", shadowOpacity: 0.08, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 3 };

const LOW_STOCK_THRESHOLD_DEFAULT = 50;

const ADMIN_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1516257984-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80",
];

const navItems: NavItem[] = [
  { key: "overview", label: "Tổng quan", icon: "grid", group: "TỔNG QUAN" },
  { key: "analytics", label: "Báo cáo & Phân tích", icon: "bar-chart-2", group: "TỔNG QUAN" },
  { key: "orders", label: "Đơn hàng", icon: "shopping-bag", group: "BÁN HÀNG" },
  { key: "transactions", label: "Thanh toán", icon: "credit-card", group: "BÁN HÀNG" },
  { key: "refunds", label: "Hoàn tiền / Trả hàng", icon: "corner-up-left", group: "BÁN HÀNG" },
  { key: "products", label: "Sản phẩm", icon: "package", group: "BÁN HÀNG" },
  { key: "inventory", label: "Kho hàng", icon: "box", group: "BÁN HÀNG" },
  { key: "accessories", label: "Danh mục & Phụ kiện", icon: "watch", group: "BÁN HÀNG" },
  { key: "users", label: "Khách hàng", icon: "users", group: "BÁN HÀNG" },
  { key: "reviews", label: "Đánh giá & Bình luận", icon: "star", group: "BÁN HÀNG" },
  { key: "promotions", label: "Khuyến mãi", icon: "percent", group: "BÁN HÀNG" },
  { key: "newsletter", label: "Email Marketing", icon: "mail", group: "MARKETING" },
  { key: "tryon2d", label: "Thử đồ AI 2D", icon: "camera", group: "AI & 3D" },
  { key: "model3d", label: "Tạo mẫu 3D", icon: "box", group: "AI & 3D" },
  { key: "botchat", label: "Bot chat & Gợi ý", icon: "message-circle", group: "AI & 3D" },
  { key: "moderation", label: "Từ cấm", icon: "shield", group: "NỘI DUNG" },
  { key: "games", label: "Trò chơi", icon: "zap", group: "NỘI DUNG" },
  { key: "staff", label: "Nhân viên & Quyền", icon: "user-check", group: "HỆ THỐNG" },
  { key: "system", label: "Trạng thái & Nhật ký", icon: "activity", group: "HỆ THỐNG" },
  { key: "auditlog", label: "Nhật ký hoạt động", icon: "file-text", group: "HỆ THỐNG" },
  { key: "settings", label: "Cài đặt cửa hàng", icon: "settings", group: "HỆ THỐNG" },
  { key: "reports", label: "Báo cáo tài chính", icon: "bar-chart", group: "HỆ THỐNG" },
];

const emptyProductForm = {
  id: "", name: "", price: "", originalPrice: "", discountPercent: "",
  discountLabel: "", badge: "", image: "", image2: "", image3: "", image4: "",
  description: "", category: "", subcategory: "", stockQuantity: "999", sku: "",
  visualTags: "", styleUseCase: "", sizes: "S, M, L, XL", dimensions: "",
  colors: "Đen, Trắng, Kem", fit: "Regular fit",
};

const emptyVoucherForm = {
  code: "", title: "", discountType: "percent", discountValue: "",
  minOrderValue: "", expiryDate: "", description: "",
};

const emptyPromotionForm = {
  code: "", title: "", discountType: "percent", discountValue: "",
  minOrderValue: "", startsAt: "", expiryDate: "", scope: "all",
  bannerImage: "", description: "",
};

const emptyNotificationForm = { title: "", content: "" };
const emptyGameForm = { slug: "", name: "", description: "", rewardCoins: "" };
const emptyStaffForm = { email: "", name: "", role: "staff", permissions: [] as string[] };
const emptySettingsForm = {
  taxRate: "10", shippingBase: "30000", storeName: "JAPANO SHOP",
  storeEmail: "shop@japano.com", storePhone: "0123456789",
  lowStockThreshold: String(LOW_STOCK_THRESHOLD_DEFAULT),
  currency: "VND", freeShippingThreshold: "500000",
};
const emptyNewsletterForm = { subject: "", content: "", recipient: "all", testEmail: "" };
const emptyTrackingForm = { trackingNumber: "", carrier: "", note: "" };

function formatMoney(value: any) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}
function formatCompactMoney(value: any) {
  const n = Number(value || 0);
  if (n >= 1_000_000_000) return `${Math.round(n / 100_000_000) / 10}Bđ`;
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}Mđ`;
  if (n >= 1000) return `${Math.round(n / 1000)}Kđ`;
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
    if (!seen.has(fallback)) { gallery.push(fallback); seen.add(fallback); }
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
    colors: Array.isArray(product.colors) ? product.colors.join(", ") : "Đen, Trắng, Kem",
    fit: product.fit || "Regular fit",
  };
}
function miniTrendData(input: any[]) {
  if (Array.isArray(input) && input.length) return input;
  return [
    { label: "T2", value: 18 }, { label: "T3", value: 24 }, { label: "T4", value: 21 },
    { label: "T5", value: 32 }, { label: "T6", value: 39 }, { label: "T7", value: 34 },
    { label: "CN", value: 46 },
  ];
}
function fmtVnd(n: any) {
  const v = Number(n || 0);
  if (v >= 1e9) return (v / 1e9).toFixed(1) + " tỷ";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + " tr";
  if (v >= 1e3) return Math.round(v / 1e3) + "k";
  return String(Math.round(v));
}

// [NEW] CSV export helper — works on web & mobile
function exportCsv(filename: string, rows: any[][]) {
  try {
    const csv = rows.map((r) => r.map((v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\n");
    if (Platform.OS === "web") {
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } else {
      Alert.alert("Export CSV", `Đã sinh dữ liệu CSV (${rows.length - 1} dòng). Trên mobile hãy dùng chia sẻ để lưu file.\n\nPreview:\n${csv.slice(0, 400)}...`);
    }
  } catch (e: any) {
    Alert.alert("Lỗi export", e?.message || "Không xuất được file.");
  }
}

// [NEW] Date range helpers
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function inRange(dateStr: any, from: Date | null, to: Date | null) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return true;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

// ── Small reusable UI components ────────────────────────────────────────────

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

function ForecastChart({ forecast }: any) {
  if (!forecast) return <Text style={styles.emptyText}>Chưa có dữ liệu để báo cáo.</Text>;
  const hist = forecast.history || [];
  const fc = forecast.forecast || [];
  const all = [...hist.map((h: any) => ({ ...h, kind: "hist" })), ...fc.map((f: any) => ({ ...f, kind: "fc" }))];
  const max = Math.max(1, ...all.map((a: any) => Number(a.value || 0)));
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.forecastMetrics}>
        <View style={styles.metricPill}><Text style={styles.metricNum}>{fmtVnd(forecast.nextMonth)}đ</Text><Text style={styles.metricCap}>Dự báo tháng tới</Text></View>
        <View style={styles.metricPill}><Text style={styles.metricNum}>R² {forecast.r2}</Text><Text style={styles.metricCap}>Độ khớp mô hình</Text></View>
        <View style={styles.metricPill}><Text style={styles.metricNum}>{forecast.trend === "tang" ? "↑" : "↓"} {fmtVnd(Math.abs(forecast.slope))}đ</Text><Text style={styles.metricCap}>Xu hướng/tháng</Text></View>
      </View>
      <View style={styles.forecastChart}>
        {all.map((a: any, i: number) => {
          const h = `${Math.max(6, Math.round((Number(a.value || 0) / max) * 100))}%` as any;
          const isFc = a.kind === "fc";
          return (
            <View key={i} style={styles.forecastCol}>
              <Text style={styles.forecastVal}>{fmtVnd(a.value)}</Text>
              <View style={styles.forecastTrack}>
                <View style={[styles.forecastFill, { height: h, backgroundColor: isFc ? "transparent" : ADMIN_GREEN, borderWidth: isFc ? 2 : 0, borderColor: ADMIN_GREEN, borderStyle: isFc ? "dashed" : "solid" }]} />
              </View>
              <Text style={styles.forecastLbl}>{String(a.label).slice(5)}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: ADMIN_GREEN }]} /><Text style={styles.legendText}>Thực tế</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { borderWidth: 2, borderColor: ADMIN_GREEN, backgroundColor: "transparent" }]} /><Text style={styles.legendText}>Dự báo (OLS)</Text></View>
        {forecast.demo ? <Text style={styles.demoTag}>dữ liệu minh hoạ</Text> : null}
      </View>
    </View>
  );
}

function SegmentsView({ segments }: any) {
  if (!segments || !segments.clusters?.length) return <Text style={styles.emptyText}>Chưa đủ khách hàng để phân cụm.</Text>;
  const total = Math.max(1, segments.clusters.reduce((s: number, c: any) => s + c.size, 0));
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.segBar}>
        {segments.clusters.map((c: any, i: number) => (
          <View key={i} style={{ width: `${(c.size / total) * 100}%` as any, backgroundColor: c.color, height: "100%" }} />
        ))}
      </View>
      {segments.clusters.map((c: any, i: number) => (
        <View key={i} style={styles.segRow}>
          <View style={[styles.segDot, { backgroundColor: c.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.segName}>{c.name}</Text>
            <Text style={styles.segMeta}>{c.size} KH • chi TB {fmtVnd(c.avgSpend)}đ • {c.avgOrders} đơn • mua cách {c.avgRecency} ngày</Text>
          </View>
          <Text style={styles.segPct}>{Math.round((c.size / total) * 100)}%</Text>
        </View>
      ))}
      {segments.demo ? <Text style={styles.demoTag}>dữ liệu minh hoạ</Text> : null}
    </View>
  );
}

function HorizontalBars({ data, accent = ADMIN_GREEN, money = false }: any) {
  const rows = Array.isArray(data) ? data : [];
  const max = Math.max(1, ...rows.map((x: any) => Number(x.value || 0)));
  if (!rows.length) return <Text style={styles.emptyText}>Chưa có dữ liệu để vẽ biểu đồ.</Text>;
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
        <Text numberOfLines={2} style={styles.previewTitle}>{name || "Tên sản phẩm"}</Text>
        <View style={styles.previewPriceLine}>
          <Text style={styles.previewSalePrice}>{formatMoney(price)}</Text>
          {Number(originalPrice || 0) > Number(price || 0) ? <Text style={styles.previewOldPrice}>{formatMoney(originalPrice)}</Text> : null}
        </View>
        <Text style={styles.previewMeta}>Size: {splitAdminList(sizes).join(" • ") || "S • M • L • XL"}</Text>
        <Text style={styles.previewMeta}>Màu: {splitAdminList(colors).join(" • ") || "Đen • Trắng • Kem"}</Text>
        {!!dimensions ? <Text style={styles.previewMeta}>Kích thước: {dimensions}</Text> : null}
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

// ── Main screen ─────────────────────────────────────────────────────────────

export default function AdminScreen() {
  const { width } = useWindowDimensions();
  const desktop = width >= 920;
  const { user, isLoggedIn } = useApp();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // System status
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Data
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [bannedWords, setBannedWords] = useState<any[]>([]);
  const [bannedInput, setBannedInput] = useState("");
  const [reviews, setReviews] = useState<any[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<any[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [newsletters, setNewsletters] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // UI state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [uploadingMediaField, setUploadingMediaField] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  // Forms
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [voucherForm, setVoucherForm] = useState(emptyVoucherForm);
  const [promotionForm, setPromotionForm] = useState(emptyPromotionForm);
  const [notificationForm, setNotificationForm] = useState(emptyNotificationForm);
  const [gameForm, setGameForm] = useState(emptyGameForm);
  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [settingsForm, setSettingsForm] = useState(emptySettingsForm);
  const [newsletterForm, setNewsletterForm] = useState(emptyNewsletterForm);
  const [trackingForm, setTrackingForm] = useState(emptyTrackingForm);

  // Filters
  const [search, setSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "ytd" | "all">("30d");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const isAdmin = user?.role === "admin" || (user as any)?.isAdmin;
  const openAdminLogin = () => router.replace({ pathname: "/login", params: { redirectTo: "/admin" } } as any);
  const dashboard = overview?.dashboard || {};
  const kpis = dashboard?.kpis || {};

  // [FIX] Actual implementation of refreshStatus
  const refreshStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      setStatusLoading(true);
      const data = await api.getSystemStatus?.(user.id).catch(() => null);
      if (data) setSystemStatus(data);
      else {
        // fallback demo status if API not available
        setSystemStatus({
          services: [
            { key: "backend", label: "Backend API", online: true, url: "http://localhost:4000" },
            { key: "mongo", label: "MongoDB", online: true, url: "mongodb://localhost:27017" },
            { key: "catvton", label: "CatVTON (Thử đồ 2D)", online: false, url: "http://localhost:7861" },
            { key: "gateway", label: "AI Gateway", online: false, url: "http://localhost:8001" },
            { key: "ollama", label: "Ollama (Bot chat)", online: false, url: "http://localhost:11434" },
          ],
          gpu: "NVIDIA RTX 5060 Ti", cuda: "Available", stripe: false,
          errors: [], metrics: kpis,
        });
      }
    } catch (e: any) {
      Alert.alert("Không lấy được trạng thái", e?.message || "Kiểm tra kết nối.");
    } finally {
      setStatusLoading(false);
    }
  }, [user?.id, kpis]);

  const load = useCallback(async () => {
    if (!user?.id || !isAdmin) return;
    const [nextOverview, nextUsers, nextProducts, nextOrders, nextPayments, nextVouchers, nextGames, nextBanned, nextReviews, nextInventory, nextStaff, nextNewsletters, nextRefunds, nextAudit, nextSettings] = await Promise.all([
      api.getAdminOverview(user.id),
      api.getAdminUsers(user.id),
      api.getAdminProducts(user.id),
      api.getAdminOrders(user.id),
      api.getAdminPayments(user.id),
      api.getAdminVouchers(user.id),
      api.getAdminGames(user.id),
      api.getBannedWords(user.id).catch(() => ({ words: [] })),
      api.getAdminReviews(user.id).catch(() => ({ reviews: [] })),
      api.getInventoryLogs(user.id).catch(() => ({ logs: [] })),
      api.getStaffMembers(user.id).catch(() => ({ staff: [] })),
      api.getNewsletters(user.id).catch(() => ({ newsletters: [] })),
      (api as any).getRefunds?.(user.id).catch(() => ({ refunds: [] })) ?? Promise.resolve({ refunds: [] }),
      (api as any).getAuditLogs?.(user.id).catch(() => ({ logs: [] })) ?? Promise.resolve({ logs: [] }),
      (api as any).getStoreSettings?.(user.id).catch(() => null) ?? Promise.resolve(null),
    ]);
    setOverview(nextOverview);
    setUsers(Array.isArray(nextUsers?.users) ? nextUsers.users : []);
    setProducts(Array.isArray(nextProducts?.products) ? nextProducts.products : []);
    setOrders(Array.isArray(nextOrders?.orders) ? nextOrders.orders : []);
    setPayments(Array.isArray(nextPayments?.payments) ? nextPayments.payments : []);
    setVouchers(Array.isArray(nextVouchers?.vouchers) ? nextVouchers.vouchers : []);
    setGames(Array.isArray(nextGames?.games) ? nextGames.games : []);
    setBannedWords(Array.isArray(nextBanned?.words) ? nextBanned.words : []);
    setReviews(Array.isArray(nextReviews?.reviews) ? nextReviews.reviews : []);
    setInventoryLogs(Array.isArray(nextInventory?.logs) ? nextInventory.logs : []);
    setStaffMembers(Array.isArray(nextStaff?.staff) ? nextStaff.staff : []);
    setNewsletters(Array.isArray(nextNewsletters?.newsletters) ? nextNewsletters.newsletters : []);
    setRefunds(Array.isArray(nextRefunds?.refunds) ? nextRefunds.refunds : []);
    setAuditLogs(Array.isArray(nextAudit?.logs) ? nextAudit.logs : []);
    // [FIX] Load settings on mount
    if (nextSettings?.settings) {
      setSettingsForm({ ...emptySettingsForm, ...nextSettings.settings });
    }
  }, [user?.id, isAdmin]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e: any) => Alert.alert("Không mở được admin", e?.message || "Kiểm tra backend/MongoDB."))
      .finally(() => setLoading(false));
  }, [load]);

  // Auto refresh status when opening system tab
  useEffect(() => {
    if (activeTab === "system" || activeTab === "overview") {
      refreshStatus().catch(() => null);
    }
  }, [activeTab, refreshStatus]);

  const refresh = async () => {
    setRefreshing(true);
    await load().catch((e: any) => Alert.alert("Không tải lại được", e?.message || "Có lỗi xảy ra."));
    setRefreshing(false);
  };

  // [NEW] Date range as Date objects
  const rangeStart = useMemo(() => {
    if (dateRange === "all") return null;
    if (dateRange === "ytd") return new Date(new Date().getFullYear(), 0, 1);
    if (dateRange === "7d") return daysAgo(7);
    if (dateRange === "30d") return daysAgo(30);
    if (dateRange === "90d") return daysAgo(90);
    return null;
  }, [dateRange]);

  const quickUpdateOrder = async (order: any, nextStatus: string) => {
    if (!user?.id) return;
    const orderId = String(order.id || order._id || "");
    if (!orderId) return Alert.alert("Thiếu mã đơn", "Không tìm thấy ID đơn hàng.");
    const labelMap: any = { paid: "Đã thanh toán", shipping: "Đang giao", delivered: "Đã nhận", completed: "Hoàn tất", cancelled: "Đã hủy", processing: "Chờ xử lý" };
    try {
      setActionId(`order-${nextStatus}-${orderId}`);
      const res = await api.updateAdminOrderStatus(user.id, orderId, nextStatus);
      Alert.alert(labelMap[nextStatus] || "Đã cập nhật", res?.message || "Đã cập nhật đơn hàng.");
      await load();
    } catch (e: any) {
      Alert.alert("Không cập nhật được đơn", e?.message || "Kiểm tra backend.");
    } finally {
      setActionId(null);
    }
  };

  // [NEW] Update tracking info
  const updateTracking = async (orderId: string) => {
    if (!user?.id) return;
    if (!trackingForm.trackingNumber.trim()) return Alert.alert("Thiếu mã", "Nhập mã vận đơn.");
    try {
      setActionId(`tracking-${orderId}`);
      await (api as any).updateOrderTracking?.(user.id, orderId, trackingForm);
      setTrackingForm(emptyTrackingForm);
      await load();
      Alert.alert("Đã cập nhật", "Thông tin vận chuyển đã lưu.");
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "API cập nhật tracking chưa có ở backend.");
    } finally {
      setActionId(null);
    }
  };

  // Filters
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

  const filteredReviews = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = reviews;
    if (reviewFilter !== "all") filtered = filtered.filter((r) => r.status === reviewFilter);
    if (!q) return filtered;
    return filtered.filter((r) => `${r.productName} ${r.userName} ${r.content}`.toLowerCase().includes(q));
  }, [reviews, search, reviewFilter]);

  // [NEW] Order filter with status + search + date
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (orderStatusFilter !== "all" && (o.status || "pending") !== orderStatusFilter) return false;
      if (!inRange(o.createdAt, rangeStart, null)) return false;
      if (!q) return true;
      return `${o.id || ""} ${o.userId || ""} ${o.phoneNumber || ""} ${o.shippingAddress || ""}`.toLowerCase().includes(q);
    });
  }, [orders, orderStatusFilter, search, rangeStart]);

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
  const pendingReviews = reviews.filter((r) => r.status === "pending").length;
  const lowStockCount = products.filter((p) => (p.stockQuantity || 0) < Number(settingsForm.lowStockThreshold || LOW_STOCK_THRESHOLD_DEFAULT)).length;
  const pendingRefunds = refunds.filter((r: any) => r.status === "pending").length;

  const latestActivity = [
    ...orders.slice(0, 4).map((o) => ({ icon: "shopping-bag", title: `Đơn #${String(o.id || "").slice(-8)}`, meta: `${formatMoney(o.total || o.totalAmount)} • ${o.status || "pending"}` })),
    ...payments.slice(0, 3).map((p) => ({ icon: "credit-card", title: `Thanh toán ${formatMoney(p.amount)}`, meta: `${p.status || "pending"} • ${compactDate(p.createdAt)}` })),
  ].slice(0, 6);

  // ── Actions ──

  const saveProduct = async () => {
    if (!user?.id) return;
    if (!productForm.name.trim()) return Alert.alert("Thiếu tên", "Nhập tên sản phẩm trước khi lưu.");
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
    setActiveTab("products");
  };

  // [NEW] Duplicate product
  const duplicateProduct = (product: AdminProduct) => {
    const form = toProductForm(product);
    setProductForm({ ...form, id: "", name: `${form.name} (Copy)`, sku: form.sku ? `${form.sku}-COPY` : "" });
    setEditingProductId(null);
    setActiveTab("products");
    Alert.alert("Đã sao chép", "Form đã điền thông tin sản phẩm mới. Đổi tên/mã rồi bấm Thêm.");
  };

  // [NEW] Delete product
  const deleteProduct = async (product: AdminProduct) => {
    if (!user?.id) return;
    try {
      setActionId(`delete-${product.id}`);
      await (api as any).deleteAdminProduct?.(user.id, product.id);
      await load();
      Alert.alert("Đã xóa", "Sản phẩm đã bị xóa.");
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không xóa được. Cần API deleteAdminProduct ở backend.");
    } finally {
      setActionId(null);
    }
  };

  // [NEW] Bulk actions
  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  };
  const bulkHideProducts = async () => {
    if (!user?.id || !selectedProductIds.length) return;
    try {
      setActionId("bulk-hide");
      for (const id of selectedProductIds) {
        const p = products.find((x) => x.id === id);
        if (p) await api.setAdminProductHidden(user.id, id, (p.status || "active") === "active");
      }
      setSelectedProductIds([]);
      await load();
      Alert.alert("Đã cập nhật", `${selectedProductIds.length} sản phẩm đã đổi trạng thái.`);
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Có lỗi xảy ra.");
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
        price: nextPrice, originalPrice: base, discountPercent: percent,
        discountLabel: `Giảm ${percent}%`, badge: `GIẢM ${percent}%`,
      });
      await load();
    } catch (e: any) {
      Alert.alert("Không tạo giảm giá", e?.message || "Có lỗi xảy ra.");
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
      Alert.alert("Không chỉnh được giá", e?.message || "Có lỗi xảy ra.");
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
      Alert.alert("Không ẩn/hiện được", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  const adjustInventory = async (productId: string, quantity: number, type: "import" | "export" | "adjust") => {
    if (!user?.id) return;
    try {
      setActionId(`inventory-${productId}`);
      await api.adjustInventory(user.id, productId, quantity, type);
      await load();
      Alert.alert("Đã cập nhật kho", "Số lượng hàng đã được điều chỉnh.");
    } catch (e: any) {
      Alert.alert("Lỗi kho hàng", e?.message || "Không thể cập nhật.");
    } finally {
      setActionId(null);
    }
  };

  const approveReview = async (reviewId: string, approved: boolean) => {
    if (!user?.id) return;
    try {
      setActionId(`review-${reviewId}`);
      await api.updateReviewStatus(user.id, reviewId, approved ? "approved" : "rejected");
      await load();
      Alert.alert("Đã cập nhật", approved ? "Đánh giá đã được duyệt." : "Đánh giá đã bị từ chối.");
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể cập nhật.");
    } finally {
      setActionId(null);
    }
  };

  const deleteReview = async (reviewId: string) => {
    if (!user?.id) return;
    try {
      setActionId(`delete-review-${reviewId}`);
      await api.deleteReview(user.id, reviewId);
      await load();
      Alert.alert("Đã xóa", "Đánh giá đã bị xóa.");
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể xóa.");
    } finally {
      setActionId(null);
    }
  };

  // [NEW] Bulk approve pending reviews
  const bulkApproveReviews = async () => {
    if (!user?.id) return;
    const pending = reviews.filter((r) => r.status === "pending");
    if (!pending.length) return Alert.alert("Không có đánh giá chờ", "Tất cả đánh giá đã được xử lý.");
    try {
      setActionId("bulk-approve");
      for (const r of pending) {
        await api.updateReviewStatus(user.id, r.id, "approved");
      }
      await load();
      Alert.alert("Xong", `Đã duyệt ${pending.length} đánh giá.`);
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  const pickAndUploadAdminImage = async (target: "image" | "image2" | "image3" | "image4" | "bannerImage") => {
    if (!user?.id) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Cần quyền ảnh", "Cho phép truy cập thư viện để upload ảnh lên Cloudinary.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.86, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const uploadKey = `upload-${target}`;
    try {
      setUploadingMediaField(uploadKey);
      const data = await uploadMediaFile(
        { uri: asset.uri, name: asset.fileName || `${target}-${Date.now()}.jpg`, type: asset.mimeType || "image/jpeg" },
        user.id,
        target === "bannerImage" ? "admin/banners" : "admin/products",
        target === "bannerImage" ? "admin-banner-image" : "admin-product-image",
        user.id,
      );
      const url = data.secureUrl || data.url;
      if (!url) throw new Error("Cloudinary không trả về URL ảnh.");
      if (target === "bannerImage") setPromotionForm((p) => ({ ...p, bannerImage: url }));
      else setProductForm((p) => ({ ...p, [target]: url }));
      Alert.alert("Đã upload", "Ảnh đã lưu trên Cloudinary và URL đã được điền vào form.");
    } catch (e: any) {
      Alert.alert("Upload Cloudinary lỗi", e?.message || "Không upload được ảnh.");
    } finally {
      setUploadingMediaField(null);
    }
  };

  const saveVoucher = async () => {
    if (!user?.id) return;
    if (!voucherForm.code.trim()) return Alert.alert("Thiếu mã", "Nhập mã voucher trước.");
    try {
      setActionId("voucher-save");
      await api.saveAdminVoucher(user.id, {
        ...voucherForm, kind: "voucher",
        discountValue: Number(voucherForm.discountValue || 0),
        minOrderValue: Number(voucherForm.minOrderValue || 0),
        active: true,
      });
      setVoucherForm(emptyVoucherForm);
      await load();
      Alert.alert("Đã tạo voucher", "Voucher đã sẵn sàng cho người dùng.");
    } catch (e: any) {
      Alert.alert("Không lưu voucher", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  const savePromotion = async () => {
    if (!user?.id) return;
    if (!promotionForm.code.trim()) return Alert.alert("Thiếu mã", "Nhập mã khuyến mãi trước.");
    try {
      setActionId("promotion-save");
      await api.saveAdminVoucher(user.id, {
        ...promotionForm, kind: "promotion",
        discountValue: Number(promotionForm.discountValue || 0),
        minOrderValue: Number(promotionForm.minOrderValue || 0),
        active: true,
      });
      setPromotionForm(emptyPromotionForm);
      await load();
      Alert.alert("Đã tạo khuyến mãi", "Chiến dịch đã được lưu.");
    } catch (e: any) {
      Alert.alert("Không lưu khuyến mãi", e?.message || "Có lỗi xảy ra.");
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
      Alert.alert("Không đổi trạng thái", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  const sendNotification = async () => {
    if (!user?.id) return;
    if (!notificationForm.title.trim()) return Alert.alert("Thiếu tiêu đề", "Nhập tiêu đề thông báo.");
    try {
      setActionId("notification-send");
      const data = await api.sendAdminNotification(user.id, notificationForm);
      setNotificationForm(emptyNotificationForm);
      await load();
      Alert.alert("Đã gửi", data?.message || "Thông báo đã được gửi.");
    } catch (e: any) {
      Alert.alert("Không gửi được", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  const sendNewsletter = async (testOnly = false) => {
    if (!user?.id) return;
    if (!newsletterForm.subject.trim()) return Alert.alert("Thiếu tiêu đề", "Nhập tiêu đề email.");
    if (testOnly && !newsletterForm.testEmail.trim()) return Alert.alert("Thiếu email test", "Nhập email để gửi thử.");
    try {
      setActionId(testOnly ? "newsletter-test" : "newsletter-send");
      const payload = testOnly
        ? { ...newsletterForm, recipient: "test", testEmail: newsletterForm.testEmail }
        : newsletterForm;
      const data = await api.sendNewsletter(user.id, payload);
      if (!testOnly) setNewsletterForm(emptyNewsletterForm);
      await load();
      Alert.alert(testOnly ? "Đã gửi test" : "Đã gửi newsletter", data?.message || `Email đã được gửi ${testOnly ? `tới ${newsletterForm.testEmail}` : `cho ${newsletterForm.recipient === "all" ? "tất cả" : "nhóm"} khách hàng`}.`);
    } catch (e: any) {
      Alert.alert("Lỗi gửi newsletter", e?.message || "Có lỗi xảy ra.");
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
      setUsers((current) => current.map((item) => (item.id === target.id ? { ...item, ...data.user } : item)));
    } catch (e: any) {
      Alert.alert("Không chỉnh được xu", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  // [NEW] Ban/unban user
  const toggleBanUser = async (target: AdminUser) => {
    if (!user?.id) return;
    if (target.id === user.id) return Alert.alert("Không thể", "Không thể tự khóa tài khoản của mình.");
    if (target.isProtectedAdmin) return Alert.alert("Không thể", "Tài khoản admin gốc không thể bị khóa.");
    try {
      setActionId(`ban-${target.id}`);
      await (api as any).setUserBanned?.(user.id, target.id, !target.banned);
      await load();
      Alert.alert("Đã cập nhật", target.banned ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản.");
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "API setUserBanned chưa có ở backend.");
    } finally {
      setActionId(null);
    }
  };

  const saveStaff = async () => {
    if (!user?.id) return;
    if (!staffForm.email.trim()) return Alert.alert("Thiếu email", "Nhập email nhân viên.");
    try {
      setActionId("staff-save");
      if (editingStaffId) await api.updateStaffMember(user.id, editingStaffId, staffForm);
      else await api.createStaffMember(user.id, staffForm);
      setStaffForm(emptyStaffForm);
      setEditingStaffId(null);
      await load();
      Alert.alert("Đã lưu", "Nhân viên đã được cập nhật.");
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể lưu.");
    } finally {
      setActionId(null);
    }
  };

  const deleteStaff = async (staffId: string) => {
    if (!user?.id) return;
    try {
      setActionId(`delete-staff-${staffId}`);
      await api.deleteStaffMember(user.id, staffId);
      await load();
      Alert.alert("Đã xóa", "Nhân viên đã bị xóa.");
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể xóa.");
    } finally {
      setActionId(null);
    }
  };

  const saveSettings = async () => {
    if (!user?.id) return;
    try {
      setActionId("settings-save");
      await api.saveStoreSettings(user.id, settingsForm);
      await load();
      Alert.alert("Đã lưu", "Cài đặt cửa hàng đã được cập nhật.");
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể lưu.");
    } finally {
      setActionId(null);
    }
  };

  const saveGame = async () => {
    if (!user?.id) return;
    if (!gameForm.name.trim()) return Alert.alert("Thiếu tên", "Nhập tên game trước.");
    try {
      setActionId("game-save");
      const body = { ...gameForm, rewardCoins: Number(gameForm.rewardCoins || 0), active: true };
      if (editingGameId) await api.updateAdminGame(user.id, editingGameId, body);
      else await api.saveAdminGame(user.id, body);
      setGameForm(emptyGameForm);
      setEditingGameId(null);
      await load();
    } catch (e: any) {
      Alert.alert("Không lưu game", e?.message || "Có lỗi xảy ra.");
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
      Alert.alert("Không xóa game", e?.message || "Có lỗi xảy ra.");
    } finally {
      setActionId(null);
    }
  };

  const addBanned = async () => {
    const w = bannedInput.trim();
    if (!w) return;
    if (!user?.id) return Alert.alert("Lỗi", "Bạn cần đăng nhập.");
    try {
      await api.addBannedWord(user.id, w);
      setBannedInput("");
      await load();
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thêm được từ cấm.");
    }
  };
  const removeBanned = async (id: string) => {
    if (!user?.id) return Alert.alert("Lỗi", "Bạn cần đăng nhập.");
    try {
      await api.deleteBannedWord(user.id, id);
      await load();
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không xóa được.");
    }
  };

  // [NEW] Handle refund
  const handleRefund = async (refundId: string, action: "approve" | "reject") => {
    if (!user?.id) return;
    try {
      setActionId(`refund-${refundId}`);
      await (api as any).handleRefund?.(user.id, refundId, action);
      await load();
      Alert.alert("Đã cập nhật", action === "approve" ? "Đã duyệt hoàn tiền." : "Đã từ chối yêu cầu.");
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "API handleRefund chưa có ở backend.");
    } finally {
      setActionId(null);
    }
  };

  // [NEW] Export functions
  const exportOrdersCsv = () => {
    const header = ["ID", "User ID", "Total", "Status", "Payment", "Method", "Phone", "Address", "Created"];
    const rows = filteredOrders.map((o) => [
      o.id, o.userId, o.total || o.totalAmount || 0, o.status || "pending",
      o.paymentStatus || "pending", o.paymentMethod || "COD",
      o.phoneNumber || "", o.shippingAddress || "", o.createdAt || "",
    ]);
    exportCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  };

  const exportProductsCsv = () => {
    const header = ["ID", "Name", "SKU", "Category", "Price", "OriginalPrice", "Stock", "Status"];
    const rows = filteredProducts.map((p) => [
      p.id, p.name, p.sku || "", p.category || "",
      p.price || 0, p.originalPrice || 0, p.stockQuantity || 0, p.status || "active",
    ]);
    exportCsv(`products-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  };

  const exportUsersCsv = () => {
    const header = ["ID", "Email", "Name", "Phone", "Role", "Coins", "VIP", "Banned", "Created"];
    const rows = filteredUsers.map((u) => [
      u.id, u.email, u.name || u.fullName || "", u.phone || "",
      u.role, u.coins || 0, u.vip ? "yes" : "no", u.banned ? "yes" : "no", u.createdAt || "",
    ]);
    exportCsv(`users-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  };

  const exportRevenueCsv = () => {
    const header = ["Month", "Revenue"];
    const rows = revenueByMonth.map((r: any) => [r.label, r.value]);
    exportCsv(`revenue-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  };

  // ── Auth guard ──
  if (!isLoggedIn || !isAdmin) {
    return (
      <View style={styles.authPage}>
        <View style={styles.authCard}>
          <View style={styles.logoBox}><Feather name={isLoggedIn ? "lock" : "shield"} size={26} color="#fff" /></View>
          <Text style={styles.authTitle}>{isLoggedIn ? "Không có quyền admin" : "Đăng nhập admin"}</Text>
          <Text style={styles.authText}>{isLoggedIn ? `Email hiện tại: ${user?.email}. Hãy dùng tài khoản admin.` : "Tài khoản admin mặc định: a@gmail.com / mật khẩu 1."}</Text>
          <Pressable onPress={openAdminLogin} style={styles.authButton}>
            <Text style={styles.authButtonText}>{isLoggedIn ? "Đổi tài khoản" : "Đăng nhập"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Layout parts ──

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
            // dynamic badges
            let badge: string | undefined = item.badge;
            if (item.key === "reviews" && pendingReviews > 0) badge = String(pendingReviews);
            if (item.key === "refunds" && pendingRefunds > 0) badge = String(pendingRefunds);
            if (item.key === "inventory" && lowStockCount > 0) badge = String(lowStockCount);
            return (
              <React.Fragment key={item.key}>
                {showGroup ? <Text style={styles.navGroup}>{item.group}</Text> : null}
                <Pressable onPress={() => setActiveTab(item.key)} style={[styles.navItem, active ? styles.navItemActive : null]}>
                  <Feather name={item.icon} size={17} color={active ? ADMIN_GREEN : ADMIN_MUTED_DARK} />
                  <Text style={[styles.navText, active ? styles.navTextActive : null]}>{item.label}</Text>
                  {badge ? <Text style={styles.navBadge}>{badge}</Text> : null}
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
        <TextInput value={search} onChangeText={setSearch} placeholder="Tìm sản phẩm, khách hàng, đơn hàng..." placeholderTextColor={ADMIN_MUTED} style={styles.searchInput} />
      </View>
      <Pressable onPress={refresh} style={styles.topIconBtn}><Feather name="refresh-cw" size={18} color={ADMIN_TEXT} /></Pressable>
      <Pressable onPress={() => setActiveTab("products")} style={styles.newOrderBtn}><Feather name="plus" size={16} color="#fff" /><Text style={styles.newOrderText}>Thêm sản phẩm</Text></Pressable>
    </View>
  );

  // ── Tab renderers ──

  const renderOverview = () => (
    <View style={styles.pageGap}>
      <View style={styles.heroCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Chào trở lại, {user?.name || "Admin"}</Text>
          <Text style={styles.heroSub}>
            Hôm nay có {formatNumber(orders.length)} đơn, {activeVouchers + activePromotions} chiến dịch,
            {" "}{pendingReviews} đánh giá chờ duyệt, {lowStockCount} SP sắp hết hàng, {pendingRefunds} yêu cầu hoàn tiền.
          </Text>
        </View>
        <Pressable onPress={() => setActiveTab("analytics")} style={styles.heroButton}><Text style={styles.heroButtonText}>Xem phân tích</Text><Feather name="arrow-right" size={16} color="#fff" /></Pressable>
      </View>

      {loading ? <View style={[styles.card, { flexDirection: "row", gap: 10, alignItems: "center" }]}><ActivityIndicator color={ADMIN_GREEN} /><Text style={styles.userMeta}>Đang tải dữ liệu bảng điều khiển...</Text></View> : null}

      <View style={styles.statsGrid}>
        <StatCard label="Doanh thu hôm nay" value={formatCompactMoney(kpis.revenueToday)} change={`${formatNumber(kpis.ordersToday || 0)} đơn hôm nay`} icon="dollar-sign" accent={ADMIN_GREEN} />
        <StatCard label="Đơn hàng" value={formatNumber(kpis.orders || orders.length)} change={`${formatNumber(kpis.ordersToday || 0)} hôm nay`} icon="shopping-bag" accent={ADMIN_BLUE} />
        <StatCard label="Người dùng mới" value={formatNumber(kpis.newUsersToday || 0)} change={`${formatNumber(kpis.users || users.length)} tổng`} icon="user-plus" accent="#A33A2F" />
        <StatCard label="Lượt thử đồ AI" value={formatNumber(kpis.tryon2d || 0)} change={`${formatNumber(kpis.tryon2dFail || 0)} lỗi`} icon="camera" accent={ADMIN_ORANGE} />
        <StatCard label="Lượt tạo 3D" value={formatNumber(kpis.tryon3d || 0)} change={`${formatNumber(kpis.tryon3dFail || 0)} lỗi`} icon="box" accent={ADMIN_BLUE} />
        <StatCard label="SP sắp hết hàng" value={formatNumber(lowStockCount)} change={`ngưỡng ${settingsForm.lowStockThreshold}`} icon="alert-circle" accent={ADMIN_RED} />
      </View>

      <View style={styles.dashboardGrid}>
        <View style={[styles.card, styles.bigChartCard]}>
          <SectionHeader title="Tình trạng server AI" subtitle="Kiểm tra nhanh các dịch vụ" right={<Pressable onPress={refreshStatus} style={styles.smallBtn}>{statusLoading ? <ActivityIndicator size="small" color={ADMIN_TEXT} /> : <Feather name="refresh-cw" size={13} color={ADMIN_TEXT} />}<Text style={styles.smallBtnText}>Kiểm tra lại</Text></Pressable>} />
          {systemStatus?.services ? (
            <View style={{ gap: 8 }}>
              {systemStatus.services.map((s: any) => (
                <View key={s.key} style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: s.online ? "#2E7D32" : ADMIN_RED }]} />
                  <Text style={styles.statusName}>{s.label}</Text>
                  <Text style={[styles.statusVal, { color: s.online ? "#2E7D32" : ADMIN_RED }]}>{s.online ? "Online" : "Offline"}</Text>
                </View>
              ))}
              <Text style={styles.userMeta}>GPU: {systemStatus.gpu} • CUDA: {systemStatus.cuda} • Stripe: {systemStatus.stripe ? "đã cấu hình" : "chưa cấu hình"}</Text>
            </View>
          ) : <Text style={styles.emptyText}>{statusLoading ? "Đang kiểm tra dịch vụ..." : 'Chưa lấy được trạng thái. Bấm "Kiểm tra lại".'}</Text>}
        </View>
        <View style={styles.card}>
          <SectionHeader title="Lỗi mới nhất" subtitle="Nhật ký lỗi AI/hệ thống" />
          {systemStatus?.errors?.length ? systemStatus.errors.slice(0, 6).map((e: any, i: number) => (
            <View key={i} style={styles.errRow}>
              <Feather name="alert-triangle" size={13} color={ADMIN_ORANGE} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errScope}>{e.scope}</Text>
                <Text numberOfLines={2} style={styles.errMsg}>{e.message}</Text>
              </View>
            </View>
          )) : <Text style={styles.emptyText}>Chưa có lỗi nào được ghi nhận. 🎉</Text>}
        </View>
      </View>

      <View style={styles.dashboardGrid}>
        <View style={[styles.card, styles.bigChartCard]}>
          <SectionHeader title="Tăng trưởng doanh thu" subtitle="Xu hướng theo tháng" right={<Pressable onPress={exportRevenueCsv} style={styles.smallBtn}><Feather name="download" size={12} color={ADMIN_TEXT} /><Text style={styles.smallBtnText}>CSV</Text></Pressable>} />
          <MiniBars data={revenueByMonth.length ? revenueByMonth : miniTrendData([])} accent={ADMIN_GREEN} money />
        </View>
        <View style={styles.card}>
          <SectionHeader title="Sản phẩm bán chạy" subtitle="Top theo số lượng bán" />
          {topProducts.length ? <HorizontalBars data={topProducts.map((x: any) => ({ label: x.name, value: x.unitsSold }))} accent={ADMIN_GREEN} /> : <Text style={styles.emptyText}>Chưa có dữ liệu bán hàng.</Text>}
        </View>
      </View>

      <View style={styles.dashboardGrid3}>
        <View style={styles.card}>
          <SectionHeader title="Hoạt động gần đây" subtitle="Đơn hàng và thanh toán" />
          <View style={{ gap: 13 }}>
            {latestActivity.length ? latestActivity.map((item, idx) => (
              <View key={`${item.title}-${idx}`} style={styles.activityRow}>
                <View style={styles.activityIcon}><Feather name={item.icon as any} size={16} color={ADMIN_GREEN} /></View>
                <View style={{ flex: 1 }}><Text style={styles.activityTitle}>{item.title}</Text><Text style={styles.activityMeta}>{item.meta}</Text></View>
              </View>
            )) : <Text style={styles.emptyText}>Chưa có hoạt động gần đây.</Text>}
          </View>
        </View>
      </View>
    </View>
  );

  const renderAnalytics = () => (
    <View style={styles.pageGap}>
      <SectionHeader
        title="Phân tích & Học máy (ML)"
        subtitle="3 mô hình chạy trực tiếp trên dữ liệu đơn hàng / khách hàng / sản phẩm."
        right={
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["7d", "30d", "90d", "ytd", "all"] as const).map((r) => (
              <SelectChip key={r} active={dateRange === r} label={r === "ytd" ? "YTD" : r === "all" ? "Tất cả" : r} onPress={() => setDateRange(r)} />
            ))}
          </View>
        }
      />

      <View style={styles.modelRow}>
        {(mlModels.length ? mlModels : [{ name: "Đang tải mô hình", type: "—", metric: "" }]).map((m: any, i: number) => (
          <View key={i} style={styles.modelCard}>
            <View style={styles.modelTop}><Feather name="cpu" size={16} color={ADMIN_GREEN} /><Text style={styles.modelName}>{m.name}</Text></View>
            <Text style={styles.modelType}>{m.type}</Text>
            <Text style={styles.modelMetric}>{m.metric}{m.demo ? " · minh hoạ" : ""}</Text>
          </View>
        ))}
      </View>

      <View style={styles.analyticsGrid}>
        <View style={[styles.card, styles.bigChartCard]}>
          <SectionHeader title="Dự báo doanh thu • Hồi quy tuyến tính (OLS)" subtitle={mlForecast?.algorithm || "Ước lượng xu hướng và dự báo 3 tháng tới."} />
          <ForecastChart forecast={mlForecast} />
        </View>
        <View style={styles.card}>
          <SectionHeader title="Phân khúc khách hàng • K-Means" subtitle={mlSegments?.algorithm || "Gom khách hàng theo hành vi mua."} />
          <SegmentsView segments={mlSegments} />
        </View>
      </View>

      <View style={styles.analyticsGrid}>
        <View style={[styles.card, styles.bigChartCard]}>
          <SectionHeader title="Sản phẩm nổi bật • Gợi ý (CF + Matrix Factorization)" subtitle={mlRecommender?.algorithm || "Lọc cộng tác item-based + phân rã ma trận."} />
          <HorizontalBars data={(mlRecommender?.featured || []).map((x: any) => ({ label: x.name, value: x.score }))} accent="#2F4A73" />
          {mlRecommender?.demo ? <Text style={styles.demoTag}>dữ liệu minh hoạ</Text> : null}
        </View>
        <View style={styles.card}>
          <SectionHeader title="Điểm nhu cầu sản phẩm (DemandScore)" subtitle="Bán ra, wishlist, giỏ, đánh giá, độ mới, nhắc trong AI chat." />
          <View style={styles.featureWrap}>{(dashboard?.ml?.features || ["unitsSold", "wishlist", "cart", "rating", "recency", "chatMention"]).map((f: string) => <Text key={f} style={styles.featureChip}>{f}</Text>)}</View>
          <HorizontalBars data={predictions.map((x: any) => ({ label: x.name, value: x.score }))} accent={ADMIN_GREEN} />
        </View>
      </View>

      <View style={styles.analyticsGrid}>
        <View style={[styles.card, styles.bigChartCard]}>
          <SectionHeader title="Xu hướng theo danh mục" subtitle="Tổng hợp bán ra + wishlist + giỏ" />
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
              <Text style={styles.predictionSuggestion}>{item.predictedDemand} • {item.suggestion}</Text>
              <Text style={styles.predictionSmall}>Bán {item.features?.sold || 0} • Thích {item.features?.wishlist || 0} • Giỏ {item.features?.cart || 0} • ⭐ {item.features?.avgRating ?? "-"}</Text>
            </View>
            <View style={styles.scoreBox}><Text style={styles.scoreText}>{item.score}</Text><Text style={styles.scoreLabel}>điểm</Text></View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderProducts = () => (
    <View style={styles.pageGap}>
      <SectionHeader
        title="Quản lý sản phẩm"
        subtitle="Thêm, ẩn, sửa 4 ảnh sản phẩm, size, kích thước, màu sắc, mô tả, giá và sale."
        right={
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Text style={styles.counterPill}>{activeProducts} đang bán / {hiddenProducts} đang ẩn</Text>
            <Pressable onPress={exportProductsCsv} style={styles.smallBtn}><Feather name="download" size={12} color={ADMIN_TEXT} /><Text style={styles.smallBtnText}>Xuất CSV</Text></Pressable>
          </View>
        }
      />

      {/* [NEW] Bulk action bar */}
      {selectedProductIds.length > 0 ? (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkText}>Đã chọn {selectedProductIds.length} sản phẩm</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={bulkHideProducts} style={styles.smallBtn}><Text style={styles.smallBtnText}>Ẩn/Hiện đã chọn</Text></Pressable>
            <Pressable onPress={() => setSelectedProductIds([])} style={styles.smallBtn}><Text style={styles.smallBtnText}>Bỏ chọn</Text></Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.productManagerGrid}>
        <View style={[styles.card, styles.formCard]}>
          <Text style={styles.formTitle}>{editingProductId ? `Đang sửa: ${editingProductId}` : "Thêm sản phẩm mới"}</Text>
          <View style={styles.formGrid2}>
            <Input label="Mã sản phẩm" value={productForm.id} onChangeText={(id: string) => setProductForm((p) => ({ ...p, id }))} placeholder="jp-kimono-001" />
            <Input label="SKU" value={productForm.sku} onChangeText={(sku: string) => setProductForm((p) => ({ ...p, sku }))} placeholder="JP-001" />
          </View>
          <Input label="Tên sản phẩm" value={productForm.name} onChangeText={(name: string) => setProductForm((p) => ({ ...p, name }))} placeholder="Áo kimono nam" />
          <View style={styles.formGrid3}>
            <Input label="Giá đang bán" value={productForm.price} keyboardType="numeric" onChangeText={(price: string) => setProductForm((p) => ({ ...p, price }))} placeholder="250000" />
            <Input label="Giá gốc / gạch" value={productForm.originalPrice} keyboardType="numeric" onChangeText={(originalPrice: string) => setProductForm((p) => ({ ...p, originalPrice }))} placeholder="300000" />
            <Input label="% giảm" value={productForm.discountPercent} keyboardType="numeric" onChangeText={(discountPercent: string) => setProductForm((p) => ({ ...p, discountPercent }))} placeholder="17" />
          </View>
          <View style={styles.formGrid2}>
            <Input label="Nhãn giảm giá" value={productForm.discountLabel} onChangeText={(discountLabel: string) => setProductForm((p) => ({ ...p, discountLabel }))} placeholder="Flash Sale" />
            <Input label="Nhãn" value={productForm.badge} onChangeText={(badge: string) => setProductForm((p) => ({ ...p, badge }))} placeholder="GIẢM 17%" />
          </View>
          <View style={styles.formGrid2}>
            <Input label="Ảnh 1 URL" value={productForm.image} onChangeText={(image: string) => setProductForm((p) => ({ ...p, image }))} placeholder="https://..." />
            <Input label="Ảnh 2 URL" value={productForm.image2} onChangeText={(image2: string) => setProductForm((p) => ({ ...p, image2 }))} placeholder="https://..." />
          </View>
          <View style={styles.formGrid2}>
            <Input label="Ảnh 3 URL" value={productForm.image3} onChangeText={(image3: string) => setProductForm((p) => ({ ...p, image3 }))} placeholder="https://..." />
            <Input label="Ảnh 4 URL" value={productForm.image4} onChangeText={(image4: string) => setProductForm((p) => ({ ...p, image4 }))} placeholder="https://..." />
          </View>
          <View style={styles.mediaUploadBox}>
            <Text style={styles.mediaUploadTitle}>Upload ảnh lên Cloudinary</Text>
            <View style={styles.actionRow}>
              {(["image", "image2", "image3", "image4"] as const).map((field, index) => {
                const key = `upload-${field}`;
                return (
                  <Pressable key={field} disabled={uploadingMediaField === key} onPress={() => pickAndUploadAdminImage(field)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>{uploadingMediaField === key ? "Đang upload..." : `Upload ảnh ${index + 1}`}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Input label="Mô tả sản phẩm" value={productForm.description} onChangeText={(description: string) => setProductForm((p) => ({ ...p, description }))} placeholder="Mô tả ngắn..." multiline />
          <View style={styles.formGrid3}>
            <Input label="Danh mục" value={productForm.category} onChangeText={(category: string) => setProductForm((p) => ({ ...p, category }))} placeholder="fashion" />
            <Input label="Danh mục con" value={productForm.subcategory} onChangeText={(subcategory: string) => setProductForm((p) => ({ ...p, subcategory }))} placeholder="streetwear" />
            <Input label="Tồn kho" value={productForm.stockQuantity} keyboardType="numeric" onChangeText={(stockQuantity: string) => setProductForm((p) => ({ ...p, stockQuantity }))} placeholder="999" />
          </View>
          <View style={styles.formGrid2}>
            <Input label="Size / kích cỡ" value={productForm.sizes} onChangeText={(sizes: string) => setProductForm((p) => ({ ...p, sizes }))} placeholder="S, M, L, XL" />
            <Input label="Màu sắc" value={productForm.colors} onChangeText={(colors: string) => setProductForm((p) => ({ ...p, colors }))} placeholder="Đen, trắng, kem" />
          </View>
          <View style={styles.formGrid2}>
            <Input label="Kích thước" value={productForm.dimensions} onChangeText={(dimensions: string) => setProductForm((p) => ({ ...p, dimensions }))} placeholder="Dài 68cm, ngang vai 46cm..." />
            <Input label="Form / kiểu vừa" value={productForm.fit} onChangeText={(fit: string) => setProductForm((p) => ({ ...p, fit }))} placeholder="Regular fit" />
          </View>
          <Input label="Thẻ hình ảnh" value={productForm.visualTags} onChangeText={(visualTags: string) => setProductForm((p) => ({ ...p, visualTags }))} placeholder="japanese, black, minimal" />
          <Input label="Kiểu sử dụng" value={productForm.styleUseCase} onChangeText={(styleUseCase: string) => setProductForm((p) => ({ ...p, styleUseCase }))} placeholder="Đi chơi, chụp ảnh..." />
          <View style={styles.actionRow}>
            <Pressable disabled={actionId === "product-save"} onPress={saveProduct} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>{actionId === "product-save" ? "Đang lưu..." : editingProductId ? "Cập nhật" : "Thêm sản phẩm"}</Text></Pressable>
            <Pressable onPress={() => { setProductForm(emptyProductForm); setEditingProductId(null); }} style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Xóa form</Text></Pressable>
          </View>
        </View>
        <ProductDiscountPreview
          name={productForm.name}
          price={Number(productForm.price || 0)}
          originalPrice={Number(productForm.originalPrice || 0)}
          discountPercent={Number(productForm.discountPercent || 0)}
          image={productForm.image}
          images={[productForm.image, productForm.image2, productForm.image3, productForm.image4]}
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
          const selected = selectedProductIds.includes(product.id);
          return (
            <View key={product.id} style={[styles.productCard, selected && { borderColor: ADMIN_GREEN, borderWidth: 2 }]}>
              <View style={styles.productTop}>
                <Pressable onPress={() => toggleSelectProduct(product.id)} style={styles.checkBox}>
                  <Feather name={selected ? "check-square" : "square"} size={18} color={selected ? ADMIN_GREEN : ADMIN_MUTED} />
                </Pressable>
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
              <Text numberOfLines={2} style={styles.productDesc}>{product.description || "Chưa có mô tả."}</Text>
              <View style={styles.adminThumbRow}>
                {gallery.map((url, index) => <Image key={`${product.id}-thumb-${index}`} source={{ uri: url }} style={styles.adminThumb} />)}
              </View>
              <Text style={styles.productMeta}>Size: {sizes.join(" / ") || "S / M / L / XL"} • Màu: {colors.join(" / ") || "Đen / Trắng / Kem"}</Text>
              <View style={styles.actionRow}>
                <Pressable onPress={() => editProduct(product)} style={styles.smallBtn}><Feather name="edit-2" size={11} color={ADMIN_TEXT} /><Text style={styles.smallBtnText}>Sửa</Text></Pressable>
                <Pressable onPress={() => duplicateProduct(product)} style={styles.smallBtn}><Feather name="copy" size={11} color={ADMIN_TEXT} /><Text style={styles.smallBtnText}>Sao chép</Text></Pressable>
                <Pressable onPress={() => toggleProduct(product)} style={styles.smallBtn}><Text style={styles.smallBtnText}>{hidden ? "Hiện" : "Ẩn"}</Text></Pressable>
                <Pressable onPress={() => changeProductPrice(product, 10)} style={styles.smallBtn}><Text style={styles.smallBtnText}>+10%</Text></Pressable>
                <Pressable onPress={() => changeProductPrice(product, -10)} style={styles.smallBtn}><Text style={styles.smallBtnText}>-10%</Text></Pressable>
                <Pressable onPress={() => quickDiscount(product, 15)} style={styles.saleBtn}><Text style={styles.saleBtnText}>Sale -15%</Text></Pressable>
                <Pressable
                  onPress={() => {
                    if (Platform.OS === "web") {
                      // eslint-disable-next-line no-alert
                      if (typeof window !== "undefined" && window.confirm(`Xóa "${product.name}"?`)) deleteProduct(product);
                    } else {
                      Alert.alert("Xác nhận xóa", `Xóa "${product.name}"?`, [
                        { text: "Hủy" }, { text: "Xóa", style: "destructive", onPress: () => deleteProduct(product) },
                      ]);
                    }
                  }}
                  style={styles.dangerBtn}
                >
                  <Feather name="trash-2" size={11} color={ADMIN_RED} />
                  <Text style={styles.dangerBtnText}>Xóa</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderInventory = () => (
    <View style={styles.pageGap}>
      <SectionHeader
        title="Quản lý kho hàng"
        subtitle={`Ngưỡng cảnh báo: ${settingsForm.lowStockThreshold} cái. Chỉnh trong Cài đặt cửa hàng.`}
        right={<Text style={styles.counterPill}>{products.length} sản phẩm • {lowStockCount} sắp hết</Text>}
      />

      <View style={styles.card}>
        <Text style={styles.formTitle}>Lịch sử nhập/xuất kho gần đây</Text>
        {inventoryLogs.length ? (
          <View style={{ gap: 10 }}>
            {inventoryLogs.slice(0, 20).map((log: any, idx: number) => (
              <View key={idx} style={styles.inventoryLogRow}>
                <View style={[styles.inventoryIcon, { backgroundColor: log.type === "import" ? "#E9F8F1" : log.type === "export" ? "#FFF7E6" : "#F2F5F7" }]}>
                  <Feather name={log.type === "import" ? "arrow-down" : log.type === "export" ? "arrow-up" : "edit"} size={14} color={log.type === "import" ? ADMIN_GREEN : log.type === "export" ? ADMIN_ORANGE : ADMIN_MUTED} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{log.productName}</Text>
                  <Text style={styles.userMeta}>{log.type === "import" ? "Nhập" : log.type === "export" ? "Xuất" : "Điều chỉnh"} {log.quantity} • Số dư {log.newQuantity} • {compactDate(log.createdAt)}</Text>
                </View>
                <Text style={styles.inventoryChange}>{log.type === "import" ? "+" : "-"}{log.quantity}</Text>
              </View>
            ))}
          </View>
        ) : <Text style={styles.emptyText}>Chưa có nhật ký kho hàng.</Text>}
      </View>

      <View style={styles.tableCard}>
        <SectionHeader title="Sản phẩm tồn kho thấp" subtitle={`Dưới ${settingsForm.lowStockThreshold} cái - cần nhập thêm`} />
        {products.filter((p) => (p.stockQuantity || 0) < Number(settingsForm.lowStockThreshold || LOW_STOCK_THRESHOLD_DEFAULT)).length ? (
          products.filter((p) => (p.stockQuantity || 0) < Number(settingsForm.lowStockThreshold || LOW_STOCK_THRESHOLD_DEFAULT)).map((product) => (
            <View key={product.id} style={styles.userRow}>
              {product.image ? <Image source={{ uri: product.image }} style={styles.accThumb} /> : <View style={styles.accThumb}><Feather name="box" size={18} color={ADMIN_MUTED} /></View>}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.userName}>{product.name}</Text>
                <Text numberOfLines={1} style={styles.userEmail}>{product.id}</Text>
                <Text style={styles.userMeta}>Tồn kho: {product.stockQuantity || 0} • Giá {formatMoney(product.price)}</Text>
              </View>
              <View style={styles.userActions}>
                <Pressable onPress={() => adjustInventory(product.id, 50, "import")} style={styles.saleBtn}><Feather name="arrow-down" size={13} color="#B45309" /><Text style={styles.saleBtnText}>+50</Text></Pressable>
                <Pressable onPress={() => adjustInventory(product.id, 100, "import")} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>+100</Text></Pressable>
                <Pressable onPress={() => adjustInventory(product.id, 10, "export")} style={styles.smallBtn}><Text style={styles.smallBtnText}>-10</Text></Pressable>
              </View>
            </View>
          ))
        ) : <Text style={styles.emptyText}>Tất cả sản phẩm đều có đủ kho.</Text>}
      </View>
    </View>
  );

  const renderReviews = () => (
    <View style={styles.pageGap}>
      <SectionHeader
        title="Đánh giá & Bình luận"
        subtitle="Duyệt, phê duyệt, từ chối và xóa các đánh giá sản phẩm."
        right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Text style={styles.counterPill}>{pendingReviews} chờ / {reviews.length} tổng</Text>
            {pendingReviews > 0 ? (
              <Pressable onPress={bulkApproveReviews} style={styles.successBtn}>
                <Text style={styles.successBtnText}>Duyệt tất cả</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {(["all", "pending", "approved", "rejected"] as const).map((filter) => (
          <SelectChip
            key={filter}
            active={reviewFilter === filter}
            label={filter === "all" ? "Tất cả" : filter === "pending" ? "Chờ duyệt" : filter === "approved" ? "Đã duyệt" : "Từ chối"}
            onPress={() => setReviewFilter(filter)}
          />
        ))}
      </View>

      {filteredReviews.length ? filteredReviews.map((review: any, idx: number) => (
        <View key={idx} style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <View style={styles.userAvatar}><Feather name="user" size={16} color={ADMIN_GREEN} /></View>
            <View style={{ flex: 1 }}>
              <View style={styles.barLineTop}>
                <View>
                  <Text style={styles.userName}>{review.userName}</Text>
                  <Text style={styles.userEmail}>{review.productName}</Text>
                </View>
                <View style={[styles.statusChip, review.status === "approved" ? styles.statusOk : review.status === "pending" ? styles.statusPend : styles.statusBad]}>
                  <Text style={styles.statusChipText}>{review.status === "approved" ? "Duyệt" : review.status === "pending" ? "Chờ" : "Từ chối"}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 4, marginTop: 4, alignItems: "center" }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Feather key={i} name="star" size={14} color={i <= (review.rating || 0) ? ADMIN_ORANGE : ADMIN_MUTED} style={{ opacity: i <= (review.rating || 0) ? 1 : 0.3 }} />
                ))}
                <Text style={styles.userMeta}> {review.rating}/5 • {compactDate(review.createdAt)}</Text>
              </View>
              <Text style={[styles.productDesc, { marginTop: 8 }]}>{review.content || "Không có nội dung."}</Text>
              {review.images?.length ? (
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                  {review.images.slice(0, 3).map((img: string, i: number) => (
                    <Image key={i} source={{ uri: img }} style={{ width: 50, height: 50, borderRadius: 8 }} />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.actionRow}>
            {review.status !== "approved" && (
              <Pressable onPress={() => approveReview(review.id, true)} style={styles.successBtn}><Text style={styles.successBtnText}>Phê duyệt</Text></Pressable>
            )}
            {review.status !== "rejected" && (
              <Pressable onPress={() => approveReview(review.id, false)} style={styles.dangerBtn}><Text style={styles.dangerBtnText}>Từ chối</Text></Pressable>
            )}
            <Pressable onPress={() => deleteReview(review.id)} style={styles.dangerBtn}><Feather name="trash-2" size={11} color={ADMIN_RED} /><Text style={styles.dangerBtnText}>Xóa</Text></Pressable>
          </View>
        </View>
      )) : <Text style={styles.emptyText}>Không có đánh giá trong danh sách này.</Text>}
    </View>
  );

  const renderStaff = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Quản lý nhân viên & Phân quyền" subtitle="Tạo tài khoản nhân viên với các quyền hạn cụ thể." right={<Text style={styles.counterPill}>{staffMembers.length} nhân viên</Text>} />

      <View style={[styles.card, styles.formCard]}>
        <Text style={styles.formTitle}>{editingStaffId ? "Sửa nhân viên" : "Thêm nhân viên mới"}</Text>
        <Input label="Email" value={staffForm.email} onChangeText={(email: string) => setStaffForm((p) => ({ ...p, email }))} placeholder="staff@japano.com" />
        <Input label="Tên nhân viên" value={staffForm.name} onChangeText={(name: string) => setStaffForm((p) => ({ ...p, name }))} placeholder="Nguyễn Văn A" />
        <View style={{ gap: 8 }}>
          <Text style={styles.inputLabel}>Vai trò</Text>
          <View style={styles.actionRow}>
            <SelectChip active={staffForm.role === "staff"} label="Nhân viên" onPress={() => setStaffForm((p) => ({ ...p, role: "staff" }))} />
            <SelectChip active={staffForm.role === "manager"} label="Quản lý" onPress={() => setStaffForm((p) => ({ ...p, role: "manager" }))} />
            <SelectChip active={staffForm.role === "admin"} label="Admin" onPress={() => setStaffForm((p) => ({ ...p, role: "admin" }))} />
          </View>
        </View>
        <View style={styles.actionRow}>
          <Pressable onPress={saveStaff} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>{editingStaffId ? "Cập nhật" : "Thêm nhân viên"}</Text></Pressable>
          <Pressable onPress={() => { setStaffForm(emptyStaffForm); setEditingStaffId(null); }} style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Hủy</Text></Pressable>
        </View>
      </View>

      <View style={styles.tableCard}>
        {staffMembers.length ? staffMembers.map((staff: any) => (
          <View key={staff.id} style={styles.userRow}>
            <View style={styles.userAvatar}><Feather name="user-check" size={16} color={ADMIN_GREEN} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.userName}>{staff.name}</Text>
              <Text numberOfLines={1} style={styles.userEmail}>{staff.email}</Text>
              <Text style={styles.userMeta}>Vai trò: {staff.role} • Tham gia {compactDate(staff.createdAt)}</Text>
            </View>
            <View style={styles.userActions}>
              <Pressable onPress={() => { setEditingStaffId(staff.id); setStaffForm({ email: staff.email, name: staff.name, role: staff.role, permissions: staff.permissions || [] }); }} style={styles.smallBtn}><Text style={styles.smallBtnText}>Sửa</Text></Pressable>
              <Pressable onPress={() => deleteStaff(staff.id)} style={styles.dangerBtn}><Text style={styles.dangerBtnText}>Xóa</Text></Pressable>
            </View>
          </View>
        )) : <Text style={styles.emptyText}>Chưa có nhân viên nào.</Text>}
      </View>
    </View>
  );

  const renderSettings = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Cài đặt cửa hàng" subtitle="Thông tin cửa hàng, thuế, phí vận chuyển và các tùy chọn khác." />

      <View style={[styles.card, styles.formCard]}>
        <Text style={styles.formTitle}>Thông tin cửa hàng</Text>
        <Input label="Tên cửa hàng" value={settingsForm.storeName} onChangeText={(storeName: string) => setSettingsForm((p) => ({ ...p, storeName }))} placeholder="JAPANO SHOP" />
        <Input label="Email cửa hàng" value={settingsForm.storeEmail} onChangeText={(storeEmail: string) => setSettingsForm((p) => ({ ...p, storeEmail }))} placeholder="shop@japano.com" />
        <Input label="Số điện thoại" value={settingsForm.storePhone} onChangeText={(storePhone: string) => setSettingsForm((p) => ({ ...p, storePhone }))} placeholder="0123456789" />

        <Text style={[styles.inputLabel, { marginTop: 14 }]}>Cài đặt tài chính & vận chuyển</Text>
        <View style={styles.formGrid2}>
          <Input label="Thuế suất (%)" value={settingsForm.taxRate} keyboardType="numeric" onChangeText={(taxRate: string) => setSettingsForm((p) => ({ ...p, taxRate }))} placeholder="10" />
          <Input label="Phí ship cơ bản" value={settingsForm.shippingBase} keyboardType="numeric" onChangeText={(shippingBase: string) => setSettingsForm((p) => ({ ...p, shippingBase }))} placeholder="30000" />
        </View>
        <View style={styles.formGrid2}>
          <Input label="Free ship từ" value={settingsForm.freeShippingThreshold} keyboardType="numeric" onChangeText={(freeShippingThreshold: string) => setSettingsForm((p) => ({ ...p, freeShippingThreshold }))} placeholder="500000" />
          <Input label="Đơn vị tiền" value={settingsForm.currency} onChangeText={(currency: string) => setSettingsForm((p) => ({ ...p, currency }))} placeholder="VND" />
        </View>

        <Text style={[styles.inputLabel, { marginTop: 14 }]}>Cảnh báo kho hàng</Text>
        <Input label="Ngưỡng cảnh báo (cái)" value={settingsForm.lowStockThreshold} keyboardType="numeric" onChangeText={(lowStockThreshold: string) => setSettingsForm((p) => ({ ...p, lowStockThreshold }))} placeholder="50" />

        <Pressable onPress={saveSettings} disabled={actionId === "settings-save"} style={[styles.primaryBtn, { marginTop: 14 }]}>
          <Text style={styles.primaryBtnText}>{actionId === "settings-save" ? "Đang lưu..." : "Lưu cài đặt"}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderNewsLetter = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Email Marketing & Newsletter" subtitle="Gửi email thông báo và bản tin tới khách hàng." right={<Text style={styles.counterPill}>{newsletters.length} email đã gửi</Text>} />

      <View style={[styles.card, styles.formCard]}>
        <Text style={styles.formTitle}>Gửi Newsletter</Text>
        <Input label="Tiêu đề email" value={newsletterForm.subject} onChangeText={(subject: string) => setNewsletterForm((p) => ({ ...p, subject }))} placeholder="Khuyến mãi mới từ JAPANO" />
        <Input label="Nội dung" value={newsletterForm.content} onChangeText={(content: string) => setNewsletterForm((p) => ({ ...p, content }))} placeholder="Viết nội dung email..." multiline />
        <View style={{ gap: 8, marginTop: 12 }}>
          <Text style={styles.inputLabel}>Gửi tới</Text>
          <View style={styles.actionRow}>
            <SelectChip active={newsletterForm.recipient === "all"} label="Tất cả" onPress={() => setNewsletterForm((p) => ({ ...p, recipient: "all" }))} />
            <SelectChip active={newsletterForm.recipient === "vip"} label="VIP" onPress={() => setNewsletterForm((p) => ({ ...p, recipient: "vip" }))} />
            <SelectChip active={newsletterForm.recipient === "active"} label="Hoạt động" onPress={() => setNewsletterForm((p) => ({ ...p, recipient: "active" }))} />
          </View>
        </View>

        {/* [NEW] Test email */}
        <View style={{ marginTop: 12 }}>
          <Input label="Email test (gửi thử trước khi gửi hàng loạt)" value={newsletterForm.testEmail} onChangeText={(testEmail: string) => setNewsletterForm((p) => ({ ...p, testEmail }))} placeholder="test@example.com" />
        </View>

        <View style={styles.actionRow}>
          <Pressable onPress={() => sendNewsletter(true)} disabled={actionId === "newsletter-test"} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>{actionId === "newsletter-test" ? "Đang gửi..." : "Gửi test"}</Text>
          </Pressable>
          <Pressable onPress={() => sendNewsletter(false)} disabled={actionId === "newsletter-send"} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{actionId === "newsletter-send" ? "Đang gửi..." : "Gửi Newsletter"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tableCard}>
        <SectionHeader title="Lịch sử gửi" subtitle="Newsletter đã gửi" />
        {newsletters.length ? newsletters.slice(0, 10).map((news: any, idx: number) => (
          <View key={idx} style={styles.userRow}>
            <View style={styles.paymentIcon}><Feather name="mail" size={16} color={ADMIN_BLUE} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{news.subject}</Text>
              <Text style={styles.userMeta}>Gửi tới {news.recipientCount || 0} người • {compactDate(news.createdAt)}</Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: "#E9F8F1" }]}><Text style={[styles.statusChipText, { color: ADMIN_GREEN }]}>Đã gửi</Text></View>
          </View>
        )) : <Text style={styles.emptyText}>Chưa gửi newsletter nào.</Text>}
      </View>
    </View>
  );

  const renderPromotions = () => {
    const voucherRows = vouchers.filter((v) => (v.kind || "voucher") === "voucher");
    const promotionRows = vouchers.filter((v) => v.kind === "promotion");
    return (
      <View style={styles.pageGap}>
        <SectionHeader
          title="Voucher & Khuyến mãi"
          subtitle="Tạo voucher, khuyến mãi và gửi thông báo chung cho người dùng."
          right={<Text style={styles.counterPill}>{activeVouchers} voucher • {activePromotions} chiến dịch</Text>}
        />
        <View style={styles.promoGrid}>
          <View style={styles.card}>
            <Text style={styles.formTitle}>Thêm voucher</Text>
            <View style={styles.formGrid2}>
              <Input label="Mã voucher" value={voucherForm.code} onChangeText={(code: string) => setVoucherForm((p) => ({ ...p, code }))} placeholder="JAPANO50" />
              <Input label="Tên voucher" value={voucherForm.title} onChangeText={(title: string) => setVoucherForm((p) => ({ ...p, title }))} placeholder="Giảm cho khách mới" />
            </View>
            <View style={styles.actionRow}>
              <SelectChip active={voucherForm.discountType === "percent"} label="Theo %" onPress={() => setVoucherForm((p) => ({ ...p, discountType: "percent" }))} />
              <SelectChip active={voucherForm.discountType === "fixed"} label="Theo tiền" onPress={() => setVoucherForm((p) => ({ ...p, discountType: "fixed" }))} />
            </View>
            <View style={styles.formGrid3}>
              <Input label="Giá trị" value={voucherForm.discountValue} keyboardType="numeric" onChangeText={(discountValue: string) => setVoucherForm((p) => ({ ...p, discountValue }))} placeholder="20 hoặc 50000" />
              <Input label="Đơn tối thiểu" value={voucherForm.minOrderValue} keyboardType="numeric" onChangeText={(minOrderValue: string) => setVoucherForm((p) => ({ ...p, minOrderValue }))} placeholder="300000" />
              <Input label="Hết hạn" value={voucherForm.expiryDate} onChangeText={(expiryDate: string) => setVoucherForm((p) => ({ ...p, expiryDate }))} placeholder="2026-12-31" />
            </View>
            <Input label="Mô tả" value={voucherForm.description} onChangeText={(description: string) => setVoucherForm((p) => ({ ...p, description }))} placeholder="Áp dụng toàn shop..." multiline />
            <Pressable disabled={actionId === "voucher-save"} onPress={saveVoucher} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>{actionId === "voucher-save" ? "Đang tạo..." : "Tạo voucher"}</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.formTitle}>Thêm khuyến mãi / chiến dịch</Text>
            <View style={styles.formGrid2}>
              <Input label="Mã chiến dịch" value={promotionForm.code} onChangeText={(code: string) => setPromotionForm((p) => ({ ...p, code }))} placeholder="FLASHSALE15" />
              <Input label="Tên khuyến mãi" value={promotionForm.title} onChangeText={(title: string) => setPromotionForm((p) => ({ ...p, title }))} placeholder="Flash Sale cuối tuần" />
            </View>
            <View style={styles.actionRow}>
              <SelectChip active={promotionForm.discountType === "percent"} label="Giảm %" onPress={() => setPromotionForm((p) => ({ ...p, discountType: "percent" }))} />
              <SelectChip active={promotionForm.discountType === "fixed"} label="Giảm tiền" onPress={() => setPromotionForm((p) => ({ ...p, discountType: "fixed" }))} />
            </View>
            <View style={styles.formGrid3}>
              <Input label="Giá trị" value={promotionForm.discountValue} keyboardType="numeric" onChangeText={(discountValue: string) => setPromotionForm((p) => ({ ...p, discountValue }))} placeholder="15" />
              <Input label="Đơn tối thiểu" value={promotionForm.minOrderValue} keyboardType="numeric" onChangeText={(minOrderValue: string) => setPromotionForm((p) => ({ ...p, minOrderValue }))} placeholder="0" />
              <Input label="Phạm vi" value={promotionForm.scope} onChangeText={(scope: string) => setPromotionForm((p) => ({ ...p, scope }))} placeholder="all / category:áo" />
            </View>
            <View style={styles.formGrid2}>
              <Input label="Bắt đầu" value={promotionForm.startsAt} onChangeText={(startsAt: string) => setPromotionForm((p) => ({ ...p, startsAt }))} placeholder="2026-06-10" />
              <Input label="Kết thúc" value={promotionForm.expiryDate} onChangeText={(expiryDate: string) => setPromotionForm((p) => ({ ...p, expiryDate }))} placeholder="2026-06-30" />
            </View>
            <View style={styles.inputWrap}>
              <Input label="Ảnh banner (URL)" value={promotionForm.bannerImage} onChangeText={(bannerImage: string) => setPromotionForm((p) => ({ ...p, bannerImage }))} placeholder="https://..." />
              <Pressable disabled={uploadingMediaField === "upload-bannerImage"} onPress={() => pickAndUploadAdminImage("bannerImage")} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>{uploadingMediaField === "upload-bannerImage" ? "Đang upload..." : "Upload banner Cloudinary"}</Text>
              </Pressable>
            </View>
            <Input label="Mô tả chiến dịch" value={promotionForm.description} onChangeText={(description: string) => setPromotionForm((p) => ({ ...p, description }))} placeholder="Giảm giá cuối tuần..." multiline />
            <Pressable disabled={actionId === "promotion-save"} onPress={savePromotion} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>{actionId === "promotion-save" ? "Đang tạo..." : "Tạo khuyến mãi"}</Text></Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.formTitle}>Thông báo chung</Text>
          <View style={styles.formGrid2}>
            <Input label="Tiêu đề" value={notificationForm.title} onChangeText={(title: string) => setNotificationForm((p) => ({ ...p, title }))} placeholder="Flash Sale 50%" />
            <Input label="Nội dung" value={notificationForm.content} onChangeText={(content: string) => setNotificationForm((p) => ({ ...p, content }))} placeholder="Mở app nhận voucher..." />
          </View>
          <Pressable disabled={actionId === "notification-send"} onPress={sendNotification} style={styles.secondaryBtnWide}><Text style={styles.secondaryBtnText}>{actionId === "notification-send" ? "Đang gửi..." : "Gửi thông báo cho tất cả user"}</Text></Pressable>
        </View>

        <View style={styles.listGrid2}>
          <View style={styles.card}>
            <SectionHeader title="Danh sách voucher" subtitle={`Đã dùng: ${vouchers.reduce((s: number, v: any) => s + (v.usedCount || 0), 0)} lượt`} />
            {voucherRows.length ? voucherRows.map((voucher) => (
              <View key={voucher.id} style={styles.voucherRow}>
                <View style={styles.voucherIcon}><Feather name="tag" size={17} color={ADMIN_GREEN} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.voucherCode}>{voucher.code}</Text>
                  <Text style={styles.voucherMeta}>
                    {voucher.title || "Voucher"} • {voucher.discountType === "fixed" ? formatMoney(voucher.discountValue) : `${voucher.discountValue}%`}
                    {" "}• HSD {compactDate(voucher.expiryDate)} • Đã dùng {voucher.usedCount || 0} lần
                  </Text>
                </View>
                <Pressable onPress={() => toggleVoucher(voucher)} style={[styles.statusPill, voucher.active ? styles.statusOn : styles.statusOff]}><Text style={styles.statusText}>{voucher.active ? "ON" : "OFF"}</Text></Pressable>
              </View>
            )) : <Text style={styles.emptyText}>Chưa có voucher.</Text>}
          </View>

          <View style={styles.card}>
            <SectionHeader title="Danh sách khuyến mãi" subtitle="Chiến dịch đang chạy" />
            {promotionRows.length ? promotionRows.map((promo) => (
              <View key={promo.id} style={styles.promoRow}>
                {promo.bannerImage ? <Image source={{ uri: promo.bannerImage }} style={styles.promoThumb} /> : <View style={styles.promoThumb}><Feather name="image" size={18} color={ADMIN_MUTED} /></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.voucherCode}>{promo.title || promo.code}</Text>
                  <Text style={styles.voucherMeta}>{promo.code} • {promo.discountType === "fixed" ? formatMoney(promo.discountValue) : `${promo.discountValue}%`} • {compactDate(promo.startsAt)} → {compactDate(promo.expiryDate)}</Text>
                  <Text numberOfLines={1} style={styles.voucherMeta}>{promo.description || "Chiến dịch khuyến mãi"}</Text>
                </View>
                <Pressable onPress={() => toggleVoucher(promo)} style={[styles.statusPill, promo.active ? styles.statusOn : styles.statusOff]}><Text style={styles.statusText}>{promo.active ? "ON" : "OFF"}</Text></Pressable>
              </View>
            )) : <Text style={styles.emptyText}>Chưa có khuyến mãi.</Text>}
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
            <Text style={styles.sectionTitle}>{u.name || u.fullName || "Khách JAPANO"} {u.banned ? " (Đã khóa)" : ""}</Text>
            <Text style={styles.userEmail}>{u.email} • {u.phone || "chưa có SĐT"}</Text>
            <Text style={styles.userMeta}>Địa chỉ: {u.address || "chưa có"} • Xu {formatNumber(u.coins)} {u.vip ? "• VIP" : ""}</Text>
          </View>
          <Pressable onPress={() => setSelectedUserId(null)} style={styles.smallBtn}><Feather name="x" size={14} color={ADMIN_TEXT} /><Text style={styles.smallBtnText}>Đóng</Text></Pressable>
        </View>

        <View style={styles.statMiniRow}>
          <View style={styles.statMini}><Text style={styles.statMiniNum}>{userOrders.length}</Text><Text style={styles.statMiniCap}>Đơn hàng</Text></View>
          <View style={styles.statMini}><Text style={styles.statMiniNum}>{formatMoney(spend)}</Text><Text style={styles.statMiniCap}>Tổng chi tiêu</Text></View>
          <View style={styles.statMini}><Text style={styles.statMiniNum}>{userPayments.length}</Text><Text style={styles.statMiniCap}>Giao dịch</Text></View>
        </View>

        <Text style={styles.formTitle}>Đơn hàng & sản phẩm đã mua</Text>
        {userOrders.length ? userOrders.map((o) => (
          <View key={o.id} style={styles.orderDetailCard}>
            <View style={styles.barLineTop}>
              <Text style={styles.userName}>#{String(o.id).slice(-8)} • {formatMoney(o.total || o.totalAmount)}</Text>
              <View style={[styles.statusChip, o.status === "completed" ? styles.statusOk : o.status === "cancelled" ? styles.statusBad : styles.statusPend]}>
                <Text style={styles.statusChipText}>{o.status || "pending"}</Text>
              </View>
            </View>
            <Text style={styles.userMeta}>Thanh toán: {o.paymentMethod || "--"} • {o.paymentStatus || "pending"} • {compactDate(o.createdAt)}</Text>
            {o.shippingAddress ? <Text numberOfLines={1} style={styles.userMeta}>Giao tới: {o.shippingAddress} {o.phoneNumber ? `• ${o.phoneNumber}` : ""}</Text> : null}
            {o.trackingNumber ? <Text style={styles.userMeta}>Vận đơn: {o.trackingNumber} ({o.carrier || "--"})</Text> : null}
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
              <Pressable onPress={() => quickUpdateOrder(o, "paid")} style={styles.smallBtn}><Text style={styles.smallBtnText}>Đã thanh toán</Text></Pressable>
              <Pressable onPress={() => quickUpdateOrder(o, "shipping")} style={styles.saleBtn}><Feather name="truck" size={13} color="#B45309" /><Text style={styles.saleBtnText}>Đang giao</Text></Pressable>
              <Pressable onPress={() => quickUpdateOrder(o, "delivered")} style={styles.saleBtn}><Feather name="check" size={13} color="#B45309" /><Text style={styles.saleBtnText}>Đã nhận</Text></Pressable>
              <Pressable onPress={() => quickUpdateOrder(o, "cancelled")} style={styles.dangerBtn}><Feather name="x" size={13} color={ADMIN_RED} /><Text style={styles.dangerBtnText}>Hủy</Text></Pressable>
            </View>
          </View>
        )) : <Text style={styles.emptyText}>Khách này chưa có đơn hàng.</Text>}

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
      <SectionHeader
        title="Khách hàng & Phân quyền"
        subtitle="Bấm một khách để xem đơn đã mua, sản phẩm, thanh toán và đổi trạng thái."
        right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Text style={styles.counterPill}>{filteredUsers.length} khách</Text>
            <Pressable onPress={exportUsersCsv} style={styles.smallBtn}><Feather name="download" size={12} color={ADMIN_TEXT} /><Text style={styles.smallBtnText}>Xuất CSV</Text></Pressable>
          </View>
        }
      />
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
              <View style={[styles.userAvatar, isItemAdmin ? styles.userAvatarAdmin : null, item.banned && { backgroundColor: "#FFF1F2" }]}>
                <Feather name={item.banned ? "slash" : isItemAdmin ? "shield" : "user"} size={18} color={item.banned ? ADMIN_RED : isItemAdmin ? "#fff" : ADMIN_GREEN} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.userName}>{item.name || item.fullName || "JAPANO Member"} {item.banned ? "🚫" : ""}</Text>
                <Text numberOfLines={1} style={styles.userEmail}>{item.email}</Text>
                <Text style={styles.userMeta}>Trạng thái {item.banned ? "Đã khóa" : item.status || "active"} • Xu {formatNumber(item.coins)} • {ordersCount} đơn {item.vip ? "• VIP" : ""}</Text>
              </View>
              <View style={[styles.rolePill, isItemAdmin ? styles.roleAdmin : null]}><Text style={[styles.rolePillText, isItemAdmin ? styles.rolePillTextAdmin : null]}>{isItemAdmin ? "ADMIN" : "KHÁCH"}</Text></View>
              <View style={styles.userActions}>
                <Pressable onPress={() => setSelectedUserId(String(item.id))} style={styles.saleBtn}><Feather name="eye" size={13} color="#B45309" /><Text style={styles.saleBtnText}>Chi tiết</Text></Pressable>
                <Pressable onPress={() => adjustCoins(item, 100)} style={styles.smallBtn}><Text style={styles.smallBtnText}>+100 xu</Text></Pressable>
                <Pressable onPress={() => adjustCoins(item, -100)} style={styles.smallBtn}><Text style={styles.smallBtnText}>-100 xu</Text></Pressable>
                {canGrant ? <Pressable onPress={() => changeRole(item, "admin")} style={styles.saleBtn}><Text style={styles.saleBtnText}>Cấp admin</Text></Pressable> : null}
                {canRevoke ? <Pressable onPress={() => changeRole(item, "customer")} style={styles.dangerBtn}><Text style={styles.dangerBtnText}>Gỡ admin</Text></Pressable> : null}
                {!isSelf && !item.isProtectedAdmin ? (
                  <Pressable onPress={() => toggleBanUser(item)} style={item.banned ? styles.successBtn : styles.dangerBtn}>
                    <Text style={item.banned ? styles.successBtnText : styles.dangerBtnText}>{item.banned ? "Mở khóa" : "Khóa"}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  // [NEW] Dedicated Orders tab with filters
  const renderOrders = () => {
    const statusOptions: Array<{ key: string; label: string }> = [
      { key: "all", label: "Tất cả" },
      { key: "pending", label: "Chờ xử lý" },
      { key: "processing", label: "Đang xử lý" },
      { key: "paid", label: "Đã thanh toán" },
      { key: "shipping", label: "Đang giao" },
      { key: "delivered", label: "Đã nhận" },
      { key: "completed", label: "Hoàn tất" },
      { key: "cancelled", label: "Đã hủy" },
    ];

    return (
      <View style={styles.pageGap}>
        <SectionHeader
          title="Quản lý đơn hàng"
          subtitle={`${filteredOrders.length} / ${orders.length} đơn`}
          right={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={exportOrdersCsv} style={styles.smallBtn}><Feather name="download" size={12} color={ADMIN_TEXT} /><Text style={styles.smallBtnText}>Xuất CSV</Text></Pressable>
            </View>
          }
        />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {statusOptions.map((s) => (
            <SelectChip key={s.key} active={orderStatusFilter === s.key} label={s.label} onPress={() => setOrderStatusFilter(s.key)} />
          ))}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Text style={[styles.inputLabel, { alignSelf: "center" }]}>Khoảng thời gian:</Text>
          {(["7d", "30d", "90d", "ytd", "all"] as const).map((r) => (
            <SelectChip key={r} active={dateRange === r} label={r === "ytd" ? "YTD" : r === "all" ? "Tất cả" : r} onPress={() => setDateRange(r)} />
          ))}
        </View>

        <View style={styles.tableCard}>
          {filteredOrders.length ? filteredOrders.map((order) => {
            const isExpanded = selectedOrderId === order.id;
            return (
              <View key={order.id} style={{ borderBottomWidth: 1, borderBottomColor: "#F0F2F4" }}>
                <Pressable onPress={() => setSelectedOrderId(isExpanded ? null : order.id)} style={styles.userRow}>
                  <View style={styles.paymentIcon}><Feather name="shopping-bag" size={16} color={ADMIN_BLUE} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.userName}>#{String(order.id).slice(-8)} • {formatMoney(order.total || order.totalAmount)}</Text>
                    <Text numberOfLines={1} style={styles.userEmail}>{order.userId} • {order.phoneNumber || "--"}</Text>
                    <Text style={styles.userMeta}>{compactDate(order.createdAt)} • {order.paymentMethod || "COD"} • {order.paymentStatus || "pending"}</Text>
                  </View>
                  <View style={[styles.statusChip, order.status === "completed" ? styles.statusOk : order.status === "cancelled" ? styles.statusBad : styles.statusPend]}>
                    <Text style={styles.statusChipText}>{order.status || "pending"}</Text>
                  </View>
                  <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={ADMIN_MUTED} />
                </Pressable>
                {isExpanded ? (
                  <View style={{ padding: 14, backgroundColor: ADMIN_BG, gap: 10 }}>
                    <Text numberOfLines={2} style={styles.userMeta}>Giao tới: {order.shippingAddress || "--"}</Text>
                    {(order.items || []).map((it: any, idx: number) => (
                      <View key={idx} style={styles.orderItemRow}>
                        {it.image ? <Image source={{ uri: it.image }} style={styles.orderItemImg} /> : <View style={styles.orderItemImg}><Feather name="image" size={14} color={ADMIN_MUTED} /></View>}
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={styles.orderItemName}>{it.name}</Text>
                          <Text style={styles.userMeta}>SL {it.quantity} {it.size ? `• size ${it.size}` : ""} {it.color ? `• ${it.color}` : ""}</Text>
                        </View>
                        <Text style={styles.orderItemPrice}>{formatMoney(it.unitPrice)}</Text>
                      </View>
                    ))}

                    {/* [NEW] Tracking form */}
                    <View style={{ borderTopWidth: 1, borderTopColor: ADMIN_BORDER, paddingTop: 10, gap: 8 }}>
                      <Text style={styles.formTitle}>Vận chuyển</Text>
                      {order.trackingNumber ? (
                        <Text style={styles.userMeta}>Mã hiện tại: {order.trackingNumber} • {order.carrier || "--"}</Text>
                      ) : null}
                      <View style={styles.formGrid2}>
                        <Input label="Mã vận đơn" value={trackingForm.trackingNumber} onChangeText={(trackingNumber: string) => setTrackingForm((p) => ({ ...p, trackingNumber }))} placeholder="GHN123..." />
                        <Input label="Đơn vị vận chuyển" value={trackingForm.carrier} onChangeText={(carrier: string) => setTrackingForm((p) => ({ ...p, carrier }))} placeholder="GHN / GHTK / VN Post" />
                      </View>
                      <Input label="Ghi chú" value={trackingForm.note} onChangeText={(note: string) => setTrackingForm((p) => ({ ...p, note }))} placeholder="Ghi chú giao hàng..." />
                      <Pressable onPress={() => updateTracking(order.id)} style={styles.primaryBtn}>
                        <Text style={styles.primaryBtnText}>{actionId === `tracking-${order.id}` ? "Đang lưu..." : "Lưu tracking"}</Text>
                      </Pressable>
                    </View>

                    <View style={styles.userActions}>
                      <Pressable onPress={() => quickUpdateOrder(order, "paid")} style={styles.smallBtn}><Text style={styles.smallBtnText}>Đã thanh toán</Text></Pressable>
                      <Pressable onPress={() => quickUpdateOrder(order, "shipping")} style={styles.saleBtn}><Feather name="truck" size={13} color="#B45309" /><Text style={styles.saleBtnText}>Đang giao</Text></Pressable>
                      <Pressable onPress={() => quickUpdateOrder(order, "delivered")} style={styles.saleBtn}><Feather name="check" size={13} color="#B45309" /><Text style={styles.saleBtnText}>Đã nhận</Text></Pressable>
                      <Pressable onPress={() => quickUpdateOrder(order, "completed")} style={styles.successBtn}><Text style={styles.successBtnText}>Hoàn tất</Text></Pressable>
                      <Pressable onPress={() => quickUpdateOrder(order, "cancelled")} style={styles.dangerBtn}><Feather name="x" size={13} color={ADMIN_RED} /><Text style={styles.dangerBtnText}>Hủy</Text></Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          }) : <Text style={styles.emptyText}>Không có đơn nào khớp bộ lọc.</Text>}
        </View>
      </View>
    );
  };

  const renderTransactions = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Thanh toán" subtitle="Theo dõi tất cả giao dịch thanh toán." />
      <View style={styles.tableCard}>
        {payments.length ? payments.map((payment) => (
          <View key={payment.id} style={styles.paymentRow}>
            <View style={styles.paymentIcon}><Feather name="credit-card" size={16} color={ADMIN_GREEN} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentTitle}>{formatMoney(payment.amount)}</Text>
              <Text style={styles.paymentMeta}>{payment.method || payment.paymentMethod || "Thanh toán"} • {payment.status} • {compactDate(payment.createdAt)}</Text>
              <Text numberOfLines={1} style={styles.paymentMeta}>User: {payment.userId || "--"} • Txn: {payment.transactionId || "--"}</Text>
            </View>
          </View>
        )) : <Text style={styles.emptyText}>Chưa có giao dịch.</Text>}
      </View>
    </View>
  );

  // [NEW] Refunds tab
  const renderRefunds = () => (
    <View style={styles.pageGap}>
      <SectionHeader
        title="Yêu cầu hoàn tiền / trả hàng"
        subtitle="Duyệt các yêu cầu hoàn tiền từ khách hàng."
        right={<Text style={styles.counterPill}>{pendingRefunds} chờ xử lý / {refunds.length} tổng</Text>}
      />
      <View style={styles.tableCard}>
        {refunds.length ? refunds.map((r: any) => (
          <View key={r.id} style={styles.userRow}>
            <View style={styles.paymentIcon}><Feather name="corner-up-left" size={16} color={ADMIN_ORANGE} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.userName}>Đơn #{String(r.orderId || "").slice(-8)} • {formatMoney(r.amount)}</Text>
              <Text numberOfLines={1} style={styles.userEmail}>{r.userId}</Text>
              <Text numberOfLines={2} style={styles.userMeta}>Lý do: {r.reason || "--"} • {compactDate(r.createdAt)}</Text>
            </View>
            <View style={[styles.statusChip, r.status === "approved" ? styles.statusOk : r.status === "rejected" ? styles.statusBad : styles.statusPend]}>
              <Text style={styles.statusChipText}>{r.status || "pending"}</Text>
            </View>
            {r.status === "pending" ? (
              <View style={styles.userActions}>
                <Pressable onPress={() => handleRefund(r.id, "approve")} style={styles.successBtn}><Text style={styles.successBtnText}>Duyệt</Text></Pressable>
                <Pressable onPress={() => handleRefund(r.id, "reject")} style={styles.dangerBtn}><Text style={styles.dangerBtnText}>Từ chối</Text></Pressable>
              </View>
            ) : null}
          </View>
        )) : <Text style={styles.emptyText}>Chưa có yêu cầu hoàn tiền nào. (Cần bật API refunds ở backend)</Text>}
      </View>
    </View>
  );

  const renderGames = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Quản lý trò chơi" subtitle="Thêm, sửa, xóa game và cấu hình thưởng xu." />
      <View style={styles.card}>
        <Text style={styles.formTitle}>{editingGameId ? "Sửa game" : "Thêm game"}</Text>
        <View style={styles.formGrid2}>
          <Input label="Slug" value={gameForm.slug} onChangeText={(slug: string) => setGameForm((p) => ({ ...p, slug }))} placeholder="quiz-battle" />
          <Input label="Tên game" value={gameForm.name} onChangeText={(name: string) => setGameForm((p) => ({ ...p, name }))} placeholder="Quiz Battle" />
        </View>
        <Input label="Mô tả" value={gameForm.description} onChangeText={(description: string) => setGameForm((p) => ({ ...p, description }))} placeholder="Trả lời nhanh nhận xu" multiline />
        <Input label="Thưởng xu" value={gameForm.rewardCoins} keyboardType="numeric" onChangeText={(rewardCoins: string) => setGameForm((p) => ({ ...p, rewardCoins }))} placeholder="30" />
        <View style={styles.actionRow}>
          <Pressable onPress={saveGame} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>{editingGameId ? "Cập nhật game" : "Thêm game"}</Text></Pressable>
          <Pressable onPress={() => { setGameForm(emptyGameForm); setEditingGameId(null); }} style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Xóa form</Text></Pressable>
        </View>
      </View>
      <View style={styles.productListGrid}>
        {games.map((game) => (
          <View key={String(game._id || game.id)} style={styles.productCard}>
            <Text style={styles.productTitle}>{game.name}</Text>
            <Text style={styles.productMeta}>{game.slug} • Thưởng {formatNumber(game.rewardCoins)} xu</Text>
            <Text style={styles.productDesc}>{game.description || "Chưa có mô tả."}</Text>
            <View style={styles.actionRow}>
              <Pressable onPress={() => editGame(game)} style={styles.smallBtn}><Text style={styles.smallBtnText}>Sửa</Text></Pressable>
              <Pressable onPress={() => deleteGame(game)} style={styles.dangerBtn}><Text style={styles.dangerBtnText}>Xóa</Text></Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderModeration = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Từ cấm khi bình luận / đánh giá" subtitle="Đánh giá chứa các từ này sẽ bị chặn tự động." right={<Text style={styles.counterPill}>{bannedWords.length} từ</Text>} />
      <View style={[styles.card, styles.formCard]}>
        <Text style={styles.formTitle}>Thêm từ cấm</Text>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}>
            <Input label="Từ / cụm từ cấm" value={bannedInput} onChangeText={setBannedInput} placeholder="ví dụ: lừa đảo" />
          </View>
          <Pressable onPress={addBanned} style={styles.newOrderBtn}><Feather name="plus" size={16} color="#fff" /><Text style={styles.newOrderText}>Thêm</Text></Pressable>
        </View>
      </View>
      <View style={styles.card}>
        <SectionHeader title="Danh sách từ cấm" subtitle="Bấm vào một từ để xóa" />
        <View style={styles.bannedWrap}>
          {bannedWords.length ? bannedWords.map((b: any) => (
            <Pressable key={b.id} onPress={() => removeBanned(b.id)} style={styles.bannedChip}>
              <Text style={styles.bannedChipText}>{b.word}</Text>
              <Feather name="x" size={13} color={ADMIN_RED} />
            </Pressable>
          )) : <Text style={styles.emptyText}>Chưa có từ cấm.</Text>}
        </View>
      </View>
    </View>
  );

  const isAccessoryClient = (p: any) => {
    const hay = `${p?.category || ""} ${p?.subcategory || ""} ${(p?.visualTags || []).join(" ")} ${p?.name || ""}`.toLowerCase();
    return /(phu kien|phụ kiện|accessor|non|nón|mu |mũ|kinh|kính|khan|khăn|tui|túi|vong|vòng|dong ho|đồng hồ|hat|cap|bag|watch|necklace|bracelet|scarf|belt|glasses|earring|bong tai|bông tai|du |dù)/.test(hay);
  };
  const accessoryProducts = useMemo(() => products.filter(isAccessoryClient), [products]);

  const addNewAccessory = () => {
    setProductForm({ ...emptyProductForm, category: "phu-kien", subcategory: "phu-kien" });
    setEditingProductId(null);
    setActiveTab("products");
  };

  const renderAccessories = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Quản lý phụ kiện" subtitle="Nón, mũ, vòng tay, túi, kính, khăn, đồng hồ..." right={<Text style={styles.counterPill}>{accessoryProducts.length} phụ kiện</Text>} />
      <View style={[styles.card, { gap: 10 }]}>
        <Text style={styles.formTitle}>Thêm phụ kiện mới</Text>
        <Pressable onPress={addNewAccessory} style={styles.newOrderBtn}><Feather name="plus" size={16} color="#fff" /><Text style={styles.newOrderText}>Thêm phụ kiện</Text></Pressable>
      </View>
      <View style={styles.tableCard}>
        {accessoryProducts.length ? accessoryProducts.map((item) => (
          <View key={item.id} style={styles.userRow}>
            {item.image ? <Image source={{ uri: item.image }} style={styles.accThumb} /> : <View style={styles.accThumb}><Feather name="watch" size={18} color={ADMIN_MUTED} /></View>}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.userName}>{item.name}</Text>
              <Text numberOfLines={1} style={styles.userEmail}>{item.category || "phu-kien"} • {formatMoney(item.price)}</Text>
              <Text style={styles.userMeta}>Tồn kho {formatNumber(item.stockQuantity || item.stock || 0)} • {(item.status || "active") === "active" ? "Đang bán" : "Đang ẩn"}</Text>
            </View>
            <View style={styles.userActions}>
              <Pressable onPress={() => editProduct(item)} style={styles.saleBtn}><Feather name="edit-2" size={13} color="#B45309" /><Text style={styles.saleBtnText}>Sửa</Text></Pressable>
              <Pressable onPress={() => toggleProduct(item)} style={styles.smallBtn}><Text style={styles.smallBtnText}>{(item.status || "active") === "active" ? "Ẩn" : "Hiện"}</Text></Pressable>
            </View>
          </View>
        )) : <Text style={styles.emptyText}>Chưa có phụ kiện.</Text>}
      </View>
    </View>
  );

  const renderSystemStatus = () => {
    const m = systemStatus?.metrics || kpis;
    return (
      <View style={styles.pageGap}>
        <SectionHeader
          title="Trạng thái hệ thống AI"
          subtitle="Theo dõi CatVTON, 3D Gateway, Ollama, MongoDB, Backend."
          right={
            <Pressable onPress={refreshStatus} style={styles.newOrderBtn}>
              {statusLoading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="refresh-cw" size={14} color="#fff" />}
              <Text style={styles.newOrderText}>Kiểm tra lại</Text>
            </Pressable>
          }
        />
        <View style={styles.tableCard}>
          {systemStatus?.services ? systemStatus.services.map((s: any) => (
            <View key={s.key} style={styles.userRow}>
              <View style={[styles.statusDot, { backgroundColor: s.online ? "#2E7D32" : ADMIN_RED, width: 14, height: 14 }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{s.label}</Text>
                {s.url ? <Text numberOfLines={1} style={styles.userMeta}>{s.url}</Text> : <Text style={styles.userMeta}>Dịch vụ nội bộ</Text>}
              </View>
              <View style={[styles.statusChip, s.online ? styles.statusOk : styles.statusBad]}><Text style={styles.statusChipText}>{s.online ? "Online" : "Offline"}</Text></View>
            </View>
          )) : <Text style={styles.emptyText}>{statusLoading ? "Đang kiểm tra..." : 'Chưa lấy được trạng thái • bấm "Kiểm tra lại".'}</Text>}
          <View style={{ paddingTop: 10 }}>
            <Text style={styles.userMeta}>GPU: {systemStatus?.gpu || "--"} • CUDA: {systemStatus?.cuda || "--"}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Thử đồ 2D" value={formatNumber(m.tryon2d || 0)} change={`${formatNumber(m.tryon2dFail || 0)} lỗi`} icon="camera" accent={ADMIN_GREEN} />
          <StatCard label="Tạo 3D" value={formatNumber(m.tryon3d || 0)} change={`${formatNumber(m.tryon3dFail || 0)} lỗi`} icon="box" accent={ADMIN_BLUE} />
          <StatCard label="Tỷ lệ lỗi 2D" value={`${m.tryon2d ? Math.round((m.tryon2dFail / m.tryon2d) * 100) : 0}%`} change="AI try-on" icon="alert-triangle" accent={ADMIN_ORANGE} />
          <StatCard label="Tỷ lệ lỗi 3D" value={`${m.tryon3d ? Math.round((m.tryon3dFail / m.tryon3d) * 100) : 0}%`} change="AI 3D" icon="alert-triangle" accent={ADMIN_RED} />
        </View>

        <View style={styles.card}>
          <SectionHeader title="Nhật ký lỗi gần đây" subtitle="20 lỗi mới nhất từ AI/hệ thống" />
          {systemStatus?.errors?.length ? systemStatus.errors.map((e: any, i: number) => (
            <View key={i} style={styles.errRow}>
              <Feather name="alert-triangle" size={13} color={ADMIN_ORANGE} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errScope}>{e.scope} • {String(e.at).slice(0, 19).replace("T", " ")}</Text>
                <Text style={styles.errMsg}>{e.message}</Text>
              </View>
            </View>
          )) : <Text style={styles.emptyText}>Chưa có lỗi nào được ghi nhận.</Text>}
        </View>
      </View>
    );
  };

  // [NEW] Audit log tab
  const renderAuditLog = () => (
    <View style={styles.pageGap}>
      <SectionHeader
        title="Nhật ký hoạt động admin"
        subtitle="Theo dõi mọi thao tác của admin/nhân viên."
        right={<Text style={styles.counterPill}>{auditLogs.length} bản ghi</Text>}
      />
      <View style={styles.tableCard}>
        {auditLogs.length ? auditLogs.slice(0, 50).map((log: any, idx: number) => (
          <View key={idx} style={styles.userRow}>
            <View style={styles.paymentIcon}><Feather name="file-text" size={14} color={ADMIN_MUTED} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.userName}>{log.action || "Hoạt động"}</Text>
              <Text numberOfLines={1} style={styles.userEmail}>Bởi: {log.actorEmail || log.actorId || "--"}</Text>
              <Text numberOfLines={2} style={styles.userMeta}>{log.detail || JSON.stringify(log.payload || {}).slice(0, 100)} • {compactDate(log.createdAt)}</Text>
            </View>
          </View>
        )) : <Text style={styles.emptyText}>Chưa có bản ghi. (Cần API getAuditLogs ở backend)</Text>}
      </View>
    </View>
  );

  const renderTryon2d = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Quản lý thử đồ AI 2D (CatVTON)" subtitle="Theo dõi số lượt, tỷ lệ lỗi và cấu hình model." right={<Text style={styles.counterPill}>{formatNumber(kpis.tryon2d || 0)} lượt</Text>} />
      <View style={styles.statsGrid}>
        <StatCard label="Tổng lượt thử đồ" value={formatNumber(kpis.tryon2d || 0)} change="tất cả thời gian" icon="camera" accent={ADMIN_GREEN} />
        <StatCard label="Thành công" value={formatNumber((kpis.tryon2d || 0) - (kpis.tryon2dFail || 0))} change="ước tính" icon="check-circle" accent={ADMIN_BLUE} />
        <StatCard label="Lỗi" value={formatNumber(kpis.tryon2dFail || 0)} change="xem nhật ký" icon="alert-triangle" accent={ADMIN_RED} />
      </View>
      <View style={styles.card}>
        <SectionHeader title="Cấu hình engine" subtitle="Chuỗi ưu tiên model mạnh" />
        <Text style={styles.userMeta}>Ưu tiên: CatVTON (JAPANO_CATVTON_URL:7861) → AI Gateway (:8001, model=strong, steps=50, hd) → ghép ảnh dự phòng.</Text>
      </View>
    </View>
  );

  const renderModel3d = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Quản lý mẫu 3D" subtitle="Số lượt dùng 3D và trạng thái." right={<Text style={styles.counterPill}>{formatNumber(kpis.tryon3d || 0)} lượt</Text>} />
      <View style={styles.statsGrid}>
        <StatCard label="Tổng lượt tạo 3D" value={formatNumber(kpis.tryon3d || 0)} change="tất cả thời gian" icon="box" accent={ADMIN_GREEN} />
        <StatCard label="Thành công" value={formatNumber((kpis.tryon3d || 0) - (kpis.tryon3dFail || 0))} change="ước tính" icon="check-circle" accent={ADMIN_BLUE} />
        <StatCard label="Lỗi" value={formatNumber(kpis.tryon3dFail || 0)} change="xem nhật ký" icon="alert-triangle" accent={ADMIN_RED} />
      </View>
    </View>
  );

  const renderBotChat = () => (
    <View style={styles.pageGap}>
      <SectionHeader title="Bot chat & Gợi ý thời trang" subtitle="Model, embedding và kiểm duyệt." />
      <View style={styles.card}>
        <SectionHeader title="Cấu hình model" subtitle="Đang dùng" />
        <Text style={styles.userMeta}>Chat model: llama3.1:8b (Ollama) • Embedding: nomic-embed-text</Text>
      </View>
      <View style={styles.card}>
        <SectionHeader title="Danh sách từ cấm" subtitle="Áp dụng cho bình luận & chat" right={<Pressable onPress={() => setActiveTab("moderation")} style={styles.smallBtn}><Text style={styles.smallBtnText}>Quản lý</Text></Pressable>} />
        <Text style={styles.userMeta}>{formatNumber(bannedWords.length)} từ đang chặn.</Text>
      </View>
    </View>
  );

  const renderReports = () => (
    <View style={styles.pageGap}>
      <SectionHeader
        title="Báo cáo tài chính"
        subtitle="Phân tích doanh thu, chi phí, lợi nhuận."
        right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={exportRevenueCsv} style={styles.smallBtn}><Feather name="download" size={12} color={ADMIN_TEXT} /><Text style={styles.smallBtnText}>Doanh thu CSV</Text></Pressable>
            <Pressable onPress={exportOrdersCsv} style={styles.smallBtn}><Feather name="download" size={12} color={ADMIN_TEXT} /><Text style={styles.smallBtnText}>Đơn hàng CSV</Text></Pressable>
          </View>
        }
      />
      <View style={styles.statsGrid}>
        <StatCard label="Tổng doanh thu" value={formatCompactMoney(dashboard?.totalRevenue || 0)} change="tất cả thời gian" icon="dollar-sign" accent={ADMIN_GREEN} />
        <StatCard label="Doanh thu tháng này" value={formatCompactMoney(dashboard?.monthlyRevenue || 0)} change={`${formatNumber(orders.length)} đơn`} icon="trending-up" accent={ADMIN_BLUE} />
        <StatCard label="Chi phí vận chuyển" value={formatCompactMoney(dashboard?.shippingCost || 0)} change="ước tính" icon="truck" accent={ADMIN_ORANGE} />
        <StatCard label="Lợi nhuận ròng" value={formatCompactMoney((dashboard?.totalRevenue || 0) - (dashboard?.shippingCost || 0))} change="doanh thu - chi phí" icon="award" accent={ADMIN_PURPLE} />
      </View>

      <View style={styles.dashboardGrid}>
        <View style={[styles.card, styles.bigChartCard]}>
          <SectionHeader title="Doanh thu theo tháng" subtitle="12 tháng gần nhất" />
          <MiniBars data={revenueByMonth.length ? revenueByMonth : miniTrendData([])} accent={ADMIN_GREEN} money />
        </View>
        <View style={styles.card}>
          <SectionHeader title="Top sản phẩm theo doanh thu" subtitle="Bán chạy nhất" />
          {topProducts.length ? <HorizontalBars data={topProducts.slice(0, 5).map((x: any) => ({ label: x.name, value: x.revenue || x.unitsSold * x.price }))} accent={ADMIN_GREEN} money /> : <Text style={styles.emptyText}>Chưa có dữ liệu.</Text>}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.formTitle}>Tóm tắt tài chính</Text>
        <View style={styles.statMiniRow}>
          <View style={styles.statMini}><Text style={styles.statMiniNum}>{formatNumber(orders.length)}</Text><Text style={styles.statMiniCap}>Tổng đơn</Text></View>
          <View style={styles.statMini}><Text style={styles.statMiniNum}>{formatNumber(users.length)}</Text><Text style={styles.statMiniCap}>Tổng khách</Text></View>
          <View style={styles.statMini}><Text style={styles.statMiniNum}>{formatNumber(products.length)}</Text><Text style={styles.statMiniCap}>Sản phẩm</Text></View>
          <View style={styles.statMini}><Text style={styles.statMiniNum}>{formatNumber(reviews.length)}</Text><Text style={styles.statMiniCap}>Đánh giá</Text></View>
        </View>
      </View>
    </View>
  );

  const renderActive = () => {
    if (loading) {
      return <View style={styles.loadingCard}><ActivityIndicator color={ADMIN_GREEN} /><Text style={styles.emptyText}>Đang tải dữ liệu admin...</Text></View>;
    }
    switch (activeTab) {
      case "overview": return renderOverview();
      case "analytics": return renderAnalytics();
      case "products": return renderProducts();
      case "inventory": return renderInventory();
      case "reviews": return renderReviews();
      case "accessories": return renderAccessories();
      case "promotions": return renderPromotions();
      case "users": return renderUsers();
      case "orders": return renderOrders();
      case "transactions": return renderTransactions();
      case "refunds": return renderRefunds();
      case "moderation": return renderModeration();
      case "staff": return renderStaff();
      case "settings": return renderSettings();
      case "newsletter": return renderNewsLetter();
      case "reports": return renderReports();
      case "games": return renderGames();
      case "tryon2d": return renderTryon2d();
      case "model3d": return renderModel3d();
      case "botchat": return renderBotChat();
      case "system": return renderSystemStatus();
      case "auditlog": return renderAuditLog();
      default: return renderOverview();
    }
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
const textHeading: any = { ...textBase, color: ADMIN_TEXT, fontWeight: "700", fontSize: 16 };
const textBody: any = { ...textBase, color: ADMIN_MUTED, fontWeight: "500", fontSize: 13 };

const styles = StyleSheet.create({
  appShell: { flex: 1, flexDirection: "row", backgroundColor: ADMIN_BG },
  sidebar: { width: 238, backgroundColor: ADMIN_DARK, padding: 20, paddingBottom: 16 },
  sidebarMobile: { width: "100%", padding: 12, paddingBottom: 10 },
  sidebarLogoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  sidebarLogo: { width: 34, height: 34, borderRadius: 16, backgroundColor: ADMIN_GREEN, alignItems: "center", justifyContent: "center" },
  sidebarBrand: { color: "#fff", fontSize: 16, fontWeight: "700" },
  sidebarSub: { color: ADMIN_MUTED_DARK, fontSize: 11, fontWeight: "600", letterSpacing: 1.2, marginTop: 2 },
  navContent: { gap: 4, paddingBottom: 20 },
  navContentMobile: { gap: 8, alignItems: "center" },
  navGroup: { color: "#52605A", fontSize: 11, fontWeight: "700", letterSpacing: 1.1, marginTop: 14, marginBottom: 5 },
  navItem: { minHeight: 40, borderRadius: 16, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  navItemActive: { backgroundColor: "#3A1410" },
  navText: { color: ADMIN_MUTED_DARK, fontSize: 13, fontWeight: "600" },
  navTextActive: { color: ADMIN_GREEN },
  navBadge: { marginLeft: "auto", backgroundColor: ADMIN_GREEN, color: "#fff", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 16, fontSize: 11, fontWeight: "600", overflow: "hidden" },
  sidebarUser: { marginTop: "auto", paddingTop: 14, borderTopWidth: 1, borderTopColor: "#13221B", flexDirection: "row", alignItems: "center", gap: 10 },
  sidebarAvatar: { width: 34, height: 34, borderRadius: 16, backgroundColor: ADMIN_GREEN, alignItems: "center", justifyContent: "center" },
  sidebarAvatarText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  sidebarUserName: { color: "#fff", fontSize: 13, fontWeight: "700" },
  sidebarUserRole: { color: ADMIN_MUTED_DARK, fontSize: 12, fontWeight: "500", marginTop: 2 },
  mainArea: { flex: 1, minWidth: 0 },
  topbar: { minHeight: 68, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: ADMIN_BORDER, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", gap: 12 },
  searchBox: { flex: 1, maxWidth: 420, minHeight: 42, borderWidth: 1, borderColor: ADMIN_BORDER, backgroundColor: "#FAFBFC", borderRadius: 16, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: "500", color: ADMIN_TEXT },
  topIconBtn: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: ADMIN_BORDER, backgroundColor: "#fff" },
  newOrderBtn: { minHeight: 42, borderRadius: 16, backgroundColor: ADMIN_GREEN, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  newOrderText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  content: { padding: 24, paddingBottom: 80 },
  pageGap: { gap: 18 },
  heroCard: { minHeight: 108, borderRadius: 16, backgroundColor: ADMIN_DARK, padding: 22, flexDirection: "row", alignItems: "center", gap: 16, ...ADMIN_CARD_SHADOW },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  heroSub: { color: ADMIN_MUTED_DARK, fontSize: 13, fontWeight: "500", marginTop: 6, lineHeight: 20 },
  heroButton: { minHeight: 42, borderRadius: 14, backgroundColor: ADMIN_GREEN, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  heroButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  statCard: { flex: 1, minWidth: 180, backgroundColor: ADMIN_CARD, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: ADMIN_BORDER, gap: 14, ...ADMIN_CARD_SHADOW },
  statTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  statLabel: { ...textBody, fontSize: 12, fontWeight: "600" },
  statValue: { ...textHeading, fontSize: 22, marginTop: 4 },
  statIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  statBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statChange: { fontSize: 12, fontWeight: "600" },

  dashboardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  dashboardGrid3: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  bigChartCard: { flex: 2, minWidth: 280 },
  analyticsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },

  card: { backgroundColor: ADMIN_CARD, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: ADMIN_BORDER, gap: 14, ...ADMIN_CARD_SHADOW },
  tableCard: { backgroundColor: ADMIN_CARD, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: ADMIN_BORDER, gap: 0, ...ADMIN_CARD_SHADOW },
  formCard: { gap: 12 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  sectionTitle: { ...textHeading, fontSize: 15 },
  sectionSub: { ...textBody, fontSize: 12, marginTop: 2 },

  miniBars: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 80 },
  miniBarsCompact: { height: 36, gap: 4 },
  miniBarItem: { flex: 1, alignItems: "center", gap: 4 },
  miniBarTrack: { flex: 1, width: "100%", justifyContent: "flex-end" },
  miniBarFill: { width: "100%", borderRadius: 4 },
  chartLabel: { fontSize: 10, color: ADMIN_MUTED, fontWeight: "500" },
  chartValue: { fontSize: 10, color: ADMIN_TEXT, fontWeight: "600" },

  forecastChart: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 110 },
  forecastCol: { flex: 1, alignItems: "center", gap: 4 },
  forecastTrack: { width: "100%", height: 80, justifyContent: "flex-end" },
  forecastFill: { width: "100%", borderRadius: 4 },
  forecastVal: { fontSize: 9, color: ADMIN_MUTED, fontWeight: "500" },
  forecastLbl: { fontSize: 9, color: ADMIN_MUTED, fontWeight: "600" },
  forecastMetrics: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  metricPill: { flex: 1, minWidth: 100, backgroundColor: "#F5F7FA", borderRadius: 12, padding: 12, alignItems: "center" },
  metricNum: { fontSize: 15, fontWeight: "700", color: ADMIN_TEXT },
  metricCap: { fontSize: 11, color: ADMIN_MUTED, fontWeight: "500", marginTop: 2 },
  legendRow: { flexDirection: "row", gap: 14, alignItems: "center", flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: ADMIN_MUTED, fontWeight: "500" },
  demoTag: { fontSize: 11, color: ADMIN_ORANGE, fontWeight: "600", fontStyle: "italic" },

  segBar: { height: 14, borderRadius: 8, overflow: "hidden", flexDirection: "row" },
  segRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  segDot: { width: 12, height: 12, borderRadius: 6 },
  segName: { fontSize: 13, fontWeight: "700", color: ADMIN_TEXT },
  segMeta: { fontSize: 12, color: ADMIN_MUTED, fontWeight: "500", marginTop: 2 },
  segPct: { fontSize: 14, fontWeight: "700", color: ADMIN_TEXT },

  barLineTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  barName: { flex: 1, fontSize: 13, fontWeight: "600", color: ADMIN_TEXT },
  barValue: { fontSize: 13, fontWeight: "700", color: ADMIN_TEXT },
  hTrack: { height: 8, backgroundColor: "#F0F2F4", borderRadius: 4, overflow: "hidden" },
  hFill: { height: "100%", borderRadius: 4 },

  modelRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  modelCard: { flex: 1, minWidth: 160, backgroundColor: ADMIN_CARD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: ADMIN_BORDER, gap: 6 },
  modelTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  modelName: { fontSize: 13, fontWeight: "700", color: ADMIN_TEXT, flex: 1 },
  modelType: { fontSize: 11, color: ADMIN_MUTED, fontWeight: "600" },
  modelMetric: { fontSize: 12, color: ADMIN_GREEN, fontWeight: "600" },

  predictionGrid: { gap: 12 },
  predictionCard: { backgroundColor: ADMIN_CARD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: ADMIN_BORDER, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  predictionImage: { width: 60, height: 60, borderRadius: 10, backgroundColor: "#F0F2F4", alignItems: "center", justifyContent: "center" },
  predictionTitle: { fontSize: 13, fontWeight: "700", color: ADMIN_TEXT },
  predictionMeta: { fontSize: 12, color: ADMIN_MUTED, fontWeight: "500", marginTop: 2 },
  predictionSuggestion: { fontSize: 12, color: ADMIN_GREEN, fontWeight: "600", marginTop: 4 },
  predictionSmall: { fontSize: 11, color: ADMIN_MUTED, marginTop: 2 },
  scoreBox: { alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 12, backgroundColor: "#F5F7FA" },
  scoreText: { fontSize: 16, fontWeight: "700", color: ADMIN_TEXT },
  scoreLabel: { fontSize: 10, color: ADMIN_MUTED, fontWeight: "500" },

  featureWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  featureChip: { backgroundColor: "#E9F8F1", color: ADMIN_GREEN, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, fontSize: 11, fontWeight: "600", overflow: "hidden" },

  productManagerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  productListGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  productCard: { flex: 1, minWidth: 260, backgroundColor: ADMIN_CARD, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: ADMIN_BORDER, gap: 10, ...ADMIN_CARD_SHADOW },
  productTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  productImage: { width: 70, height: 70, borderRadius: 12, backgroundColor: "#F0F2F4", alignItems: "center", justifyContent: "center" },
  productTitle: { fontSize: 14, fontWeight: "700", color: ADMIN_TEXT },
  productMeta: { fontSize: 12, color: ADMIN_MUTED, fontWeight: "500", marginTop: 2 },
  productPriceLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  productPrice: { fontSize: 14, fontWeight: "700", color: ADMIN_GREEN },
  productOldPrice: { fontSize: 12, color: ADMIN_MUTED, textDecorationLine: "line-through" },
  productDesc: { fontSize: 12, color: ADMIN_MUTED, lineHeight: 18 },
  adminThumbRow: { flexDirection: "row", gap: 6 },
  adminThumb: { width: 44, height: 44, borderRadius: 8 },
  discountBadge: { backgroundColor: "#FEF9EC", color: ADMIN_ORANGE, fontSize: 11, fontWeight: "700", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  checkBox: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  bulkBar: { backgroundColor: "#E9F8F1", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bulkText: { fontSize: 13, fontWeight: "600", color: ADMIN_GREEN },

  marketPreview: { minWidth: 280, maxWidth: 340, backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: ADMIN_BORDER, ...ADMIN_CARD_SHADOW },
  previewTopIcons: { flexDirection: "row", justifyContent: "space-between", padding: 14 },
  previewImageBox: { width: "100%", height: 200, backgroundColor: "#F5F7FA", alignItems: "center", justifyContent: "center" },
  previewImage: { width: "100%", height: "100%" },
  previewDiscount: { position: "absolute", top: 10, right: 10, backgroundColor: ADMIN_RED, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  previewDiscountText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  previewThumbRow: { flexDirection: "row", gap: 6, padding: 10 },
  previewThumb: { width: 50, height: 50, borderRadius: 8 },
  previewBody: { padding: 14, paddingTop: 4, gap: 4 },
  previewTitle: { fontSize: 15, fontWeight: "700", color: ADMIN_TEXT },
  previewPriceLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  previewSalePrice: { fontSize: 16, fontWeight: "700", color: ADMIN_GREEN },
  previewOldPrice: { fontSize: 13, color: ADMIN_MUTED, textDecorationLine: "line-through" },
  previewMeta: { fontSize: 12, color: ADMIN_MUTED },

  mediaUploadBox: { backgroundColor: "#F5F7FA", borderRadius: 12, padding: 12, gap: 8 },
  mediaUploadTitle: { fontSize: 12, fontWeight: "700", color: ADMIN_MUTED },

  formTitle: { fontSize: 14, fontWeight: "700", color: ADMIN_TEXT },
  formGrid2: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  formGrid3: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  inputWrap: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: "600", color: ADMIN_MUTED },
  input: { minHeight: 42, borderWidth: 1, borderColor: ADMIN_BORDER, borderRadius: 12, paddingHorizontal: 12, fontSize: 13, fontWeight: "500", color: ADMIN_TEXT, backgroundColor: "#FAFBFC", flex: 1 },
  inputMultiline: { minHeight: 80, textAlignVertical: "top", paddingTop: 10 },

  actionRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
  primaryBtn: { minHeight: 42, borderRadius: 14, backgroundColor: ADMIN_GREEN, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  secondaryBtn: { minHeight: 42, borderRadius: 14, backgroundColor: "#F0F2F4", paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  secondaryBtnWide: { minHeight: 42, borderRadius: 14, backgroundColor: "#F0F2F4", paddingHorizontal: 16, alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
  secondaryBtnText: { color: ADMIN_TEXT, fontWeight: "600", fontSize: 13 },
  smallBtn: { minHeight: 34, borderRadius: 10, backgroundColor: "#F0F2F4", paddingHorizontal: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  smallBtnText: { color: ADMIN_TEXT, fontWeight: "600", fontSize: 12 },
  saleBtn: { minHeight: 34, borderRadius: 10, backgroundColor: "#FEF9EC", paddingHorizontal: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  saleBtnText: { color: "#B45309", fontWeight: "600", fontSize: 12 },
  dangerBtn: { minHeight: 34, borderRadius: 10, backgroundColor: "#FFF1F2", paddingHorizontal: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  dangerBtnText: { color: ADMIN_RED, fontWeight: "600", fontSize: 12 },
  successBtn: { minHeight: 34, borderRadius: 10, backgroundColor: "#E9F8F1", paddingHorizontal: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  successBtnText: { color: "#2E7D32", fontWeight: "600", fontSize: 12 },

  selectChip: { minHeight: 34, borderRadius: 10, backgroundColor: "#F0F2F4", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  selectChipActive: { backgroundColor: ADMIN_GREEN },
  selectChipText: { color: ADMIN_MUTED, fontWeight: "600", fontSize: 12 },
  selectChipTextActive: { color: "#fff" },

  counterPill: { fontSize: 12, fontWeight: "600", color: ADMIN_MUTED, backgroundColor: "#F0F2F4", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: "hidden" },

  userRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F0F2F4" },
  userAvatar: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#E9F8F1", alignItems: "center", justifyContent: "center" },
  userAvatarAdmin: { backgroundColor: ADMIN_GREEN },
  userName: { fontSize: 13, fontWeight: "700", color: ADMIN_TEXT },
  userEmail: { fontSize: 12, color: ADMIN_MUTED, fontWeight: "500", marginTop: 1 },
  userMeta: { fontSize: 12, color: ADMIN_MUTED, fontWeight: "500", marginTop: 2 },
  userActions: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  rolePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#F0F2F4" },
  roleAdmin: { backgroundColor: "#FFF1F2" },
  rolePillText: { fontSize: 11, fontWeight: "700", color: ADMIN_MUTED },
  rolePillTextAdmin: { color: ADMIN_RED },

  statMiniRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  statMini: { flex: 1, minWidth: 80, backgroundColor: "#F5F7FA", borderRadius: 12, padding: 12, alignItems: "center" },
  statMiniNum: { fontSize: 15, fontWeight: "700", color: ADMIN_TEXT },
  statMiniCap: { fontSize: 11, color: ADMIN_MUTED, fontWeight: "500", marginTop: 2 },

  orderDetailCard: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 12, gap: 8, borderWidth: 1, borderColor: ADMIN_BORDER },
  orderItemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  orderItemImg: { width: 44, height: 44, borderRadius: 8, backgroundColor: "#F0F2F4", alignItems: "center", justifyContent: "center" },
  orderItemName: { fontSize: 13, fontWeight: "600", color: ADMIN_TEXT },
  orderItemPrice: { fontSize: 13, fontWeight: "700", color: ADMIN_GREEN },

  paymentRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F0F2F4" },
  paymentIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#EEF6FF", alignItems: "center", justifyContent: "center" },
  paymentTitle: { fontSize: 13, fontWeight: "700", color: ADMIN_TEXT },
  paymentMeta: { fontSize: 12, color: ADMIN_MUTED, fontWeight: "500", marginTop: 2 },

  statusChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusOk: { backgroundColor: "#E9F8F1" },
  statusPend: { backgroundColor: "#FEF9EC" },
  statusBad: { backgroundColor: "#FFF1F2" },
  statusChipText: { fontSize: 11, fontWeight: "700", color: ADMIN_TEXT },

  statusPill: { minHeight: 30, paddingHorizontal: 12, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statusOn: { backgroundColor: "#E9F8F1" },
  statusOff: { backgroundColor: "#F0F2F4" },
  statusText: { fontSize: 12, fontWeight: "700" },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusName: { flex: 1, fontSize: 13, fontWeight: "600", color: ADMIN_TEXT },
  statusVal: { fontSize: 12, fontWeight: "700" },

  voucherRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F0F2F4" },
  voucherIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#E9F8F1", alignItems: "center", justifyContent: "center" },
  voucherCode: { fontSize: 13, fontWeight: "700", color: ADMIN_TEXT },
  voucherMeta: { fontSize: 12, color: ADMIN_MUTED, fontWeight: "500", marginTop: 2 },

  promoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  promoRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F0F2F4" },
  promoThumb: { width: 60, height: 44, borderRadius: 8, backgroundColor: "#F0F2F4", alignItems: "center", justifyContent: "center" },
  listGrid2: { flexDirection: "row", flexWrap: "wrap", gap: 14 },

  inventoryLogRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F2F4" },
  inventoryIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  inventoryChange: { fontSize: 14, fontWeight: "700", color: ADMIN_TEXT },

  bannedWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  bannedChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF1F2", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  bannedChipText: { fontSize: 13, fontWeight: "600", color: ADMIN_RED },

  accThumb: { width: 46, height: 46, borderRadius: 10, backgroundColor: "#F0F2F4", alignItems: "center", justifyContent: "center" },

  errRow: { flexDirection: "row", gap: 10, paddingVertical: 8, alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: "#F0F2F4" },
  errScope: { fontSize: 11, fontWeight: "700", color: ADMIN_ORANGE },
  errMsg: { fontSize: 12, color: ADMIN_MUTED, fontWeight: "500", marginTop: 2 },

  activityRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  activityIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#E9F8F1", alignItems: "center", justifyContent: "center" },
  activityTitle: { fontSize: 13, fontWeight: "600", color: ADMIN_TEXT },
  activityMeta: { fontSize: 12, color: ADMIN_MUTED, fontWeight: "500", marginTop: 1 },

  authPage: { flex: 1, backgroundColor: ADMIN_BG, alignItems: "center", justifyContent: "center", padding: 24 },
  authCard: { backgroundColor: ADMIN_CARD, borderRadius: 20, padding: 32, alignItems: "center", gap: 14, maxWidth: 360, width: "100%", ...ADMIN_CARD_SHADOW },
  logoBox: { width: 52, height: 52, borderRadius: 20, backgroundColor: ADMIN_GREEN, alignItems: "center", justifyContent: "center" },
  authTitle: { fontSize: 18, fontWeight: "700", color: ADMIN_TEXT },
  authText: { fontSize: 13, color: ADMIN_MUTED, textAlign: "center", lineHeight: 20 },
  authButton: { minHeight: 46, width: "100%", borderRadius: 14, backgroundColor: ADMIN_GREEN, alignItems: "center", justifyContent: "center" },
  authButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  loadingCard: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 40 },
  emptyText: { fontSize: 13, color: ADMIN_MUTED, fontWeight: "500", textAlign: "center", paddingVertical: 16 },
});