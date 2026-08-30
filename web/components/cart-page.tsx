"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useStore } from "@/components/store-provider";
import { formatCurrency } from "@/lib/format";

export function CartPage() {
  const { items, subtotal, updateQuantity, removeItem } = useStore();
  if (!items.length) return <div className="empty-state page-empty"><ShoppingBag aria-hidden="true" /><h2>Giỏ hàng đang chờ thiết kế đầu tiên</h2><p>Catalog của JAPANO đang ở ngay một bước phía trước.</p><Link href="/san-pham" className="button primary">Khám phá sản phẩm</Link></div>;
  return <div className="cart-page-layout"><section className="cart-table"><header><h2>{items.length} dòng sản phẩm</h2><span>Giá và tồn kho được kiểm tra lại khi bạn đặt hàng.</span></header>{items.map((item) => <article key={item.key}><img src={item.image} width="130" height="163" alt={item.name} /><div><Link href={`/san-pham/${item.slug}`}>{item.name}</Link><p>{item.color} · Size {item.size}</p><strong>{formatCurrency(item.price)}</strong></div><div className="quantity"><button aria-label={`Giảm ${item.name}`} onClick={() => updateQuantity(item.key, item.quantity - 1)}><Minus aria-hidden="true" /></button><span>{item.quantity}</span><button aria-label={`Tăng ${item.name}`} onClick={() => updateQuantity(item.key, item.quantity + 1)}><Plus aria-hidden="true" /></button></div><strong className="line-total">{formatCurrency(item.price * item.quantity)}</strong><button className="icon-button" aria-label={`Xóa ${item.name}`} onClick={() => removeItem(item.key)}><Trash2 aria-hidden="true" /></button></article>)}</section><aside className="order-summary"><span className="eyebrow">Tóm tắt</span><h2>Đơn hàng của bạn</h2><dl><div><dt>Tạm tính</dt><dd>{formatCurrency(subtotal)}</dd></div><div><dt>Phí giao hàng</dt><dd>Tính ở bước sau</dd></div></dl><p>Mã ưu đãi, khuyến mãi thanh toán và tồn kho được xác thực ở bước thanh toán.</p><Link className="button primary full" href="/thanh-toan">Tiến hành thanh toán</Link><Link className="text-link center" href="/san-pham">Tiếp tục mua sắm</Link></aside></div>;
}
