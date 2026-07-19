import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, F, money } from '../theme/tokens';
import { useCatalog } from '../lib/data';
import { SmartImage } from './SmartImage';
import { GasshoVillage } from './art';

const STORAGE_KEY='@japano/daily-japan-spot/v4';
type PhotoSpot={name:string;tip:string};
type JapanSpot={
  place:string;region:string;time:string;tip:string;slug:string;where:string;history:string;
  highlights:string[];photoSpots:PhotoSpot[];access:string;mapQuery:string;sourceLabel:string;sourceUrl:string;
};
const SPOTS=[
  {place:'Rừng tre Arashiyama',region:'Kyoto',time:'Sáng sớm · 07:00–09:00',tip:'Lối tre xanh tạo chiều sâu rất đẹp cho ảnh toàn thân.',slug:'kimono-hong',where:'Khu Sagano, quận Ukyō, phía tây Kyoto; gần chùa Tenryū-ji và ga Arashiyama.',history:'Rừng tre nằm trong vùng thắng cảnh Arashiyama–Sagano, nơi giới quý tộc thời Heian từng đến thưởng ngoạn. Tre cũng gắn với thủ công và kiến trúc truyền thống Kyoto.',highlights:['Lối tre cao khép vòm, tiếng lá và ánh sáng lọc tạo không gian rất đặc trưng.','Có thể nối tuyến đi bộ với Tenryū-ji, cầu Togetsukyō và khu Sagano.'],photoSpots:[{name:'Lối tre chính',tip:'Đứng lệch tâm, dùng đường mòn làm đường dẫn; đến sớm để nền ít người.'},{name:'Nonomiya-jinja',tip:'Cổng torii đen và rêu xanh hợp ảnh bán thân, trang phục truyền thống.'},{name:'Cầu Togetsukyō',tip:'Lấy cầu, sông Katsura và sườn núi thành ba lớp hậu cảnh.'}],access:'Từ ga JR Saga-Arashiyama đi bộ khoảng 10–15 phút.',mapQuery:'Arashiyama Bamboo Forest Kyoto',sourceLabel:'Kyoto City Official Travel Guide',sourceUrl:'https://kyoto.travel/en/other_attractions/119.html'},
  {place:'Đền Fushimi Inari',region:'Kyoto',time:'Sáng sớm · trước 08:00',tip:'Hàng nghìn cổng torii đỏ hợp trang phục truyền thống.',slug:'yukata-xanh',where:'Quận Fushimi, phía nam Kyoto, ngay cạnh ga JR Inari; lối hành hương kéo dài lên núi Inari.',history:'Đền có nguồn gốc từ thế kỷ VIII và là trung tâm thờ Inari, vị thần gắn với lúa gạo rồi mở rộng thành biểu tượng của thịnh vượng và kinh doanh.',highlights:['Senbon Torii tạo hành lang cổng son dày đặc lên sườn núi.','Tượng cáo kitsune là sứ giả của Inari; toàn bộ vòng núi cần khoảng 2–3 giờ.'],photoSpots:[{name:'Senbon Torii',tip:'Chụp lệch tâm ở đoạn cổng dày để tăng chiều sâu.'},{name:'Rōmon Gate',tip:'Góc chính diện cân xứng đẹp nhất vào sáng sớm.'},{name:'Yotsutsuji',tip:'Đi cao hơn để lấy toàn cảnh phía nam Kyoto.'}],access:'JR Nara Line đến ga Inari; đền ở ngay phía trước ga.',mapQuery:'Fushimi Inari Taisha Kyoto',sourceLabel:'Kyoto City Official Travel Guide',sourceUrl:'https://kyoto.travel/en/destinations/fushimi-inaritaisha-shrine/'},
  {place:'Phố cổ Gion',region:'Kyoto',time:'Chiều vàng · 16:30–18:00',tip:'Nhà machiya và ngõ lát đá cho khung hình Nhật cổ.',slug:'haori-dang-dai',where:'Bờ đông sông Kamo, quanh đại lộ Shijō, Hanamikoji và khu Shirakawa của Kyoto.',history:'Gion phát triển từ khu phục vụ người hành hương đến Yasaka-jinja; về sau nổi tiếng với các ochaya và văn hóa biểu diễn của geiko, maiko.',highlights:['Nhà machiya gỗ, rèm noren và đèn lồng tạo cảnh quan đô thị cổ.','Đây vẫn là khu dân cư và làm việc; cần tránh chụp người khi chưa xin phép.'],photoSpots:[{name:'Gion Shirakawa',tip:'Chụp bên kênh, cầu Tatsumi và hàng liễu lúc chiều vàng.'},{name:'Hanamikoji',tip:'Lấy mặt tiền machiya; đứng ở khu vực công cộng và không cản lối.'},{name:'Yasaka-jinja',tip:'Cổng son và đèn lồng đẹp khi chuyển từ chiều sang tối.'}],access:'Đi bộ từ ga Gion-Shijō hoặc trạm xe buýt Gion.',mapQuery:'Gion Shirakawa Kyoto',sourceLabel:'Kyoto City Official Travel Guide',sourceUrl:'https://kyoto.travel/en/see-and-do/gion.html'},
  {place:'Hồ Kawaguchi',region:'Yamanashi',time:'Bình minh · trời quang',tip:'Chụp cùng núi Phú Sĩ và mặt hồ phản chiếu.',slug:'cardigan-dai',where:'Thị trấn Fujikawaguchiko, tỉnh Yamanashi, phía bắc núi Phú Sĩ; thuộc vùng Ngũ Hồ Phú Sĩ.',history:'Kawaguchi là hồ dễ tiếp cận nhất trong Ngũ Hồ và trở thành điểm ngắm Phú Sĩ tiêu biểu nhờ bờ bắc mở rộng, cảnh quan thay đổi rõ theo mùa.',highlights:['Mặt hồ cho ảnh phản chiếu Phú Sĩ khi trời trong và ít gió.','Bờ bắc nổi bật với hoa anh đào, oải hương và lá đỏ theo mùa.'],photoSpots:[{name:'Công viên Oishi',tip:'Dùng dải hoa tiền cảnh, hồ ở trung cảnh và Phú Sĩ phía sau.'},{name:'Bờ bắc Ubuyagasaki',tip:'Sáng sớm dễ có phản chiếu và ánh sáng mềm.'},{name:'Cầu Kawaguchiko-ohashi',tip:'Chọn điểm ven bờ để lấy cầu dẫn mắt về phía núi.'}],access:'Xe buýt từ ga Kawaguchiko chạy vòng hồ; Oishi nằm trên tuyến Red Line.',mapQuery:'Lake Kawaguchi Oishi Park',sourceLabel:'Fujikawaguchiko Tourism',sourceUrl:'https://fujisan.ne.jp/en/'},
  {place:'Công viên Nara',region:'Nara',time:'Sáng · 08:00–10:00',tip:'Ánh sáng mềm, bãi cỏ rộng và những chú hươu thân thiện.',slug:'kimono-hong',where:'Trung tâm Nara, trải từ khu Kōfuku-ji qua bảo tàng đến Tōdai-ji và chân núi Wakakusa.',history:'Không gian công viên hình thành quanh các đền chùa cổ của cố đô Nara. Hươu được tôn trọng lâu đời như sứ giả thần linh của Kasuga Taisha.',highlights:['Hươu đi lại tự do giữa bãi cỏ và các di tích lịch sử.','Có thể kết hợp Tōdai-ji, Kasuga Taisha và núi Wakakusa trong một tuyến đi bộ.'],photoSpots:[{name:'Ukimidō',tip:'Chụp nhà thủy tạ phản chiếu trên ao Sagiike vào sáng sớm.'},{name:'Đường vào Kasuga Taisha',tip:'Đèn đá phủ rêu tạo nhịp ảnh sâu trong rừng.'},{name:'Chân núi Wakakusa',tip:'Bãi cỏ rộng cho ảnh cùng hươu; giữ khoảng cách và không trêu chúng.'}],access:'Khoảng 5 phút đi bộ từ ga Kintetsu Nara.',mapQuery:'Nara Park Ukimido',sourceLabel:'Nara Park official guide',sourceUrl:'https://www3.pref.nara.jp/park/'},
  {place:'Đài quan sát Shibuya',region:'Tokyo',time:'Hoàng hôn · đặt giờ trước',tip:'Đường chân trời Tokyo hợp với bộ trang phục hiện đại, sắc nét.',slug:'blazer-kaki',where:'SHIBUYA SKY trên nóc Shibuya Scramble Square, nối trực tiếp với ga Shibuya, Tokyo.',history:'Đài quan sát mở năm 2019 trong dự án tái phát triển Shibuya, đưa góc nhìn 360° lên một trong những nút giao biểu tượng của Tokyo.',highlights:['Sân thượng mở nhìn thấy giao lộ Shibuya, Tokyo Tower và xa hơn khi trời quang.','Vé theo khung giờ; vật dụng rời bị hạn chế trên sân thượng vì gió.'],photoSpots:[{name:'Sky Edge',tip:'Góc kính sát biên tạo cảm giác thành phố mở rộng phía dưới.'},{name:'Crossing View',tip:'Chụp giao lộ từ trên cao sau khi đèn đường bật.'},{name:'Cloud Hammock',tip:'Ảnh hướng lên trời đẹp lúc chuyển màu hoàng hôn.'}],access:'Lối vào tầng 14 Shibuya Scramble Square; nên đặt vé giờ hoàng hôn trước.',mapQuery:'SHIBUYA SKY',sourceLabel:'SHIBUYA SKY official',sourceUrl:'https://www.shibuya-scramble-square.com/sky/'},
  {place:'Omoide Yokocho',region:'Tokyo',time:'Tối · sau 19:00',tip:'Đèn lồng và biển hiệu nhỏ tạo chất điện ảnh đường phố.',slug:'dong-phuc-thuy-thu',where:'Cửa tây ga Shinjuku, Tokyo; mê cung ngõ nhỏ nằm sát đường ray và khu phố thương mại.',history:'Khu quán bắt đầu từ chợ đen sau Thế chiến II, rồi phát triển thành dãy quán yakitori và izakaya nhỏ mang diện mạo Shōwa.',highlights:['Ngõ rất hẹp, khói bếp và đèn lồng cho không khí điện ảnh.','Không gian kinh doanh thực; cần hỏi trước khi chụp cận quán hoặc khách.'],photoSpots:[{name:'Lối vào phía nam',tip:'Lấy biển hiệu và đường ngõ hội tụ; dùng tiêu cự vừa để không chắn lối.'},{name:'Ngõ đèn lồng',tip:'Đo sáng theo vùng sáng để giữ màu đèn và khói bếp.'},{name:'Cửa quán yakitori',tip:'Xin phép trước, ưu tiên ảnh chi tiết thay vì chụp mặt khách.'}],access:'Khoảng 2 phút đi bộ từ cửa Tây ga JR Shinjuku.',mapQuery:'Omoide Yokocho Shinjuku',sourceLabel:'GO TOKYO official guide',sourceUrl:'https://www.gotokyo.org/en/spot/73/index.html'},
  {place:'Kênh Otaru',region:'Hokkaido',time:'Chạng vạng · trước khi đèn sáng',tip:'Kho đá, đèn vàng và tuyết tạo nền ảnh rất lãng mạn.',slug:'ao-len-co-lo',where:'Trung tâm thành phố cảng Otaru, Hokkaido, cách ga JR Otaru khoảng 10 phút đi bộ.',history:'Kênh hoàn thành đầu thế kỷ XX để chuyển hàng từ tàu lớn vào kho ven bờ. Khi cảng hiện đại hóa, một phần kênh được bảo tồn thành phố đi bộ.',highlights:['Kho gạch đá phản chiếu trên nước và đèn khí tạo nét cảng cổ.','Mùa đông có tuyết, nhưng mặt đường trơn; chạng vạng cân bằng được trời xanh và đèn vàng.'],photoSpots:[{name:'Asakusa Bridge',tip:'Góc kinh điển lấy đường cong kênh và dãy kho.'},{name:'Lối đi bờ đông',tip:'Dùng đèn khí làm nhịp dẫn dọc khung hình.'},{name:'Kho Otaru phía nam',tip:'Chụp chi tiết tường đá và tuyết để tạo chất cổ điển.'}],access:'Đi thẳng từ ga JR Otaru theo Chūō-dōri khoảng 10 phút.',mapQuery:'Otaru Canal Asakusa Bridge',sourceLabel:'Otaru Tourism Association',sourceUrl:'https://www.visit-otaru-en.info/'},
  {place:'Làng Shirakawa-go',region:'Gifu · vùng Hida',time:'Sáng sớm · đẹp quanh năm',tip:'Nhà mái tranh gasshō-zukuri và thung lũng sông Shō tạo nhiều lớp ảnh.',slug:'khoac-nhat',where:'Làng Ogimachi, xã Shirakawa, quận Ōno, phía tây bắc tỉnh Gifu; nằm trong thung lũng sông Shō giữa vùng núi Chūbu.',history:'Vùng núi từng biệt lập lâu dài, cư dân trồng dâu và nuôi tằm trong các nhà lớn. Mái tranh dốc thích nghi với tuyết dày; Ogimachi cùng Ainokura và Suganuma được UNESCO ghi danh năm 1995.',highlights:['“Gasshō” nghĩa là hai bàn tay chắp lại; mái dốc tạo khoảng áp mái lớn dùng cho nghề tằm.','Tinh thần “Yui” là việc cộng đồng chia sẻ lao động, rõ nhất khi cùng thay mái tranh. Hơn 100 công trình gasshō lớn nhỏ vẫn nằm trong một ngôi làng có người sinh sống.'],photoSpots:[{name:'Đài quan sát Shiroyama',tip:'Góc toàn cảnh tốt nhất: làng ở tiền cảnh, sông và núi ôm phía sau. Có đường đi bộ hoặc shuttle ban ngày.'},{name:'Nhà Wada',tip:'Chụp từ đường công cộng để lấy hàng rào, ruộng và mái tranh nhiều lớp; bên trong kể lịch sử nghề tằm.'},{name:'Cầu Deai-bashi',tip:'Dùng cầu treo làm đường dẫn khi bước từ bãi Seseragi vào làng; sáng sớm ánh sáng dịu.'},{name:'Các ngõ Ogimachi',tip:'Tìm kênh nước và ruộng làm tiền cảnh; không bước vào sân nhà dân hoặc dùng drone.'}],access:'Không có ga tàu. Xe buýt cao tốc: khoảng 50 phút từ Takayama hoặc 1 giờ 20 phút từ Kanazawa/Toyama; nên dành 2–3 giờ đi bộ.',mapQuery:'Shirakawa-go Ogimachi Gifu',sourceLabel:'UNESCO & Hiệp hội Du lịch Shirakawa-go',sourceUrl:'https://shirakawa-go.gr.jp/en/highlights/'},
  {place:'Công viên Hitachi Seaside',region:'Ibaraki',time:'Sáng ngày nắng nhẹ',tip:'Đồi hoa theo mùa tạo mảng màu rộng và trong trẻo.',slug:'yae-miko',where:'Thành phố Hitachinaka, tỉnh Ibaraki, ven Thái Bình Dương và cách Tokyo khoảng hai giờ.',history:'Khu đất được phát triển thành công viên quốc gia quy mô lớn; cảnh quan nổi tiếng nhờ các cánh đồng hoa được chăm theo mùa trên đồi Miharashi.',highlights:['Nemophila xanh vào mùa xuân và kochia chuyển đỏ vào mùa thu là hai cảnh quan biểu tượng.','Công viên rất rộng, có tuyến xe và xe đạp; lịch hoa thay đổi theo thời tiết từng năm.'],photoSpots:[{name:'Miharashi Hill',tip:'Chụp từ sườn thấp để hoa phủ kín nền và giữ đường chân trời sạch.'},{name:'Đường lên đồi',tip:'Dùng lối cong làm đường dẫn, tránh bước vào luống hoa.'},{name:'Dune Garden',tip:'Cỏ biển và ánh sáng ven bờ hợp ảnh tối giản, ít đông hơn đồi chính.'}],access:'Từ ga Katsuta đi xe buýt đến cổng Tây hoặc cổng Kaihin; kiểm tra lịch hoa trước chuyến đi.',mapQuery:'Hitachi Seaside Park Miharashi Hill',sourceLabel:'Hitachi Seaside Park official',sourceUrl:'https://hitachikaihin.jp/en/'},
] satisfies JapanSpot[];

