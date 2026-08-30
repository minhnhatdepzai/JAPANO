import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = { title: "Đổi & trả", robots: { index: false, follow: false } };
export default function ReturnsPage() { return <div className="page-shell"><PageHero eyebrow="Returns · 返品" title="Đổi & trả minh bạch" copy="Mỗi bước hiển thị đúng trạng thái thật của yêu cầu, không có tiến trình giả." /><div className="policy-timeline"><div><span>01</span><h2>Chọn đơn & sản phẩm</h2><p>Đơn phải đã giao/hoàn tất và còn trong thời hạn chính sách.</p></div><div><span>02</span><h2>Gửi yêu cầu</h2><p>Chọn số lượng, lý do và ảnh bằng chứng nếu cần.</p></div><div><span>03</span><h2>Gửi hàng về</h2><p>Nhập mã vận đơn chiều về sau khi yêu cầu được duyệt.</p></div><div><span>04</span><h2>Kiểm tra & hoàn tiền</h2><p>Backend phân bổ giảm giá theo từng dòng và hoàn đúng cổng thanh toán.</p></div></div><div className="center-actions"><Link className="button primary" href="/tai-khoan/don-hang">Chọn đơn hàng</Link><Link className="button secondary" href="/chinh-sach/doi-tra">Đọc chính sách đầy đủ</Link></div></div>; }
