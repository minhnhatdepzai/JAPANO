"use client";

import { MapPin, Navigation, Search } from "lucide-react";
import { useState } from "react";
import type { ShopLocation } from "@/lib/types";

const GOOGLE_MAP_EMBED_URL = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3918.4437742585214!2d106.62343057693965!3d10.853812489299761!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752b6c59ba4c97%3A0x535e784068f1558b!2zVHLGsOG7nW5nIENhbyDEkeG6s25nIEZQVCBQb2x5dGVjaG5pYw!5e0!3m2!1svi!2s!4v1788069300059!5m2!1svi!2s";

export function StoreMap({ locations }: { locations: ShopLocation[] }) {
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const visible = locations.filter((location) => location.active !== false && `${location.name} ${location.address}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="store-locator">
    <section className="store-list"><label className="search-field"><Search aria-hidden="true" /><span className="sr-only">Tìm cửa hàng theo địa chỉ</span><input type="search" name="store-query" autoComplete="street-address" placeholder="Tìm theo địa chỉ…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>{visible.map((location) => <article key={location.id} className="store-card"><div className="store-index"><MapPin aria-hidden="true" /></div><div><span className="eyebrow">JAPANO Store</span><h2>{location.name}</h2><p>{location.address}</p><dl><div><dt>Giờ mở cửa</dt><dd>{location.openingHours || "Liên hệ trước khi đến"}</dd></div><div><dt>Hotline</dt><dd><a href={`tel:${location.phone}`}>{location.phone}</a></dd></div></dl><ul>{location.services?.map((service) => <li key={service}>{service}</li>)}</ul><div className="button-row"><a className="button secondary" href={`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer"><Navigation aria-hidden="true" />Chỉ đường</a></div></div></article>)}{visible.length === 0 && <div className="empty-rail">Không có địa điểm khớp từ khóa.</div>}</section>
    <section className="map-panel" aria-label="Bản đồ cửa hàng JAPANO">{loaded ? <iframe className="map-embed" src={GOOGLE_MAP_EMBED_URL} width="600" height="450" title="Bản đồ Trường Cao đẳng FPT Polytechnic và JAPANO Store" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /> : <div className="map-prompt"><div className="map-grid-art" aria-hidden="true"><span /></div><MapPin aria-hidden="true" /><h2>Bản đồ chỉ tải khi bạn cần</h2><p>Tiết kiệm dữ liệu và giữ trang mua sắm phản hồi nhanh.</p><button className="button primary" onClick={() => setLoaded(true)}>Mở bản đồ tương tác</button></div>}</section>
  </div>;
}
