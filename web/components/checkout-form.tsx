"use client";

import { Check, LoaderCircle, LockKeyhole, ShoppingBag, TicketPercent } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { postJson } from "@/lib/client-api";
import { useStore } from "@/components/store-provider";
import { checkoutSchema } from "@/lib/schemas";
import { formatCurrency } from "@/lib/format";
import { playOrderSuccess } from "@/lib/motion-events";
import type { Shop } from "@/lib/types";

type Values = { name: string; phone: string; address: string; paymentMethod: "COD" | "stripe" | "vnpay" };

function createClientRequestId() {
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CheckoutForm({ shop }: { shop: Shop }) {
  const router = useRouter();
  const { items, subtotal, clearCart } = useStore();
  const [voucher, setVoucher] = useState("");
  const [discount, setDiscount] = useState(0);
  const [voucherMessage, setVoucherMessage] = useState("");
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, control, setError, formState: { errors, isSubmitting } } = useForm<Values>({ defaultValues: { paymentMethod: "COD" } });
  const method = useWatch({ control, name: "paymentMethod" }) || "COD";
  const ship = Number(shop.shipFee || 0);
  const total = Math.max(0, subtotal - discount + ship);

  const validateVoucher = async () => {
    setVoucherMessage("");
    try {
      // Gửi cả dòng hàng: mã chỉ-đúng-một-sản-phẩm cần biết giỏ có gì, nếu
      // không máy chủ fail closed và từ chối mã. Giá vẫn do máy chủ tính lại.
      const result = await postJson<{ discount: number; voucher?: { code?: string } }>(
        "/api/vouchers/validate",
        { code: voucher, subtotal, items: items.map((item) => ({ slug: item.slug, productId: item.productId, colorName: item.color, size: item.size, qty: item.quantity })) },
        10_000,
      );
      setDiscount(Number(result.discount || 0)); setVoucherMessage(`Đã áp dụng ${result.voucher?.code || voucher}.`);
    } catch (error) { setDiscount(0); setVoucherMessage(error instanceof Error ? error.message : "Voucher không hợp lệ."); }
  };

  const submit = handleSubmit(async (values) => {
    setServerError("");
    const parsed = checkoutSchema.safeParse(values);
    if (!parsed.success) { parsed.error.issues.forEach((issue) => setError(issue.path[0] as keyof Values, { message: issue.message })); return; }
    const payload = { clientRequestId: createClientRequestId(), customer: { name: values.name, phone: values.phone }, address: values.address, paymentMethod: values.paymentMethod, voucherCode: voucher.trim() || undefined, items: items.map((item) => ({ slug: item.slug, productId: item.productId, name: item.name, colorName: item.color, size: item.size, qty: item.quantity })) };
    try {
      if (method === "stripe") {
        const response = await postJson<{ url?: string }>("/api/stripe/checkout-session", payload, 40_000);
        if (!response.url) throw new Error("Stripe chưa trả URL thanh toán."); window.location.assign(response.url); return;
      }
      if (method === "vnpay") {
        const response = await postJson<{ paymentUrl?: string }>("/api/vnpay/payment-url", payload, 40_000);
        if (!response.paymentUrl) throw new Error("VNPay chưa trả URL thanh toán."); window.location.assign(response.paymentUrl); return;
      }
      const response = await postJson<{ order?: { id?: string } }>("/api/orders", payload, 30_000);
      await playOrderSuccess(response.order?.id);
      clearCart(); router.push(response.order?.id ? `/tai-khoan/don-hang?order=${response.order.id}` : "/tai-khoan/don-hang");
    } catch (error: any) {
      setServerError(error?.status === 401 ? "Bạn cần đăng nhập trước khi đặt hàng. Giỏ hàng vẫn được giữ nguyên." : error instanceof Error ? error.message : "Chưa tạo được đơn hàng.");
    }
  });

  // Giỏ trống ở bước thanh toán từng là một khung gạch đứt không có lối ra: không
  // biểu tượng, không tiêu đề, không nút nào để đi tiếp. Năm chỗ trống khác trong
  // storefront (giỏ hàng, wishlist, tài khoản, đơn hàng, ngăn kéo giỏ) đều dùng
  // .empty-state page-empty kèm một CTA, nên dùng lại đúng mẫu đó thay vì tự chế.
  if (!items.length) return <div className="empty-state page-empty"><ShoppingBag aria-hidden="true" /><h2>Chưa có gì để thanh toán</h2><p>Giỏ hàng đang trống. Chọn một thiết kế JAPANO rồi quay lại bước này.</p><Link href="/san-pham" className="button primary">Khám phá sản phẩm</Link></div>;
  return <form className="checkout-layout" onSubmit={submit} noValidate><section className="checkout-form"><div className="checkout-block"><span className="eyebrow">01 · Người nhận</span><label><span>Họ và tên</span><input autoComplete="name" placeholder="Nguyễn Minh Anh…" {...register("name")} />{errors.name && <small role="alert">{errors.name.message}</small>}</label><label><span>Số điện thoại</span><input type="tel" inputMode="tel" autoComplete="tel" placeholder="0901 234 567…" {...register("phone")} />{errors.phone && <small role="alert">{errors.phone.message}</small>}</label><label><span>Địa chỉ giao hàng</span><textarea autoComplete="street-address" placeholder="Số nhà, đường, phường/xã, tỉnh/thành…" {...register("address")} />{errors.address && <small role="alert">{errors.address.message}</small>}</label></div><div className="checkout-block"><span className="eyebrow">02 · Thanh toán</span><div className="payment-options">{shop.cod && <label><input type="radio" value="COD" {...register("paymentMethod")} /><span><strong>Thanh toán khi nhận hàng</strong><small>COD · xác nhận đơn ngay</small></span></label>}{shop.stripe && <label><input type="radio" value="stripe" {...register("paymentMethod")} /><span><strong>Thẻ quốc tế qua Stripe</strong><small>Chuyển sang Stripe Checkout bảo mật</small></span></label>}{shop.vnpay && <label><input type="radio" value="vnpay" {...register("paymentMethod")} /><span><strong>VNPay</strong><small>QR, ATM nội địa và ví hỗ trợ</small></span></label>}</div></div></section><aside className="order-summary checkout-summary"><span className="eyebrow">Đơn của bạn</span>{items.map((item) => <div className="checkout-line" key={item.key}><img src={item.image} width="64" height="80" alt="" /><span><strong>{item.name}</strong><small>{item.color} · {item.size} · ×{item.quantity}</small></span><b>{formatCurrency(item.price * item.quantity)}</b></div>)}<div className="voucher-field"><label htmlFor="voucher"><TicketPercent aria-hidden="true" />Voucher</label><div><input id="voucher" name="voucher" autoComplete="off" placeholder="Nhập mã…" value={voucher} onChange={(event) => setVoucher(event.target.value.toUpperCase())} /><button type="button" onClick={validateVoucher} disabled={!voucher.trim()}>Áp dụng</button></div>{voucherMessage && <small aria-live="polite">{discount > 0 && <Check aria-hidden="true" />}{voucherMessage}</small>}</div><dl><div><dt>Tạm tính</dt><dd>{formatCurrency(subtotal)}</dd></div>{discount > 0 && <div><dt>Ưu đãi</dt><dd>-{formatCurrency(discount)}</dd></div>}<div><dt>Giao hàng</dt><dd>{formatCurrency(ship)}</dd></div><div className="grand-total"><dt>Tổng cộng</dt><dd>{formatCurrency(total)}</dd></div></dl>{serverError && <p className="form-error" role="alert">{serverError}</p>}<button className="button primary full" disabled={isSubmitting}>{isSubmitting ? <LoaderCircle className="spin" aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}{method === "COD" ? "Đặt hàng COD" : method === "stripe" ? "Tiếp tục với Stripe" : "Tiếp tục với VNPay"}</button><p className="secure-copy">Giá, mã ưu đãi, size và tồn kho được kiểm tra lại một lần nữa trước khi đơn được tạo.</p></aside></form>;
}
