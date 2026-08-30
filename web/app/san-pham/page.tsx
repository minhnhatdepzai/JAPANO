import type { Metadata } from "next";
import { CatalogClient } from "@/components/catalog-client";
import { PageHero } from "@/components/page-hero";
import { getHome, getProducts } from "@/lib/server-api";

export const metadata: Metadata = { title: "Tất cả sản phẩm", description: "Khám phá toàn bộ thời trang Nhật Bản JAPANO theo danh mục, giá và độ phổ biến.", alternates: { canonical: "/san-pham" } };

export default async function ProductsPage() {
  const [products, home] = await Promise.all([getProducts().catch(() => []), getHome().catch(() => null)]);
  return <div className="page-shell"><PageHero eyebrow="Catalog · 商品" title="Tất cả sản phẩm" copy="Lọc trên URL để bạn có thể lưu, chia sẻ và quay lại đúng lựa chọn." aside={<span className="hero-count">{products.length}<small>thiết kế đang bán</small></span>} /><CatalogClient products={products} categories={home?.categories || []} /></div>;
}
