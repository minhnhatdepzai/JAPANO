import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/server-api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4200";
  const paths = ["", "/san-pham", "/hang-moi", "/ban-chay", "/thu-do", "/du-lich-nhat-ban", "/cua-hang"];
  const products = await getProducts().catch(() => []);
  return [
    ...paths.map((path) => ({ url: `${site}${path}`, lastModified: new Date(), changeFrequency: path ? "daily" as const : "hourly" as const, priority: path ? 0.8 : 1 })),
    ...products.map((product) => ({ url: `${site}/san-pham/${product.slug}`, lastModified: new Date(product.createdAt || Date.now()), changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
