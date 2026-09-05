import { describe, expect, it } from "vitest";
import { rebuildServerCart } from "@/lib/account-store";
import type { Product } from "@/lib/types";

const catalog = [{
  id: "p1",
  slug: "ao-app",
  name: "Áo từ app",
  price: 100_000,
  images: ["/ao.jpg"],
  variants: [{ colorName: "Đỏ", size: "M", stock: 5 }],
}] as Product[];

describe("shared account cart", () => {
  it("rebuilds a web cart from the backend cart and current catalog", () => {
    expect(rebuildServerCart([
      { productId: "ao-app", color: "Đỏ", size: "M", quantity: 2 },
      { productId: "san-pham-da-xoa", color: "Đen", size: "L", quantity: 1 },
    ], catalog)).toEqual([expect.objectContaining({
      key: "ao-app:Đỏ:M",
      slug: "ao-app",
      quantity: 2,
      stock: 5,
    })]);
  });

  it("keeps a valid server quantity even when catalog stock is temporarily stale", () => {
    expect(rebuildServerCart([
      { productId: "ao-app", color: "Đỏ", size: "M", quantity: 8 },
    ], catalog)[0]).toEqual(expect.objectContaining({ quantity: 8, stock: 8 }));
  });
});
