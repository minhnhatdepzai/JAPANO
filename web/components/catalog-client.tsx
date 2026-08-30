"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { ProductRail } from "@/components/product-rail";
import type { Category, Product } from "@/lib/types";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();

export function CatalogClient({ products, categories, defaultSort = "featured", defaultCategory = "" }: { products: Product[]; categories: Category[]; defaultSort?: string; defaultCategory?: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState(params.get("q") || "");
  const deferredQuery = useDeferredValue(query);
  const category = params.get("danh-muc") || defaultCategory;
  const sort = params.get("sap-xep") || defaultSort;

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  const filtered = useMemo(() => {
    const needle = normalize(deferredQuery.trim());
    const next = products.filter((product) => {
      const matchesCategory = !category || [product.cat, product.category].includes(category);
      const haystack = normalize([product.name, product.kanji, product.desc, ...(product.tags || [])].filter(Boolean).join(" "));
      return matchesCategory && (!needle || haystack.includes(needle));
    });
    return next.sort((left, right) => {
      if (sort === "price-asc") return left.price - right.price;
      if (sort === "price-desc") return right.price - left.price;
      if (sort === "newest") return Number(right.publishedAt || right.createdAt || 0) - Number(left.publishedAt || left.createdAt || 0);
      if (sort === "best-selling") return Number(right.sold || 0) - Number(left.sold || 0) || Number(right.rating || 0) - Number(left.rating || 0);
      return Number(right.sold || 0) + Number(right.rating || 0) - Number(left.sold || 0) - Number(left.rating || 0);
    });
  }, [products, category, sort, deferredQuery]);

  const reset = () => { setQuery(""); startTransition(() => router.replace(pathname, { scroll: false })); };
  return <>
    <div className="catalog-toolbar">
      <label className="search-field"><Search aria-hidden="true" /><span className="sr-only">Tìm trong sản phẩm</span><input name="q" autoComplete="off" placeholder="Tìm kimono, haori, phụ kiện…" value={query} onChange={(event) => { setQuery(event.target.value); update({ q: event.target.value }); }} />{query && <button aria-label="Xóa từ khóa" onClick={() => { setQuery(""); update({ q: "" }); }}><X aria-hidden="true" /></button>}</label>
      <label><SlidersHorizontal aria-hidden="true" /><span>Danh mục</span><select aria-label="Lọc danh mục" value={category} onChange={(event) => update({ "danh-muc": event.target.value })}><option value="">Tất cả</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label><span>Sắp xếp</span><select aria-label="Sắp xếp sản phẩm" value={sort} onChange={(event) => update({ "sap-xep": event.target.value })}><option value="featured">Nổi bật</option><option value="newest">Mới nhất</option><option value="best-selling">Bán chạy</option><option value="price-asc">Giá thấp đến cao</option><option value="price-desc">Giá cao đến thấp</option></select></label>
      <button className="reset-button" onClick={reset}>Đặt lại</button>
    </div>
    <div className="result-summary" aria-live="polite"><span>{filtered.length} thiết kế</span><p>{category ? `Đang xem ${categories.find((item) => item.id === category)?.name || category}` : "Toàn bộ catalog đang bán"}{query ? ` · khớp “${query}”` : ""}</p></div>
    <ProductRail products={filtered} empty="Không tìm thấy thiết kế phù hợp. Hãy đặt lại bộ lọc hoặc thử từ khóa khác." />
  </>;
}
