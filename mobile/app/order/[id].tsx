import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Modal, Pressable, TextInput, RefreshControl, AppState } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Btn, money, ProgressBar, PulseDot, FadeSlideIn } from '../../components/ui';
import { PRODUCTS } from '../../lib/catalog';
import {
  getOrderDetail, createProductReview, createReturnRequest, createCancelRequest, getProductReviews,
  getReturnableItems, confirmOrderReceived, shipBackReturn, withdrawReturnRequest,
  ApiOrder, ReturnRequest, ReturnableItem, ReturnWindow, StripePaymentRecord,
} from '../../lib/api';
import { C, F } from '../../theme/tokens';
import { SmartImage } from '../../components/SmartImage';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { MediaAttachPicker } from '../../components/MediaAttach';
import { ReviewMediaPick, pickReturnPhotos } from '../../lib/media';

// Vòng đời đơn có 5 chặng, trong đó "Đã giao" là do ĐƠN VỊ VẬN CHUYỂN xác nhận
// còn "Đã nhận" là do CHÍNH KHÁCH xác nhận — hai việc khác nhau, xem
// backend/lib/fulfillmentPolicy.js.
const CHAIN = ['pending','confirmed','shipping','delivered','completed'];
const STAGE:Record<string,string> = { pending:'CHỜ XÁC NHẬN', pending_payment:'CHỜ THANH TOÁN', confirmed:'ĐÃ XÁC NHẬN', shipping:'ĐANG GIAO', delivered:'ĐÃ GIAO TỚI BẠN', completed:'ĐÃ NHẬN HÀNG', cancelled:'ĐÃ HUỶ', returned:'ĐÃ TRẢ HÀNG' };
const RETURN_STATUS:Record<string,string>={requested:'Đang chờ cửa hàng duyệt',approved:'Đã duyệt · hãy gửi hàng về cửa hàng',shipped_back:'Đã gửi hàng về · chờ cửa hàng nhận',received:'Cửa hàng đã nhận & kiểm hàng',refund_pending:'Đang hoàn tiền',refunded:'Đã hoàn tiền',refund_failed:'Hoàn tiền lỗi · đang xử lý',rejected:'Yêu cầu bị từ chối',cancelled:'Đã huỷ yêu cầu'};
const returnStatusLabel=(status:string,kind?:string)=>{if(kind==='cancel'&&status==='approved')return'Đã duyệt · đơn đã được huỷ';return RETURN_STATUS[status]||status;};
const RETURN_REASONS=['Sản phẩm bị lỗi/hư hỏng','Giao sai mẫu, sai màu hoặc thiếu hàng','Sản phẩm không đúng mô tả','Không vừa kích thước','Đổi ý, không còn nhu cầu'];
// Lỗi thuộc về cửa hàng thì cửa hàng chịu phí chiều về — nói rõ ngay lúc chọn
// lý do để khách không bất ngờ về chi phí.
const SHOP_FAULT_REASONS=['Sản phẩm bị lỗi/hư hỏng','Giao sai mẫu, sai màu hoặc thiếu hàng','Sản phẩm không đúng mô tả'];
const CANCEL_REASONS=['Đổi ý, không muốn mua nữa','Đặt nhầm sản phẩm/địa chỉ','Tìm được giá tốt hơn','Muốn đổi phương thức thanh toán'];
const CANCELLABLE_STATUSES=['pending','pending_payment','confirmed'];
const RETURNABLE_STATUSES=['delivered','completed'];
const CANCEL_POLICY='Bạn có thể yêu cầu huỷ khi đơn CHƯA được bàn giao cho đơn vị vận chuyển. Yêu cầu cần nêu lý do cụ thể và sẽ được cửa hàng xem xét — không huỷ ngay lập tức. Nếu được chấp nhận, đơn sẽ huỷ và số tiền đã thanh toán trực tuyến (nếu có) được hoàn theo đúng phương thức đã dùng. Nếu bị từ chối, đơn tiếp tục được xử lý và giao đến bạn như bình thường. Khi đơn đã bàn giao vận chuyển hoặc đã giao, vui lòng dùng "Đổi/Trả hàng" thay vì huỷ.';

const Item = ({ it,canReview,onReview,reviewed,vipDiscount }:{ it:ApiOrder['items'][number];canReview?:boolean;reviewed?:boolean;vipDiscount?:number;onReview?:()=>void }) => {
  const p = PRODUCTS.find(x=>x.slug===(it.slug||it.productId));
  return (
    <View style={st.item}>
      {p ? <SmartImage source={p.images[0]} style={{ width:56, height:68, borderRadius:9 }} recyclingKey={`${p.slug}-order`} />
        : <View style={[st.itemFallback,{ backgroundColor:it.colorHex||C.washi2 }]} />}
      <View style={{ flex:1, marginLeft:12 }}>
        <Text style={{ fontFamily:F.bodyB, fontSize:13, color:C.ink }}>{it.name}</Text>
        <Text style={{ fontFamily:F.body, fontSize:11.5, color:C.muted }}>{it.colorName} · {it.size} · x{it.qty}</Text>
        {!!vipDiscount&&<View style={st.vipItemBadge}><Ionicons name="diamond" size={10} color={C.onPrimary}/><Text style={st.vipItemBadgeT}>VIP -10% cho 1 món · tiết kiệm {money(vipDiscount)}</Text></View>}
      </View>
      <View style={{alignItems:'flex-end',gap:7}}><Text style={{ fontFamily:F.bodyX, fontSize:13, color:C.ink }}>{money(it.price*it.qty)}</Text>{(canReview||reviewed)&&<Pressable style={reviewed?st.reviewedBtn:st.reviewBtn} disabled={reviewed} onPress={onReview}><Text style={reviewed?st.reviewedBtnT:st.reviewBtnT}>{reviewed?'✓ Đã đánh giá':'Đánh giá'}</Text></Pressable>}</View>
    </View>
  );
};
const Row = ({ k, v, shu }:{k:string;v:string;shu?:boolean}) => (
  <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:5 }}><Text style={{ fontFamily:F.body, fontSize:13, color:C.muted }}>{k}</Text><Text style={{ fontFamily:F.bodyM, fontSize:13, color:shu?C.shu:C.ink }}>{v}</Text></View>
);

