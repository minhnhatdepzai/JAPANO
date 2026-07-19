import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CardForm, CardFormView, ConfirmPaymentResult, PaymentIntent, StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { Screen, Header, Btn, money } from '../components/ui';
import { PRODUCTS } from '../lib/catalog';
import { useStore } from '../lib/store';
import { confirmStripePaymentIntent, createOrder, createStripePaymentIntent, getProvinces, getStripeConfig, getWards, StripeConfig, VietnamLocation, voucherDiscountFor } from '../lib/api';
import { VoucherField } from '../components/VoucherPicker';
import { C, F } from '../theme/tokens';
import { emitBotEvent } from '../lib/botEvents';
import { useAuth } from '../lib/auth';

const SHIP = 30000;
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
  const [configLoaded,setConfigLoaded]=useState(false);
  const [configError,setConfigError]=useState('');

  useEffect(()=>{
    let live=true;
    getStripeConfig()
      .then(config=>{if(live){setStripeConfig(config);setConfigError(config.enabled?'':'Thanh toán thẻ hiện chưa được cấu hình.');}})
      .catch((error:any)=>{if(live)setConfigError(error?.message||'Chưa kết nối được Stripe.');})
      .finally(()=>{if(live)setConfigLoaded(true);});
    return()=>{live=false;};
  },[]);

  if(!configLoaded){
    return <Screen><Header title="Thanh toán" /><View style={st.configLoading}><ActivityIndicator color={C.shu}/><Text style={st.configLoadingText}>Đang chuẩn bị thanh toán an toàn…</Text></View></Screen>;
  }
  if(stripeConfig?.enabled&&stripeConfig.publishableKey){
    return <StripeProvider publishableKey={stripeConfig.publishableKey} urlScheme="japano">
      <StripeCheckoutForm />
    </StripeProvider>;
  }
  return <CheckoutForm stripeAvailable={false} stripeSetupError={configError}/>;
}

function StripeCheckoutForm(){
  const {confirmPayment}=useStripe();
  return <CheckoutForm stripeAvailable confirmCardPayment={confirmPayment}/>;
}

