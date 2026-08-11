import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRODUCTS, getVariantStock, isOutOfStock, variantPrice } from './catalog';
import { trackInteraction, syncCart, getWishlist, syncWishlist, AppliedVoucher } from './api';
import { emitBotEvent } from './botEvents';
import { useAuth } from './auth';
import { ToastKind, useToast } from './toast';

export type CartItem = { slug:string; color:string; size:string; qty:number };

type Store = {
  wish: string[];
  isWished: (slug:string)=>boolean;
  toggleWish: (slug:string)=>void;
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  addToCart: (slug:string, color?:string, size?:string)=>void;
  incQty: (i:number)=>void;
  decQty: (i:number)=>void;
  removeCart: (i:number)=>void;
  clearCart: ()=>void;
  showToast: (msg:string, kind?:ToastKind)=>void;
  voucher: AppliedVoucher|null;
  setVoucher: (v:AppliedVoucher|null)=>void;
  clearVoucher: ()=>void;
};

const STORAGE_KEY = '@japano/store/v3';

const Ctx = createContext<Store|null>(null);
export const useStore = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used within StoreProvider');
  return v;
};

// Giá của một DÒNG giỏ hàng phải theo đúng màu+size đã chọn, không phải giá
// chung của sản phẩm — nếu không, khách thấy tổng tiền một đằng còn máy chủ
// tính một nẻo lúc đặt hàng (routes/orders.js tự tính lại theo biến thể).
const lineUnitPrice = (item:CartItem)=>{
  const product = PRODUCTS.find(p=>p.slug===item.slug);
  return product ? variantPrice(product, item.color, item.size) : 0;
};
const fireInteraction = (userId:string, type:'wishlist'|'cart', item:CartItem | { slug:string; qty:number }, metadata:Record<string, unknown> = {}) => {
  void trackInteraction({ userId, type, productId:item.slug, value:item.qty, metadata }).catch(()=>undefined);
};

