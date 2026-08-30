"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { ProductRail } from "@/components/product-rail";
import { useStore } from "@/components/store-provider";
import type { Product } from "@/lib/types";

export function WishlistPage({ products }: { products: Product[] }) {
  const { wishlist } = useStore();
  const selected = products.filter((product) => wishlist.includes(product.slug));
  return selected.length ? <ProductRail products={selected} /> : <div className="empty-state page-empty"><Heart aria-hidden="true" /><h2>Chưa có thiết kế nào được lưu</h2><p>Bấm biểu tượng trái tim trên sản phẩm để tạo danh sách của riêng bạn.</p><Link className="button primary" href="/san-pham">Tìm sản phẩm yêu thích</Link></div>;
}
