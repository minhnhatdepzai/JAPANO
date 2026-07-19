import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Screen, Header, Btn } from '../components/ui';
import { useCatalog } from '../lib/data';
import { generateTryOn, getSizeAdvice, SizeFit } from '../lib/api';
import { DEFAULT_STYLE_PROFILE, loadStyleProfile, SavedStyleProfile, saveStyleProfile } from '../lib/profile';
import { useStore } from '../lib/store';
import { C, F } from '../theme/tokens';
import { SmartImage } from '../components/SmartImage';

type PickedImage={uri:string;base64:string};
const one=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const dataUri=(asset:ImagePicker.ImagePickerAsset)=>`data:${asset.mimeType||'image/jpeg'};base64,${asset.base64||''}`;
const localSize=(height:string,weight:string)=>{
  const h=Number(height),w=Number(weight);
  if((h&&h<158)||(w&&w<50))return'S';
  if(w>125)return'5XL';
  if(w>112)return'4XL';
  if(w>100)return'XXXL';
  if(w>88)return'XXL';
  if((h&&h>177)||(w&&w>76))return'XL';
  if((h&&h>168)||(w&&w>63))return'L';
  return'M';
};

export default function TryOn() {
  const params=useLocalSearchParams<{productId?:string;slug?:string;color?:string;size?:string}>();
  const router=useRouter();
  const {products}=useCatalog();
  const {addToCart,showToast}=useStore();
  const productId=one(params.productId)||one(params.slug)||'haori-dang-dai';
  const product=products.find(p=>p.slug===productId||p.id===productId)||products[0];
  const tryonSizes=product.sizes?.length?product.sizes:['S','M','L','XL','XXL','XXXL','4XL','5XL'];
  const accessories=useMemo(()=>products.filter(p=>p.cat==='phu-kien'),[products]);
  const [photo,setPhoto]=useState<PickedImage|null>(null);
  const [profile,setProfile]=useState<SavedStyleProfile>(DEFAULT_STYLE_PROFILE);
  const [size,setSize]=useState(one(params.size)||'M');
  const [color,setColor]=useState(one(params.color)||'Mực');
  const [selectedAccessories,setSelectedAccessories]=useState<string[]>([]);
  const [showAccessories,setShowAccessories]=useState(false);
  const [result,setResult]=useState('');
  const [resultEngine,setResultEngine]=useState('');
  const [sizeFit,setSizeFit]=useState<SizeFit|null>(null);
  const [message,setMessage]=useState('Chọn ảnh rõ và đủ sáng để hệ thống ghép trang phục tự nhiên hơn.');
  const [error,setError]=useState('');
  const [warning,setWarning]=useState('');
  const [loading,setLoading]=useState(false);
  const [sizeLoading,setSizeLoading]=useState(false);

  useEffect(()=>{void loadStyleProfile().then(setProfile);},[]);

  const choose=async(camera:boolean)=>{
    setError('');setWarning('');
    if(camera){const permission=await ImagePicker.requestCameraPermissionsAsync();if(!permission.granted){Alert.alert('Cần quyền camera','Hãy cấp quyền camera để chụp ảnh thử đồ.');return;}}
    const pick=camera
      ? await ImagePicker.launchCameraAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,quality:.82,base64:true})
      : await ImagePicker.launchImageLibraryAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,quality:.82,base64:true});
    const asset=pick.canceled?null:pick.assets?.[0];
    if(!asset)return;
    if(!asset.base64){setError('Không đọc được dữ liệu ảnh. Vui lòng chọn lại.');return;}
    setPhoto({uri:asset.uri,base64:dataUri(asset)});setResult('');setResultEngine('');setSizeFit(null);setWarning('');
  };

  const updateProfile=(key:keyof SavedStyleProfile,value:string)=>{
    setProfile(old=>({...old,[key]:value}));
  };

  const adviseSize=async()=>{
    setSizeLoading(true);setError('');
    const fallback=localSize(String(profile.height||''),String(profile.weight||''));
    try{
      const saved=await saveStyleProfile(profile);
      const advice=await getSizeAdvice({productId:product.slug,profile:saved,selectedSize:size});
      const next=advice.size||fallback;setSize(next);setMessage(advice.advice||`Theo số đo đã nhập, kích cỡ ${next} là lựa chọn gần nhất.`);
    }catch(e:any){setSize(fallback);setMessage(`Tạm tính theo chiều cao và cân nặng: kích cỡ ${fallback}. ${e?.message||''}`.trim());}
    finally{setSizeLoading(false);}
  };

  const toggleAccessory=(slug:string)=>setSelectedAccessories(old=>old.includes(slug)?old.filter(x=>x!==slug):[...old,slug].slice(0,4));

  const run=async()=>{
    if(!photo){Alert.alert('Thiếu ảnh người','Hãy chụp hoặc chọn ảnh của bạn trước.');return;}
    const pickedNames=accessories.filter(item=>selectedAccessories.includes(item.slug)).map(item=>item.name);
    setLoading(true);setError('');setWarning('');setMessage(`Hệ thống đang nhận diện nhân vật chính và ghép trang phục${pickedNames.length?`, sau đó hòa ${pickedNames.join(', ')} vào tóc, tay, ánh sáng và dáng người`:''}. Tư thế chỉ được chỉnh khi thật sự cần; hệ thống sẽ tự kiểm tra chất lượng và thử lại…`);
    try{
      const saved=await saveStyleProfile(profile);
      const output=await generateTryOn({
        personImageBase64:photo.base64,
        productId:product.slug,
        productImageKey:product.imageKeys?.[0]||'',
        color,size,accessoryIds:selectedAccessories,profile:saved,
      });
      if(!output.imageUrl)throw new Error(output.message||'Backend chưa trả ảnh kết quả.');
      setResult(output.imageUrl);setResultEngine(output.engine||'ai-gateway');setMessage(output.message);
      setWarning(output.warning||'');
      setSizeFit(output.sizeFit&&output.sizeFit.verdict!=='unknown'?output.sizeFit:null);
    }catch(e:any){setResult('');setResultEngine('');setSizeFit(null);setError(e?.message||'Không tạo được ảnh thử đồ.');setMessage('');}
    finally{setLoading(false);}
  };

  const display=result?{uri:result}:photo?{uri:photo.uri}:product.images[0];
  return (
    <Screen>
      <Header title="Thử đồ thông minh" />
      <ScrollView contentContainerStyle={{paddingHorizontal:18,paddingBottom:28}} keyboardShouldPersistTaps="handled">
        <View style={st.chip}>
          <SmartImage source={product.images[0]} style={st.productThumb} recyclingKey={`${product.slug}-tryon-thumb`} />
          <View style={{flex:1,marginLeft:9}}><Text style={st.productName}>{product.name}</Text><Text style={st.productMeta}>{product.price.toLocaleString('vi-VN')}₫ · {color} · {size}</Text></View>
          <Pressable onPress={()=>router.push(`/product/${product.slug}`)}><Text style={st.change}>Đổi</Text></Pressable>
        </View>

        <View style={st.result}>
          <SmartImage
            source={display}
            style={{width:'100%',height:480,opacity:!photo&&!result?.65:1}}
            contentFit={photo||result?'contain':'cover'}
            recyclingKey={result?'tryon-result':photo?.uri||`${product.slug}-tryon`}
          />
          <View style={st.tag}><Text style={st.tagT}>{result?'✦ ẢNH THỬ ĐỒ ĐÃ HOÀN TẤT':'✦ ẢNH CỦA BẠN'}</Text></View>
          {loading&&<View style={st.loading}><ActivityIndicator color="#fff" size="large" /><Text style={st.loadingT}>Đang tạo ảnh…</Text></View>}
        </View>
        {!!error&&(
          <View style={st.errBanner}>
            <Text style={st.errTitle}>Chưa tạo được ảnh thử đồ thật</Text>
            <Text style={st.errMsg}>{error}</Text>
            <Text style={st.errTips}>Chấp nhận ảnh đứng, ngồi, nghiêng hoặc giơ tay; ảnh vẫn cần nhìn thấy ít nhất một người thật đủ rõ để nhận diện đúng nhân vật chính.</Text>
          </View>
        )}
        {!!warning&&!!result&&(
          <View style={st.warnBanner}><Text style={st.warnTitle}>Ảnh đã được tạo</Text><Text style={st.warnMsg}>{warning}</Text></View>
        )}
        {!!sizeFit&&sizeFit.verdict!=='good'&&(
          <View style={[st.fitBanner,sizeFit.verdict==='tight'?st.fitTight:st.fitLoose]}>
            <Text style={st.fitTitle}>{sizeFit.verdict==='tight'?'⚠️ Có thể hơi chật':'⚠️ Có thể hơi rộng'}</Text>
            <Text style={st.fitMsg}>{sizeFit.message}</Text>
            {!!sizeFit.recommended&&(
              <Pressable style={st.fitBtn} onPress={()=>setSize(sizeFit.recommended!)}>
                <Text style={st.fitBtnT}>Dùng cỡ {sizeFit.recommended}</Text>
              </Pressable>
            )}
          </View>
        )}
        {!!sizeFit&&sizeFit.verdict==='good'&&(
          <View style={[st.fitBanner,st.fitGood]}><Text style={st.fitTitle}>✓ Vừa vặn</Text><Text style={st.fitMsg}>{sizeFit.message}</Text></View>
        )}
        <View style={st.pickRow}>
          <Pressable style={st.pick} onPress={()=>void choose(true)}><Text style={st.pickT}>📷 Chụp ảnh</Text></Pressable>
          <Pressable style={st.pick} onPress={()=>void choose(false)}><Text style={st.pickT}>▧ Chọn ảnh</Text></Pressable>
        </View>
        <Text style={st.tip}>Ảnh có dáng phù hợp sẽ được ghép trang phục ngay để nhanh và nhẹ hơn. Hệ thống chỉ chỉnh tư thế khi tay, đồ vật hoặc góc chụp che vùng cần mặc; người khác trong ảnh được giữ nguyên.</Text>

        <Text style={st.section}>Số đo và gợi ý kích cỡ</Text>
        <View style={st.measureRow}>
          <Measure label="Chiều cao" value={String(profile.height||'')} onChange={v=>updateProfile('height',v)} unit="cm" />
          <Measure label="Cân nặng" value={String(profile.weight||'')} onChange={v=>updateProfile('weight',v)} unit="kg" />
        </View>
        <View style={st.sizeRow}>{tryonSizes.map(v=><Pressable key={v} style={[st.size,size===v&&st.sizeOn]} onPress={()=>setSize(v)}><Text style={[st.sizeT,size===v&&{color:'#fff'}]}>{v}</Text></Pressable>)}</View>
        <Btn label={sizeLoading?'Đang tính kích cỡ…':'Gợi ý kích cỡ cho tôi'} variant="ghost" onPress={()=>{if(!sizeLoading)void adviseSize();}} />

        <Text style={st.section}>Màu trang phục</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{['Mực','Đỏ son','Chàm','Xanh trà','Vàng kim'].map(v=><Pressable key={v} style={[st.pill,color===v&&st.pillOn]} onPress={()=>setColor(v)}><Text style={[st.pillT,color===v&&{color:'#fff'}]}>{v}</Text></Pressable>)}</ScrollView>

        <Pressable style={st.accHeader} onPress={()=>setShowAccessories(v=>!v)}>
          <View style={{flex:1}}>
            <Text style={st.section}>Phụ kiện đi kèm <Text style={st.expBadge}>NÂNG CAO</Text></Text>
            {!showAccessories&&<Text style={st.accHint}>Chạm để chọn tối đa 4 món — hệ thống tự chỉnh tay cầm, tóc, bóng và góc phụ kiện</Text>}
          </View>
          <Text style={{fontFamily:F.bodyB,fontSize:16,color:C.muted}}>{showAccessories?'▾':'▸'}</Text>
        </Pressable>
        {showAccessories&&(
          <>
            <Text style={st.accWarn}>Ảnh được nhận diện tư thế, ghép đúng vị trí rồi kiểm tra khuôn mặt, trang phục và tư thế tay. Quá trình này có thể lâu hơn khi chỉ thử riêng quần áo.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10}}>{accessories.map(a=>{const selected=selectedAccessories.includes(a.slug);return <Pressable key={a.slug} accessibilityLabel={`${selected?'Bỏ chọn':'Chọn'} ${a.name}`} style={st.acc} onPress={()=>toggleAccessory(a.slug)}><View><SmartImage source={a.images[0]} style={[st.accImg,selected&&st.accOn]} recyclingKey={`${a.slug}-tryon-accessory`} />{selected&&<View style={st.accCheck}><Text style={st.accCheckT}>✓</Text></View>}</View><Text style={st.accT} numberOfLines={1}>{a.name}</Text></Pressable>;})}</ScrollView>
            <Text style={st.selectedAcc}>{selectedAccessories.length?`Đã chọn: ${accessories.filter(item=>selectedAccessories.includes(item.slug)).map(item=>item.name).join(' · ')}`:'Chưa chọn phụ kiện'}</Text>
          </>
        )}

        {!!message&&<Text style={st.message}>{message}</Text>}
        <Btn label={loading?'Đang tạo ảnh…':result?'Tạo lại ảnh thử đồ':'Tạo ảnh thử đồ'} style={{marginTop:12}} onPress={()=>{if(!loading)void run();}} />
        {result&&<View style={st.resultActions}><Pressable style={st.action} onPress={()=>showToast('Ảnh kết quả đã sẵn sàng ✓')}><Text style={st.actionT}>Giữ ảnh</Text></Pressable><Pressable style={[st.action,{backgroundColor:C.shu}]} onPress={()=>addToCart(product.slug,color,size)}><Text style={[st.actionT,{color:'#fff'}]}>Thêm giỏ</Text></Pressable></View>}
      </ScrollView>
    </Screen>
  );
}

