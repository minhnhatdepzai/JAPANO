"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem, Product, ProductVariant } from "@/lib/types";
import { productImage } from "@/lib/format";
import { requestCartMotion } from "@/lib/motion-events";
import { sellableVariants } from "@/lib/product";

type CartAddOptions = { source?: HTMLImageElement | null };

type CartContextValue = {
  items: CartItem[];
  wishlist: string[];
  cartOpen: boolean;
  count: number;
  subtotal: number;
  addProduct: (product: Product, variant?: ProductVariant, options?: CartAddOptions) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  toggleWishlist: (slug: string) => void;
  setCartOpen: (open: boolean) => void;
  clearCart: () => void;
  replaceCart: (items: CartItem[]) => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = "japano-web-cart-v1";
const WISHLIST_KEY = "japano-web-wishlist-v1";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  const [items, setItems] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem(CART_KEY) || "[]"));
      setWishlist(JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]"));
    } catch {
      setItems([]);
      setWishlist([]);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
  }, [hydrated, wishlist]);

  const addProduct = useCallback((product: Product, requested?: ProductVariant, options?: CartAddOptions) => {
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
    if (delay > 0) window.setTimeout(() => setCartOpen(true), delay);
    else setCartOpen(true);
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setItems((current) => current
      .map((item) => item.key === key ? { ...item, quantity: Math.max(0, Math.min(item.stock, quantity)) } : item)
      .filter((item) => item.quantity > 0));
  }, []);

  const removeItem = useCallback((key: string) => setItems((current) => current.filter((item) => item.key !== key)), []);
  const toggleWishlist = useCallback((slug: string) => setWishlist((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]), []);
  const clearCart = useCallback(() => setItems([]), []);
  // Sau khi đăng nhập, giỏ khách được hợp nhất ở backend rồi trả về; giao diện
  // thay bằng đúng kết quả hợp nhất đó thay vì giữ hai nguồn sự thật.
  const replaceCart = useCallback((next: CartItem[]) => setItems(next), []);
  const value = useMemo(() => ({
    items,
    wishlist,
    cartOpen,
    count: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: items.reduce((total, item) => total + item.price * item.quantity, 0),
    addProduct,
    updateQuantity,
    removeItem,
    toggleWishlist,
    setCartOpen,
    clearCart,
    replaceCart,
  }), [items, wishlist, cartOpen, addProduct, updateQuantity, removeItem, toggleWishlist, clearCart, replaceCart]);

  return <QueryClientProvider client={queryClient}><CartContext.Provider value={value}>{children}</CartContext.Provider></QueryClientProvider>;
}

export function useStore() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useStore phải nằm trong StoreProvider");
  return value;
}
