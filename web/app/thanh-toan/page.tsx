import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
import { PageHero } from "@/components/page-hero";
import { getShop } from "@/lib/server-api";
import { requireStorefrontSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Thanh toán", robots: { index: false, follow: false } };
export default async function CheckoutPage() { await requireStorefrontSession("/thanh-toan"); const shop = await getShop(); return <div className="page-shell"><PageHero eyebrow="Checkout · 会計" title="Thanh toán an toàn" copy="Giá, mã ưu đãi, tồn kho và tổng tiền đều được tính lại trước khi đơn được tạo." /><CheckoutForm shop={shop} /></div>; }
