import type { Metadata } from "next";
import { CatalogClient } from "@/components/catalog-client";
import { PageHero } from "@/components/page-hero";
import { getHome, getProducts } from "@/lib/server-api";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Bộ sưu tập ${slug}`, alternates: { canonical: `/bo-suu-tap/${slug}` } };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [products, home] = await Promise.all([getProducts().catch(() => []), getHome().catch(() => null)]);
  const category = home?.categories.find((item) => item.id === slug);
  const selected = category ? products.filter((product) => [product.cat, product.category].includes(slug)) : products.filter((product) => product.tags?.includes(slug));
  return <div className="page-shell"><PageHero eyebrow={`${category?.kanji || "蒐集"} · Collection`} title={category?.name || `Bộ sưu tập ${slug.replace(/-/g, " ")}`} copy="Một nhịp phối nhất quán, lấy trực tiếp từ sản phẩm đang bán." /><CatalogClient products={selected} categories={home?.categories || []} defaultCategory={category?.id || ""} /></div>;
}
