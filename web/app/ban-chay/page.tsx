import type { Metadata } from "next";
import { CatalogClient } from "@/components/catalog-client";
import { PageHero } from "@/components/page-hero";
import { getHome } from "@/lib/server-api";

export const metadata: Metadata = { title: "Bán chạy", description: "Sản phẩm JAPANO xếp hạng từ đơn hàng thành công thật.", alternates: { canonical: "/ban-chay" } };

export default async function BestSellerPage() {
  const home = await getHome().catch(() => null);
  return <div className="page-shell"><PageHero eyebrow="Ranking · 人気" title="Hàng bán chạy" copy="Thứ hạng đến từ đơn hàng thật đã hoàn tất — không phải nhãn gắn tay." /><CatalogClient products={home?.bestSellers || []} categories={home?.categories || []} defaultSort="best-selling" /></div>;
}
