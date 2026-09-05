import { describe, expect, it } from "vitest";
import { accountCacheKey, loginHref, requiresStorefrontSession, safeReturnPath } from "@/lib/storefront-access";

describe("storefront guest policy", () => {
  it("allows public reads but requires a session for personal reads and every commerce mutation", () => {
    expect(requiresStorefrontSession("GET", "products")).toBe(false);
    expect(requiresStorefrontSession("GET", "storefront/home")).toBe(false);
    expect(requiresStorefrontSession("GET", "auth/me")).toBe(true);
    expect(requiresStorefrontSession("GET", "orders")).toBe(true);
    expect(requiresStorefrontSession("POST", "carts/sync")).toBe(true);
    expect(requiresStorefrontSession("POST", "wishlist/sync")).toBe(true);
    expect(requiresStorefrontSession("POST", "tryon/jobs")).toBe(true);
    expect(requiresStorefrontSession("POST", "stylist/chat")).toBe(true);
  });

  it("keeps login, registration and password recovery public", () => {
    for (const path of ["auth/login", "auth/register", "auth/google", "auth/forgot-password", "auth/reset-password"]) {
      expect(requiresStorefrontSession("POST", path)).toBe(false);
    }
  });

  it("returns only to a local storefront path after authentication", () => {
    expect(safeReturnPath("/thu-do?product=ao-haori")).toBe("/thu-do?product=ao-haori");
    expect(loginHref("/gio-hang")).toBe("/dang-nhap?next=%2Fgio-hang");
    expect(safeReturnPath("https://evil.example/steal")).toBe("/tai-khoan");
    expect(safeReturnPath("//evil.example/steal")).toBe("/tai-khoan");
  });

  it("isolates device cache by account instead of exposing a guest-wide key", () => {
    expect(accountCacheKey("cart", "user/a")).toBe("japano-web-cart-v2:user%2Fa");
    expect(accountCacheKey("wishlist", "user-b")).toBe("japano-web-wishlist-v2:user-b");
  });
});
