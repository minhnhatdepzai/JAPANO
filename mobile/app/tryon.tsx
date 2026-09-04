import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ResizeMode, Video } from 'expo-av';
import { Screen, Header, Btn } from '../components/ui';
import { useCatalog } from '../lib/data';
import { getVariantStock, Product, variantPrice } from '../lib/catalog';
import { analyzeBodyFromPhoto, BodyAnalysis, FitEffect, generateTryOn, generateTryOnMotion, getSizeAdvice, getTryOnMotionPresets, MotionPreset, reportGpuFocus, SizeFit, TryOnSafety, TryOnSafetyError } from '../lib/api';
import { BODY_ESTIMATOR_GENERATION, DEFAULT_STYLE_PROFILE, loadStyleProfile, SavedStyleProfile, saveStyleProfile } from '../lib/profile';
import { saveMediaToLibrary, shareMedia } from '../lib/media';
import { useStore } from '../lib/store';
import { C, F } from '../theme/tokens';
import { SmartImage } from '../components/SmartImage';
import { beginGpuJob, endGpuJob, useGpuFocus } from '../lib/useGpuFocus';

type PickedImage={uri:string;base64:string};
// Đi bộ đứng đầu và là mặc định — đây là thứ khách muốn xem nhất: bộ đồ rủ và
// chuyển động ra sao khi mình bước đi bình thường.
const DEFAULT_MOTIONS:MotionPreset[]=[
  {id:'walk_natural',label:'Đi bộ tự nhiên',icon:'walk-outline'},
  {id:'turn_show',label:'Xoay một vòng',icon:'sync-outline'},
  {id:'pose_sway',label:'Tạo dáng tại chỗ',icon:'body-outline'},
];
const MOTION_ICONS:Record<string, keyof typeof Ionicons.glyphMap>={
  walk_natural:'walk-outline',
  turn_show:'sync-outline',
  runway_walk:'walk-outline',
  spin:'sync-outline',
  jump:'arrow-up-circle-outline',
  pose_sway:'body-outline',
  sit_stand:'accessibility-outline',
};
const one=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const dataUri=(asset:ImagePicker.ImagePickerAsset)=>`data:${asset.mimeType||'image/jpeg'};base64,${asset.base64||''}`;
const DEFAULT_TRYON_MESSAGE='Chọn ảnh rõ và đủ sáng để hệ thống ghép trang phục tự nhiên hơn.';
const DEFAULT_TRYON_COLORS=[
  {name:'Mực',hex:'#24211F'},
  {name:'Đỏ son',hex:'#A53A32'},
  {name:'Chàm',hex:'#334C73'},
  {name:'Xanh trà',hex:'#69856D'},
  {name:'Vàng kim',hex:'#B89443'},
];
// Bảy mức vừa vặn — cùng từ vựng với backend (lib/fitAnalysis.js) để nhãn trên
// ảnh, tiêu đề banner và hiệu ứng AI luôn nói cùng một chuyện.
const FIT_UI:Record<string,{title:string;badge:string;tone:'good'|'tight'|'loose'}>={
  good:{title:'✓ Size phù hợp',badge:'VỪA',tone:'good'},
  slightly_tight:{title:'⚠ Hơi chật',badge:'HƠI CHẬT',tone:'tight'},
  tight:{title:'⚠ Chật',badge:'CHẬT',tone:'tight'},
  very_tight:{title:'⚠ Quá chật',badge:'RẤT CHẬT',tone:'tight'},
  slightly_loose:{title:'⚠ Hơi rộng',badge:'HƠI RỘNG',tone:'loose'},
  loose:{title:'⚠ Rộng',badge:'RỘNG',tone:'loose'},
  very_loose:{title:'⚠ Quá rộng',badge:'RẤT RỘNG',tone:'loose'},
};
// Loại trang phục cần xác nhận 18+ trước khi gửi ảnh sang model. Danh sách này
// chỉ để hiện hộp xác nhận sớm cho người dùng — backend vẫn là nơi quyết định
// cuối cùng (lib/adultTryonPolicy.js), client không được tự cho qua.
const ADULT_ONLY_HINT=/(bikini|đồ bơi|do boi|áo tắm|ao tam|swim|crop\s*top|áo lửng|ao lung)/i;
const isAdultOnlyGarment=(p:{name?:string;garmentType?:string}|null|undefined)=>{
  if(!p)return false;
  if(p.garmentType)return ['bikini_top','bikini_bottom','bikini_two_piece','one_piece_swimsuit','crop_top'].includes(p.garmentType);
  return ADULT_ONLY_HINT.test(String(p.name||''));
};
const SAFETY_TITLES:Record<string,string>={
  ADULT_CONSENT_REQUIRED:'Cần xác nhận đủ 18 tuổi',
  MINOR_SUSPECTED:'Ảnh không phù hợp',
  AGE_UNVERIFIED:'Chưa xác định được độ tuổi',
  AGE_VERIFICATION_UNAVAILABLE:'Chưa kiểm tra được ảnh',
  COVERAGE_UNSAFE:'Ảnh chưa đạt yêu cầu an toàn',
};
const confidenceLabel=(value:number)=>value>=.62?'Cao':value>=.42?'Trung bình':value>=.25?'Thấp':'Rất thấp';
const rangeText=(min?:number|null,max?:number|null,unit='')=>
  (min==null||max==null)?'':Math.round(min)===Math.round(max)?`${Math.round(min)} ${unit}`.trim():`${Math.round(min)}–${Math.round(max)} ${unit}`.trim();
const localSize=(height:string,weight:string)=>{
  const h=Number(height),w=Number(weight);
  const bmi=h&&w?w/((h/100)**2):21;
  if((w&&w<48)||bmi<17.5)return'S';
  if(w>125)return'5XL';
  if(w>112||bmi>36)return'4XL';
  if(w>100||bmi>33)return'XXXL';
  if(w>88||bmi>29)return'XXL';
  if(w>78||bmi>26)return'XL';
  if(w>64||bmi>22.5)return'L';
  return'M';
};

