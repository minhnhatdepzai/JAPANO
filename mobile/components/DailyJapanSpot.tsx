import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, F, money } from '../theme/tokens';
import { useCatalog } from '../lib/data';
import { SmartImage } from './SmartImage';

const STORAGE_KEY='@japano/daily-japan-spot/v2';
const SPOTS=[
  {place:'Rừng tre Arashiyama',region:'Kyoto',time:'Sáng sớm · 07:00–09:00',tip:'Lối tre xanh tạo chiều sâu rất đẹp cho ảnh toàn thân.',slug:'kimono-hong'},
  {place:'Đền Fushimi Inari',region:'Kyoto',time:'Sáng sớm · trước 08:00',tip:'Hàng nghìn cổng torii đỏ hợp trang phục truyền thống.',slug:'yukata-xanh'},
  {place:'Phố cổ Gion',region:'Kyoto',time:'Chiều vàng · 16:30–18:00',tip:'Nhà machiya và ngõ lát đá cho khung hình Nhật cổ.',slug:'haori-dang-dai'},
  {place:'Hồ Kawaguchi',region:'Yamanashi',time:'Bình minh · trời quang',tip:'Chụp cùng núi Phú Sĩ và mặt hồ phản chiếu.',slug:'cardigan-dai'},
  {place:'Công viên Nara',region:'Nara',time:'Sáng · 08:00–10:00',tip:'Ánh sáng mềm, bãi cỏ rộng và những chú hươu thân thiện.',slug:'kimono-hong'},
  {place:'Đài quan sát Shibuya',region:'Tokyo',time:'Hoàng hôn',tip:'Đường chân trời Tokyo hợp với bộ trang phục hiện đại, sắc nét.',slug:'blazer-kaki'},
  {place:'Omoide Yokocho',region:'Tokyo',time:'Tối · sau 19:00',tip:'Đèn lồng và biển hiệu nhỏ tạo chất điện ảnh đường phố.',slug:'dong-phuc-thuy-thu'},
  {place:'Kênh Otaru',region:'Hokkaido',time:'Chạng vạng mùa đông',tip:'Kho đá, đèn vàng và tuyết tạo nền ảnh rất lãng mạn.',slug:'ao-len-co-lo'},
  {place:'Làng Shirakawa-go',region:'Gifu',time:'Buổi sáng mùa đông',tip:'Nhà mái tranh gassho-zukuri cho khung hình cổ tích.',slug:'khoac-nhat'},
  {place:'Công viên Hitachi Seaside',region:'Ibaraki',time:'Sáng ngày nắng nhẹ',tip:'Đồi hoa theo mùa tạo mảng màu rộng và trong trẻo.',slug:'yae-miko'},
];

