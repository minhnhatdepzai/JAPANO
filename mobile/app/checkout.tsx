import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { CardForm, CardFormView, ConfirmPaymentResult, PaymentIntent, StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { Screen, Header, Btn, money } from '../components/ui';
import { PRODUCTS, variantPrice } from '../lib/catalog';
import { useStore } from '../lib/store';
import { confirmStripePaymentIntent, confirmVnpayReturn, createOrder, createStripePaymentIntent, createVnpayPaymentUrl, deleteSavedCard, getProvinces, getSavedCards, getStripeConfig, getVipStatus, getVnpayConfig, getWards, SavedCard, StripeConfig, VietnamLocation, VipStatus, VnpayConfig, voucherDiscountFor } from '../lib/api';
import { getDefaultAddress } from '../lib/addresses';
import { VoucherField } from '../components/VoucherPicker';
import { C, F } from '../theme/tokens';
import { emitBotEvent } from '../lib/botEvents';
import { useAuth } from '../lib/auth';

const SHIP = 30000;
const cartLineKey = (item:{slug:string;color:string;size:string}) => `${item.slug}::${item.color}::${item.size}`;
const Step = ({ n, label, on }:{n:number;label:string;on?:boolean}) => (
  <View style={{ alignItems:'center', flex:1 }}>
    <View style={[st.stepN, on&&{ backgroundColor:C.shu }]}><Text style={{ color:on?'#fff':C.muted, fontFamily:F.bodyB, fontSize:12 }}>{n}</Text></View>
    <Text style={{ fontFamily:F.bodyM, fontSize:11, color:on?C.ink:C.muted, marginTop:4 }}>{label}</Text>
  </View>
);
const Field = ({ label, value, onChangeText, placeholder, keyboardType }:{label:string;value:string;onChangeText:(value:string)=>void;placeholder?:string;keyboardType?:'default'|'phone-pad'}) => (
  <View style={{ marginBottom:12 }}>
    <Text style={st.lbl}>{label}</Text>
    <TextInput style={st.input} value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} placeholderTextColor={C.muted} />
  </View>
);

type ConfirmCardPayment = (
  clientSecret:string,
  data?:PaymentIntent.ConfirmParams,
  options?:PaymentIntent.ConfirmOptions,
) => Promise<ConfirmPaymentResult>;

export default function Checkout() {
  const [stripeConfig,setStripeConfig]=useState<StripeConfig|null>(null);
  const [vnpayConfig,setVnpayConfig]=useState<VnpayConfig|null>(null);
  const [configLoaded,setConfigLoaded]=useState(false);
  const [configError,setConfigError]=useState('');

  useEffect(()=>{
    let live=true;
    Promise.allSettled([getStripeConfig(),getVnpayConfig()]).then(([stripeResult,vnpayResult])=>{
      if(!live)return;
      if(stripeResult.status==='fulfilled'){setStripeConfig(stripeResult.value);setConfigError(stripeResult.value.enabled?'':'Thanh toán thẻ hiện chưa được cấu hình.');}
      else setConfigError(stripeResult.reason?.message||'Chưa kết nối được Stripe.');
      if(vnpayResult.status==='fulfilled')setVnpayConfig(vnpayResult.value);
    }).finally(()=>{if(live)setConfigLoaded(true);});
    return()=>{live=false;};
  },[]);

  if(!configLoaded){
    return <Screen><Header title="Thanh toán" /><View style={st.configLoading}><ActivityIndicator color={C.shu}/><Text style={st.configLoadingText}>Đang chuẩn bị thanh toán an toàn…</Text></View></Screen>;
  }
  if(stripeConfig?.enabled&&stripeConfig.publishableKey){
    return <StripeProvider publishableKey={stripeConfig.publishableKey} urlScheme="japano">
      <StripeCheckoutForm vnpayConfig={vnpayConfig} stripeMode={stripeConfig.mode} />
    </StripeProvider>;
  }
  return <CheckoutForm stripeAvailable={false} stripeSetupError={configError} vnpayConfig={vnpayConfig}/>;
}

function StripeCheckoutForm({vnpayConfig,stripeMode}:{vnpayConfig:VnpayConfig|null;stripeMode?:string}){
  const {confirmPayment}=useStripe();
  return <CheckoutForm stripeAvailable confirmCardPayment={confirmPayment} vnpayConfig={vnpayConfig} stripeMode={stripeMode}/>;
}

