import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Btn, money } from '../components/ui';
import { PRODUCTS, variantPrice } from '../lib/catalog';
import { useStore } from '../lib/store';
import { voucherDiscountFor } from '../lib/api';
import { VoucherField } from '../components/VoucherPicker';
import { C, F } from '../theme/tokens';
import { SmartImage } from '../components/SmartImage';
import { useAuth } from '../lib/auth';

const bySlug = (s:string)=>PRODUCTS.find(p=>p.slug===s)!;
const FLAGCARD_MIN = 5_000_000;
// Khớp variant giống hệt findVariant() ở backend/routes/orders.js — sản phẩm
// không có variants (ảnh minh hoạ, phụ kiện cũ) thì bỏ qua giới hạn tồn kho.
function stockFor(p:ReturnType<typeof bySlug>, colorName:string, size:string): number|null {
  const variants = p.variants || [];
  if (!variants.length) return null;
  const variant = variants.find(v=>String(v.colorName||'Mặc định')===colorName && String(v.size||'M')===size)
    || variants.find(v=>String(v.size||'M')===size);
  return variant ? Math.max(0, Number(variant.stock)||0) : 0;
}
export default function Cart() {
  const router = useRouter();
  const {user}=useAuth();
  const { cart, incQty, decQty, removeCart, cartSubtotal, voucher, setVoucher, clearVoucher } = useStore();
  const disc = voucher ? voucherDiscountFor(cartSubtotal, voucher) : 0;
  const grand = cartSubtotal - disc;

  if (cart.length===0) {
    return (
      <Screen>
        <Header title="Giỏ hàng" />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:30 }}>
          <Ionicons name="bag-outline" size={54} color={C.hair} />
          <Text style={{ fontFamily:F.display, fontSize:18, color:C.sumi, marginTop:12 }}>Giỏ hàng trống</Text>
          <Text style={{ fontFamily:F.body, fontSize:13, color:C.muted, marginTop:4, textAlign:'center' }}>Khám phá bộ sưu tập Nhật và thêm món bạn thích.</Text>
          <Btn label="Mua sắm ngay" style={{ marginTop:18, width:200 }} onPress={()=>router.replace('/(tabs)/products')} />
        </View>
      </Screen>
    );
  }
  return (
    <Screen>
      <Header title={`Giỏ hàng (${cart.length})`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal:18, paddingBottom:100 }}>
        {cart.map((it,i)=>{
          const p = bySlug(it.slug);
          const stock = stockFor(p, it.color, it.size);
          const atMax = stock!==null && it.qty>=stock;
          return (
            <View key={i} style={st.card}>
              <SmartImage source={p.images[0]} style={{ width:64, height:78, borderRadius:10 }} recyclingKey={`${p.slug}-cart`} />
              <View style={{ flex:1, marginLeft:12 }}>
                <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                  <Text style={{ fontFamily:F.bodyB, fontSize:13.5, color:C.ink, flex:1 }} numberOfLines={1}>{p.name}</Text>
                  <Pressable onPress={()=>removeCart(i)} hitSlop={8}><Ionicons name="close" size={18} color={C.muted} /></Pressable>
                </View>
                <Text style={{ fontFamily:F.body, fontSize:11.5, color:C.muted, marginTop:2 }}>{it.color} · {it.size}</Text>
                {stock!==null && <Text style={{ fontFamily:F.bodyM, fontSize:10.5, marginTop:1, marginBottom:6, color:stock<=5?C.danger:C.ok }}>{stock===0?'Hết hàng':`Còn ${stock} sản phẩm`}</Text>}
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:stock!==null?0:6 }}>
                  <Text style={{ fontFamily:F.bodyX, fontSize:14, color:C.shu }}>{money(variantPrice(p, it.color, it.size)*it.qty)}</Text>
                  <View style={st.qty}>
                    <Pressable onPress={()=>decQty(i)} hitSlop={6}><Ionicons name="remove" size={16} color={C.ink} /></Pressable>
                    <Text style={{ fontFamily:F.bodyB, marginHorizontal:12 }}>{it.qty}</Text>
                    <Pressable onPress={()=>{if(!atMax)incQty(i);}} hitSlop={6}><Ionicons name="add" size={16} color={atMax?C.line:C.ink} /></Pressable>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
        <View style={{ marginVertical:8 }}>
          <VoucherField subtotal={cartSubtotal} voucher={voucher} onApply={setVoucher} onClear={clearVoucher} userId={user?.id} />
        </View>
        <View style={st.summary}>
          <Row k="Tạm tính" v={money(cartSubtotal)} />
          {disc>0 && <Row k={`Giảm giá ${voucher?.code}`} v={`-${money(disc)}`} shu />}
          <View style={st.stripeHint}><Ionicons name="card-outline" size={17} color="#15803D" /><Text style={st.stripeHintT}>Chọn Stripe ở bước thanh toán để được giảm thêm 10%</Text></View>
          <View style={{ height:1, backgroundColor:C.hair, marginVertical:8 }} />
          <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
            <Text style={{ fontFamily:F.bodyX, fontSize:15 }}>Tổng</Text>
            <Text style={{ fontFamily:F.bodyX, fontSize:16, color:C.shu }}>{money(grand)}</Text>
          </View>
        </View>
        <View style={[st.flagProgress, grand >= FLAGCARD_MIN && st.flagProgressReady]}>
          <Ionicons name="flag" size={20} color={grand >= FLAGCARD_MIN ? '#F6D6B4' : C.shu} />
          <Text style={[st.flagProgressText, grand >= FLAGCARD_MIN && { color:'#fff' }]}>
            {grand >= FLAGCARD_MIN
              ? 'Đơn này đã đủ điều kiện nhận 1 Flagcard ngay khi đặt hàng thành công.'
              : `Mua thêm ${money(FLAGCARD_MIN - grand)} để nhận 1 Flagcard địa danh Nhật Bản.`}
          </Text>
        </View>
      </ScrollView>
      <View style={st.sticky}><Btn label={`Thanh toán · ${money(grand)}`} onPress={()=>router.push('/checkout')} /></View>
    </Screen>
  );
}
const Row = ({ k, v, shu }:{k:string;v:string;shu?:boolean}) => (
  <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 }}>
    <Text style={{ fontFamily:F.body, fontSize:13, color:C.muted }}>{k}</Text>
    <Text style={{ fontFamily:F.bodyM, fontSize:13, color:shu?C.shu:C.ink }}>{v}</Text>
  </View>
);
const st = StyleSheet.create({
  card:{ flexDirection:'row', backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:14, padding:10, marginBottom:10 },
  qty:{ flexDirection:'row', alignItems:'center', borderWidth:1, borderColor:C.line, borderRadius:8, paddingHorizontal:8, paddingVertical:2 },
  summary:{ backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:14, padding:14, marginTop:4 },
  flagProgress:{ flexDirection:'row', alignItems:'center', gap:10, backgroundColor:C.shuSoft, borderWidth:1, borderColor:C.shu, borderRadius:14, padding:13, marginTop:10 },
  flagProgressReady:{ backgroundColor:C.sumi, borderColor:C.kin },
  flagProgressText:{ flex:1, fontFamily:F.bodyB, fontSize:11.5, lineHeight:17, color:C.shuDeep },
  stripeHint:{ flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#E8F6EC',borderRadius:10,padding:10,marginVertical:7 },
  stripeHintT:{ flex:1,fontFamily:F.bodyB,fontSize:11,color:'#166534' },
  sticky:{ position:'absolute', left:0, right:0, bottom:0, backgroundColor:C.paper, borderTopWidth:1, borderTopColor:C.line, padding:12, paddingBottom:24 },
});
