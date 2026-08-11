import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ResizeMode, Video } from 'expo-av';
import { Screen, Header, Btn } from '../components/ui';
import { useCatalog } from '../lib/data';
import { generateTryOn, generateTryOnMotion, getSizeAdvice, getTryOnMotionPresets, MotionPreset, reportGpuFocus, SizeFit } from '../lib/api';
import { DEFAULT_STYLE_PROFILE, loadStyleProfile, SavedStyleProfile, saveStyleProfile } from '../lib/profile';
import { saveMediaToLibrary, shareMedia } from '../lib/media';
import { useStore } from '../lib/store';
import { C, F } from '../theme/tokens';
import { SmartImage } from '../components/SmartImage';
import { beginGpuJob, endGpuJob, useGpuFocus } from '../lib/useGpuFocus';

type PickedImage={uri:string;base64:string};
const DEFAULT_MOTIONS:MotionPreset[]=[
  {id:'pose_sway',label:'Tạo dáng tự nhiên',icon:'✦'},
];
const MOTION_ICONS:Record<string, keyof typeof Ionicons.glyphMap>={
  runway_walk:'walk-outline',
  spin:'sync-outline',
  jump:'arrow-up-circle-outline',
  pose_sway:'body-outline',
  sit_stand:'accessibility-outline',
};
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
  // Chỉ giữ GPU cho đúng lúc chạy try-on/motion. Khi chỉ xem ảnh kết quả,
  // trả GPU về browse để mô tả ảnh và semantic product suggestions dùng tiếp.
  // Ref ngăn request hoàn tất muộn giành focus sau khi người dùng đã thoát.
  const gpuScreenActive=useGpuFocus('browse','home');
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
  const [motionPresets,setMotionPresets]=useState<MotionPreset[]>(DEFAULT_MOTIONS);
  const [motionReady,setMotionReady]=useState(false);
  const [motionPanel,setMotionPanel]=useState(false);
  const [selectedMotion,setSelectedMotion]=useState('spin');
  const [motionLoading,setMotionLoading]=useState(false);
  const [motionVideo,setMotionVideo]=useState('');
  const [motionError,setMotionError]=useState('');
  const [savingPhoto,setSavingPhoto]=useState(false);
  const [sharingPhoto,setSharingPhoto]=useState(false);
  const [savingVideo,setSavingVideo]=useState(false);
  const [sharingVideo,setSharingVideo]=useState(false);

  useEffect(()=>{void loadStyleProfile().then(setProfile);},[]);
  useEffect(()=>{
    let active=true;
    const syncMotion=()=>void getTryOnMotionPresets()
      .then(data=>{if(active){setMotionReady(data.ready);if(data.presets.length)setMotionPresets(data.presets);}})
      .catch(()=>{if(active)setMotionReady(false);});
    syncMotion();
    const timer=setInterval(syncMotion,10_000);
    return()=>{active=false;clearInterval(timer);};
  },[]);

  const choose=async(camera:boolean)=>{
    setError('');setWarning('');
    if(camera){const permission=await ImagePicker.requestCameraPermissionsAsync();if(!permission.granted){Alert.alert('Cần quyền camera','Hãy cấp quyền camera để chụp ảnh thử đồ.');return;}}
    const pick=camera
      ? await ImagePicker.launchCameraAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,quality:.82,base64:true})
      : await ImagePicker.launchImageLibraryAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,quality:.82,base64:true});
    const asset=pick.canceled?null:pick.assets?.[0];
    if(!asset)return;
    if(!asset.base64){setError('Không đọc được dữ liệu ảnh. Vui lòng chọn lại.');return;}
    setPhoto({uri:asset.uri,base64:dataUri(asset)});setResult('');setResultEngine('');setSizeFit(null);setWarning('');setMotionVideo('');setMotionPanel(false);setMotionError('');
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
    await reportGpuFocus('tryon');
    // Đánh dấu "đang chạy" để tín hiệu focus nền không huỷ mất tác vụ này khi
    // màn hình tự tắt hoặc người dùng kéo thanh thông báo (xem lib/useGpuFocus).
    beginGpuJob();
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
      setMotionVideo('');setMotionError('');
      Alert.alert(
        '✦ Làm ảnh thử đồ sống động?',
        'Bạn có muốn dùng AI local để nhân vật đi, xoay, nhảy hoặc khoe dáng với bộ đồ vừa thử không?',
        [{text:'Để sau',style:'cancel'},{text:'Chọn chuyển động',onPress:()=>setMotionPanel(true)}],
      );
    }catch(e:any){setResult('');setResultEngine('');setSizeFit(null);setError(e?.message||'Không tạo được ảnh thử đồ.');setMessage('');}
    finally{
      endGpuJob();
      setLoading(false);
      if(gpuScreenActive.current)void reportGpuFocus('browse');
    }
  };

  const runMotion=async()=>{
    if(!result||motionLoading||!motionReady)return;
    setMotionLoading(true);setMotionError('');setMotionVideo('');
    await reportGpuFocus('motion');
    beginGpuJob();
    try{
      const output=await generateTryOnMotion(result,selectedMotion);
      if(!output.videoUrl)throw new Error('Backend chưa trả video chuyển động.');
      setMotionVideo(output.videoUrl);
    }catch(e:any){setMotionError(e?.message||'Không tạo được video chuyển động AI.');}
    finally{
      endGpuJob();
      setMotionLoading(false);
      if(gpuScreenActive.current)void reportGpuFocus('browse');
    }
  };

  const savePhoto=async()=>{
    if(!result||savingPhoto)return;
    setSavingPhoto(true);
    try{await saveMediaToLibrary(result,'photo');showToast('Đã lưu ảnh vào thư viện ✓','success');}
    catch(e:any){Alert.alert('Không lưu được ảnh',e?.message||'Vui lòng thử lại.');}
    finally{setSavingPhoto(false);}
  };
  const sharePhoto=async()=>{
    if(!result||sharingPhoto)return;
    setSharingPhoto(true);
    try{await shareMedia(result,'photo');}
    catch(e:any){Alert.alert('Không chia sẻ được ảnh',e?.message||'Vui lòng thử lại.');}
    finally{setSharingPhoto(false);}
  };
  const saveVideo=async()=>{
    if(!motionVideo||savingVideo)return;
    setSavingVideo(true);
    try{await saveMediaToLibrary(motionVideo,'video');showToast('Đã lưu video vào thư viện ✓','success');}
    catch(e:any){Alert.alert('Không lưu được video',e?.message||'Vui lòng thử lại.');}
    finally{setSavingVideo(false);}
  };
  const shareVideo=async()=>{
    if(!motionVideo||sharingVideo)return;
    setSharingVideo(true);
    try{await shareMedia(motionVideo,'video');}
    catch(e:any){Alert.alert('Không chia sẻ được video',e?.message||'Vui lòng thử lại.');}
    finally{setSharingVideo(false);}
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
          <View style={st.tag}><Text style={st.tagT}>{result?'✦ ẢNH THỬ ĐỒ ĐÃ HOÀN TẤT':photo?'✦ ẢNH CỦA BẠN':'✦ ẢNH MẪU SẢN PHẨM'}</Text></View>
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
        {result&&(
          <View style={st.resultActions}>
            <Pressable style={st.action} disabled={savingPhoto} onPress={()=>void savePhoto()}>
              {savingPhoto?<ActivityIndicator size="small" color={C.ink}/>:<><Ionicons name="download-outline" size={15} color={C.ink}/><Text style={st.actionT}>Lưu ảnh</Text></>}
            </Pressable>
            <Pressable style={st.action} disabled={sharingPhoto} onPress={()=>void sharePhoto()}>
              {sharingPhoto?<ActivityIndicator size="small" color={C.ink}/>:<><Ionicons name="share-social-outline" size={15} color={C.ink}/><Text style={st.actionT}>Chia sẻ</Text></>}
            </Pressable>
            <Pressable style={[st.action,{backgroundColor:C.shu}]} onPress={()=>addToCart(product.slug,color,size)}><Text style={[st.actionT,{color:'#fff'}]}>Thêm giỏ</Text></Pressable>
          </View>
        )}
        {result&&(
          <View style={st.motionCard}>
            <View style={st.motionHead}>
              <View style={st.motionMark}><Text style={st.motionMarkT}>動</Text></View>
              <View style={{flex:1}}>
                <Text style={st.motionTitle}>Ảnh sống · đặc trưng JAPANO</Text>
                <Text style={st.motionSub}>One‑to‑All Animation 1.3B‑v2 điều khiển dáng bằng chuỗi pose local và chỉ chạy sau khi bạn chọn action.</Text>
              </View>
              <Pressable onPress={()=>setMotionPanel(value=>!value)} style={st.motionToggle}><Text style={st.motionToggleT}>{motionPanel?'Thu gọn':'Thử ngay'}</Text></Pressable>
            </View>
            {motionPanel&&(
              <View style={{marginTop:12}}>
                <Text style={st.motionPrompt}>Bạn muốn nhân vật chuyển động thế nào?</Text>
                <View style={st.motionGrid}>{motionPresets.map(preset=><Pressable key={preset.id} onPress={()=>setSelectedMotion(preset.id)} style={[st.motionChoice,selectedMotion===preset.id&&st.motionChoiceOn]}><Ionicons name={MOTION_ICONS[preset.id]||'sparkles-outline'} size={18} color="#fff"/><Text style={[st.motionChoiceT,selectedMotion===preset.id&&{color:'#fff'}]}>{preset.label}</Text></Pressable>)}</View>
                {!motionReady&&<Text style={st.motionOffline}>Engine One‑to‑All CUDA chưa sẵn sàng. Tạm khóa tạo video để không chạy bằng CPU hoặc trả clip chưa đạt chất lượng.</Text>}
                <Pressable disabled={motionLoading||!motionReady} onPress={()=>void runMotion()} style={[st.motionGenerate,(motionLoading||!motionReady)&&{opacity:.45}]}> 
                  {motionLoading?<ActivityIndicator color="#fff"/>:<Text style={st.motionGenerateT}>✦ Tạo chuyển động bằng AI local</Text>}
                </Pressable>
                {motionLoading&&<Text style={st.motionWait}>Đang giữ nguyên khuôn mặt và trang phục để tạo video… Model được giới hạn RAM an toàn; quá trình có thể mất vài phút.</Text>}
                {!!motionError&&<Text style={st.motionError}>{motionError}</Text>}
                {!!motionVideo&&(
                  <View style={st.videoWrap}>
                    <Video source={{uri:motionVideo}} style={st.video} useNativeControls shouldPlay isLooping resizeMode={ResizeMode.CONTAIN}/>
                    <Text style={st.videoDone}>✓ Clip đã qua kiểm tra chất lượng chuyển động local</Text>
                    <View style={st.videoActions}>
                      <Pressable style={st.videoAction} disabled={savingVideo} onPress={()=>void saveVideo()}>
                        {savingVideo?<ActivityIndicator size="small" color="#fff"/>:<><Ionicons name="download-outline" size={15} color="#fff"/><Text style={st.videoActionT}>Lưu video</Text></>}
                      </Pressable>
                      <Pressable style={st.videoAction} disabled={sharingVideo} onPress={()=>void shareVideo()}>
                        {sharingVideo?<ActivityIndicator size="small" color="#fff"/>:<><Ionicons name="share-social-outline" size={15} color="#fff"/><Text style={st.videoActionT}>Chia sẻ</Text></>}
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
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
  resultActions:{flexDirection:'row',gap:8,marginTop:10},action:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingVertical:10,borderRadius:11,borderWidth:1,borderColor:C.line,backgroundColor:'#fff'},actionT:{fontFamily:F.bodyB,fontSize:11.5,color:C.ink},
  videoActions:{flexDirection:'row',gap:8,paddingHorizontal:9,paddingBottom:9},videoAction:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingVertical:9,borderRadius:10,borderWidth:1,borderColor:'#4A413A',backgroundColor:'#1F1A16'},videoActionT:{fontFamily:F.bodyB,fontSize:11.5,color:'#fff'},
  motionCard:{backgroundColor:C.sumi,borderWidth:1,borderColor:C.kin,borderRadius:18,padding:14,marginTop:12},
  motionHead:{flexDirection:'row',alignItems:'center',gap:10},motionMark:{width:43,height:43,borderRadius:13,backgroundColor:C.shu,alignItems:'center',justifyContent:'center'},motionMarkT:{fontFamily:F.display,fontSize:20,color:'#fff'},
  motionTitle:{fontFamily:F.display,fontSize:14,color:'#fff'},motionSub:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:'#D8D2CB',marginTop:2},motionToggle:{borderWidth:1,borderColor:'#F6D6B4',borderRadius:999,paddingVertical:7,paddingHorizontal:10},motionToggleT:{fontFamily:F.bodyB,fontSize:10.5,color:'#F6D6B4'},
  motionPrompt:{fontFamily:F.bodyB,fontSize:12,color:'#fff',marginBottom:8},motionGrid:{flexDirection:'row',flexWrap:'wrap',gap:7},motionChoice:{width:'48%',minHeight:48,borderWidth:1,borderColor:'#665C54',borderRadius:11,paddingHorizontal:9,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'#2B241F'},motionChoiceOn:{backgroundColor:C.shu,borderColor:C.shu},motionIcon:{fontSize:16,color:'#fff'},motionChoiceT:{flex:1,fontFamily:F.bodyM,fontSize:10.5,lineHeight:14,color:'#E6DED7'},
  motionGenerate:{height:46,borderRadius:13,backgroundColor:C.shu,alignItems:'center',justifyContent:'center',marginTop:12},motionGenerateT:{fontFamily:F.bodyB,fontSize:12.5,color:'#fff'},motionWait:{fontFamily:F.body,fontSize:10.5,lineHeight:16,color:'#D8D2CB',textAlign:'center',marginTop:8},motionOffline:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:'#F6D6B4',marginTop:8},motionError:{fontFamily:F.bodyM,fontSize:11,lineHeight:16,color:'#FFB4B4',marginTop:9,textAlign:'center'},
  videoWrap:{marginTop:12,borderRadius:14,overflow:'hidden',backgroundColor:'#090706'},video:{width:'100%',height:430},videoDone:{fontFamily:F.bodyB,fontSize:10.5,color:'#BEE3CB',padding:9,textAlign:'center'},
});
