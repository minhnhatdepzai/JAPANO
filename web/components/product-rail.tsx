import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/types";

export function SectionHeading({ eyebrow, title, copy, href, linkLabel = "Xem tất cả" }: { eyebrow: string; title: string; copy?: string; href?: string; linkLabel?: string }) {
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{copy && <p>{copy}</p>}</div>{href && <Link className="text-link" href={href}>{linkLabel}<ArrowUpRight aria-hidden="true" /></Link>}</div>;
}

export function ProductRail({ products, empty = "Chưa có sản phẩm phù hợp." }: { products: Product[]; empty?: string }) {
  if (!products.length) return <div className="empty-rail">{empty}</div>;
  return <div className="product-grid">{products.map((product, index) => <ProductCard key={product.slug} product={product} priority={index < 2} />)}</div>;
}