function CheckoutForm({stripeAvailable,confirmCardPayment,stripeSetupError=''}:{stripeAvailable:boolean;confirmCardPayment?:ConfirmCardPayment;stripeSetupError?:string}) {
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
  const [pay, setPay] = useState<'cod'|'card'>(stripeAvailable?'card':'cod');
  const [cardComplete,setCardComplete]=useState(false);
  const cardFormRef=useRef<CardFormView.Methods|null>(null);
  const [sending, setSending] = useState(false);
  const [orderError, setOrderError] = useState('');
  const voucherDisc = voucher ? voucherDiscountFor(cartSubtotal, voucher) : 0;
  const stripeDisc = pay === 'card' ? Math.round(cartSubtotal * 0.1) : 0;
  const disc = Math.min(cartSubtotal, voucherDisc + stripeDisc);
  const grand = cartSubtotal - disc + SHIP;

  useEffect(() => {
    if (params.pay === 'cod' || (params.pay === 'card' && stripeAvailable)) {
      setPay(params.pay);
      setOrderError('');
    }
  }, [params.pay,stripeAvailable]);

  useEffect(()=>{let live=true;getProvinces().then(items=>{if(live)setProvinces(items);}).catch(()=>setOrderError('Chưa tải được danh mục tỉnh/thành.'));return()=>{live=false;};},[]);
  useEffect(()=>{if(!province){setWards([]);return;}let live=true;const timer=setTimeout(()=>{setLocationLoading(true);getWards(province.code,wardQuery,200).then(data=>{if(live)setWards(data.items);}).catch(()=>{if(live)setOrderError('Chưa tải được phường/xã.');}).finally(()=>{if(live)setLocationLoading(false);});},250);return()=>{live=false;clearTimeout(timer);};},[province?.code,wardQuery]);
  const shownProvinces=provinces.filter(item=>!provinceQuery.trim()||item.name.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(provinceQuery.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'')));
  const fullAddress=[street.trim(),ward?.name,province?.name].filter(Boolean).join(', ');

  const showCheckoutError = (message:string) => {
    setOrderError(message);
    Alert.alert('Chưa thể thanh toán', message, [{text:'Đã hiểu'}]);
  };

  const placeOrder = async () => {
    if (sending) return;
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
    if(pay==='card'&&!cardholderName.trim()){showCheckoutError('Vui lòng nhập tên in trên thẻ.');return;}
    if(pay==='card'&&!cardComplete){showCheckoutError('Vui lòng nhập đầy đủ và kiểm tra lại thông tin thẻ.');return;}
    if(pay==='card'&&!confirmCardPayment){showCheckoutError('Stripe SDK chưa sẵn sàng trên thiết bị.');return;}
    setOrderError('');
    setSending(true);
    const items = cart.map(c => {
      const p = PRODUCTS.find(x => x.slug === c.slug);
      return { slug: c.slug, name: p?.name || c.slug, colorName: c.color, colorHex: '#1A1410', size: c.size, qty: c.qty, price: p?.price || 0 };
    });
    const payload = {
      customer: { name: name.trim(), email: user?.email || '', phone: phone.trim() },
      address: fullAddress,
      addressDetails:{street:street.trim(),wardCode:ward.code,ward:ward.name,provinceCode:province.code,province:province.name},
      items, total: grand, paymentMethod: pay === 'cod' ? 'COD' : 'Stripe',
      voucherCode: voucher?.code,
    };
    let order:any = null;
    let eligibility:any = null;
    try {
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
            billingDetails:{
              name:cardholderName.trim(),
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
      },
    } as any);
  };

  return (
    <Screen>
      <Header title="Thanh toán" />
      <View style={st.steps}><Step n={1} label="Địa chỉ" on /><Step n={2} label="Giao hàng" on /><Step n={3} label="Thanh toán" on /><Step n={4} label="Xong" /></View>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal:18, paddingBottom:100 }}>
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
        <Text style={st.grp}>PHƯƠNG THỨC THANH TOÁN</Text>
        <Pressable style={[st.pay, pay==='cod'&&{ borderColor:C.shu }]} onPress={()=>setPay('cod')}>
          <View style={[st.radio, pay==='cod'&&st.radioOn]} />
          <Text style={{ flex:1, fontFamily:F.bodyM, fontSize:13, color:C.ink }}>Thanh toán khi nhận hàng</Text><Text>💵</Text>
        </Pressable>
        <Pressable style={[st.pay, pay==='card'&&{ borderColor:C.shu },!stripeAvailable&&{opacity:.62}]} onPress={()=>{if(stripeAvailable){setCardholderName(value=>value||name);setPay('card');setOrderError('');}else showCheckoutError(stripeSetupError||'Thanh toán thẻ hiện chưa sẵn sàng.');}}>
          <View style={[st.radio, pay==='card'&&st.radioOn]} />
          <View style={{flex:1}}><Text style={{ fontFamily:F.bodyM, fontSize:13, color:C.ink }}>Thẻ tín dụng hoặc ghi nợ</Text><Text style={st.stripeOffer}>{stripeAvailable?'Visa, Mastercard, JCB · giảm thêm 10%':'Thanh toán thẻ hiện chưa sẵn sàng'}</Text></View><Ionicons name="card-outline" size={22} color={C.shu}/>
        </Pressable>

        {pay==='card' && (
          <View style={st.cardBox}>
            <View style={st.paymentHeader}>
              <View style={st.paymentIcon}><Ionicons name="card" size={21} color="#fff"/></View>
              <View style={{flex:1}}><Text style={st.paymentHead}>Thông tin thanh toán</Text><Text style={st.paymentSub}>Nhập trực tiếp và xác nhận ngay trong ứng dụng</Text></View>
              <View style={st.securityBadge}><Ionicons name="lock-closed" size={11} color="#15803D"/><Text style={st.securityBadgeText}>Bảo mật</Text></View>
            </View>
            <View style={st.offerBox}><Ionicons name="pricetag" size={17} color="#15803D" /><Text style={st.offerText}>Đã áp dụng STRIPE10 · tiết kiệm {money(stripeDisc)}</Text></View>
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
            <View style={st.secureHint}><Ionicons name="shield-checkmark" size={14} color="#15803D"/><Text style={st.secureHintText}>Số thẻ và CVC được mã hóa bởi Stripe. JAPANO không lưu thông tin thẻ trên hệ thống.</Text></View>
          </View>
        )}

        <Text style={st.grp}>MÃ GIẢM GIÁ</Text>
        <VoucherField subtotal={cartSubtotal} voucher={voucher} onApply={setVoucher} onClear={clearVoucher} />

        <View style={st.sum}>
          <Row k="Tạm tính" v={money(cartSubtotal)} />
          {voucherDisc>0 && <Row k={`Mã giảm giá ${voucher?.code}`} v={`-${money(voucherDisc)}`} shu />}
          {stripeDisc>0 && <Row k="Ưu đãi thẻ Stripe 10%" v={`-${money(stripeDisc)}`} shu />}
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
        <Btn label={sending ? (pay==='card'?'Đang xác nhận thẻ…':'Đang đặt hàng…') : `${pay==='card'?'Thanh toán bằng thẻ':'Đặt hàng'} · ${money(grand)}`} onPress={placeOrder} />
      </View>
    </Screen>
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
  pay:{ flexDirection:'row', alignItems:'center', gap:10, borderWidth:1, borderColor:C.line, borderRadius:14, padding:14, backgroundColor:'#fff', marginBottom:10 },
  radio:{ width:18, height:18, borderRadius:9, borderWidth:1.5, borderColor:C.line },
  radioOn:{ borderWidth:5, borderColor:C.shu },
  cardBox:{ backgroundColor:'#fff', borderWidth:1, borderColor:C.line, borderRadius:18, padding:14, marginBottom:14, shadowColor:'#332A22',shadowOffset:{width:0,height:5},shadowOpacity:.06,shadowRadius:12,elevation:2 },
  paymentHeader:{ flexDirection:'row',alignItems:'center',gap:10,marginBottom:12 },
  paymentIcon:{ width:40,height:40,borderRadius:12,backgroundColor:C.shu,alignItems:'center',justifyContent:'center' },
  paymentHead:{ fontFamily:F.bodyB,fontSize:13.5,color:C.ink },
  paymentSub:{ fontFamily:F.body,fontSize:10.5,color:C.muted,marginTop:2 },
  securityBadge:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'#E8F6EC',borderRadius:999,paddingHorizontal:7,paddingVertical:5},
  securityBadgeText:{fontFamily:F.bodyB,fontSize:8.5,color:'#166534'},
  stripeOffer:{ fontFamily:F.bodyB,fontSize:10.5,color:'#15803D',marginTop:2 },
  offerBox:{ flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'#E8F6EC',borderRadius:10,padding:10,marginBottom:1 },
  offerText:{ flex:1,fontFamily:F.bodyB,fontSize:11.5,color:'#166534' },
  cardFieldLabel:{fontFamily:F.bodyX,fontSize:9,color:C.muted,letterSpacing:.9,marginTop:13,marginBottom:6},
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
