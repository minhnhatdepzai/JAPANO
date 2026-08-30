"use client";

import Link from "next/link";
import { LogOut, PackageCheck, RefreshCw, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { api, postJson } from "@/lib/client-api";
import { formatCurrency, formatDate } from "@/lib/format";

type User = { id: string; name?: string; email?: string; role?: string; vip?: string };
type Order = { id: string; code: string; total: number; status: string; createdAt: number; items?: Array<{ name?: string; slug?: string; qty?: number }> };

export function AccountOverview() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api<{ user?: User }>("/api/auth/me", { timeoutMs: 10_000 }).then((data) => setUser(data.user || null)).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  const logout = async () => { await postJson("/api/auth/logout", {}, 8_000); window.location.assign("/"); };
  if (loading) return <div className="account-loading">Đang kiểm tra phiên đăng nhập…</div>;
  if (!user) return <div className="empty-state page-empty"><UserRound aria-hidden="true" /><h2>Bạn chưa đăng nhập</h2><p>Đăng nhập để đồng bộ giỏ hàng, wishlist và theo dõi đơn trên app lẫn website.</p><Link className="button primary" href="/dang-nhap">Đăng nhập</Link></div>;
  return <div className="account-grid"><section className="account-profile"><div className="avatar">{String(user.name || user.email || "J").charAt(0).toUpperCase()}</div><span className="eyebrow">Tài khoản JAPANO</span><h2>{user.name || "Khách hàng"}</h2><p>{user.email}</p><span className="member-chip">{user.vip || "Thành viên"}</span><button className="button secondary" onClick={logout}><LogOut aria-hidden="true" />Đăng xuất</button></section><section className="account-links"><Link href="/tai-khoan/don-hang"><PackageCheck aria-hidden="true" /><span><strong>Đơn hàng</strong><small>Theo dõi mua hàng từ cùng backend</small></span></Link><Link href="/tai-khoan/doi-tra"><RefreshCw aria-hidden="true" /><span><strong>Đổi & trả</strong><small>Điều kiện và trạng thái minh bạch</small></span></Link><Link href="/yeu-thich"><span className="link-glyph">♡</span><span><strong>Yêu thích</strong><small>Những thiết kế bạn đã lưu</small></span></Link><Link href="/thu-do"><span className="link-glyph">試</span><span><strong>Thử đồ AI</strong><small>Không lưu ảnh cá nhân lâu dài</small></span></Link></section></div>;
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "login" | "error">("loading");
  useEffect(() => { api<Order[]>("/api/orders", { timeoutMs: 10_000 }).then((data) => { setOrders(Array.isArray(data) ? data : []); setStatus("ready"); }).catch((error: any) => setStatus(error?.status === 401 ? "login" : "error")); }, []);
  if (status === "loading") return <div className="account-loading">Đang tải đơn hàng…</div>;
  if (status === "login") return <div className="empty-rail">Bạn cần <Link href="/dang-nhap">đăng nhập</Link> để xem đơn hàng.</div>;
  if (status === "error") return <div className="error-banner compact"><div><strong>Chưa tải được đơn hàng</strong><p>Hãy kiểm tra backend rồi tải lại trang.</p></div></div>;
  if (!orders.length) return <div className="empty-state page-empty"><PackageCheck aria-hidden="true" /><h2>Chưa có đơn hàng</h2><p>Khi mua trên app hoặc website, đơn sẽ xuất hiện tại đây.</p><Link href="/san-pham" className="button primary">Bắt đầu mua sắm</Link></div>;
  return <div className="orders-list">{orders.map((order) => <article key={order.id}><header><div><span>#{order.code}</span><strong>{formatDate(order.createdAt)}</strong></div><span className={`order-status status-${order.status}`}>{order.status}</span></header><div><p>{order.items?.map((item) => `${item.name || item.slug} ×${item.qty || 1}`).join(" · ")}</p><strong>{formatCurrency(order.total)}</strong></div><Link className="text-link" href={`/tai-khoan/doi-tra?order=${order.id}`}>Xem đổi trả</Link></article>)}</div>;
}
