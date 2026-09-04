import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Btn, money } from '../components/ui';
import { SmartImage } from '../components/SmartImage';
import { useCatalog } from '../lib/data';
import { ApiGoal, createGoalPlan, depositToGoal, getGoals, GoalPlan, removeGoalDeposit } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { regionsList, prefecturesInRegion, spotsInPrefecture, JapanSpot } from '../lib/japanSpots';
import { C, F } from '../theme/tokens';

const one = (value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const onlyNumber = (value:string)=>value.replace(/[^0-9.]/g,'');
type Tab='shopping'|'health'|'japan';
type HealthGoal='gradual-loss'|'maintain'|'move-more'|'sleep-energy';
type ActivityLevel='low'|'some'|'regular';
const QUICK_DEPOSITS=[50000,100000,200000,500000];
const dateOf=(at:number)=>new Date(at).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});

type SafetyAnswer='yes'|'no'|'prefer_not_to_say';
const SAFETY_QUESTIONS:Array<[string,string]>=[
  ['pregnancy','Bạn đang mang thai hoặc trong giai đoạn hậu sản?'],
  ['conditionOrMedication','Bạn có bệnh nền hoặc đang dùng thuốc ảnh hưởng tới cân nặng?'],
  ['eatingDisorderHistory','Bạn từng có tiền sử rối loạn ăn uống?'],
  ['underCare','Bạn đang được bác sĩ hoặc chuyên gia dinh dưỡng điều trị?'],
];
const SAFETY_OPTIONS:Array<[SafetyAnswer,string]>=[['no','Không'],['yes','Có'],['prefer_not_to_say','Không muốn nói']];

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
function TabBar({tab,setTab}:{tab:Tab;setTab:(t:Tab)=>void}){
  const items:Array<{k:Tab;label:string;icon:string}>=[
    {k:'shopping',label:'Mua sắm',icon:'wallet-outline'},
    {k:'health',label:'Sức khoẻ',icon:'heart-outline'},
    {k:'japan',label:'Nhật Bản',icon:'compass-outline'},
  ];
  return (
    <View style={st.tabs}>
      {items.map(it=>(
        <Pressable key={it.k} style={[st.tab,tab===it.k&&st.tabOn]} onPress={()=>setTab(it.k)}>
          <Ionicons name={it.icon as any} size={16} color={tab===it.k?'#fff':C.muted} />
          <Text style={[st.tabT,tab===it.k&&{color:'#fff'}]}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function Goals(){
  const params=useLocalSearchParams<{productId?:string}>();
  const router=useRouter();
  const {products}=useCatalog();
  const {user}=useAuth();
  const {toast}=useToast();
  const initial=one(params.productId)||products[0]?.slug||'kimono-hong';
  const [tab,setTab]=useState<Tab>('shopping');
  const [productId,setProductId]=useState(initial);
  const product=useMemo(()=>products.find(item=>item.slug===productId)||products[0],[productId,products]);
  // Mọi mục tiêu của tài khoản, để đổi sản phẩm là thấy ngay quỹ tương ứng.
  const [goals,setGoals]=useState<ApiGoal[]>([]);
  const goal=useMemo(()=>goals.find(item=>item.productId===productId)||null,[goals,productId]);
  const upsertGoal=(next:ApiGoal)=>setGoals(current=>[next,...current.filter(item=>item.id!==next.id)]);
  // Form mở lần đầu để TRỐNG. Số điền sẵn kiểu 25 tuổi / 165 cm / 65 kg /
  // 15 triệu trông như dữ liệu thật của người dùng và dễ được gửi đi nguyên
  // xi; giá trị chỉ được nạp lại nếu đó là mục tiêu đã lưu của chính họ.
  const [age,setAge]=useState('');
  const [height,setHeight]=useState('');
  const [currentWeight,setCurrentWeight]=useState('');
  const [targetWeight,setTargetWeight]=useState('');
  const [income,setIncome]=useState('');
  const [expenses,setExpenses]=useState('');
  const [saved,setSaved]=useState('');
  const [months,setMonths]=useState('6');
  // Sàng lọc an toàn: backend tự suy ra trạng thái, client chỉ thu câu trả lời.
  const [screening,setScreening]=useState<Record<string,SafetyAnswer>>({});
  const [healthGoal,setHealthGoal]=useState<HealthGoal>('gradual-loss');
  const [activityLevel,setActivityLevel]=useState<ActivityLevel>('low');
  const [plan,setPlan]=useState<GoalPlan|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const scroll=useRef<ScrollView>(null);

  useEffect(()=>{
    if(!user?.id)return;
    let live=true;
    void getGoals(user.id).then(data=>{
      if(!live)return;
      const list=data?.goals||[];
      setGoals(list);
      const latest=list[0];
      if(!latest)return;
      if(!one(params.productId)){
        setProductId(String(latest.productId||initial));
        setPlan(latest.plan||null);
      }
      const input:any=latest.input||{};
      if(input.age)setAge(String(input.age));if(input.heightCm)setHeight(String(input.heightCm));
      if(input.currentWeightKg)setCurrentWeight(String(input.currentWeightKg));if(input.targetWeightKg)setTargetWeight(String(input.targetWeightKg));
      if(input.monthlyIncome)setIncome(String(input.monthlyIncome));if(input.fixedExpenses)setExpenses(String(input.fixedExpenses));
      if(input.currentSavings!=null)setSaved(String(input.currentSavings));if(input.targetMonths)setMonths(String(input.targetMonths));
      if(['gradual-loss','maintain','move-more','sleep-energy'].includes(String(input.healthGoal)))setHealthGoal(input.healthGoal as HealthGoal);
      if(['low','some','regular'].includes(String(input.activityLevel)))setActivityLevel(input.activityLevel as ActivityLevel);
    }).catch(()=>undefined);
    return()=>{live=false;};
  },[user?.id]);

  // Đổi sản phẩm mục tiêu thì hiện lại đúng lộ trình đã lưu của sản phẩm đó
  // (nếu có) thay vì để trống bắt khách tạo lại từ đầu.
  useEffect(()=>{ if(goal?.plan)setPlan(goal.plan); },[goal?.id]);

  const create=async()=>{
    if(!product||loading)return;
    if(!user?.id){ toast({message:'Bạn cần đăng nhập để lưu mục tiêu và nhận thưởng.',kind:'error'}); router.push('/login'); return; }
    setLoading(true);setError('');
    try{
      const response=await createGoalPlan({
        productId:product.slug,age,heightCm:height,currentWeightKg:currentWeight,targetWeightKg:targetWeight,
        monthlyIncome:income,fixedExpenses:expenses,currentSavings:saved,targetMonths:months,
        goalType:tab==='health'?'health':'shopping',healthGoal,activityLevel,
        safetyScreening:screening,
      });
      setPlan(response.goal.plan);
      upsertGoal(response.goal);
      toast('Đã lưu lộ trình mục tiêu của bạn ✓');
      setTimeout(()=>scroll.current?.scrollToEnd({animated:true}),180);
    }catch(e:any){
      const message=e?.message||'Chưa tạo được lộ trình. Hãy kiểm tra kết nối máy chủ và thử lại.';
      setError(message);
      toast({message,kind:'error'});
    }
    finally{setLoading(false);}
  };

  if(!product)return null;
  return (
    <Screen wave={false}>
      <Header title="Mục tiêu" />
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:18,paddingBottom:38}}>
        <View style={st.hero}>
          <View style={{flex:1}}><Text style={st.eyebrow}>MỤC TIÊU BỀN VỮNG</Text><Text style={st.heroTitle}>Rõ ràng từng mục tiêu:{`\n`}mua sắm, sức khoẻ, hoặc một chuyến đi Nhật Bản.</Text><Text style={st.heroSub}>Chọn đúng mục tiêu bạn đang theo đuổi ở tab bên dưới.</Text></View>
          <Ionicons name="sparkles" size={34} color={'rgba(255,255,255,0.72)'} />
        </View>

        <TabBar tab={tab} setTab={setTab} />

        {tab==='shopping' && (
          <>
            <Title icon="shirt-outline" title="Chọn món bạn muốn" sub="Lộ trình sẽ tính đúng theo giá sản phẩm trong cửa hàng." />
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
          </>
        )}

        {tab==='shopping' && (
          <>
            <Title icon="wallet-outline" title="Kế hoạch tiết kiệm" sub="Thuật toán giới hạn quỹ mua đồ trong phần thu nhập khả dụng." />
            <View style={st.formGrid}>
              <Field label="Thu nhập/tháng" value={income} onChange={setIncome} suffix="₫" />
              <Field label="Chi phí bắt buộc" value={expenses} onChange={setExpenses} suffix="₫" />
              <Field label="Đã tiết kiệm" value={saved} onChange={setSaved} suffix="₫" />
              <Field label="Muốn đạt trong" value={months} onChange={setMonths} suffix="tháng" />
            </View>
            <Btn label={loading?'Đang xây dựng lộ trình…':'Tạo lộ trình của tôi'} icon="sparkles" onPress={create} style={{marginTop:16}} />
          </>
        )}

        {tab==='health' && (
          <>
            <Title icon="heart-outline" title="Lộ trình khỏe và tự tin" sub="Dành cho người trưởng thành; gợi ý tự động không thay thế bác sĩ hoặc chuyên gia dinh dưỡng." />
            <Text style={st.fieldLabel}>Bạn muốn tập trung vào điều gì?</Text>
            <View style={st.choiceRow}>
              {([
                ['gradual-loss','Giảm từ từ'],['maintain','Duy trì'],['move-more','Vận động'],['sleep-energy','Ngủ & năng lượng'],
              ] as Array<[HealthGoal,string]>).map(([value,label])=>(
                <Pressable key={value} style={[st.choice,healthGoal===value&&st.choiceOn]} onPress={()=>setHealthGoal(value)}>
                  <Text style={[st.choiceText,healthGoal===value&&st.choiceTextOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={st.fieldLabel}>Mức vận động hiện tại</Text>
            <View style={st.choiceRow}>
              {([['low','Ít vận động'],['some','Thỉnh thoảng'],['regular','Đều đặn']] as Array<[ActivityLevel,string]>).map(([value,label])=>(
                <Pressable key={value} style={[st.choice,activityLevel===value&&st.choiceOn]} onPress={()=>setActivityLevel(value)}>
                  <Text style={[st.choiceText,activityLevel===value&&st.choiceTextOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={st.formGrid}>
              <Field label="Tuổi" value={age} onChange={setAge} />
              <Field label="Chiều cao" value={height} onChange={setHeight} suffix="cm" />
              <Field label="Cân nặng hiện tại" value={currentWeight} onChange={setCurrentWeight} suffix="kg" />
              <Field label="Mục tiêu cân nặng" value={targetWeight} onChange={setTargetWeight} suffix="kg" />
            </View>
            <Text style={st.provenance}>Thông tin do bạn tự khai · Không phải xác minh y tế</Text>

            <Text style={st.fieldLabel}>Sàng lọc an toàn</Text>
            <Text style={st.safety}>Bốn câu dưới đây quyết định JAPANO có đưa lộ trình giảm cân hay chỉ đưa hướng dẫn chung. Chúng tôi chỉ lưu kết luận tổng hợp, không lưu chi tiết bệnh lý.</Text>
            {SAFETY_QUESTIONS.map(([id,question])=>(
              <View key={id} style={st.screenBlock}>
                <Text style={st.screenQ} nativeID={`safety-${id}`}>{question}</Text>
                <View style={st.choiceRow} accessibilityRole="radiogroup" accessibilityLabelledBy={`safety-${id}`}>
                  {SAFETY_OPTIONS.map(([value,label])=>(
                    <Pressable
                      key={value}
                      style={[st.choice,screening[id]===value&&st.choiceOn]}
                      onPress={()=>setScreening(current=>({...current,[id]:value}))}
                      accessibilityRole="radio"
                      accessibilityState={{checked:screening[id]===value}}
                      accessibilityLabel={`${question} — ${label}`}
                    >
                      <Text style={[st.choiceText,screening[id]===value&&st.choiceTextOn]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            {SAFETY_QUESTIONS.some(([id])=>!screening[id]) && (
              <Text style={st.safety}>Hãy trả lời đủ 4 câu để JAPANO biết có thể đưa lộ trình cá nhân hay không.</Text>
            )}
            <Text style={st.safety}>Nếu dưới 18 tuổi, BMI mục tiêu dưới 18,5, hoặc bất kỳ câu sàng lọc nào là "Có"/"Không muốn nói", hệ thống chỉ đưa hướng dẫn chung và không tạo tốc độ giảm cân.</Text>
            <Btn label={loading?'Đang xây dựng lộ trình…':'Tạo lộ trình của tôi'} icon="sparkles" onPress={create} style={{marginTop:16}} />
          </>
        )}

        {(tab==='shopping'||tab==='health') && loading&&<View style={st.loading}><ActivityIndicator color={C.ink}/><Text style={st.loadingText}>Hệ thống đang kết hợp mục tiêu cụ thể, thói quen nếu–thì và ngân sách thực tế…</Text></View>}
        {(tab==='shopping'||tab==='health') && !!error&&<Text style={st.error}>{error}</Text>}

        {tab==='shopping' && plan && (
          <View style={{gap:14,marginTop:18}}>
            <View style={st.resultCard}>
              <Text style={st.resultKicker}>KẾ HOẠCH TIẾT KIỆM</Text><Text style={st.resultBig}>{Math.round(plan.saving.progressPercent)}%</Text>
              <View style={st.progress}><View style={[st.progressOn,{width:`${Math.max(2,plan.saving.progressPercent)}%` as any}]} /></View>
              <Text style={st.resultText}>Còn <Text style={st.strong}>{money(plan.saving.gap)}</Text> · nên dành <Text style={st.strong}>{money(plan.saving.monthlySaving)}/tháng</Text></Text>
              <Text style={st.resultText}>{plan.saving.estimatedMonths==null?'Chưa có thu nhập khả dụng để ước tính.':`Khoảng ${plan.saving.estimatedMonths} tháng · ${money(plan.saving.weeklySaving)}/tuần`}</Text>
              {plan.saving.actions.map((item,index)=><Text key={index} style={st.item}>✓ {item}</Text>)}
            </View>
            {!!goal && <FundCard goal={goal} onChange={upsertGoal} />}
            <CoachCard plan={plan} />
          </View>
        )}

        {tab==='health' && plan && (
          <View style={{gap:14,marginTop:18}}>
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
            <CoachCard plan={plan} />
          </View>
        )}

        {tab==='japan' && <JapanGoalTab />}
      </ScrollView>
    </Screen>
  );
}

// Quỹ tích luỹ: khách tự ghi nhận từng khoản đã để dành cho món hàng mục tiêu.
// Đây là SỔ THEO DÕI, không phải ví — nói rõ trong UI để không ai hiểu nhầm là
// đã chuyển tiền thật cho JAPANO.
function FundCard({goal,onChange}:{goal:ApiGoal;onChange:(goal:ApiGoal)=>void}){
  const {toast}=useToast();
  const router=useRouter();
  const [amount,setAmount]=useState('');
  const [busy,setBusy]=useState(false);
  const [showLedger,setShowLedger]=useState(false);
  const fund=goal.fund;
  if(!fund)return null;
  const done=fund.status!=='saving';

  const deposit=async(value:number)=>{
    if(busy)return;
    if(!(value>0)){toast({message:'Nhập số tiền bạn vừa để dành được.',kind:'error'});return;}
    setBusy(true);
    try{
      const result=await depositToGoal(goal.id,{amount:value});
      onChange(result.goal);
      setAmount('');
      if(result.justCompleted){
        toast({
          message:'🎯 Sổ theo dõi của bạn đã đủ số tiền mục tiêu. Chúc bạn sớm mua được món mình muốn!',
          kind:'success',
          durationMs:6000,
          action:{label:'Xem sản phẩm',onPress:()=>router.push(`/product/${goal.productId}` as any)},
        });
      }else{
        const remaining=Math.max(0,result.goal.fund?.remaining??0);
        toast(`Đã ghi nhận ${money(value)} · còn ${money(remaining)}`);
      }
    }catch(e:any){toast({message:e?.message||'Không ghi nhận được khoản tích luỹ.',kind:'error'});}
    finally{setBusy(false);}
  };

  const undo=async(depositId:string)=>{
    if(busy)return;
    setBusy(true);
    try{
      const result=await removeGoalDeposit(goal.id,depositId);
      onChange(result.goal);
      toast({message:'Đã gỡ khoản ghi nhầm khỏi quỹ.',kind:'info'});
    }catch(e:any){toast({message:e?.message||'Không gỡ được khoản này.',kind:'error'});}
    finally{setBusy(false);}
  };

  return (
    <View style={[st.resultCard,done&&{borderColor:C.matcha,borderWidth:2}]}>
      <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
        <Ionicons name={done?'trophy':'wallet'} size={17} color={done?C.matcha:C.shu} />
        <Text style={[st.resultKicker,done&&{color:C.matcha}]}>QUỸ TÍCH LUỸ CỦA BẠN</Text>
      </View>
      <Text style={st.fundBig}>{money(fund.saved)} <Text style={st.fundTarget}>/ {money(fund.target)}</Text></Text>
      <View style={st.progress}><View style={[st.progressOn,{width:`${Math.max(2,fund.percent)}%` as any},done&&{backgroundColor:C.matcha}]} /></View>
      <Text style={st.resultText}>
        {done
          ? `Bạn đã tích đủ ${money(fund.target)} — mục tiêu hoàn thành ${fund.completedAt?`ngày ${dateOf(fund.completedAt)}`:''}.`
          : <>Còn <Text style={st.strong}>{money(fund.remaining)}</Text> nữa là đủ mua {goal.product?.name}.</>}
      </Text>

      {done ? (
        <View style={st.rewardBox}>
          <Text style={st.rewardTitle}>🎯 Bạn đã ghi nhận đủ số tiền mục tiêu</Text>
          {/* Không còn phát voucher từ số tự khai. Mã cũ đã cấp trước đây vẫn
              dùng được, nhưng chỉ giảm đúng sản phẩm mục tiêu. */}
          {fund.rewardVoucherCode ? (
            <>
              <Text selectable style={st.rewardCode}>{fund.rewardVoucherCode}</Text>
              <Text style={st.rewardBody}>Mã ưu đãi đã cấp trước đây · giảm {fund.rewardPercent}% và chỉ áp dụng cho {goal.product?.name}, tối đa 1 sản phẩm.</Text>
            </>
          ) : (
            <Text style={st.rewardBody}>Đây là số tiền bạn tự khai trong sổ theo dõi — JAPANO không giữ tiền và không phát mã giảm giá từ con số này.</Text>
          )}
          {fund.status==='achieved'
            ? <View style={st.achieved}><Ionicons name="checkmark-circle" size={15} color={C.matcha} /><Text style={st.achievedT}>Đã mua thành công trong đơn #{fund.achievedOrderCode}. Chúc mừng bạn!</Text></View>
            : <Btn label="Dùng mã và mua ngay" icon="bag-handle-outline" onPress={()=>router.push(`/product/${goal.productId}` as any)} style={{marginTop:10}} />}
        </View>
      ) : (
        <>
          <Text style={st.fundHint}>Mỗi lần để dành được bao nhiêu, ghi vào đây bấy nhiêu. Đây là sổ theo dõi tiến độ — JAPANO không giữ tiền của bạn.</Text>
          <View style={st.quickRow}>
            {QUICK_DEPOSITS.map(value=>(
              <Pressable key={value} disabled={busy} style={st.quick} onPress={()=>void deposit(value)}>
                <Text style={st.quickT}>+{value>=1000000?`${value/1000000}tr`:`${value/1000}k`}</Text>
              </Pressable>
            ))}
          </View>
          <View style={st.depositRow}>
            <View style={[st.field,{flex:1}]}>
              <TextInput value={amount} onChangeText={text=>setAmount(onlyNumber(text))} keyboardType="numeric" placeholder="Số tiền khác" placeholderTextColor={C.muted} style={st.input} />
              <Text style={st.suffix}>₫</Text>
            </View>
            <Pressable disabled={busy} style={[st.depositBtn,busy&&{opacity:.5}]} onPress={()=>void deposit(Number(amount)||0)}>
              {busy?<ActivityIndicator color="#fff" size="small"/>:<Text style={st.depositBtnT}>Ghi nhận đã để dành</Text>}
            </Pressable>
          </View>
          <Text style={st.ledgerNote}>JAPANO không giữ tiền của bạn — đây là sổ theo dõi tiến độ tiết kiệm, tiền vẫn nằm trong tài khoản của bạn.</Text>
        </>
      )}

      {!!fund.deposits.length && (
        <>
          <Pressable style={st.ledgerToggle} onPress={()=>setShowLedger(value=>!value)}>
            <Text style={st.ledgerToggleT}>Lịch sử tích luỹ ({fund.deposits.length})</Text>
            <Ionicons name={showLedger?'chevron-up':'chevron-down'} size={15} color={C.ink} />
          </Pressable>
          {showLedger&&[...fund.deposits].reverse().map(item=>(
            <View key={item.id} style={st.ledgerRow}>
              <View style={{flex:1}}>
                <Text style={st.ledgerAmount}>+{money(item.amount)}</Text>
                <Text style={st.ledgerMeta}>{dateOf(item.at)}{item.note?` · ${item.note}`:''}</Text>
              </View>
              <Pressable hitSlop={8} disabled={busy} onPress={()=>void undo(item.id)}><Ionicons name="trash-outline" size={16} color={C.muted} /></Pressable>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function CoachCard({plan}:{plan:GoalPlan}){
  return (
    <View style={[st.resultCard,{backgroundColor:C.inverseSurface,borderColor:C.inverseSurface}]}>
      <Text style={[st.resultKicker,{color:'rgba(255,255,255,0.70)'}]}>HUẤN LUYỆN VIÊN THÔNG MINH</Text>
      <Text style={st.coachTitle}>{plan.coaching.motivation}</Text>
      <Text style={st.identity}>"{plan.coaching.identityStatement}"</Text>
      <Text style={st.coachSub}>Kế hoạch nếu–thì</Text>
      {plan.coaching.implementationIntentions.map((item,index)=><Text key={index} style={st.coachItem}>→ {item}</Text>)}
      <Text style={st.coachSub}>Trọng tâm tuần này</Text><Text style={st.coachItem}>{plan.coaching.weeklyFocus}</Text>
      <Text style={st.question}>{plan.coaching.reflectionQuestion}</Text>
      <Text style={st.disclaimer}>{plan.disclaimer}</Text>
    </View>
  );
}

function JapanGoalTab(){
  const router=useRouter();
  const regions=useMemo(()=>regionsList(),[]);
  const [region,setRegion]=useState(regions[0]||'');
  const prefectures=useMemo(()=>prefecturesInRegion(region),[region]);
  const [prefecture,setPrefecture]=useState(prefectures[0]||'');
  const spotsHere=useMemo(()=>prefecture?spotsInPrefecture(prefecture):[],[prefecture]);
  const [spot,setSpot]=useState<JapanSpot|null>(spotsHere[0]||null);
  const [budget,setBudget]=useState('15000000');
  const [saved,setSaved]=useState('1000000');
  const [months,setMonths]=useState('6');

  useEffect(()=>{ const p=prefecturesInRegion(region); setPrefecture(p[0]||''); },[region]);
  useEffect(()=>{ const s=prefecture?spotsInPrefecture(prefecture):[]; setSpot(s[0]||null); },[prefecture]);

  const targetAmount=Number(budget)||0;
  const currentSavings=Math.min(Number(saved)||0,targetAmount);
  const gap=Math.max(0,targetAmount-currentSavings);
  const monthCount=Math.max(1,Number(months)||1);
  const monthlySaving=Math.round(gap/monthCount);
  const weeklySaving=Math.round(monthlySaving/4.345);
  const progressPercent=targetAmount>0?Math.min(100,(currentSavings/targetAmount)*100):0;

  return (
    <>
      <Title icon="airplane-outline" title="Chọn điểm đến muốn ghé" sub="Dựa trên các địa điểm trong mục Khám phá Nhật Bản." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:2}}>
        {regions.map(r=><Pressable key={r} onPress={()=>setRegion(r)} style={[st.pill,region===r&&st.pillOn]}><Text style={[st.pillT,region===r&&{color:'#fff'}]}>{r}</Text></Pressable>)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:8}}>
        {prefectures.map(p=><Pressable key={p} onPress={()=>setPrefecture(p)} style={[st.pill,prefecture===p&&st.pillOn]}><Text style={[st.pillT,prefecture===p&&{color:'#fff'}]}>{p}</Text></Pressable>)}
      </ScrollView>
      {spotsHere.map(s=>(
        <Pressable key={s.place} style={[st.spotPick,spot?.place===s.place&&st.spotPickOn]} onPress={()=>setSpot(s)}>
          <Text style={[st.spotPickT,spot?.place===s.place&&{color:'#fff'}]}>{s.place}</Text>
          {spot?.place===s.place&&<Ionicons name="checkmark-circle" size={16} color="#fff" />}
        </Pressable>
      ))}
      <Pressable style={st.exploreLink} onPress={()=>router.push('/explore-japan')}>
        <Ionicons name="compass-outline" size={15} color={C.ink} /><Text style={st.exploreLinkT}>Xem chi tiết địa điểm ở Khám phá Nhật Bản</Text>
      </Pressable>

      <Title icon="wallet-outline" title="Ngân sách chuyến đi" sub="Tự tính theo số tiền và thời gian bạn nhập, không cần kết nối máy chủ." />
      <View style={st.formGrid}>
        <Field label="Ngân sách dự kiến" value={budget} onChange={setBudget} suffix="₫" />
        <Field label="Đã tiết kiệm" value={saved} onChange={setSaved} suffix="₫" />
        <Field label="Muốn đạt trong" value={months} onChange={setMonths} suffix="tháng" />
      </View>

      <View style={{gap:14,marginTop:18}}>
        <View style={st.resultCard}>
          <Text style={st.resultKicker}>QUỸ CHUYẾN ĐI{spot?` · ${spot.place}`:''}</Text>
          <Text style={st.resultBig}>{Math.round(progressPercent)}%</Text>
          <View style={st.progress}><View style={[st.progressOn,{width:`${Math.max(2,progressPercent)}%` as any}]} /></View>
          <Text style={st.resultText}>Còn <Text style={st.strong}>{money(gap)}</Text> · nên dành <Text style={st.strong}>{money(monthlySaving)}/tháng</Text></Text>
          <Text style={st.resultText}>Tương đương khoảng {money(weeklySaving)}/tuần trong {monthCount} tháng.</Text>
          {!!spot&&<Text style={st.resultText}>Gợi ý chụp ảnh đẹp: {spot.tip}</Text>}
        </View>
      </View>
    </>
  );
}

const st=StyleSheet.create({
  hero:{flexDirection:'row',gap:12,backgroundColor:C.inverseSurface,borderRadius:18,padding:18,marginTop:6},
  eyebrow:{fontFamily:F.bodyX,fontSize:10,letterSpacing:1.2,color:'rgba(255,255,255,0.70)'},
  heroTitle:{fontFamily:F.display,fontSize:19,lineHeight:27,color:'#fff',marginTop:6},
  heroSub:{fontFamily:F.body,fontSize:11.5,lineHeight:18,color:'rgba(255,255,255,0.70)',marginTop:7},
  tabs:{flexDirection:'row',gap:8,marginTop:16},
  tab:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,borderWidth:1,borderColor:C.line,borderRadius:12,paddingVertical:10,backgroundColor:C.card},
  tabOn:{backgroundColor:C.primary,borderColor:C.primary},
  tabT:{fontFamily:F.bodyB,fontSize:11.5,color:C.muted},
  titleRow:{flexDirection:'row',alignItems:'center',gap:10,marginTop:22,marginBottom:10},
  titleIcon:{width:36,height:36,borderRadius:11,backgroundColor:C.primary,alignItems:'center',justifyContent:'center'},
  title:{fontFamily:F.display,fontSize:16,color:C.sumi},sub:{fontFamily:F.body,fontSize:10.5,lineHeight:16,color:C.muted,marginTop:1},
  product:{width:124,borderRadius:14,borderWidth:1,borderColor:C.line,backgroundColor:C.card,padding:7},
  productOn:{borderWidth:2,borderColor:C.primary},productImg:{width:'100%',height:112,borderRadius:10},
  productName:{fontFamily:F.bodyB,fontSize:11.5,lineHeight:16,color:C.ink,minHeight:34,marginTop:6},productPrice:{fontFamily:F.bodyX,fontSize:11,color:C.ink,marginTop:2},
  check:{position:'absolute',right:10,top:10,width:24,height:24,borderRadius:12,backgroundColor:C.primary,alignItems:'center',justifyContent:'center'},
  selected:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:C.washi2,borderRadius:14,padding:10,marginTop:10},selectedImg:{width:50,height:60,borderRadius:9},
  selectedName:{fontFamily:F.bodyB,fontSize:12.5,color:C.ink},selectedPrice:{fontFamily:F.bodyX,fontSize:12,color:C.ink,marginTop:3},view:{fontFamily:F.bodyB,fontSize:12,color:C.ink},
  formGrid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:10},fieldWrap:{width:'48%'},fieldLabel:{fontFamily:F.bodyB,fontSize:10.5,color:C.ink,marginBottom:5},
  choiceRow:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:12},
  choice:{borderWidth:1,borderColor:C.line,borderRadius:999,paddingVertical:8,paddingHorizontal:12,backgroundColor:C.card},
  choiceOn:{backgroundColor:C.primary,borderColor:C.primary},choiceText:{fontFamily:F.bodyB,fontSize:10.5,color:C.ink},choiceTextOn:{color:'#fff'},
  field:{height:46,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:C.line,borderRadius:12,backgroundColor:C.card,paddingHorizontal:11},input:{flex:1,fontFamily:F.bodyB,fontSize:13,color:C.ink},suffix:{fontFamily:F.body,fontSize:11,color:C.muted},
  safety:{fontFamily:F.body,fontSize:10.5,lineHeight:17,color:C.muted,backgroundColor:C.washi2,borderRadius:10,padding:10,marginTop:10},
  provenance:{fontFamily:F.bodyX,fontSize:10,letterSpacing:0.6,color:C.primary,marginTop:12,textTransform:'uppercase'},
  screenBlock:{marginTop:10},
  screenQ:{fontFamily:F.bodyB,fontSize:12,lineHeight:19,color:C.ink,marginBottom:6},
  loading:{flexDirection:'row',alignItems:'center',gap:8,justifyContent:'center',padding:12},loadingText:{fontFamily:F.body,fontSize:11,color:C.muted,flex:1},error:{fontFamily:F.bodyB,fontSize:12,color:C.danger,textAlign:'center',marginTop:10},
  resultCard:{backgroundColor:C.card,borderWidth:1,borderColor:C.line,borderRadius:16,padding:15},resultKicker:{fontFamily:F.bodyX,fontSize:10.5,letterSpacing:1,color:C.ink},resultBig:{fontFamily:F.displayX,fontSize:30,color:C.sumi,marginTop:5},
  progress:{height:9,borderRadius:5,backgroundColor:C.hair,overflow:'hidden',marginVertical:9},progressOn:{height:'100%',borderRadius:5,backgroundColor:C.matcha},resultText:{fontFamily:F.body,fontSize:12,lineHeight:19,color:C.ink},strong:{fontFamily:F.bodyX,color:C.ink},item:{fontFamily:F.body,fontSize:11.5,lineHeight:19,color:C.ink,marginTop:6},
  metricRow:{flexDirection:'row',gap:8,marginVertical:12},metric:{flex:1,alignItems:'center',backgroundColor:C.washi2,borderRadius:11,padding:9},metricN:{fontFamily:F.display,fontSize:20,color:C.sumi},metricL:{fontFamily:F.body,fontSize:9.5,color:C.muted,textAlign:'center'},warning:{fontFamily:F.bodyB,fontSize:10.5,lineHeight:17,color:C.shuDeep,backgroundColor:C.washi2,borderRadius:10,padding:9},
  coachTitle:{fontFamily:F.display,fontSize:17,lineHeight:25,color:'#fff',marginTop:10},identity:{fontFamily:F.bodyB,fontSize:12.5,lineHeight:20,color:'rgba(255,255,255,0.70)',marginTop:10},coachSub:{fontFamily:F.bodyX,fontSize:11,color:'#fff',marginTop:13,marginBottom:3},coachItem:{fontFamily:F.body,fontSize:11.5,lineHeight:19,color:C.line,marginTop:4},question:{fontFamily:F.bodyB,fontSize:12,lineHeight:20,color:'rgba(255,255,255,0.70)',borderTopWidth:1,borderTopColor:C.muted,paddingTop:10,marginTop:12},disclaimer:{fontFamily:F.body,fontSize:10.5,lineHeight:17,color:'#B9B2AA',textAlign:'center',marginTop:10},
  pill:{borderWidth:1,borderColor:C.line,borderRadius:999,paddingVertical:8,paddingHorizontal:13,backgroundColor:C.card},pillOn:{backgroundColor:C.primary,borderColor:C.primary},pillT:{fontFamily:F.bodyM,fontSize:11.5,color:C.ink},
  spotPick:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderWidth:1,borderColor:C.line,borderRadius:12,paddingVertical:11,paddingHorizontal:13,backgroundColor:C.card,marginBottom:8},
  spotPickOn:{backgroundColor:C.primary,borderColor:C.primary},spotPickT:{fontFamily:F.bodyM,fontSize:12.5,color:C.ink},
  exploreLink:{flexDirection:'row',alignItems:'center',gap:7,marginTop:2,marginBottom:6},exploreLinkT:{fontFamily:F.bodyB,fontSize:11.5,color:C.ink},
  fundBig:{fontFamily:F.displayX,fontSize:24,color:C.sumi,marginTop:7},fundTarget:{fontFamily:F.body,fontSize:13,color:C.muted},
  fundHint:{fontFamily:F.body,fontSize:11,lineHeight:17,color:C.muted,marginTop:9},
  quickRow:{flexDirection:'row',gap:7,marginTop:10},
  quick:{flex:1,alignItems:'center',borderWidth:1,borderColor:C.line,borderRadius:10,paddingVertical:9,backgroundColor:C.washi2},
  quickT:{fontFamily:F.bodyB,fontSize:11.5,color:C.ink},
  depositRow:{flexDirection:'row',gap:8,marginTop:9,alignItems:'center'},
  depositBtn:{backgroundColor:C.primary,borderRadius:12,height:46,paddingHorizontal:15,alignItems:'center',justifyContent:'center'},
  depositBtnT:{fontFamily:F.bodyB,fontSize:12.5,color:'#fff'},
  ledgerNote:{fontFamily:F.body,fontSize:10,lineHeight:15,color:C.muted,marginTop:8,fontStyle:'italic'},
  ledgerToggle:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderTopWidth:1,borderTopColor:C.hair,marginTop:12,paddingTop:10},
  ledgerToggleT:{fontFamily:F.bodyB,fontSize:11.5,color:C.ink},
  ledgerRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8,borderBottomWidth:1,borderBottomColor:C.hair},
  ledgerAmount:{fontFamily:F.bodyX,fontSize:12.5,color:C.ink},ledgerMeta:{fontFamily:F.body,fontSize:10.5,color:C.muted,marginTop:2},
  rewardBox:{backgroundColor:C.okSoft,borderWidth:1,borderColor:'#CBE3CC',borderRadius:13,padding:12,marginTop:11},
  rewardTitle:{fontFamily:F.bodyB,fontSize:12.5,color:'#25603A'},
  rewardCode:{fontFamily:F.displayX,fontSize:19,letterSpacing:1,color:'#1F6B44',marginTop:6},
  rewardBody:{fontFamily:F.body,fontSize:11,lineHeight:17,color:'#3C6A4C',marginTop:5},
  achieved:{flexDirection:'row',alignItems:'center',gap:6,marginTop:9},
  achievedT:{flex:1,fontFamily:F.bodyB,fontSize:11,lineHeight:16,color:'#1F6B44'},
});
