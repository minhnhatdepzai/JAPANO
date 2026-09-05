"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem, Product, ProductVariant } from "@/lib/types";
import { productImage } from "@/lib/format";
import { requestCartMotion } from "@/lib/motion-events";
import { sellableVariants } from "@/lib/product";
import { api, postJson } from "@/lib/client-api";
import { rebuildServerCart, type ServerCartRow } from "@/lib/account-store";
import { accountCacheKey, loginHref } from "@/lib/storefront-access";

type CartAddOptions = { source?: HTMLImageElement | null };

type CartContextValue = {
  items: CartItem[];
  wishlist: string[];
  cartOpen: boolean;
  count: number;
  subtotal: number;
  authStatus: "loading" | "guest" | "authenticated";
  requireAuth: (nextPath?: string) => boolean;
  addProduct: (product: Product, variant?: ProductVariant, options?: CartAddOptions) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  toggleWishlist: (slug: string) => void;
  setCartOpen: (open: boolean) => void;
  clearCart: () => void;
  connectAccount: (userId: string) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);
const LEGACY_CART_KEY = "japano-web-cart-v1";
const LEGACY_WISHLIST_KEY = "japano-web-wishlist-v1";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  const [items, setItems] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [cartOpen, setCartOpenState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [accountUserId, setAccountUserId] = useState("");
  const [accountReady, setAccountReady] = useState(false);
  const [authStatus, setAuthStatus] = useState<"loading" | "guest" | "authenticated">("loading");

  const hydrateAccount = useCallback(async (userId: string, seedItems: CartItem[], seedWishlist: string[]) => {
    const cartPayload = seedItems.map((item) => ({
      productId: item.slug, color: item.color, size: item.size, quantity: item.quantity,
    }));
    const [mergedCart, mergedWishlist, catalog] = await Promise.all([
      postJson<{ cart?: ServerCartRow[] }>("/api/carts/sync", { userId, merge: true, items: cartPayload }, 12_000).catch(() => null),
      postJson<{ wishlist?: string[] }>("/api/wishlist/sync", { userId, merge: true, slugs: seedWishlist }, 12_000).catch(() => null),
      api<Product[]>("/api/products", { timeoutMs: 12_000 }).catch(() => null),
    ]);

    if (mergedCart?.cart && catalog) {
      setItems(rebuildServerCart(mergedCart.cart, catalog));
    }
    if (mergedWishlist?.wishlist) setWishlist(mergedWishlist.wishlist.map(String));
    setAccountUserId(userId);
    // Chỉ bật đồng bộ ghi sau khi cả hai nguồn cá nhân đã đọc thành công. Nếu
    // backend chập chờn, giữ cache hiện có thay vì ghi mảng rỗng đè dữ liệu.
    setAccountReady(Boolean(mergedCart && mergedWishlist && catalog));
  }, []);

  useEffect(() => {
    let live = true;
    try {
      // Hai khóa v1 không gắn với tài khoản nên có thể làm lộ giỏ/yêu thích của
      // người dùng trước cho khách hoặc tài khoản kế tiếp trên cùng trình duyệt.
      localStorage.removeItem(LEGACY_CART_KEY);
      localStorage.removeItem(LEGACY_WISHLIST_KEY);
    } catch { /* Trình duyệt có thể chặn storage; backend vẫn là nguồn thật. */ }
    void api<{ user?: { id?: string } }>("/api/auth/me", { timeoutMs: 10_000 })
      .then(async (session) => {
        const userId = String(session.user?.id || "");
        if (!live || !userId) return;
        let savedItems: CartItem[] = [];
        let savedWishlist: string[] = [];
        try {
          savedItems = JSON.parse(localStorage.getItem(accountCacheKey("cart", userId)) || "[]");
          savedWishlist = JSON.parse(localStorage.getItem(accountCacheKey("wishlist", userId)) || "[]");
        } catch { /* Cache lỗi không được làm mất phiên hoặc dữ liệu backend. */ }
        setItems(savedItems);
        setWishlist(savedWishlist);
        await hydrateAccount(userId, savedItems, savedWishlist);
        if (live) setAuthStatus("authenticated");
      })
      .catch(() => {
        if (!live) return;
        setItems([]);
        setWishlist([]);
        setAccountUserId("");
        setAccountReady(false);
        setAuthStatus("guest");
      })
      .finally(() => {
        if (!live) return;
        setHydrated(true);
        setAuthStatus((current) => current === "loading" ? "guest" : current);
      });
    return () => { live = false; };
  }, [hydrateAccount]);

  useEffect(() => {
    if (hydrated && accountReady && accountUserId && authStatus === "authenticated") {
      localStorage.setItem(accountCacheKey("cart", accountUserId), JSON.stringify(items));
    }
  }, [accountReady, accountUserId, authStatus, hydrated, items]);

  useEffect(() => {
    if (hydrated && accountReady && accountUserId && authStatus === "authenticated") {
      localStorage.setItem(accountCacheKey("wishlist", accountUserId), JSON.stringify(wishlist));
    }
  }, [accountReady, accountUserId, authStatus, hydrated, wishlist]);

  useEffect(() => {
    if (!hydrated || !accountReady || !accountUserId) return;
    const timer = window.setTimeout(() => {
      const payload = items.map((item) => ({ productId: item.slug, color: item.color, size: item.size, quantity: item.quantity }));
      void postJson("/api/carts/sync", { userId: accountUserId, items: payload }, 12_000).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [accountReady, accountUserId, hydrated, items]);

  useEffect(() => {
    if (!hydrated || !accountReady || !accountUserId) return;
    const timer = window.setTimeout(() => {
      void postJson("/api/wishlist/sync", { userId: accountUserId, slugs: wishlist }, 12_000).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [accountReady, accountUserId, hydrated, wishlist]);

  const requireAuth = useCallback((nextPath?: string) => {
    if (authStatus === "authenticated") return true;
    if (authStatus === "loading") return false;
    const currentPath = `${window.location.pathname}${window.location.search}`;
    window.location.assign(loginHref(nextPath || currentPath));
    return false;
  }, [authStatus]);

  const setCartOpen = useCallback((open: boolean) => {
    if (open && !requireAuth("/gio-hang")) return;
    setCartOpenState(open);
  }, [requireAuth]);

  const addProduct = useCallback((product: Product, requested?: ProductVariant, options?: CartAddOptions) => {
    if (!requireAuth(`/san-pham/${product.slug}`)) return;
    const variant = requested || sellableVariants(product)[0];
    if (!variant) return;
    const key = `${product.slug}:${variant.colorName}:${variant.size}`;
    setItems((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) return current.map((item) => item.key === key ? { ...item, quantity: Math.min(item.stock, item.quantity + 1) } : item);
      return [...current, {
        key,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: productImage(product),
        color: variant.colorName,
        size: variant.size,
        price: product.price,
        quantity: 1,
        stock: Number(variant.stock || 0),
      }];
    });
    const delay = requestCartMotion(options?.source, product.name, productImage(product));
    if (delay > 0) window.setTimeout(() => setCartOpenState(true), delay);
    else setCartOpenState(true);
  }, [requireAuth]);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    if (!requireAuth("/gio-hang")) return;
    setItems((current) => current
      .map((item) => item.key === key ? { ...item, quantity: Math.max(0, Math.min(item.stock, quantity)) } : item)
      .filter((item) => item.quantity > 0));
  }, [requireAuth]);

  const removeItem = useCallback((key: string) => {
    if (!requireAuth("/gio-hang")) return;
    setItems((current) => current.filter((item) => item.key !== key));
  }, [requireAuth]);
  const toggleWishlist = useCallback((slug: string) => {
    if (!requireAuth(`/san-pham/${slug}`)) return;
    setWishlist((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]);
  }, [requireAuth]);
  const clearCart = useCallback(() => {
    if (!requireAuth("/gio-hang")) return;
    setItems([]);
  }, [requireAuth]);
  const connectAccount = useCallback(async (userId: string) => {
    let savedItems: CartItem[] = [];
    let savedWishlist: string[] = [];
    try {
      savedItems = JSON.parse(localStorage.getItem(accountCacheKey("cart", userId)) || "[]");
      savedWishlist = JSON.parse(localStorage.getItem(accountCacheKey("wishlist", userId)) || "[]");
    } catch { /* Cache không hợp lệ thì dùng nguồn backend. */ }
    await hydrateAccount(userId, savedItems, savedWishlist);
    setAuthStatus("authenticated");
    setHydrated(true);
  }, [hydrateAccount]);
  const value = useMemo(() => ({
    items,
    wishlist,
    cartOpen,
    count: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: items.reduce((total, item) => total + item.price * item.quantity, 0),
    authStatus,
    requireAuth,
    addProduct,
    updateQuantity,
    removeItem,
    toggleWishlist,
    setCartOpen,
    clearCart,
    connectAccount,
  }), [items, wishlist, cartOpen, authStatus, requireAuth, addProduct, updateQuantity, removeItem, toggleWishlist, setCartOpen, clearCart, connectAccount]);

  return <QueryClientProvider client={queryClient}><CartContext.Provider value={value}>{children}</CartContext.Provider></QueryClientProvider>;
}

export function useStore() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useStore phải nằm trong StoreProvider");
  return value;
}
