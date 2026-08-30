"use client";

import Link from "next/link";
import { Heart, Menu, Search, ShoppingBag, UserRound, X, Minus, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { useStore } from "@/components/store-provider";

const nav = [
  { href: "/san-pham", label: "Sản phẩm" },
  { href: "/hang-moi", label: "Hàng mới" },
  { href: "/ban-chay", label: "Bán chạy" },
  { href: "/thu-do", label: "Thử đồ AI" },
  { href: "/du-lich-nhat-ban", label: "Đến Nhật" },
  { href: "/cua-hang", label: "Cửa hàng" },
];

function CartDrawer() {
  const { cartOpen, setCartOpen, items, count, subtotal, updateQuantity, removeItem } = useStore();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!cartOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setCartOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.classList.add("drawer-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("drawer-open");
      previous?.focus?.();
    };
  }, [cartOpen, setCartOpen]);

  return <AnimatePresence>
    {cartOpen && <>
      <motion.button className="drawer-backdrop" aria-label="Đóng giỏ hàng" onClick={() => setCartOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
        <div className="drawer-head"><div><span className="eyebrow">Giỏ hàng</span><h2 id="cart-title">{count} sản phẩm</h2></div><button ref={closeRef} className="icon-button" aria-label="Đóng giỏ hàng" onClick={() => setCartOpen(false)}><X aria-hidden="true" /></button></div>
        <div className="drawer-items">
          {items.length === 0 ? <div className="empty-state"><ShoppingBag aria-hidden="true" /><h3>Giỏ hàng đang trống</h3><p>Chọn một thiết kế JAPANO để bắt đầu.</p><Link className="button secondary" href="/san-pham" onClick={() => setCartOpen(false)}>Khám phá sản phẩm</Link></div> : items.map((item) => <article className="cart-line" key={item.key}>
            <img src={item.image} width="88" height="110" alt={item.name} />
            <div className="cart-line-copy"><Link href={`/san-pham/${item.slug}`} onClick={() => setCartOpen(false)}>{item.name}</Link><p>{item.color} · {item.size}</p><strong>{formatCurrency(item.price)}</strong><div className="quantity"><button aria-label={`Giảm số lượng ${item.name}`} onClick={() => updateQuantity(item.key, item.quantity - 1)}><Minus aria-hidden="true" /></button><span aria-live="polite">{item.quantity}</span><button aria-label={`Tăng số lượng ${item.name}`} onClick={() => updateQuantity(item.key, item.quantity + 1)}><Plus aria-hidden="true" /></button><button className="remove" onClick={() => removeItem(item.key)}>Xóa</button></div></div>
          </article>)}
        </div>
        {items.length > 0 && <div className="drawer-total"><div><span>Tạm tính</span><strong>{formatCurrency(subtotal)}</strong></div><p>Phí giao hàng và ưu đãi được tính ở bước thanh toán.</p><Link className="button primary full" href="/thanh-toan" onClick={() => setCartOpen(false)}>Tiến hành thanh toán</Link><Link className="text-link center" href="/gio-hang" onClick={() => setCartOpen(false)}>Xem giỏ hàng đầy đủ</Link></div>}
      </motion.aside>
    </>}
  </AnimatePresence>;
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { count, wishlist, setCartOpen } = useStore();
  return <>
    <div className="announcement">Miễn phí đổi size trong 7 ngày · AI thử đồ dùng ảnh riêng tư, không lưu lâu dài</div>
    <header className="site-header" style={{ viewTransitionName: "persistent-nav" }}>
      <div className="header-shell">
        <button className="icon-button mobile-menu-button" aria-label={menuOpen ? "Đóng trình đơn" : "Mở trình đơn"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
        <nav className="desktop-nav" aria-label="Điều hướng chính">{nav.slice(0, 3).map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
        {/* Không đặt aria-label: WCAG 2.5.3 yêu cầu tên khả truy cập chứa đúng chữ
            nhìn thấy. Để tên tự sinh từ nội dung, phần bổ nghĩa nằm trong span ẩn. */}
        <Link href="/" className="brand"><img className="brand-mark" src="/media/assets/brand/japano-monogram.png" width="827" height="759" alt="" fetchPriority="high" /><span className="brand-type"><strong>JAPANO</strong><small>Thời trang Nhật Bản</small></span><span className="sr-only">— Trang chủ</span></Link>
        <nav className="desktop-nav right" aria-label="Tính năng JAPANO">{nav.slice(3).map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
        <div className="header-actions">
          <Link className="icon-button" href="/tim-kiem" aria-label="Tìm kiếm"><Search aria-hidden="true" /></Link>
          <Link className="icon-button badge-button" href="/yeu-thich" aria-label={`Yêu thích, ${wishlist.length} sản phẩm`}><Heart aria-hidden="true" />{wishlist.length > 0 && <span>{wishlist.length}</span>}</Link>
          <Link className="icon-button desktop-account" href="/tai-khoan" aria-label="Tài khoản"><UserRound aria-hidden="true" /></Link>
          <button className="icon-button badge-button" data-cart-target aria-label={`Mở giỏ hàng, ${count} sản phẩm`} onClick={() => setCartOpen(true)}><ShoppingBag aria-hidden="true" />{count > 0 && <motion.span key={count} initial={{ scale: 0.6 }} animate={{ scale: 1 }}>{count}</motion.span>}</button>
        </div>
      </div>
      <AnimatePresence>{menuOpen && <motion.nav className="mobile-nav" aria-label="Điều hướng di động" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>{nav.map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}<span aria-hidden="true">↗</span></Link>)}<Link href="/tai-khoan" onClick={() => setMenuOpen(false)}>Tài khoản<span aria-hidden="true">↗</span></Link></motion.nav>}</AnimatePresence>
    </header>
    <CartDrawer />
  </>;
}
