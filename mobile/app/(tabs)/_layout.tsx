import React from 'react';
import { Pressable, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme/tokens';
import { useAuth } from '../../lib/auth';

const Fab = () => {
  const router = useRouter();
  const { requireAuth } = useAuth();
  return (
    <Pressable onPress={()=>{if(requireAuth('/camera'))router.push('/camera');}} style={{ top:-22, alignItems:'center', justifyContent:'center' }}>
      <View style={{ width:56, height:56, borderRadius:18, backgroundColor:C.shu, alignItems:'center', justifyContent:'center', borderWidth:4, borderColor:C.paper,
        shadowColor:C.shu, shadowOpacity:0.5, shadowRadius:12, shadowOffset:{ width:0, height:8 }, elevation:6 }}>
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
      tabBarStyle:{ backgroundColor:C.paper, borderTopColor:C.line, height:68, paddingBottom:10, paddingTop:8 },
      tabBarLabelStyle:{ fontFamily:'Arimo_600SemiBold', fontSize:10 },
    }}>
      <Tabs.Screen name="index" options={{ title:'Trang chủ', tabBarIcon:({color,size})=><Ionicons name="home-outline" size={22} color={color} /> }} />
      <Tabs.Screen name="products" options={{ title:'Sản phẩm', tabBarIcon:({color})=><Ionicons name="grid-outline" size={22} color={color} /> }} />
      <Tabs.Screen name="scan" options={{ title:'', tabBarButton:()=> <Fab /> }} />
      <Tabs.Screen name="wishlist" options={{ title:'Yêu thích', tabBarIcon:({color})=><Ionicons name="heart-outline" size={22} color={color} /> }} listeners={{tabPress:e=>{if(!isAuthenticated){e.preventDefault();requireAuth('/(tabs)/wishlist');}}}} />
      <Tabs.Screen name="me" options={{ title:'Cá nhân', tabBarIcon:({color})=><Ionicons name="person-outline" size={22} color={color} /> }} listeners={{tabPress:e=>{if(!isAuthenticated){e.preventDefault();requireAuth('/(tabs)/me');}}}} />
    </Tabs>
  );
}
