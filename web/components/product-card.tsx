"use client";

import { Heart, ShoppingBag, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useRef } from "react";
import { useStore } from "@/components/store-provider";
import { cloudinarySrcSet, cloudinaryUrl, formatCurrency, productHoverImage, productImage } from "@/lib/format";
import { sellableVariants, totalStock, uniqueColors } from "@/lib/product";
import type { Product } from "@/lib/types";

const catalogLoadedAt = Date.now();

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const { addProduct, wishlist, toggleWishlist } = useStore();
  const variants = sellableVariants(product);
  const stock = totalStock(variants);
  const main = productImage(product);
  const hover = productHoverImage(product);
  const hasHoverImage = hover !== main;
  const liked = wishlist.includes(product.slug);
  const isNew = Boolean(product.createdAt && catalogLoadedAt - Number(product.createdAt) < 45 * 86400000);
  const label = stock === 0 ? "Hết hàng" : stock <= 5 ? "Sắp hết" : Number(product.sold || 0) > 0 ? "Bán chạy" : isNew ? "Mới" : "";

  const quickAdd = () => {
    if (!variants[0]) return;
    addProduct(product, variants[0], { source: imageRef.current });
  };

  return <motion.article className={`product-card${hasHoverImage ? " has-hover-image" : ""}`} layout initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.38 }}>
    <div className="product-visual">
      <a href={`/san-pham/${product.slug}`} aria-label={`Xem ${product.name}`}>
        <img ref={imageRef} className="product-image primary-image" src={cloudinaryUrl(main, 840)} srcSet={cloudinarySrcSet(main)} sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw" width="720" height="900" alt={product.name} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} style={{ viewTransitionName: `product-image-${product.slug}` }} />
        {hasHoverImage && <img className="product-image hover-image" src={cloudinaryUrl(hover, 840)} srcSet={cloudinarySrcSet(hover)} sizes="(max-width: 700px) 50vw, 25vw" width="720" height="900" alt="" loading="lazy" />}
      </a>
      {label && <span className={`product-label ${label === "Sắp hết" ? "low" : ""}`}>{label}</span>}
      <button className={`wishlist-button ${liked ? "active" : ""}`} aria-label={liked ? `Bỏ ${product.name} khỏi yêu thích` : `Thêm ${product.name} vào yêu thích`} aria-pressed={liked} onClick={() => toggleWishlist(product.slug)}><Heart aria-hidden="true" fill={liked ? "currentColor" : "none"} /></button>
      <div className="quick-actions">
        <button onClick={quickAdd} disabled={!variants[0]}><ShoppingBag aria-hidden="true" />{variants[0] ? `Thêm nhanh · ${variants[0].size}` : "Hết hàng"}</button>
        <a href={`/thu-do?product=${encodeURIComponent(product.slug)}`}><Sparkles aria-hidden="true" />Thử ngay</a>
      </div>
    </div>
    <div className="product-copy">
      <div><a className="product-name" href={`/san-pham/${product.slug}`}>{product.name}</a>{product.kanji && <span className="product-kanji">{product.kanji}</span>}</div>
      <div className="price-line"><strong>{formatCurrency(product.price)}</strong>{product.old && product.old > product.price ? <del>{formatCurrency(product.old)}</del> : null}</div>
      <div className="product-meta"><span>{product.rating ? `★ ${product.rating}` : "Chưa có đánh giá"}</span>{Number(product.sold || 0) > 0 && <span>Đã bán {product.sold}</span>}</div>
      <ul className="swatches" aria-label="Màu đang có">{uniqueColors(variants).slice(0, 5).map((variant) => <li key={variant.key} title={variant.colorName} style={{ backgroundColor: variant.colorHex || "#ddd" }} />)}</ul>
    </div>
  </motion.article>;
}