const Measure=({label,value,onChange,unit}:{label:string;value:string;onChange:(v:string)=>void;unit:string})=><View style={{flex:1}}><Text style={st.measureLabel}>{label}</Text><View style={st.measure}><TextInput value={value} onChangeText={onChange} keyboardType="numeric" style={st.measureInput} placeholder="—" placeholderTextColor={C.muted}/><Text style={st.unit}>{unit}</Text></View></View>;
const st=StyleSheet.create({
  chip:{flexDirection:'row',alignItems:'center',padding:10,borderWidth:1,borderColor:C.line,borderRadius:14,backgroundColor:'#fff',marginBottom:14},
  productThumb:{width:46,height:56,borderRadius:9},productName:{fontFamily:F.bodyB,fontSize:13,color:C.ink},productMeta:{fontFamily:F.body,fontSize:11.5,color:C.muted,marginTop:2},change:{fontFamily:F.bodyB,fontSize:11,color:C.shu},
  result:{borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:C.line,position:'relative'},tag:{position:'absolute',top:10,left:10,zIndex:5,elevation:5,backgroundColor:C.shu,paddingVertical:4,paddingHorizontal:8,borderRadius:8},tagT:{color:'#fff',fontFamily:F.bodyX,fontSize:10},
  loading:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(26,20,16,.55)',alignItems:'center',justifyContent:'center',gap:8},loadingT:{color:'#fff',fontFamily:F.bodyB,fontSize:12},
  pickRow:{flexDirection:'row',gap:10,marginVertical:10},pick:{flex:1,borderWidth:1,borderColor:C.line,borderRadius:11,paddingVertical:10,alignItems:'center',backgroundColor:'#fff'},pickT:{fontFamily:F.bodyB,fontSize:12,color:C.ink},
  fitBanner:{borderRadius:13,borderWidth:1,padding:12,marginTop:10},
  fitTight:{backgroundColor:'#FCE8E8',borderColor:'#EBC4C4'},fitLoose:{backgroundColor:'#FCF1DD',borderColor:'#F1D9A8'},fitGood:{backgroundColor:'#E4F5E9',borderColor:'#BEE3CB'},
  fitTitle:{fontFamily:F.bodyX,fontSize:12.5,color:C.ink},fitMsg:{fontFamily:F.body,fontSize:11.5,lineHeight:17,color:C.ink,marginTop:4},
  fitBtn:{alignSelf:'flex-start',backgroundColor:C.sumi,borderRadius:9,paddingVertical:7,paddingHorizontal:12,marginTop:8},fitBtnT:{color:'#fff',fontFamily:F.bodyB,fontSize:11.5},
  section:{fontFamily:F.bodyB,fontSize:13,color:C.ink,marginTop:15,marginBottom:8},measureRow:{flexDirection:'row',gap:10},measureLabel:{fontFamily:F.bodyM,fontSize:10.5,color:C.muted,marginBottom:4},measure:{height:44,flexDirection:'row',alignItems:'center',backgroundColor:'#fff',borderWidth:1,borderColor:C.line,borderRadius:11,paddingHorizontal:10},measureInput:{flex:1,fontFamily:F.bodyB,fontSize:13,color:C.ink},unit:{fontFamily:F.body,fontSize:11,color:C.muted},
  sizeRow:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:10},size:{width:'22%',minWidth:62,height:38,borderRadius:9,borderWidth:1,borderColor:C.line,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},sizeOn:{backgroundColor:C.sumi,borderColor:C.sumi},sizeT:{fontFamily:F.bodyB,fontSize:12,color:C.ink},
  pill:{borderWidth:1,borderColor:C.line,borderRadius:999,paddingVertical:8,paddingHorizontal:13,backgroundColor:'#fff'},pillOn:{backgroundColor:C.shu,borderColor:C.shu},pillT:{fontFamily:F.bodyM,fontSize:11.5,color:C.ink},
  acc:{width:88},accImg:{width:88,height:88,borderRadius:12,borderWidth:2,borderColor:'transparent'},accOn:{borderColor:C.shu},accCheck:{position:'absolute',right:5,top:5,width:22,height:22,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:C.shu,borderWidth:2,borderColor:'#fff'},accCheckT:{color:'#fff',fontFamily:F.bodyB,fontSize:11},accT:{fontFamily:F.bodyM,fontSize:10.5,color:C.ink,marginTop:4},selectedAcc:{fontFamily:F.bodyB,fontSize:11,color:C.shu,marginTop:9},
  tip:{fontFamily:F.body,fontSize:11,lineHeight:16,color:C.muted,marginTop:2,backgroundColor:'#FBF3E4',borderRadius:9,padding:9},
  accHeader:{flexDirection:'row',alignItems:'center',marginTop:15},
  expBadge:{fontFamily:F.bodyX,fontSize:9,color:C.muted},
  accHint:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:C.muted,marginTop:2},
  accWarn:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:C.shuDeep,backgroundColor:C.shuSoft,borderRadius:9,padding:9,marginTop:8,marginBottom:8},
  message:{fontFamily:F.body,fontSize:11.5,lineHeight:18,color:C.muted,marginTop:8,textAlign:'center'},
  errBanner:{backgroundColor:'#FCE8E8',borderWidth:1,borderColor:'#EBC4C4',borderRadius:13,padding:13,marginTop:10},
  errTitle:{fontFamily:F.bodyX,fontSize:13,color:C.shuDeep},errMsg:{fontFamily:F.body,fontSize:12,lineHeight:18,color:C.ink,marginTop:5},errTips:{fontFamily:F.body,fontSize:11,lineHeight:16,color:C.muted,marginTop:8},
  warnBanner:{backgroundColor:'#FFF4D8',borderWidth:1,borderColor:'#E8CD8B',borderRadius:13,padding:13,marginTop:10},warnTitle:{fontFamily:F.bodyX,fontSize:13,color:'#8A5B00'},warnMsg:{fontFamily:F.body,fontSize:11.5,lineHeight:17,color:C.ink,marginTop:4},
  resultActions:{flexDirection:'row',gap:10,marginTop:10},action:{flex:1,alignItems:'center',paddingVertical:10,borderRadius:11,borderWidth:1,borderColor:C.line,backgroundColor:'#fff'},actionT:{fontFamily:F.bodyB,fontSize:12,color:C.ink},
});
