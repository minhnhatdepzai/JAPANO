import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { WishlistPage } from "@/components/wishlist-page";
import { getProducts } from "@/lib/server-api";

export const metadata: Metadata = { title: "Yêu thích", robots: { index: false, follow: true } };
export default async function WishlistRoute() { const products = await getProducts().catch(() => []); return <div className="page-shell"><PageHero eyebrow="Wishlist · お気に入り" title="Những thiết kế đã lưu" copy="Đăng nhập để đồng bộ danh sách này giữa app và website." /><WishlistPage products={products} /></div>; }