export function StoreProvider({ children }:{ children:React.ReactNode }) {
  const { user, requireAuth } = useAuth();
  const [wish, setWish] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [voucher, setVoucher] = useState<AppliedVoucher|null>(null);
  const clearVoucher = useCallback(()=>setVoucher(null),[]);
  const clearCart = useCallback(()=>{setCart([]);setVoucher(null);},[]);
  const [hydrated, setHydrated] = useState(false);
  // Một hệ thống thanh thông báo duy nhất cho toàn app (lib/toast.tsx) — trước
  // đây giỏ hàng tự vẽ toast riêng nên các màn hình khác không dùng lại được.
  const { toast } = useToast();

  useEffect(()=>{
    let live=true;
    setHydrated(false);
    setWish([]);
    setCart([]);
    setVoucher(null);
    if(!user){setHydrated(true);return()=>{live=false;};}
    // Nạp song song: cache cục bộ (nhanh, offline) + wishlist thật từ backend.
    const localP = AsyncStorage.getItem(`${STORAGE_KEY}/${encodeURIComponent(user.id)}`)
      .then(raw=>raw?JSON.parse(raw):null).catch(()=>null);
    const remoteWishP = getWishlist(user.id).catch(()=>null);
    Promise.all([localP,remoteWishP])
      .then(([saved,remoteWish])=>{
        if(!live)return;
        const localWish = Array.isArray(saved?.wish)?saved.wish.map(String):[];
        // Hợp nhất: ưu tiên bản backend, gộp thêm mục cục bộ chưa kịp đồng bộ.
        const merged = Array.isArray(remoteWish)
          ? [...remoteWish, ...localWish.filter(s=>!remoteWish.includes(s))]
          : localWish;
        setWish(merged);
        if (Array.isArray(saved?.cart)) setCart(saved.cart);
      })
      .finally(()=>{if(live)setHydrated(true);});
    return()=>{live=false;};
  },[user?.id]);

  useEffect(()=>{
    if (!hydrated||!user) return;
    void AsyncStorage.setItem(`${STORAGE_KEY}/${encodeURIComponent(user.id)}`, JSON.stringify({ wish, cart })).catch(()=>undefined);
    const timer=setTimeout(()=>{
      void syncCart(user.id,cart).catch(()=>undefined);
      void syncWishlist(user.id,wish).catch(()=>undefined);
    },300);
    return()=>clearTimeout(timer);
  },[wish,cart,hydrated,user]);

  // Loại thông báo do NƠI GỌI quyết định, không đoán theo nội dung: đoán chữ
  // từng làm lời cảnh báo "mật khẩu quá yếu" hiện ra màu xanh như báo thành công.
  const showToast = useCallback((msg:string, kind:ToastKind='info')=>{
    toast({ message: msg, kind });
  },[toast]);

  const isWished = useCallback((slug:string)=> wish.includes(slug),[wish]);
  const toggleWish = useCallback((slug:string)=>{
    if(!requireAuth())return;
    const nextOn = !wish.includes(slug);
    setWish(w => nextOn ? [...w, slug] : w.filter(s=>s!==slug));
    fireInteraction(user!.id,'wishlist',{ slug, qty:nextOn?1:0 });
    const name = PRODUCTS.find(p=>p.slug===slug)?.name || 'Sản phẩm';
    toast(nextOn ? `Đã lưu "${name}" vào yêu thích ✓` : `Đã bỏ "${name}" khỏi yêu thích`, nextOn?'success':'info');
  },[requireAuth,toast,user,wish]);

  const addToCart = useCallback((slug:string, color='Sumi', size='M')=>{
    if(!requireAuth())return;
    const product = PRODUCTS.find(p=>p.slug===slug);
    if (product && isOutOfStock(product, color, size)) {
      showToast('Sản phẩm đã hết hàng','error');
      return;
    }
    const existing = cart.find(x=>x.slug===slug && x.color===color && x.size===size);
    const nextQty = (existing?.qty || 0) + 1;
    if (product) {
      const stock = getVariantStock(product, color, size);
      if (stock !== null && nextQty > stock) {
        showToast('Sản phẩm đã hết hàng','error');
        return;
      }
    }
    setCart(c => {
      const i = c.findIndex(x=>x.slug===slug && x.color===color && x.size===size);
      if (i>=0){ const n=[...c]; n[i]={...n[i], qty:n[i].qty+1}; return n; }
      return [...c, { slug, color, size, qty:1 }];
    });
    fireInteraction(user!.id,'cart',{ slug, qty:nextQty },{ color,size });
    showToast('Đã thêm vào giỏ ✓','success');
  },[cart,requireAuth,showToast,user]);

  const incQty = useCallback((i:number)=>{
    if(!requireAuth())return;
    const item=cart[i]; if(!item)return;
    const product = PRODUCTS.find(p=>p.slug===item.slug);
    const qty=item.qty+1;
    if (product) {
      const stock = getVariantStock(product, item.color, item.size);
      if (stock !== null && qty > stock) {
        showToast('Sản phẩm đã hết hàng','error');
        return;
      }
    }
    setCart(c=>c.map((x,idx)=>idx===i?{...x,qty}:x));
    fireInteraction(user!.id,'cart',{...item,qty},{color:item.color,size:item.size});
  },[cart,requireAuth,showToast,user]);
  const removeCart = useCallback((i:number)=>{
    if(!requireAuth())return;
    const item=cart[i]; if(!item)return;
    setCart(c=>c.filter((_,idx)=>idx!==i));
    fireInteraction(user!.id,'cart',{...item,qty:0},{color:item.color,size:item.size});
    emitBotEvent({ type:'cart_removed', item });
    toast({ message:`Đã xoá "${PRODUCTS.find(p=>p.slug===item.slug)?.name || 'sản phẩm'}" khỏi giỏ`, kind:'info' });
  },[cart,requireAuth,toast,user]);
  const decQty = useCallback((i:number)=>{
    if(!requireAuth())return;
    const item=cart[i]; if(!item)return;
    if(item.qty<=1){
      removeCart(i);
      if(cart.length<=1) clearVoucher();
      return;
    }
    const qty=item.qty-1;
    setCart(c=>c.map((x,idx)=>idx===i?{...x,qty}:x));
    fireInteraction(user!.id,'cart',{...item,qty},{color:item.color,size:item.size});
  },[cart,clearVoucher,requireAuth,removeCart,user]);

  const cartCount = useMemo(()=> cart.reduce((s,x)=>s+x.qty,0),[cart]);
  const cartSubtotal = useMemo(()=> cart.reduce((s,x)=>s+lineUnitPrice(x)*x.qty,0),[cart]);

  const removeCartAndMaybeClearVoucher = useCallback((i:number)=>{
    removeCart(i);
    if (cart.length<=1) clearVoucher();
  },[removeCart,cart.length,clearVoucher]);

  // Không memo hoá thì mỗi lần StoreProvider vẽ lại (kể cả do provider cha đổi)
  // là object context mới → mọi màn hình dùng useStore() re-render theo.
  const value:Store = useMemo(()=>({
    wish, isWished, toggleWish, cart, cartCount, cartSubtotal, addToCart, incQty, decQty,
    removeCart:removeCartAndMaybeClearVoucher, clearCart, showToast, voucher, setVoucher, clearVoucher,
  }),[wish,isWished,toggleWish,cart,cartCount,cartSubtotal,addToCart,incQty,decQty,
     removeCartAndMaybeClearVoucher,clearCart,showToast,voucher,clearVoucher]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
