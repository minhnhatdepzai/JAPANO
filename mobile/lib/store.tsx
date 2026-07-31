import React, { createContext, useContext, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRODUCTS, getVariantStock, isOutOfStock } from './catalog';
import { trackInteraction, syncCart, getWishlist, syncWishlist, AppliedVoucher } from './api';
import { emitBotEvent } from './botEvents';
import { useAuth } from './auth';

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
  showToast: (msg:string)=>void;
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

const priceOf = (slug:string)=> PRODUCTS.find(p=>p.slug===slug)?.price || 0;
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
  const [toast, setToast] = useState<string|null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);

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

  const showToast = useCallback((msg:string)=>{
    setToast(msg);
    Animated.timing(fade,{ toValue:1, duration:180, useNativeDriver:true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(()=>{
      Animated.timing(fade,{ toValue:0, duration:220, useNativeDriver:true }).start(()=>setToast(null));
    }, 1600);
  },[fade]);

  useEffect(()=>()=>{ if (timer.current) clearTimeout(timer.current); },[]);

  const isWished = useCallback((slug:string)=> wish.includes(slug),[wish]);
  const toggleWish = useCallback((slug:string)=>{
    if(!requireAuth())return;
    const nextOn = !wish.includes(slug);
    setWish(w => nextOn ? [...w, slug] : w.filter(s=>s!==slug));
    fireInteraction(user!.id,'wishlist',{ slug, qty:nextOn?1:0 });
  },[requireAuth,user,wish]);

  const addToCart = useCallback((slug:string, color='Sumi', size='M')=>{
    if(!requireAuth())return;
    const product = PRODUCTS.find(p=>p.slug===slug);
    if (product && isOutOfStock(product, color, size)) {
      showToast('Sản phẩm đã hết hàng');
      return;
    }
    const existing = cart.find(x=>x.slug===slug && x.color===color && x.size===size);
    const nextQty = (existing?.qty || 0) + 1;
    if (product) {
      const stock = getVariantStock(product, color, size);
      if (stock !== null && nextQty > stock) {
        showToast('Sản phẩm đã hết hàng');
        return;
      }
    }
    setCart(c => {
      const i = c.findIndex(x=>x.slug===slug && x.color===color && x.size===size);
      if (i>=0){ const n=[...c]; n[i]={...n[i], qty:n[i].qty+1}; return n; }
      return [...c, { slug, color, size, qty:1 }];
    });
    fireInteraction(user!.id,'cart',{ slug, qty:nextQty },{ color,size });
    showToast('Đã thêm vào giỏ ✓');
  },[cart,requireAuth,showToast,user]);

  const incQty = useCallback((i:number)=>{
    if(!requireAuth())return;
    const item=cart[i]; if(!item)return;
    const product = PRODUCTS.find(p=>p.slug===item.slug);
    const qty=item.qty+1;
    if (product) {
      const stock = getVariantStock(product, item.color, item.size);
      if (stock !== null && qty > stock) {
        showToast('Sản phẩm đã hết hàng');
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
  },[cart,requireAuth,user]);
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
  const cartSubtotal = useMemo(()=> cart.reduce((s,x)=>s+priceOf(x.slug)*x.qty,0),[cart]);

  const removeCartAndMaybeClearVoucher = useCallback((i:number)=>{
    removeCart(i);
    if (cart.length<=1) clearVoucher();
  },[removeCart,cart.length,clearVoucher]);

  const value:Store = { wish, isWished, toggleWish, cart, cartCount, cartSubtotal, addToCart, incQty, decQty, removeCart:removeCartAndMaybeClearVoucher, clearCart, showToast, voucher, setVoucher, clearVoucher };

  return (
    <Ctx.Provider value={value}>
      <View style={{ flex:1 }}>
        {children}
        {toast!==null && (
          <Animated.View pointerEvents="none" style={[st.toast,{ opacity:fade, transform:[{ translateY: fade.interpolate({ inputRange:[0,1], outputRange:[-8,0] }) }] }]}>
            <Text style={st.toastT}>{toast}</Text>
          </Animated.View>
        )}
      </View>
    </Ctx.Provider>
  );
}
const st = StyleSheet.create({
  toast:{ position:'absolute', top:56, alignSelf:'center', backgroundColor:'#1A1410', paddingVertical:10, paddingHorizontal:18, borderRadius:999, zIndex:999, elevation:12,
    shadowColor:'#000', shadowOpacity:0.25, shadowRadius:10, shadowOffset:{ width:0, height:6 } },
  toastT:{ color:'#fff', fontFamily:'Arimo_700Bold', fontSize:13 },
});
