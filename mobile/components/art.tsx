import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Rect, G, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { C } from '../theme/tokens';

export const Enso = ({ size=64, color=C.shu, sw=8 }:{size?:number;color?:string;sw?:number}) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Path d="M80 24 A40 40 0 1 0 86 62" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
  </Svg>
);

export const Hanko = ({ size=34, label='ジ' }:{size?:number;label?:string}) => (
  <View style={{ width:size, height:size, borderWidth:2, borderColor:C.shu, borderRadius:8,
    alignItems:'center', justifyContent:'center', transform:[{ rotate:'-6deg' }] }}>
    {/* label rendered by caller via Text overlay if desired */}
  </View>
);

// Full-bleed torii scene
export const Torii = ({ height=250 }:{height?:number}) => (
  <Svg width="100%" height={height} viewBox="0 0 100 130" preserveAspectRatio="xMidYMid slice">
    <Rect width="100" height="130" fill={C.ai} />
    <Circle cx="72" cy="34" r="16" fill={C.sakura} opacity={0.85} />
    <G fill={C.shuDeep}>
      <Rect x="20" y="40" width="60" height="9" rx="2" />
      <Path d="M14 40 L86 40 L80 33 L20 33 Z" />
      <Rect x="26" y="49" width="8" height="70" />
      <Rect x="66" y="49" width="8" height="70" />
      <Rect x="30" y="58" width="40" height="6" />
    </G>
    <G fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1}>
      <Path d="M0 128 A18 18 0 0 1 36 128 A18 18 0 0 1 72 128 A18 18 0 0 1 108 128" />
    </G>
  </Svg>
);

export const Fuji = ({ height=120 }:{height?:number}) => (
  <Svg width="100%" height={height} viewBox="0 0 100 90" preserveAspectRatio="xMidYMid slice">
    <Rect width="100" height="90" fill="#2b3a4d" />
    <Circle cx="26" cy="26" r="12" fill="#f0d9b6" opacity={0.9} />
    <Path d="M0 90 L38 34 L58 56 L72 40 L100 90 Z" fill="#3c4a5e" />
    <Path d="M30 44 L38 34 L46 44 L42 48 L34 48 Z" fill={C.washi} />
    <Path d="M64 50 L72 40 L82 54 L76 56 L70 56 Z" fill={C.washi} />
  </Svg>
);

export const Noren = ({ height=150 }:{height?:number}) => (
  <Svg width="100%" height={height} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
    <Rect width="100" height="100" fill={C.shuDeep} />
    <G fill="#5f2019">
      <Rect x="6" y="30" width="26" height="24" />
      <Rect x="38" y="26" width="26" height="28" />
      <Rect x="70" y="32" width="24" height="22" />
    </G>
    <Rect x="0" y="46" width="100" height="8" fill="#33261d" />
    <Circle cx="50" cy="80" r="15" fill="none" stroke={C.kin} strokeWidth={2} opacity={0.55} />
  </Svg>
);

// Subtle seigaiha wave background (absolute fill)
export const Seigaiha = ({ color=C.sumi, opacity=0.05 }:{color?:string;opacity?:number}) => (
  <View pointerEvents="none" style={{ position:'absolute', left:0, right:0, top:0, bottom:0, opacity }}>
    <Svg width="100%" height="100%" viewBox="0 0 120 60" preserveAspectRatio="xMidYMid">
      <G fill="none" stroke={color} strokeWidth={1.2}>
        <Path d="M0 60 A30 30 0 0 1 60 60 A30 30 0 0 1 120 60" />
        <Path d="M0 60 A20 20 0 0 1 60 60 A20 20 0 0 1 120 60" />
        <Path d="M0 60 A10 10 0 0 1 60 60 A10 10 0 0 1 120 60" />
      </G>
    </Svg>
  </View>
);

// small woodblock garment placeholder (used where no photo)
export const GarmentTile = ({ bg=C.matcha, fg='#e9e0cd' }:{bg?:string;fg?:string}) => (
  <Svg width="100%" height="100%" viewBox="0 0 100 130" preserveAspectRatio="xMidYMid slice">
    <Rect width="100" height="130" fill={bg} />
    <Path d="M50 20 L72 32 L67 60 L60 57 L60 104 L40 104 L40 57 L33 60 L28 32 Z" fill={fg} />
    <Circle cx="50" cy="13" r="7" fill="rgba(255,255,255,0.5)" />
  </Svg>
);
