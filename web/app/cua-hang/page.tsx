import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { StoreMap } from "@/components/store-map";
import { getShop } from "@/lib/server-api";

export const metadata: Metadata = { title: "Cửa hàng JAPANO", description: "Vị trí, hotline và bản đồ chỉ đường đến JAPANO Store tại QTSC9.", alternates: { canonical: "/cua-hang" } };

export default async function StoresPage() {
  const shop = await getShop().catch(() => null);
  const locations = (shop?.locations || []).filter((location) => location.active !== false);
  const jsonLd = locations.map((location) => ({ "@context": "https://schema.org", "@type": "ClothingStore", name: location.name, address: location.address, telephone: location.phone || shop?.hotline, geo: { "@type": "GeoCoordinates", latitude: location.latitude, longitude: location.longitude }, openingHours: location.openingHours === "Liên hệ trước khi đến" ? undefined : location.openingHours }));
  return <div className="page-shell wide"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><PageHero eyebrow="Store locator · 店舗" title="Gặp JAPANO ngoài màn hình" copy="JAPANO Store nằm trong tòa nhà QTSC9. Bản đồ chỉ tải khi bạn cần, để trang mua sắm luôn nhẹ." /><StoreMap locations={locations} /></div>;
}
