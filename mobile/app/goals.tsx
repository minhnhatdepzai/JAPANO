import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Btn, money } from '../components/ui';
import { SmartImage } from '../components/SmartImage';
import { useCatalog } from '../lib/data';
import { createGoalPlan, getGoals, GoalPlan } from '../lib/api';
import { C, F } from '../theme/tokens';

const one = (value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const onlyNumber = (value:string)=>value.replace(/[^0-9.]/g,'');

function Field({label,value,onChange,suffix,placeholder}:{label:string;value:string;onChange:(value:string)=>void;suffix?:string;placeholder?:string}){
  return (
    <View style={st.fieldWrap}>
      <Text style={st.fieldLabel}>{label}</Text>
      <View style={st.field}>
        <TextInput value={value} onChangeText={text=>onChange(onlyNumber(text))} keyboardType="numeric" placeholder={placeholder} placeholderTextColor={C.muted} style={st.input} />
        {!!suffix&&<Text style={st.suffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

function Title({icon,title,sub}:{icon:string;title:string;sub:string}){
  return <View style={st.titleRow}><View style={st.titleIcon}><Ionicons name={icon as any} size={18} color="#fff" /></View><View style={{flex:1}}><Text style={st.title}>{title}</Text><Text style={st.sub}>{sub}</Text></View></View>;
}

export default function Goals(){
  const params=useLocalSearchParams<{productId?:string}>();
  const router=useRouter();
  const {products}=useCatalog();
  const initial=one(params.productId)||products[0]?.slug||'kimono-hong';
  const [productId,setProductId]=useState(initial);
  const product=useMemo(()=>products.find(item=>item.slug===productId)||products[0],[productId,products]);
  const [age,setAge]=useState('25');
  const [height,setHeight]=useState('165');
  const [currentWeight,setCurrentWeight]=useState('65');
  const [targetWeight,setTargetWeight]=useState('60');
  const [income,setIncome]=useState('15000000');
  const [expenses,setExpenses]=useState('11000000');
  const [saved,setSaved]=useState('200000');
  const [months,setMonths]=useState('6');
  const [plan,setPlan]=useState<GoalPlan|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const scroll=useRef<ScrollView>(null);

  useEffect(()=>{
    if(one(params.productId))return;
    let live=true;
    void getGoals().then((data:any)=>{
      const latest=data?.goals?.[0];
      if(!live||!latest)return;
      setProductId(String(latest.productId||initial));
      setPlan(latest.plan||null);
      const input=latest.input||{};
      if(input.age)setAge(String(input.age));if(input.heightCm)setHeight(String(input.heightCm));
      if(input.currentWeightKg)setCurrentWeight(String(input.currentWeightKg));if(input.targetWeightKg)setTargetWeight(String(input.targetWeightKg));
      if(input.monthlyIncome)setIncome(String(input.monthlyIncome));if(input.fixedExpenses)setExpenses(String(input.fixedExpenses));
      if(input.currentSavings!=null)setSaved(String(input.currentSavings));if(input.targetMonths)setMonths(String(input.targetMonths));
    }).catch(()=>undefined);
    return()=>{live=false;};
  },[]);

  const create=async()=>{
    if(!product||loading)return;
    setLoading(true);setError('');
    try{
      const response=await createGoalPlan({
        productId:product.slug,age,heightCm:height,currentWeightKg:currentWeight,targetWeightKg:targetWeight,
        monthlyIncome:income,fixedExpenses:expenses,currentSavings:saved,targetMonths:months,
      });
      setPlan(response.goal.plan);
      setTimeout(()=>scroll.current?.scrollToEnd({animated:true}),180);
    }catch(e:any){setError(e?.message||'Chưa tạo được lộ trình. Hãy kiểm tra kết nối máy chủ và thử lại.');}
    finally{setLoading(false);}
  };

  if(!product)return null;
  return (
    <Screen wave={false}>
      <Header title="Mục tiêu mua sắm & làm đẹp" />
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:18,paddingBottom:38}}>
        <View style={st.hero}>
          <View style={{flex:1}}><Text style={st.eyebrow}>MỤC TIÊU BỀN VỮNG</Text><Text style={st.heroTitle}>Khỏe hơn từng bước,{`\n`}mua món mình thích đúng kế hoạch.</Text><Text style={st.heroSub}>Không ép cân nhanh · không vay để mua đồ · không tự trách khi lỡ nhịp.</Text></View>
          <Ionicons name="sparkles" size={34} color="#F6D6B4" />
        </View>

        <Title icon="shirt-outline" title="1. Chọn món bạn muốn" sub="Lộ trình sẽ tính đúng theo giá sản phẩm trong cửa hàng." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10,paddingVertical:4}}>
          {products.slice(0,12).map(item=>{
            const active=item.slug===product.slug;
            return <Pressable key={item.slug} onPress={()=>{setProductId(item.slug);setPlan(null);}} style={[st.product,active&&st.productOn]}>
              <SmartImage source={item.images[0]} style={st.productImg} recyclingKey={`${item.slug}-goal`} />
              <Text numberOfLines={2} style={st.productName}>{item.name}</Text><Text style={st.productPrice}>{money(item.price)}</Text>
              {active&&<View style={st.check}><Ionicons name="checkmark" size={14} color="#fff" /></View>}
            </Pressable>;
          })}
        </ScrollView>

        <View style={st.selected}>
          <SmartImage source={product.images[0]} style={st.selectedImg} recyclingKey={`${product.slug}-goal-selected`} />
          <View style={{flex:1}}><Text style={st.selectedName}>{product.name}</Text><Text style={st.selectedPrice}>{money(product.price)}</Text></View>
          <Pressable onPress={()=>router.push(`/product/${product.slug}`)}><Text style={st.view}>Xem ›</Text></Pressable>
        </View>

        <Title icon="wallet-outline" title="2. Kế hoạch tiết kiệm" sub="Thuật toán giới hạn quỹ mua đồ trong phần thu nhập khả dụng." />
        <View style={st.formGrid}>
          <Field label="Thu nhập/tháng" value={income} onChange={setIncome} suffix="₫" />
          <Field label="Chi phí bắt buộc" value={expenses} onChange={setExpenses} suffix="₫" />
          <Field label="Đã tiết kiệm" value={saved} onChange={setSaved} suffix="₫" />
          <Field label="Muốn đạt trong" value={months} onChange={setMonths} suffix="tháng" />
        </View>

        <Title icon="heart-outline" title="3. Lộ trình khỏe và tự tin" sub="Dành cho người trưởng thành; gợi ý tự động không thay thế bác sĩ hoặc chuyên gia dinh dưỡng." />
        <View style={st.formGrid}>
          <Field label="Tuổi" value={age} onChange={setAge} />
          <Field label="Chiều cao" value={height} onChange={setHeight} suffix="cm" />
          <Field label="Cân nặng hiện tại" value={currentWeight} onChange={setCurrentWeight} suffix="kg" />
          <Field label="Mục tiêu cân nặng" value={targetWeight} onChange={setTargetWeight} suffix="kg" />
        </View>
        <Text style={st.safety}>Nếu dưới 18 tuổi, BMI mục tiêu dưới 18,5, đang mang thai, có bệnh nền hoặc tiền sử rối loạn ăn uống, hệ thống sẽ không đưa lộ trình giảm cân cá nhân.</Text>

        <Btn label={loading?'Đang xây dựng lộ trình…':'Tạo lộ trình của tôi'} icon="sparkles" onPress={create} style={{marginTop:16}} />
        {loading&&<View style={st.loading}><ActivityIndicator color={C.shu}/><Text style={st.loadingText}>Hệ thống đang kết hợp mục tiêu cụ thể, thói quen nếu–thì và ngân sách thực tế…</Text></View>}
        {!!error&&<Text style={st.error}>{error}</Text>}

        {plan&&<View style={{gap:14,marginTop:18}}>
          <View style={st.resultCard}>
            <Text style={st.resultKicker}>QUỸ MUA SẮM</Text><Text style={st.resultBig}>{Math.round(plan.saving.progressPercent)}%</Text>
            <View style={st.progress}><View style={[st.progressOn,{width:`${Math.max(2,plan.saving.progressPercent)}%` as any}]} /></View>
            <Text style={st.resultText}>Còn <Text style={st.strong}>{money(plan.saving.gap)}</Text> · nên dành <Text style={st.strong}>{money(plan.saving.monthlySaving)}/tháng</Text></Text>
            <Text style={st.resultText}>{plan.saving.estimatedMonths==null?'Chưa có thu nhập khả dụng để ước tính.':`Khoảng ${plan.saving.estimatedMonths} tháng · ${money(plan.saving.weeklySaving)}/tuần`}</Text>
            {plan.saving.actions.map((item,index)=><Text key={index} style={st.item}>✓ {item}</Text>)}
          </View>

          <View style={st.resultCard}>
            <Text style={st.resultKicker}>LỘ TRÌNH SỨC KHỎE AN TOÀN</Text>
            <View style={st.metricRow}>
              <View style={st.metric}><Text style={st.metricN}>{plan.wellness.currentBmi??'—'}</Text><Text style={st.metricL}>BMI hiện tại</Text></View>
              <View style={st.metric}><Text style={st.metricN}>{plan.wellness.estimatedWeeks??'—'}</Text><Text style={st.metricL}>tuần dự kiến</Text></View>
              <View style={st.metric}><Text style={st.metricN}>{plan.wellness.activityMinutesPerWeek}</Text><Text style={st.metricL}>phút/tuần</Text></View>
            </View>
            <Text style={st.warning}>{plan.wellness.safetyMessage}</Text>
            {plan.wellness.habits.map((item,index)=><Text key={index} style={st.item}>• {item}</Text>)}
          </View>

          <View style={[st.resultCard,{backgroundColor:C.sumi,borderColor:C.sumi}]}>
            <Text style={[st.resultKicker,{color:'#F6D6B4'}]}>HUẤN LUYỆN VIÊN THÔNG MINH</Text>
            <Text style={st.coachTitle}>{plan.coaching.motivation}</Text>
            <Text style={st.identity}>“{plan.coaching.identityStatement}”</Text>
            <Text style={st.coachSub}>Kế hoạch nếu–thì</Text>
            {plan.coaching.implementationIntentions.map((item,index)=><Text key={index} style={st.coachItem}>→ {item}</Text>)}
            <Text style={st.coachSub}>Trọng tâm tuần này</Text><Text style={st.coachItem}>{plan.coaching.weeklyFocus}</Text>
            <Text style={st.question}>{plan.coaching.reflectionQuestion}</Text>
          </View>
          <Text style={st.disclaimer}>{plan.disclaimer}</Text>
        </View>}
      </ScrollView>
    </Screen>
  );
}

const st=StyleSheet.create({
  hero:{flexDirection:'row',gap:12,backgroundColor:C.sumi,borderRadius:18,padding:18,marginTop:6},
  eyebrow:{fontFamily:F.bodyX,fontSize:10,letterSpacing:1.2,color:'#F6D6B4'},
  heroTitle:{fontFamily:F.display,fontSize:21,lineHeight:30,color:'#fff',marginTop:6},
  heroSub:{fontFamily:F.body,fontSize:11.5,lineHeight:18,color:'#D8D2CB',marginTop:7},
  titleRow:{flexDirection:'row',alignItems:'center',gap:10,marginTop:22,marginBottom:10},
  titleIcon:{width:36,height:36,borderRadius:11,backgroundColor:C.shu,alignItems:'center',justifyContent:'center'},
  title:{fontFamily:F.display,fontSize:16,color:C.sumi},sub:{fontFamily:F.body,fontSize:10.5,lineHeight:16,color:C.muted,marginTop:1},
  product:{width:124,borderRadius:14,borderWidth:1,borderColor:C.line,backgroundColor:'#fff',padding:7},
  productOn:{borderWidth:2,borderColor:C.shu},productImg:{width:'100%',height:112,borderRadius:10},
  productName:{fontFamily:F.bodyB,fontSize:11.5,lineHeight:16,color:C.ink,minHeight:34,marginTop:6},productPrice:{fontFamily:F.bodyX,fontSize:11,color:C.shu,marginTop:2},
  check:{position:'absolute',right:10,top:10,width:24,height:24,borderRadius:12,backgroundColor:C.shu,alignItems:'center',justifyContent:'center'},
  selected:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:C.shuSoft,borderRadius:14,padding:10,marginTop:10},selectedImg:{width:50,height:60,borderRadius:9},
  selectedName:{fontFamily:F.bodyB,fontSize:12.5,color:C.ink},selectedPrice:{fontFamily:F.bodyX,fontSize:12,color:C.shu,marginTop:3},view:{fontFamily:F.bodyB,fontSize:12,color:C.shu},
  formGrid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:10},fieldWrap:{width:'48%'},fieldLabel:{fontFamily:F.bodyB,fontSize:10.5,color:C.ink,marginBottom:5},
  field:{height:46,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:C.line,borderRadius:12,backgroundColor:'#fff',paddingHorizontal:11},input:{flex:1,fontFamily:F.bodyB,fontSize:13,color:C.ink},suffix:{fontFamily:F.body,fontSize:11,color:C.muted},
  safety:{fontFamily:F.body,fontSize:10.5,lineHeight:17,color:C.muted,backgroundColor:'#FFF8E7',borderRadius:10,padding:10,marginTop:10},
  loading:{flexDirection:'row',alignItems:'center',gap:8,justifyContent:'center',padding:12},loadingText:{fontFamily:F.body,fontSize:11,color:C.muted,flex:1},error:{fontFamily:F.bodyB,fontSize:12,color:C.danger,textAlign:'center',marginTop:10},
  resultCard:{backgroundColor:'#fff',borderWidth:1,borderColor:C.line,borderRadius:16,padding:15},resultKicker:{fontFamily:F.bodyX,fontSize:10.5,letterSpacing:1,color:C.shu},resultBig:{fontFamily:F.displayX,fontSize:30,color:C.sumi,marginTop:5},
  progress:{height:9,borderRadius:5,backgroundColor:C.hair,overflow:'hidden',marginVertical:9},progressOn:{height:'100%',borderRadius:5,backgroundColor:C.matcha},resultText:{fontFamily:F.body,fontSize:12,lineHeight:19,color:C.ink},strong:{fontFamily:F.bodyX,color:C.shu},item:{fontFamily:F.body,fontSize:11.5,lineHeight:19,color:C.ink,marginTop:6},
  metricRow:{flexDirection:'row',gap:8,marginVertical:12},metric:{flex:1,alignItems:'center',backgroundColor:C.washi2,borderRadius:11,padding:9},metricN:{fontFamily:F.display,fontSize:20,color:C.sumi},metricL:{fontFamily:F.body,fontSize:9.5,color:C.muted,textAlign:'center'},warning:{fontFamily:F.bodyB,fontSize:10.5,lineHeight:17,color:C.shuDeep,backgroundColor:C.shuSoft,borderRadius:10,padding:9},
  coachTitle:{fontFamily:F.display,fontSize:17,lineHeight:25,color:'#fff',marginTop:10},identity:{fontFamily:F.bodyB,fontSize:12.5,lineHeight:20,color:'#F6D6B4',marginTop:10},coachSub:{fontFamily:F.bodyX,fontSize:11,color:'#fff',marginTop:13,marginBottom:3},coachItem:{fontFamily:F.body,fontSize:11.5,lineHeight:19,color:'#DDD7D0',marginTop:4},question:{fontFamily:F.bodyB,fontSize:12,lineHeight:20,color:'#F6D6B4',borderTopWidth:1,borderTopColor:'#4A4038',paddingTop:10,marginTop:12},disclaimer:{fontFamily:F.body,fontSize:10.5,lineHeight:17,color:C.muted,textAlign:'center'},
});