function localDayKey(){
  const now=new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
function dayIndex(){
  const start=new Date(new Date().getFullYear(),0,0).getTime();
  return Math.floor((Date.now()-start)/86400000);
}

export function DailyJapanSpot(){
  const router=useRouter();
  const pathname=usePathname();
  const {products}=useCatalog();
  const [visible,setVisible]=useState(false);
  const suggestion=useMemo(()=>SPOTS[dayIndex()%SPOTS.length],[]);
  const product=products.find(item=>item.slug===suggestion.slug)||products[0];
  const blocked=['/onboarding','/login','/register','/checkout','/payment-result','/success'].some(path=>pathname.startsWith(path));

  useEffect(()=>{
    let live=true;
    if(blocked)return()=>{live=false;};
    const timer=setTimeout(()=>{
      void AsyncStorage.getItem(STORAGE_KEY).then(last=>{
        if(!live||last===localDayKey())return;
        return AsyncStorage.setItem(STORAGE_KEY,localDayKey()).then(()=>{if(live)setVisible(true);});
      }).catch(()=>undefined);
    },900);
    return()=>{live=false;clearTimeout(timer);};
  },[blocked,pathname]);

  if(!product)return null;
  const openProduct=()=>{setVisible(false);router.push(`/product/${product.slug}`);};
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={()=>setVisible(false)}>
    <View style={st.shade}><View style={st.card}>
      <Pressable style={st.close} hitSlop={10} onPress={()=>setVisible(false)}><Ionicons name="close" size={20} color="#fff"/></Pressable>
      <View style={st.hero}>
        <SmartImage source={product.images[0]} style={StyleSheet.absoluteFill as any} recyclingKey={`daily-spot-${product.slug}`}/>
        <View style={st.heroTint}/><View style={st.heroCopy}><Text style={st.eyebrow}>ĐỊA ĐIỂM GỢI Ý HÔM NAY</Text><Text style={st.place}>{suggestion.place}</Text><Text style={st.region}><Ionicons name="location" size={12}/> {suggestion.region}</Text></View>
      </View>
      <View style={st.body}>
        <View style={st.info}><Ionicons name="camera-outline" size={19} color={C.shu}/><View style={{flex:1}}><Text style={st.time}>{suggestion.time}</Text><Text style={st.tip}>{suggestion.tip}</Text></View></View>
        <View style={st.outfit}><SmartImage source={product.images[0]} style={st.thumb} recyclingKey={`daily-outfit-${product.slug}`}/><View style={{flex:1}}><Text style={st.outfitLabel}>BỘ ĐỒ ĐỀ XUẤT</Text><Text style={st.product} numberOfLines={2}>{product.name}</Text><Text style={st.price}>{money(product.price)}</Text></View></View>
        <Pressable style={st.button} onPress={openProduct}><Text style={st.buttonText}>Đi đến xem bộ đồ</Text><Ionicons name="arrow-forward" size={17} color="#fff"/></Pressable>
        <Text style={st.note}>Gợi ý đổi mới mỗi ngày · bạn có thể đóng bằng nút ×</Text>
      </View>
    </View></View>
  </Modal>;
}

const st=StyleSheet.create({
  shade:{flex:1,backgroundColor:'rgba(16,12,10,.58)',alignItems:'center',justifyContent:'center',padding:24},
  card:{width:'100%',maxWidth:390,backgroundColor:C.paper,borderRadius:22,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,.5)'},
  close:{position:'absolute',right:11,top:11,zIndex:4,width:32,height:32,borderRadius:16,backgroundColor:'rgba(26,20,16,.75)',alignItems:'center',justifyContent:'center'},
  hero:{height:190,justifyContent:'flex-end'},heroTint:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(26,20,16,.38)'},heroCopy:{padding:16},
  eyebrow:{fontFamily:F.bodyB,fontSize:9.5,letterSpacing:1.6,color:'#F4D6A0'},place:{fontFamily:F.displayX,fontSize:24,color:'#fff',marginTop:4},region:{fontFamily:F.bodyB,fontSize:11.5,color:'#fff',marginTop:4},
  body:{padding:15},info:{flexDirection:'row',gap:9},time:{fontFamily:F.bodyB,fontSize:12.5,color:C.ink},tip:{fontFamily:F.body,fontSize:11.5,lineHeight:16,color:C.muted,marginTop:2},
  outfit:{flexDirection:'row',alignItems:'center',gap:11,backgroundColor:'#fff',borderWidth:1,borderColor:C.line,borderRadius:13,padding:9,marginTop:12},thumb:{width:58,height:68,borderRadius:9},
  outfitLabel:{fontFamily:F.bodyX,fontSize:8.5,letterSpacing:1,color:C.kin},product:{fontFamily:F.bodyB,fontSize:12.5,color:C.ink,marginTop:3},price:{fontFamily:F.bodyX,fontSize:12,color:C.shu,marginTop:3},
  button:{height:45,borderRadius:12,backgroundColor:C.shu,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:12},buttonText:{fontFamily:F.bodyB,fontSize:13,color:'#fff'},
  note:{fontFamily:F.body,fontSize:9.5,color:C.muted,textAlign:'center',marginTop:8},
});
