import type { Metadata } from "next";
import { OrdersPage } from "@/components/account-pages";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = { title: "Đơn hàng", robots: { index: false, follow: false } };
export default function AccountOrdersPage() { return <div className="page-shell"><PageHero eyebrow="Orders · 注文" title="Đơn hàng của bạn" copy="Đơn đặt trên ứng dụng và trên website đều hiện ở đây." /><OrdersPage /></div>; }
