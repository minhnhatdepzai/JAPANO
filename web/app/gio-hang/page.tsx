import type { Metadata } from "next";
import { CartPage } from "@/components/cart-page";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = { title: "Giỏ hàng", robots: { index: false, follow: false } };
export default function CartRoute() { return <div className="page-shell"><PageHero eyebrow="Shopping bag · 買物" title="Giỏ hàng" copy="Giỏ hàng được giữ trên thiết bị này và hợp nhất vào tài khoản khi bạn đăng nhập." /><CartPage /></div>; }
