import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { ProductRail, SectionHeading } from "@/components/product-rail";
import { getProduct, getProducts } from "@/lib/server-api";
import { productImage } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Không tìm thấy sản phẩm" };
  return { title: product.name, description: product.desc, alternates: { canonical: `/san-pham/${product.slug}` }, openGraph: { title: product.name, description: product.desc, images: [{ url: productImage(product), width: 1080, height: 1350, alt: product.name }] } };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, products] = await Promise.all([getProduct(slug), getProducts().catch(() => [])]);
  if (!product) notFound();
  const related = products.filter((item) => item.slug !== product.slug && (item.cat === product.cat || item.tags?.some((tag) => product.tags?.includes(tag)))).slice(0, 4);
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: product.name, image: product.images, description: product.desc, sku: product.id, brand: { "@type": "Brand", name: product.brand || "JAPANO" }, aggregateRating: product.reviewCount ? { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviewCount } : undefined, offers: { "@type": "Offer", priceCurrency: "VND", price: product.price, availability: product.variants?.some((variant) => variant.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4200"}/san-pham/${product.slug}` } };
  return <div className="pdp-shell"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><nav className="breadcrumbs" aria-label="Đường dẫn"><Link href="/">Trang chủ</Link><span>/</span><Link href="/san-pham">Sản phẩm</Link><span>/</span><span aria-current="page">{product.name}</span></nav><ProductDetail product={product} /><section className="section related"><SectionHeading eyebrow="Complete the look" title="Phối tiếp câu chuyện" href="/san-pham" /><ProductRail products={related} /></section></div>;
}
