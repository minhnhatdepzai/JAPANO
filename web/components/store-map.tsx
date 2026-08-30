"use client";

import { MapPin, Navigation, Search } from "lucide-react";
import { useState } from "react";
import { GOOGLE_MAP_EMBED_URL } from "@/lib/google-map";
import type { ShopLocation } from "@/lib/types";

export function StoreMap({ locations }: { locations: ShopLocation[] }) {
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const visible = locations.filter((location) => location.active !== false && `${location.name} ${location.address}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="store-locator">
    <section className="store-list"><label className="search-field"><Search aria-hidden="true" /><span className="sr-only">Tìm cửa hàng theo địa chỉ</span><input type="search" name="store-query" autoComplete="street-address" placeholder="Tìm theo địa chỉ…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>{visible.map((location) => <article key={location.id} className="store-card"><div className="store-index"><MapPin aria-hidden="true" /></div><div><span className="eyebrow">JAPANO Store</span><h2>{location.name}</h2><p>{location.address}</p><dl><div><dt>Giờ mở cửa</dt><dd>{location.openingHours || "Liên hệ trước khi đến"}</dd></div><div><dt>Hotline</dt><dd><a href={`tel:${location.phone}`}>{location.phone}</a></dd></div></dl><ul>{location.services?.map((service) => <li key={service}>{service}</li>)}</ul><div className="button-row"><a className="button secondary" href={`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer"><Navigation aria-hidden="true" />Chỉ đường</a></div></div></article>)}{visible.length === 0 && <div className="empty-rail">Không có địa điểm khớp từ khóa.</div>}</section>
    <section className="map-panel" aria-label="Bản đồ cửa hàng JAPANO">{loaded ? <iframe className="map-embed" src={GOOGLE_MAP_EMBED_URL} width="600" height="450" title="Bản đồ Trường Cao đẳng FPT Polytechnic và JAPANO Store" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /> : <div className="map-prompt"><div className="map-grid-art" aria-hidden="true"><span /></div><MapPin aria-hidden="true" /><h2>Bản đồ chỉ tải khi bạn cần</h2><p>Tiết kiệm dữ liệu và giữ trang mua sắm phản hồi nhanh.</p><button className="button primary" onClick={() => setLoaded(true)}>Mở bản đồ tương tác</button></div>}</section>
  </div>;
}
