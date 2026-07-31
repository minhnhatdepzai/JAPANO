import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, Image, StyleProp, ImageStyle, View, Text } from 'react-native';
import { getShop, ShopInfo } from './api';
import { C, F } from '../theme/tokens';

const FALLBACK:ShopInfo={name:'JAPANO Store',hotline:'',email:'',address:'',shipFee:30000,cod:true,stripe:true,logo:null};
const ShopContext=createContext<{shop:ShopInfo;refresh:()=>Promise<void>}>({shop:FALLBACK,refresh:async()=>{}});
export const useShop=()=>useContext(ShopContext);

export function ShopProvider({children}:{children:React.ReactNode}){
  const [shop,setShop]=useState<ShopInfo>(FALLBACK);
  const refresh=useCallback(async()=>{try{setShop(await getShop());}catch{}},[]);
  useEffect(()=>{
    void refresh();
    const timer=setInterval(()=>void refresh(),5000);
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});
    return()=>{clearInterval(timer);subscription.remove();};
  },[refresh]);
  return <ShopContext.Provider value={{shop,refresh}}>{children}</ShopContext.Provider>;
}

export function BrandLogo({size=44,style}:{size?:number;style?:StyleProp<ImageStyle>}){
  const {shop}=useShop();
  if(shop.logo)return <Image source={{uri:shop.logo}} resizeMode="contain" style={[{width:size,height:size,borderRadius:12,backgroundColor:'#fff'},style]} />;
  return <View style={{width:size,height:size,borderRadius:12,backgroundColor:C.shu,alignItems:'center',justifyContent:'center'}}><Text style={{color:'#fff',fontFamily:F.display,fontSize:size*.48}}>ジ</Text></View>;
}
