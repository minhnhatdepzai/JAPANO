import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../../theme/tokens';
import { Price, Btn } from '../../components/ui';
import { PRODUCTS } from '../../lib/catalog';
import { useStore } from '../../lib/store';
import { SmartImage } from '../../components/SmartImage';

export default function Wishlist() {
  const router = useRouter();
  const { wish, toggleWish, addToCart } = useStore();
  const saved = wish.map(s=>PRODUCTS.find(p=>p.slug===s)).filter(Boolean) as any[];
  return (
    <SafeAreaView edges={['top']} style={{ flex:1, backgroundColor:C.washi }}>
      <View style={{ paddingHorizontal:18, paddingTop:8 }}>
        <Text style={{ fontFamily:F.display, fontSize:24, color:C.sumi }}>Sản phẩm đã lưu</Text>
        <Text style={{ fontFamily:F.body, fontSize:13, color:C.muted, marginTop:2 }}>{saved.length} sản phẩm yêu thích</Text>
        <View style={{ width:44, height:4, backgroundColor:C.borderStrong, borderRadius:2, marginTop:12, marginBottom:14 }} />
      </View>
      {saved.length===0 ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:30 }}>
          <Ionicons name="heart-outline" size={54} color={C.hair} />
          <Text style={{ fontFamily:F.display, fontSize:18, color:C.sumi, marginTop:12 }}>Chưa có sản phẩm đã lưu</Text>
          <Text style={{ fontFamily:F.body, fontSize:13, color:C.muted, marginTop:4, textAlign:'center' }}>Chạm ♡ trên sản phẩm để lưu vào đây.</Text>
          <Btn label="Khám phá" style={{ marginTop:18, width:200 }} onPress={()=>router.push('/(tabs)/products')} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal:18, paddingBottom:24 }}>
          <View style={st.grid}>
            {saved.map(p=>(
              <View key={p.slug} style={{ width:'48%' }}>
                <Pressable onPress={()=>router.push(`/product/${p.slug}`)}>
                  <View style={st.tile}>
                    <SmartImage source={p.images[0]} style={{ width:'100%', height:'100%' }} recyclingKey={`${p.slug}-wishlist`} />
                    <Pressable style={st.heart} onPress={()=>toggleWish(p.slug)} hitSlop={6}><Ionicons name="heart" size={16} color="#fff" /></Pressable>
                  </View>
                  <Text style={{ fontFamily:F.bodyB, fontSize:12.5, color:C.ink, marginTop:7 }} numberOfLines={1}>{p.name}</Text>
                  <Price value={p.price} old={p.old} size={13} />
                </Pressable>
                <View style={{ flexDirection:'row', gap:6, marginTop:6 }}>
                  <Pressable style={st.mini} onPress={()=>addToCart(p.slug)}><Text style={st.miniT}>Giỏ</Text></Pressable>
                  <Pressable style={[st.mini, st.miniOn]} onPress={()=>router.push('/tryon')}><Text style={[st.miniT,{ color:'#fff' }]}>Thử đồ</Text></Pressable>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
const st = StyleSheet.create({
  grid:{ flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between', rowGap:14 },
  tile:{ height:178, borderRadius:14, overflow:'hidden', backgroundColor:C.washi2, borderWidth:1.5, borderColor:C.blue },
  heart:{ position:'absolute', top:8, right:8, width:30, height:30, borderRadius:15, backgroundColor:C.primary, alignItems:'center', justifyContent:'center' },
  mini:{ flex:1, alignItems:'center', paddingVertical:6, borderRadius:999, borderWidth:1, borderColor:C.line, backgroundColor:'#fff' },
  miniOn:{ backgroundColor:C.primary, borderColor:C.primary },
  miniT:{ fontFamily:F.bodyM, fontSize:11, color:C.ink },
});
