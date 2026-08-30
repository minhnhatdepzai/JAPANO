import { describe, expect, it } from "vitest";
import { cloudinarySrcSet, mediaUrl, productHoverImage } from "@/lib/format";
import { normalizeVariants, sellableVariants, uniqueColors, uniqueSizes } from "@/lib/product";
import { checkoutSchema, locationSchema, registerSchema } from "@/lib/schemas";

describe("storefront contracts", () => {
  it("routes local media through the same-origin BFF", () => {
    expect(mediaUrl("/assets/products/kimono.jpg")).toBe("/media/assets/products/kimono.jpg");
    expect(mediaUrl("https://res.cloudinary.com/demo/image.jpg")).toBe("https://res.cloudinary.com/demo/image.jpg");
  });

  it("uses a second product image only when it exists", () => {
    expect(productHoverImage({ images: ["/assets/a.jpg", "/assets/b.jpg"] })).toBe("/media/assets/b.jpg");
    expect(productHoverImage({ images: ["/assets/a.jpg"] })).toBe("/media/assets/a.jpg");
  });

  it("keeps only variants that can actually be sold", () => {
    const sellable = sellableVariants({ variants: [{ size: "S", stock: 0 }, { size: "M", stock: 2 }] });
    expect(sellable.map((variant) => variant.size)).toEqual(["M"]);
    expect(sellable[0].stock).toBe(2);
  });

  it("normalises both variant generations into stable React keys", () => {
    // Nhóm cũ có colorName/sku; nhóm nhập sau chỉ có color/id. Trước khi chuẩn
    // hoá, cả danh sách màu dùng key undefined và React cảnh báo trùng key.
    const legacy = normalizeVariants([{ colorName: "Sumi", colorHex: "#1A1410", size: "S", sku: "A-SUM-S", stock: 3 }]);
    expect(legacy[0]).toMatchObject({ key: "A-SUM-S", colorName: "Sumi", sku: "A-SUM-S" });

    const modern = normalizeVariants([
      { size: "S", color: "Mặc định", stock: 12, id: "variant-jp1-0" },
      { size: "M", color: "Mặc định", stock: 12, id: "variant-jp1-1" },
    ]);
    expect(modern.map((variant) => variant.key)).toEqual(["variant-jp1-0", "variant-jp1-1"]);
    expect(new Set(modern.map((variant) => variant.key)).size).toBe(modern.length);
    expect(modern.every((variant) => Boolean(variant.key) && variant.colorName === "Mặc định")).toBe(true);
  });

  it("collapses colours and sizes without losing catalog order", () => {
    const variants = normalizeVariants([
      { colorName: "Sumi", size: "S", stock: 1, sku: "s1" },
      { colorName: "Sumi", size: "M", stock: 1, sku: "s2" },
      { colorName: "Shu", size: "S", stock: 1, sku: "s3" },
    ]);
    expect(uniqueColors(variants).map((variant) => variant.colorName)).toEqual(["Sumi", "Shu"]);
    expect(uniqueSizes(variants)).toEqual(["S", "M"]);
  });

  it("builds responsive Cloudinary candidates without altering other hosts", () => {
    expect(cloudinarySrcSet("https://res.cloudinary.com/demo/image/upload/v1/a.jpg")).toContain("w_360");
    expect(cloudinarySrcSet("https://example.com/a.jpg")).toBeUndefined();
  });

  it("validates store coordinates and checkout/auth input", () => {
    expect(locationSchema.safeParse({ id: "qtsc9", name: "JAPANO", address: "QTSC9", latitude: 10.8537915, longitude: 106.6260636 }).success).toBe(true);
    expect(locationSchema.safeParse({ id: "bad", name: "JAPANO", address: "QTSC9", latitude: 120, longitude: 106 }).success).toBe(false);
    expect(checkoutSchema.safeParse({ name: "Nguyễn An", phone: "0901234567", address: "QTSC9, đường Tô Ký", paymentMethod: "COD" }).success).toBe(true);
    expect(registerSchema.safeParse({ name: "An", email: "sai", password: "123" }).success).toBe(false);
  });
});
