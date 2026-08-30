// Catalog MongoDB mang hai thế hệ biến thể: bộ cũ dùng `colorName`/`sku`, bộ
// nhập sau (36 sản phẩm `jp*`) chỉ có `color`/`id`. Kiểu này mô tả cả hai dạng
// thô; `normalizeVariants()` trong lib/product.ts mới là thứ giao diện dùng.
export type RawProductVariant = {
  colorName?: string;
  color?: string;
  colorHex?: string;
  size: string;
  sku?: string;
  id?: string;
  stock: number;
  price?: number;
};

export type ProductVariant = {
  key: string;
  colorName: string;
  colorHex?: string;
  size: string;
  sku?: string;
  stock: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  kanji?: string;
  brand?: string;
  price: number;
  old?: number | null;
  sale?: number | null;
  discountPercent?: number;
  status?: string;
  createdAt?: number;
  publishedAt?: number;
  cat?: string;
  category?: string;
  desc?: string;
  story?: string;
  colorHex?: string;
  tags?: string[];
  rating?: number;
  reviewCount?: number;
  sold?: number;
  variants?: RawProductVariant[];
  images?: string[];
  image?: string;
  videos?: Array<{ url: string }>;
};

export type ShopLocation = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string;
  openingHours?: string;
  services?: string[];
  active?: boolean;
};

export type Shop = {
  name: string;
  hotline: string;
  email: string;
  address: string;
  shipFee: number;
  cod: boolean;
  stripe: boolean;
  vnpay: boolean;
  logo?: string | null;
  locations?: ShopLocation[];
};

export type Category = { id: string; name: string; kanji?: string };
export type Banner = { id: string; title: string; img?: string; link?: string; active?: boolean; order?: number };

export type JapanSpot = {
  id: string;
  place: string;
  prefecture: string;
  region?: string;
  photoUrl: string;
  where?: string;
  history?: string;
  highlights?: string[];
  bestTime?: string;
  photoTip?: string;
  sourceLabel?: string;
  sourceUrl?: string;
};

export type HomePayload = {
  ok: boolean;
  shop: Shop;
  banners: Banner[];
  categories: Category[];
  newArrivals: Product[];
  bestSellers: Product[];
  featuredProducts: Product[];
  featuredJapanSpots: JapanSpot[];
  fulfillmentPolicies?: Record<string, unknown>;
  generatedAt?: number;
};

export type CartItem = {
  key: string;
  productId: string;
  slug: string;
  name: string;
  image: string;
  color: string;
  size: string;
  price: number;
  quantity: number;
  stock: number;
};
