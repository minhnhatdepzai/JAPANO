import type { Metadata } from "next";
import { CatalogClient } from "@/components/catalog-client";
import { PageHero } from "@/components/page-hero";
import { getHome } from "@/lib/server-api";

export const metadata: Metadata = { title: "Hàng mới", description: "Những thiết kế JAPANO mới xuất bản.", alternates: { canonical: "/hang-moi" } };

export default async function NewPage() {
  const home = await getHome().catch(() => null);
  return <div className="page-shell"><PageHero eyebrow="New arrivals · 新着" title="Hàng mới" copy="Sắp theo ngày lên kệ thật. Sản phẩm chưa có ngày giữ nguyên thứ tự catalog thay vì được gán ngày giả." /><CatalogClient products={home?.newArrivals || []} categories={home?.categories || []} defaultSort="newest" /></div>;
}
