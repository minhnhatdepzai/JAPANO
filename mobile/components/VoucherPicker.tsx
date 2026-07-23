import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { money } from './ui';
import { getVouchers, validateVoucher, voucherDiscountFor, ApiVoucher, AppliedVoucher } from '../lib/api';
import { C, F } from '../theme/tokens';

const discountLabel = (v:{type:string;value:number}) => v.type==='percent' ? `Giảm ${v.value}%` : `Giảm ${money(v.value)}`;

function VoucherRow({ v, subtotal, onPick }:{ v:ApiVoucher; subtotal:number; onPick:(code:string)=>void }) {
  const eligible = subtotal >= (v.min||0);
  const isFlag = v.source === 'flagcard-collection';
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
        {!eligible && <Text style={st.needMore}>Mua thêm {money((v.min||0)-subtotal)} để dùng mã này</Text>}
      </View>
      {eligible && <Ionicons name="chevron-forward" size={16} color={C.shu} />}
    </Pressable>
  );
}

export function VoucherField({ subtotal, voucher, onApply, onClear }:{
  subtotal:number; voucher:AppliedVoucher|null; onApply:(v:AppliedVoucher)=>void; onClear:()=>void;
}) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<ApiVoucher[]|null>(null);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setList(null); setMsg('');
    getVouchers().then(setList).catch(() => setList([]));
  }, [open]);

  const apply = async (rawCode:string) => {
    const value = rawCode.trim();
    if (!value || checking) return;
    setChecking(true); setMsg('');
    try {
      const res:any = await validateVoucher(value, subtotal);
      if (res?.ok) {
        onApply({ code:res.voucher.code, type:res.voucher.type, value:res.voucher.value, min:res.voucher.min });
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
          <Ionicons name="pricetag" size={16} color={C.shu} />
          <Text style={{ flex:1, fontFamily:F.bodyB, fontSize:13, color:C.shuDeep }}>{voucher.code} · -{money(voucherDiscountFor(subtotal, voucher))}</Text>
          <Pressable onPress={()=>setOpen(true)} hitSlop={6} style={{ marginRight:14 }}><Text style={st.link}>Đổi</Text></Pressable>
          <Pressable onPress={onClear} hitSlop={6}><Text style={st.linkMuted}>Bỏ</Text></Pressable>
        </View>
      ) : (
        <Pressable style={st.trigger} onPress={()=>setOpen(true)}>
          <Ionicons name="pricetag-outline" size={16} color={C.shu} />
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
              {list===null && <ActivityIndicator color={C.shu} style={{ marginVertical:24 }} />}
              {list!==null && !list.length && <Text style={st.empty}>Chưa có mã giảm giá khả dụng lúc này.</Text>}
              {(list||[]).map(v => <VoucherRow key={v.code} v={v} subtotal={subtotal} onPick={apply} />)}
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
  trigger:{ flexDirection:'row', alignItems:'center', gap:9, minHeight:48, borderWidth:1, borderColor:C.line, borderRadius:12, backgroundColor:'#fff', paddingHorizontal:13 },
  applied:{ flexDirection:'row', alignItems:'center', gap:8, borderWidth:1, borderColor:C.shu, backgroundColor:C.shuSoft, borderRadius:12, padding:12 },
  link:{ fontFamily:F.bodyB, fontSize:12, color:C.shu },
  linkMuted:{ fontFamily:F.bodyB, fontSize:12, color:C.muted },

  backdrop:{ flex:1, backgroundColor:'rgba(17,12,8,0.5)', justifyContent:'flex-end' },
  sheet:{ backgroundColor:'#fff', borderTopLeftRadius:22, borderTopRightRadius:22, padding:18, paddingBottom:26 },
  sheetHead:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  sheetTitle:{ fontFamily:F.display, fontSize:17, color:C.sumi },
  empty:{ textAlign:'center', color:C.muted, fontFamily:F.body, fontSize:12.5, marginVertical:24 },

  row:{ flexDirection:'row', alignItems:'center', gap:11, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.hair },
  rowDisabled:{ opacity:0.45 },
  tag:{ width:34, height:34, borderRadius:10, backgroundColor:C.shuSoft, alignItems:'center', justifyContent:'center' },
  tagFlag:{ backgroundColor:'#F6D6B4' },
  code:{ fontFamily:F.bodyX, fontSize:13, color:C.ink, letterSpacing:0.3 },
  flagBadge:{ backgroundColor:C.sumi, borderRadius:999, paddingVertical:2, paddingHorizontal:7 },
  flagBadgeT:{ fontFamily:F.bodyB, fontSize:9, color:'#F6D6B4' },
  desc:{ fontFamily:F.body, fontSize:11, color:C.muted, marginTop:2 },
  needMore:{ fontFamily:F.body, fontSize:10.5, color:C.danger, marginTop:2 },

  manualRow:{ flexDirection:'row', gap:8, marginTop:12 },
  manualInput:{ flex:1, minHeight:46, borderWidth:1, borderColor:C.line, borderRadius:12, backgroundColor:'#fff', paddingHorizontal:13, fontFamily:F.body, fontSize:13, color:C.ink },
  manualBtn:{ height:46, paddingHorizontal:16, borderRadius:12, backgroundColor:C.shu, alignItems:'center', justifyContent:'center' },
  msg:{ fontFamily:F.body, fontSize:11.5, color:C.danger, marginTop:8 },
});
