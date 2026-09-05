import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Screen, Header, SectionHeader, TagK, Btn, Price } from '../components/ui';
import { Product } from '../lib/catalog';
import { useCatalog } from '../lib/data';
import { ApiProductRef, CheerUp, recommendStyle, StylistRecommendation } from '../lib/api';
import { loadStyleProfile } from '../lib/profile';
import { C, F } from '../theme/tokens';
import { SmartImage } from '../components/SmartImage';
import { useGpuFocus } from '../lib/useGpuFocus';

type PickedImage={uri:string;base64:string};
const refKey=(ref:ApiProductRef)=>typeof ref==='string'?ref:String(ref.slug||ref.productId||ref.id||ref._id||'');
const dataUri=(asset:ImagePicker.ImagePickerAsset)=>`data:${asset.mimeType||'image/jpeg'};base64,${asset.base64||''}`;

export default function Camera() {
  useGpuFocus('chat');
  const router = useRouter();
  const {products}=useCatalog();
  const [photo,setPhoto]=useState<PickedImage|null>(null);
  const [loading,setLoading]=useState(false);
  const [enriching,setEnriching]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const [error,setError]=useState('');
  const [summary,setSummary]=useState('Chụp hoặc chọn một ảnh để Ori phân tích phong cách.');
  const [tags,setTags]=useState<string[]>([]);
  const [outfitRefs,setOutfitRefs]=useState<ApiProductRef[]>([]);
  const [accessoryRefs,setAccessoryRefs]=useState<ApiProductRef[]>([]);
  const [moodLabel,setMoodLabel]=useState('');
  const [ageRange,setAgeRange]=useState('');
  const [cheerUp,setCheerUp]=useState<CheerUp|null>(null);
  // Lý do gợi ý do máy chủ tính từ tín hiệu thật (gu đã chọn, hoà sắc với tông
  // màu trong ảnh, vai trò trong set, hành vi). Trước đây màn này tự bịa chuỗi
  // 'hợp phong cách của bạn' cho mọi món và phụ kiện thì không có chữ nào.
  const [reasons,setReasons]=useState<Record<string,string>>({});
  const scan=useRef(new Animated.Value(0)).current;
  const analysisRun=useRef(0);

  useEffect(()=>{
    if(!loading&&!enriching){setElapsed(0);return;}
    const started=Date.now();
    const tick=()=>setElapsed(Math.floor((Date.now()-started)/1000));
    tick();
    const timer=setInterval(tick,1000);
    return()=>clearInterval(timer);
  },[loading,enriching]);

  useEffect(()=>{
    if(!loading){scan.stopAnimation();scan.setValue(0);return;}
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(scan,{toValue:1,duration:1200,easing:Easing.inOut(Easing.quad),useNativeDriver:true}),
      Animated.timing(scan,{toValue:0,duration:1200,easing:Easing.inOut(Easing.quad),useNativeDriver:true}),
    ]));
    loop.start();
    return()=>loop.stop();
  },[loading,scan]);

  const fallbackOutfits=useMemo(()=>['haori-dang-dai','cardigan-dai','so-mi-trang'].map(s=>products.find(p=>p.slug===s)).filter(Boolean) as Product[],[products]);
  const fallbackAccessories=useMemo(()=>products.filter(p=>p.cat==='phu-kien').slice(0,4),[products]);
  const resolve=(refs:ApiProductRef[],fallback:Product[])=>{
    const found=refs.map(ref=>{const key=refKey(ref);return products.find(p=>p.slug===key||p.id===key);}).filter(Boolean) as Product[];
    return (found.length?found:fallback).slice(0,4);
  };
  // Lý do lấy theo slug từ máy chủ; nếu máy chủ không trả (mất mạng, đang dùng
  // danh sách dự phòng) thì nói thẳng là gợi ý mặc định, chứ không giả vờ rằng
  // có một lý do cá nhân hoá đằng sau.
  const reasonFor=(p:Product,fallbackText='Gợi ý mặc định khi chưa phân tích được ảnh')=>reasons[p.slug]||reasons[p.id||'']||fallbackText;
  const outfits=resolve(outfitRefs,fallbackOutfits);
  const accessories=resolve(accessoryRefs,fallbackAccessories);

  const choose=async(camera:boolean)=>{
    setError('');
    if(camera){
      const permission=await ImagePicker.requestCameraPermissionsAsync();
      if(!permission.granted){Alert.alert('Cần quyền camera','Hãy cấp quyền camera để chụp ảnh phân tích.');return;}
    }
    const result=camera
      ? await ImagePicker.launchCameraAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,quality:.78,base64:true})
      : await ImagePicker.launchImageLibraryAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,quality:.78,base64:true});
    const asset=result.canceled?null:result.assets?.[0];
    if(!asset)return;
    if(!asset.base64){setError('Không đọc được dữ liệu ảnh. Vui lòng chọn lại.');return;}
    analysisRun.current+=1;
    setPhoto({uri:asset.uri,base64:dataUri(asset)});
    setLoading(false);setEnriching(false);
    setSummary('Ảnh đã sẵn sàng. JAPANO Lens sẽ đọc bảng màu trước, rồi nâng cấp phân tích chân dung ở nền.');
    setTags([]);setOutfitRefs([]);setAccessoryRefs([]);setMoodLabel('');setAgeRange('');setCheerUp(null);setReasons({});
  };

  const applyResult=(result:StylistRecommendation)=>{
    setSummary(result.summary);setTags(result.tags);setOutfitRefs(result.products);setAccessoryRefs(result.accessories);
    setMoodLabel(result.moodLabel||'');setAgeRange(result.ageRange||'');setCheerUp(result.cheerUp);setReasons(result.reasons||{});
  };

  const analyze=async()=>{
    if(!photo){Alert.alert('Chưa có ảnh','Hãy chụp hoặc chọn ảnh trước.');return;}
    const run=++analysisRun.current;
    setLoading(true);setEnriching(false);setError('');
    try{
      const profile=await loadStyleProfile();
      // Lượt nhanh chỉ đọc màu bằng CPU và xếp hạng catalog, nên chữ/sản phẩm
      // xuất hiện sớm. Vision chân dung tiếp tục ở nền và nâng cấp cùng kết quả.
      const result=await recommendStyle({imageBase64:photo.base64,profile,quick:true});
      if(run!==analysisRun.current)return;
      applyResult(result);
      setLoading(false);
      setEnriching(Boolean(result.portraitPending));
      if(result.portraitPending){
        void recommendStyle({imageBase64:photo.base64,profile}).then(full=>{
          if(run===analysisRun.current)applyResult(full);
        }).catch(()=>undefined).finally(()=>{
          if(run===analysisRun.current)setEnriching(false);
        });
      }
    }catch(e:any){
      if(run!==analysisRun.current)return;
      setError(e?.message||'Không phân tích được ảnh.');
      setSummary('Không kết nối được trợ lý phối đồ; bạn vẫn có thể xem gợi ý mặc định bên dưới.');
      setMoodLabel('');setAgeRange('');setCheerUp(null);setReasons({});
    }finally{setLoading(false);}
  };

  const openTryOn=()=>{
    const p=outfits[0];
    router.push({pathname:'/tryon',params:p?{productId:p.slug}:undefined} as any);
  };

  return (
    <Screen>
      <Header title="Ống kính JAPANO" />
      <ScrollView contentContainerStyle={{ paddingHorizontal:18, paddingBottom:28 }}>
        <View style={st.frame}>
          <SmartImage source={photo?{uri:photo.uri}:products[0]?.images[0]} style={{ width:'100%', height:250, opacity:photo?1:.42 }} recyclingKey={photo?.uri||'camera-placeholder'} />
          <View style={st.frameBorder} pointerEvents="none" />
          <View style={st.lensMark} pointerEvents="none"><Text style={st.lensKanji}>観</Text><Text style={st.lensName}>JAPANO LENS</Text></View>
          <View style={st.detected}><Text style={st.detectedT}>{loading?'✦ ĐANG QUÉT BẢNG MÀU':enriching?'✦ ĐANG TINH CHỈNH':tags.length?'✦ ĐÃ NHẬN DIỆN':'✦ TƯ VẤN PHONG CÁCH'}</Text></View>
          {!photo&&<View style={st.empty}><Text style={st.emptyT}>Đặt toàn bộ trang phục trong khung để nhận gợi ý chính xác hơn.</Text></View>}
          {loading&&<View style={st.loading}>
            <Animated.View style={[st.scanLine,{transform:[{translateY:scan.interpolate({inputRange:[0,1],outputRange:[-92,92]})}]}]} />
            <View style={st.loadingCopy}><ActivityIndicator color="#fff" size="small" /><Text style={st.loadingTitle}>Đọc màu · chất liệu · phong cách</Text><Text style={st.loadingTime}>{elapsed}s · kết quả catalog sẽ hiện trước</Text></View>
          </View>}
        </View>
        <View style={st.lensModes}>
          {['BẢNG MÀU','DÁNG ĐỒ','NGỮ CẢNH'].map((label,index)=><View key={label} style={st.lensMode}><Text style={st.lensModeNo}>0{index+1}</Text><Text style={st.lensModeT}>{label}</Text></View>)}
        </View>
        <View style={st.pickRow}>
          <Pressable style={st.pick} onPress={()=>void choose(true)}><Text style={st.pickT}>📷 Chụp ảnh</Text></Pressable>
          <Pressable style={st.pick} onPress={()=>void choose(false)}><Text style={st.pickT}>▧ Thư viện</Text></Pressable>
        </View>
        <Btn label={loading?'Đang phân tích…':'Phân tích & gợi ý đồ'} onPress={()=>{if(!loading)void analyze();}} />
        {!!error&&<Text style={st.error}>{error}</Text>}
        {enriching&&<View style={st.enrich}><ActivityIndicator size="small" color={C.ai}/><Text style={st.enrichT}>Gợi ý đã dùng được · AI đang tinh chỉnh cảm xúc ở nền ({elapsed}s)</Text></View>}
        <Text style={st.summary}>{summary}</Text>
        {!!tags.length&&<View style={st.tags}>{tags.map(t=><TagK key={t} label={t} />)}</View>}

        {(!!moodLabel||!!ageRange)&&(
          <View style={st.moodCard}>
            <View style={st.moodHead}>
              <Ionicons name="sparkles" size={16} color={C.ai} />
              <Text style={st.moodHeadT}>AI đọc vị</Text>
            </View>
            {!!moodLabel&&<Text style={st.moodText}>{moodLabel}</Text>}
            {!!ageRange&&<Text style={st.moodSub}>Độ tuổi ước lượng: {ageRange}</Text>}
          </View>
        )}
        {!!cheerUp&&(
          <View style={st.cheerCard}>
            <Text style={st.cheerTitle}>🎏 {cheerUp.message}</Text>
            {!!cheerUp.joke&&<Text style={st.cheerJoke}>😄 {cheerUp.joke}</Text>}
            {!!cheerUp.destination&&<Text style={st.cheerDest}>📍 {cheerUp.destination}</Text>}
            <Text style={st.cheerHint}>Những món dưới đây được chọn để giúp bạn thấy vui hơn hôm nay:</Text>
          </View>
        )}

        <SectionHeader kanji="衣" label="Trang phục gợi ý" action="Tất cả" onAction={()=>router.push('/(tabs)/products')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:12 }}>
          {outfits.map(p=><ProductMini key={p.slug} p={p} reason={reasonFor(p)} />)}
        </ScrollView>

        <SectionHeader kanji="小" label="Phụ kiện đi kèm" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:12 }}>
          {accessories.map(a=>(
            <Pressable key={a.slug} style={{ width:136 }} onPress={()=>router.push(`/product/${a.slug}`)}>
              <SmartImage source={a.images[0]} style={{ width:'100%', height:136, borderRadius:12 }} recyclingKey={`${a.slug}-camera-accessory`} />
              <Text style={st.productName} numberOfLines={1}>{a.name}</Text><Price value={a.price} size={11.5} />
              <Text style={st.reason} numberOfLines={3}>{reasonFor(a,'Phụ kiện hợp tông với set gợi ý')}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Btn label="📷 Thử trang phục đầu tiên lên ảnh" style={{ marginTop:18 }} onPress={openTryOn} />
      </ScrollView>
    </Screen>
  );
}

const ProductMini=({p,reason}:{p:Product;reason:string})=>{
  const router=useRouter();
  return <Pressable style={{width:150}} onPress={()=>router.push(`/product/${p.slug}`)}>
    <SmartImage source={p.images[0]} style={{width:'100%',height:170,borderRadius:14}} recyclingKey={`${p.slug}-camera-result`} />
    <Text style={st.productTitle} numberOfLines={1}>{p.name}</Text><Price value={p.price} size={12} />
    <Text style={st.reason}>{reason}</Text>
  </Pressable>;
};

const st=StyleSheet.create({
  frame:{borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:C.line,position:'relative'},
  frameBorder:{position:'absolute',top:14,left:14,right:14,bottom:14,borderWidth:2,borderColor:'rgba(255,255,255,.65)',borderRadius:12},
  lensMark:{position:'absolute',right:22,top:20,alignItems:'flex-end'},
  lensKanji:{color:'rgba(255,255,255,.92)',fontFamily:F.display,fontSize:25,lineHeight:28},
  lensName:{color:'#fff',fontFamily:F.bodyX,fontSize:8,letterSpacing:1.6},
  detected:{position:'absolute',top:12,left:12,backgroundColor:C.ai,paddingVertical:4,paddingHorizontal:8,borderRadius:8},
  detectedT:{color:'#fff',fontFamily:F.bodyX,fontSize:10},
  empty:{position:'absolute',left:38,right:38,bottom:30,backgroundColor:'rgba(26,20,16,.72)',padding:10,borderRadius:10},
  emptyT:{color:'#fff',fontFamily:F.bodyM,fontSize:11.5,textAlign:'center'},
  loading:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(26,20,16,.48)',alignItems:'center',justifyContent:'center',overflow:'hidden'},
  scanLine:{position:'absolute',left:22,right:22,height:2,backgroundColor:'#fff',shadowColor:C.ai,shadowOpacity:1,shadowRadius:9,elevation:4},
  loadingCopy:{alignItems:'center',gap:7,backgroundColor:'rgba(26,20,16,.72)',paddingVertical:12,paddingHorizontal:18,borderRadius:14},
  loadingTitle:{color:'#fff',fontFamily:F.bodyB,fontSize:12},
  loadingTime:{color:'rgba(255,255,255,.78)',fontFamily:F.body,fontSize:10},
  lensModes:{flexDirection:'row',gap:8,marginTop:8},
  lensMode:{flex:1,flexDirection:'row',alignItems:'center',gap:5,borderWidth:1,borderColor:C.line,borderRadius:10,backgroundColor:C.card,paddingVertical:7,paddingHorizontal:8},
  lensModeNo:{fontFamily:F.displaySb,fontSize:10,color:C.shu},
  lensModeT:{fontFamily:F.bodyX,fontSize:8,color:C.ink},
  pickRow:{flexDirection:'row',gap:10,marginVertical:10},
  pick:{flex:1,backgroundColor:C.card,borderWidth:1,borderColor:C.line,borderRadius:12,paddingVertical:10,alignItems:'center'},
  pickT:{fontFamily:F.bodyB,fontSize:12,color:C.ink},
  error:{fontFamily:F.bodyM,fontSize:11.5,color:C.danger,marginTop:8},
  enrich:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:C.aiSoft,borderRadius:11,padding:10,marginTop:9},
  enrichT:{flex:1,fontFamily:F.bodyM,fontSize:10.5,color:C.ai},
  summary:{fontFamily:F.body,fontSize:12.5,lineHeight:20,color:C.ink,marginTop:10},
  tags:{flexDirection:'row',gap:8,flexWrap:'wrap',marginTop:8},
  moodCard:{backgroundColor:C.aiSoft,borderRadius:14,padding:12,marginTop:12},
  moodHead:{flexDirection:'row',alignItems:'center',gap:6},
  moodHeadT:{fontFamily:F.bodyX,fontSize:11,color:C.ai,letterSpacing:.5},
  moodText:{fontFamily:F.bodyM,fontSize:12.5,color:C.ink,marginTop:6},
  moodSub:{fontFamily:F.body,fontSize:11,color:C.muted,marginTop:3},
  cheerCard:{backgroundColor:C.warningSoft,borderWidth:1,borderColor:C.line,borderRadius:14,padding:13,marginTop:10},
  cheerTitle:{fontFamily:F.bodyB,fontSize:12.5,lineHeight:19,color:C.warning},
  cheerJoke:{fontFamily:F.body,fontSize:12,lineHeight:18,color:C.ink,marginTop:7},
  cheerDest:{fontFamily:F.body,fontSize:12,lineHeight:18,color:C.ink,marginTop:7},
  cheerHint:{fontFamily:F.bodyM,fontSize:11,color:C.warning,marginTop:9},
  productName:{fontFamily:F.bodyB,fontSize:11.5,color:C.ink,marginTop:6},
  productTitle:{fontFamily:F.bodyB,fontSize:12.5,color:C.ink,marginTop:7},
  reason:{fontFamily:F.bodyM,fontSize:10,lineHeight:14,color:C.kin,marginTop:3},
});
