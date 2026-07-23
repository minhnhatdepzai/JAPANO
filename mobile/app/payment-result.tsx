import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Btn, money } from '../components/ui';
import { ApiOrder, getPaymentStatus, StripePaymentRecord } from '../lib/api';
import { useStore } from '../lib/store';
import { C, F } from '../theme/tokens';

const one=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export default function PaymentResult(){
  const router=useRouter();
  const params=useLocalSearchParams<{orderId?:string;status?:string}>();
  const orderId=one(params.orderId)||'';
  const redirectStatus=one(params.status)||'pending';
  const {clearCart}=useStore();
  const cleared=useRef(false);
  const [payment,setPayment]=useState<StripePaymentRecord|null>(null);
  const [order,setOrder]=useState<ApiOrder|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  useEffect(()=>{
    let live=true;
    const load=async()=>{
      if(!orderId){setError('Thiếu mã đơn hàng để kiểm tra thanh toán.');setLoading(false);return;}
      for(let attempt=0;attempt<6&&live;attempt+=1){
        try{
          const result=await getPaymentStatus(orderId);
          if(!live)return;
          setPayment(result.payment);setOrder(result.order);setError('');
          if(result.payment.status==='paid'){
            if(!cleared.current){cleared.current=true;clearCart();}
            setLoading(false);return;
          }
          if(['failed','cancelled','refunded','partially_refunded'].includes(result.payment.status)){
            setLoading(false);return;
          }
        }catch(e:any){if(live)setError(e?.message||'Chưa đọc được trạng thái giao dịch.');}
        await wait(1500);
      }
      if(live)setLoading(false);
    };
    void load();
    return()=>{live=false;};
  },[clearCart,orderId]);

  const status=payment?.status||redirectStatus;
  const paid=status==='paid';
  const cancelled=status==='cancelled';
  const refunded=status==='refunded'||status==='partially_refunded';
  const failed=status==='failed';
  const icon=paid?'checkmark':cancelled?'close':refunded?'return-down-back':'alert';
  const title=paid?'Thanh toán thành công':cancelled?'Đã hủy thanh toán':refunded?'Giao dịch đã hoàn tiền':failed?'Thanh toán thất bại':'Đang xác nhận Stripe';
  const description=paid
    ? 'Stripe đã xác nhận giao dịch nhập trực tiếp trong ứng dụng và JAPANO đã lưu mã đối soát.'
    : cancelled?'Stripe không trừ tiền. Giỏ hàng của bạn vẫn được giữ lại.'
    : refunded?'Khoản hoàn tiền đã được gửi tới Stripe và đồng bộ về trang quản trị.'
    : failed?'Stripe chưa hoàn tất giao dịch. Bạn có thể quay lại trang thanh toán để thử lại.'
    :'Hệ thống đang đối chiếu PaymentIntent với Stripe. Vui lòng chờ trong giây lát.';

  return <Screen>
    <View style={st.wrap}>
      <View style={[st.icon,{backgroundColor:paid?'#E4F5E9':refunded?'#EFE9FF':'#FCE8E8'}]}>
        {loading?<ActivityIndicator size="large" color={C.shu}/>:<Ionicons name={icon as any} size={45} color={paid?'#15803D':refunded?'#6D28D9':C.danger}/>} 
      </View>
      <View style={st.mode}><Ionicons name="shield-checkmark" size={12} color="#fff"/><Text style={st.modeT}>THANH TOÁN THẺ · BẢO MẬT BỞI STRIPE</Text></View>
      <Text style={st.title}>{title}</Text>
      <Text style={st.desc}>{description}</Text>
      {!!error&&<Text style={st.error}>{error}</Text>}

      {(payment||order)&&<View style={st.card}>
        <Row label="Mã đơn" value={order?.code?`#${order.code}`:'—'} />
        <Row label="Mã thanh toán" value={payment?.code||'—'} mono />
        <Row label="Mã giao dịch Stripe" value={payment?.transactionCode||payment?.paymentIntentId||'Đang chờ Stripe'} mono />
        <Row label="Số tiền" value={money(payment?.amount||order?.total||0)} />
        {!!payment?.card?.last4&&<Row label="Thẻ thanh toán" value={`${String(payment.card.brand||'thẻ').toUpperCase()} •••• ${payment.card.last4}`} />}
        {!!payment?.refundedAmount&&<Row label="Đã hoàn" value={money(payment.refundedAmount)} />}
      </View>}

      <View style={st.actions}>
        {!!order?.code&&<Btn label="Xem đơn hàng" onPress={()=>router.replace(`/order/${order.code}`)} />}
        {!paid&&<Btn label="Quay lại thanh toán" variant="ink" style={{marginTop:10}} onPress={()=>router.replace('/checkout')} />}
        <Btn label="Về trang chủ" variant="ghost" style={{marginTop:10}} onPress={()=>router.replace('/(tabs)')} />
      </View>
    </View>
  </Screen>;
}

function Row({label,value,mono}:{label:string;value:string;mono?:boolean}){
  return <View style={st.row}><Text style={st.label}>{label}</Text><Text selectable style={[st.value,mono&&st.mono]} numberOfLines={2}>{value}</Text></View>;
}

const st=StyleSheet.create({
  wrap:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:22},
  icon:{width:110,height:110,borderRadius:55,alignItems:'center',justifyContent:'center'},
  mode:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#15803D',borderRadius:999,paddingHorizontal:12,paddingVertical:6,marginTop:18},
  modeT:{fontFamily:F.bodyX,fontSize:9,color:'#fff',letterSpacing:1},
  title:{fontFamily:F.display,fontSize:24,color:C.sumi,textAlign:'center',marginTop:12},
  desc:{fontFamily:F.body,fontSize:13,lineHeight:20,color:C.muted,textAlign:'center',maxWidth:330,marginTop:8},
  error:{fontFamily:F.bodyM,fontSize:11.5,lineHeight:17,color:C.danger,textAlign:'center',marginTop:8},
  card:{width:'100%',backgroundColor:'#fff',borderWidth:1,borderColor:C.line,borderRadius:16,padding:14,marginTop:20},
  row:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:12,paddingVertical:7,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.hair},
  label:{fontFamily:F.body,fontSize:11.5,color:C.muted},
  value:{flex:1,fontFamily:F.bodyB,fontSize:11.5,color:C.ink,textAlign:'right'},
  mono:{fontFamily:'monospace',fontSize:10.5},
  actions:{width:'100%',marginTop:18},
});
