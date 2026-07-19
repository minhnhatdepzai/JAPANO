import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Screen, Header, SectionHeader, TagK, Btn, Price } from '../components/ui';
import { Product } from '../lib/catalog';
import { useCatalog } from '../lib/data';
import { ApiProductRef, recommendStyle } from '../lib/api';
import { loadStyleProfile } from '../lib/profile';
import { C, F } from '../theme/tokens';
import { SmartImage } from '../components/SmartImage';

type PickedImage={uri:string;base64:string};
const refKey=(ref:ApiProductRef)=>typeof ref==='string'?ref:String(ref.slug||ref.productId||ref.id||ref._id||'');
const dataUri=(asset:ImagePicker.ImagePickerAsset)=>`data:${asset.mimeType||'image/jpeg'};base64,${asset.base64||''}`;

export default function Camera() {
  const router = useRouter();
  const {products}=useCatalog();
  const [photo,setPhoto]=useState<PickedImage|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [summary,setSummary]=useState('Chụp hoặc chọn một ảnh để Ori phân tích phong cách.');
  const [tags,setTags]=useState<string[]>([]);
  const [outfitRefs,setOutfitRefs]=useState<ApiProductRef[]>([]);
  const [accessoryRefs,setAccessoryRefs]=useState<ApiProductRef[]>([]);

  const fallbackOutfits=useMemo(()=>['haori-dang-dai','cardigan-dai','so-mi-trang'].map(s=>products.find(p=>p.slug===s)).filter(Boolean) as Product[],[products]);
  const fallbackAccessories=useMemo(()=>products.filter(p=>p.cat==='phu-kien').slice(0,4),[products]);
  const resolve=(refs:ApiProductRef[],fallback:Product[])=>{
    const found=refs.map(ref=>{const key=refKey(ref);return products.find(p=>p.slug===key||p.id===key);}).filter(Boolean) as Product[];
    return (found.length?found:fallback).slice(0,4);
  };
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
    setPhoto({uri:asset.uri,base64:dataUri(asset)});
    setTags([]);setOutfitRefs([]);setAccessoryRefs([]);
  };

  const analyze=async()=>{
    if(!photo){Alert.alert('Chưa có ảnh','Hãy chụp hoặc chọn ảnh trước.');return;}
    setLoading(true);setError('');
    try{
      const profile=await loadStyleProfile();
      const result=await recommendStyle({imageBase64:photo.base64,profile});
      setSummary(result.summary);setTags(result.tags);setOutfitRefs(result.products);setAccessoryRefs(result.accessories);
    }catch(e:any){
      setError(e?.message||'Không phân tích được ảnh.');
      setSummary('Không kết nối được trợ lý phối đồ; bạn vẫn có thể xem gợi ý mặc định bên dưới.');
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
          <View style={st.detected}><Text style={st.detectedT}>{loading?'✦ ĐANG PHÂN TÍCH':tags.length?'✦ ĐÃ NHẬN DIỆN':'✦ TƯ VẤN PHONG CÁCH'}</Text></View>
          {!photo&&<View style={st.empty}><Text style={st.emptyT}>Đặt toàn bộ trang phục trong khung để nhận gợi ý chính xác hơn.</Text></View>}
          {loading&&<View style={st.loading}><ActivityIndicator color="#fff" size="large" /></View>}
        </View>
        <View style={st.pickRow}>
          <Pressable style={st.pick} onPress={()=>void choose(true)}><Text style={st.pickT}>📷 Chụp ảnh</Text></Pressable>
          <Pressable style={st.pick} onPress={()=>void choose(false)}><Text style={st.pickT}>▧ Thư viện</Text></Pressable>
        </View>
        <Btn label={loading?'Đang phân tích…':'Phân tích & gợi ý đồ'} onPress={()=>{if(!loading)void analyze();}} />
        {!!error&&<Text style={st.error}>{error}</Text>}
        <Text style={st.summary}>{summary}</Text>
        {!!tags.length&&<View style={st.tags}>{tags.map(t=><TagK key={t} label={t} />)}</View>}

        <SectionHeader kanji="衣" label="Trang phục gợi ý" action="Tất cả" onAction={()=>router.push('/(tabs)/products')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:12 }}>
          {outfits.map((p,i)=><ProductMini key={p.slug} p={p} reason={(outfitRefs[i] as any)?.reason||'hợp phong cách của bạn'} />)}
        </ScrollView>

        <SectionHeader kanji="小" label="Phụ kiện đi kèm" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:12 }}>
          {accessories.map(a=>(
            <Pressable key={a.slug} style={{ width:118 }} onPress={()=>router.push(`/product/${a.slug}`)}>
              <SmartImage source={a.images[0]} style={{ width:'100%', height:118, borderRadius:12 }} recyclingKey={`${a.slug}-camera-accessory`} />
              <Text style={st.productName} numberOfLines={1}>{a.name}</Text><Price value={a.price} size={11.5} />
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
  detected:{position:'absolute',top:12,left:12,backgroundColor:C.ai,paddingVertical:4,paddingHorizontal:8,borderRadius:8},
  detectedT:{color:'#fff',fontFamily:F.bodyX,fontSize:10},
  empty:{position:'absolute',left:38,right:38,bottom:30,backgroundColor:'rgba(26,20,16,.72)',padding:10,borderRadius:10},
  emptyT:{color:'#fff',fontFamily:F.bodyM,fontSize:11.5,textAlign:'center'},
  loading:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(26,20,16,.42)',alignItems:'center',justifyContent:'center'},
  pickRow:{flexDirection:'row',gap:10,marginVertical:10},
  pick:{flex:1,backgroundColor:'#fff',borderWidth:1,borderColor:C.line,borderRadius:12,paddingVertical:10,alignItems:'center'},
  pickT:{fontFamily:F.bodyB,fontSize:12,color:C.ink},
  error:{fontFamily:F.bodyM,fontSize:11.5,color:C.shu,marginTop:8},
  summary:{fontFamily:F.body,fontSize:12.5,lineHeight:20,color:C.ink,marginTop:10},
  tags:{flexDirection:'row',gap:8,flexWrap:'wrap',marginTop:8},
  productName:{fontFamily:F.bodyB,fontSize:11.5,color:C.ink,marginTop:6},
  productTitle:{fontFamily:F.bodyB,fontSize:12.5,color:C.ink,marginTop:7},
  reason:{fontFamily:F.bodyB,fontSize:10,color:C.kin,marginTop:2},
});
