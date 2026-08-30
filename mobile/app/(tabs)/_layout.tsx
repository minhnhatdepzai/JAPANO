import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme/tokens';
import { useAuth } from '../../lib/auth';

const Fab = () => {
  const router = useRouter();
  const { requireAuth } = useAuth();
  return (
    <Pressable accessibilityLabel="Mở ống kính JAPANO" onPress={()=>{if(requireAuth('/camera'))router.push('/camera');}} style={st.fabHit}>
      <View style={st.fab}>
        <Ionicons name="camera" size={24} color="#fff" />
      </View>
    </Pressable>
  );
};

export default function TabLayout() {
  const { isAuthenticated, requireAuth } = useAuth();
  return (
    <Tabs screenOptions={{
      headerShown:false,
      tabBarActiveTintColor:C.shu,
      tabBarInactiveTintColor:C.muted,
      tabBarHideOnKeyboard:true,
      tabBarStyle:st.bar,
      tabBarItemStyle:st.barItem,
      tabBarLabelStyle:st.barLabel,
    }}>
      <Tabs.Screen name="index" options={{ title:'Trang chủ', tabBarIcon:({color,focused})=><View style={[st.icon,focused&&st.iconOn]}><Ionicons name={focused?'home':'home-outline'} size={21} color={color} /></View> }} />
      <Tabs.Screen name="products" options={{ title:'Sản phẩm', tabBarIcon:({color,focused})=><View style={[st.icon,focused&&st.iconOn]}><Ionicons name={focused?'grid':'grid-outline'} size={21} color={color} /></View> }} />
      <Tabs.Screen name="scan" options={{ title:'', tabBarButton:()=> <Fab /> }} />
      <Tabs.Screen name="wishlist" options={{ title:'Yêu thích', tabBarIcon:({color,focused})=><View style={[st.icon,focused&&st.iconOn]}><Ionicons name={focused?'heart':'heart-outline'} size={21} color={color} /></View> }} listeners={{tabPress:e=>{if(!isAuthenticated){e.preventDefault();requireAuth('/(tabs)/wishlist');}}}} />
      <Tabs.Screen name="me" options={{ title:'Cá nhân', tabBarIcon:({color,focused})=><View style={[st.icon,focused&&st.iconOn]}><Ionicons name={focused?'person':'person-outline'} size={21} color={color} /></View> }} listeners={{tabPress:e=>{if(!isAuthenticated){e.preventDefault();requireAuth('/(tabs)/me');}}}} />
    </Tabs>
  );
}

const st=StyleSheet.create({
  bar:{ backgroundColor:C.card, borderTopColor:C.line, borderTopWidth:1, height:74, paddingBottom:9, paddingTop:7, elevation:14, shadowColor:'#000', shadowOpacity:.08, shadowRadius:14, shadowOffset:{width:0,height:-4} },
  barItem:{ paddingTop:1 },
  barLabel:{ fontFamily:'Arimo_600SemiBold', fontSize:10.5, marginTop:2 },
  icon:{ width:38, height:27, borderRadius:14, alignItems:'center', justifyContent:'center' },
  iconOn:{ backgroundColor:C.shuSoft },
  fabHit:{ top:-23, alignItems:'center', justifyContent:'center' },
  fab:{ width:60, height:60, borderRadius:22, backgroundColor:C.primary, alignItems:'center', justifyContent:'center', borderWidth:5, borderColor:C.card, shadowColor:C.shu, shadowOpacity:.26, shadowRadius:16, shadowOffset:{width:0,height:8}, elevation:8 },
});
