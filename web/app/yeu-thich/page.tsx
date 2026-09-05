import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { WishlistPage } from "@/components/wishlist-page";
import { getProducts } from "@/lib/server-api";
import { requireStorefrontSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Yêu thích", robots: { index: false, follow: true } };
export default async function WishlistRoute() { await requireStorefrontSession("/yeu-thich"); const products = await getProducts().catch(() => []); return <div className="page-shell"><PageHero eyebrow="Wishlist · お気に入り" title="Những thiết kế đã lưu" copy="Danh sách này được đồng bộ giữa app và website theo tài khoản của bạn." /><WishlistPage products={products} /></div>; }
