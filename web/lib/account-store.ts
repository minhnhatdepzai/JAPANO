import { productImage } from "@/lib/format";
import { normalizeVariants } from "@/lib/product";
import type { CartItem, Product } from "@/lib/types";

export type ServerCartRow = {
  productId: string;
  color: string;
  size: string;
  quantity: number;
};

export function rebuildServerCart(rows: ServerCartRow[], catalog: Product[]): CartItem[] {
  const bySlug = new Map(catalog.map((product) => [product.slug, product]));

  return rows.flatMap((row): CartItem[] => {
    const product = bySlug.get(String(row.productId));
    if (!product) return [];
    const variants = normalizeVariants(product.variants);
    const variant = variants.find((entry) => entry.colorName === row.color && entry.size === row.size)
      || variants.find((entry) => entry.size === row.size);
    const quantity = Math.max(1, Number(row.quantity || 1));

    return [{
      key: `${product.slug}:${row.color}:${row.size}`,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: productImage(product),
      color: row.color,
      size: row.size,
      price: product.price,
      quantity,
      stock: Math.max(Number(variant?.stock || 0), quantity),
    }];
  });
}