function CheckoutForm({stripeAvailable,confirmCardPayment,stripeSetupError='',vnpayConfig,stripeMode}:{stripeAvailable:boolean;confirmCardPayment?:ConfirmCardPayment;stripeSetupError?:string;vnpayConfig:VnpayConfig|null;stripeMode?:string}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ pay?: string }>();
  const { cart, cartSubtotal, voucher, setVoucher, clearVoucher, clearCart } = useStore();
  const { user } = useAuth();
  const [name,setName]=useState(user?.name||'');
  const [cardholderName,setCardholderName]=useState(user?.name||'');
  const [phone,setPhone]=useState('');
  const [street,setStreet]=useState('');
  const [provinces,setProvinces]=useState<VietnamLocation[]>([]);
  const [province,setProvince]=useState<VietnamLocation|null>(null);
  const [provinceQuery,setProvinceQuery]=useState('');
  const [provinceOpen,setProvinceOpen]=useState(false);
  const [wards,setWards]=useState<VietnamLocation[]>([]);
  const [ward,setWard]=useState<VietnamLocation|null>(null);
  const [wardQuery,setWardQuery]=useState('');
  const [wardOpen,setWardOpen]=useState(false);
  const [locationLoading,setLocationLoading]=useState(false);
  const [addressLocked,setAddressLocked]=useState(false);
  const vnpayAvailable = Boolean(vnpayConfig?.enabled);
  const [pay, setPay] = useState<'cod'|'card'|'vnpay'>(stripeAvailable?'card':'cod');
  const [cardComplete,setCardComplete]=useState(false);
  const cardFormRef=useRef<CardFormView.Methods|null>(null);
  const [savedCards,setSavedCards]=useState<SavedCard[]>([]);
  const [selectedCardId,setSelectedCardId]=useState('');
  const [savedCardsLoaded,setSavedCardsLoaded]=useState(false);
  const usingSavedCard = pay==='card' && !!selectedCardId;
  const [sending, setSending] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [vnpaySession,setVnpaySession]=useState<{paymentUrl:string;returnUrlMarker:string;orderId:string}|null>(null);
  const [vip,setVip]=useState<VipStatus|null>(null);
  const [vipLoading,setVipLoading]=useState(Boolean(user));
  const [selectedVipLine,setSelectedVipLine]=useState('');
  const vipCartItem=cart.find(item=>cartLineKey(item)===selectedVipLine);
  const vipProduct=vipCartItem?PRODUCTS.find(product=>product.slug===vipCartItem.slug):null;
  const voucherDisc = voucher ? voucherDiscountFor(cartSubtotal, voucher) : 0;
  const stripeDisc = pay === 'card' ? Math.round(cartSubtotal * 0.1) : 0;
  const vnpayDisc = pay === 'vnpay' ? Math.round(cartSubtotal * 0.05) : 0;
  // Máy chủ tính ưu đãi VIP trên đơn giá của DÒNG giỏ hàng (lib/vip.js dùng
  // selected.price, vốn đã là giá biến thể) — bản xem trước ở đây phải cùng cơ
  // sở, nếu không khách thấy một con số rồi bị trừ một con số khác.
  const vipUnitPrice = vipProduct&&vipCartItem ? variantPrice(vipProduct, vipCartItem.color, vipCartItem.size) : 0;
  const vipDisc = vip?.isVip&&vipProduct ? Math.round(vipUnitPrice * 0.1) : 0;
  const disc = Math.min(cartSubtotal, voucherDisc + stripeDisc + vnpayDisc + vipDisc);
  const grand = cartSubtotal - disc + SHIP;

  useEffect(() => {
    if (params.pay === 'cod' || (params.pay === 'card' && stripeAvailable) || (params.pay === 'vnpay' && vnpayAvailable)) {
      setPay(params.pay as 'cod'|'card'|'vnpay');
      setOrderError('');
    }
  }, [params.pay,stripeAvailable,vnpayAvailable]);

  useEffect(()=>{let live=true;getProvinces().then(items=>{if(live)setProvinces(items);}).catch(()=>setOrderError('Chưa tải được danh mục tỉnh/thành.'));return()=>{live=false;};},[]);
  useEffect(()=>{let live=true;if(!user){setVip(null);setVipLoading(false);return()=>{live=false;};}setVipLoading(true);getVipStatus(user.id).then(result=>{if(live)setVip(result.status);}).catch(()=>{if(live)setVip(null);}).finally(()=>{if(live)setVipLoading(false);});return()=>{live=false;};},[user?.id]);
  useEffect(()=>{if(!vip?.isVip||!cart.some(item=>cartLineKey(item)===selectedVipLine))setSelectedVipLine('');},[cart,vip?.isVip,selectedVipLine]);
  useEffect(()=>{let live=true;getDefaultAddress(user?.id).then(addr=>{
    if(!live||!addr)return;
    setName(addr.name);setPhone(addr.phone);setStreet(addr.street);
    setProvince({code:addr.provinceCode,name:addr.province});setProvinceQuery(addr.province);
    setWard({code:addr.wardCode,name:addr.ward});setWardQuery(addr.ward);
    setAddressLocked(true);
  });return()=>{live=false;};},[user?.id]);
  useEffect(()=>{if(!stripeAvailable||!user){setSavedCardsLoaded(true);return;}let live=true;getSavedCards().then(cards=>{if(!live)return;setSavedCards(cards);if(cards.length)setSelectedCardId(cards[0].id);}).catch(()=>{}).finally(()=>{if(live)setSavedCardsLoaded(true);});return()=>{live=false;};},[stripeAvailable,user?.id]);
  const removeSavedCard = async (id:string) => {
    try{await deleteSavedCard(id);setSavedCards(cards=>cards.filter(c=>c.id!==id));if(selectedCardId===id)setSelectedCardId('');}
    catch(e:any){showCheckoutError(e?.message||'Không xoá được thẻ đã lưu.');}
  };
  useEffect(()=>{if(!province){setWards([]);return;}let live=true;const timer=setTimeout(()=>{setLocationLoading(true);getWards(province.code,wardQuery,200).then(data=>{if(live)setWards(data.items);}).catch(()=>{if(live)setOrderError('Chưa tải được phường/xã.');}).finally(()=>{if(live)setLocationLoading(false);});},250);return()=>{live=false;clearTimeout(timer);};},[province?.code,wardQuery]);
  const shownProvinces=provinces.filter(item=>!provinceQuery.trim()||item.name.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(provinceQuery.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'')));
  const fullAddress=[street.trim(),ward?.name,province?.name].filter(Boolean).join(', ');

  const showCheckoutError = (message:string) => {
    setOrderError(message);
    Alert.alert('Chưa thể thanh toán', message, [{text:'Đã hiểu'}]);
  };

  const placeOrder = async () => {
    if (sending) return;
    if(!user){showCheckoutError('Vui lòng đăng nhập lại để xác định quyền lợi VIP.');return;}
    if (!cart.length) {
      const reason = 'Giỏ hàng đang trống.';
      showCheckoutError(reason);
      emitBotEvent({ type:'checkout_failed', reason, paymentMethod:pay });
      return;
    }
    if(!name.trim()){showCheckoutError('Vui lòng nhập họ tên người nhận.');return;}
    const phoneDigits=phone.replace(/\D/g,'');
    if(phoneDigits.length<9||phoneDigits.length>11){showCheckoutError('Vui lòng nhập số điện thoại hợp lệ từ 9 đến 11 chữ số.');return;}
    if(!province){showCheckoutError('Vui lòng chọn tỉnh hoặc thành phố.');return;}
    if(!ward){showCheckoutError('Vui lòng chọn phường, xã hoặc đặc khu.');return;}
    if(!street.trim()){showCheckoutError('Vui lòng nhập số nhà và tên đường.');return;}
    if(pay==='card'&&!stripeAvailable){showCheckoutError(stripeSetupError||'Thanh toán thẻ hiện chưa sẵn sàng.');return;}
    if(pay==='card'&&!usingSavedCard&&!cardholderName.trim()){showCheckoutError('Vui lòng nhập tên in trên thẻ.');return;}
    if(pay==='card'&&!usingSavedCard&&!cardComplete){showCheckoutError('Vui lòng nhập đầy đủ và kiểm tra lại thông tin thẻ.');return;}
    if(pay==='card'&&!confirmCardPayment){showCheckoutError('Stripe SDK chưa sẵn sàng trên thiết bị.');return;}
    if(pay==='vnpay'&&!vnpayAvailable){showCheckoutError('Thanh toán VNPay hiện chưa sẵn sàng.');return;}
    setOrderError('');
    setSending(true);
    const items = cart.map(c => {
      const p = PRODUCTS.find(x => x.slug === c.slug);
      return { slug: c.slug, name: p?.name || c.slug, colorName: c.color, colorHex: '#1A1410', size: c.size, qty: c.qty, price: p?.price || 0 };
    });
    // Chống tạo trùng đơn nếu requestJson thử lại (đổi base URL) hoặc mạng chập
    // chờn khiến app không nhận được phản hồi dù server đã tạo đơn thành công.
    const clientRequestId = `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const payload = {
      userId:user.id,
      clientRequestId,
      customer: { id:user.id, name: name.trim(), email: user.email || '', phone: phone.trim() },
      address: fullAddress,
      addressDetails:{street:street.trim(),wardCode:ward.code,ward:ward.name,provinceCode:province.code,province:province.name},
      items, total: grand, paymentMethod: pay === 'cod' ? 'COD' : pay === 'vnpay' ? 'VNPay' : 'Stripe',
      voucherCode: voucher?.code,
      vipSelection:vipCartItem?{productId:vipCartItem.slug,slug:vipCartItem.slug,colorName:vipCartItem.color,size:vipCartItem.size}:undefined,
      ...(usingSavedCard?{paymentMethodId:selectedCardId}:{}),
    };
    let order:any = null;
    let eligibility:any = null;
    let award:any = null;
    try {
      if (pay === 'vnpay') {
        const vnpay = await createVnpayPaymentUrl(payload);
        setSending(false);
        setVnpaySession({ paymentUrl: vnpay.paymentUrl, returnUrlMarker: vnpay.returnUrlMarker, orderId: vnpay.order.id });
        return;
      }
      if (pay === 'card') {
        const stripe = await createStripePaymentIntent(payload);
        order = stripe.order;
        eligibility = stripe.flagcardEligibility;
        if(stripe.payment.status==='paid'){
          clearCart();
          router.replace({pathname:'/payment-result',params:{orderId:order.id,status:'paid'}} as any);
          return;
        }
        if(!stripe.clientSecret)throw new Error('Stripe chưa trả mã xác nhận thanh toán.');
        if(stripe.intentStatus==='processing'){
          router.replace({pathname:'/payment-result',params:{orderId:order.id,status:'pending'}} as any);
          return;
        }
        const confirmation=await confirmCardPayment!(stripe.clientSecret,{
          paymentMethodType:'Card',
          paymentMethodData:{
            ...(usingSavedCard?{paymentMethodId:selectedCardId}:{}),
            billingDetails:{
              name:(usingSavedCard?name:cardholderName).trim(),
              email:user?.email||undefined,
              phone:phone.trim(),
              address:{line1:street.trim(),city:ward.name,state:province.name,country:'VN'},
            },
          },
        });
        if(confirmation.error)throw new Error(confirmation.error.localizedMessage||confirmation.error.message||'Stripe từ chối thanh toán.');
        if(!confirmation.paymentIntent)throw new Error('Stripe chưa trả kết quả xác nhận thanh toán.');
        const nativeStatus=confirmation.paymentIntent.status;
        if(!['Succeeded','Processing'].includes(nativeStatus))throw new Error(`Thanh toán chưa hoàn tất (${nativeStatus}).`);
        try{
          await confirmStripePaymentIntent(confirmation.paymentIntent.id,order.id);
        }catch(syncError){
          // Stripe has already accepted the card. The result screen polls the
          // backend and safely reconciles this PaymentIntent instead of charging again.
        }
        if(nativeStatus==='Succeeded')clearCart();
        router.replace({pathname:'/payment-result',params:{orderId:order.id,status:nativeStatus==='Succeeded'?'paid':'pending'}} as any);
        setSending(false);
        return;
      }
      const res:any = await createOrder(payload);
      order = res?.order;
      eligibility = res?.flagcardEligibility;
      award = res?.award;
      clearCart();
    } catch (e:any) {
      const reason = e?.message || 'Không kết nối được hệ thống thanh toán.';
      setSending(false);
      showCheckoutError(reason);
      emitBotEvent({ type:'checkout_failed', reason, paymentMethod:pay });
      return;
    }
    setSending(false);
    router.push({
      pathname: '/success',
      params: {
        code: order?.code || '',
        total: String(order?.total ?? grand),
        qualifies: String(Boolean(eligibility?.qualifiesByAmount)),
        threshold: String(eligibility?.threshold ?? ''),
        flagcardId: String(award?.card?.id || award?.cardId || ''),
        flagcardTitle: String(award?.card?.title || ''),
        flagcardGlyph: String(award?.card?.glyph || ''),
        flagcardRegion: String(award?.card?.region || ''),
      },
    } as any);
  };

  return (
    <>
    <Screen>
      <Header title="Thanh toán" />
      <View style={st.steps}><Step n={1} label="Địa chỉ" on /><Step n={2} label="Giao hàng" on /><Step n={3} label="Thanh toán" on /><Step n={4} label="Xong" /></View>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal:18, paddingBottom:100 }}>
        {addressLocked ? (
          <View style={st.lockedAddr}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
              <Text style={st.grp}>GIAO TỚI</Text>
              <Pressable onPress={()=>setAddressLocked(false)}><Text style={st.changeAddr}>Đổi địa chỉ</Text></Pressable>
            </View>
            <Text style={st.lockedName}>{name} · {phone}</Text>
            <Text style={st.lockedLine}>{fullAddress}</Text>
          </View>
        ) : (
          <>
            <Text style={st.grp}>NGƯỜI NHẬN</Text>
            <Field label="Họ tên" value={name} onChangeText={setName} placeholder="Nhập họ tên người nhận" />
            <Field label="Số điện thoại" value={phone} onChangeText={setPhone} placeholder="Nhập số điện thoại" keyboardType="phone-pad" />
            <Text style={st.grp}>ĐỊA CHỈ NHẬN HÀNG</Text>
            <Text style={st.lbl}>Tỉnh / Thành phố</Text>
            <View style={[st.input,{flexDirection:'row',alignItems:'center',borderColor:provinceOpen?C.shu:C.line,paddingRight:5}]}><TextInput value={provinceQuery} onChangeText={value=>{setProvinceQuery(value);setProvince(null);setWard(null);setWardQuery('');setProvinceOpen(true);}} onFocus={()=>setProvinceOpen(true)} placeholder="Nhập để gợi ý tỉnh/thành" placeholderTextColor={C.muted} style={st.suggestInput}/><Pressable accessibilityLabel="Mở danh sách tỉnh thành" style={st.arrow} onPress={()=>setProvinceOpen(value=>!value)}><Ionicons name={provinceOpen?'chevron-up':'chevron-down'} size={18} color={C.muted}/></Pressable></View>
            {provinceOpen && (
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={st.dropdown}>
                {shownProvinces.map((p)=>(
                  <Pressable key={p.code} style={[st.opt, p.code===province?.code&&{ backgroundColor:C.shuSoft }]} onPress={()=>{setProvince(p);setProvinceQuery(p.name);setProvinceOpen(false);setWard(null);setWardQuery('');setWardOpen(true);}}>
                    <Ionicons name="location" size={14} color={C.shu} />
                    <Text style={{flex:1,fontFamily:p.code===province?.code?F.bodyB:F.body,fontSize:13,color:p.code===province?.code?C.shuDeep:C.ink}}>{p.name}</Text><Text style={st.countHint}>{p.wardCount} phường/xã</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <View style={{ height:12 }} />
            <Text style={st.lbl}>Phường / Xã / Đặc khu</Text>
            <View style={[st.input,{flexDirection:'row',alignItems:'center',borderColor:wardOpen?C.shu:C.line,paddingRight:5,opacity:province?1:.6}]}><TextInput editable={Boolean(province)} value={wardQuery} onChangeText={value=>{setWardQuery(value);setWard(null);setWardOpen(true);}} onFocus={()=>province&&setWardOpen(true)} placeholder={province?'Nhập tên, AI sẽ gợi ý':'Chọn tỉnh/thành trước'} placeholderTextColor={C.muted} style={st.suggestInput}/><Pressable disabled={!province} accessibilityLabel="Mở danh sách phường xã" style={st.arrow} onPress={()=>setWardOpen(value=>!value)}><Ionicons name={wardOpen?'chevron-up':'chevron-down'} size={18} color={C.muted}/></Pressable></View>
            {wardOpen&&province&&<ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={st.dropdown}>{locationLoading?<Text style={st.loadingText}>Đang gợi ý…</Text>:wards.map(item=><Pressable key={item.code} style={[st.opt,item.code===ward?.code&&{backgroundColor:C.shuSoft}]} onPress={()=>{setWard(item);setWardQuery(item.name);setWardOpen(false);}}><Ionicons name="navigate" size={14} color={C.shu}/><Text style={{fontFamily:item.code===ward?.code?F.bodyB:F.body,fontSize:13,color:C.ink}}>{item.name}</Text></Pressable>)}</ScrollView>}
            <View style={{height:12}}/><Field label="Số nhà / Tên đường" value={street} onChangeText={setStreet} placeholder="Ví dụ: 123 Lê Lợi" />
            <View style={st.preview}><Text style={{ fontFamily:F.body, fontSize:12, color:C.ai }}><Text style={{ fontFamily:F.bodyB }}>Giao tới: </Text>{fullAddress||'Chưa đủ thông tin địa chỉ'}</Text></View>
          </>
        )}
        <Text style={st.grp}>PHƯƠNG THỨC THANH TOÁN</Text>
        <Pressable style={[st.pay, pay==='cod'&&{ borderColor:C.shu }]} onPress={()=>setPay('cod')}>
          <View style={[st.radio, pay==='cod'&&st.radioOn]} />
          <Text style={{ flex:1, fontFamily:F.bodyM, fontSize:13, color:C.ink }}>Thanh toán khi nhận hàng</Text><Text>💵</Text>
        </Pressable>
        <Pressable style={[st.pay, pay==='card'&&{ borderColor:C.shu },!stripeAvailable&&{opacity:.62}]} onPress={()=>{if(stripeAvailable){setCardholderName(value=>value||name);setPay('card');setOrderError('');}else showCheckoutError(stripeSetupError||'Thanh toán thẻ hiện chưa sẵn sàng.');}}>
          <View style={[st.radio, pay==='card'&&st.radioOn]} />
          <View style={{flex:1}}><Text style={{ fontFamily:F.bodyM, fontSize:13, color:C.ink }}>Thẻ tín dụng hoặc ghi nợ</Text><Text style={st.stripeOffer}>{stripeAvailable?'Visa, Mastercard, JCB · giảm thêm 10%':'Thanh toán thẻ hiện chưa sẵn sàng'}</Text></View><Ionicons name="card-outline" size={22} color={C.shu}/>
        </Pressable>
        <Pressable style={[st.pay, pay==='vnpay'&&{ borderColor:'#004993' },!vnpayAvailable&&{opacity:.62}]} onPress={()=>{if(vnpayAvailable){setPay('vnpay');setOrderError('');}else showCheckoutError('Thanh toán VNPay hiện chưa sẵn sàng.');}}>
          <View style={[st.radio, pay==='vnpay'&&{borderWidth:5,borderColor:'#004993'}]} />
          <View style={{flex:1}}><Text style={{ fontFamily:F.bodyM, fontSize:13, color:C.ink }}>VNPay · thẻ ATM nội địa, QR, ví</Text><Text style={st.vnpayOffer}>{vnpayAvailable?'Hơn 40 ngân hàng nội địa · giảm thêm 5%':'Thanh toán VNPay hiện chưa sẵn sàng'}</Text></View><Ionicons name="qr-code-outline" size={22} color="#004993"/>
        </Pressable>

        {pay==='vnpay' && (
          <View style={st.vnpayBox}>
            <View style={st.paymentHeader}>
              <View style={[st.paymentIcon,{backgroundColor:'#004993'}]}><Ionicons name="shield-checkmark" size={21} color="#fff"/></View>
              <View style={{flex:1}}><Text style={st.paymentHead}>Cổng thanh toán VNPay</Text><Text style={st.paymentSub}>Mở ngay trong ứng dụng, không rời JAPANO</Text></View>
              <View style={st.securityBadge}><Ionicons name="lock-closed" size={11} color="#15803D"/><Text style={st.securityBadgeText}>Bảo mật</Text></View>
            </View>
            <View style={st.offerBox}><Ionicons name="pricetag" size={17} color="#15803D" /><Text style={st.offerText}>Đã áp dụng VNPAY5 · tiết kiệm {money(vnpayDisc)}</Text></View>
            <Text style={st.vnpayHint}>Chạm &quot;Thanh toán bằng VNPay&quot; để mở trang thanh toán ngay trong ứng dụng. Chọn ngân hàng và nhập thông tin thẻ/tài khoản của bạn trực tiếp trên trang VNPay.</Text>
            <View style={st.secureHint}><Ionicons name="shield-checkmark" size={14} color="#15803D"/><Text style={st.secureHintText}>Giao dịch chạy trên môi trường Sandbox chính thức của VNPay — tiền không được trừ thật và có thể hoàn lại.</Text></View>
          </View>
        )}

        {pay==='card' && (
          <View style={st.cardBox}>
            <View style={st.paymentHeader}>
              <View style={st.paymentIcon}><Ionicons name="card" size={21} color="#fff"/></View>
              <View style={{flex:1}}><Text style={st.paymentHead}>Thông tin thanh toán</Text><Text style={st.paymentSub}>Nhập trực tiếp và xác nhận ngay trong ứng dụng</Text></View>
              <View style={st.securityBadge}><Ionicons name="lock-closed" size={11} color="#15803D"/><Text style={st.securityBadgeText}>Bảo mật</Text></View>
            </View>
            <View style={st.offerBox}><Ionicons name="pricetag" size={17} color="#15803D" /><Text style={st.offerText}>Đã áp dụng STRIPE10 · tiết kiệm {money(stripeDisc)}</Text></View>
            {savedCardsLoaded&&!!savedCards.length&&(
              <>
                <Text style={st.cardFieldLabel}>THẺ ĐÃ LƯU</Text>
                {savedCards.map(card=>(
                  <Pressable key={card.id} style={[st.savedCard,selectedCardId===card.id&&st.savedCardOn]} onPress={()=>setSelectedCardId(card.id)}>
                    <View style={[st.radio,selectedCardId===card.id&&st.radioOn]} />
                    <Ionicons name="card" size={18} color={C.ink} />
                    <Text style={st.savedCardT}>{card.brand.toUpperCase()} •••• {card.last4} · {String(card.expMonth).padStart(2,'0')}/{card.expYear}</Text>
                    <Pressable hitSlop={8} onPress={()=>void removeSavedCard(card.id)}><Ionicons name="trash-outline" size={16} color={C.muted} /></Pressable>
                  </Pressable>
                ))}
                <Pressable style={[st.savedCard,!selectedCardId&&st.savedCardOn]} onPress={()=>setSelectedCardId('')}>
                  <View style={[st.radio,!selectedCardId&&st.radioOn]} />
                  <Ionicons name="add-circle-outline" size={18} color={C.ink} />
                  <Text style={st.savedCardT}>Dùng thẻ mới</Text>
                </Pressable>
              </>
            )}
            {!usingSavedCard&&<>
            <Text style={st.cardFieldLabel}>TÊN IN TRÊN THẺ</Text>
            <TextInput
              value={cardholderName}
              onChangeText={setCardholderName}
              style={st.cardholderInput}
              placeholder="NGUYEN VAN A"
              placeholderTextColor="#9A9188"
              autoCapitalize="characters"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={()=>cardFormRef.current?.focus()}
            />
            <Text style={st.cardFieldLabel}>CHI TIẾT THẺ</Text>
            <View style={[st.cardFormShell,cardComplete&&st.cardFieldComplete]}>
              <CardForm
                ref={cardFormRef}
                disabled={sending}
                defaultValues={{countryCode:'VN'}}
                placeholders={{number:'Số thẻ',expiration:'MM / YY',cvc:'CVC',postalCode:'Mã bưu chính'}}
                cardStyle={{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#D8D0C4',borderRadius:12,textColor:C.ink,placeholderColor:'#8E867D',textErrorColor:C.danger,cursorColor:C.shu,fontSize:15}}
                style={st.cardForm}
                onFormComplete={(details)=>setCardComplete(details.complete)}
              />
            </View>
            </>}
            <View style={st.secureHint}><Ionicons name="shield-checkmark" size={14} color="#15803D"/><Text style={st.secureHintText}>{usingSavedCard?'Thẻ đã lưu được Stripe mã hoá — JAPANO chỉ giữ 4 số cuối để bạn nhận diện.':'Số thẻ và CVC được mã hóa bởi Stripe. JAPANO không lưu thông tin thẻ trên hệ thống, chỉ Stripe lưu (nếu bạn dùng lại thẻ này lần sau).'}</Text></View>
            {stripeMode==='test' && <View style={st.secureHint}><Ionicons name="flask-outline" size={14} color="#B45309"/><Text style={[st.secureHintText,{color:'#B45309'}]}>Cổng thẻ đang chạy ở chế độ Stripe Test — dùng số thẻ thử nghiệm của Stripe, tiền không được trừ thật.</Text></View>}
          </View>
        )}

        <Text style={st.grp}>ƯU ĐÃI VIP</Text>
        <View style={[st.vipBox,vip?.isVip&&st.vipBoxActive]}>
          {vipLoading ? <View style={st.vipLoading}><ActivityIndicator size="small" color={C.shu}/><Text style={st.vipHint}>Đang kiểm tra hạng thành viên…</Text></View> : vip?.isVip ? (
            <>
              <View style={st.vipHead}>
                <View style={st.vipCrown}><Ionicons name="diamond" size={18} color="#fff"/></View>
                <View style={{flex:1}}><Text style={st.vipTitle}>JAPANO VIP · giảm 10%</Text><Text style={st.vipHint}>Chọn một dòng bên dưới; ưu đãi chỉ áp dụng cho 1 đơn vị trong mỗi đơn.</Text></View>
                <Text style={st.vipExpiry}>Còn {vip.daysRemaining} ngày</Text>
              </View>
              {cart.map(item=>{const key=cartLineKey(item),on=key===selectedVipLine,p=PRODUCTS.find(product=>product.slug===item.slug);return (
                <Pressable key={key} style={[st.vipChoice,on&&st.vipChoiceOn]} onPress={()=>setSelectedVipLine(on?'':key)}>
                  <View style={[st.radio,on&&st.radioOn]}/>
                  <View style={{flex:1}}><Text style={st.vipProductName}>{p?.name||item.slug}</Text><Text style={st.vipHint}>{item.color} · {item.size} · x{item.qty}{item.qty>1?' · giảm 1 món':''}</Text></View>
                  <Text style={st.vipSaving}>{p?`-${money(Math.round(variantPrice(p,item.color,item.size)*.1))}`:''}</Text>
                </Pressable>
              );})}
              {!selectedVipLine&&<Text style={st.vipSkip}>Chưa chọn — bạn vẫn có thể đặt hàng mà không dùng ưu đãi VIP.</Text>}
            </>
          ) : (
            <>
              <View style={st.vipHead}><View style={st.vipCrown}><Ionicons name="diamond-outline" size={18} color="#fff"/></View><View style={{flex:1}}><Text style={st.vipTitle}>Tiến độ lên VIP tháng này</Text><Text style={st.vipHint}>Chi đủ {money(vip?.currentMonth.threshold||5_000_000)} để mở VIP trong 30 ngày.</Text></View></View>
              <View style={st.vipProgress}><View style={[st.vipProgressOn,{width:`${vip?.currentMonth.progressPercent||0}%` as `${number}%`}]}/></View>
              <View style={st.vipProgressText}><Text style={st.vipHint}>Đã chi {money(vip?.currentMonth.spend||0)}</Text><Text style={st.vipHint}>Còn {money(vip?.currentMonth.remaining||5_000_000)}</Text></View>
            </>
          )}
        </View>

        <Text style={st.grp}>MÃ GIẢM GIÁ</Text>
        <VoucherField subtotal={cartSubtotal} voucher={voucher} onApply={setVoucher} onClear={clearVoucher} userId={user?.id} />

        <View style={st.sum}>
          <Row k="Tạm tính" v={money(cartSubtotal)} />
          {voucherDisc>0 && <Row k={`Mã giảm giá ${voucher?.code}`} v={`-${money(voucherDisc)}`} shu />}
          {stripeDisc>0 && <Row k="Ưu đãi thẻ Stripe 10%" v={`-${money(stripeDisc)}`} shu />}
          {vnpayDisc>0 && <Row k="Ưu đãi VNPay 5%" v={`-${money(vnpayDisc)}`} shu />}
          {vipDisc>0 && <Row k={`VIP 10% · ${vipProduct?.name||'1 sản phẩm'}`} v={`-${money(vipDisc)}`} shu />}
          <Row k="Phí vận chuyển" v={money(SHIP)} />
        </View>
        {!!orderError && (
          <View style={st.orderError}>
            <Ionicons name="alert-circle-outline" size={18} color={C.danger} />
            <Text style={st.orderErrorText}>{orderError} Ori đang mở để hỗ trợ bạn.</Text>
          </View>
        )}
      </ScrollView>
      <View style={st.sticky}>
        {!!orderError&&<View style={st.stickyError}><Ionicons name="alert-circle" size={16} color={C.danger}/><Text style={st.stickyErrorText}>{orderError}</Text></View>}
        <Btn label={sending ? (pay==='card'?'Đang xác nhận thẻ…':pay==='vnpay'?'Đang mở VNPay…':'Đang đặt hàng…') : `${pay==='card'?'Thanh toán bằng thẻ':pay==='vnpay'?'Thanh toán bằng VNPay':'Đặt hàng'} · ${money(grand)}`} onPress={placeOrder} />
      </View>
    </Screen>
    {!!vnpaySession && (
      <VnpayWebViewModal
        session={vnpaySession}
        onCancel={()=>setVnpaySession(null)}
        onResult={(status)=>{
          const orderId=vnpaySession.orderId;
          setVnpaySession(null);
          if(status==='paid')clearCart();
          router.replace({pathname:'/payment-result',params:{orderId,status}} as any);
        }}
      />
    )}
    </>
  );
}

function VnpayWebViewModal({ session, onCancel, onResult }:{
  session:{paymentUrl:string;returnUrlMarker:string;orderId:string};
  onCancel:()=>void;
  onResult:(status:'paid'|'failed'|'cancelled')=>void;
}) {
  const handled = useRef(false);
  const runConfirm = async (url:string) => {
    if (handled.current) return;
    handled.current = true;
    try {
      const query = url.split('?')[1] || '';
      const params = Object.fromEntries(new URLSearchParams(query).entries());
      const result = await confirmVnpayReturn(params);
      onResult(result.payment.status==='paid'?'paid':result.payment.status==='cancelled'?'cancelled':'failed');
    } catch (e:any) {
      Alert.alert('Lỗi', e?.message || 'Không xác nhận được thanh toán VNPay.');
      onCancel();
    }
  };
  const isReturnUrl = (url:string) => url.startsWith(session.returnUrlMarker);
  const onNavChange = (navState:WebViewNavigation) => { if (isReturnUrl(navState.url)) void runConfirm(navState.url); };
  const onShouldStart = (request:{url:string}) => {
    if (isReturnUrl(request.url)) { void runConfirm(request.url); return false; }
    return true;
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <View style={st.vnpayModal}>
        <View style={st.vnpayHeader}>
          <View style={{flex:1}}>
            <Text style={st.vnpayHeaderT}>Thanh toán VNPay</Text>
            <Text style={st.vnpayHeaderSub}>Môi trường Sandbox · giao dịch thử nghiệm</Text>
          </View>
          <Pressable hitSlop={10} onPress={onCancel}><Ionicons name="close" size={24} color={C.ink}/></Pressable>
        </View>
        <WebView
          source={{ uri: session.paymentUrl }}
          onNavigationStateChange={onNavChange}
          onShouldStartLoadWithRequest={onShouldStart}
          startInLoadingState
          renderLoading={()=><ActivityIndicator style={{marginTop:60}} color={C.shu} size="large"/>}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
        />
      </View>
    </Modal>
  );
}
const Row = ({ k, v, shu }:{k:string;v:string;shu?:boolean}) => (
  <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 }}><Text style={{ fontFamily:F.body, fontSize:13, color:C.muted }}>{k}</Text><Text style={{ fontFamily:F.bodyM, fontSize:13, color:shu?C.shu:C.ink }}>{v}</Text></View>
);
const st = StyleSheet.create({
  configLoading:{flex:1,alignItems:'center',justifyContent:'center',gap:10,padding:24},
  configLoadingText:{fontFamily:F.bodyM,fontSize:12.5,color:C.muted},
  steps:{ flexDirection:'row', paddingHorizontal:12, paddingVertical:12 },
  stepN:{ width:30, height:30, borderRadius:15, backgroundColor:C.washi2, alignItems:'center', justifyContent:'center' },
  grp:{ fontFamily:F.display, fontSize:12, color:C.muted, letterSpacing:1.5, marginTop:14, marginBottom:8 },
  lbl:{ fontFamily:F.bodyM, color:C.muted, fontSize:11, marginBottom:5 },
  input:{ minHeight:48, borderWidth:1, borderColor:C.line, borderRadius:12, backgroundColor:'#fff', paddingHorizontal:13, fontFamily:F.body, fontSize:14, color:C.ink, justifyContent:'center' },
  dropdown:{ maxHeight:260, borderWidth:1, borderColor:C.shu, borderTopWidth:0, borderBottomLeftRadius:12, borderBottomRightRadius:12, overflow:'hidden', marginTop:-2, backgroundColor:'#fff' },
  opt:{ flexDirection:'row', alignItems:'center', gap:8, paddingVertical:11, paddingHorizontal:12, borderTopWidth:1, borderTopColor:C.hair, backgroundColor:'#fff' },
  suggestInput:{flex:1,minHeight:46,fontFamily:F.body,fontSize:14,color:C.ink,paddingHorizontal:8},
  arrow:{width:42,height:42,alignItems:'center',justifyContent:'center'},
  countHint:{fontFamily:F.body,fontSize:9.5,color:C.muted},
  loadingText:{fontFamily:F.bodyM,fontSize:12,color:C.muted,textAlign:'center',padding:18},
  preview:{ backgroundColor:C.aiSoft, borderRadius:10, padding:10, marginTop:2 },
  lockedAddr:{ backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:14, padding:14, marginTop:4, marginBottom:4 },
  changeAddr:{ fontFamily:F.bodyB, fontSize:11.5, color:C.shu },
  lockedName:{ fontFamily:F.bodyB, fontSize:13, color:C.ink, marginTop:6 },
  lockedLine:{ fontFamily:F.body, fontSize:12.5, color:C.muted, marginTop:2 },
  pay:{ flexDirection:'row', alignItems:'center', gap:10, borderWidth:1, borderColor:C.line, borderRadius:14, padding:14, backgroundColor:'#fff', marginBottom:10 },
  radio:{ width:18, height:18, borderRadius:9, borderWidth:1.5, borderColor:C.line },
  radioOn:{ borderWidth:5, borderColor:C.shu },
  vipBox:{backgroundColor:'#fff',borderWidth:1,borderColor:C.line,borderRadius:16,padding:13,marginBottom:2},
  vipBoxActive:{borderColor:'#B08D3C',backgroundColor:'#FFF9EC'},
  vipLoading:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:5},
  vipHead:{flexDirection:'row',alignItems:'center',gap:10},
  vipCrown:{width:38,height:38,borderRadius:12,backgroundColor:'#9A7423',alignItems:'center',justifyContent:'center'},
  vipTitle:{fontFamily:F.bodyB,fontSize:13.5,color:C.ink},
  vipHint:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:C.muted,marginTop:2},
  vipExpiry:{fontFamily:F.bodyB,fontSize:9.5,color:'#8A6518',backgroundColor:'#F7E8B8',borderRadius:999,paddingHorizontal:8,paddingVertical:5},
  vipChoice:{flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:C.line,borderRadius:11,padding:10,marginTop:9,backgroundColor:'#fff'},
  vipChoiceOn:{borderColor:'#B08D3C',backgroundColor:'#FFF4D6'},
  vipProductName:{fontFamily:F.bodyB,fontSize:11.5,color:C.ink},
  vipSaving:{fontFamily:F.bodyB,fontSize:11.5,color:C.shu},
  vipSkip:{fontFamily:F.bodyM,fontSize:10.5,color:C.muted,textAlign:'center',marginTop:9},
  vipProgress:{height:8,borderRadius:5,backgroundColor:C.hair,overflow:'hidden',marginTop:12},
  vipProgressOn:{height:'100%',borderRadius:5,backgroundColor:'#B08D3C'},
  vipProgressText:{flexDirection:'row',justifyContent:'space-between',marginTop:5},
  cardBox:{ backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:18, padding:14, marginBottom:14, shadowColor:'#332A22',shadowOffset:{width:0,height:5},shadowOpacity:.06,shadowRadius:12,elevation:2 },
  paymentHeader:{ flexDirection:'row',alignItems:'center',gap:10,marginBottom:12 },
  paymentIcon:{ width:40,height:40,borderRadius:12,backgroundColor:C.shu,alignItems:'center',justifyContent:'center' },
  paymentHead:{ fontFamily:F.bodyB,fontSize:13.5,color:C.ink },
  paymentSub:{ fontFamily:F.body,fontSize:10.5,color:C.muted,marginTop:2 },
  securityBadge:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'#E8F6EC',borderRadius:999,paddingHorizontal:7,paddingVertical:5},
  securityBadgeText:{fontFamily:F.bodyB,fontSize:8.5,color:'#166534'},
  stripeOffer:{ fontFamily:F.bodyB,fontSize:10.5,color:'#15803D',marginTop:2 },
  vnpayOffer:{ fontFamily:F.bodyB,fontSize:10.5,color:'#004993',marginTop:2 },
  vnpayBox:{ backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:18, padding:14, marginBottom:14, shadowColor:'#332A22',shadowOffset:{width:0,height:5},shadowOpacity:.06,shadowRadius:12,elevation:2 },
  vnpayHint:{ fontFamily:F.body,fontSize:11.5,lineHeight:17,color:C.muted,marginTop:12 },
  vnpayModal:{ flex:1, backgroundColor:'#fff', paddingTop:48 },
  vnpayHeader:{ flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:16,paddingBottom:12,borderBottomWidth:1,borderBottomColor:C.line },
  vnpayHeaderT:{ fontFamily:F.bodyB,fontSize:15,color:C.ink },
  vnpayHeaderSub:{ fontFamily:F.body,fontSize:11,color:C.muted,marginTop:2 },
  offerBox:{ flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'#E8F6EC',borderRadius:10,padding:10,marginBottom:1 },
  offerText:{ flex:1,fontFamily:F.bodyB,fontSize:11.5,color:'#166534' },
  cardFieldLabel:{fontFamily:F.bodyX,fontSize:9,color:C.muted,letterSpacing:.9,marginTop:13,marginBottom:6},
  savedCard:{flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:C.line,borderRadius:11,padding:11,marginBottom:8,backgroundColor:'#fff'},
  savedCardOn:{borderColor:C.shu,backgroundColor:C.shuSoft},
  savedCardT:{flex:1,fontFamily:F.bodyM,fontSize:12.5,color:C.ink},
  cardholderInput:{height:52,borderWidth:1,borderColor:'#D8D0C4',borderRadius:12,backgroundColor:'#fff',paddingHorizontal:14,fontFamily:F.bodyM,fontSize:14,color:C.ink,letterSpacing:.25},
  cardFormShell:{height:200,borderWidth:1,borderColor:'transparent',borderRadius:13,backgroundColor:'#fff',overflow:'hidden'},
  cardFieldComplete:{borderColor:'#49A766'},
  cardForm:{width:'100%',height:200},
  secureHint:{flexDirection:'row',alignItems:'flex-start',gap:6,marginTop:8},
  secureHintText:{flex:1,fontFamily:F.body,fontSize:10.5,lineHeight:15,color:C.muted},
  voucherErr:{ fontFamily:F.body, fontSize:11.5, color:C.danger, marginTop:6 },
  orderError:{ flexDirection:'row', gap:8, alignItems:'center', backgroundColor:'#FDEBEC', borderWidth:1, borderColor:'#E8B6BA', borderRadius:12, padding:11, marginTop:10 },
  orderErrorText:{ flex:1, fontFamily:F.bodyM, fontSize:11.5, lineHeight:16, color:C.danger },
  stickyError:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'#FDEBEC',borderWidth:1,borderColor:'#E8B6BA',borderRadius:10,paddingHorizontal:10,paddingVertical:8,marginBottom:8},
  stickyErrorText:{flex:1,fontFamily:F.bodyB,fontSize:10.5,lineHeight:14,color:C.danger},
  sum:{ backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:14, padding:14, marginTop:6 },
  sticky:{ position:'absolute', left:0, right:0, bottom:0, backgroundColor:C.paper, borderTopWidth:1, borderTopColor:C.line, padding:12, paddingBottom:24 },
});
