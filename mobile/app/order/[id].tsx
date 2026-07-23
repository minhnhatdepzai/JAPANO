import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Modal, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Btn, money } from '../../components/ui';
import { PRODUCTS } from '../../lib/catalog';
import { getOrderDetail, createProductReview, createReturnRequest, getProductReviews, ApiOrder, ReturnRequest, StripePaymentRecord } from '../../lib/api';
import { C, F } from '../../theme/tokens';
import { SmartImage } from '../../components/SmartImage';
import { useAuth } from '../../lib/auth';

const CHAIN = ['pending','confirmed','shipping','completed'];
const STAGE:Record<string,string> = { pending:'CHỜ XỬ LÝ', confirmed:'ĐÃ XÁC NHẬN', shipping:'ĐANG GIAO', completed:'ĐÃ GIAO', cancelled:'ĐÃ HUỶ', returned:'ĐÃ TRẢ HÀNG' };
const RETURN_STATUS:Record<string,string>={requested:'Đang chờ duyệt',approved:'Đã duyệt · gửi hàng về cửa hàng',received:'Cửa hàng đã nhận hàng',refund_pending:'Stripe đang hoàn tiền',refunded:'Đã hoàn tiền về thẻ',refund_failed:'Hoàn tiền lỗi · đang xử lý',rejected:'Yêu cầu bị từ chối',cancelled:'Đã huỷ yêu cầu'};
const RETURN_REASONS=['Không vừa kích thước','Sản phẩm không đúng mô tả','Sản phẩm bị lỗi/hư hỏng','Đổi ý, không còn nhu cầu'];

const Item = ({ it,canReview,onReview,reviewed }:{ it:ApiOrder['items'][number];canReview?:boolean;reviewed?:boolean;onReview?:()=>void }) => {
  const p = PRODUCTS.find(x=>x.slug===(it.slug||it.productId));
  return (
    <View style={st.item}>
      {p ? <SmartImage source={p.images[0]} style={{ width:56, height:68, borderRadius:9 }} recyclingKey={`${p.slug}-order`} />
        : <View style={[st.itemFallback,{ backgroundColor:it.colorHex||C.washi2 }]} />}
      <View style={{ flex:1, marginLeft:12 }}>
        <Text style={{ fontFamily:F.bodyB, fontSize:13, color:C.ink }}>{it.name}</Text>
        <Text style={{ fontFamily:F.body, fontSize:11.5, color:C.muted }}>{it.colorName} · {it.size} · x{it.qty}</Text>
      </View>
      <View style={{alignItems:'flex-end',gap:7}}><Text style={{ fontFamily:F.bodyX, fontSize:13, color:C.shu }}>{money(it.price*it.qty)}</Text>{(canReview||reviewed)&&<Pressable style={reviewed?st.reviewedBtn:st.reviewBtn} disabled={reviewed} onPress={onReview}><Text style={reviewed?st.reviewedBtnT:st.reviewBtnT}>{reviewed?'✓ Đã đánh giá':'Đánh giá'}</Text></Pressable>}</View>
    </View>
  );
};
const Row = ({ k, v, shu }:{k:string;v:string;shu?:boolean}) => (
  <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:5 }}><Text style={{ fontFamily:F.body, fontSize:13, color:C.muted }}>{k}</Text><Text style={{ fontFamily:F.bodyM, fontSize:13, color:shu?C.shu:C.ink }}>{v}</Text></View>
);

