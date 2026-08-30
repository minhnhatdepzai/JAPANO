import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { TryOnStudio } from "@/components/tryon-studio";
import { getProducts } from "@/lib/server-api";

export const metadata: Metadata = { title: "Thử đồ AI", description: "Thử sản phẩm JAPANO trên ảnh thật, nhận gợi ý size có bằng chứng và tạo video chuyển động.", alternates: { canonical: "/thu-do" }, robots: { index: true, follow: true } };

export default async function TryOnPage() {
  const products = (await getProducts().catch(() => [])).filter((product) => product.variants?.some((variant) => variant.stock > 0));
  return <div className="page-shell wide"><PageHero eyebrow="AI Try-on · 試着" title="Phòng thử đồ của riêng bạn" copy="Đo cơ thể và thử đồ là hai khả năng tách biệt: thiếu bằng chứng số đo không tự biến thành số giả, cũng không tự chặn ảnh đủ điều kiện thử." /><TryOnStudio products={products} /></div>;
}
