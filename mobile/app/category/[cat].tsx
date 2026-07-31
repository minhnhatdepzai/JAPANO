import React from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Header, TagK } from '../../components/ui';
import { Noren } from '../../components/art';
import { ProductCard } from '../../components/ProductCard';
import { PRODUCTS, CAT_LABEL, storyFor, CATEGORIES } from '../../lib/catalog';
import { C, F } from '../../theme/tokens';

export default function Category() {
  const { cat } = useLocalSearchParams<{ cat:string }>();
  const router = useRouter();
  const { width:screenWidth } = useWindowDimensions();
  const cardWidth = Math.floor((screenWidth - 36 - 12) / 2);
  const meta = CATEGORIES.find(c=>c.key===cat);
  const list = PRODUCTS.filter(p=>p.cat===cat);
  const story = storyFor(cat);
  return (
    <Screen wave={false} edges={[]}>
      <View style={{ height:150 }}>
        <Noren height={150} />
        <View style={{ position:'absolute', top:8, left:0, right:0 }}><Header /></View>
        <View style={st.norenTag}><Text style={{ fontFamily:F.display, fontSize:18, color:'#fff', letterSpacing:2 }}>{CAT_LABEL[cat]?.toUpperCase()}</Text></View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal:18, paddingBottom:24 }}>
        <Text style={{ fontFamily:F.display, fontSize:22, color:C.sumi, marginTop:16 }}>{CAT_LABEL[cat]}</Text>
        <Text style={{ fontFamily:F.body, fontSize:13, lineHeight:22, color:C.ink, marginTop:6 }}>{story.text}</Text>
        <View style={{ marginTop:10 }}><TagK label={story.tags.join(' · ')} /></View>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:16, marginBottom:10 }}>
          <Text style={{ fontFamily:F.display, fontSize:16, color:C.sumi }}>{list.length} mẫu {CAT_LABEL[cat]}</Text>
          <Text style={{ fontFamily:F.bodyM, fontSize:12, color:C.ink }}>Lọc ⌄</Text>
        </View>
        <View style={st.grid}>
          {list.map(p=><ProductCard key={p.slug} p={p} width={cardWidth} imgH={Math.round(cardWidth*1.17)} />)}
        </View>
      </ScrollView>
    </Screen>
  );
}
const st = StyleSheet.create({
  norenTag:{ position:'absolute', bottom:0, left:0, right:0, backgroundColor:C.shu, paddingVertical:12, alignItems:'center' },
  grid:{ flexDirection:'row', flexWrap:'wrap', justifyContent:'center', columnGap:12, rowGap:12, width:'100%', alignSelf:'center' },
});
