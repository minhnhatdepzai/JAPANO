import type { Metadata } from "next";
import { CatalogClient } from "@/components/catalog-client";
import { PageHero } from "@/components/page-hero";
import { getHome, getProducts } from "@/lib/server-api";

export const metadata: Metadata = { title: "Tìm kiếm", robots: { index: false, follow: true } };

export default async function SearchPage() {
  const [products, home] = await Promise.all([getProducts().catch(() => []), getHome().catch(() => null)]);
  return <div className="page-shell"><PageHero eyebrow="Search · 検索" title="Tìm thiết kế dành cho bạn" copy="Tên, mô tả và tag từ catalog chung của JAPANO đều được tìm kiếm." /><CatalogClient products={products} categories={home?.categories || []} /></div>;
}
