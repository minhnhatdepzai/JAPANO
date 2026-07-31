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

export const GasshoVillage = ({ height=180 }:{height?:number}) => (
  <Svg width="100%" height={height} viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice">
    <Defs>
      <LinearGradient id="gasshoSky" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#5E7487" />
        <Stop offset="1" stopColor="#B9C5C9" />
      </LinearGradient>
    </Defs>
    <Rect width="120" height="80" fill="url(#gasshoSky)" />
    <Circle cx="96" cy="17" r="10" fill="#F7E6C8" opacity={0.78}/>
    <Path d="M0 50 L23 27 L37 41 L56 20 L78 43 L96 28 L120 50 Z" fill="#6A7B82" opacity={0.72}/>
    <Path d="M0 57 Q20 51 40 56 T80 55 T120 54 L120 80 L0 80 Z" fill="#EEF1EC" />
    <G>
      <Rect x="12" y="54" width="24" height="17" rx="1" fill="#7E5941" />
      <Path d="M8 56 L24 34 L40 56 Z" fill="#3D342D" />
      <Path d="M10 54 L24 36 L38 54" fill="none" stroke="#F4F1E8" strokeWidth="3" strokeLinecap="round" />
      <Rect x="21" y="60" width="6" height="11" fill="#412D24" />
      <Rect x="29" y="59" width="4" height="4" fill="#E8B96C" />
    </G>
    <G>
      <Rect x="48" y="49" width="31" height="23" rx="1" fill="#8A6246" />
      <Path d="M42 51 L63.5 22 L85 51 Z" fill="#392F29" />
      <Path d="M45 49 L63.5 25 L82 49" fill="none" stroke="#F5F2E9" strokeWidth="3.5" strokeLinecap="round" />
      <Rect x="60" y="60" width="7" height="12" fill="#3D2B23" />
      <Rect x="51" y="55" width="5" height="5" fill="#F0C479" />
      <Rect x="71" y="55" width="5" height="5" fill="#F0C479" />
    </G>
    <G>
      <Rect x="88" y="57" width="20" height="14" rx="1" fill="#79543E" />
      <Path d="M84 58 L98 39 L112 58 Z" fill="#40352E" />
      <Path d="M86 56 L98 41 L110 56" fill="none" stroke="#F4F1E8" strokeWidth="2.5" strokeLinecap="round" />
      <Rect x="95" y="62" width="5" height="9" fill="#3D2A22" />
    </G>
    <G fill="#FFFFFF" opacity={0.75}>
      <Circle cx="18" cy="18" r="1"/><Circle cx="33" cy="11" r=".8"/><Circle cx="48" cy="31" r=".8"/>
      <Circle cx="73" cy="12" r="1"/><Circle cx="89" cy="34" r=".8"/><Circle cx="109" cy="26" r="1"/>
    </G>
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

// Nền mặt trời mọc kiểu quốc kỳ Nhật Bản (Hinomaru): một vòng tròn đỏ, mờ,
// đặt phía trên khung hình — dùng làm nền trang trí chung cho toàn app.
export const RisingSun = ({ color=C.shu, opacity=0.07 }:{color?:string;opacity?:number}) => (
  <View pointerEvents="none" style={{ position:'absolute', left:0, right:0, top:0, bottom:0, opacity }}>
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      <Circle cx={50} cy={20} r={16} fill={color} />
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
