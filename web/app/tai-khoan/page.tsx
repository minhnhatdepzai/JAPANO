import type { Metadata } from "next";
import { AccountOverview } from "@/components/account-pages";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = { title: "Tài khoản", robots: { index: false, follow: false } };
export default function AccountPage() { return <div className="page-shell"><PageHero eyebrow="My JAPANO · 私" title="Không gian của bạn" copy="Đơn hàng, wishlist và trải nghiệm mua sắm trên cùng một backend." /><AccountOverview /></div>; }
