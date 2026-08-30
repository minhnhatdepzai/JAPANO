import type { Product, ProductVariant, RawProductVariant } from "@/lib/types";

const DEFAULT_COLOR = "Mặc định";

/**
 * Chuẩn hoá biến thể về một hình dạng duy nhất cho giao diện.
 *
 * Catalog dùng chung với app đang có hai thế hệ dữ liệu: nhóm cũ ghi
 * `colorName`/`colorHex`/`sku`, còn 36 sản phẩm nhập sau chỉ có `color` và `id`.
 * Nếu render thẳng dữ liệu thô thì `key` của React là `undefined` cho cả danh
 * sách màu (React cảnh báo "unique key prop") và nhãn màu hiện ra là
 * "Màu undefined". Chuẩn hoá tại biên giúp không phải sửa backend và không phá
 * hợp đồng API mà app đang dùng.
 */
export function normalizeVariants(variants: RawProductVariant[] | undefined): ProductVariant[] {
  return (variants || []).map((variant, index) => {
    const colorName = String(variant.colorName || variant.color || DEFAULT_COLOR);
    const size = String(variant.size || "");
    const sku = variant.sku || variant.id || undefined;
    return {
      key: sku ? String(sku) : `${colorName}:${size}:${index}`,
      colorName,
      colorHex: variant.colorHex,
      size,
      sku: sku ? String(sku) : undefined,
      stock: Number(variant.stock || 0),
    };
  });
}

/** Biến thể còn bán được — đã chuẩn hoá và loại các dòng hết tồn kho. */
export function sellableVariants(product: Pick<Product, "variants"> | undefined): ProductVariant[] {
  return normalizeVariants(product?.variants).filter((variant) => variant.stock > 0);
}

/** Danh sách màu duy nhất, giữ nguyên thứ tự xuất hiện trong catalog. */
export function uniqueColors(variants: ProductVariant[]): ProductVariant[] {
  const seen = new Map<string, ProductVariant>();
  for (const variant of variants) if (!seen.has(variant.colorName)) seen.set(variant.colorName, variant);
  return [...seen.values()];
}

/** Danh sách size duy nhất theo thứ tự catalog. */
export function uniqueSizes(variants: ProductVariant[]): string[] {
  return [...new Set(variants.map((variant) => variant.size).filter(Boolean))];
}

export function totalStock(variants: ProductVariant[]) {
  return variants.reduce((total, variant) => total + variant.stock, 0);
}
