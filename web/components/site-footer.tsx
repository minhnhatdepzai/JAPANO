import Link from "next/link";
import type { Shop } from "@/lib/types";

export function SiteFooter({ shop }: { shop?: Partial<Shop> }) {
  return <footer className="site-footer">
    <div className="footer-mark"><span>日本の余白</span><strong>JAPANO</strong><p>Thời trang Nhật Bản cho nhịp sống Việt Nam.</p></div>
    <div><h2>Mua sắm</h2><Link href="/hang-moi">Hàng mới</Link><Link href="/ban-chay">Bán chạy</Link><Link href="/san-pham">Tất cả sản phẩm</Link><Link href="/thu-do">Thử đồ AI</Link></div>
    <div><h2>Trải nghiệm</h2><Link href="/du-lich-nhat-ban">Đến Nhật Bản</Link><Link href="/cua-hang">Cửa hàng JAPANO</Link><Link href="/chinh-sach/giao-hang">Giao hàng</Link><Link href="/chinh-sach/doi-tra">Đổi trả</Link></div>
    <div><h2>Liên hệ</h2><a href={`tel:${shop?.hotline || "19006868"}`}>{shop?.hotline || "1900 6868"}</a><a href={`mailto:${shop?.email || "shop@japano.vn"}`}>{shop?.email || "shop@japano.vn"}</a><p>{shop?.locations?.[0]?.address || shop?.address || "TP Hồ Chí Minh"}</p></div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} JAPANO Shop</span><span>Thiết kế tại Việt Nam · Cảm hứng Nhật Bản</span></div>
  </footer>;
}
