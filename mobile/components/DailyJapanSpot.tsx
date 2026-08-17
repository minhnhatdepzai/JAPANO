import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, F, money } from '../theme/tokens';
import { useCatalog } from '../lib/data';
import { SmartImage } from './SmartImage';
import { GasshoVillage } from './art';
import { PHOTO_ATTRIBUTION, SPOTS } from '../lib/japanSpots';

const STORAGE_KEY='@japano/daily-japan-spot/v4';

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
  const openMap=()=>{void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(suggestion.mapQuery)}`).catch(()=>undefined);};
  const openSource=()=>{void Linking.openURL(suggestion.sourceUrl).catch(()=>undefined);};
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={()=>setVisible(false)}>
    <View style={st.shade}><View style={st.card}>
      <Pressable style={st.close} hitSlop={10} onPress={()=>setVisible(false)}><Ionicons name="close" size={20} color="#fff"/></Pressable>
      <View style={st.hero}>
        {suggestion.place==='Làng Shirakawa-go'
          ? <View style={StyleSheet.absoluteFill}><GasshoVillage height={176}/></View>
          : <SmartImage source={{uri:suggestion.photoUrl}} style={StyleSheet.absoluteFill as any} recyclingKey={`daily-spot-${suggestion.place}`}/>}
        <View style={st.heroTint}/><View style={st.heroCopy}><Text style={st.eyebrow}>ĐỊA ĐIỂM GỢI Ý HÔM NAY</Text><Text style={st.place}>{suggestion.place}</Text><Text style={st.region}><Ionicons name="location" size={12}/> {suggestion.prefecture}</Text></View>
      </View>
      <ScrollView style={st.body} contentContainerStyle={st.bodyContent} showsVerticalScrollIndicator={false}>
        {suggestion.place!=='Làng Shirakawa-go'&&<Text style={st.photoCredit}>{PHOTO_ATTRIBUTION}</Text>}
        <View style={st.info}><Ionicons name="camera-outline" size={19} color={C.ink}/><View style={{flex:1}}><Text style={st.time}>{suggestion.time}</Text><Text style={st.tip}>{suggestion.tip}</Text></View></View>

        <GuideSection icon="navigate-circle-outline" title="NẰM Ở ĐÂU?">
          <Text style={st.guideText}>{suggestion.where}</Text>
          <Pressable style={st.mapButton} onPress={openMap}><Ionicons name="map-outline" size={14} color={C.ink}/><Text style={st.mapButtonText}>Mở vị trí trên bản đồ</Text><Ionicons name="open-outline" size={12} color={C.ink}/></Pressable>
        </GuideSection>

        <GuideSection icon="time-outline" title="LỊCH SỬ NGẮN">
          <Text style={st.guideText}>{suggestion.history}</Text>
        </GuideSection>

        <GuideSection icon="sparkles-outline" title="CÓ GÌ NỔI BẬT?">
          {suggestion.highlights.map((item,index)=><View key={index} style={st.bulletRow}><View style={st.bullet}/><Text style={st.bulletText}>{item}</Text></View>)}
        </GuideSection>

        <GuideSection icon="camera-outline" title="CHỤP ẢNH Ở ĐÂU ĐẸP?">
          {suggestion.photoSpots.map((spot,index)=><View key={spot.name} style={st.photoSpot}><Text style={st.photoIndex}>{String(index+1).padStart(2,'0')}</Text><View style={{flex:1}}><Text style={st.photoName}>{spot.name}</Text><Text style={st.photoTip}>{spot.tip}</Text></View></View>)}
        </GuideSection>

        <GuideSection icon="bus-outline" title="ĐI THẾ NÀO?">
          <Text style={st.guideText}>{suggestion.access}</Text>
        </GuideSection>

        <Pressable style={st.source} onPress={openSource}><Ionicons name="shield-checkmark-outline" size={14} color={C.kin}/><Text style={st.sourceText}>Nguồn kiểm chứng: {suggestion.sourceLabel}</Text><Ionicons name="open-outline" size={12} color={C.kin}/></Pressable>

        <View style={st.outfitDivider}><View style={st.dividerLine}/><Text style={st.dividerText}>PHỐI ĐỒ CHO CHUYẾN ĐI</Text><View style={st.dividerLine}/></View>
        <View style={st.outfit}><SmartImage source={product.images[0]} style={st.thumb} recyclingKey={`daily-outfit-${product.slug}`}/><View style={{flex:1}}><Text style={st.outfitLabel}>BỘ ĐỒ ĐỀ XUẤT</Text><Text style={st.product} numberOfLines={2}>{product.name}</Text><Text style={st.price}>{money(product.price)}</Text></View></View>
        <Pressable style={st.button} onPress={openProduct}><Text style={st.buttonText}>Đi đến xem bộ đồ</Text><Ionicons name="arrow-forward" size={17} color="#fff"/></Pressable>
        <Text style={st.note}>Gợi ý đổi mới mỗi ngày · cuộn để khám phá trọn địa danh</Text>
      </ScrollView>
    </View></View>
  </Modal>;
}

function GuideSection({icon,title,children}:{icon:keyof typeof Ionicons.glyphMap;title:string;children:React.ReactNode}){
  return <View style={st.section}><View style={st.sectionTitle}><View style={st.sectionIcon}><Ionicons name={icon} size={14} color={C.ink}/></View><Text style={st.sectionTitleText}>{title}</Text></View>{children}</View>;
}

const st=StyleSheet.create({
  shade:{flex:1,backgroundColor:'rgba(16,12,10,.58)',alignItems:'center',justifyContent:'center',paddingHorizontal:18,paddingVertical:28},
  card:{width:'100%',maxWidth:410,maxHeight:'94%',backgroundColor:C.paper,borderRadius:22,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,.5)'},
  close:{position:'absolute',right:11,top:11,zIndex:4,width:32,height:32,borderRadius:16,backgroundColor:'rgba(26,20,16,.75)',alignItems:'center',justifyContent:'center'},
  hero:{height:176,justifyContent:'flex-end'},heroTint:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(26,20,16,.43)'},heroCopy:{padding:16},
  eyebrow:{fontFamily:F.bodyB,fontSize:9.5,letterSpacing:1.6,color:'rgba(255,255,255,0.72)'},place:{fontFamily:F.displayX,fontSize:24,color:'#fff',marginTop:4},region:{fontFamily:F.bodyB,fontSize:11.5,color:'#fff',marginTop:4},
  body:{flexShrink:1},bodyContent:{padding:15,paddingBottom:18},photoCredit:{fontFamily:F.body,fontSize:9,color:C.muted,textAlign:'right',marginBottom:8},info:{flexDirection:'row',gap:9,backgroundColor:C.washi2,borderRadius:12,padding:11},time:{fontFamily:F.bodyB,fontSize:12.5,color:C.ink},tip:{fontFamily:F.body,fontSize:11.5,lineHeight:17,color:C.muted,marginTop:2},
  section:{marginTop:16},sectionTitle:{flexDirection:'row',alignItems:'center',gap:7,marginBottom:7},sectionIcon:{width:26,height:26,borderRadius:8,backgroundColor:C.washi2,alignItems:'center',justifyContent:'center'},sectionTitleText:{fontFamily:F.bodyX,fontSize:9.5,letterSpacing:1.15,color:C.shuDeep},
  guideText:{fontFamily:F.body,fontSize:11.5,lineHeight:18,color:C.ink},
  mapButton:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,borderWidth:1,borderColor:'#E8C7BD',backgroundColor:'#FFF8F5',borderRadius:999,paddingHorizontal:10,paddingVertical:7,marginTop:9},mapButtonText:{fontFamily:F.bodyB,fontSize:10.5,color:C.ink},
  bulletRow:{flexDirection:'row',alignItems:'flex-start',gap:8,marginBottom:7},bullet:{width:5,height:5,borderRadius:3,backgroundColor:C.kin,marginTop:7},bulletText:{flex:1,fontFamily:F.body,fontSize:11.5,lineHeight:17.5,color:C.ink},
  photoSpot:{flexDirection:'row',alignItems:'flex-start',gap:10,backgroundColor:'#fff',borderWidth:1,borderColor:C.hair,borderRadius:11,padding:10,marginBottom:7},photoIndex:{fontFamily:F.displayX,fontSize:17,color:C.ink},photoName:{fontFamily:F.bodyB,fontSize:11.5,color:C.ink},photoTip:{fontFamily:F.body,fontSize:10.5,lineHeight:15.5,color:C.muted,marginTop:2},
  source:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:C.washi2,borderRadius:9,padding:9,marginTop:14},sourceText:{flex:1,fontFamily:F.bodyM,fontSize:9.5,lineHeight:13,color:C.muted},
  outfitDivider:{flexDirection:'row',alignItems:'center',gap:8,marginTop:18},dividerLine:{height:1,flex:1,backgroundColor:C.line},dividerText:{fontFamily:F.bodyX,fontSize:8.5,letterSpacing:1,color:C.muted},
  outfit:{flexDirection:'row',alignItems:'center',gap:11,backgroundColor:'#fff',borderWidth:1,borderColor:C.line,borderRadius:13,padding:9,marginTop:11},thumb:{width:58,height:68,borderRadius:9},
  outfitLabel:{fontFamily:F.bodyX,fontSize:8.5,letterSpacing:1,color:C.kin},product:{fontFamily:F.bodyB,fontSize:12.5,color:C.ink,marginTop:3},price:{fontFamily:F.bodyX,fontSize:12,color:C.ink,marginTop:3},
  button:{height:45,borderRadius:12,backgroundColor:C.primary,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:12},buttonText:{fontFamily:F.bodyB,fontSize:13,color:'#fff'},
  note:{fontFamily:F.body,fontSize:9.5,color:C.muted,textAlign:'center',marginTop:8},
});