function localDayKey(){
  const now=new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
function dayIndex(){
  const start=new Date(new Date().getFullYear(),0,0).getTime();
  return Math.floor((Date.now()-start)/86400000);
}

export function DailyJapanSpot(){
  const router=useRouter();
  const pathname=usePathname();
  const {products}=useCatalog();
  const [visible,setVisible]=useState(false);
  const suggestion=useMemo(()=>SPOTS[dayIndex()%SPOTS.length],[]);
  const product=products.find(item=>item.slug===suggestion.slug)||products[0];
  const blocked=['/onboarding','/login','/register','/checkout','/payment-result','/success'].some(path=>pathname.startsWith(path));

  useEffect(()=>{
    let live=true;
    if(blocked)return()=>{live=false;};
    const timer=setTimeout(()=>{
      void AsyncStorage.getItem(STORAGE_KEY).then(last=>{
        if(!live||last===localDayKey())return;
        return AsyncStorage.setItem(STORAGE_KEY,localDayKey()).then(()=>{if(live)setVisible(true);});
      }).catch(()=>undefined);
    },900);
    return()=>{live=false;clearTimeout(timer);};
  },[blocked,pathname]);

  if(!product)return null;
  const openProduct=()=>{setVisible(false);router.push(`/product/${product.slug}`);};
  const openMap=()=>{void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(suggestion.mapQuery)}`).catch(()=>undefined);};
  const openSource=()=>{void Linking.openURL(suggestion.sourceUrl).catch(()=>undefined);};
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={()=>setVisible(false)}>
    <View style={st.shade}><View style={st.card}>
      <Pressable style={st.close} hitSlop={10} onPress={()=>setVisible(false)}><Ionicons name="close" size={20} color="#fff"/></Pressable>
      <View style={st.hero}>
        {suggestion.place==='Làng Shirakawa-go'
          ? <View style={StyleSheet.absoluteFill}><GasshoVillage height={176}/></View>
          : <SmartImage source={product.images[0]} style={StyleSheet.absoluteFill as any} recyclingKey={`daily-spot-${product.slug}`}/>} 
        <View style={st.heroTint}/><View style={st.heroCopy}><Text style={st.eyebrow}>ĐỊA ĐIỂM GỢI Ý HÔM NAY</Text><Text style={st.place}>{suggestion.place}</Text><Text style={st.region}><Ionicons name="location" size={12}/> {suggestion.region}</Text></View>
      </View>
      <ScrollView style={st.body} contentContainerStyle={st.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={st.info}><Ionicons name="camera-outline" size={19} color={C.shu}/><View style={{flex:1}}><Text style={st.time}>{suggestion.time}</Text><Text style={st.tip}>{suggestion.tip}</Text></View></View>

        <GuideSection icon="navigate-circle-outline" title="NẰM Ở ĐÂU?">
          <Text style={st.guideText}>{suggestion.where}</Text>
          <Pressable style={st.mapButton} onPress={openMap}><Ionicons name="map-outline" size={14} color={C.shu}/><Text style={st.mapButtonText}>Mở vị trí trên bản đồ</Text><Ionicons name="open-outline" size={12} color={C.shu}/></Pressable>
        </GuideSection>

        <GuideSection icon="time-outline" title="LỊCH SỬ NGẮN">
          <Text style={st.guideText}>{suggestion.history}</Text>
        </GuideSection>

        <GuideSection icon="sparkles-outline" title="CÓ GÌ NỔI BẬT?">
          {suggestion.highlights.map((item,index)=><View key={index} style={st.bulletRow}><View style={st.bullet}/><Text style={st.bulletText}>{item}</Text></View>)}
        </GuideSection>

        <GuideSection icon="camera-outline" title="CHỤP ẢNH Ở ĐÂU ĐẸP?">
          {suggestion.photoSpots.map((spot,index)=><View key={spot.name} style={st.photoSpot}><Text style={st.photoIndex}>{String(index+1).padStart(2,'0')}</Text><View style={{flex:1}}><Text style={st.photoName}>{spot.name}</Text><Text style={st.photoTip}>{spot.tip}</Text></View></View>)}
        </GuideSection>

        <GuideSection icon="bus-outline" title="ĐI THẾ NÀO?">
          <Text style={st.guideText}>{suggestion.access}</Text>
        </GuideSection>

        <Pressable style={st.source} onPress={openSource}><Ionicons name="shield-checkmark-outline" size={14} color={C.kin}/><Text style={st.sourceText}>Nguồn kiểm chứng: {suggestion.sourceLabel}</Text><Ionicons name="open-outline" size={12} color={C.kin}/></Pressable>

        <View style={st.outfitDivider}><View style={st.dividerLine}/><Text style={st.dividerText}>PHỐI ĐỒ CHO CHUYẾN ĐI</Text><View style={st.dividerLine}/></View>
        <View style={st.outfit}><SmartImage source={product.images[0]} style={st.thumb} recyclingKey={`daily-outfit-${product.slug}`}/><View style={{flex:1}}><Text style={st.outfitLabel}>BỘ ĐỒ ĐỀ XUẤT</Text><Text style={st.product} numberOfLines={2}>{product.name}</Text><Text style={st.price}>{money(product.price)}</Text></View></View>
        <Pressable style={st.button} onPress={openProduct}><Text style={st.buttonText}>Đi đến xem bộ đồ</Text><Ionicons name="arrow-forward" size={17} color="#fff"/></Pressable>
        <Text style={st.note}>Gợi ý đổi mới mỗi ngày · cuộn để khám phá trọn địa danh</Text>
      </ScrollView>
    </View></View>
  </Modal>;
}

function GuideSection({icon,title,children}:{icon:keyof typeof Ionicons.glyphMap;title:string;children:React.ReactNode}){
  return <View style={st.section}><View style={st.sectionTitle}><View style={st.sectionIcon}><Ionicons name={icon} size={14} color={C.shu}/></View><Text style={st.sectionTitleText}>{title}</Text></View>{children}</View>;
}

const st=StyleSheet.create({
  shade:{flex:1,backgroundColor:'rgba(16,12,10,.58)',alignItems:'center',justifyContent:'center',paddingHorizontal:18,paddingVertical:28},
  card:{width:'100%',maxWidth:410,maxHeight:'94%',backgroundColor:C.paper,borderRadius:22,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,.5)'},
  close:{position:'absolute',right:11,top:11,zIndex:4,width:32,height:32,borderRadius:16,backgroundColor:'rgba(26,20,16,.75)',alignItems:'center',justifyContent:'center'},
  hero:{height:176,justifyContent:'flex-end'},heroTint:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(26,20,16,.43)'},heroCopy:{padding:16},
  eyebrow:{fontFamily:F.bodyB,fontSize:9.5,letterSpacing:1.6,color:'#F4D6A0'},place:{fontFamily:F.displayX,fontSize:24,color:'#fff',marginTop:4},region:{fontFamily:F.bodyB,fontSize:11.5,color:'#fff',marginTop:4},
  body:{flexShrink:1},bodyContent:{padding:15,paddingBottom:18},info:{flexDirection:'row',gap:9,backgroundColor:'#FFF7EA',borderRadius:12,padding:11},time:{fontFamily:F.bodyB,fontSize:12.5,color:C.ink},tip:{fontFamily:F.body,fontSize:11.5,lineHeight:17,color:C.muted,marginTop:2},
  section:{marginTop:16},sectionTitle:{flexDirection:'row',alignItems:'center',gap:7,marginBottom:7},sectionIcon:{width:26,height:26,borderRadius:8,backgroundColor:C.shuSoft,alignItems:'center',justifyContent:'center'},sectionTitleText:{fontFamily:F.bodyX,fontSize:9.5,letterSpacing:1.15,color:C.shuDeep},
  guideText:{fontFamily:F.body,fontSize:11.5,lineHeight:18,color:C.ink},
  mapButton:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,borderWidth:1,borderColor:'#E8C7BD',backgroundColor:'#FFF8F5',borderRadius:999,paddingHorizontal:10,paddingVertical:7,marginTop:9},mapButtonText:{fontFamily:F.bodyB,fontSize:10.5,color:C.shu},
  bulletRow:{flexDirection:'row',alignItems:'flex-start',gap:8,marginBottom:7},bullet:{width:5,height:5,borderRadius:3,backgroundColor:C.kin,marginTop:7},bulletText:{flex:1,fontFamily:F.body,fontSize:11.5,lineHeight:17.5,color:C.ink},
  photoSpot:{flexDirection:'row',alignItems:'flex-start',gap:10,backgroundColor:'#fff',borderWidth:1,borderColor:C.hair,borderRadius:11,padding:10,marginBottom:7},photoIndex:{fontFamily:F.displayX,fontSize:17,color:'#C8A65B'},photoName:{fontFamily:F.bodyB,fontSize:11.5,color:C.ink},photoTip:{fontFamily:F.body,fontSize:10.5,lineHeight:15.5,color:C.muted,marginTop:2},
  source:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#F7F0DF',borderRadius:9,padding:9,marginTop:14},sourceText:{flex:1,fontFamily:F.bodyM,fontSize:9.5,lineHeight:13,color:'#82651F'},
  outfitDivider:{flexDirection:'row',alignItems:'center',gap:8,marginTop:18},dividerLine:{height:1,flex:1,backgroundColor:C.line},dividerText:{fontFamily:F.bodyX,fontSize:8.5,letterSpacing:1,color:C.muted},
  outfit:{flexDirection:'row',alignItems:'center',gap:11,backgroundColor:'#fff',borderWidth:1,borderColor:C.line,borderRadius:13,padding:9,marginTop:11},thumb:{width:58,height:68,borderRadius:9},
  outfitLabel:{fontFamily:F.bodyX,fontSize:8.5,letterSpacing:1,color:C.kin},product:{fontFamily:F.bodyB,fontSize:12.5,color:C.ink,marginTop:3},price:{fontFamily:F.bodyX,fontSize:12,color:C.shu,marginTop:3},
  button:{height:45,borderRadius:12,backgroundColor:C.shu,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:12},buttonText:{fontFamily:F.bodyB,fontSize:13,color:'#fff'},
  note:{fontFamily:F.body,fontSize:9.5,color:C.muted,textAlign:'center',marginTop:8},
});
