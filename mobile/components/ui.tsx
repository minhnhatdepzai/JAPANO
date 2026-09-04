import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, TextStyle, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C, F, money } from '../theme/tokens';
import { RisingSun, Enso } from './art';
import { PressScale } from './motion';

export { FadeSlideIn, PressScale, Shimmer, ProgressBar, PulseDot, useReduceMotion } from './motion';

export const Screen = ({ children, bg=C.washi, wave=true, edges=['top'] as any }:
  { children:React.ReactNode; bg?:string; wave?:boolean; edges?:any }) => (
  <SafeAreaView edges={edges} style={{ flex:1, backgroundColor:bg }}>
    {wave && <RisingSun />}
    {children}
  </SafeAreaView>
);

export const Header = ({ title, onBack, right }:{ title?:string; onBack?:()=>void; right?:React.ReactNode }) => {
  const router = useRouter();
  const goBack = onBack || (()=>router.canGoBack()?router.back():router.replace('/(tabs)'));
  return (
    <View style={s.header}>
      <Pressable accessibilityLabel="Quay lại" onPress={goBack} style={s.backBtn} hitSlop={12}>
        <Ionicons name="arrow-back" size={23} color="#fff" />
      </Pressable>
      {!!title && <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>}
      <View style={{ minWidth:36, alignItems:'flex-end' }}>{right}</View>
    </View>
  );
};

export const Btn = ({ label, onPress, variant='primary', style, icon, disabled }:
  { label:string; onPress?:()=>void; variant?:'primary'|'ghost'|'ink'; style?:ViewStyle; icon?:string; disabled?:boolean }) => {
  const bg = variant==='primary'?C.shu: variant==='ink'?C.sumi:'transparent';
  const fg = variant==='ghost'?C.shu:'#fff';
  const borderColor = variant==='ink'?C.sumi:C.shuDeep;
  return (
    // Nút vô hiệu hoá không được co lại khi chạm — phản hồi chạm mà không có
    // hành động nào xảy ra sau đó là một lời hứa suông.
    <PressScale
      onPress={disabled?undefined:onPress}
      disabled={disabled}
      scaleTo={disabled?1:0.965}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={[s.btn,{ backgroundColor:bg, borderWidth:1.5, borderColor }, disabled&&{ opacity:0.42 }, style]}
    >
      {!!icon && <Ionicons name={icon as any} size={18} color={fg} style={{ marginRight:8 }} />}
      <Text style={{ color:fg, fontFamily:F.bodyB, fontSize:15 }}>{label}</Text>
    </PressScale>
  );
};

export const Chip = ({ label, active, onPress, small }:{ label:string; active?:boolean; onPress?:()=>void; small?:boolean }) => (
  <PressScale
    onPress={onPress}
    scaleTo={0.94}
    accessibilityRole="button"
    accessibilityState={{ selected: Boolean(active) }}
    style={[s.chip, active && s.chipOn, small && { paddingVertical:6, paddingHorizontal:11 }]}
  >
    <Text style={{ color:active?'#fff':C.ink, fontFamily:F.bodyM, fontSize:small?11:12.5 }}>{label}</Text>
  </PressScale>
);

/**
 * Giá bán. Giá thường để đen cho yên mắt; chỉ khi đang giảm thì giá mới mới lấy
 * màu nhấn — đó là lúc màu nhấn thực sự nói được điều gì đó.
 */
export const Price = ({ value, old, size=16 }:{ value:number; old?:number|null; size?:number }) => (
  <View style={{ flexDirection:'row', alignItems:'baseline', gap:6 }}>
    <Text style={{ color:old?C.shu:C.ink, fontFamily:F.bodyX, fontSize:size }}>{money(value)}</Text>
    {!!old && <Text style={{ color:C.muted, fontFamily:F.body, fontSize:size*0.72, textDecorationLine:'line-through' }}>{money(old)}</Text>}
  </View>
);

export const SectionHeader = ({ kanji, label, action, onAction }:
  { kanji?:string; label:string; action?:string; onAction?:()=>void }) => (
  <View>
    <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:18, marginBottom:6 }}>
      <Text style={{ fontFamily:F.display, fontSize:19, color:C.sumi }}>{label}</Text>
      {!!action && <Pressable onPress={onAction}><Text style={{ color:C.ink, fontFamily:F.bodyB, fontSize:12 }}>{action}</Text></Pressable>}
    </View>
    <View style={{ width:44, height:4, backgroundColor:C.borderStrong, borderRadius:2, marginBottom:12 }} />
  </View>
);

export const TagK = ({ label }:{ label:string }) => (
  <View style={{ backgroundColor:C.aiSoft, borderRadius:8, paddingVertical:4, paddingHorizontal:9, alignSelf:'flex-start' }}>
    <Text style={{ color:C.ai, fontFamily:F.bodyB, fontSize:11 }}>{label}</Text>
  </View>
);

export const Streak = ({ label }:{ label:string }) => (
  <View style={{ backgroundColor:C.shuSoft, borderRadius:999, paddingVertical:4, paddingHorizontal:9, alignSelf:'flex-start' }}>
    <Text style={{ color:C.shuDeep, fontFamily:F.bodyX, fontSize:11 }}>{label}</Text>
  </View>
);

export const EnsoAvatar = ({ size=64, letter='M' }:{ size?:number; letter?:string }) => (
  <View style={{ width:size, height:size, alignItems:'center', justifyContent:'center' }}>
    <View style={{ position:'absolute' }}><Enso size={size} sw={6} /></View>
    <View style={{ width:size-16, height:size-16, borderRadius:size, backgroundColor:C.ai, alignItems:'center', justifyContent:'center' }}>
      <Text style={{ color:'#fff', fontFamily:F.display, fontSize:size*0.34 }}>{letter}</Text>
    </View>
  </View>
);

export { money };

const s = StyleSheet.create({
  header:{ flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingVertical:8 },
  backBtn:{ width:44, height:44, borderRadius:14, borderWidth:2, borderColor:C.inverseText, backgroundColor:C.inverseSurface, alignItems:'center', justifyContent:'center', elevation:5, shadowColor:'#000', shadowOpacity:.2, shadowRadius:7, shadowOffset:{width:0,height:3} },
  headerTitle:{ flex:1, fontFamily:F.display, fontSize:18, color:C.sumi },
  btn:{ height:50, borderRadius:14, alignItems:'center', justifyContent:'center', flexDirection:'row' },
  chip:{ borderWidth:1, borderColor:C.line, borderRadius:999, paddingVertical:8, paddingHorizontal:13, backgroundColor:C.card },
  chipOn:{ backgroundColor:C.primary, borderColor:C.primary },
});
