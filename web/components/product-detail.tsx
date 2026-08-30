"use client";

import { Check, Heart, ShieldCheck, ShoppingBag, Sparkles, Truck } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { useStore } from "@/components/store-provider";
import { cloudinarySrcSet, cloudinaryUrl, formatCurrency, mediaUrl, productImage } from "@/lib/format";
import { sellableVariants, uniqueColors } from "@/lib/product";
import type { Product } from "@/lib/types";

export function ProductDetail({ product }: { product: Product }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const variants = sellableVariants(product);
  const colors = uniqueColors(variants);
  const [color, setColor] = useState(colors[0]?.colorName || "");
  const sizes = variants.filter((variant) => !color || variant.colorName === color);
  const [size, setSize] = useState(sizes[0]?.size || "");
  const [activeImage, setActiveImage] = useState(0);
  const { addProduct, wishlist, toggleWishlist } = useStore();
  const selected = variants.find((variant) => variant.colorName === color && variant.size === size) || sizes[0];
  const images = (product.images?.length ? product.images : [productImage(product)]).map(mediaUrl);
  const liked = wishlist.includes(product.slug);

  return <div className="pdp-layout">
    <div className="pdp-gallery"><div className="gallery-main"><img ref={imageRef} src={cloudinaryUrl(images[activeImage] || productImage(product), 1200)} srcSet={cloudinarySrcSet(images[activeImage] || productImage(product))} sizes="(max-width: 900px) 100vw, 58vw" width="1080" height="1350" alt={`${product.name} — ảnh ${activeImage + 1}`} fetchPriority="high" style={{ viewTransitionName: `product-image-${product.slug}` }} /></div><div className="gallery-thumbs">{images.map((image, index) => <button key={image} className={index === activeImage ? "active" : ""} aria-label={`Xem ảnh ${index + 1}`} aria-pressed={index === activeImage} onClick={() => setActiveImage(index)}><img src={cloudinaryUrl(image, 220)} width="110" height="138" alt="" loading="lazy" /></button>)}</div></div>
    <aside className="pdp-panel">
      <span className="eyebrow">{product.brand || "JAPANO"} · {product.kanji}</span><h1>{product.name}</h1><div className="pdp-rating"><span>{product.rating ? `★ ${product.rating} (${product.reviewCount || 0})` : "Chưa có đánh giá"}</span>{Number(product.sold || 0) > 0 && <span>Đã bán {product.sold}</span>}</div>
      <div className="pdp-price"><strong>{formatCurrency(product.price)}</strong>{product.old && product.old > product.price && <><del>{formatCurrency(product.old)}</del><span>-{product.discountPercent || Math.round((1 - product.price / product.old) * 100)}%</span></>}</div>
      <p className="pdp-desc">{product.desc || "Thiết kế JAPANO được chọn để dễ phối trong nhịp sống hằng ngày."}</p>
      <fieldset><legend>Màu sắc <strong>{color}</strong></legend><div className="color-options">{colors.map((variant) => <button key={variant.key} aria-label={`Màu ${variant.colorName}`} aria-pressed={color === variant.colorName} className={color === variant.colorName ? "active" : ""} onClick={() => { setColor(variant.colorName); setSize(variants.find((item) => item.colorName === variant.colorName)?.size || ""); }}><span style={{ backgroundColor: variant.colorHex || "#ddd" }} />{variant.colorName}{color === variant.colorName && <Check aria-hidden="true" />}</button>)}</div></fieldset>
      <fieldset><legend>Kích cỡ <LinkSize /></legend><div className="size-options">{sizes.map((variant) => <button key={variant.key} aria-pressed={size === variant.size} className={size === variant.size ? "active" : ""} onClick={() => setSize(variant.size)}>{variant.size}<small>{variant.stock <= 3 ? `Còn ${variant.stock}` : ""}</small></button>)}</div></fieldset>
      <div className="pdp-actions"><motion.button whileTap={{ scale: 0.98 }} className="button primary full" disabled={!selected} onClick={() => selected && addProduct(product, selected, { source: imageRef.current })}><ShoppingBag aria-hidden="true" />{selected ? "Thêm vào giỏ" : "Hết hàng"}</motion.button><button className="icon-button heart-large" aria-label={liked ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"} aria-pressed={liked} onClick={() => toggleWishlist(product.slug)}><Heart aria-hidden="true" fill={liked ? "currentColor" : "none"} /></button></div>
      <a className="button tryon-button full" href={`/thu-do?product=${encodeURIComponent(product.slug)}`}><Sparkles aria-hidden="true" />Thử sản phẩm này trên ảnh của bạn</a>
      <div className="pdp-service"><div><Truck aria-hidden="true" /><span><strong>Giao hàng toàn quốc</strong>Phí tính theo cấu hình cửa hàng</span></div><div><ShieldCheck aria-hidden="true" /><span><strong>Đổi size minh bạch</strong>Xem điều kiện trước khi mua</span></div></div>
      <details open><summary>Câu chuyện thiết kế</summary><p>{product.story || product.desc}</p></details><details><summary>Thông tin size & độ vừa</summary><p>Gợi ý size từ AI là ước lượng có độ tin cậy. Số đo bạn cung cấp luôn được ưu tiên hơn suy luận từ một ảnh.</p></details>
    </aside>
  </div>;
}

function LinkSize() { return <a href="/thu-do">Dùng AI gợi ý size</a>; }
