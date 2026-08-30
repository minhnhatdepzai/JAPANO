import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, StyleProp, View, ViewStyle } from 'react-native';
import { getShop, ShopInfo } from './api';
import { C, F } from '../theme/tokens';

const FALLBACK:ShopInfo={name:'JAPANO Store',hotline:'',email:'',address:'',shipFee:30000,cod:true,stripe:true,logo:null};
const BUNDLED_LOGO=require('../assets/brand/japano-monogram.png');
const ShopContext=createContext<{shop:ShopInfo;refresh:()=>Promise<void>}>({shop:FALLBACK,refresh:async()=>{}});
export const useShop=()=>useContext(ShopContext);

// ShopProvider bọc gần như toàn bộ cây màn hình (app/_layout.tsx), nên mọi lần
// nó đổi state là cả app vẽ lại. Ba điều kiện dưới đây giữ nó gần như đứng yên:
//   1. Chỉ setShop khi nội dung THẬT SỰ khác — getShop() luôn trả object mới,
//      nếu set thẳng thì cứ mỗi nhịp poll là toàn bộ app re-render dù dữ liệu
//      y hệt.
//   2. Ngừng hẳn hẹn giờ khi app chạy nền (trước đây vẫn nã request mãi mãi,
//      tốn pin và 4G của khách), và làm mới ngay lúc quay lại.
//   3. Giá trị context được memo hoá để consumer không re-render oan.
const POLL_MS=30_000;
const sameShop=(a:ShopInfo,b:ShopInfo)=>
  a.name===b.name&&a.hotline===b.hotline&&a.email===b.email&&a.address===b.address&&
  a.shipFee===b.shipFee&&a.cod===b.cod&&a.stripe===b.stripe&&a.logo===b.logo;

export function ShopProvider({children}:{children:React.ReactNode}){
  const [shop,setShop]=useState<ShopInfo>(FALLBACK);
  const inFlight=useRef(false);
  const refresh=useCallback(async()=>{
    if(inFlight.current)return;
    inFlight.current=true;
    try{
      const next=await getShop();
      setShop(prev=>sameShop(prev,next)?prev:next);
    }catch{}
    finally{inFlight.current=false;}
  },[]);
  useEffect(()=>{
    let timer:ReturnType<typeof setInterval>|null=null;
    const start=()=>{if(!timer)timer=setInterval(()=>void refresh(),POLL_MS);};
    const stop=()=>{if(timer){clearInterval(timer);timer=null;}};
    void refresh();
    start();
    const subscription=AppState.addEventListener('change',state=>{
      if(state==='active'){void refresh();start();}else stop();
    });
    return()=>{stop();subscription.remove();};
  },[refresh]);
  const value=useMemo(()=>({shop,refresh}),[shop,refresh]);
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function BrandLogo({size=44,style}:{size?:number;style?:StyleProp<ViewStyle>}){
  const {shop}=useShop();
  // Logo ở cạnh lời chào phải có ngay cả khi API chưa cấu hình `shop.logo` hoặc
  // điện thoại đang mất mạng. Trước đây fallback là ô đỏ chữ ジ nên nhìn giống
  // placeholder; dùng monogram đóng gói trong APK làm nguồn chắc chắn.
  const source=shop.logo?{uri:shop.logo}:BUNDLED_LOGO;
  return (
    <View style={[{
      width:size,height:size,borderRadius:size*.27,backgroundColor:'#fffaf2',
      borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center',
      overflow:'hidden',
    },style]}>
      <Image source={source} resizeMode="contain" style={{width:size*.88,height:size*.88}} />
    </View>
  );
}
