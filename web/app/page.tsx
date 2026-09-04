import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Camera, MapPin, RefreshCw, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { FujiCinematic } from "@/components/fuji-cinematic";
import { Hero } from "@/components/hero";
import { ProductRail, SectionHeading } from "@/components/product-rail";
import { ReactBitsFadeContent, ReactBitsSpotlightCard } from "@/components/react-bits-effects";
import { getHome } from "@/lib/server-api";
import { cloudinarySrcSet, cloudinaryUrl, mediaUrl, productImage } from "@/lib/format";
import { GOOGLE_MAP_EMBED_URL } from "@/lib/google-map";
import type { HomePayload } from "@/lib/types";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const emptyHome: HomePayload = { ok: false, shop: { name: "JAPANO Store", hotline: "1900 6868", email: "shop@japano.vn", address: "TP Hồ Chí Minh", shipFee: 30000, cod: true, stripe: true, vnpay: true }, banners: [], categories: [], newArrivals: [], bestSellers: [], featuredProducts: [], featuredJapanSpots: [] };

export default async function HomePage() {
  const home = await getHome().catch(() => emptyHome);
  const categoryImages = new Map(home.featuredProducts.map((product) => [product.cat || product.category || "", productImage(product)]));
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "JAPANO Shop",
    url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4200",
    logo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4200"}/media/assets/brand/japano-logo-transparent.png`,
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }} />
    <Hero />
    {!home.ok && <div className="api-notice">Catalog đang kết nối lại với backend JAPANO. Giao diện vẫn sẵn sàng, hãy tải lại sau ít phút.</div>}

    <section className="section" id="hang-moi"><SectionHeading eyebrow="New arrivals · 新着" title="Những thiết kế vừa chạm kệ" copy="Sắp theo ngày xuất bản thật; dữ liệu cũ thiếu ngày giữ nguyên thứ tự catalog." href="/hang-moi" /><ProductRail products={home.newArrivals.slice(0, 8)} /></section>

    <section className="section ink-section"><div className="ink-orbit" aria-hidden="true" /><SectionHeading eyebrow="Ranking · 人気" title="Được chọn nhiều, không gắn nhãn ngẫu nhiên" copy="Bảng xếp hạng lấy từ đơn hàng thành công, loại trừ dữ liệu demo và admin-test." href="/ban-chay" /><ProductRail products={home.bestSellers.slice(0, 4)} empty="Chưa có đủ đơn hàng thật để xếp hạng bán chạy." /></section>

    <ReactBitsFadeContent as="section" className="section" delay={40}><SectionHeading eyebrow="Category · 装い" title="Chọn theo cách bạn muốn xuất hiện" />
      <div className="category-grid">{home.categories.slice(0, 5).map((category, index) => <Link key={category.id} className={`category-tile tile-${index + 1}`} href={`/san-pham?danh-muc=${category.id}`}>
        {categoryImages.get(category.id) ? <img src={cloudinaryUrl(categoryImages.get(category.id)!, 840)} srcSet={cloudinarySrcSet(categoryImages.get(category.id)!)} sizes="(max-width: 640px) 100vw, (max-width: 1180px) 50vw, 42vw" width="720" height="900" alt="" loading="lazy" /> : <span className="category-paper" aria-hidden="true" />}
        <div><span>{category.kanji || "装"}</span><h3>{category.name}</h3><small>Xem thiết kế<ArrowUpRight aria-hidden="true" /></small></div>
      </Link>)}</div>
    </ReactBitsFadeContent>

    <ReactBitsFadeContent as="section" className="experience-split" blur={false}>
      <div className="tryon-editorial"><span className="eyebrow"><Sparkles aria-hidden="true" /> AI Try-on Studio</span><h2>Thử phom dáng.<br />Giữ chính bạn.</h2><p>Chọn sản phẩm, đưa ảnh rõ người vào và nhận ảnh AI thật. Phân tích số đo thiếu bằng chứng không ngăn bạn thử đồ.</p><ul><li><ShieldCheck aria-hidden="true" />Ảnh cá nhân không đưa vào cache Cloudflare</li><li><Camera aria-hidden="true" />Giữ nguyên danh tính và vóc dáng</li><li><RefreshCw aria-hidden="true" />Tạo chuyển động từ kết quả đạt chất lượng</li></ul><Link className="button light" href="/thu-do">Mở phòng thử đồ<ArrowUpRight aria-hidden="true" /></Link></div>
      <FujiCinematic />
    </ReactBitsFadeContent>

    <ReactBitsFadeContent as="section" className="section travel-home"><SectionHeading eyebrow="Wear JAPANO, visit Japan" title="Mặc JAPANO, đến Nhật Bản" copy="Thử sản phẩm trước, rồi đặt chính kết quả đó vào góc chụp đã duyệt — chân phải chạm đất, cảnh không nuốt mất con người." href="/du-lich-nhat-ban" linkLabel="Khám phá Nhật Bản" />
      <div className="spot-grid">{home.featuredJapanSpots.slice(0, 3).map((spot) => <Link href={`/du-lich-nhat-ban/${spot.id}`} className="spot-card" key={spot.id}><img src={mediaUrl(spot.photoUrl)} width="960" height="720" alt={`Phong cảnh ${spot.place}, ${spot.prefecture}`} loading="lazy" /><div><span>{spot.prefecture} · {spot.region}</span><h3>{spot.place}</h3><p>{spot.photoTip || spot.where}</p><strong>Đưa tôi tới đây<ArrowUpRight aria-hidden="true" /></strong></div></Link>)}</div>
    </ReactBitsFadeContent>

    <section className="editorial-strip"><div><span className="eyebrow">JAPANO journal · 01</span><h2>Ít hơn, nhưng đúng hơn.</h2><p>Một tủ đồ Nhật không bắt đầu bằng việc mua nhiều. Nó bắt đầu bằng câu hỏi: món này có đi cùng cuộc sống thật của bạn không?</p><Link className="text-link light-link" href="/bo-suu-tap/ma">Đọc câu chuyện bộ sưu tập<ArrowUpRight aria-hidden="true" /></Link></div><div className="editorial-glyph" aria-hidden="true">余白</div></section>

    <ReactBitsFadeContent as="section" className="section store-preview" blur={false}><div><span className="eyebrow"><MapPin aria-hidden="true" /> JAPANO Store</span><h2>Chạm vải thật tại QTSC9.</h2><p>{home.shop.locations?.[0]?.address || home.shop.address}</p><p>{home.shop.locations?.[0]?.openingHours || "Liên hệ trước khi đến"} · {home.shop.hotline}</p><Link className="button secondary" href="/cua-hang">Xem bản đồ & chỉ đường</Link></div><div className="store-map-live"><iframe src={GOOGLE_MAP_EMBED_URL} width="600" height="450" title="Google Maps — Trường Cao đẳng FPT Polytechnic và JAPANO Store" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div></ReactBitsFadeContent>

    <section className="service-row" aria-label="Chính sách mua hàng"><ReactBitsSpotlightCard><Truck aria-hidden="true" /><strong>Giao hàng minh bạch</strong><span>Phí được tính trước khi đặt</span></ReactBitsSpotlightCard><ReactBitsSpotlightCard><RefreshCw aria-hidden="true" /><strong>Đổi size trong 7 ngày</strong><span>Theo điều kiện công bố</span></ReactBitsSpotlightCard><ReactBitsSpotlightCard><ShieldCheck aria-hidden="true" /><strong>Thanh toán bảo vệ</strong><span>COD, Stripe và VNPay theo cấu hình thật</span></ReactBitsSpotlightCard></section>
  </>;
}