export default function OrderDetail() {
  const {user}=useAuth();
  const { id } = useLocalSearchParams<{ id:string }>();
  const [order, setOrder] = useState<ApiOrder|null|undefined>(undefined);
  const [payment,setPayment]=useState<StripePaymentRecord|null>(null);
  const [returnRequest,setReturnRequest]=useState<ReturnRequest|null>(null);
  const [returnOpen,setReturnOpen]=useState(false);
  const [reason,setReason]=useState(RETURN_REASONS[0]);
  const [note,setNote]=useState('');
  const [sending,setSending]=useState(false);
  const [returnError,setReturnError]=useState('');
  const [reviewEligibility,setReviewEligibility]=useState<Record<string,{canReview:boolean;alreadyReviewed:boolean}>>({});
  const [reviewProduct,setReviewProduct]=useState<ApiOrder['items'][number]|null>(null);
  const [reviewRating,setReviewRating]=useState(5);
  const [reviewComment,setReviewComment]=useState('');
  const [reviewError,setReviewError]=useState('');
  const [reviewMessage,setReviewMessage]=useState('');
  const [reviewSending,setReviewSending]=useState(false);

  useEffect(() => {
    let live = true;
    getOrderDetail(String(id||'')).then(result => {
      if (!live) return;
      setOrder(result.order);setPayment(result.payment);setReturnRequest(result.returnRequest);
      const slugs=[...new Set(result.order.items.map(item=>String(item.slug||item.productId)).filter(Boolean))];
      void Promise.all(slugs.map(async slug=>[slug,(await getProductReviews(slug,user?.id||'')).eligibility] as const)).then(rows=>{if(live)setReviewEligibility(Object.fromEntries(rows));}).catch(()=>undefined);
    }).catch(() => { if (live) setOrder(null); });
    return () => { live = false; };
  }, [id,user?.id]);

  if (order === undefined) {
    return (
      <Screen><Header title={`Đơn #${id||''}`} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><ActivityIndicator color={C.shu} /></View>
      </Screen>
    );
  }
  if (!order) {
    return (
      <Screen><Header title="Đơn hàng" />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:30 }}>
          <Ionicons name="receipt-outline" size={44} color={C.hair} />
          <Text style={{ fontFamily:F.bodyM, fontSize:14, color:C.muted, marginTop:12, textAlign:'center' }}>Không tìm thấy đơn #{id}</Text>
        </View>
      </Screen>
    );
  }
  const step = CHAIN.indexOf(order.status);
  const cancelled = order.status === 'cancelled';
  const returned = order.status === 'returned';
  const nodes = ['Xác nhận','Đóng gói','Đang giao','Đã nhận'];
  const canReturn=order.status==='completed'&&payment?.provider==='stripe'&&['paid','partially_refunded'].includes(payment.status)&&!returnRequest;
  const submitReturn=async()=>{
    if(sending)return;setSending(true);setReturnError('');
    try{const result=await createReturnRequest(order.id,{reason,note});setOrder(result.order);setReturnRequest(result.returnRequest);setReturnOpen(false);}
    catch(e:any){setReturnError(e?.message||'Không gửi được yêu cầu trả hàng.');}
    finally{setSending(false);}
  };
  const submitReview=async()=>{
    if(!reviewProduct||!user||reviewSending)return;setReviewSending(true);setReviewError('');
    const slug=String(reviewProduct.slug||reviewProduct.productId);
    try{const result=await createProductReview(slug,{userId:user.id,userName:user.name,rating:reviewRating,comment:reviewComment});setReviewEligibility(current=>({...current,[slug]:{canReview:false,alreadyReviewed:true}}));setReviewMessage(result.message);setReviewProduct(null);setReviewComment('');setReviewRating(5);}
    catch(e:any){setReviewError(e?.message||'Không gửi được đánh giá.');}
    finally{setReviewSending(false);}
  };

  return (
    <Screen>
      <Header title={`Đơn #${order.code}`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal:18, paddingBottom:24 }}>
        <View style={[st.track, (cancelled||returned) && { backgroundColor:returned?'#6D28D9':C.danger }]}> 
          <Text style={{ fontFamily:F.displaySb, color:'#f0d9b6', fontSize:11, letterSpacing:2 }}>TRẠNG THÁI · {STAGE[order.status]||''}</Text>
          <Text style={{ fontFamily:F.bodyX, fontSize:15, color:'#fff', marginTop:4 }}>
            {cancelled ? 'Đơn hàng đã bị huỷ' : returned?'Đã trả hàng và hoàn tiền':order.status==='completed' ? 'Đã giao thành công' : `Mã đơn ${order.code}`}
          </Text>
          {!cancelled&&!returned && (
            <View style={{ flexDirection:'row', marginTop:10 }}>
              {nodes.map((n,i)=>(
                <View key={n} style={{ flex:1, alignItems:'center' }}>
                  <View style={{ flexDirection:'row', alignItems:'center', width:'100%' }}>
                    <View style={{ flex:1, height:2, backgroundColor:i===0?'transparent':'rgba(255,255,255,0.7)' }} />
                    <View style={{ width:11, height:11, borderRadius:6, backgroundColor:i<=step?'#fff':'rgba(255,255,255,0.35)' }} />
                    <View style={{ flex:1, height:2, backgroundColor:i===nodes.length-1?'transparent':(i<step?'rgba(255,255,255,0.7)':'rgba(255,255,255,0.25)') }} />
                  </View>
                  <Text style={{ fontFamily:F.body, fontSize:10, color:i<=step?'#fff':'rgba(255,255,255,0.5)', marginTop:4 }}>{n}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <Text style={st.grp}>SẢN PHẨM</Text>
        {order.items.map((it,i)=>{const slug=String(it.slug||it.productId),eligibility=reviewEligibility[slug];return <Item key={i} it={it} canReview={order.status==='completed'&&eligibility?.canReview} reviewed={eligibility?.alreadyReviewed} onReview={()=>{setReviewProduct(it);setReviewError('');setReviewMessage('');}}/>;})}
        {!!reviewMessage&&<View style={st.reviewNotice}><Ionicons name="checkmark-circle" size={19} color={C.ok}/><Text style={st.reviewNoticeT}>{reviewMessage}</Text></View>}
        <Text style={st.grp}>GIAO TỚI</Text>
        <View style={st.addr}>
          <Text style={{ fontFamily:F.bodyM, fontSize:12.5, color:C.ink }}>{order.customer?.name} · {order.customer?.phone}</Text>
          <Text style={{ fontFamily:F.body, fontSize:12.5, color:C.muted, marginTop:2 }}>{order.address}</Text>
        </View>
        {!!returnRequest&&<View style={st.returnCard}>
          <View style={{flexDirection:'row',alignItems:'center',gap:9}}><Ionicons name="return-down-back" size={22} color="#6D28D9" /><View style={{flex:1}}><Text style={st.returnTitle}>Trả hàng · {returnRequest.code}</Text><Text style={st.returnStatus}>{RETURN_STATUS[returnRequest.status]||returnRequest.status}</Text></View></View>
          <Text style={st.returnMeta}>Lý do: {returnRequest.reason}</Text>
          <Text style={st.returnMeta}>Số tiền dự kiến: {money(returnRequest.amount)}</Text>
          {!!returnRequest.refundId&&<Text selectable style={st.returnCode}>Mã hoàn tiền: {returnRequest.refundId}</Text>}
        </View>}
        {canReturn&&<View style={st.returnOffer}><View style={{flex:1}}><Text style={st.returnTitle}>Cần trả hàng?</Text><Text style={st.returnMeta}>Gửi yêu cầu trong 30 ngày. Sau khi cửa hàng nhận hàng, khoản tiền thử nghiệm sẽ hoàn về đúng thẻ Stripe.</Text></View><Pressable style={st.returnBtn} onPress={()=>setReturnOpen(true)}><Text style={st.returnBtnT}>Yêu cầu trả</Text></Pressable></View>}
        <View style={st.summary}>
          <Row k="Tạm tính" v={money(order.subtotal)} />
          {order.discount>0 && <Row k="Giảm giá" v={`-${money(order.discount)}`} shu />}
          <Row k="Phí vận chuyển" v={money(order.ship)} />
          <View style={{ height:1, backgroundColor:C.hair, marginVertical:6 }} />
          <View style={{ flexDirection:'row', justifyContent:'space-between' }}><Text style={{ fontFamily:F.bodyX }}>Tổng</Text><Text style={{ fontFamily:F.bodyX, color:C.shu }}>{money(order.total)}</Text></View>
        </View>
      </ScrollView>
      <Modal visible={returnOpen} transparent animationType="fade" onRequestClose={()=>setReturnOpen(false)}>
        <View style={st.modalShade}><View style={st.modalBox}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={st.modalTitle}>Yêu cầu trả hàng</Text><Pressable hitSlop={10} onPress={()=>setReturnOpen(false)}><Ionicons name="close" size={23} color={C.ink}/></Pressable></View>
          <Text style={st.modalSub}>Chọn lý do. Yêu cầu sẽ được gửi tới trang quản trị để duyệt và hoàn về thẻ Stripe.</Text>
          {RETURN_REASONS.map(item=><Pressable key={item} style={[st.reason,reason===item&&st.reasonOn]} onPress={()=>setReason(item)}><View style={[st.radio,reason===item&&st.radioOn]}/><Text style={st.reasonT}>{item}</Text></Pressable>)}
          <TextInput value={note} onChangeText={setNote} multiline placeholder="Ghi chú thêm (không bắt buộc)" placeholderTextColor={C.muted} style={st.note}/>
          {!!returnError&&<Text style={st.returnError}>{returnError}</Text>}
          <Btn label={sending?'Đang gửi…':'Gửi yêu cầu trả hàng'} onPress={()=>void submitReturn()}/>
        </View></View>
      </Modal>
      <Modal visible={Boolean(reviewProduct)} transparent animationType="fade" onRequestClose={()=>setReviewProduct(null)}><View style={st.modalShade}><View style={st.modalBox}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={st.modalTitle}>Đánh giá sản phẩm</Text><Pressable hitSlop={10} onPress={()=>setReviewProduct(null)}><Ionicons name="close" size={23} color={C.ink}/></Pressable></View><Text style={st.modalSub}>{reviewProduct?.name} · Mỗi sản phẩm chỉ được đánh giá một lần.</Text><View style={st.stars}>{[1,2,3,4,5].map(value=><Pressable key={value} onPress={()=>setReviewRating(value)} hitSlop={6}><Ionicons name={value<=reviewRating?'star':'star-outline'} size={34} color={C.kin}/></Pressable>)}</View><TextInput value={reviewComment} onChangeText={setReviewComment} multiline maxLength={2000} placeholder="Chia sẻ trải nghiệm thực tế về sản phẩm…" placeholderTextColor={C.muted} style={st.note}/><Text style={st.moderationHint}>Bình luận được AI kiểm tra công kích, phân biệt, từ nhạy cảm và cách viết lách luật. Phê bình sản phẩm trung thực vẫn được chấp nhận.</Text>{!!reviewError&&<Text style={st.returnError}>{reviewError}</Text>}<Btn label={reviewSending?'Đang kiểm duyệt…':'Gửi đánh giá'} onPress={()=>void submitReview()}/></View></View></Modal>
    </Screen>
  );
}
const st = StyleSheet.create({
  track:{ backgroundColor:C.ai, borderRadius:14, padding:14, marginTop:4 },
  grp:{ fontFamily:F.display, fontSize:12, color:C.muted, letterSpacing:1.5, marginTop:16, marginBottom:8 },
  item:{ flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:12, padding:10, marginBottom:10 },
  itemFallback:{ width:56, height:68, borderRadius:9 },
  addr:{ backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:12, padding:12 },
  summary:{ backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:12, padding:12, marginTop:12 },
  returnCard:{backgroundColor:'#F2EEFF',borderWidth:1,borderColor:'#D9CFFF',borderRadius:14,padding:13,marginTop:12},
  returnOffer:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#fff',borderWidth:1,borderColor:C.line,borderRadius:14,padding:13,marginTop:12},
  returnTitle:{fontFamily:F.bodyB,fontSize:13,color:C.ink},returnStatus:{fontFamily:F.bodyB,fontSize:11,color:'#6D28D9',marginTop:2},
  returnMeta:{fontFamily:F.body,fontSize:11.5,lineHeight:16,color:C.muted,marginTop:6},returnCode:{fontFamily:F.bodyM,fontSize:10.5,color:'#6D28D9',marginTop:6},
  returnBtn:{backgroundColor:'#6D28D9',borderRadius:10,paddingVertical:9,paddingHorizontal:11},returnBtnT:{color:'#fff',fontFamily:F.bodyB,fontSize:11},
  modalShade:{flex:1,backgroundColor:'rgba(26,20,16,.48)',alignItems:'center',justifyContent:'center',padding:22},modalBox:{width:'100%',maxWidth:430,backgroundColor:C.paper,borderRadius:20,padding:17},
  modalTitle:{fontFamily:F.display,fontSize:18,color:C.sumi},modalSub:{fontFamily:F.body,fontSize:11.5,lineHeight:17,color:C.muted,marginVertical:10},
  reason:{flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:C.line,borderRadius:11,padding:10,marginBottom:7,backgroundColor:'#fff'},reasonOn:{borderColor:'#6D28D9',backgroundColor:'#F5F2FF'},
  radio:{width:17,height:17,borderRadius:9,borderWidth:1.5,borderColor:C.line},radioOn:{borderWidth:5,borderColor:'#6D28D9'},reasonT:{flex:1,fontFamily:F.bodyM,fontSize:12,color:C.ink},
  note:{minHeight:70,textAlignVertical:'top',borderWidth:1,borderColor:C.line,borderRadius:11,padding:10,fontFamily:F.body,fontSize:12,color:C.ink,backgroundColor:'#fff',marginVertical:4},returnError:{fontFamily:F.bodyM,fontSize:11,color:C.danger,marginBottom:7},
  reviewBtn:{backgroundColor:C.shu,borderRadius:8,paddingVertical:6,paddingHorizontal:9},reviewBtnT:{fontFamily:F.bodyB,fontSize:10,color:'#fff'},reviewedBtn:{backgroundColor:'#E8F6EC',borderRadius:8,paddingVertical:6,paddingHorizontal:9},reviewedBtnT:{fontFamily:F.bodyB,fontSize:10,color:C.ok},
  reviewNotice:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#E8F6EC',borderRadius:11,padding:10},reviewNoticeT:{flex:1,fontFamily:F.bodyM,fontSize:11.5,color:C.ok},stars:{flexDirection:'row',justifyContent:'center',gap:8,marginBottom:10},moderationHint:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:C.muted,marginVertical:8},
});
