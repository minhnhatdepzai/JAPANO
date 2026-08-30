import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TravelExperience } from "@/components/travel-experience";
import { getJapanSpots, getProducts } from "@/lib/server-api";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const spot = (await getJapanSpots().catch(() => [])).find((item) => item.id === slug);
  return spot ? { title: spot.place, description: spot.where, alternates: { canonical: `/du-lich-nhat-ban/${slug}` }, openGraph: { images: [{ url: spot.photoUrl, width: 960, height: 720, alt: spot.place }] } } : { title: "Địa điểm không tồn tại" };
}

export default async function JapanDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [spots, products] = await Promise.all([getJapanSpots().catch(() => []), getProducts().catch(() => [])]);
  const spot = spots.find((item) => item.id === slug);
  if (!spot) notFound();
  return <div className="page-shell wide"><nav className="breadcrumbs" aria-label="Đường dẫn"><Link href="/">Trang chủ</Link><span>/</span><Link href="/du-lich-nhat-ban">Nhật Bản</Link><span>/</span><span aria-current="page">{spot.place}</span></nav><header className="destination-hero"><span className="eyebrow">{spot.prefecture} · {spot.region}</span><h1>{spot.place}</h1><p>{spot.where}</p></header><TravelExperience spot={spot} catalog={products} /><section className="spot-story"><div><span className="eyebrow">Câu chuyện địa điểm</span><h2>Một nơi để mặc đúng, đứng đúng và kể đúng.</h2></div><div><p>{spot.history}</p><ul>{spot.highlights?.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul><p className="source">Nguồn ảnh và thông tin: <a href={spot.sourceUrl} target="_blank" rel="noreferrer">{spot.sourceLabel || spot.sourceUrl}</a></p></div></section></div>;
}