export default function TryOn() {
  // Chỉ giữ GPU cho đúng lúc chạy try-on/motion. Khi chỉ xem ảnh kết quả,
  // trả GPU về browse để mô tả ảnh và semantic product suggestions dùng tiếp.
  // Ref ngăn request hoàn tất muộn giành focus sau khi người dùng đã thoát.
  // Giữ FASHN thường trú trong lúc màn thử đồ còn mở. Dùng `browse` ở đây làm
  // finally của mỗi lượt vừa tạo xong đã gọi /unload, nên lần đổi size/đổi áo
  // kế tiếp luôn phải cold-start model và người dùng chờ thêm hàng chục giây.
  const params=useLocalSearchParams<{productId?:string;slug?:string;color?:string;size?:string}>();
  const router=useRouter();
  const {products}=useCatalog();
  const {addToCart,showToast}=useStore();
  const productId=one(params.productId)||one(params.slug)||'haori-dang-dai';
  const product=products.find(p=>p.slug===productId||p.id===productId)||products[0];
  const tryonFocus=product?.garmentType==='bikini_two_piece'?'swimwear':'tryon';
  const gpuScreenActive=useGpuFocus(tryonFocus,'browse');
  const colorOptions=useMemo(()=>{
    const seen=new Set<string>();
    const options:{name:string;hex?:string;stock:number|null}[]=[];
    if(product.variants?.length){
      for(const variant of product.variants){
        const name=String(variant.colorName||'Mặc định');
        if(seen.has(name))continue;
        seen.add(name);
        const sameColor=product.variants.filter(item=>String(item.colorName||'Mặc định')===name);
        options.push({
          name,
          hex:variant.colorHex,
          stock:sameColor.reduce((sum,item)=>sum+Math.max(0,Number(item.stock)||0),0),
        });
      }
      return options;
    }
    for(const item of product.colors||[]){
      const name=typeof item==='string'?item:String(item.name||'Mặc định');
      if(seen.has(name))continue;
      seen.add(name);
      options.push({name,hex:typeof item==='string'?undefined:item.hex,stock:null});
    }
    return options.length?options:DEFAULT_TRYON_COLORS.map(item=>({...item,stock:null}));
  },[product.slug,product.colors,product.variants]);
  const accessories=useMemo(()=>products.filter(p=>p.cat==='phu-kien'),[products]);
  // Phải khớp accessoryKind() ở backend/lib/accessory.js — nhãn hiện ở đây
  // chính là điểm neo mà pipeline sẽ dùng, nên hai bên lệch nhau là nói dối
  // người dùng về chỗ món đồ sẽ xuất hiện.
  const accessorySpot=(p:Product):{key:string;label:string}=>{
    const text=`${p.name||''} ${p.slug||''}`.toLowerCase();
    if(/(ba ?lô|ba ?lo|balo|backpack)/.test(text))return {key:'back',label:'Sau lưng'};
    if(/(^|[\s\-_])(dù|du|ô|o)([\s\-_]|$)|umbrella/.test(text))return {key:'hand',label:'Cầm tay'};
    if(/(chụp tai|chup tai|earmuff)/.test(text))return {key:'head',label:'Trên đầu'};
    if(/(kẹp|kep|trâm|tram|kanzashi|hair)/.test(text))return {key:'head',label:'Trên đầu'};
    if(/(mũ|mu |nón|non |hat)/.test(text))return {key:'head',label:'Trên đầu'};
    if(/(giày|giay|dép|dep|guốc|guoc|geta|vớ|tất|tat|tabi|sock|shoe)/.test(text))return {key:'feet',label:'Dưới chân'};
    if(/(đai|dai |obi|thắt lưng|belt|sash)/.test(text))return {key:'waist',label:'Ngang eo'};
    return {key:'hand',label:'Cầm tay'};
  };
  // Trước đây danh sách phụ kiện là một hàng ngang dài không nhãn, nên giày,
  // ba lô hay chụp tai nằm khuất phía sau và trông như không tồn tại. Nhóm theo
  // BỘ PHẬN CƠ THỂ, mỗi nhóm một hàng có tiêu đề, và ghi rõ món sẽ gắn vào đâu.
  const SPOT_ORDER=['head','back','waist','hand','feet'];
  const SPOT_TITLE:Record<string,string>={head:'Trên đầu',back:'Sau lưng',waist:'Ngang eo',hand:'Cầm tay',feet:'Dưới chân'};
  const accessoryGroups=useMemo(()=>{
    const groups=new Map<string,Product[]>();
    for(const item of accessories){
      const {key}=accessorySpot(item);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key)!.push(item);
    }
    return SPOT_ORDER.filter(key=>groups.has(key)).map(key=>({key,title:SPOT_TITLE[key],items:groups.get(key)!}));
  },[accessories]);
  // Giữ đồng bộ với clothTypeFor() ở backend/routes/tryon.js — hai nơi phải phân
  // vùng giống nhau, nếu không giao diện sẽ cho chọn một tổ hợp mà máy chủ từ chối.
  const zoneOf=(p:Product):'upper'|'lower'|'overall'=>{
    const text=`${p.name||''} ${p.cat||''}`.toLowerCase();
    if(/(quần|quan|chân váy|chan vay|hakama)/.test(text))return 'lower';
    if(/(kimono|yukata|đầm|dam|dress|cosplay|đồng phục|dong phuc|bộ đồ|bo do|jinbei|samue)/.test(text))return 'overall';
    return 'upper';
  };
  const layerOf=(p:Product):'upper-base'|'upper-outer'|'lower'|'overall'=>{
    const zone=zoneOf(p);
    if(zone!=='upper')return zone;
    const text=`${p.name||''} ${p.cat||''}`.toLowerCase();
    return /(haori|áo choàng|ao choang|áo khoác|ao khoac|cardigan|jacket|coat|outerwear)/i.test(text)?'upper-outer':'upper-base';
  };
  const LAYER_LABEL:Record<string,string>={'upper-base':'Áo lớp trong','upper-outer':'Áo khoác ngoài',lower:'Thân dưới',overall:'Bộ liền thân'};
  const LAYER_ORDER:Record<string,number>={lower:0,'upper-base':1,'upper-outer':2,overall:3};
  // Món mặc kèm với sản phẩm chính (áo + quần). Phụ kiện đi đường riêng vì
  // chúng được ghép bằng pipeline khác, không phải VTON.
  const [extraGarments,setExtraGarments]=useState<string[]>([]);
  const [showGarments,setShowGarments]=useState(false);
  const chosenGarments=useMemo(()=>[product,...extraGarments.map(slug=>products.find(p=>p.slug===slug)).filter(Boolean) as Product[]]
    .sort((a,b)=>LAYER_ORDER[layerOf(a)]-LAYER_ORDER[layerOf(b)]),[product,extraGarments,products]);
  // Gợi ý phải BÙ VÀO CHỖ CÒN TRỐNG, không phải chào lại thứ khách đang mặc.
  // Đang thử một chiếc áo mà danh sách vẫn đẩy áo lên đầu thì gợi ý đó vô dụng:
  // hai món cùng vùng không mặc chồng được, chọn vào chỉ nhận cảnh báo xung đột.
  // Thứ tự: vùng còn trống trước → rồi mới tới phần còn lại; món xung đột bị mờ
  // đi và ghi rõ lý do thay vì để khách bấm vào mới biết.
  const wearableGarments=useMemo(()=>{
    const occupied=new Set(chosenGarments.map(zoneOf));
    const rank=(p:Product)=>{
      const zone=zoneOf(p);
      if(occupied.has('overall'))return 3;              // bộ liền thân: mọi thứ đều thừa
      if(zone==='overall')return occupied.size?3:2;     // chỉ mặc riêng được
      return occupied.has(zone)?3:0;                    // vùng còn trống lên đầu
    };
    return products
      .filter(p=>p.cat!=='phu-kien'&&!chosenGarments.some(c=>c.slug===p.slug))
      .map(p=>({product:p,rank:rank(p)}))
      .sort((a,b)=>a.rank-b.rank||LAYER_ORDER[layerOf(a.product)]-LAYER_ORDER[layerOf(b.product)])
      .map(row=>({...row,conflict:row.rank===3}));
  },[products,chosenGarments]);
  // Nói thẳng còn thiếu vùng nào, thay vì bắt khách tự suy ra từ các thẻ nhỏ.
  const missingZoneHint=useMemo(()=>{
    const occupied=new Set(chosenGarments.map(zoneOf));
    if(occupied.has('overall'))return 'Bộ liền thân đã phủ kín người — không cần thêm món nào.';
    if(!occupied.has('lower'))return 'Bạn đang mặc đồ thân trên — chọn thêm một món thân dưới (quần, chân váy, hakama) để thử cả bộ.';
    if(!occupied.has('upper'))return 'Bạn đang mặc đồ thân dưới — chọn thêm một chiếc áo để thử cả bộ.';
    return 'Đã đủ áo và quần. Muốn đổi món nào thì bỏ chọn món đó trước.';
  },[chosenGarments]);
  const [photo,setPhoto]=useState<PickedImage|null>(null);
  const [profile,setProfile]=useState<SavedStyleProfile>(DEFAULT_STYLE_PROFILE);
  const [color,setColor]=useState(one(params.color)||colorOptions.find(item=>(item.stock??1)>0)?.name||colorOptions[0]?.name||'Mặc định');
  const sizeOptions=useMemo(()=>{
    if(product.variants?.length){
      const bySize=new Map<string,number>();
      for(const variant of product.variants){
        if(String(variant.colorName||'Mặc định')!==color)continue;
        const variantSize=String(variant.size||'M');
        bySize.set(variantSize,(bySize.get(variantSize)||0)+Math.max(0,Number(variant.stock)||0));
      }
      return [...bySize.entries()].map(([value,stock])=>({value,stock}));
    }
    return (product.sizes?.filter(Boolean)||[]).map(value=>({value,stock:null as number|null}));
  },[product.slug,product.sizes,product.variants,color]);
  // Không tự bịa S–5XL cho sản phẩm thiếu size. Trường hợp đó vẫn được thử ảnh,
  // nhưng backend trả fit=unknown thay vì giả định size M.
  const tryonSizes=sizeOptions.map(item=>item.value);
  const selectableSizes=sizeOptions.filter(item=>item.stock===null||item.stock>0).map(item=>item.value);
  const [size,setSize]=useState(one(params.size)||selectableSizes[0]||tryonSizes[0]||'');
  const currentStock=size?getVariantStock(product,color,size):null;
  const selectedPrice=variantPrice(product,color,size||undefined);
  const [selectedAccessories,setSelectedAccessories]=useState<string[]>([]);
  const [showAccessories,setShowAccessories]=useState(false);
  const [result,setResult]=useState('');
  const [resultEngine,setResultEngine]=useState('');
  const [sizeFit,setSizeFit]=useState<SizeFit|null>(null);
  const [fitEffect,setFitEffect]=useState<FitEffect|null>(null);
  const [bodyAnalysis,setBodyAnalysis]=useState<BodyAnalysis|null>(null);
  const [bodyLoading,setBodyLoading]=useState(false);
  const bodyAnalysisTask=useRef<Promise<(BodyAnalysis&{ok:boolean;message?:string})|null>|null>(null);
  const [bodyError,setBodyError]=useState('');
  const [usingEstimate,setUsingEstimate]=useState(false);
  const [showManualMeasurements,setShowManualMeasurements]=useState(false);
  const [adultConsent,setAdultConsent]=useState(false);
  const [safety,setSafety]=useState<TryOnSafety|null>(null);
  const [safetyError,setSafetyError]=useState<{code:string;message:string}|null>(null);
  const [message,setMessage]=useState(DEFAULT_TRYON_MESSAGE);
  const [error,setError]=useState('');
  const [warning,setWarning]=useState('');
  const [loading,setLoading]=useState(false);
  const [loadingSeconds,setLoadingSeconds]=useState(0);
  const [loadingMode,setLoadingMode]=useState<'outfit'|'accessory'>('outfit');
  const loadingPulse=useRef(new Animated.Value(0)).current;
  const [resultRecipe,setResultRecipe]=useState('');
  const [appliedAccessoryIds,setAppliedAccessoryIds]=useState<string[]>([]);
  // Món quần áo ĐÃ có trong ảnh kết quả hiện tại. Thêm một món ở vùng cơ thể
  // còn trống thì mặc tiếp lên chính ảnh này, không dựng lại từ ảnh gốc.
  const [appliedGarmentIds,setAppliedGarmentIds]=useState<string[]>([]);
  const [sizeLoading,setSizeLoading]=useState(false);
  const [motionPresets,setMotionPresets]=useState<MotionPreset[]>(DEFAULT_MOTIONS);
  const [motionReady,setMotionReady]=useState(false);
  const [motionPanel,setMotionPanel]=useState(false);
  const [selectedMotion,setSelectedMotion]=useState(DEFAULT_MOTIONS[0].id);
  const [motionLoading,setMotionLoading]=useState(false);
  const [motionVideo,setMotionVideo]=useState('');
  const [motionError,setMotionError]=useState('');
  const [savingPhoto,setSavingPhoto]=useState(false);
  const [sharingPhoto,setSharingPhoto]=useState(false);
  const [savingVideo,setSavingVideo]=useState(false);
  const [sharingVideo,setSharingVideo]=useState(false);

  useEffect(()=>{
    if(!colorOptions.some(item=>item.name===color)){
      setColor(colorOptions.find(item=>(item.stock??1)>0)?.name||colorOptions[0]?.name||'Mặc định');
      return;
    }
    const selected=sizeOptions.find(item=>item.value===size);
    if(sizeOptions.length&&(!selected||selected.stock===0))setSize(selectableSizes[0]||sizeOptions[0].value);
    if(!sizeOptions.length&&size)setSize('');
  },[product.slug,color,colorOptions.map(item=>`${item.name}:${item.stock}`).join('|'),sizeOptions.map(item=>`${item.value}:${item.stock}`).join('|')]);

  useEffect(()=>{
    if(!loading){setLoadingSeconds(0);loadingPulse.stopAnimation();loadingPulse.setValue(0);return;}
    // Dùng đồng hồ thật thay vì cộng 1 mỗi tick: Android thường tạm dừng JS
    // timer khi app ở nền. Lúc quay lại, con số phải nhảy tới đúng thời gian đã
    // trôi qua, không được giả vờ job cũng bị đứng theo giao diện.
    const startedAt=Date.now();
    const updateClock=()=>setLoadingSeconds(Math.floor((Date.now()-startedAt)/1000));
    updateClock();
    const timer=setInterval(updateClock,1000);
    const animation=Animated.loop(Animated.sequence([
      Animated.timing(loadingPulse,{toValue:1,duration:850,easing:Easing.inOut(Easing.quad),useNativeDriver:true}),
      Animated.timing(loadingPulse,{toValue:0,duration:850,easing:Easing.inOut(Easing.quad),useNativeDriver:true}),
    ]));
    animation.start();
    return()=>{clearInterval(timer);animation.stop();};
  },[loading,loadingPulse]);

  useEffect(()=>{void loadStyleProfile().then(saved=>{
    setProfile(saved);
    setUsingEstimate(saved.measurementSource==='image-estimation');
  });},[]);
  // Fast Refresh có thể giữ cờ loading nhưng không còn callback của lượt chạy
  // cũ để hạ cờ. Không để người dùng phải đóng app mới bấm tạo lại được.
  useEffect(()=>{
    setLoading(false);
    setMessage(current=>current.startsWith('Hệ thống đang nhận diện')?DEFAULT_TRYON_MESSAGE:current);
  },[]);
  // Màn hình này được Expo Router tái sử dụng khi đổi sản phẩm. Không giữ lại
  // món phối của sản phẩm trước, vì nó có thể âm thầm tạo một bộ xung đột trong
  // khi mục "Mặc thêm món khác" đang thu gọn.
  useEffect(()=>{
    setExtraGarments([]);
    setShowGarments(false);
    setError('');
    setResult('');setResultRecipe('');setAppliedAccessoryIds([]);setSelectedAccessories([]);
    setMotionVideo('');setMotionPanel(false);setMotionError('');
  },[product.slug]);
  useEffect(()=>{
    let active=true;
    const syncMotion=()=>void getTryOnMotionPresets()
      .then(data=>{if(!active)return;setMotionReady(data.ready);if(!data.presets.length)return;
        setMotionPresets(data.presets);
        // Máy chủ là nơi quyết định danh sách chuyển động. Nếu lựa chọn hiện tại
        // không còn trong danh sách vừa nhận (đổi tên preset, gỡ bớt), kéo về
        // mục đầu tiên — nếu không, nút tạo video sẽ gửi lên một id mà máy chủ
        // từ chối, và người dùng chỉ thấy lỗi mà không hiểu vì sao.
        setSelectedMotion(current=>data.presets.some(preset=>preset.id===current)?current:data.presets[0].id);})
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
    const picked={uri:asset.uri,base64:dataUri(asset)};
    setPhoto(picked);setResult('');setResultRecipe('');setAppliedAccessoryIds([]);setResultEngine('');setSizeFit(null);setFitEffect(null);setWarning('');setMotionVideo('');setMotionPanel(false);setMotionError('');
    // Mỗi ảnh mới có thể là một người khác. Mặc định đọc vóc dáng từ chính ảnh
    // này; số đo thật đã lưu chỉ dùng khi khách chủ động chuyển sang nhập tay.
    setBodyAnalysis(null);setBodyError('');setUsingEstimate(true);
    // Ảnh mới có thể là người hoàn toàn khác. Xoá estimate của ảnh trước ngay
    // khi chọn ảnh; nếu lượt phân tích mới thiếu trường nào thì trường đó phải
    // để trống, tuyệt đối không hiện/lấy lại cân nặng cũ cho bước fit.
    setProfile(current=>({
      ...current,
      heightEstimateCm:undefined,weightEstimateKg:undefined,
      heightEstimateConfidence:0,weightEstimateConfidence:0,estimateConfidence:0,
      heightSource:'image-estimation',weightSource:'image-estimation',measurementSource:'image-estimation',
    }));
    void runBodyAnalysis(picked.base64);
  };

  // Phân tích vóc dáng chạy trên CPU (pose + tách nền), không giành GPU với
  // try-on, nên tự chạy ngay sau khi có ảnh. Kết quả chỉ là ƯỚC LƯỢNG và luôn
  // được trình bày dưới dạng khoảng kèm độ tin cậy.
  const runBodyAnalysis=(imageBase64:string)=>{
    if(!imageBase64)return;
    const task=(async()=>{
      setBodyLoading(true);setBodyError('');
      try{
      const analysis=await analyzeBodyFromPhoto({personImageBase64:imageBase64,productId:product.slug});
      if(!analysis.ok)throw new Error(analysis.message||'Không phân tích được vóc dáng.');
      setBodyAnalysis(analysis);
      const height=analysis.estimatedHeight?.source==='user_provided'?null:analysis.estimatedHeight?.valueCm;
      const weight=analysis.estimatedWeight?.source==='user_provided'?null:analysis.estimatedWeight?.valueKg;
      if(height||weight||analysis.referenceProfile?.usableForSizing){
        setUsingEstimate(true);
        setProfile(current=>{
          const next={
            ...current,
            heightEstimateCm:height??undefined,
            weightEstimateKg:weight??undefined,
            heightEstimateConfidence:height?analysis.estimatedHeight?.confidence??0:0,
            weightEstimateConfidence:weight?analysis.estimatedWeight?.confidence??0:0,
            estimateConfidence:Math.max(
              height?analysis.estimatedHeight?.confidence??0:0,
              weight?analysis.estimatedWeight?.confidence??0:0,
            ),
            heightSource:'image-estimation' as const,
            weightSource:'image-estimation' as const,
            measurementSource:'image-estimation' as const,
            // Đóng dấu thế hệ model: lần nâng cấp sau sẽ tự loại số này thay vì
            // để nó nằm lại trong máy như 202cm/117kg của thế hệ trước.
            estimatorGeneration:BODY_ESTIMATOR_GENERATION,
          };
          void saveStyleProfile(next);
          return next;
        });
        if(analysis.recommendedSize&&selectableSizes.includes(analysis.recommendedSize)){
          // Một chạm: ảnh mới tự đổi sang size backend vừa khuyến nghị. Khách vẫn
          // có thể bấm size khác để xem hiệu ứng chật/rộng sau đó.
          setSize(analysis.recommendedSize);
        }
        setMessage(`AI đã tự phân tích vóc dáng${analysis.recommendedSize?` và chọn cỡ ${analysis.recommendedSize}`:''}. Bạn có thể tạo ảnh ngay hoặc chọn size khác để xem độ chật/rộng.`);
      }
      return analysis;
      }catch(e:any){
        setBodyAnalysis(null);
        setBodyError(e?.message||'Không phân tích được vóc dáng từ ảnh này.');
        return null;
      }finally{setBodyLoading(false);}
    })();
    bodyAnalysisTask.current=task;
    void task.finally(()=>{if(bodyAnalysisTask.current===task)bodyAnalysisTask.current=null;});
    return task;
  };

  // Người dùng chủ động chấp nhận số liệu ước lượng. Không tự điền: số của AI
  // không được âm thầm đóng vai số đo thật.
  const useEstimatedBody=async()=>{
    // Nếu Python trả source=user_provided thì đó là số khách đã nhập được đưa
    // vào để hiệu chỉnh scale, không phải dự đoán mới của AI.
    const height=bodyAnalysis?.estimatedHeight?.source==='user_provided'?null:bodyAnalysis?.estimatedHeight?.valueCm;
    const weight=bodyAnalysis?.estimatedWeight?.source==='user_provided'?null:bodyAnalysis?.estimatedWeight?.valueKg;
    if(!height&&!weight)return;
    const patch:Record<string,unknown>={
      heightEstimateCm:height??undefined,
      weightEstimateKg:weight??undefined,
      heightEstimateConfidence:height?bodyAnalysis?.estimatedHeight?.confidence??0:profile.heightEstimateConfidence,
      weightEstimateConfidence:weight?bodyAnalysis?.estimatedWeight?.confidence??0:profile.weightEstimateConfidence,
      estimateConfidence:Math.max(
        height?bodyAnalysis?.estimatedHeight?.confidence??0:0,
        weight?bodyAnalysis?.estimatedWeight?.confidence??0:0,
      ),
      heightSource:profile.height?'user':height?'image-estimation':profile.heightSource,
      weightSource:profile.weight?'user':weight?'image-estimation':profile.weightSource,
      measurementSource:'image-estimation',
      estimatorGeneration:BODY_ESTIMATOR_GENERATION,
    };
    const next={...profile,...patch} as typeof profile;
    setProfile(next);
    setUsingEstimate(true);
    await saveStyleProfile(next);
    if(bodyAnalysis?.recommendedSize&&selectableSizes.includes(bodyAnalysis.recommendedSize))setSize(bodyAnalysis.recommendedSize);
    setMessage(`Đã dùng số liệu AI ước lượng${bodyAnalysis?.recommendedSize?` — gợi ý kích cỡ ${bodyAnalysis.recommendedSize}`:''}. Bạn có thể sửa lại bằng số đo thật bất cứ lúc nào.`);
  };

  const updateProfile=(key:keyof SavedStyleProfile,value:string)=>{
    setProfile(old=>({
      ...old,[key]:value,measurementSource:'user',
      ...(key==='height'?{heightSource:'user' as const}:{}),
      ...(key==='weight'?{weightSource:'user' as const}:{}),
    }));
    if(key==='height'||key==='weight')setUsingEstimate(false);
  };

  const effectiveMeasurement=(key:'height'|'weight')=>{
    const source=profile[`${key}Source`];
    const raw=source==='image-estimation'?'':String(profile[key]||'');
    if(raw)return raw;
    if(!usingEstimate)return '';
    const estimate=key==='height'?profile.heightEstimateCm:profile.weightEstimateKg;
    return estimate?String(Math.round(estimate)):'';
  };

  const adviseSize=async()=>{
    setSizeLoading(true);setError('');
    const ideal=localSize(effectiveMeasurement('height'),effectiveMeasurement('weight'));
    const order=['S','M','L','XL','XXL','XXXL','4XL','5XL'];
    const fallback=selectableSizes.length
      ? [...selectableSizes].sort((a,b)=>Math.abs(order.indexOf(a)-order.indexOf(ideal))-Math.abs(order.indexOf(b)-order.indexOf(ideal)))[0]
      : '';
    try{
      const saved=await saveStyleProfile(profile);
      const advice=await getSizeAdvice({productId:product.slug,profile:saved,selectedSize:size});
      const next=selectableSizes.includes(advice.size)?advice.size:fallback;setSize(next);setMessage(advice.advice||`Theo số đo đã nhập, kích cỡ ${next} là lựa chọn gần nhất còn hàng.`);
    }catch(e:any){setSize(fallback);setMessage(`Tạm tính theo chiều cao và cân nặng: kích cỡ ${fallback}. ${e?.message||''}`.trim());}
    finally{setSizeLoading(false);}
  };

  const clearGeneratedResult=(nextMessage='Đã thay đổi lựa chọn. Bấm Tạo ảnh thử đồ để tạo kết quả mới.')=>{
    setResult('');setResultEngine('');setWarning('');setSizeFit(null);setFitEffect(null);setSafety(null);setSafetyError(null);
    setResultRecipe('');setAppliedAccessoryIds([]);setAppliedGarmentIds([]);
    setMotionVideo('');setMotionPanel(false);setMotionError('');
    setMessage(nextMessage);
  };
  /* "Công thức nền" của ảnh kết quả: sản phẩm gốc + màu + size.
   *
   * Món phối thêm KHÔNG nằm trong công thức này, vì thêm một món ở vùng cơ thể
   * còn trống là việc mặc tiếp lên ảnh hiện có — giống hệt cách ghép phụ kiện.
   * Đổi màu/size/sản phẩm gốc mới là đổi nền và bắt buộc dựng lại từ ảnh gốc.
   */
  const outfitRecipeFor=(chosenSize=size)=>JSON.stringify({
    base:product.slug,color,size:chosenSize,
  });
  const resolveAppliedAccessoryIds=(requested:string[],reported:string[])=>{
    const normalized=new Set(reported.map(value=>value.trim().toLocaleLowerCase('vi-VN')));
    return requested.filter(slug=>{
      const item=accessories.find(candidate=>candidate.slug===slug);
      return normalized.has(slug.toLocaleLowerCase('vi-VN'))
        ||Boolean(item&&normalized.has(item.name.toLocaleLowerCase('vi-VN')));
    });
  };
  const selectSize=(value:string)=>{
    const option=sizeOptions.find(item=>item.value===value);
    if(option?.stock===0)return;
    if(value===size)return;
    setSize(value);
    clearGeneratedResult(`Đã chọn cỡ ${value}. Bấm Tạo ảnh thử đồ để xem độ vừa vặn.`);
  };
  const selectColor=(value:string)=>{
    const option=colorOptions.find(item=>item.name===value);
    if(option?.stock===0||value===color)return;
    const candidates=(product.variants||[]).filter(item=>String(item.colorName||'Mặc định')===value);
    const currentSize=candidates.find(item=>String(item.size||'M')===size&&Math.max(0,Number(item.stock)||0)>0);
    const firstAvailable=candidates.find(item=>Math.max(0,Number(item.stock)||0)>0);
    setColor(value);
    if(!currentSize&&firstAvailable)setSize(String(firstAvailable.size||'M'));
    clearGeneratedResult(`Đã chọn màu ${value}. Bấm Tạo ảnh thử đồ để tạo kết quả mới.`);
  };
  const toggleAccessory=(slug:string)=>{
    if(loading)return;
    if(selectedAccessories.includes(slug)){
      setSelectedAccessories(old=>old.filter(x=>x!==slug));
      if(appliedAccessoryIds.includes(slug)){
        clearGeneratedResult('Phụ kiện này đã nằm trong ảnh. Để bỏ món đó, hệ thống sẽ tạo lại từ ảnh gốc ở lượt kế tiếp.');
      }else{
        setMessage('Đã bỏ phụ kiện chưa ghép; ảnh hiện tại vẫn được giữ nguyên.');
      }
      return;
    }
    if(selectedAccessories.length>=3){
      Alert.alert('Tối đa 3 phụ kiện','Hãy bỏ một món đang chọn trước. Giới hạn này giúp AI giữ đúng vị trí và không trả ảnh phụ kiện dán thô.');
      return;
    }
    setSelectedAccessories(old=>[...old,slug]);
    const item=accessories.find(candidate=>candidate.slug===slug);
    if(result&&resultRecipe===outfitRecipeFor()){
      setMotionVideo('');setMotionPanel(false);setMotionError('');
      setMessage(`Đã chọn ${item?.name||'phụ kiện'}. Bấm tạo để ghép tiếp lên chính ảnh vừa tạo, không mặc lại quần áo từ đầu.`);
    }else{
      setMessage(`Đã chọn ${item?.name||'phụ kiện'}. Phụ kiện sẽ được ghép sau bước thử quần áo.`);
    }
  };
  // Fast Refresh có thể giữ state 4 món từ phiên bản cũ. Tự thu về giới hạn
  // mới và xóa kết quả cũ để nút tạo luôn gửi payload hợp lệ.
  useEffect(()=>{
    if(selectedAccessories.length<=3)return;
    setSelectedAccessories(old=>old.slice(0,3));
    clearGeneratedResult('Đã cập nhật giới hạn tối đa 3 phụ kiện. Bấm Tạo ảnh thử đồ để tạo kết quả mới.');
  },[selectedAccessories.length]);

  // Cùng luật với máy chủ: được phối một áo trong + một áo khoác ngoài; bộ
  // liền thân mặc riêng và thân dưới chỉ nhận một món.
  // Kiểm tra tại chỗ để báo ngay khi bấm chọn, thay vì bắt khách chờ hết một
  // lượt GPU rồi mới nhận thông báo từ chối.
  const conflictFor=(garments:Product[])=>{
    const overall=garments.find(p=>zoneOf(p)==='overall');
    if(overall&&garments.length>1)return `"${overall.name}" là bộ liền thân, phủ kín người nên không mặc chồng thêm món khác được.`;
    const lower=garments.filter(p=>zoneOf(p)==='lower');
    if(lower.length>1)return `Chỉ thử được một món thân dưới mỗi lượt: ${lower.map(p=>p.name).join(' và ')}.`;
    for(const layer of ['upper-base','upper-outer'] as const){
      const inLayer=garments.filter(p=>layerOf(p)===layer);
      if(inLayer.length>1)return `Chỉ thử được một ${LAYER_LABEL[layer].toLowerCase()} mỗi lượt: ${inLayer.map(p=>p.name).join(' và ')}.`;
    }
    return '';
  };
  const outfitConflict=useMemo(()=>conflictFor(chosenGarments),[chosenGarments]);
  // Fast Refresh có thể giữ lại thông báo từ luật cũ (từng chặn mọi cặp áo
  // thân trên). Khi bộ hiện tại đã hợp lệ theo luật phân lớp mới, xoá lỗi cũ
  // để người dùng không tưởng rằng sơ mi + Haori vẫn bị chặn.
  useEffect(()=>{
    if(!outfitConflict)setError(current=>/món thân trên|áo lớp trong|áo khoác ngoài/.test(current)?'':current);
  },[outfitConflict]);
  const toggleGarment=(slug:string)=>{
    if(extraGarments.includes(slug)){
      setExtraGarments(old=>old.filter(x=>x!==slug));
      setError('');
      if(appliedGarmentIds.includes(slug)){
        // Không "cởi" được một món đã nằm trong ảnh ghép: phải dựng lại từ đầu.
        clearGeneratedResult('Món này đã nằm trong ảnh. Để bỏ nó, hệ thống sẽ dựng lại từ ảnh gốc ở lượt kế tiếp.');
      }else{
        setMessage('Đã bỏ món chưa mặc; ảnh hiện tại vẫn được giữ nguyên.');
      }
      return;
    }
    const next=[...extraGarments,slug].slice(-2);
    const nextGarments=[product,...next.map(id=>products.find(p=>p.slug===id)).filter(Boolean) as Product[]];
    const conflict=conflictFor(nextGarments);
    if(conflict){
      setError(`${conflict} Hãy chọn một món thuộc vùng cơ thể khác.`);
      return;
    }
    setExtraGarments(next);
    setError('');
    // Ảnh đang có vẫn đúng nền (cùng sản phẩm gốc, màu, size) thì GIỮ LẠI và
    // mặc tiếp món mới lên chính nó. Trước đây bước này xoá ảnh và bắt chạy lại
    // toàn bộ từ ảnh gốc, vừa mất kết quả cũ vừa tốn thêm cả lượt GPU.
    if(result&&resultRecipe===outfitRecipeFor()){
      setMotionVideo('');setMotionPanel(false);setMotionError('');
      const item=products.find(candidate=>candidate.slug===slug);
      setMessage(`Đã chọn ${item?.name||'món phối'}. Bấm tạo để mặc tiếp lên chính ảnh vừa tạo, không dựng lại từ ảnh gốc.`);
      return;
    }
    clearGeneratedResult('Đã thêm một món phối. Bấm Tạo ảnh thử đồ để tạo cả bộ.');
  };

  const needsAdultConsent=useMemo(
    ()=>chosenGarments.some(item=>isAdultOnlyGarment(item as any)),
    [chosenGarments],
  );

  const run=async()=>{
    if(!photo){Alert.alert('Thiếu ảnh người','Hãy chụp ảnh hoặc chọn ảnh có sẵn để thử đồ.');return;}
    if(currentStock===0){setError(`Màu ${color}, cỡ ${size} hiện đã hết hàng. Hãy chọn biến thể còn hàng trước khi tạo ảnh.`);return;}
    if(needsAdultConsent&&!adultConsent){
      // Không gửi ảnh đi khi chưa có xác nhận — ảnh không rời máy vô ích.
      setSafetyError({code:'ADULT_CONSENT_REQUIRED',
        message:'Trang phục này chỉ dành cho người từ 18 tuổi. Hãy xác nhận ở ô bên dưới trước khi tạo ảnh.'});
      return;
    }
    if(outfitConflict){setShowGarments(true);setError(`${outfitConflict} Hãy bỏ món bị trùng rồi tạo lại ảnh.`);return;}
    const pendingAccessories=selectedAccessories.filter(slug=>!appliedAccessoryIds.includes(slug));
    const removedAccessories=appliedAccessoryIds.filter(slug=>!selectedAccessories.includes(slug));
    // Món quần áo chưa nằm trong ảnh (bỏ qua sản phẩm gốc — nó luôn là nền).
    const pendingGarments=chosenGarments
      .filter(item=>item.slug!==product.slug&&!appliedGarmentIds.includes(item.slug))
      .map(item=>item.slug);
    const removedGarments=appliedGarmentIds.filter(slug=>!chosenGarments.some(item=>item.slug===slug));
    // Nối tiếp khi: ảnh hiện có đúng NỀN (sản phẩm gốc + màu + size), còn món
    // mới cần mặc/ghép, và không bỏ đi món nào đã nằm trong ảnh.
    const continueFromResult=Boolean(
      result
      &&resultRecipe===outfitRecipeFor()
      &&(pendingAccessories.length||pendingGarments.length)
      &&!removedAccessories.length
      &&!removedGarments.length,
    );
    const requestedAccessories=continueFromResult?pendingAccessories:selectedAccessories;
    const pickedNames=accessories.filter(item=>requestedAccessories.includes(item.slug)).map(item=>item.name);
    const pendingGarmentNames=chosenGarments.filter(item=>pendingGarments.includes(item.slug)).map(item=>item.name);
    setLoadingMode(continueFromResult&&!pendingGarments.length?'accessory':'outfit');
    // Reset ngay ở đúng thời điểm bấm tạo. Không chờ effect của lượt trước,
    // nếu không thao tác "Tạo lại" thật nhanh có thể kế thừa số giây cũ.
    setLoadingSeconds(0);setLoading(true);setError('');setWarning('');
    setMessage(continueFromResult
      ? `Đang ${pendingGarmentNames.length?`mặc tiếp ${pendingGarmentNames.join(', ')}`:''}${pendingGarmentNames.length&&pickedNames.length?' và ':''}${pickedNames.length?`ghép ${pickedNames.join(', ')}`:''} lên chính ảnh vừa tạo; không dựng lại từ ảnh gốc.`
      : `Đang tạo ảnh nét bằng GPU (một món thường 20–40 giây): nhận diện đúng người, mặc ${chosenGarments.length>1?`lần lượt ${chosenGarments.map(item=>item.name).join(' rồi ')}`:'trang phục'}${pickedNames.length?`, rồi ghép ${pickedNames.join(', ')}`:''} và kiểm tra lại mặt, cơ thể, độ nét…`);
    // Bắt đầu làm nóng FASHN song song với phân tích vóc dáng CPU.
    // Cold-start vì thế không cộng nối tiếp vào thời gian người dùng chờ.
    const focusReady=reportGpuFocus(tryonFocus);
    // Phân tích cơ thể CPU trên Redmi có thể mất 30–45 giây. Nó hữu ích cho gợi
    // ý size nhưng không được chặn cả lượt thử đồ: chờ tối đa đúng giai đoạn
    // "kiểm tra ảnh" 4,5 giây, sau đó cho FASHN chạy và để phân tích hoàn tất
    // nền. Lượt kế tiếp sẽ dùng cache vừa có; không bịa số đo khi chưa kịp có.
    const analysisForRequest=continueFromResult
      ? bodyAnalysis
      : bodyAnalysisTask.current
      ? await Promise.race([
          bodyAnalysisTask.current.catch(()=>null),
          new Promise<null>(resolve=>setTimeout(()=>resolve(null),4_500)),
        ])
      : bodyAnalysis;
    const automaticSize=analysisForRequest?.recommendedSize;
    const requestSize=automaticSize&&selectableSizes.includes(automaticSize)?automaticSize:size;
    if(requestSize!==size)setSize(requestSize);
    await focusReady;
    // Đánh dấu "đang chạy" để tín hiệu focus nền không huỷ mất tác vụ này khi
    // màn hình tự tắt hoặc người dùng kéo thanh thông báo (xem lib/useGpuFocus).
    beginGpuJob();
    try{
      const saved=continueFromResult?profile:await saveStyleProfile(profile);
      const output=await generateTryOn(continueFromResult?{
        // Chỉ gửi món MỚI và dùng ảnh kết quả hiện tại làm ảnh người. Backend
        // vì thế chỉ mặc/ghép phần còn thiếu thay vì dựng lại cả bộ từ đầu:
        // với phụ kiện là đường accessory-only, với quần áo là đúng một lượt
        // FASHN cho vùng cơ thể còn trống.
        personImageBase64:result,
        productId:pendingGarments[0]||requestedAccessories[0],
        productIds:[...pendingGarments,...requestedAccessories],
        color,size:requestSize,qualityMode:'fast',skipBodyAnalysis:true,
      }:{
        personImageBase64:photo.base64,
        productId:product.slug,
        productIds:chosenGarments.map(item=>item.slug),
        productImageKey:product.imageKeys?.[0]||'',
        color,size:requestSize,accessoryIds:selectedAccessories,profile:saved,
        // Backend mới là nơi quyết định; đây chỉ là xác nhận của người dùng.
        adultConsent,
        measurementMode:usingEstimate?'image':'user',
        // 16 bước CUDA + upscale 1280 px: benchmark thật 22–23 giây/món
        // khi model sẵn, trong khi preview trên điện thoại vẫn đủ nét.
        qualityMode:'fast',
        bodyAnalysisCache:analysisForRequest||undefined,
        // Mobile đã chạy cùng worker ở nền. Nếu 4,5 giây chưa có kết quả thì
        // backend không được chạy lại tuần tự và cộng thêm 30–45 giây; fit trả
        // unknown cho lượt này, đúng hơn việc bịa số đo hoặc bắt khách chờ.
        skipBodyAnalysis:true,
      });
      if(!output.imageUrl)throw new Error(output.message||'Backend chưa trả ảnh kết quả.');
      setResult(output.imageUrl);setResultEngine(output.engine||'ai-gateway');setMessage(output.message);
      setResultRecipe(outfitRecipeFor(requestSize));
      const appliedNow=resolveAppliedAccessoryIds(requestedAccessories,output.appliedAccessories);
      setAppliedAccessoryIds(continueFromResult
        ? [...new Set([...appliedAccessoryIds,...appliedNow])]
        : appliedNow);
      // Món quần áo coi như đã mặc khi backend không báo bỏ qua nó.
      const skipped=new Set(output.skippedGarments.map(value=>value.trim().toLocaleLowerCase('vi-VN')));
      const garmentsNowApplied=(continueFromResult?pendingGarments:chosenGarments.filter(item=>item.slug!==product.slug).map(item=>item.slug))
        .filter(slug=>{
          const item=products.find(candidate=>candidate.slug===slug);
          return !skipped.has(slug.toLocaleLowerCase('vi-VN'))&&!(item&&skipped.has(item.name.toLocaleLowerCase('vi-VN')));
        });
      setAppliedGarmentIds(continueFromResult
        ? [...new Set([...appliedGarmentIds,...garmentsNowApplied])]
        : garmentsNowApplied);
      setWarning(output.warning
        || (output.skippedAccessories.length?`Chưa ghép tự nhiên được phụ kiện: ${output.skippedAccessories.join(', ')}. Ảnh quần áo sạch đã được giữ lại.`:'')
        || (output.skippedGarments.length?`Chưa ghép được: ${output.skippedGarments.join(', ')}.`:''));
      if(!continueFromResult){
        setSizeFit(output.sizeFit&&output.sizeFit.verdict!=='unknown'?output.sizeFit:null);
        setFitEffect(output.fitEffect||null);
        setSafety(output.safety||null);
      }
      setSafetyError(null);
      if(output.bodyAnalysis)setBodyAnalysis(current=>({...(current||{} as BodyAnalysis),...output.bodyAnalysis!}));
      setMotionVideo('');setMotionError('');
      if(!continueFromResult)Alert.alert(
        '✦ Làm ảnh thử đồ sống động?',
        'Bạn có muốn dùng AI local để nhân vật đi, xoay, nhảy hoặc khoe dáng với bộ đồ vừa thử không?',
        [{text:'Để sau',style:'cancel'},{text:'Chọn chuyển động',onPress:()=>setMotionPanel(true)}],
      );
    }catch(e:any){
      // Nối tiếp mà hỏng thì GIỮ NGUYÊN ảnh cũ — khách không mất kết quả đã có.
      if(!continueFromResult){setResult('');setResultEngine('');setSizeFit(null);setFitEffect(null);setResultRecipe('');setAppliedAccessoryIds([]);setAppliedGarmentIds([]);}
      if(e instanceof TryOnSafetyError){
        // Lỗi an toàn hiển thị riêng, không lẫn vào lỗi kỹ thuật.
        setSafetyError({code:e.code,message:e.message});
        setError('');setMessage('');
      }else{
        setSafetyError(null);
        setError(e?.message||'Không tạo được ảnh thử đồ.');setMessage('');
      }
    }
    finally{
      endGpuJob();
      setLoading(false);
      if(gpuScreenActive.current)void reportGpuFocus(tryonFocus);
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
      if(gpuScreenActive.current)void reportGpuFocus(tryonFocus);
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
  const flowStep=result?3:photo?2:1;
  const pendingAccessoryCount=selectedAccessories.filter(slug=>!appliedAccessoryIds.includes(slug)).length;
  const pendingGarmentCount=chosenGarments.filter(item=>item.slug!==product.slug&&!appliedGarmentIds.includes(item.slug)).length;
  const willContinueResult=Boolean(result&&resultRecipe===outfitRecipeFor()&&(pendingAccessoryCount||pendingGarmentCount));
  // Năm giây đầu là kiểm tra ảnh đầu vào, không tính nhập nhằng vào thời gian
  // sinh ảnh. Khi qua mốc này bộ đếm AI mới bắt đầu từ 0 để khách biết chính
  // xác phần model mất bao lâu, kể cả khi họ tạm chuyển sang ứng dụng khác.
  const checkingInput=loadingSeconds<5;
  const aiSeconds=Math.max(0,loadingSeconds-5);
  const loadingStage=checkingInput
    ? 'Đang kiểm tra ảnh đầu vào'
    : loadingMode==='accessory'
      ? aiSeconds<17?'Đang xác định vị trí và ghép phụ kiện'
        :'Đang làm phụ kiện tự nhiên và kiểm tra ảnh'
      : aiSeconds<11?'Đang chuẩn bị trang phục và giữ khuôn mặt'
        :aiSeconds<30?'AI đang mặc trang phục lên ảnh'
        :'Đang kiểm tra độ nét, cơ thể và vùng an toàn';
  const loadingClock=checkingInput
    ? `Kiểm tra ảnh · còn ${Math.max(1,5-loadingSeconds)} giây`
    : `Thời gian xử lý AI · ${aiSeconds} giây`;
  const loadingScale=loadingPulse.interpolate({inputRange:[0,1],outputRange:[.9,1.08]});
  const loadingOpacity=loadingPulse.interpolate({inputRange:[0,1],outputRange:[.55,1]});
  return (
    <Screen>
      <Header title="Thử đồ thông minh" />
      <ScrollView contentContainerStyle={{paddingHorizontal:18,paddingBottom:28}} keyboardShouldPersistTaps="handled">
        <View style={st.chip}>
          <SmartImage source={product.images[0]} style={st.productThumb} recyclingKey={`${product.slug}-tryon-thumb`} />
          <View style={{flex:1,marginLeft:9}}><Text style={st.productName}>{product.name}</Text><Text style={st.productMeta}>{selectedPrice.toLocaleString('vi-VN')}₫ · {color} · {size||'Chưa có bảng size'}{currentStock!==null?` · còn ${currentStock}`:''}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Đổi sản phẩm" hitSlop={10} onPress={()=>router.push(`/product/${product.slug}`)}><Text style={st.change}>Đổi</Text></Pressable>
        </View>

        <View style={st.steps} accessibilityLabel={`Bước ${flowStep} trên 3`}>
          {['Chọn ảnh','Tạo ảnh','Hoàn tất'].map((label,index)=>{
            const step=index+1;
            const active=step<=flowStep;
            return <React.Fragment key={label}>
              {index>0&&<View style={[st.stepLine,step<=flowStep&&st.stepLineOn]}/>}
              <View style={st.stepItem}>
                <View style={[st.stepDot,active&&st.stepDotOn]}>{step<flowStep?<Ionicons name="checkmark" size={12} color="#fff"/>:<Text style={[st.stepNumber,active&&{color:'#fff'}]}>{step}</Text>}</View>
                <Text style={[st.stepLabel,step===flowStep&&st.stepLabelOn]}>{label}</Text>
              </View>
            </React.Fragment>;
          })}
        </View>

        <View style={st.result}>
          <SmartImage
            source={display}
            style={{width:'100%',height:photo||result?480:340,opacity:!photo&&!result?.72:1}}
            contentFit={photo||result?'contain':'cover'}
            recyclingKey={result?'tryon-result':photo?.uri||`${product.slug}-tryon`}
          />
          <View style={st.tag}><Text style={st.tagT}>{result?'✦ KẾT QUẢ THỬ ĐỒ':photo?'✦ ẢNH CỦA BẠN':'✦ SẢN PHẨM BẠN ĐANG THỬ'}</Text></View>
          {!!result&&!!sizeFit&&!!FIT_UI[sizeFit.verdict]&&(
            <View style={[st.fitBadge,FIT_UI[sizeFit.verdict].tone==='good'?st.fitBadgeGood:FIT_UI[sizeFit.verdict].tone==='tight'?st.fitBadgeTight:st.fitBadgeLoose]}>
              <Text style={st.fitBadgeT}>ĐỘ VỪA: {FIT_UI[sizeFit.verdict].badge}</Text>
            </View>
          )}
          {loading&&(
            <View style={st.loading} accessibilityLiveRegion="polite" accessibilityLabel={`${loadingStage}, ${loadingClock}`}>
              <Animated.View style={[st.loadingOrb,{opacity:loadingOpacity,transform:[{scale:loadingScale}]}]}>
                <Ionicons name={loadingMode==='accessory'?'sparkles':'shirt-outline'} size={30} color="#fff" />
              </Animated.View>
              <Text style={st.loadingTitle}>{checkingInput?'ĐANG KIỂM TRA ẢNH':loadingMode==='accessory'?'GHÉP TIẾP TRÊN ẢNH HIỆN TẠI':'ĐANG TẠO ẢNH THỬ ĐỒ'}</Text>
              <Text style={st.loadingT}>{loadingStage}</Text>
              <View style={st.loadingDots}>{[0,1,2,3].map(index=><View key={index} style={[st.loadingDot,loadingSeconds%4>=index&&st.loadingDotOn]}/>)}</View>
              <Text style={st.loadingTime}>{loadingClock} · có thể chuyển sang ứng dụng khác</Text>
            </View>
          )}
        </View>
        {needsAdultConsent&&(
          <View style={st.consentCard}>
            <Text style={st.consentTitle}>Trang phục dành cho người từ 18 tuổi</Text>
            <Text style={st.consentBody}>
              Ảnh của bạn chỉ được dùng để ghép trang phục lên đúng vóc dáng bạn đang có. Hệ thống
              không tạo ảnh khỏa thân, không cởi bỏ trang phục và luôn giữ kín vùng ngực, vùng chậu
              và mông. Ảnh không được lưu lại sau khi tạo xong.
            </Text>
            <Pressable style={st.consentRow} onPress={()=>{setAdultConsent(v=>!v);setSafetyError(null);}}>
              <View style={[st.checkbox,adultConsent&&st.checkboxOn]}>
                {adultConsent&&<Ionicons name="checkmark" size={14} color="#fff"/>}
              </View>
              <Text style={st.consentCheck}>Tôi đủ 18 tuổi và có quyền sử dụng ảnh này.</Text>
            </Pressable>
          </View>
        )}
        {!!safetyError&&(
          <View style={st.safetyBanner}>
            <Text style={st.safetyTitle}>{SAFETY_TITLES[safetyError.code]||'Không thể tạo ảnh'}</Text>
            <Text style={st.safetyMsg}>{safetyError.message}</Text>
          </View>
        )}
        {!!safety&&safety.intentionalSkinExposure&&!!result&&(
          <View style={st.coverageNote}>
            <Text style={st.coverageT}>
              Trang phục này để lộ {safety.allowedExposedZones.map(zone=>({
                abdomen:'bụng',shoulders:'vai',upperArms:'bắp tay',legs:'chân',back:'lưng',
              } as Record<string,string>)[zone]||zone).join(', ')} theo đúng thiết kế.
              Hệ thống đã kiểm tra và giữ kín vùng ngực, vùng chậu và mông.
            </Text>
            {!!safety.adultVerification?.attestationFallback&&(
              <Text style={[st.coverageT,{marginTop:6}]}>
                Độ tuổi không được suy đoán tự động từ ảnh; lượt này dựa trên xác nhận 18+ của bạn.
              </Text>
            )}
          </View>
        )}
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
        {!!sizeFit&&!!FIT_UI[sizeFit.verdict]&&(
          <View style={[st.fitBanner,FIT_UI[sizeFit.verdict].tone==='good'?st.fitGood:FIT_UI[sizeFit.verdict].tone==='tight'?st.fitTight:st.fitLoose]}>
            <Text style={st.fitTitle}>{FIT_UI[sizeFit.verdict].title}</Text>
            <Text style={st.fitMsg}>{sizeFit.message}</Text>
            {fitEffect?.applied&&(
              <Text style={st.fitNote}>Ảnh đã được AI mô phỏng lại độ căng/độ rủ của vải trên đúng vóc dáng của bạn — cơ thể trong ảnh giữ nguyên, chỉ có quần áo thay đổi.</Text>
            )}
            {!!fitEffect&&fitEffect.requested&&!fitEffect.applied&&(
              <Text style={st.fitNote}>Chưa dựng được hiệu ứng vừa vặn cho lượt này; ảnh đang là bản thử đồ gốc.</Text>
            )}
            {/*
              Hai trạng thái backend đã tính nhưng màn hình trước đây không hiện.
              `outsideAvailableRange` nghĩa là cơ thể vượt MỌI size đang bán —
              khác hẳn "chật", vì đổi size cũng không giải quyết được.
              `no_size` nghĩa là sản phẩm chưa khai báo size chart, nên hệ thống
              KHÔNG được kết luận vừa hay chật.
            */}
            {sizeFit.sizingMode==='no_size'&&(
              <Text style={st.fitNote}>Sản phẩm này chưa có bảng size, nên hệ thống không kết luận vừa hay chật. Ảnh thử đồ vẫn tạo được, nhưng hãy xem đây là mô phỏng.</Text>
            )}
            {!!sizeFit.outsideAvailableRange&&(
              <Text style={st.fitNote}>Không có size nào phù hợp: cỡ cơ thể ước tính gần {sizeFit.idealSize||'—'} nhưng shop chỉ bán tới {(sizeFit.availableSizes||[]).slice(-1)[0]||'—'}. Ảnh đang mô phỏng đúng hệ quả khi mặc size lớn nhất hiện có.</Text>
            )}
            {!!sizeFit.lengthNote&&(
              <Text style={st.fitNote}>{sizeFit.lengthNote}</Text>
            )}
            {!!sizeFit.recommended&&sizeFit.verdict!=='good'&&(
              <Pressable style={st.fitBtn} onPress={()=>{setSize(sizeFit.recommended!);clearGeneratedResult(`Đã đổi sang cỡ ${sizeFit.recommended}. Bấm Tạo ảnh thử đồ để xem lại độ vừa vặn.`);}}>
                <Text style={st.fitBtnT}>Dùng cỡ {sizeFit.recommended}</Text>
              </Pressable>
            )}
          </View>
        )}
        <View style={st.pickRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Chụp ảnh để thử đồ" style={st.pick} onPress={()=>void choose(true)}><Ionicons name="camera-outline" size={18} color={C.ink}/><Text style={st.pickT}>Chụp ảnh</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Chọn ảnh từ thư viện để thử đồ" style={st.pick} onPress={()=>void choose(false)}><Ionicons name="images-outline" size={18} color={C.ink}/><Text style={st.pickT}>Chọn ảnh</Text></Pressable>
        </View>

        <Text style={st.tip}>Chọn một ảnh rõ người và đủ sáng. JAPANO sẽ tự gợi ý kích cỡ rồi tạo ảnh thử đồ; bạn không cần nhập số đo trước.</Text>

        {!!photo&&(
          <View style={st.bodyCard}>
            <View style={st.bodyHead}>
              <Text style={st.bodyTitle}>PHÂN TÍCH VÓC DÁNG</Text>
              {bodyLoading
                ? <ActivityIndicator size="small" color={C.ink} />
                : <Pressable onPress={()=>void runBodyAnalysis(photo.base64)}><Text style={st.bodyRetry}>Phân tích lại</Text></Pressable>}
            </View>
            {bodyLoading&&<Text style={st.bodyHint}>Đang đo tỉ lệ cơ thể từ ảnh…</Text>}
            {!!bodyError&&!bodyLoading&&<Text style={st.bodyWarn}>{bodyError}</Text>}
            {!!bodyAnalysis&&!bodyLoading&&(
              <>
                {!!bodyAnalysis.measurementMessage&&(
                  <View style={bodyAnalysis.measurementStatus==='insufficient_evidence'?st.cutoffBox:undefined}>
                    {bodyAnalysis.measurementStatus==='insufficient_evidence'&&(
                      <Text style={st.cutoffTitle}>Không đủ bằng chứng để đo — vẫn thử đồ được</Text>
                    )}
                    <Text style={bodyAnalysis.measurementStatus==='insufficient_evidence'?st.cutoffMsg:st.bodyHint}>
                      {bodyAnalysis.measurementMessage}
                    </Text>
                  </View>
                )}
                <View style={st.bodyRow}>
                  <Text style={st.bodyLabel}>{bodyAnalysis.estimatedHeight?.source==='user_provided'?'Chiều cao bạn đã nhập':bodyAnalysis.estimatedHeight?.minCm!=null?'Chiều cao AI ước lượng':'Chiều cao tham chiếu AI'}</Text>
                  <Text style={st.bodyValue}>
                    {rangeText(bodyAnalysis.estimatedHeight?.minCm,bodyAnalysis.estimatedHeight?.maxCm,'cm')
                      ||rangeText(bodyAnalysis.referenceProfile?.heightCm?.[0],bodyAnalysis.referenceProfile?.heightCm?.[1],'cm')
                      ||'Không đủ dữ liệu'}
                  </Text>
                </View>
                <View style={st.bodyRow}>
                  <Text style={st.bodyLabel}>{bodyAnalysis.estimatedWeight?.source==='user_provided'?'Cân nặng bạn đã nhập':bodyAnalysis.estimatedWeight?.minKg!=null?'Cân nặng AI ước lượng':'Cân nặng tham chiếu AI'}</Text>
                  <Text style={st.bodyValue}>
                    {rangeText(bodyAnalysis.estimatedWeight?.minKg,bodyAnalysis.estimatedWeight?.maxKg,'kg')
                      ||rangeText(bodyAnalysis.referenceProfile?.weightKg?.[0],bodyAnalysis.referenceProfile?.weightKg?.[1],'kg')
                      ||'Không đủ dữ liệu'}
                  </Text>
                </View>
                <View style={st.bodyRow}>
                  <Text style={st.bodyLabel}>Vòng ngực AI ước lượng</Text>
                  <Text style={st.bodyValue}>
                    {rangeText(bodyAnalysis.estimatedGirthRanges?.bust?.minCm,bodyAnalysis.estimatedGirthRanges?.bust?.maxCm,'cm')
                      ||rangeText(bodyAnalysis.referenceProfile?.bustCm?.[0],bodyAnalysis.referenceProfile?.bustCm?.[1],'cm')
                      ||'Không đủ dữ liệu'}
                  </Text>
                </View>
                <View style={st.bodyRow}>
                  <Text style={st.bodyLabel}>Vòng eo AI ước lượng</Text>
                  <Text style={st.bodyValue}>
                    {rangeText(bodyAnalysis.estimatedGirthRanges?.waist?.minCm,bodyAnalysis.estimatedGirthRanges?.waist?.maxCm,'cm')
                      ||rangeText(bodyAnalysis.referenceProfile?.waistCm?.[0],bodyAnalysis.referenceProfile?.waistCm?.[1],'cm')
                      ||'Không đủ dữ liệu'}
                  </Text>
                </View>
                <View style={st.bodyRow}>
                  <Text style={st.bodyLabel}>Vòng hông AI ước lượng</Text>
                  <Text style={st.bodyValue}>
                    {rangeText(bodyAnalysis.estimatedGirthRanges?.hip?.minCm,bodyAnalysis.estimatedGirthRanges?.hip?.maxCm,'cm')
                      ||rangeText(bodyAnalysis.referenceProfile?.hipCm?.[0],bodyAnalysis.referenceProfile?.hipCm?.[1],'cm')
                      ||'Không đủ dữ liệu'}
                  </Text>
                </View>
                {/*
                  Ảnh cắt ngay tại hàng đo là ca KHÁC HẲN "kém tin cậy": ở đó
                  không có phép đo nào cả. Backend trả null cho vòng đó và cho
                  cân nặng, nên màn hình phải nói thẳng là cần chụp lại chứ không
                  hiển thị một ô trống không giải thích.
                */}
                {!!(bodyAnalysis as any).measurementRowsCutOff?.length&&(
                  <View style={st.cutoffBox}>
                    <Text style={st.cutoffTitle}>Cần chụp lại ảnh</Text>
                    <Text style={st.cutoffMsg}>
                      Ảnh bị cắt ngay tại vị trí đo {((bodyAnalysis as any).measurementRowsCutOff as string[])
                        .map((k)=>({chest:'vòng ngực',waist:'vòng eo',hip:'vòng hông'} as Record<string,string>)[k]||k)
                        .join(', ')}. Hệ thống không đo được ở đó nên đã bỏ trống thay vì đoán.
                      {'\n'}Hãy chụp lại thấy trọn người từ đầu tới bàn chân, đứng thẳng, hai tay hơi tách khỏi thân.
                    </Text>
                    <Pressable style={st.cutoffBtn} onPress={()=>void choose(false)}>
                      <Text style={st.cutoffBtnT}>Chọn ảnh khác</Text>
                    </Pressable>
                  </View>
                )}
                {(() => {
                  // Ba lý do khiến số đo kém tin cậy mà người dùng CÓ THỂ tự sửa
                  // được bằng cách chụp lại. Nói thẳng ra còn hơn để họ tin vào
                  // một con số mà hệ thống đã tự biết là yếu.
                  const q:any = bodyAnalysis.quality || {};
                  const canh:string[] = [];
                  if (q.fullBodyVisible === false) canh.push('ảnh chưa thấy đủ toàn thân');
                  if (Number(q.clothingSlack || 1) > 1.15) canh.push('trang phục khá rộng');
                  if (q.armsMergedIntoTorso) canh.push('hai tay sát thân');
                  if (!canh.length) return null;
                  return (
                    <Text style={st.bodyHint}>
                      Độ chính xác giảm vì {canh.join(', ')}. Chụp toàn thân, đứng thẳng, hai tay hơi tách khỏi người sẽ chính xác hơn — hoặc nhập số đo thật của bạn.
                    </Text>
                  );
                })()}
                <View style={st.bodyRow}>
                  <Text style={st.bodyLabel}>Độ tin cậy</Text>
                  {/*
                    Trước đây ô này lấy `analysisConfidence` — độ tin cậy của việc
                    ĐỌC ẢNH, không phải của con số ước lượng. Khi hệ thống từ chối
                    ước lượng (ảnh cắt cụt, tư thế lạ), màn hình hiện "Không đủ dữ
                    liệu" ngay bên trên mà vẫn báo "Cao" ở đây — đọc vào thì mâu
                    thuẫn và làm người dùng tin nhầm vào một con số không tồn tại.
                    Nay bám theo chính hai ước lượng đang hiển thị.
                  */}
                  <Text style={st.bodyValue}>{(() => {
                    const moc = [bodyAnalysis.estimatedHeight, bodyAnalysis.estimatedWeight]
                      .filter((item:any) => Number(item?.valueCm ?? item?.valueKg ?? 0) > 0)
                      .map((item:any) => Number(item?.confidence) || 0);
                    if (!moc.length) return 'Chưa ước lượng được';
                    return confidenceLabel(Math.min(...moc));
                  })()}</Text>
                </View>
                {!!bodyAnalysis.recommendedSize&&(
                  <View style={st.bodyRow}>
                    <Text style={st.bodyLabel}>Kích cỡ gợi ý</Text>
                    <Text style={st.bodyValue}>{bodyAnalysis.recommendedSize}</Text>
                  </View>
                )}
                <Text style={st.bodyNote}>
                  {(bodyAnalysis.warnings&&bodyAnalysis.warnings[0])||'Ước lượng từ một ảnh 2D có sai số, không phải phép đo nhân trắc chính xác.'}
                  {'\n'}Mỗi khoảng hiển thị rộng đúng 10 đơn vị. Khi ảnh thiếu vật làm mốc kích thước, kết quả chỉ là khoảng tham khảo chứ không phải số đo bằng thước.
                </Text>
                <View style={st.bodyActions}>
                  <Pressable
                    style={[st.bodyBtn,st.bodyBtnMain,usingEstimate&&st.bodyBtnOn]}
                    onPress={()=>void useEstimatedBody()}
                    disabled={
                      (bodyAnalysis.estimatedHeight?.source==='user_provided'||!bodyAnalysis.estimatedHeight?.valueCm)
                      &&(bodyAnalysis.estimatedWeight?.source==='user_provided'||!bodyAnalysis.estimatedWeight?.valueKg)
                    }
                  >
                    <Text style={st.bodyBtnMainT}>{usingEstimate?'AI đang tự dùng số liệu':'Dùng lại số liệu AI'}</Text>
                  </Pressable>
                  <Pressable style={st.bodyBtn} onPress={()=>{
                    setUsingEstimate(false);
                    setShowManualMeasurements(true);
                    setProfile(current=>({...current,measurementSource:'user'}));
                    setMessage('Hãy nhập chiều cao, cân nặng (và vòng ngực/eo/hông nếu có) để hệ thống dùng số đo thật của bạn.');
                  }}>
                    <Text style={st.bodyBtnT}>Nhập số đo thật</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}

        <View style={st.sectionHead}>
          <Text style={[st.section,{marginTop:0,marginBottom:0}]}>Kích cỡ</Text>
          <Pressable accessibilityRole="button" accessibilityState={{expanded:showManualMeasurements}} onPress={()=>setShowManualMeasurements(v=>!v)} hitSlop={8}>
            <Text style={st.optionalLink}>{showManualMeasurements?'Ẩn số đo':'Nhập số đo thật · tùy chọn'}</Text>
          </Pressable>
        </View>
        {usingEstimate&&!!photo&&<Text style={st.estimateTag}>JAPANO đang dùng khoảng ước lượng từ ảnh để gợi ý kích cỡ. Bạn vẫn có thể nhập số đo thật nếu muốn.</Text>}
        {showManualMeasurements&&(
          <View style={st.manualBox}>
            <Text style={st.manualHint}>Số đo thật luôn được ưu tiên hơn ước lượng từ ảnh.</Text>
            <View style={st.measureRow}>
              <Measure label="Chiều cao" value={effectiveMeasurement('height')} onChange={v=>updateProfile('height',v)} unit="cm" />
              <Measure label="Cân nặng" value={effectiveMeasurement('weight')} onChange={v=>updateProfile('weight',v)} unit="kg" />
            </View>
          </View>
        )}
        {tryonSizes.length
          ? <View style={st.sizeRow}>{sizeOptions.map(option=>{
              const selected=size===option.value;
              const soldOut=option.stock===0;
              return <Pressable
                key={option.value}
                disabled={soldOut||loading}
                accessibilityRole="button"
                accessibilityState={{selected,disabled:soldOut||loading}}
                accessibilityLabel={`Cỡ ${option.value}${option.stock===null?'':soldOut?' hết hàng':` còn ${option.stock}`}`}
                style={[st.size,selected&&st.sizeOn,soldOut&&st.optionSold]}
                onPress={()=>selectSize(option.value)}
              >
                <Text style={[st.sizeT,selected&&{color:'#fff'}]}>{option.value}</Text>
                {option.stock!==null&&<Text style={[st.stockTiny,selected&&{color:'rgba(255,255,255,.78)'}]}>{soldOut?'Hết':`còn ${option.stock}`}</Text>}
              </Pressable>;
            })}</View>
          : <Text style={st.estimateTag}>Sản phẩm không khai báo size: chỉ thử hình ảnh, không kết luận chật/rộng và không tự chọn size M.</Text>}
        {currentStock!==null&&<Text style={[st.stockSummary,currentStock===0&&{color:C.shuDeep}]}>{currentStock>0?`Biến thể ${color} · ${size}: còn ${currentStock} sản phẩm`:`Biến thể ${color} · ${size} đã hết hàng`}</Text>}
        <Btn label={sizeLoading?'Đang tính kích cỡ…':'Gợi ý kích cỡ cho tôi'} variant="ghost" onPress={()=>{if(!sizeLoading)void adviseSize();}} />

        <Text style={st.section}>Màu trang phục</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{colorOptions.map(option=>{
          const selected=color===option.name;
          const soldOut=option.stock===0;
          return <Pressable
            key={option.name}
            disabled={soldOut||loading}
            accessibilityRole="button"
            accessibilityState={{selected,disabled:soldOut||loading}}
            accessibilityLabel={`Màu ${option.name}${option.stock===null?'':soldOut?' hết hàng':` còn tổng ${option.stock}`}`}
            style={[st.pill,selected&&st.pillOn,soldOut&&st.optionSold]}
            onPress={()=>selectColor(option.name)}
          >
            {!!option.hex&&<View style={[st.colorDot,{backgroundColor:option.hex},selected&&{borderColor:'#fff'}]}/>}
            <View>
              <Text style={[st.pillT,selected&&{color:'#fff'}]}>{option.name}</Text>
              {option.stock!==null&&<Text style={[st.colorStock,selected&&{color:'rgba(255,255,255,.78)'}]}>{soldOut?'Hết hàng':`Tổng còn ${option.stock}`}</Text>}
            </View>
          </Pressable>;
        })}</ScrollView>

        <Pressable style={st.accHeader} onPress={()=>setShowGarments(v=>!v)}>
          <View style={{flex:1}}>
            <Text style={st.section}>Mặc thêm món khác <Text style={st.expBadge}>PHỐI BỘ</Text></Text>
            {!showGarments&&<Text style={st.accHint}>Phối áo trong + Haori/áo khoác, và thêm quần hoặc váy nếu muốn thay phần dưới.</Text>}
          </View>
          <Text style={{fontFamily:F.bodyB,fontSize:16,color:C.muted}}>{showGarments?'▾':'▸'}</Text>
        </Pressable>
        {showGarments&&(
          <>
            <Text style={st.accWarn}>Thứ tự mặc: quần/váy → áo trong → Haori/áo khoác. Nếu không chọn món thân dưới, hệ thống giữ quần/váy đang có trong ảnh. Mỗi lớp thêm sẽ lâu hơn.</Text>
            <Text style={st.zoneHint}>{missingZoneHint}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10}}>
              {wearableGarments.map(({product:g,conflict})=>{
                const selected=extraGarments.includes(g.slug);
                return (
                  <Pressable
                    key={g.slug}
                    accessibilityLabel={`${selected?'Bỏ chọn':'Chọn'} ${g.name}${conflict?' — trùng vùng cơ thể với món đang mặc':''}`}
                    style={[st.acc,conflict&&!selected&&{opacity:.42}]}
                    onPress={()=>toggleGarment(g.slug)}
                  >
                    <View>
                      <SmartImage source={g.images[0]} style={[st.accImg,selected&&st.accOn]} recyclingKey={`${g.slug}-tryon-garment`} />
                      {selected&&<View style={st.accCheck}><Text style={st.accCheckT}>✓</Text></View>}
                      <View style={[st.zoneTag,conflict&&!selected&&{backgroundColor:'rgba(163,58,47,.85)'}]}>
                        <Text style={st.zoneTagT}>{conflict&&!selected?'Trùng vùng':LAYER_LABEL[layerOf(g)]}</Text>
                      </View>
                    </View>
                    <Text style={st.accT} numberOfLines={1}>{g.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={st.selectedAcc}>Đang mặc: {chosenGarments.map(item=>`${item.name} (${LAYER_LABEL[layerOf(item)].toLowerCase()})`).join(' + ')}</Text>
            {!!outfitConflict&&<Text style={st.conflict}>⚠ {outfitConflict}</Text>}
          </>
        )}

        <Pressable style={st.accHeader} onPress={()=>setShowAccessories(v=>!v)}>
          <View style={{flex:1}}>
            <Text style={st.section}>Phụ kiện đi kèm <Text style={st.expBadge}>NÂNG CAO</Text></Text>
            {!showAccessories&&<Text style={st.accHint}>Chạm để chọn tối đa 3 món — hệ thống tự chỉnh tay cầm, tóc, bóng và góc phụ kiện</Text>}
          </View>
          <Text style={{fontFamily:F.bodyB,fontSize:16,color:C.muted}}>{showAccessories?'▾':'▸'}</Text>
        </Pressable>
        {showAccessories&&(
          <>
            <Text style={st.accWarn}>Ảnh được nhận diện tư thế, ghép đúng vị trí rồi kiểm tra khuôn mặt, trang phục và tư thế tay. Quá trình này có thể lâu hơn khi chỉ thử riêng quần áo.</Text>
            {accessoryGroups.map(group=>(
              <View key={group.key} style={{marginBottom:12}}>
                <Text style={st.spotTitle}>{group.title}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{gap:10,paddingBottom:4}}>
                  {group.items.map(a=>{
                    const selected=selectedAccessories.includes(a.slug);
                    return (
                      <Pressable key={a.slug} disabled={loading} accessibilityLabel={`${selected?'Bỏ chọn':'Chọn'} ${a.name} — gắn ${group.title.toLowerCase()}`} style={[st.acc,loading&&{opacity:.55}]} onPress={()=>toggleAccessory(a.slug)}>
                        <View>
                          <SmartImage source={a.images[0]} style={[st.accImg,selected&&st.accOn]} recyclingKey={`${a.slug}-tryon-accessory`} />
                          {selected&&<View style={st.accCheck}><Text style={st.accCheckT}>✓</Text></View>}
                          <View style={st.zoneTag}><Text style={st.zoneTagT}>{group.title}</Text></View>
                        </View>
                        <Text style={st.accT} numberOfLines={1}>{a.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ))}
            <Text style={st.selectedAcc}>{selectedAccessories.length?`Đã chọn: ${accessories.filter(item=>selectedAccessories.includes(item.slug)).map(item=>item.name).join(' · ')}`:'Chưa chọn phụ kiện'}</Text>
          </>
        )}

        {!!message&&<Text style={st.message}>{message}</Text>}
        {loading&&(
          <View style={st.inlineLoading} accessibilityLiveRegion="polite">
            <Animated.View style={[st.inlineLoadingIcon,{opacity:loadingOpacity,transform:[{scale:loadingScale}]}]}>
              <Ionicons name={loadingMode==='accessory'?'sparkles':'shirt-outline'} size={20} color="#fff" />
            </Animated.View>
            <View style={{flex:1}}>
              <Text style={st.inlineLoadingTitle}>{checkingInput?'Đang kiểm tra ảnh':loadingMode==='accessory'?'Đang ghép tiếp trên ảnh hiện tại':'Đang tạo ảnh thử đồ'}</Text>
              <Text style={st.inlineLoadingText}>{loadingStage} · {loadingClock}</Text>
            </View>
            <ActivityIndicator size="small" color={C.primary}/>
          </View>
        )}
        <Btn
          label={loading?'Đang tạo ảnh…':willContinueResult?`Ghép tiếp ${pendingAccessoryCount} phụ kiện vào ảnh`:result?'Tạo lại ảnh thử đồ':'Tạo ảnh thử đồ'}
          disabled={loading||currentStock===0}
          style={{marginTop:12}}
          onPress={()=>void run()}
        />
        {result&&(
          <View style={st.resultActions}>
            <Pressable style={st.action} disabled={savingPhoto} onPress={()=>void savePhoto()}>
              {savingPhoto?<ActivityIndicator size="small" color={C.ink}/>:<><Ionicons name="download-outline" size={15} color={C.ink}/><Text style={st.actionT}>Lưu ảnh</Text></>}
            </Pressable>
            <Pressable style={st.action} disabled={sharingPhoto} onPress={()=>void sharePhoto()}>
              {sharingPhoto?<ActivityIndicator size="small" color={C.ink}/>:<><Ionicons name="share-social-outline" size={15} color={C.ink}/><Text style={st.actionT}>Chia sẻ</Text></>}
            </Pressable>
            <Pressable style={[st.action,{backgroundColor:C.primary}]} onPress={()=>{
              // Thử cả bộ rồi thì thêm cả bộ — bắt khách quay lại từng trang sản
              // phẩm để thêm lẻ là bỏ phí đúng lúc họ đã quyết định mua.
              chosenGarments.forEach(item=>addToCart(item.slug,color,size));
              showToast(chosenGarments.length>1?`Đã thêm ${chosenGarments.length} món vào giỏ ✓`:'Đã thêm vào giỏ ✓','success');
            }}><Text style={[st.actionT,{color:'#fff'}]}>{chosenGarments.length>1?`Thêm cả bộ (${chosenGarments.length})`:'Thêm giỏ'}</Text></Pressable>
          </View>
        )}
        {result&&(
          <View style={st.motionCard}>
            <View style={st.motionHead}>
              <View style={st.motionMark}><Text style={st.motionMarkT}>動</Text></View>
              <View style={{flex:1}}>
                <Text style={st.motionTitle}>Ảnh sống · đặc trưng JAPANO</Text>
                <Text style={st.motionSub}>One‑to‑All Animation 1.3B chạy CUDA, tự chọn profile nhanh theo từng action và chỉ chạy sau khi bạn yêu cầu.</Text>
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
                {motionLoading&&<Text style={st.motionWait}>Đang giữ nguyên khuôn mặt và trang phục để tạo video… Đi bộ/tạo dáng thường khoảng 1 phút; xoay có thể lâu hơn một chút.</Text>}
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
  cutoffBox:{backgroundColor:C.warningSoft,borderColor:'#E8912D',borderWidth:1,borderRadius:12,padding:12,marginTop:10,marginBottom:6},
  cutoffTitle:{fontWeight:'800',color:'#8A4B00',marginBottom:4,fontSize:13},
  cutoffMsg:{color:'#6B4A1B',fontSize:12,lineHeight:18},
  cutoffBtn:{marginTop:10,alignSelf:'flex-start',minHeight:44,justifyContent:'center',paddingHorizontal:16,borderRadius:10,backgroundColor:'#8A4B00'},
  cutoffBtnT:{color:'#fff',fontWeight:'700',fontSize:13},
  chip:{flexDirection:'row',alignItems:'center',padding:10,borderWidth:1,borderColor:C.line,borderRadius:14,backgroundColor:C.card,marginBottom:14},
  productThumb:{width:46,height:56,borderRadius:9},productName:{fontFamily:F.bodyB,fontSize:13,color:C.ink},productMeta:{fontFamily:F.body,fontSize:11.5,color:C.muted,marginTop:2},change:{fontFamily:F.bodyB,fontSize:11,color:C.ink},
  steps:{flexDirection:'row',alignItems:'flex-start',marginBottom:12,paddingHorizontal:4},
  stepItem:{width:58,alignItems:'center'},
  stepLine:{flex:1,height:1,backgroundColor:C.line,marginTop:13,marginHorizontal:-7},
  stepLineOn:{backgroundColor:C.inverseSurface},
  stepDot:{width:28,height:28,borderRadius:14,borderWidth:1,borderColor:C.line,backgroundColor:C.card,alignItems:'center',justifyContent:'center'},
  stepDotOn:{backgroundColor:C.inverseSurface,borderColor:C.inverseSurface},
  stepNumber:{fontFamily:F.bodyB,fontSize:11,color:C.muted},
  stepLabel:{fontFamily:F.bodyM,fontSize:9.5,color:C.muted,marginTop:5,textAlign:'center'},
  stepLabelOn:{color:C.sumi,fontFamily:F.bodyB},
  result:{borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:C.line,position:'relative'},tag:{position:'absolute',top:10,left:10,zIndex:5,elevation:5,backgroundColor:C.primary,paddingVertical:4,paddingHorizontal:8,borderRadius:8},tagT:{color:'#fff',fontFamily:F.bodyX,fontSize:10},
  loading:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(26,20,16,.74)',alignItems:'center',justifyContent:'center',paddingHorizontal:28,gap:8},
  loadingOrb:{width:72,height:72,borderRadius:36,borderWidth:2,borderColor:'rgba(255,255,255,.78)',backgroundColor:'rgba(178,52,52,.72)',alignItems:'center',justifyContent:'center',marginBottom:4},
  loadingTitle:{color:'#fff',fontFamily:F.bodyX,fontSize:11,letterSpacing:1.15,textAlign:'center'},
  loadingT:{color:'#fff',fontFamily:F.bodyB,fontSize:13,textAlign:'center'},
  loadingDots:{flexDirection:'row',gap:6,marginTop:3},loadingDot:{width:19,height:4,borderRadius:3,backgroundColor:'rgba(255,255,255,.24)'},loadingDotOn:{backgroundColor:'#fff'},
  loadingTime:{color:'rgba(255,255,255,.76)',fontFamily:F.body,fontSize:10.5,textAlign:'center',marginTop:2},
  pickRow:{flexDirection:'row',gap:10,marginVertical:10},pick:{flex:1,minHeight:48,flexDirection:'row',gap:7,borderWidth:1,borderColor:C.line,borderRadius:11,paddingVertical:10,alignItems:'center',justifyContent:'center',backgroundColor:C.card},pickT:{fontFamily:F.bodyB,fontSize:12,color:C.ink},
  fitBanner:{borderRadius:13,borderWidth:1,padding:12,marginTop:10},
  fitTight:{backgroundColor:C.dangerSoft,borderColor:'#EBC4C4'},fitLoose:{backgroundColor:C.warningSoft,borderColor:C.line},fitGood:{backgroundColor:C.okSoft,borderColor:'#BEE3CB'},
  fitTitle:{fontFamily:F.bodyX,fontSize:12.5,color:C.ink},fitMsg:{fontFamily:F.body,fontSize:11.5,lineHeight:17,color:C.ink,marginTop:4},
  fitBtn:{alignSelf:'flex-start',backgroundColor:C.inverseSurface,borderRadius:9,paddingVertical:7,paddingHorizontal:12,marginTop:8},fitBtnT:{color:'#fff',fontFamily:F.bodyB,fontSize:11.5},
  fitNote:{fontFamily:F.body,fontSize:10.5,lineHeight:15.5,color:C.muted,marginTop:6},
  fitBadge:{position:'absolute',right:10,top:10,borderRadius:8,paddingHorizontal:9,paddingVertical:5,borderWidth:1},
  fitBadgeT:{fontFamily:F.bodyB,fontSize:10.5,color:'#fff',letterSpacing:.6},
  fitBadgeTight:{backgroundColor:'rgba(178,52,52,0.92)',borderColor:'rgba(255,255,255,0.5)'},
  fitBadgeLoose:{backgroundColor:'rgba(176,120,32,0.92)',borderColor:'rgba(255,255,255,0.5)'},
  fitBadgeGood:{backgroundColor:'rgba(44,120,72,0.92)',borderColor:'rgba(255,255,255,0.5)'},
  bodyCard:{marginTop:14,borderRadius:14,borderWidth:1,borderColor:C.line,backgroundColor:C.card,padding:13},
  bodyHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  bodyTitle:{fontFamily:F.bodyB,fontSize:11,color:C.muted,letterSpacing:.7},
  bodyRetry:{fontFamily:F.bodyB,fontSize:11,color:C.ai},
  bodyHint:{fontFamily:F.body,fontSize:11.5,color:C.muted,marginTop:8},
  bodyWarn:{fontFamily:F.bodyM,fontSize:11.5,lineHeight:17,color:'#A44',marginTop:8},
  bodyRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:9},
  bodyLabel:{fontFamily:F.body,fontSize:11.5,color:C.muted,flex:1},
  bodyValue:{fontFamily:F.bodyB,fontSize:13,color:C.ink},
  bodyNote:{fontFamily:F.body,fontSize:10.5,lineHeight:15.5,color:C.muted,marginTop:10},
  bodyActions:{flexDirection:'row',gap:8,marginTop:11},
  bodyBtn:{flex:1,height:40,borderRadius:10,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center',backgroundColor:C.card},
  bodyBtnT:{fontFamily:F.bodyB,fontSize:11.5,color:C.ink},
  bodyBtnMain:{backgroundColor:C.inverseSurface,borderColor:C.inverseSurface},
  bodyBtnMainT:{fontFamily:F.bodyB,fontSize:11.5,color:'#fff'},
  bodyBtnOn:{backgroundColor:C.primary,borderColor:C.primary},
  estimateTag:{fontFamily:F.body,fontSize:10.5,lineHeight:15.5,color:C.ai,marginBottom:8},
  consentCard:{marginTop:12,borderRadius:14,borderWidth:1,borderColor:C.line,backgroundColor:C.warningSoft,padding:13},
  consentTitle:{fontFamily:F.bodyB,fontSize:12.5,color:C.ink},
  consentBody:{fontFamily:F.body,fontSize:11.5,lineHeight:17,color:C.muted,marginTop:6},
  consentRow:{flexDirection:'row',alignItems:'center',gap:9,marginTop:11},
  checkbox:{width:22,height:22,borderRadius:6,borderWidth:1.5,borderColor:C.line,backgroundColor:C.card,alignItems:'center',justifyContent:'center'},
  checkboxOn:{backgroundColor:C.primary,borderColor:C.primary},
  consentCheck:{flex:1,fontFamily:F.bodyM,fontSize:11.5,lineHeight:17,color:C.ink},
  safetyBanner:{marginTop:11,borderRadius:13,borderWidth:1,borderColor:'#E7C0C0',backgroundColor:C.dangerSoft,padding:12},
  safetyTitle:{fontFamily:F.bodyB,fontSize:12.5,color:'#8E2B2B'},
  safetyMsg:{fontFamily:F.body,fontSize:11.5,lineHeight:17,color:'#7A3A3A',marginTop:5},
  coverageNote:{marginTop:10,borderRadius:12,borderWidth:1,borderColor:C.line,backgroundColor:C.card,padding:11},
  coverageT:{fontFamily:F.body,fontSize:11,lineHeight:16.5,color:C.muted},
  sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:15,marginBottom:8},
  section:{fontFamily:F.bodyB,fontSize:13,color:C.ink,marginTop:15,marginBottom:8},
  optionalLink:{fontFamily:F.bodyB,fontSize:10.5,color:C.ink,textDecorationLine:'underline'},
  manualBox:{backgroundColor:C.washi2,borderRadius:12,padding:10,marginBottom:8},
  manualHint:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:C.muted,marginBottom:8},
  measureRow:{flexDirection:'row',gap:10},measureLabel:{fontFamily:F.bodyM,fontSize:10.5,color:C.muted,marginBottom:4},measure:{height:44,flexDirection:'row',alignItems:'center',backgroundColor:C.card,borderWidth:1,borderColor:C.line,borderRadius:11,paddingHorizontal:10},measureInput:{flex:1,fontFamily:F.bodyB,fontSize:13,color:C.ink},unit:{fontFamily:F.body,fontSize:11,color:C.muted},
  sizeRow:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:10},size:{width:'22%',minWidth:62,minHeight:48,borderRadius:9,borderWidth:1,borderColor:C.line,backgroundColor:C.card,alignItems:'center',justifyContent:'center',paddingVertical:5},sizeOn:{backgroundColor:C.inverseSurface,borderColor:C.inverseSurface},sizeT:{fontFamily:F.bodyB,fontSize:12,color:C.ink},
  stockTiny:{fontFamily:F.body,fontSize:8.5,color:C.muted,marginTop:2},stockSummary:{fontFamily:F.bodyB,fontSize:11,color:C.ai,marginTop:-3,marginBottom:9},optionSold:{opacity:.4},
  pill:{minHeight:48,flexDirection:'row',alignItems:'center',gap:7,borderWidth:1,borderColor:C.line,borderRadius:999,paddingVertical:7,paddingHorizontal:13,backgroundColor:C.card},pillOn:{backgroundColor:C.primary,borderColor:C.primary},pillT:{fontFamily:F.bodyM,fontSize:11.5,color:C.ink},
  colorDot:{width:18,height:18,borderRadius:9,borderWidth:1.5,borderColor:C.line},colorStock:{fontFamily:F.body,fontSize:8.5,color:C.muted,marginTop:1},
  acc:{width:88},accImg:{width:88,height:88,borderRadius:12,borderWidth:2,borderColor:'transparent'},accOn:{borderColor:C.primary},accCheck:{position:'absolute',right:5,top:5,width:22,height:22,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:C.primary,borderWidth:2,borderColor:'#fff'},accCheckT:{color:'#fff',fontFamily:F.bodyB,fontSize:11},zoneTag:{position:'absolute',left:4,bottom:4,backgroundColor:'rgba(26,20,16,.78)',borderRadius:5,paddingHorizontal:5,paddingVertical:2},zoneTagT:{color:'#fff',fontFamily:F.bodyB,fontSize:8.5},spotTitle:{fontFamily:F.bodyB,fontSize:11,color:C.muted,letterSpacing:.6,textTransform:'uppercase',marginBottom:6},zoneHint:{fontFamily:F.bodyM,fontSize:11.5,lineHeight:17,color:C.ai,marginBottom:9},conflict:{fontFamily:F.bodyM,fontSize:11.5,lineHeight:17,color:C.ink,marginTop:6},accT:{fontFamily:F.bodyM,fontSize:10.5,color:C.ink,marginTop:4},selectedAcc:{fontFamily:F.bodyB,fontSize:11,color:C.ink,marginTop:9},
  tip:{fontFamily:F.body,fontSize:11,lineHeight:16,color:C.muted,marginTop:2,backgroundColor:C.washi2,borderRadius:9,padding:9},
  accHeader:{flexDirection:'row',alignItems:'center',marginTop:15},
  expBadge:{fontFamily:F.bodyX,fontSize:9,color:C.muted},
  accHint:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:C.muted,marginTop:2},
  accWarn:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:C.warning,backgroundColor:C.warningSoft,borderRadius:9,padding:9,marginTop:8,marginBottom:8},
  message:{fontFamily:F.body,fontSize:11.5,lineHeight:18,color:C.muted,marginTop:8,textAlign:'center'},
  inlineLoading:{minHeight:68,flexDirection:'row',alignItems:'center',gap:10,backgroundColor:C.aiSoft,borderWidth:1,borderColor:C.line,borderRadius:14,paddingHorizontal:12,paddingVertical:9,marginTop:10},
  inlineLoadingIcon:{width:42,height:42,borderRadius:21,backgroundColor:C.primary,alignItems:'center',justifyContent:'center'},inlineLoadingTitle:{fontFamily:F.bodyB,fontSize:12,color:C.ink},inlineLoadingText:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:C.muted,marginTop:2},
  errBanner:{backgroundColor:C.dangerSoft,borderWidth:1,borderColor:'#EBC4C4',borderRadius:13,padding:13,marginTop:10},
  errTitle:{fontFamily:F.bodyX,fontSize:13,color:C.shuDeep},errMsg:{fontFamily:F.body,fontSize:12,lineHeight:18,color:C.ink,marginTop:5},errTips:{fontFamily:F.body,fontSize:11,lineHeight:16,color:C.muted,marginTop:8},
  warnBanner:{backgroundColor:C.warningSoft,borderWidth:1,borderColor:C.line,borderRadius:13,padding:13,marginTop:10},warnTitle:{fontFamily:F.bodyX,fontSize:13,color:C.warning},warnMsg:{fontFamily:F.body,fontSize:11.5,lineHeight:17,color:C.ink,marginTop:4},
  resultActions:{flexDirection:'row',gap:8,marginTop:10},action:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingVertical:10,borderRadius:11,borderWidth:1,borderColor:C.line,backgroundColor:C.card},actionT:{fontFamily:F.bodyB,fontSize:11.5,color:C.ink},
  videoActions:{flexDirection:'row',gap:8,paddingHorizontal:9,paddingBottom:9},videoAction:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingVertical:9,borderRadius:10,borderWidth:1,borderColor:C.muted,backgroundColor:C.inverseSurface},videoActionT:{fontFamily:F.bodyB,fontSize:11.5,color:'#fff'},
  motionCard:{backgroundColor:C.inverseSurface,borderWidth:1,borderColor:C.kin,borderRadius:18,padding:14,marginTop:12},
  motionHead:{flexDirection:'row',alignItems:'center',gap:10},motionMark:{width:43,height:43,borderRadius:13,backgroundColor:C.primary,alignItems:'center',justifyContent:'center'},motionMarkT:{fontFamily:F.display,fontSize:20,color:'#fff'},
  motionTitle:{fontFamily:F.display,fontSize:14,color:'#fff'},motionSub:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:'rgba(255,255,255,0.70)',marginTop:2},motionToggle:{borderWidth:1,borderColor:'rgba(255,255,255,0.72)',borderRadius:999,paddingVertical:7,paddingHorizontal:10},motionToggleT:{fontFamily:F.bodyB,fontSize:10.5,color:'rgba(255,255,255,0.72)'},
  motionPrompt:{fontFamily:F.bodyB,fontSize:12,color:'#fff',marginBottom:8},motionGrid:{flexDirection:'row',flexWrap:'wrap',gap:7},motionChoice:{width:'48%',minHeight:48,borderWidth:1,borderColor:'#665C54',borderRadius:11,paddingHorizontal:9,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'#2B241F'},motionChoiceOn:{backgroundColor:C.primary,borderColor:C.primary},motionIcon:{fontSize:16,color:'#fff'},motionChoiceT:{flex:1,fontFamily:F.bodyM,fontSize:10.5,lineHeight:14,color:C.line},
  motionGenerate:{height:46,borderRadius:13,backgroundColor:C.primary,alignItems:'center',justifyContent:'center',marginTop:12},motionGenerateT:{fontFamily:F.bodyB,fontSize:12.5,color:'#fff'},motionWait:{fontFamily:F.body,fontSize:10.5,lineHeight:16,color:'rgba(255,255,255,0.70)',textAlign:'center',marginTop:8},motionOffline:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:'rgba(255,255,255,0.72)',marginTop:8},motionError:{fontFamily:F.bodyM,fontSize:11,lineHeight:16,color:'#FFB4B4',marginTop:9,textAlign:'center'},
  videoWrap:{marginTop:12,borderRadius:14,overflow:'hidden',backgroundColor:'#090706'},video:{width:'100%',height:430},videoDone:{fontFamily:F.bodyB,fontSize:10.5,color:'#BEE3CB',padding:9,textAlign:'center'},
});
