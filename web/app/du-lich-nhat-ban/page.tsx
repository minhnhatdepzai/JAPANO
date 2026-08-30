import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { getJapanSpots } from "@/lib/server-api";
import { mediaUrl } from "@/lib/format";

export const metadata: Metadata = { title: "Du lịch Nhật Bản", description: "Khám phá địa điểm Nhật và thử sản phẩm JAPANO trực tiếp trong góc chụp phù hợp.", alternates: { canonical: "/du-lich-nhat-ban" } };

export default async function JapanPage() {
  const spots = await getJapanSpots().catch(() => []);
  return <div className="page-shell"><PageHero eyebrow="Japan journal · 日本" title="Mặc JAPANO, đến Nhật Bản" copy="Không chỉ dán người lên ảnh: mỗi địa điểm có vùng đứng, điểm đặt chân và tỉ lệ riêng, kèm nguồn ảnh rõ ràng." aside={<span className="hero-count">{spots.length}<small>địa điểm từ nguồn thật</small></span>} /><div className="destination-grid">{spots.map((spot, index) => <Link className={`destination-card destination-${index % 5}`} href={`/du-lich-nhat-ban/${spot.id}`} key={spot.id}><img src={mediaUrl(spot.photoUrl)} width="960" height="720" alt={`Phong cảnh ${spot.place}, ${spot.prefecture}`} loading={index < 2 ? "eager" : "lazy"} /><div><span><MapPin aria-hidden="true" />{spot.prefecture} · {spot.region}</span><h2>{spot.place}</h2><p>{spot.photoTip || spot.where}</p><strong>Đưa tôi tới đây<ArrowUpRight aria-hidden="true" /></strong></div></Link>)}</div></div>;
}