export default function OrderDetail() {
  const {user}=useAuth();
  const {toast}=useToast();
  const router=useRouter();
  const { id } = useLocalSearchParams<{ id:string }>();
  const [order, setOrder] = useState<ApiOrder|null|undefined>(undefined);
  const [payment,setPayment]=useState<StripePaymentRecord|null>(null);
  const [returnRequest,setReturnRequest]=useState<ReturnRequest|null>(null);
  const [returnRequests,setReturnRequests]=useState<ReturnRequest[]>([]);
  const [returnable,setReturnable]=useState<ReturnableItem[]>([]);
  const [returnWindow,setReturnWindow]=useState<ReturnWindow|null>(null);
  const [returnOpen,setReturnOpen]=useState(false);
  const [reason,setReason]=useState(RETURN_REASONS[0]);
  const [note,setNote]=useState('');
  const [photos,setPhotos]=useState<string[]>([]);
  // Khoá "sản phẩm → số lượng muốn trả"; 0 nghĩa là không trả món đó.
  const [pickedQty,setPickedQty]=useState<Record<string,number>>({});
  const [sending,setSending]=useState(false);
  const [returnError,setReturnError]=useState('');
  const [confirming,setConfirming]=useState(false);
  const [cancelOpen,setCancelOpen]=useState(false);
  const [cancelReason,setCancelReason]=useState(CANCEL_REASONS[0]);
  const [cancelNote,setCancelNote]=useState('');
  const [cancelSending,setCancelSending]=useState(false);
  const [cancelError,setCancelError]=useState('');
  const [reviewEligibility,setReviewEligibility]=useState<Record<string,{canReview:boolean;alreadyReviewed:boolean}>>({});
  const [reviewProduct,setReviewProduct]=useState<ApiOrder['items'][number]|null>(null);
  const [reviewRating,setReviewRating]=useState(5);
  const [reviewComment,setReviewComment]=useState('');
  const [reviewError,setReviewError]=useState('');
  const [reviewMessage,setReviewMessage]=useState('');
  const [reviewSending,setReviewSending]=useState(false);
  const [reviewMedia,setReviewMedia]=useState<ReviewMediaPick|null>(null);

  const [refreshing,setRefreshing]=useState(false);
  const hasLoadedRef=useRef(false);
  const load=useCallback((opts?:{silent?:boolean})=>{
    if(!opts?.silent)setRefreshing(true);
    return getOrderDetail(String(id||'')).then(result => {
      hasLoadedRef.current=true;
      setOrder(result.order);setPayment(result.payment);setReturnRequest(result.returnRequest);
      setReturnRequests(result.returnRequests||(result.returnRequest?[result.returnRequest]:[]));
      // Đơn nhiều món: hỏi backend còn món nào chưa nằm trong yêu cầu trả nào.
      if(RETURNABLE_STATUSES.includes(String(result.order.status))){
        void getReturnableItems(result.order.id)
          .then(data=>{setReturnable(data.items||[]);setReturnWindow(data.window||null);})
          .catch(()=>undefined);
      }else{ setReturnable([]); setReturnWindow(null); }
      const slugs=[...new Set(result.order.items.map(item=>String(item.slug||item.productId)).filter(Boolean))];
      void Promise.all(slugs.map(async slug=>[slug,(await getProductReviews(slug,user?.id||'')).eligibility] as const)).then(rows=>setReviewEligibility(Object.fromEntries(rows))).catch(()=>undefined);
    }).catch(() => { if(!hasLoadedRef.current)setOrder(null); })
      .finally(()=>setRefreshing(false));
  },[id,user?.id]);

  // Trạng thái đơn/hoàn tiền đổi bên admin phải thấy gần như ngay trên điện
  // thoại — không bắt khách kéo tay hay thoát vào lại màn hình. Focus lại màn
  // hình (quay lại từ tab khác) VÀ vòng lặp nhẹ mỗi 6 giây trong lúc đang xem
  // đều gọi lại API; kéo xuống vẫn dùng được để làm mới ngay lập tức.
  useFocusEffect(useCallback(() => {
    let live=true;
    void load({silent:true});
    const timer=setInterval(()=>{ if(live && AppState.currentState==='active') void load({silent:true}); },6000);
    return () => { live=false; clearInterval(timer); };
  }, [load]));

  if (order === undefined) {
    return (
      <Screen><Header title={`Đơn #${id||''}`} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><ActivityIndicator color={C.ink} /></View>
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
  const step = CHAIN.indexOf(order.status==='pending_payment'?'pending':order.status);
  const cancelled = order.status === 'cancelled';
  const returned = order.status === 'returned';
  const nodes = ['Đặt hàng','Đóng gói','Đang giao','Đã giao','Đã nhận'];
  const knownDiscount=Number(order.voucherDiscount||0)+Number(order.paymentDiscount||0)+Number(order.vipDiscount||0);
  const otherDiscount=Math.max(0,Number(order.discount||0)-knownDiscount);
  const openReturnItems=returnable.filter(item=>item.remainingQty>0);
  const activeCancel=returnRequests.find(request=>request.kind==='cancel'&&!['rejected','cancelled'].includes(request.status));
  const awaitingShipBack=returnRequests.find(request=>request.kind==='return'&&request.status==='approved');
  const canReturn=RETURNABLE_STATUSES.includes(order.status)&&!!openReturnItems.length&&!returnWindow?.expired&&!activeCancel;
  const canCancel=CANCELLABLE_STATUSES.includes(order.status)&&!activeCancel;
  const canConfirmReceived=order.status==='delivered';

  const itemKey=(item:{slug?:string;productId?:string;colorName?:string;size?:string})=>[item.slug||item.productId||'',item.colorName||'',item.size||''].join('|');
  const selectedItems=openReturnItems
    .map(item=>({item,qty:pickedQty[itemKey(item)]??0}))
    .filter(row=>row.qty>0);
  // Ước tính tiền hoàn hiển thị cho khách: tiền hàng của đúng những món được
  // chọn, trừ phần giảm giá phân bổ theo tỉ lệ. Backend là nơi chốt con số cuối.
  const estimatedRefund=(()=>{
    if(!selectedItems.length)return 0;
    const subtotal=Math.max(1,Number(order.subtotal||0));
    const value=selectedItems.reduce((sum,row)=>sum+row.item.price*row.qty,0);
    const discount=Math.max(0,Number(order.discount||0));
    const allItems=openReturnItems.every(item=>(pickedQty[itemKey(item)]??0)>=item.remainingQty)
      &&returnable.every(item=>item.remainingQty>0||item.returnedQty>0);
    return Math.max(0,Math.round(value-discount*value/subtotal)+(allItems?Number(order.ship||0):0));
  })();

  const openReturnModal=()=>{
    // Mặc định chọn hết phần còn lại: khách trả cả đơn chỉ cần bấm gửi, còn
    // muốn trả vài món thì giảm số lượng những món không trả về 0.
    setPickedQty(Object.fromEntries(openReturnItems.map(item=>[itemKey(item),item.remainingQty])));
    setReturnError('');
    setReturnOpen(true);
  };
  const setQty=(item:ReturnableItem,qty:number)=>{
    setPickedQty(current=>({...current,[itemKey(item)]:Math.max(0,Math.min(item.remainingQty,qty))}));
  };

  const submitReturn=async()=>{
    if(sending)return;
    if(!selectedItems.length){setReturnError('Chọn ít nhất một sản phẩm bạn muốn trả.');return;}
    if(!photos.length){setReturnError('Vui lòng chụp ít nhất 1 ảnh sản phẩm/hàng hoá kèm theo.');return;}
    setSending(true);setReturnError('');
    try{
      const result=await createReturnRequest(order.id,{
        reason,note,photos,
        items:selectedItems.map(row=>({slug:String(row.item.slug||row.item.productId),colorName:row.item.colorName,size:row.item.size,qty:row.qty})),
      });
      setOrder(result.order);setReturnRequest(result.returnRequest);
      setReturnRequests(current=>[result.returnRequest,...current]);
      setReturnOpen(false);setPhotos([]);setPickedQty({});
      toast({message:`Đã gửi yêu cầu trả ${selectedItems.length} sản phẩm · dự kiến hoàn ${money(result.returnRequest.amount)}`,kind:'success',durationMs:5000});
      void load({silent:true});
    }
    catch(e:any){const message=e?.message||'Không gửi được yêu cầu trả hàng.';setReturnError(message);toast({message,kind:'error'});}
    finally{setSending(false);}
  };

  const confirmReceived=async()=>{
    if(confirming)return;
    setConfirming(true);
    try{
      const result=await confirmOrderReceived(order.id);
      setOrder(result.order);
      toast({message:`Cảm ơn bạn! Bạn có ${returnWindow?.days||30} ngày để đổi/trả nếu chưa ưng ý.`,kind:'success',durationMs:5000});
      void load({silent:true});
    }catch(e:any){toast({message:e?.message||'Không xác nhận được đơn hàng.',kind:'error'});}
    finally{setConfirming(false);}
  };
  const addReturnPhotos=async()=>{
    try{const picked=await pickReturnPhotos(photos.length);if(picked.length)setPhotos(current=>[...current,...picked]);}
    catch(e:any){setReturnError(e?.message||'Không chọn được ảnh.');}
  };
  const submitCancel=async()=>{
    if(cancelSending)return;setCancelSending(true);setCancelError('');
    try{
      const result=await createCancelRequest(order.id,{reason:cancelReason,note:cancelNote});
      setOrder(result.order);setReturnRequest(result.returnRequest);
      setReturnRequests(current=>[result.returnRequest,...current]);
      setCancelOpen(false);
      toast({message:'Đã gửi yêu cầu huỷ đơn · cửa hàng sẽ phản hồi sớm.',kind:'success'});
    }
    catch(e:any){const message=e?.message||'Không gửi được yêu cầu huỷ đơn.';setCancelError(message);toast({message,kind:'error'});}
    finally{setCancelSending(false);}
  };
  const submitReview=async()=>{
    if(!reviewProduct||!user||reviewSending)return;setReviewSending(true);setReviewError('');
    const slug=String(reviewProduct.slug||reviewProduct.productId);
    try{const result=await createProductReview(slug,{userId:user.id,userName:user.name,rating:reviewRating,comment:reviewComment,media:reviewMedia?.dataUri,mediaKind:reviewMedia?.kind});setReviewEligibility(current=>({...current,[slug]:{canReview:false,alreadyReviewed:true}}));setReviewMessage(result.message);setReviewProduct(null);setReviewComment('');setReviewRating(5);setReviewMedia(null);toast(result.message||'Đã gửi đánh giá của bạn ✓');}
    catch(e:any){const message=e?.message||'Không gửi được đánh giá.';setReviewError(message);toast({message,kind:'error'});}
    finally{setReviewSending(false);}
  };

  return (
    <Screen>
      <Header title={`Đơn #${order.code}`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal:18, paddingBottom:24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load()} tintColor={C.shu} colors={[C.shu]} />}>
        <View style={[st.track, (cancelled||returned) && { backgroundColor:returned?C.ink:C.danger }]}> 
          <Text style={{ fontFamily:F.displaySb, color:'rgba(255,255,255,0.72)', fontSize:11, letterSpacing:2 }}>TRẠNG THÁI · {STAGE[order.status]||''}</Text>
          <Text style={{ fontFamily:F.bodyX, fontSize:15, color:'#fff', marginTop:4 }}>
            {cancelled ? 'Đơn hàng đã bị huỷ'
              : returned ? 'Đã trả hàng và hoàn tiền'
              : order.status==='completed' ? 'Bạn đã xác nhận nhận hàng'
              : order.status==='delivered' ? 'Đơn vị vận chuyển đã giao tới bạn'
              : `Mã đơn ${order.code}`}
          </Text>
          <Pressable style={st.policyLink} onPress={()=>router.push('/policy' as any)} hitSlop={6}>
            <Ionicons name="shield-checkmark-outline" size={12} color={'rgba(255,255,255,0.72)'} />
            <Text style={st.policyLinkT}>Xem quy trình giao – nhận – đổi/trả</Text>
          </Pressable>
          {!cancelled&&!returned && (
            <View style={{ marginTop:10 }}>
              {/* Màn hình này tự làm mới mỗi 6 giây, nên đơn có thể tiến bước
                  ngay trước mắt khách. Thanh chạy tới mốc mới thay vì nhảy cóc,
                  và chấm của chặng ĐANG diễn ra đập nhịp — đó là cách nói "việc
                  này chưa xong, vẫn đang chạy" mà một chấm tĩnh không nói được. */}
              <View style={{ paddingHorizontal:'10%', marginBottom:8 }}>
                <ProgressBar
                  progress={nodes.length>1?Math.max(0,step)/(nodes.length-1):0}
                  height={3}
                  color="#fff"
                  track="rgba(255,255,255,0.25)"
                />
              </View>
              <View style={{ flexDirection:'row' }}>
                {nodes.map((n,i)=>(
                  <View key={n} style={{ flex:1, alignItems:'center' }}>
                    {i===step
                      ? <PulseDot size={11} color="#fff" />
                      : <View style={{ width:11, height:11, borderRadius:6, backgroundColor:i<step?'#fff':'rgba(255,255,255,0.35)' }} />}
                    <Text style={{ fontFamily:F.body, fontSize:10, color:i<=step?'#fff':'rgba(255,255,255,0.5)', marginTop:4 }}>{n}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
        <Text style={st.grp}>SẢN PHẨM</Text>
        {order.items.map((it,i)=>{const slug=String(it.slug||it.productId),eligibility=reviewEligibility[slug],vipOn=order.vipPromotion&&slug===order.vipPromotion.productId&&(!order.vipPromotion.colorName||it.colorName===order.vipPromotion.colorName)&&(!order.vipPromotion.size||it.size===order.vipPromotion.size);return <FadeSlideIn key={i} delay={Math.min(i,6)*45} offset={8}><Item it={it} vipDiscount={vipOn?order.vipDiscount:0} canReview={order.status==='completed'&&eligibility?.canReview} reviewed={eligibility?.alreadyReviewed} onReview={()=>{setReviewProduct(it);setReviewError('');setReviewMessage('');setReviewMedia(null);}}/></FadeSlideIn>;})}
        {!!reviewMessage&&<View style={st.reviewNotice}><Ionicons name="checkmark-circle" size={19} color={C.ok}/><Text style={st.reviewNoticeT}>{reviewMessage}</Text></View>}
        <Text style={st.grp}>GIAO TỚI</Text>
        <View style={st.addr}>
          <Text style={{ fontFamily:F.bodyM, fontSize:12.5, color:C.ink }}>{order.customer?.name} · {order.customer?.phone}</Text>
          <Text style={{ fontFamily:F.body, fontSize:12.5, color:C.muted, marginTop:2 }}>{order.address}</Text>
        </View>
        {canConfirmReceived&&(
          <View style={st.confirmCard}>
            <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
              <Ionicons name="cube-outline" size={22} color="#1F6B44" />
              <View style={{flex:1}}>
                <Text style={st.confirmTitle}>Đơn vị vận chuyển báo đã giao</Text>
                <Text style={st.returnMeta}>Hãy kiểm tra hàng rồi bấm xác nhận. Sau khi bạn xác nhận, cửa sổ đổi/trả {returnWindow?.days||30} ngày bắt đầu tính. Nếu bạn không bấm, hệ thống tự chốt đơn sau 7 ngày.</Text>
              </View>
            </View>
            <Btn label={confirming?'Đang xác nhận…':'Tôi đã nhận đúng hàng'} icon="checkmark-circle-outline" onPress={()=>void confirmReceived()} style={{marginTop:11}} />
          </View>
        )}

        {returnRequests.map(request=>(
          <View key={request.id} style={st.returnCard}>
            <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
              <Ionicons name={request.kind==='cancel'?'close-circle-outline':'return-down-back'} size={22} color={C.ink} />
              <View style={{flex:1}}>
                <Text style={st.returnTitle}>{request.kind==='cancel'?'Yêu cầu huỷ đơn':request.coversWholeOrder?'Trả toàn bộ đơn':'Trả một phần đơn'} · {request.code}</Text>
                <Text style={st.returnStatus}>{returnStatusLabel(request.status,request.kind)}</Text>
              </View>
            </View>
            {request.kind==='return'&&!!request.items?.length&&(
              <View style={st.returnItems}>
                {request.items.map((item,index)=>(
                  <Text key={index} style={st.returnItemT}>• {item.name} · {item.colorName}/{item.size} × {item.qty}</Text>
                ))}
              </View>
            )}
            <Text style={st.returnMeta}>Lý do: {request.reason}</Text>
            {request.kind==='return'&&(
              <>
                <Text style={st.returnMeta}>Số tiền hoàn dự kiến: <Text style={{fontFamily:F.bodyX,color:C.ink}}>{money(request.amount)}</Text></Text>
                {!!request.refundBreakdown&&(
                  <Text style={st.returnBreakdown}>
                    Tiền hàng {money(request.refundBreakdown.itemsValue)}
                    {request.refundBreakdown.discountAllocated>0?` − giảm giá phân bổ ${money(request.refundBreakdown.discountAllocated)}`:''}
                    {request.refundBreakdown.vipDiscountAllocated>0?` − VIP ${money(request.refundBreakdown.vipDiscountAllocated)}`:''}
                    {request.refundBreakdown.shipRefunded>0?` + phí vận chuyển ${money(request.refundBreakdown.shipRefunded)}`:''}
                  </Text>
                )}
              </>
            )}
            {!!request.adminNote&&<Text style={st.returnMeta}>Phản hồi cửa hàng: {request.adminNote}</Text>}
            {!!request.shipBack&&<Text style={st.returnMeta}>Vận đơn chiều về: {request.shipBack.carrier} · {request.shipBack.trackingCode}</Text>}
            {!!request.refundId&&<Text selectable style={st.returnCode}>Mã hoàn tiền: {request.refundId}</Text>}
            {request.status==='requested'&&(
              <Pressable style={st.withdrawBtn} onPress={()=>{
                void withdrawReturnRequest(request.id)
                  .then(()=>{toast({message:'Đã rút yêu cầu.',kind:'info'});void load({silent:true});})
                  .catch((e:any)=>toast({message:e?.message||'Không rút được yêu cầu.',kind:'error'}));
              }}><Text style={st.withdrawBtnT}>Rút lại yêu cầu</Text></Pressable>
            )}
          </View>
        ))}

        {!!awaitingShipBack&&<ShipBackCard request={awaitingShipBack} onDone={()=>void load({silent:true})} />}

        {canCancel&&<View style={st.returnOffer}><View style={{flex:1}}><Text style={st.returnTitle}>Cần huỷ đơn?</Text><Text style={st.returnMeta}>Đơn chưa bàn giao đơn vị vận chuyển — bạn có thể gửi yêu cầu huỷ, cửa hàng sẽ xem xét và phản hồi sớm.</Text></View><Pressable style={[st.returnBtn,{backgroundColor:C.danger}]} onPress={()=>setCancelOpen(true)}><Text style={st.returnBtnT}>Huỷ đơn</Text></Pressable></View>}
        {canReturn&&<View style={st.returnOffer}><View style={{flex:1}}><Text style={st.returnTitle}>Cần trả hàng?</Text><Text style={st.returnMeta}>Chọn đúng những sản phẩm muốn trả — đơn nhiều món không phải trả hết. Còn {openReturnItems.length} sản phẩm có thể yêu cầu, hạn {returnWindow?.days||30} ngày kể từ khi bạn nhận hàng.</Text></View><Pressable style={st.returnBtn} onPress={openReturnModal}><Text style={st.returnBtnT}>Chọn món trả</Text></Pressable></View>}
        {RETURNABLE_STATUSES.includes(order.status)&&!openReturnItems.length&&!!returnable.length&&(
          <Text style={st.returnExhausted}>Mọi sản phẩm trong đơn đều đã có yêu cầu trả hàng.</Text>
        )}
        {!!returnWindow?.expired&&<Text style={st.returnExhausted}>Đơn đã quá hạn đổi/trả {returnWindow.days} ngày.</Text>}
        <View style={st.summary}>
          <Row k="Tạm tính" v={money(order.subtotal)} />
          {!!order.voucherDiscount&&<Row k="Mã giảm giá" v={`-${money(order.voucherDiscount)}`} shu />}
          {!!order.paymentDiscount&&<Row k="Ưu đãi thanh toán" v={`-${money(order.paymentDiscount)}`} shu />}
          {!!order.vipDiscount&&<Row k={`VIP 10% · ${order.vipPromotion?.productName||'1 sản phẩm'}`} v={`-${money(order.vipDiscount)}`} shu />}
          {!!otherDiscount&&<Row k="Giảm giá khác" v={`-${money(otherDiscount)}`} shu />}
          <Row k="Phí vận chuyển" v={money(order.ship)} />
          <View style={{ height:1, backgroundColor:C.hair, marginVertical:6 }} />
          <View style={{ flexDirection:'row', justifyContent:'space-between' }}><Text style={{ fontFamily:F.bodyX }}>Tổng</Text><Text style={{ fontFamily:F.bodyX, color:C.ink }}>{money(order.total)}</Text></View>
        </View>
      </ScrollView>
      <Modal visible={returnOpen} transparent animationType="fade" onRequestClose={()=>setReturnOpen(false)}>
        <View style={st.modalShade}><View style={st.modalBox}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={st.modalTitle}>Yêu cầu trả hàng</Text><Pressable hitSlop={10} onPress={()=>setReturnOpen(false)}><Ionicons name="close" size={23} color={C.ink}/></Pressable></View>
          <ScrollView style={{maxHeight:460}} keyboardShouldPersistTaps="handled">
            <Text style={st.modalSub}>Chọn đúng sản phẩm bạn muốn trả và số lượng của từng món. Những món không chọn vẫn thuộc về bạn.</Text>
            {openReturnItems.map(item=>{
              const key=itemKey(item);
              const qty=pickedQty[key]??0;
              return (
                <View key={key} style={[st.pickRow,qty>0&&st.pickRowOn]}>
                  <Pressable style={{flex:1}} onPress={()=>setQty(item,qty>0?0:item.remainingQty)}>
                    <Text style={st.pickName}>{item.name}</Text>
                    <Text style={st.pickMeta}>{item.colorName} · {item.size} · {money(item.price)}/món{item.returnedQty>0?` · đã yêu cầu ${item.returnedQty}`:''}</Text>
                  </Pressable>
                  <View style={st.stepper}>
                    <Pressable hitSlop={6} style={st.stepBtn} onPress={()=>setQty(item,qty-1)}><Ionicons name="remove" size={15} color={C.ink}/></Pressable>
                    <Text style={st.stepValue}>{qty}</Text>
                    <Pressable hitSlop={6} style={st.stepBtn} onPress={()=>setQty(item,qty+1)}><Ionicons name="add" size={15} color={C.ink}/></Pressable>
                  </View>
                  <Text style={st.pickMax}>/{item.remainingQty}</Text>
                </View>
              );
            })}
            <View style={st.estimateBox}>
              <Text style={st.estimateLabel}>Tiền hoàn ước tính</Text>
              <Text style={st.estimateValue}>{money(estimatedRefund)}</Text>
            </View>
            <Text style={st.estimateNote}>Phí vận chuyển chỉ được hoàn khi bạn trả toàn bộ đơn. Khoản giảm giá của đơn được chia lại theo tỉ lệ giá trị món trả. Cửa hàng chốt con số cuối khi duyệt yêu cầu.</Text>

            <Text style={st.photoLabel}>Lý do trả hàng</Text>
            {RETURN_REASONS.map(item=><Pressable key={item} style={[st.reason,reason===item&&st.reasonOn]} onPress={()=>setReason(item)}><View style={[st.radio,reason===item&&st.radioOn]}/><Text style={st.reasonT}>{item}</Text></Pressable>)}
            <Text style={st.feeNote}>
              {SHOP_FAULT_REASONS.includes(reason)
                ? '✓ Lỗi thuộc về cửa hàng — JAPANO chịu toàn bộ phí vận chuyển chiều về.'
                : '• Lý do thuộc về nhu cầu cá nhân — bạn chịu phí vận chuyển chiều về.'}
            </Text>
            <TextInput value={note} onChangeText={setNote} multiline placeholder="Ghi chú thêm (không bắt buộc)" placeholderTextColor={C.muted} style={st.note}/>
            <Text style={st.photoLabel}>Ảnh sản phẩm/hàng hoá (bắt buộc, tối đa 6 ảnh)</Text>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:4}}>
              {photos.map((uri,i)=>(
                <View key={i} style={st.photoThumbWrap}>
                  <SmartImage source={uri} style={st.photoThumb} recyclingKey={`return-photo-${i}`} />
                  <Pressable style={st.photoRemove} onPress={()=>setPhotos(current=>current.filter((_,idx)=>idx!==i))}><Ionicons name="close" size={13} color="#fff"/></Pressable>
                </View>
              ))}
              {photos.length<6&&<Pressable style={st.photoAdd} onPress={()=>void addReturnPhotos()}><Ionicons name="camera-outline" size={20} color={C.muted}/></Pressable>}
            </View>
            <Pressable style={st.policyBox} onPress={()=>{setReturnOpen(false);router.push('/policy' as any);}}>
              <Text style={st.policyTitle}>Quy trình sau khi bạn gửi yêu cầu</Text>
              <Text style={st.policyText}>1. Cửa hàng xem lý do và ảnh rồi duyệt hoặc từ chối.{'\n'}2. Được duyệt → bạn gửi hàng qua đơn vị vận chuyển và nhập mã vận đơn trong ứng dụng.{'\n'}3. Cửa hàng nhận và kiểm hàng.{'\n'}4. Hàng đạt điều kiện → hoàn tiền về đúng phương thức bạn đã thanh toán (đơn COD được chuyển khoản thủ công).</Text>
              <Text style={st.policyMore}>Xem chính sách đầy đủ ›</Text>
            </Pressable>
            {!!returnError&&<Text style={st.returnError}>{returnError}</Text>}
            <Btn label={sending?'Đang gửi…':`Gửi yêu cầu trả ${selectedItems.length||0} sản phẩm`} onPress={()=>void submitReturn()}/>
          </ScrollView>
        </View></View>
      </Modal>
      <Modal visible={cancelOpen} transparent animationType="fade" onRequestClose={()=>setCancelOpen(false)}>
        <View style={st.modalShade}><View style={st.modalBox}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={st.modalTitle}>Yêu cầu huỷ đơn</Text><Pressable hitSlop={10} onPress={()=>setCancelOpen(false)}><Ionicons name="close" size={23} color={C.ink}/></Pressable></View>
          <ScrollView style={{maxHeight:460}} keyboardShouldPersistTaps="handled">
            <Text style={st.modalSub}>Chọn lý do. Yêu cầu sẽ được gửi tới trang quản trị để xem xét trước khi đơn được huỷ.</Text>
            {CANCEL_REASONS.map(item=><Pressable key={item} style={[st.reason,cancelReason===item&&st.reasonOn]} onPress={()=>setCancelReason(item)}><View style={[st.radio,cancelReason===item&&st.radioOn]}/><Text style={st.reasonT}>{item}</Text></Pressable>)}
            <TextInput value={cancelNote} onChangeText={setCancelNote} multiline placeholder="Ghi chú thêm (không bắt buộc)" placeholderTextColor={C.muted} style={st.note}/>
            <View style={st.policyBox}><Text style={st.policyTitle}>Chính sách huỷ đơn</Text><Text style={st.policyText}>{CANCEL_POLICY}</Text></View>
            {!!cancelError&&<Text style={st.returnError}>{cancelError}</Text>}
            <Btn label={cancelSending?'Đang gửi…':'Gửi yêu cầu huỷ đơn'} onPress={()=>void submitCancel()}/>
          </ScrollView>
        </View></View>
      </Modal>
      <Modal visible={Boolean(reviewProduct)} transparent animationType="fade" onRequestClose={()=>setReviewProduct(null)}><View style={st.modalShade}><View style={st.modalBox}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={st.modalTitle}>Đánh giá sản phẩm</Text><Pressable hitSlop={10} onPress={()=>setReviewProduct(null)}><Ionicons name="close" size={23} color={C.ink}/></Pressable></View><Text style={st.modalSub}>{reviewProduct?.name} · Mỗi sản phẩm chỉ được đánh giá một lần.</Text><View style={st.stars}>{[1,2,3,4,5].map(value=><Pressable key={value} onPress={()=>setReviewRating(value)} hitSlop={6}><Ionicons name={value<=reviewRating?'star':'star-outline'} size={34} color={C.kin}/></Pressable>)}</View><TextInput value={reviewComment} onChangeText={setReviewComment} multiline maxLength={2000} placeholder="Chia sẻ trải nghiệm thực tế về sản phẩm…" placeholderTextColor={C.muted} style={st.note}/><Text style={st.moderationHint}>Bình luận được AI kiểm tra công kích, phân biệt, từ nhạy cảm và cách viết lách luật. Phê bình sản phẩm trung thực vẫn được chấp nhận.</Text><MediaAttachPicker value={reviewMedia} onChange={setReviewMedia} />{!!reviewError&&<Text style={st.returnError}>{reviewError}</Text>}<Btn label={reviewSending?'Đang gửi…':'Gửi đánh giá'} onPress={()=>void submitReview()}/></View></View></Modal>
    </Screen>
  );
}
// Bước "khách gửi hàng về" tách riêng khỏi "cửa hàng đã nhận": mã vận đơn là
// bằng chứng bên thứ ba đã nhận kiện hàng, còn hàng về tới kho lại là việc của
// cửa hàng xác nhận. Nhờ vậy không ai đổ lỗi cho ai khi hàng thất lạc giữa đường.
function ShipBackCard({request,onDone}:{request:ReturnRequest;onDone:()=>void}){
  const {toast}=useToast();
  const [carrier,setCarrier]=useState('');
  const [code,setCode]=useState('');
  const [busy,setBusy]=useState(false);
  const deadline=request.shipBackDeadline?new Date(request.shipBackDeadline).toLocaleDateString('vi-VN'):'';

  const submit=async()=>{
    if(busy)return;
    if(!carrier.trim()){toast({message:'Nhập tên đơn vị vận chuyển bạn dùng để gửi hàng về.',kind:'error'});return;}
    if(code.trim().length<4){toast({message:'Nhập mã vận đơn chiều về (tối thiểu 4 ký tự).',kind:'error'});return;}
    setBusy(true);
    try{
      await shipBackReturn(request.id,{carrier:carrier.trim(),trackingCode:code.trim()});
      toast('Đã ghi nhận vận đơn · cửa hàng sẽ kiểm hàng ngay khi nhận được ✓');
      setCarrier('');setCode('');
      onDone();
    }catch(e:any){toast({message:e?.message||'Không cập nhật được vận đơn.',kind:'error'});}
    finally{setBusy(false);}
  };

  return (
    <View style={st.shipBackCard}>
      <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
        <Ionicons name="send-outline" size={19} color={C.ink} />
        <Text style={st.returnTitle}>Bước tiếp theo: gửi hàng về cửa hàng</Text>
      </View>
      <Text style={st.returnMeta}>Gửi {request.items?.map(item=>`${item.name} ×${item.qty}`).join(', ')} qua đơn vị vận chuyển{deadline?` trước ngày ${deadline}`:''}, rồi nhập mã vận đơn bên dưới để cửa hàng theo dõi.</Text>
      <TextInput value={carrier} onChangeText={setCarrier} placeholder="Đơn vị vận chuyển (GHN, GHTK, Viettel Post…)" placeholderTextColor={C.muted} style={st.shipInput} />
      <TextInput value={code} onChangeText={setCode} placeholder="Mã vận đơn chiều về" placeholderTextColor={C.muted} style={st.shipInput} autoCapitalize="characters" />
      <Btn label={busy?'Đang gửi…':'Xác nhận đã gửi hàng'} onPress={()=>void submit()} style={{marginTop:10}} />
    </View>
  );
}

const st = StyleSheet.create({
  track:{ backgroundColor:C.ai, borderRadius:14, padding:14, marginTop:4 },
  policyLink:{ flexDirection:'row', alignItems:'center', gap:5, marginTop:9 },
  policyLinkT:{ fontFamily:F.bodyB, fontSize:10.5, color:'rgba(255,255,255,0.72)', textDecorationLine:'underline' },
  confirmCard:{ backgroundColor:'#F0F7F0', borderWidth:1, borderColor:'#CBE3CC', borderRadius:14, padding:13, marginTop:12 },
  confirmTitle:{ fontFamily:F.bodyB, fontSize:13, color:'#1F6B44' },
  returnItems:{ marginTop:8, gap:2 },
  returnItemT:{ fontFamily:F.body, fontSize:11.5, lineHeight:17, color:C.ink },
  returnBreakdown:{ fontFamily:F.body, fontSize:10.5, lineHeight:16, color:C.muted, marginTop:4 },
  returnExhausted:{ fontFamily:F.body, fontSize:11.5, lineHeight:17, color:C.muted, textAlign:'center', marginTop:12 },
  withdrawBtn:{ alignSelf:'flex-start', marginTop:9, borderWidth:1, borderColor:C.line, borderRadius:9, paddingVertical:6, paddingHorizontal:11 },
  withdrawBtnT:{ fontFamily:F.bodyB, fontSize:10.5, color:C.ink },
  shipBackCard:{ backgroundColor:'#fff', borderWidth:1.5, borderColor:C.line, borderRadius:14, padding:13, marginTop:12 },
  shipInput:{ borderWidth:1, borderColor:C.line, borderRadius:11, paddingHorizontal:11, paddingVertical:10, marginTop:9, fontFamily:F.bodyM, fontSize:12.5, color:C.ink, backgroundColor:'#fff' },
  pickRow:{ flexDirection:'row', alignItems:'center', gap:8, borderWidth:1, borderColor:C.line, borderRadius:12, padding:10, marginBottom:8, backgroundColor:'#fff' },
  pickRowOn:{ borderColor:C.ink, backgroundColor:C.washi2 },
  pickName:{ fontFamily:F.bodyB, fontSize:12, color:C.ink },
  pickMeta:{ fontFamily:F.body, fontSize:10.5, lineHeight:15, color:C.muted, marginTop:2 },
  stepper:{ flexDirection:'row', alignItems:'center', gap:4, borderWidth:1, borderColor:C.line, borderRadius:9, paddingHorizontal:4, paddingVertical:2 },
  stepBtn:{ width:24, height:24, alignItems:'center', justifyContent:'center' },
  stepValue:{ minWidth:18, textAlign:'center', fontFamily:F.bodyX, fontSize:13, color:C.ink },
  pickMax:{ fontFamily:F.body, fontSize:11, color:C.muted },
  estimateBox:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:C.washi2, borderRadius:11, padding:11, marginTop:4 },
  estimateLabel:{ fontFamily:F.bodyB, fontSize:12, color:C.ink },
  estimateValue:{ fontFamily:F.displayX, fontSize:18, color:C.ink },
  estimateNote:{ fontFamily:F.body, fontSize:10.5, lineHeight:16, color:C.muted, marginTop:6 },
  feeNote:{ fontFamily:F.bodyM, fontSize:10.5, lineHeight:16, color:C.muted, marginTop:2, marginBottom:4 },
  policyMore:{ fontFamily:F.bodyB, fontSize:10.5, color:C.ink, marginTop:7 },
  grp:{ fontFamily:F.display, fontSize:12, color:C.muted, letterSpacing:1.5, marginTop:16, marginBottom:8 },
  item:{ flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:12, padding:10, marginBottom:10 },
  itemFallback:{ width:56, height:68, borderRadius:9 },
  vipItemBadge:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:4,backgroundColor:C.primary,borderRadius:999,paddingHorizontal:7,paddingVertical:3,marginTop:5},vipItemBadgeT:{fontFamily:F.bodyB,fontSize:9,color:C.ink},
  addr:{ backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:12, padding:12 },
  summary:{ backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:12, padding:12, marginTop:12 },
  returnCard:{backgroundColor:C.washi2,borderWidth:1,borderColor:C.line,borderRadius:14,padding:13,marginTop:12},
  returnOffer:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#fff',borderWidth:1,borderColor:C.line,borderRadius:14,padding:13,marginTop:12},
  returnTitle:{fontFamily:F.bodyB,fontSize:13,color:C.ink},returnStatus:{fontFamily:F.bodyB,fontSize:11,color:C.ink,marginTop:2},
  returnMeta:{fontFamily:F.body,fontSize:11.5,lineHeight:16,color:C.muted,marginTop:6},returnCode:{fontFamily:F.bodyM,fontSize:10.5,color:C.ink,marginTop:6},
  returnBtn:{backgroundColor:C.ink,borderRadius:10,paddingVertical:9,paddingHorizontal:11},returnBtnT:{color:'#fff',fontFamily:F.bodyB,fontSize:11},
  modalShade:{flex:1,backgroundColor:'rgba(26,20,16,.48)',alignItems:'center',justifyContent:'center',padding:22},modalBox:{width:'100%',maxWidth:430,backgroundColor:C.paper,borderRadius:20,padding:17},
  modalTitle:{fontFamily:F.display,fontSize:18,color:C.sumi},modalSub:{fontFamily:F.body,fontSize:11.5,lineHeight:17,color:C.muted,marginVertical:10},
  reason:{flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:C.line,borderRadius:11,padding:10,marginBottom:7,backgroundColor:'#fff'},reasonOn:{borderColor:C.ink,backgroundColor:'#F5F2FF'},
  radio:{width:17,height:17,borderRadius:9,borderWidth:1.5,borderColor:C.line},radioOn:{borderWidth:5,borderColor:C.ink},reasonT:{flex:1,fontFamily:F.bodyM,fontSize:12,color:C.ink},
  note:{minHeight:70,textAlignVertical:'top',borderWidth:1,borderColor:C.line,borderRadius:11,padding:10,fontFamily:F.body,fontSize:12,color:C.ink,backgroundColor:'#fff',marginVertical:4},returnError:{fontFamily:F.bodyM,fontSize:11,color:C.danger,marginBottom:7},
  reviewBtn:{backgroundColor:C.primary,borderRadius:8,paddingVertical:6,paddingHorizontal:9},reviewBtnT:{fontFamily:F.bodyB,fontSize:10,color:'#fff'},reviewedBtn:{backgroundColor:'#E8F6EC',borderRadius:8,paddingVertical:6,paddingHorizontal:9},reviewedBtnT:{fontFamily:F.bodyB,fontSize:10,color:C.ok},
  reviewNotice:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#E8F6EC',borderRadius:11,padding:10},reviewNoticeT:{flex:1,fontFamily:F.bodyM,fontSize:11.5,color:C.ok},stars:{flexDirection:'row',justifyContent:'center',gap:8,marginBottom:10},moderationHint:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:C.muted,marginVertical:8},
  photoLabel:{fontFamily:F.bodyB,fontSize:11.5,color:C.ink,marginTop:6,marginBottom:8},
  photoThumbWrap:{width:64,height:64,borderRadius:10,overflow:'visible'},photoThumb:{width:64,height:64,borderRadius:10,backgroundColor:C.washi2},
  photoRemove:{position:'absolute',top:-6,right:-6,width:20,height:20,borderRadius:10,backgroundColor:'#C24444',alignItems:'center',justifyContent:'center'},
  photoAdd:{width:64,height:64,borderRadius:10,borderWidth:1.5,borderColor:C.line,borderStyle:'dashed',alignItems:'center',justifyContent:'center',backgroundColor:'#fff'},
  policyBox:{backgroundColor:C.washi2,borderRadius:11,padding:11,marginTop:12,marginBottom:4},policyTitle:{fontFamily:F.bodyB,fontSize:11.5,color:C.ink,marginBottom:5},policyText:{fontFamily:F.body,fontSize:10.5,lineHeight:16,color:C.muted},
});
