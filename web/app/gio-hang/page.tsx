import type { Metadata } from "next";
import { CartPage } from "@/components/cart-page";
import { PageHero } from "@/components/page-hero";
import { requireStorefrontSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Giỏ hàng", robots: { index: false, follow: false } };
export default async function CartRoute() { await requireStorefrontSession("/gio-hang"); return <div className="page-shell"><PageHero eyebrow="Shopping bag · 買物" title="Giỏ hàng" copy="Giỏ hàng thuộc tài khoản của bạn và được đồng bộ giữa app với website." /><CartPage /></div>; }
