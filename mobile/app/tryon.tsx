import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ResizeMode, Video } from 'expo-av';
import { Screen, Header, Btn } from '../components/ui';
import { useCatalog } from '../lib/data';
import { Product } from '../lib/catalog';
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
  const gpuScreenActive=useGpuFocus('tryon','browse');
  const params=useLocalSearchParams<{productId?:string;slug?:string;color?:string;size?:string}>();
  const router=useRouter();
  const {products}=useCatalog();
  const {addToCart,showToast}=useStore();
  const productId=one(params.productId)||one(params.slug)||'haori-dang-dai';
  const product=products.find(p=>p.slug===productId||p.id===productId)||products[0];
  // Không tự bịa S–5XL cho sản phẩm thiếu size. Trường hợp đó vẫn được thử ảnh,
  // nhưng backend trả fit=unknown thay vì giả định size M.
  const tryonSizes=product.sizes?.filter(Boolean)||[];
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
  const [size,setSize]=useState(one(params.size)||tryonSizes[0]||'');
  const [color,setColor]=useState(one(params.color)||'Mực');
  const [selectedAccessories,setSelectedAccessories]=useState<string[]>([]);
  const [showAccessories,setShowAccessories]=useState(false);
  const [result,setResult]=useState('');
  const [resultEngine,setResultEngine]=useState('');
  const [sizeFit,setSizeFit]=useState<SizeFit|null>(null);
  const [fitEffect,setFitEffect]=useState<FitEffect|null>(null);
  const [bodyAnalysis,setBodyAnalysis]=useState<BodyAnalysis|null>(null);
  const [bodyLoading,setBodyLoading]=useState(false);
  const [bodyError,setBodyError]=useState('');
  const [usingEstimate,setUsingEstimate]=useState(false);
  const [adultConsent,setAdultConsent]=useState(false);
  const [safety,setSafety]=useState<TryOnSafety|null>(null);
  const [safetyError,setSafetyError]=useState<{code:string;message:string}|null>(null);
  const [message,setMessage]=useState(DEFAULT_TRYON_MESSAGE);
  const [error,setError]=useState('');
  const [warning,setWarning]=useState('');
  const [loading,setLoading]=useState(false);
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
    if(tryonSizes.length&&!tryonSizes.includes(size))setSize(tryonSizes[0]);
    if(!tryonSizes.length&&size)setSize('');
  },[product.slug,tryonSizes.join('|')]);

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
    setPhoto(picked);setResult('');setResultEngine('');setSizeFit(null);setFitEffect(null);setWarning('');setMotionVideo('');setMotionPanel(false);setMotionError('');
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
  const runBodyAnalysis=async(imageBase64:string)=>{
    if(!imageBase64)return;
    setBodyLoading(true);setBodyError('');
    try{
      const analysis=await analyzeBodyFromPhoto({personImageBase64:imageBase64,productId:product.slug});
      if(!analysis.ok)throw new Error(analysis.message||'Không phân tích được vóc dáng.');
      setBodyAnalysis(analysis);
      const height=analysis.estimatedHeight?.source==='user_provided'?null:analysis.estimatedHeight?.valueCm;
      const weight=analysis.estimatedWeight?.source==='user_provided'?null:analysis.estimatedWeight?.valueKg;
      if(height||weight){
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
        setMessage(`AI đã tự ước lượng vóc dáng${analysis.recommendedSize?` và suy ra cỡ phù hợp ${analysis.recommendedSize}`:''}. Hãy chọn bất kỳ size nào để xem quần áo chật, vừa hay rộng trên chính cơ thể trong ảnh.`);
      }
    }catch(e:any){
      setBodyAnalysis(null);
      setBodyError(e?.message||'Không phân tích được vóc dáng từ ảnh này.');
    }finally{setBodyLoading(false);}
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
    if(bodyAnalysis?.recommendedSize)setSize(bodyAnalysis.recommendedSize);
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
    const fallback=tryonSizes.length
      ? [...tryonSizes].sort((a,b)=>Math.abs(order.indexOf(a)-order.indexOf(ideal))-Math.abs(order.indexOf(b)-order.indexOf(ideal)))[0]
      : '';
    try{
      const saved=await saveStyleProfile(profile);
      const advice=await getSizeAdvice({productId:product.slug,profile:saved,selectedSize:size});
      const next=advice.size||fallback;setSize(next);setMessage(advice.advice||`Theo số đo đã nhập, kích cỡ ${next} là lựa chọn gần nhất.`);
    }catch(e:any){setSize(fallback);setMessage(`Tạm tính theo chiều cao và cân nặng: kích cỡ ${fallback}. ${e?.message||''}`.trim());}
    finally{setSizeLoading(false);}
  };

  const clearGeneratedResult=(nextMessage='Đã thay đổi lựa chọn. Bấm Tạo ảnh thử đồ để tạo kết quả mới.')=>{
    setResult('');setResultEngine('');setWarning('');setSizeFit(null);setFitEffect(null);setSafety(null);setSafetyError(null);
    setMotionVideo('');setMotionPanel(false);setMotionError('');
    setMessage(nextMessage);
  };
  const toggleAccessory=(slug:string)=>{
    if(loading)return;
    if(selectedAccessories.includes(slug)){
      clearGeneratedResult();
      setSelectedAccessories(old=>old.filter(x=>x!==slug));
      return;
    }
    if(selectedAccessories.length>=3){
      Alert.alert('Tối đa 3 phụ kiện','Hãy bỏ một món đang chọn trước. Giới hạn này giúp AI giữ đúng vị trí và không trả ảnh phụ kiện dán thô.');
      return;
    }
    clearGeneratedResult();
    setSelectedAccessories(old=>[...old,slug]);
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
  };

  const needsAdultConsent=useMemo(
    ()=>chosenGarments.some(item=>isAdultOnlyGarment(item as any)),
    [chosenGarments],
  );

  const run=async()=>{
    if(!photo){Alert.alert('Thiếu ảnh người','Hãy chụp hoặc chọn ảnh của bạn trước.');return;}
    if(needsAdultConsent&&!adultConsent){
      // Không gửi ảnh đi khi chưa có xác nhận — ảnh không rời máy vô ích.
      setSafetyError({code:'ADULT_CONSENT_REQUIRED',
        message:'Trang phục này chỉ dành cho người từ 18 tuổi. Hãy xác nhận ở ô bên dưới trước khi tạo ảnh.'});
      return;
    }
    if(outfitConflict){setShowGarments(true);setError(`${outfitConflict} Hãy bỏ món bị trùng rồi tạo lại ảnh.`);return;}
    const pickedNames=accessories.filter(item=>selectedAccessories.includes(item.slug)).map(item=>item.name);
    setLoading(true);setError('');setWarning('');setMessage(`Đang tạo ảnh chất lượng cao bằng GPU (thường 40–60 giây): nhận diện đúng người, mặc ${chosenGarments.length>1?`lần lượt ${chosenGarments.map(item=>item.name).join(' rồi ')}`:'trang phục'}${pickedNames.length?`, rồi ghép ${pickedNames.join(', ')}`:''} và kiểm tra lại mặt, cơ thể, độ nét…`);
    await reportGpuFocus('tryon');
    // Đánh dấu "đang chạy" để tín hiệu focus nền không huỷ mất tác vụ này khi
    // màn hình tự tắt hoặc người dùng kéo thanh thông báo (xem lib/useGpuFocus).
    beginGpuJob();
    try{
      const saved=await saveStyleProfile(profile);
      const output=await generateTryOn({
        personImageBase64:photo.base64,
        productId:product.slug,
        productIds:chosenGarments.map(item=>item.slug),
        productImageKey:product.imageKeys?.[0]||'',
        color,size,accessoryIds:selectedAccessories,profile:saved,
        // Backend mới là nơi quyết định; đây chỉ là xác nhận của người dùng.
        adultConsent,
        measurementMode:usingEstimate?'image':'user',
        qualityMode:'high',
        bodyAnalysisCache:bodyAnalysis||undefined,
        skipBodyAnalysis:Boolean(bodyAnalysis),
      });
      if(!output.imageUrl)throw new Error(output.message||'Backend chưa trả ảnh kết quả.');
      setResult(output.imageUrl);setResultEngine(output.engine||'ai-gateway');setMessage(output.message);
      setWarning(output.warning
        || (output.skippedAccessories.length?`Chưa ghép tự nhiên được phụ kiện: ${output.skippedAccessories.join(', ')}. Ảnh quần áo sạch đã được giữ lại.`:'')
        || (output.skippedGarments.length?`Chưa ghép được: ${output.skippedGarments.join(', ')}.`:''));
      setSizeFit(output.sizeFit&&output.sizeFit.verdict!=='unknown'?output.sizeFit:null);
      setFitEffect(output.fitEffect||null);
      setSafety(output.safety||null);
      setSafetyError(null);
      if(output.bodyAnalysis)setBodyAnalysis(current=>({...(current||{} as BodyAnalysis),...output.bodyAnalysis!}));
      setMotionVideo('');setMotionError('');
      Alert.alert(
        '✦ Làm ảnh thử đồ sống động?',
        'Bạn có muốn dùng AI local để nhân vật đi, xoay, nhảy hoặc khoe dáng với bộ đồ vừa thử không?',
        [{text:'Để sau',style:'cancel'},{text:'Chọn chuyển động',onPress:()=>setMotionPanel(true)}],
      );
    }catch(e:any){
      setResult('');setResultEngine('');setSizeFit(null);setFitEffect(null);
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
      if(gpuScreenActive.current)void reportGpuFocus('tryon');
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
      if(gpuScreenActive.current)void reportGpuFocus('tryon');
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
          {!!result&&!!sizeFit&&!!FIT_UI[sizeFit.verdict]&&(
            <View style={[st.fitBadge,FIT_UI[sizeFit.verdict].tone==='good'?st.fitBadgeGood:FIT_UI[sizeFit.verdict].tone==='tight'?st.fitBadgeTight:st.fitBadgeLoose]}>
              <Text style={st.fitBadgeT}>FIT: {FIT_UI[sizeFit.verdict].badge}</Text>
            </View>
          )}
          {loading&&<View style={st.loading}><ActivityIndicator color="#fff" size="large" /><Text style={st.loadingT}>Đang tạo ảnh…</Text></View>}
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
            {!!sizeFit.recommended&&sizeFit.verdict!=='good'&&(
              <Pressable style={st.fitBtn} onPress={()=>{setSize(sizeFit.recommended!);clearGeneratedResult(`Đã đổi sang cỡ ${sizeFit.recommended}. Bấm Tạo ảnh thử đồ để xem lại độ vừa vặn.`);}}>
                <Text style={st.fitBtnT}>Dùng cỡ {sizeFit.recommended}</Text>
              </Pressable>
            )}
          </View>
        )}
        <View style={st.pickRow}>
          <Pressable style={st.pick} onPress={()=>void choose(true)}><Text style={st.pickT}>📷 Chụp ảnh</Text></Pressable>
          <Pressable style={st.pick} onPress={()=>void choose(false)}><Text style={st.pickT}>▧ Chọn ảnh</Text></Pressable>
        </View>
        <Text style={st.tip}>Ảnh có dáng phù hợp sẽ được ghép trang phục ngay để nhanh và nhẹ hơn. Hệ thống chỉ chỉnh tư thế khi tay, đồ vật hoặc góc chụp che vùng cần mặc; người khác trong ảnh được giữ nguyên.</Text>

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
                <View style={st.bodyRow}>
                  <Text style={st.bodyLabel}>{bodyAnalysis.estimatedHeight?.source==='user_provided'?'Chiều cao bạn đã nhập':'Chiều cao AI ước lượng'}</Text>
                  <Text style={st.bodyValue}>
                    {rangeText(bodyAnalysis.estimatedHeight?.minCm,bodyAnalysis.estimatedHeight?.maxCm,'cm')||'Không đủ dữ liệu'}
                  </Text>
                </View>
                <View style={st.bodyRow}>
                  <Text style={st.bodyLabel}>{bodyAnalysis.estimatedWeight?.source==='user_provided'?'Cân nặng bạn đã nhập':'Cân nặng AI ước lượng'}</Text>
                  <Text style={st.bodyValue}>
                    {rangeText(bodyAnalysis.estimatedWeight?.minKg,bodyAnalysis.estimatedWeight?.maxKg,'kg')||'Không đủ dữ liệu'}
                  </Text>
                </View>
                <View style={st.bodyRow}>
                  <Text style={st.bodyLabel}>Vòng ngực AI ước lượng</Text>
                  <Text style={st.bodyValue}>
                    {rangeText(bodyAnalysis.estimatedGirthRanges?.bust?.minCm,bodyAnalysis.estimatedGirthRanges?.bust?.maxCm,'cm')||'Không đủ dữ liệu'}
                  </Text>
                </View>
                <View style={st.bodyRow}>
                  <Text style={st.bodyLabel}>Vòng eo AI ước lượng</Text>
                  <Text style={st.bodyValue}>
                    {rangeText(bodyAnalysis.estimatedGirthRanges?.waist?.minCm,bodyAnalysis.estimatedGirthRanges?.waist?.maxCm,'cm')||'Không đủ dữ liệu'}
                  </Text>
                </View>
                <View style={st.bodyRow}>
                  <Text style={st.bodyLabel}>Vòng hông AI ước lượng</Text>
                  <Text style={st.bodyValue}>
                    {rangeText(bodyAnalysis.estimatedGirthRanges?.hip?.minCm,bodyAnalysis.estimatedGirthRanges?.hip?.maxCm,'cm')||'Không đủ dữ liệu'}
                  </Text>
                </View>
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
                  {'\n'}Mỗi khoảng hiển thị rộng đúng 10 đơn vị. Vòng ngực và vòng eo được suy theo đường viền người cùng quần áo trong ảnh, không phải số đo bằng thước.
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

        <Text style={st.section}>Số đo và gợi ý kích cỡ</Text>
        {usingEstimate&&<Text style={st.estimateTag}>Số liệu bên dưới là ƯỚC LƯỢNG của AI từ ảnh, không phải số đo thật — sửa lại nếu bạn biết số chính xác.</Text>}
        <View style={st.measureRow}>
          <Measure label="Chiều cao" value={effectiveMeasurement('height')} onChange={v=>updateProfile('height',v)} unit="cm" />
          <Measure label="Cân nặng" value={effectiveMeasurement('weight')} onChange={v=>updateProfile('weight',v)} unit="kg" />
        </View>
        {tryonSizes.length
          ? <View style={st.sizeRow}>{tryonSizes.map(v=><Pressable key={v} style={[st.size,size===v&&st.sizeOn]} onPress={()=>setSize(v)}><Text style={[st.sizeT,size===v&&{color:'#fff'}]}>{v}</Text></Pressable>)}</View>
          : <Text style={st.estimateTag}>Sản phẩm không khai báo size: chỉ thử hình ảnh, không kết luận chật/rộng và không tự chọn size M.</Text>}
        <Btn label={sizeLoading?'Đang tính kích cỡ…':'Gợi ý kích cỡ cho tôi'} variant="ghost" onPress={()=>{if(!sizeLoading)void adviseSize();}} />

        <Text style={st.section}>Màu trang phục</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{['Mực','Đỏ son','Chàm','Xanh trà','Vàng kim'].map(v=><Pressable key={v} style={[st.pill,color===v&&st.pillOn]} onPress={()=>setColor(v)}><Text style={[st.pillT,color===v&&{color:'#fff'}]}>{v}</Text></Pressable>)}</ScrollView>

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
        <Btn label={loading?'Đang tạo ảnh…':result?'Tạo lại ảnh thử đồ':'Tạo ảnh thử đồ'} style={{marginTop:12}} onPress={()=>{if(!loading)void run();}} />
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
  productThumb:{width:46,height:56,borderRadius:9},productName:{fontFamily:F.bodyB,fontSize:13,color:C.ink},productMeta:{fontFamily:F.body,fontSize:11.5,color:C.muted,marginTop:2},change:{fontFamily:F.bodyB,fontSize:11,color:C.ink},
  result:{borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:C.line,position:'relative'},tag:{position:'absolute',top:10,left:10,zIndex:5,elevation:5,backgroundColor:C.primary,paddingVertical:4,paddingHorizontal:8,borderRadius:8},tagT:{color:'#fff',fontFamily:F.bodyX,fontSize:10},
  loading:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(26,20,16,.55)',alignItems:'center',justifyContent:'center',gap:8},loadingT:{color:'#fff',fontFamily:F.bodyB,fontSize:12},
  pickRow:{flexDirection:'row',gap:10,marginVertical:10},pick:{flex:1,borderWidth:1,borderColor:C.line,borderRadius:11,paddingVertical:10,alignItems:'center',backgroundColor:'#fff'},pickT:{fontFamily:F.bodyB,fontSize:12,color:C.ink},
  fitBanner:{borderRadius:13,borderWidth:1,padding:12,marginTop:10},
  fitTight:{backgroundColor:'#FCE8E8',borderColor:'#EBC4C4'},fitLoose:{backgroundColor:C.warningSoft,borderColor:C.line},fitGood:{backgroundColor:'#E4F5E9',borderColor:'#BEE3CB'},
  fitTitle:{fontFamily:F.bodyX,fontSize:12.5,color:C.ink},fitMsg:{fontFamily:F.body,fontSize:11.5,lineHeight:17,color:C.ink,marginTop:4},
  fitBtn:{alignSelf:'flex-start',backgroundColor:C.sumi,borderRadius:9,paddingVertical:7,paddingHorizontal:12,marginTop:8},fitBtnT:{color:'#fff',fontFamily:F.bodyB,fontSize:11.5},
  fitNote:{fontFamily:F.body,fontSize:10.5,lineHeight:15.5,color:C.muted,marginTop:6},
  fitBadge:{position:'absolute',right:10,top:10,borderRadius:8,paddingHorizontal:9,paddingVertical:5,borderWidth:1},
  fitBadgeT:{fontFamily:F.bodyB,fontSize:10.5,color:'#fff',letterSpacing:.6},
  fitBadgeTight:{backgroundColor:'rgba(178,52,52,0.92)',borderColor:'rgba(255,255,255,0.5)'},
  fitBadgeLoose:{backgroundColor:'rgba(176,120,32,0.92)',borderColor:'rgba(255,255,255,0.5)'},
  fitBadgeGood:{backgroundColor:'rgba(44,120,72,0.92)',borderColor:'rgba(255,255,255,0.5)'},
  bodyCard:{marginTop:14,borderRadius:14,borderWidth:1,borderColor:C.line,backgroundColor:'#fff',padding:13},
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
  bodyBtn:{flex:1,height:40,borderRadius:10,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center',backgroundColor:'#fff'},
  bodyBtnT:{fontFamily:F.bodyB,fontSize:11.5,color:C.ink},
  bodyBtnMain:{backgroundColor:C.sumi,borderColor:C.sumi},
  bodyBtnMainT:{fontFamily:F.bodyB,fontSize:11.5,color:'#fff'},
  bodyBtnOn:{backgroundColor:C.primary,borderColor:C.primary},
  estimateTag:{fontFamily:F.body,fontSize:10.5,lineHeight:15.5,color:C.ai,marginBottom:8},
  consentCard:{marginTop:12,borderRadius:14,borderWidth:1,borderColor:C.line,backgroundColor:'#FFF9F0',padding:13},
  consentTitle:{fontFamily:F.bodyB,fontSize:12.5,color:C.ink},
  consentBody:{fontFamily:F.body,fontSize:11.5,lineHeight:17,color:C.muted,marginTop:6},
  consentRow:{flexDirection:'row',alignItems:'center',gap:9,marginTop:11},
  checkbox:{width:22,height:22,borderRadius:6,borderWidth:1.5,borderColor:C.line,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},
  checkboxOn:{backgroundColor:C.primary,borderColor:C.primary},
  consentCheck:{flex:1,fontFamily:F.bodyM,fontSize:11.5,lineHeight:17,color:C.ink},
  safetyBanner:{marginTop:11,borderRadius:13,borderWidth:1,borderColor:'#E7C0C0',backgroundColor:'#FCEDED',padding:12},
  safetyTitle:{fontFamily:F.bodyB,fontSize:12.5,color:'#8E2B2B'},
  safetyMsg:{fontFamily:F.body,fontSize:11.5,lineHeight:17,color:'#7A3A3A',marginTop:5},
  coverageNote:{marginTop:10,borderRadius:12,borderWidth:1,borderColor:C.line,backgroundColor:'#fff',padding:11},
  coverageT:{fontFamily:F.body,fontSize:11,lineHeight:16.5,color:C.muted},
  section:{fontFamily:F.bodyB,fontSize:13,color:C.ink,marginTop:15,marginBottom:8},measureRow:{flexDirection:'row',gap:10},measureLabel:{fontFamily:F.bodyM,fontSize:10.5,color:C.muted,marginBottom:4},measure:{height:44,flexDirection:'row',alignItems:'center',backgroundColor:'#fff',borderWidth:1,borderColor:C.line,borderRadius:11,paddingHorizontal:10},measureInput:{flex:1,fontFamily:F.bodyB,fontSize:13,color:C.ink},unit:{fontFamily:F.body,fontSize:11,color:C.muted},
  sizeRow:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:10},size:{width:'22%',minWidth:62,height:38,borderRadius:9,borderWidth:1,borderColor:C.line,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},sizeOn:{backgroundColor:C.sumi,borderColor:C.sumi},sizeT:{fontFamily:F.bodyB,fontSize:12,color:C.ink},
  pill:{borderWidth:1,borderColor:C.line,borderRadius:999,paddingVertical:8,paddingHorizontal:13,backgroundColor:'#fff'},pillOn:{backgroundColor:C.primary,borderColor:C.primary},pillT:{fontFamily:F.bodyM,fontSize:11.5,color:C.ink},
  acc:{width:88},accImg:{width:88,height:88,borderRadius:12,borderWidth:2,borderColor:'transparent'},accOn:{borderColor:C.primary},accCheck:{position:'absolute',right:5,top:5,width:22,height:22,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:C.primary,borderWidth:2,borderColor:'#fff'},accCheckT:{color:'#fff',fontFamily:F.bodyB,fontSize:11},zoneTag:{position:'absolute',left:4,bottom:4,backgroundColor:'rgba(26,20,16,.78)',borderRadius:5,paddingHorizontal:5,paddingVertical:2},zoneTagT:{color:'#fff',fontFamily:F.bodyB,fontSize:8.5},spotTitle:{fontFamily:F.bodyB,fontSize:11,color:C.muted,letterSpacing:.6,textTransform:'uppercase',marginBottom:6},zoneHint:{fontFamily:F.bodyM,fontSize:11.5,lineHeight:17,color:C.ai,marginBottom:9},conflict:{fontFamily:F.bodyM,fontSize:11.5,lineHeight:17,color:C.ink,marginTop:6},accT:{fontFamily:F.bodyM,fontSize:10.5,color:C.ink,marginTop:4},selectedAcc:{fontFamily:F.bodyB,fontSize:11,color:C.ink,marginTop:9},
  tip:{fontFamily:F.body,fontSize:11,lineHeight:16,color:C.muted,marginTop:2,backgroundColor:C.washi2,borderRadius:9,padding:9},
  accHeader:{flexDirection:'row',alignItems:'center',marginTop:15},
  expBadge:{fontFamily:F.bodyX,fontSize:9,color:C.muted},
  accHint:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:C.muted,marginTop:2},
  accWarn:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:C.warning,backgroundColor:C.warningSoft,borderRadius:9,padding:9,marginTop:8,marginBottom:8},
  message:{fontFamily:F.body,fontSize:11.5,lineHeight:18,color:C.muted,marginTop:8,textAlign:'center'},
  errBanner:{backgroundColor:'#FCE8E8',borderWidth:1,borderColor:'#EBC4C4',borderRadius:13,padding:13,marginTop:10},
  errTitle:{fontFamily:F.bodyX,fontSize:13,color:C.shuDeep},errMsg:{fontFamily:F.body,fontSize:12,lineHeight:18,color:C.ink,marginTop:5},errTips:{fontFamily:F.body,fontSize:11,lineHeight:16,color:C.muted,marginTop:8},
  warnBanner:{backgroundColor:C.warningSoft,borderWidth:1,borderColor:C.line,borderRadius:13,padding:13,marginTop:10},warnTitle:{fontFamily:F.bodyX,fontSize:13,color:C.warning},warnMsg:{fontFamily:F.body,fontSize:11.5,lineHeight:17,color:C.ink,marginTop:4},
  resultActions:{flexDirection:'row',gap:8,marginTop:10},action:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingVertical:10,borderRadius:11,borderWidth:1,borderColor:C.line,backgroundColor:'#fff'},actionT:{fontFamily:F.bodyB,fontSize:11.5,color:C.ink},
  videoActions:{flexDirection:'row',gap:8,paddingHorizontal:9,paddingBottom:9},videoAction:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingVertical:9,borderRadius:10,borderWidth:1,borderColor:C.muted,backgroundColor:C.ink},videoActionT:{fontFamily:F.bodyB,fontSize:11.5,color:'#fff'},
  motionCard:{backgroundColor:C.sumi,borderWidth:1,borderColor:C.kin,borderRadius:18,padding:14,marginTop:12},
  motionHead:{flexDirection:'row',alignItems:'center',gap:10},motionMark:{width:43,height:43,borderRadius:13,backgroundColor:C.primary,alignItems:'center',justifyContent:'center'},motionMarkT:{fontFamily:F.display,fontSize:20,color:'#fff'},
  motionTitle:{fontFamily:F.display,fontSize:14,color:'#fff'},motionSub:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:'rgba(255,255,255,0.70)',marginTop:2},motionToggle:{borderWidth:1,borderColor:'rgba(255,255,255,0.72)',borderRadius:999,paddingVertical:7,paddingHorizontal:10},motionToggleT:{fontFamily:F.bodyB,fontSize:10.5,color:'rgba(255,255,255,0.72)'},
  motionPrompt:{fontFamily:F.bodyB,fontSize:12,color:'#fff',marginBottom:8},motionGrid:{flexDirection:'row',flexWrap:'wrap',gap:7},motionChoice:{width:'48%',minHeight:48,borderWidth:1,borderColor:'#665C54',borderRadius:11,paddingHorizontal:9,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'#2B241F'},motionChoiceOn:{backgroundColor:C.primary,borderColor:C.primary},motionIcon:{fontSize:16,color:'#fff'},motionChoiceT:{flex:1,fontFamily:F.bodyM,fontSize:10.5,lineHeight:14,color:C.line},
  motionGenerate:{height:46,borderRadius:13,backgroundColor:C.primary,alignItems:'center',justifyContent:'center',marginTop:12},motionGenerateT:{fontFamily:F.bodyB,fontSize:12.5,color:'#fff'},motionWait:{fontFamily:F.body,fontSize:10.5,lineHeight:16,color:'rgba(255,255,255,0.70)',textAlign:'center',marginTop:8},motionOffline:{fontFamily:F.body,fontSize:10.5,lineHeight:15,color:'rgba(255,255,255,0.72)',marginTop:8},motionError:{fontFamily:F.bodyM,fontSize:11,lineHeight:16,color:'#FFB4B4',marginTop:9,textAlign:'center'},
  videoWrap:{marginTop:12,borderRadius:14,overflow:'hidden',backgroundColor:'#090706'},video:{width:'100%',height:430},videoDone:{fontFamily:F.bodyB,fontSize:10.5,color:'#BEE3CB',padding:9,textAlign:'center'},
});
