import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C, F } from '../theme/tokens';
import { Price } from './ui';
import { Product } from '../lib/catalog';
import { useStore } from '../lib/store';
import { SmartImage } from './SmartImage';

export const Heart = ({ slug }:{ slug:string }) => {
  const { isWished, toggleWish } = useStore();
  const on = isWished(slug);
  return (
    <Pressable onPress={()=>toggleWish(slug)} style={st.heart} hitSlop={6}>
      <Ionicons name={on?'heart':'heart-outline'} size={16} color={C.shu} />
    </Pressable>
  );
};

export const ProductCard = ({ p, width=150, reason, imgH=180 }:
  { p:Product; width?:number; reason?:string; imgH?:number }) => {
  const router = useRouter();
  return (
    <Pressable style={{ width }} onPress={()=>router.push(`/product/${p.slug}`)}>
      <View style={[st.tile,{ height:imgH }]}>
        <SmartImage source={p.images[0]} style={st.img} recyclingKey={`${p.slug}-card`} />
        <Heart slug={p.slug} />
      </View>
      <Text style={st.nm} numberOfLines={1}>{p.name}</Text>
      <Price value={p.price} old={p.old} size={13} />
      {!!reason && <Text style={st.reason}>{reason}</Text>}
    </Pressable>
  );
};

const st = StyleSheet.create({
  tile:{ borderRadius:14, overflow:'hidden', backgroundColor:C.washi2, position:'relative' },
  img:{ width:'100%', height:'100%' },
  heart:{ position:'absolute', top:8, right:8, width:30, height:30, borderRadius:15, backgroundColor:'rgba(255,255,255,0.9)', alignItems:'center', justifyContent:'center' },
  nm:{ fontFamily:F.bodyB, fontSize:12.5, color:C.ink, marginTop:7, marginBottom:2 },
  reason:{ fontFamily:F.bodyB, fontSize:10, color:C.kin, marginTop:2 },
});
