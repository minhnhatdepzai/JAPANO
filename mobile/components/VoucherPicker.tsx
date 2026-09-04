import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { money } from './ui';
import { getVouchers, validateVoucher, voucherDiscountFor, ApiVoucher, AppliedVoucher, VoucherLine } from '../lib/api';
import { C, F } from '../theme/tokens';

const discountLabel = (v:{type:string;value:number}) => v.type==='percent' ? `Giảm ${v.value}%` : `Giảm ${money(v.value)}`;

const scopeLabel = (v:ApiVoucher, names:Record<string,string>) => {
  if (v.scope !== 'product' && v.source !== 'goal-fund') return '';
  const ids = v.eligibleProductIds?.length ? v.eligibleProductIds : (v.goalProductId ? [v.goalProductId] : []);
  if (!ids.length) return 'Chỉ áp dụng cho một sản phẩm nhất định';
  const label = ids.map((id)=>names[id] || id).join(', ');
  const qty = Math.max(1, Number(v.maxEligibleQty || 1));
  return `Chỉ áp dụng cho ${label} · tối đa ${qty} sản phẩm`;
};

function VoucherRow({ v, subtotal, inCart, productNames, onPick }:{
  v:ApiVoucher; subtotal:number; inCart:boolean; productNames:Record<string,string>; onPick:(code:string)=>void;
}) {
  const scoped = v.scope === 'product' || v.source === 'goal-fund';
  const eligible = subtotal >= (v.min||0) && (!scoped || inCart);
  const isFlag = v.source === 'flagcard-collection';
  const scopeNote = scopeLabel(v, productNames);
  return (
    <Pressable style={[st.row, !eligible && st.rowDisabled]} onPress={()=>eligible && onPick(v.code)} disabled={!eligible}>
      <View style={[st.tag, isFlag && st.tagFlag]}>
        <Text style={{ fontSize:16 }}>{isFlag?'🚩':(v.type==='percent'?'%':'₫')}</Text>
      </View>
      <View style={{ flex:1 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
          <Text style={st.code}>{v.code}</Text>
          {isFlag && <View style={st.flagBadge}><Text style={st.flagBadgeT}>Của bạn</Text></View>}
        </View>
        <Text style={st.desc}>{discountLabel(v)}{v.min?` · Đơn từ ${money(v.min)}`:''} · HSD {v.expiry}</Text>
        {!!scopeNote && <Text style={st.scopeNote}>{scopeNote}</Text>}
        {!!v.maxDiscountAmount && <Text style={st.scopeNote}>Giảm tối đa {money(v.maxDiscountAmount)}</Text>}
        {!eligible && (scoped && !inCart
          ? <Text style={st.needMore}>Giỏ hàng chưa có sản phẩm được áp dụng mã này</Text>
          : <Text style={st.needMore}>Mua thêm {money((v.min||0)-subtotal)} để dùng mã này</Text>)}
      </View>
      {eligible && <Ionicons name="chevron-forward" size={16} color={C.ink} />}
    </Pressable>
  );
}

export function VoucherField({ subtotal, items, productNames, voucher, onApply, onClear, userId }:{
  subtotal:number;
  /** Dòng hàng trong giỏ — bắt buộc để mã chỉ-đúng-một-sản-phẩm tính được. */
  items?:VoucherLine[];
  productNames?:Record<string,string>;
  voucher:AppliedVoucher|null; onApply:(v:AppliedVoucher)=>void; onClear:()=>void; userId?:string;
}) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<ApiVoucher[]|null>(null);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setList(null); setMsg('');
    getVouchers(userId).then(setList).catch(() => setList([]));
  }, [open,userId]);

  /* Giỏ đổi sau khi đã áp mã thì con số cũ không còn đúng nữa.
   *
   * Không được giữ preview cũ: mã có thể vừa mất hiệu lực (bỏ món mục tiêu ra
   * khỏi giỏ), hoặc số giảm đã khác. Kiểm lại với máy chủ; hỏng thì gỡ mã kèm
   * thông báo rõ thay vì hiển thị một con số sai. */
  const cartSignature = JSON.stringify((items||[]).map((line)=>[line.slug,line.colorName,line.size,line.qty]));
  const appliedCode = voucher?.code || '';
  useEffect(() => {
    if (!appliedCode) return;
    let cancelled = false;
    validateVoucher(appliedCode, subtotal, items).then((res:any) => {
      if (cancelled) return;
      if (res?.ok) {
        onApply({
          code:res.voucher.code, type:res.voucher.type, value:res.voucher.value, min:res.voucher.min,
          discount:Number(res.discount)||0,
          scope:res.scope, eligibleProductIds:res.eligibleProductIds,
          maxEligibleQty:res.maxEligibleQty ?? null, maxDiscountAmount:res.maxDiscountAmount ?? null,
        });
      } else {
        onClear();
        setMsg(res?.message || 'Mã giảm giá không còn áp dụng được cho giỏ hàng hiện tại.');
      }
    }).catch(() => {
      if (cancelled) return;
      onClear();
      setMsg('Không kiểm tra lại được mã giảm giá — đã gỡ mã để tránh hiển thị sai số tiền.');
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCode, cartSignature, subtotal]);

  const apply = async (rawCode:string) => {
    const value = rawCode.trim();
    if (!value || checking) return;
    setChecking(true); setMsg('');
    try {
      const res:any = await validateVoucher(value, subtotal, items);
      if (res?.ok) {
        // Giữ nguyên con số máy chủ đã tính — client không tự tính lại.
        onApply({
          code:res.voucher.code, type:res.voucher.type, value:res.voucher.value, min:res.voucher.min,
          discount:Number(res.discount)||0,
          scope:res.scope, eligibleProductIds:res.eligibleProductIds,
          maxEligibleQty:res.maxEligibleQty ?? null, maxDiscountAmount:res.maxDiscountAmount ?? null,
        });
        setOpen(false); setCode('');
      } else {
        setMsg(res?.message || 'Mã giảm giá không hợp lệ.');
      }
    } catch (e:any) {
      setMsg(e?.message || 'Không kiểm tra được mã giảm giá lúc này.');
    } finally { setChecking(false); }
  };

  return (
    <View>
      {voucher ? (
        <View style={st.applied}>
          <Ionicons name="pricetag" size={16} color={C.ink} />
          <Text style={{ flex:1, fontFamily:F.bodyB, fontSize:13, color:C.shuDeep }}>{voucher.code} · -{money(voucherDiscountFor(subtotal, voucher))}</Text>
          <Pressable onPress={()=>setOpen(true)} hitSlop={6} style={{ marginRight:14 }}><Text style={st.link}>Đổi</Text></Pressable>
          <Pressable onPress={onClear} hitSlop={6}><Text style={st.linkMuted}>Bỏ</Text></Pressable>
        </View>
      ) : (
        <Pressable style={st.trigger} onPress={()=>setOpen(true)}>
          <Ionicons name="pricetag-outline" size={16} color={C.ink} />
          <Text style={{ flex:1, fontFamily:F.bodyM, fontSize:13, color:C.ink }}>Chọn hoặc nhập mã giảm giá</Text>
          <Ionicons name="chevron-forward" size={16} color={C.muted} />
        </Pressable>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={()=>setOpen(false)}>
        <Pressable style={st.backdrop} onPress={()=>setOpen(false)}>
          <Pressable style={st.sheet} onPress={(e)=>e.stopPropagation()}>
            <View style={st.sheetHead}>
              <Text style={st.sheetTitle}>Chọn mã giảm giá</Text>
              <Pressable onPress={()=>setOpen(false)} hitSlop={8}><Ionicons name="close" size={22} color={C.muted} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight:340 }} contentContainerStyle={{ paddingBottom:8 }}>
              {list===null && <ActivityIndicator color={C.ink} style={{ marginVertical:24 }} />}
              {list!==null && !list.length && <Text style={st.empty}>Chưa có mã giảm giá khả dụng lúc này.</Text>}
              {(list||[]).map(v => {
                const ids = v.eligibleProductIds?.length ? v.eligibleProductIds : (v.goalProductId ? [v.goalProductId] : []);
                const inCart = !ids.length || (items||[]).some((line) => ids.includes(line.slug));
                return <VoucherRow key={v.code} v={v} subtotal={subtotal} inCart={inCart} productNames={productNames||{}} onPick={apply} />;
              })}
            </ScrollView>
            <View style={st.manualRow}>
              <TextInput style={st.manualInput} placeholder="Hoặc nhập mã khác" placeholderTextColor={C.muted}
                autoCapitalize="characters" value={code} onChangeText={setCode} />
              <Pressable style={st.manualBtn} onPress={()=>apply(code)} disabled={checking}>
                <Text style={{ color:'#fff', fontFamily:F.bodyB, fontSize:13 }}>{checking?'...':'Áp dụng'}</Text>
              </Pressable>
            </View>
            {!!msg && <Text style={st.msg}>{msg}</Text>}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  trigger:{ flexDirection:'row', alignItems:'center', gap:9, minHeight:48, borderWidth:1, borderColor:C.line, borderRadius:12, backgroundColor:C.card, paddingHorizontal:13 },
  applied:{ flexDirection:'row', alignItems:'center', gap:8, borderWidth:1, borderColor:C.primary, backgroundColor:C.washi2, borderRadius:12, padding:12 },
  link:{ fontFamily:F.bodyB, fontSize:12, color:C.ink },
  linkMuted:{ fontFamily:F.bodyB, fontSize:12, color:C.muted },

  backdrop:{ flex:1, backgroundColor:'rgba(17,12,8,0.5)', justifyContent:'flex-end' },
  sheet:{ backgroundColor:C.card, borderTopLeftRadius:22, borderTopRightRadius:22, padding:18, paddingBottom:26 },
  sheetHead:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  sheetTitle:{ fontFamily:F.display, fontSize:17, color:C.sumi },
  empty:{ textAlign:'center', color:C.muted, fontFamily:F.body, fontSize:12.5, marginVertical:24 },

  row:{ flexDirection:'row', alignItems:'center', gap:11, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.hair },
  rowDisabled:{ opacity:0.45 },
  tag:{ width:34, height:34, borderRadius:10, backgroundColor:C.washi2, alignItems:'center', justifyContent:'center' },
  tagFlag:{ backgroundColor:'rgba(255,255,255,0.72)' },
  code:{ fontFamily:F.bodyX, fontSize:13, color:C.ink, letterSpacing:0.3 },
  flagBadge:{ backgroundColor:C.inverseSurface, borderRadius:999, paddingVertical:2, paddingHorizontal:7 },
  flagBadgeT:{ fontFamily:F.bodyB, fontSize:9, color:'rgba(255,255,255,0.72)' },
  desc:{ fontFamily:F.body, fontSize:11, color:C.muted, marginTop:2 },
  scopeNote:{ fontFamily:F.body, fontSize:11, color:C.primary, marginTop:2 },
  needMore:{ fontFamily:F.body, fontSize:10.5, color:C.danger, marginTop:2 },

  manualRow:{ flexDirection:'row', gap:8, marginTop:12 },
  manualInput:{ flex:1, minHeight:46, borderWidth:1, borderColor:C.line, borderRadius:12, backgroundColor:C.card, paddingHorizontal:13, fontFamily:F.body, fontSize:13, color:C.ink },
  manualBtn:{ height:46, paddingHorizontal:16, borderRadius:12, backgroundColor:C.primary, alignItems:'center', justifyContent:'center' },
  msg:{ fontFamily:F.body, fontSize:11.5, color:C.danger, marginTop:8 },
});
