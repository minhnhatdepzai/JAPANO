import Link from "next/link";

export default function ProductNotFound() {
  return <div className="not-found"><span className="eyebrow">404 · 商品なし</span><h1>Thiết kế này không còn trên kệ.</h1><p>Sản phẩm có thể đã ẩn, ngừng bán hoặc đường dẫn chưa đúng.</p><Link className="button primary" href="/san-pham">Trở lại catalog</Link></div>;
}
