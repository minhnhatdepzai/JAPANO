/* ============ JAPANO ADMIN — bảng điều khiển dữ liệu vận hành ============ */
const LS='japano_admin_db_v1';
const API=(location.protocol==='file:'?'http://localhost:4100':'')+'/api';
let NET_OK=true;

/* ============ AUTH — JWT thật (bcrypt+JWT ở backend/lib/auth.js) ============
 * Trước đây admin không có đăng nhập gì cả — ai vào URL cũng sửa được toàn bộ
 * dữ liệu. Giờ mọi request tới API tự đính Authorization nếu đã đăng nhập, và
 * ensureAdminSession() chặn bootstrap() cho tới khi xác thực xong với role=admin. */
const ADMIN_TOKEN_KEY='japano_admin_token';
let ADMIN_TOKEN=localStorage.getItem(ADMIN_TOKEN_KEY)||'';
let ADMIN_USER=null;
const PANEL_ROLES=['staff','admin','super_admin'];
let STAFF_ONLY=false;
const isSuperAdmin=()=>ADMIN_USER?.role==='super_admin';
function setAdminToken(token){
  ADMIN_TOKEN=token||'';
  if(token)localStorage.setItem(ADMIN_TOKEN_KEY,token);else localStorage.removeItem(ADMIN_TOKEN_KEY);
}
const _nativeFetch=window.fetch.bind(window);
window.fetch=function(input,init){
  const url=typeof input==='string'?input:(input&&input.url)||'';
  if(ADMIN_TOKEN&&url.startsWith(API)){
    const headers=new Headers((init&&init.headers)||(typeof input!=='string'&&input.headers)||{});
    headers.set('Authorization','Bearer '+ADMIN_TOKEN);
    init={...(init||{}),headers};
  }
  return _nativeFetch(input,init);
};
const ROLE_LABEL={super_admin:'Super Admin',admin:'Quản trị viên',staff:'Nhân viên'};
function applyAdminUser(user){
  ADMIN_USER=user;
  STAFF_ONLY=user?.role==='staff';
  const nameEl=document.getElementById('whoName'),emailEl=document.getElementById('whoEmail');
  if(nameEl)nameEl.textContent=user?.name||'Quản trị JAPANO';
  if(emailEl)emailEl.textContent=ROLE_LABEL[user?.role]||'Quản trị viên';
  applyRoleScope();
}
function applyRoleScope(){
  const nav=document.getElementById('nav');
  if(!nav)return;
  const allow=STAFF_ONLY?new Set(['products']):null;
  let lastGrp=null,lastGrpVisible=false;
  [...nav.children].forEach(el=>{
    if(el.classList.contains('grp')){
      if(lastGrp)lastGrp.style.display=lastGrpVisible?'':'none';
      lastGrp=el;lastGrpVisible=false;
    }else if(el.tagName==='A'){
      const show=!allow||allow.has(el.dataset.route);
      el.style.display=show?'':'none';
      if(show)lastGrpVisible=true;
    }
  });
  if(lastGrp)lastGrp.style.display=lastGrpVisible?'':'none';
  if(STAFF_ONLY){
    state.route='products';
    document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.route==='products'));
  }
}
function showAuthGate(message){
  const gate=document.getElementById('authGate'),err=document.getElementById('authGateError');
  if(err)err.textContent=message||'';
  if(gate)gate.classList.add('show');
}
function hideAuthGate(){
  const gate=document.getElementById('authGate'),err=document.getElementById('authGateError');
  if(gate)gate.classList.remove('show');
  if(err)err.textContent='';
}
let _authGateWired=false;
function wireAuthGate(onSuccess){
  if(_authGateWired)return;
  _authGateWired=true;
  document.getElementById('authGateForm').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const email=document.getElementById('authGateEmail').value.trim();
    const password=document.getElementById('authGatePassword').value;
    const btn=document.getElementById('authGateSubmit');
    btn.disabled=true;btn.textContent='Đang đăng nhập…';
    try{
      const r=await _nativeFetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      const body=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(body?.message||'Đăng nhập thất bại.');
      if(!PANEL_ROLES.includes(body?.user?.role))throw new Error('Tài khoản này không có quyền quản trị.');
      setAdminToken(body.token);
      applyAdminUser(body.user);
      hideAuthGate();
      onSuccess();
    }catch(err){
      showAuthGate(err.message||'Đăng nhập thất bại.');
    }finally{
      btn.disabled=false;btn.textContent='Đăng nhập';
    }
  });
  const logoutBtn=document.getElementById('logoutBtn');
  if(logoutBtn)logoutBtn.addEventListener('click',()=>{setAdminToken('');location.reload();});
}
function ensureAdminSession(){
  return new Promise((resolve)=>{
    wireAuthGate(resolve);
    if(!ADMIN_TOKEN){showAuthGate();return;}
    _nativeFetch(API+'/auth/me',{headers:{Authorization:'Bearer '+ADMIN_TOKEN}})
      .then(async(r)=>{
        const body=await r.json().catch(()=>({}));
        if(!r.ok||!PANEL_ROLES.includes(body?.user?.role))throw new Error('unauthorized');
        applyAdminUser(body.user);
        resolve();
      })
      .catch(()=>{setAdminToken('');showAuthGate();});
  });
}
let ANALYTICS=null,ANALYTICS_STATUS='idle';
let HEALTH={checked:false,api:null,database:null,mongo:null,cloudinary:null,ai:null,stripe:null,vnpay:null,gateway:null,catvton:null,ollama:null,pillow:null,fotor:null,raw:null,aiRaw:null};
const CATS=[
  {id:'ao-truyen-thong',name:'Áo truyền thống',kanji:'着物'},
  {id:'haori',name:'Áo khoác',kanji:'羽織'},
  {id:'trang-phuc',name:'Trang phục',kanji:'制服'},
  {id:'phu-kien',name:'Phụ kiện',kanji:'小物'},
  {id:'cosplay',name:'Trang phục hóa thân',kanji:'コス'},
];
const PALETTE=['#1A1410','#A33A2F','#243244','#6B7255','#B08D3C','#D98A93','#7C3AED','#0EA5E9','#F59E0B','#111827','#E5E7EB','#FFFFFF'];
const SIZES=['S','M','L','XL','XXL','XXXL','4XL','5XL'];

function emptyDB(){return{
  seeded:false, apiDown:false,
  shop:{name:'JAPANO Store',hotline:'1900 6868',email:'shop@japano.vn',address:'123 Lê Lợi, P. Bến Nghé, HCM',shipFee:30000,cod:true,stripe:true,vnpay:true,logo:null},
  integrations:{mongo:true,cloudinary:true,ai:true},
  categories:JSON.parse(JSON.stringify(CATS)),
  products:[],orders:[],payments:[],returnRequests:[],carts:[],reviews:[],reviewReactions:[],moderationSamples:[],users:[],addresses:[],wishlists:[],notifications:[],vouchers:[],banners:[],
  flagcards:[],flagcardCollections:[],vipMemberships:[],
  flagcardConfig:{active:true,qualifyingOrderMin:5000000,requiredCards:7,rewardPercent:50,rewardVoucherMinOrder:0,rewardValidityDays:90}
};}
let DB=load();
function load(){try{const r=localStorage.getItem(LS);return r?JSON.parse(r):emptyDB();}catch(e){return emptyDB();}}
function statusValue(v){
  if(typeof v==='boolean')return v;
  if(typeof v==='number')return v>0;
  if(typeof v==='string'){
    const s=v.toLowerCase();
    if(['ok','up','ready','online','connected','enabled','healthy','running'].includes(s))return true;
    if(['down','offline','disconnected','disabled','error','failed','unhealthy'].includes(s))return false;
  }
  if(v&&typeof v==='object'){
    for(const k of ['ok','connected','ready','online','enabled','available','healthy'])if(k in v)return statusValue(v[k]);
    if('status' in v)return statusValue(v.status);
  }
  return null;
}
function firstStatus(...values){for(const v of values){const s=statusValue(v);if(s!==null)return s;}return null;}
function anyStatus(...values){const statuses=values.map(statusValue).filter(v=>v!==null);return statuses.includes(true)?true:statuses.includes(false)?false:null;}
function cleanSeries(value){
  const rows=Array.isArray(value)?value:(value&&typeof value==='object'?Object.entries(value).map(([label,v])=>({label,value:v})):[]);
  return rows.map((row,i)=>typeof row==='number'?{label:String(i+1),value:row}:{
    label:String(row?.label??row?.period??row?.month??row?.date??i+1),
    value:Number(row?.value??row?.revenue??row?.amount??row?.total??0)||0,
    forecast:Boolean(row?.forecast||row?.predicted||row?.type==='forecast')
  });
}
function normalizeAnalyticsPayload(raw){
  const root=raw?.analytics||raw?.dashboard?.ml||raw?.ml||raw?.dashboard||raw||{};
  const by=root.revenueByPeriod||root.revenue||{};
  return {...root,
    revenueByPeriod:{
      day:cleanSeries(by.day),week:cleanSeries(by.week),month:cleanSeries(by.month),year:cleanSeries(by.year)
    },
    revenueForecast:root.revenueForecast||root.forecast||null,
    predictions:Array.isArray(root.predictions)?root.predictions:[],
    categoryTrends:Array.isArray(root.categoryTrends)?root.categoryTrends:(Array.isArray(root.customerTrends)?root.customerTrends:[]),
    customerTrends:Array.isArray(root.customerTrends)?root.customerTrends:(Array.isArray(root.categoryTrends)?root.categoryTrends:[]),
    segments:root.segments||null,
    inventoryRisks:Array.isArray(root.inventoryRisks)?root.inventoryRisks:[],
    churnRisks:Array.isArray(root.churnRisks)?root.churnRisks:[],
    marketBasketRules:Array.isArray(root.marketBasketRules)?root.marketBasketRules:[],
    recommendationPipeline:root.recommendationPipeline||null,
    botIntelligence:root.botIntelligence||null,
    models:Array.isArray(root.models)?root.models:[]
  };
}
async function requestJSON(path,ms=5000,options){
  const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),ms);
  try{const r=await fetch(API+path,{...(options||{}),signal:ctrl.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}
  finally{clearTimeout(t);}
}
async function refreshHealth(render=false){
  const [baseResult,aiResult]=await Promise.allSettled([requestJSON('/health',4000),requestJSON('/ai/health',4000)]);
  const h=baseResult.status==='fulfilled'?baseResult.value:null;
  const ah=aiResult.status==='fulfilled'?aiResult.value:null;
  const hi=h?.integrations||h?.services||{};const ais=ah?.services||ah?.integrations||{};
  HEALTH={
    checked:true,
    api:baseResult.status==='fulfilled'&&statusValue(h?.ok)!==false,
    database:firstStatus(h?.database?.connected,h?.database),
    mongo:firstStatus(hi.mongo,hi.mongodb,h?.mongo,h?.mongodb,h?.mongoConnected),
    cloudinary:firstStatus(hi.cloudinary,hi.media,h?.cloudinaryEnabled,h?.cloudinary),
    ai:firstStatus(ah?.ok,ais.gateway,ais.ollama,ais.catvton,ais.pillow,ah?.gateway,ah?.aiGateway,hi.aiGateway,h?.aiGateway),
    stripe:firstStatus(hi.stripe,h?.stripe?.enabled),
    vnpay:firstStatus(hi.vnpay,h?.vnpay?.enabled),
    gateway:firstStatus(ais.gateway,ah?.gateway,ah?.aiGateway),
    catvton:firstStatus(ais.catvton,ah?.catvton),
    ollama:firstStatus(ais.ollama,ah?.ollama),
    pillow:firstStatus(ais.pillow,ah?.pillow,ah?.fallbackReady),
    fotor:firstStatus(ah?.fotor,ais.fotor,h?.fotorEnabled,h?.fotor,hi.fotor),
    raw:h,aiRaw:ah
  };
  if(render){refreshChrome();if(state.route==='settings')renderView();}
  return HEALTH;
}
async function refreshAnalytics(render=false){
  try{ANALYTICS=normalizeAnalyticsPayload(await requestJSON('/analytics?scope='+encodeURIComponent(state.dataScope||'live'),6500));ANALYTICS_STATUS='ready';}
  catch(e){ANALYTICS_STATUS=ANALYTICS?'stale':'error';}
  if(render&&state.route==='dashboard')renderView();
  return ANALYTICS;
}
let _analyticsT;
function scheduleAnalyticsRefresh(delay=450){clearTimeout(_analyticsT);_analyticsT=setTimeout(()=>refreshAnalytics(true),delay);}
let _syncT;
function save(){localStorage.setItem(LS,JSON.stringify(DB));
  clearTimeout(_syncT);_syncT=setTimeout(()=>{fetch(API+'/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(DB)}).then(r=>{if(!r.ok)throw 0;if(!NET_OK){NET_OK=true;refreshChrome();}scheduleAnalyticsRefresh();}).catch(()=>{if(NET_OK){NET_OK=false;refreshChrome();}});},250);}
async function bootstrapStaff(){
  $('#pageTitle').textContent=TITLES.products;
  try{DB=emptyDB();DB.products=await requestJSON('/staff/products',8000);DB.seeded=true;NET_OK=true;}
  catch(e){DB=emptyDB();NET_OK=false;}
  refreshChrome();renderView();
}
async function bootstrap(){
  if(STAFF_ONLY)return bootstrapStaff();
  $('#pageTitle').textContent=TITLES.dashboard;
  try{DB=await requestJSON('/state',6000);NET_OK=true;}
  catch(e){DB=load();NET_OK=false;}
  await Promise.all([refreshHealth(false),refreshAnalytics(false)]);
  refreshChrome();renderView();}
let _liveSyncBusy=false;
let _stripeSyncAt=0;
let _vnpaySyncAt=0;
async function syncLiveSales(render=true){
  if(STAFF_ONLY||_liveSyncBusy||document.hidden||$('#overlay')?.classList.contains('show'))return;
  _liveSyncBusy=true;
  try{
    const needsStripeSync=(DB.payments||[]).some(p=>p.provider==='stripe'&&(p.status==='pending'||p.status==='refund_pending'));
    if(needsStripeSync&&Date.now()-_stripeSyncAt>15000){
      _stripeSyncAt=Date.now();
      await fetch(API+'/stripe/reconcile',{method:'POST'}).catch(()=>null);
    }
    const needsVnpaySync=(DB.payments||[]).some(p=>p.provider==='vnpay'&&p.status==='pending'&&Date.now()-Number(p.createdAt||0)>60000);
    if(needsVnpaySync&&Date.now()-_vnpaySyncAt>15000){
      _vnpaySyncAt=Date.now();
      await fetch(API+'/vnpay/reconcile',{method:'POST'}).catch(()=>null);
    }
    const live=await requestJSON('/admin/live',5000);
    for(const key of ['orders','payments','returnRequests','interactions','carts','reviews','reviewReactions','users'])if(Array.isArray(live[key]))DB[key]=live[key];
    if(live.shop)DB.shop={...DB.shop,...live.shop};
    NET_OK=true;localStorage.setItem(LS,JSON.stringify(DB));refreshChrome();
    if(render&&['dashboard','orders','payments','returns','reviews','users'].includes(state.route))renderView();
    if(state.route==='dashboard')void refreshAnalytics(true);
  }catch(e){NET_OK=false;refreshChrome();}
  finally{_liveSyncBusy=false;}
}
setInterval(()=>void syncLiveSales(true),3000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void syncLiveSales(true);});
let state={route:'dashboard',oStatus:'all',payStatus:'all',payQuery:'',returnStatus:'all',returnQuery:'',pStatus:'all',reviewStatus:'all',uRole:'all',revSpan:'week',dataScope:'live'};

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const money=n=>Math.round(n).toLocaleString('vi-VN')+'₫';
const kd=n=> n>=1e6?(n/1e6).toFixed(n%1e6?1:0)+'tr': n>=1e3?Math.round(n/1e3)+'k':''+n;
const rand=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pick=a=>a[rand(0,a.length-1)];
const catName=id=>(DB.categories.find(c=>c.id===id)||{}).name||id;
const catKanji=id=>(CATS.find(c=>c.id===id)||{}).kanji||'';
function esc(s){return(''+(s??'')).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function stock(p){return (p.variants||[]).reduce((s,v)=>s+(+v.stock||0),0);}
function effStatus(p){ if(p.status==='published' && stock(p)===0) return 'out'; return p.status; }
function buyable(p){ return effStatus(p)==='published'; }
function fmtDate(t){const d=new Date(t);return d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});}
function ago(t){const s=(Date.now()-t)/1000;if(s<3600)return Math.floor(s/60)+' phút';if(s<86400)return Math.floor(s/3600)+' giờ';return Math.floor(s/86400)+' ngày';}
function findProductForItem(item={}){
  const refs=[item.productId,item.productID,item.slug,item.sku,item.product?.id,item.product?.slug].filter(v=>v!==undefined&&v!==null&&v!=='').map(String);
  let product=DB.products.find(p=>[p.id,p.slug,p.sku,p.productId].filter(Boolean).map(String).some(v=>refs.includes(v)));
  if(!product&&item.name){const name=String(item.name).trim().toLowerCase();product=DB.products.find(p=>String(p.name||p.productName||'').trim().toLowerCase()===name);}
  return product||null;
}
function orderItemKey(item){const p=findProductForItem(item);return String(p?.id||p?.slug||item.productId||item.slug||item.sku||item.name||'unknown');}

const ORD={pending:{t:'Chờ xử lý',c:'b-amber'},pending_payment:{t:'Chờ thanh toán',c:'b-amber'},confirmed:{t:'Đã xác nhận',c:'b-blue'},shipping:{t:'Đang giao',c:'b-blue'},completed:{t:'Hoàn tất',c:'b-green'},returned:{t:'Đã trả hàng',c:'b-violet'},cancelled:{t:'Đã huỷ',c:'b-red'}};
const PAY={paid:{t:'Đã thanh toán',c:'b-green'},pending:{t:'Đang chờ thanh toán',c:'b-amber'},unpaid:{t:'Chưa TT',c:'b-gray'},refund_pending:{t:'Đang hoàn tiền',c:'b-amber'},partially_refunded:{t:'Hoàn một phần',c:'b-blue'},refunded:{t:'Đã hoàn tiền',c:'b-violet'},failed:{t:'Thất bại',c:'b-red'},cancelled:{t:'Đã huỷ',c:'b-gray'},succeeded:{t:'Thành công',c:'b-green'}};
const RET={requested:{t:'Chờ duyệt',c:'b-amber'},approved:{t:'Đã duyệt',c:'b-blue'},received:{t:'Đã nhận hàng',c:'b-green'},refund_pending:{t:'Đang hoàn tiền',c:'b-amber'},refunded:{t:'Đã hoàn tiền',c:'b-violet'},refund_failed:{t:'Hoàn tiền lỗi',c:'b-red'},rejected:{t:'Từ chối',c:'b-red'},cancelled:{t:'Đã huỷ',c:'b-gray'}};
const PST={published:{t:'Đang bán',c:'b-green'},hidden:{t:'Đã ẩn',c:'b-gray'},draft:{t:'Nháp',c:'b-amber'},out:{t:'Hết hàng',c:'b-red'}};
const ROLE={super_admin:{t:'Super Admin',c:'b-red'},admin:{t:'Admin',c:'b-violet'},staff:{t:'Nhân viên',c:'b-blue'},customer:{t:'Khách',c:'b-gray'}};
const badge=(m,k)=>`<span class="bdg ${m[k]?.c||'b-gray'}"><span class="d"></span>${m[k]?.t||k}</span>`;
const thumb=(p,cls='')=>{const src=(p.images||[])[0]||p.image;return src?`<img class="thumb ${cls}" src="${esc(src)}" alt="${esc(p.name||'Sản phẩm')}" loading="lazy">`:`<div class="thumb ${cls}" style="background:${p.colorHex||'#8A2F26'}">${esc(catKanji(p.cat))}</div>`;};

/* ---------- toast / modal ---------- */
function toast(msg,type='ok'){const t=document.createElement('div');t.className='toast '+type;
  const ic=type==='ok'?'✓':type==='err'?'!':'i';
  t.innerHTML=`<span class="ti">${ic}</span><span>${esc(msg)}</span>`;$('#toasts').appendChild(t);
  setTimeout(()=>{t.style.transition='.25s';t.style.opacity='0';t.style.transform='translateY(8px)';setTimeout(()=>t.remove(),260);},2200);}
function openModal(html,cls=''){const o=$('#overlay');o.innerHTML=`<div class="modal ${cls}">${html}</div>`;o.classList.add('show');}
function openDrawer(html){const o=$('#overlay');o.innerHTML=`<div class="drawer">${html}</div>`;o.classList.add('show');}
function closeModal(){$('#overlay').classList.remove('show');setTimeout(()=>{if(!$('#overlay').classList.contains('show'))$('#overlay').innerHTML='';},180);}
$('#overlay')?.addEventListener('click',e=>{if(e.target.id==='overlay')closeModal();});
function confirmModal(title,msg,onOk,danger){
  openModal(`<div class="mh"><h3>${esc(title)}</h3><div class="x" onclick="closeModal()">✕</div></div>
  <div class="mb"><p class="muted" style="font-size:13px">${msg}</p></div>
  <div class="mf"><button class="btn" onclick="closeModal()">Huỷ</button>
  <button class="btn ${danger?'d':'p'}" id="cfmOk">${danger?'Xoá':'Xác nhận'}</button></div>`);
  $('#cfmOk').onclick=()=>{closeModal();onOk&&onOk();};
}

/* ---------- charts ---------- */
function bars(data,clickSpan=''){const max=Math.max(1,...data.map(d=>d.value));
  return `<div class="bars">${data.map((d,index)=>`<div class="col ${clickSpan?'clickable':''}" ${clickSpan?`onclick="A.revPoint('${clickSpan}',${index})"`:''} title="${esc(d.label)} · ${money(d.value)}${d.forecast?' · dự báo':''}"><div class="bv">${d.value?kd(d.value):'0'}</div><div class="bar ${d.forecast?'forecast':''}" style="height:${Math.max(3,d.value/max*100)}%"></div><div class="bl">${esc(d.label)}</div></div>`).join('')}</div>`;}
function donut(segs,interactive=false){const tot=segs.reduce((s,x)=>s+x.value,0)||1;let a=0;const stops=segs.map(s=>{const from=a/tot*360;a+=s.value;const to=a/tot*360;return `${s.color} ${from}deg ${to}deg`;}).join(',');
  return `<div style="display:flex;gap:18px;align-items:center">
   <div class="donut" style="background:conic-gradient(${stops})"><div class="hole"><div><div style="font-size:18px;font-weight:800">${tot}</div><div class="faint" style="font-size:10px">đơn</div></div></div></div>
   <div class="legend">${segs.map(s=>`<div class="li" ${interactive&&s.status?`onclick="A.orderDrill('${s.status}')" style="cursor:pointer;padding:5px;border-radius:6px"`:''}><span class="sw" style="background:${s.color}"></span>${esc(s.label)}<span class="val">${s.value}</span></div>`).join('')}</div></div>`;}
function hbars(items){const max=Math.max(1,...items.map(i=>i.value));
  return `<div class="hbar">${items.map(i=>`<div class="r"><div class="nm" title="${esc(i.name)}">${esc(i.name)}</div><div class="track"><div class="fill" style="width:${i.value/max*100}%;${i.color?'background:'+i.color:''}"></div></div><div class="v">${i.fmt||i.value}</div></div>`).join('')}</div>`;}
function sourceFlag(demo=false,local=false){
  if(demo||state.dataScope==='all')return '<span class="dataflag demo">Gồm dữ liệu mẫu</span>';
  if(local)return '<span class="dataflag local">Tính từ cơ sở dữ liệu</span>';
  if(ANALYTICS_STATUS==='ready')return '<span class="dataflag">Dữ liệu thật</span>';
  if(ANALYTICS_STATUS==='stale')return '<span class="dataflag stale">Dữ liệu cũ</span>';
  return '<span class="dataflag local">Tính từ cơ sở dữ liệu</span>';
}
function modelDemo(terms=[]){
  const model=(ANALYTICS?.models||[]).find(m=>terms.some(t=>`${m.name||''} ${m.type||''} ${m.algorithm||''}`.toLowerCase().includes(t)));
  return Boolean(model?.demo||ANALYTICS?.demo);
}

/* ---------- nav counts + status dots + banner ---------- */
function refreshChrome(){
  $('#nav-orders').textContent=DB.orders.length;
  $('#nav-payments').textContent=(DB.payments||[]).length;
  $('#nav-returns').textContent=(DB.returnRequests||[]).filter(r=>!['refunded','rejected','cancelled'].includes(r.status)).length;
  $('#nav-products').textContent=DB.products.length;
  $('#nav-reviews').textContent=(DB.reviews||[]).filter(r=>r.status==='pending').length;
  $('#nav-moderation').textContent=(DB.moderationSamples||[]).filter(s=>s.label==='rejected').length;
  $('#nav-users').textContent=DB.users.length;
  if($('#nav-japan'))$('#nav-japan').textContent=JAPAN?((JAPAN.reviews||[]).length+(JAPAN.suggestions||[]).length):0;
  $('#nav-flagcards').textContent=(DB.flagcardCollections||[]).length;
  const dot=(id,on,tid,ontxt,offtxt)=>{const e=$(id);e.className='dot '+(on===true?'g':on===false?'r':'a');$(tid).textContent=on===true?ontxt:on===false?offtxt:'chưa rõ';};
  dot('#s-mongo',HEALTH.mongo,'#s-mongo-t','đã kết nối','mất kết nối');
  dot('#s-cloud',HEALTH.cloudinary,'#s-cloud-t','đã kết nối','mất kết nối');
  dot('#s-ai',HEALTH.ai,'#s-ai-t','trực tuyến','ngoại tuyến');
  const apiOn=HEALTH.checked?HEALTH.api:NET_OK;
  $('#apiDot').className='dot '+(apiOn===true?'g':apiOn===false?'r':'a');$('#apiText').textContent=apiOn===true?'API trực tuyến':apiOn===false?'API ngoại tuyến':'API chưa rõ';
  // banner
  const b=$('#banner');
  if(!NET_OK){b.innerHTML=`<div class="banner err"><div class="bi">⚠</div><div><b>Không kết nối được backend</b> — API tại <code>${API}</code> không phản hồi. Đang dùng dữ liệu tạm trên máy.</div><div class="acts"><button class="btn sm" onclick="A.toggleApi()">Thử lại</button></div></div>`;}
  else if(!DB.seeded){b.innerHTML=`<div class="banner warn"><div class="bi">◔</div><div><b>Cơ sở dữ liệu đang trống.</b> Chưa có sản phẩm, đơn hàng hay người dùng. Hãy nhập dữ liệu hiện có hoặc thêm sản phẩm thật để bắt đầu bán hàng.</div><div class="acts"><button class="btn p sm" onclick="A.addProduct()">＋ Thêm sản phẩm</button><button class="btn sm" onclick="A.importCSV()">⇪ Nhập tệp CSV</button></div></div>`;}
  else b.innerHTML='';
}

/* ---------- router ---------- */
const TITLES={dashboard:'Bảng điều khiển',orders:'Quản lý đơn hàng',payments:'Thanh toán trực tuyến',returns:'Trả hàng & hoàn tiền',products:'Quản lý sản phẩm',reviews:'Đánh giá & kiểm duyệt',moderation:'Kiểm duyệt AI — chống lách từ nhạy cảm',users:'Quản lý người dùng',japan:'Khám phá Nhật Bản — đóng góp cộng đồng',notifications:'Thông báo',categories:'Danh mục',vouchers:'Mã giảm giá',flagcards:'Chương trình thẻ địa danh',banners:'Ảnh quảng bá ứng dụng',settings:'Cài đặt hệ thống'};
function go(route){state.route=route;document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.route===route));
  $('#pageTitle').textContent=TITLES[route];refreshChrome();
  $('#content').innerHTML=skeleton(route);
  if(route==='japan')void loadJapan();
  if(route==='moderation')void loadModeration();
  clearTimeout(go._t);go._t=setTimeout(()=>renderView(),route==='dashboard'?520:380);}
let JAPAN=null,JAPAN_STATUS='idle',MOD=null,MOD_STATUS='idle';
async function loadJapan(){JAPAN_STATUS='loading';try{JAPAN=await requestJSON('/japan-spots/admin',8000);JAPAN_STATUS='ready';}catch(e){JAPAN_STATUS='error';}if(state.route==='japan')renderView();}
async function loadModeration(){MOD_STATUS='loading';try{MOD=await requestJSON('/reviews/admin',8000);MOD_STATUS='ready';}catch(e){MOD_STATUS='error';}if(state.route==='moderation')renderView();}
document.querySelectorAll('#nav a').forEach(a=>a.addEventListener('click',()=>go(a.dataset.route)));

function renderView(){
  const V={dashboard:viewDashboard,orders:viewOrders,payments:viewPayments,returns:viewReturns,products:viewProducts,reviews:viewReviews,moderation:viewModeration,users:viewUsers,japan:viewJapan,notifications:viewNotifications,categories:viewCategories,vouchers:viewVouchers,flagcards:viewFlagcards,banners:viewBanners,settings:viewSettings};
  $('#content').innerHTML=(V[state.route]||viewDashboard)();
  if(state.route==='dashboard')drawDashCharts&&drawDashCharts();
}
function errState(){return `<div class="panel"><div class="empty"><div class="art" style="background:var(--red-weak)">🔌</div><h3>Mất kết nối máy chủ</h3><p>Không gọi được API backend. Kiểm tra server Node/Express &amp; MongoDB đã chạy chưa, rồi thử lại.</p><div class="acts"><button class="btn p" onclick="A.toggleApi()">Thử kết nối lại</button><button class="btn" onclick="A.openSettings()">Mở cài đặt</button></div></div></div>`;}

/* ---------- skeletons ---------- */
function skRows(n){let r='';for(let i=0;i<n;i++)r+=`<div style="display:flex;gap:12px;align-items:center;padding:11px 14px;border-bottom:1px solid var(--line2)"><div class="sk" style="width:38px;height:44px"></div><div style="flex:1"><div class="sk" style="height:11px;width:40%;margin-bottom:7px"></div><div class="sk" style="height:9px;width:25%"></div></div><div class="sk" style="width:80px;height:22px;border-radius:99px"></div></div>`;return r;}
function skeleton(route){
  if(route==='dashboard')return `<div class="grid kpis">${Array(4).fill('<div class="kpi"><div class="sk" style="height:12px;width:50%"></div><div class="sk" style="height:24px;width:70%;margin-top:12px"></div><div class="sk" style="height:10px;width:35%;margin-top:8px"></div></div>').join('')}</div>
    <div class="grid" style="grid-template-columns:2fr 1fr;margin-top:14px"><div class="panel" style="height:260px"><div class="pb"><div class="sk" style="height:100%"></div></div></div><div class="panel" style="height:260px"><div class="pb"><div class="sk" style="height:100%"></div></div></div></div>`;
  return `<div class="filters"><div class="sk" style="height:34px;width:280px;border-radius:8px"></div><div class="sk" style="height:34px;width:120px;border-radius:8px"></div></div><div class="panel">${skRows(7)}</div>`;
}

/* ---------- global search ---------- */
$('#globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){const q=e.target.value.trim().toLowerCase();if(!q)return;
  const p=DB.products.find(x=>x.name.toLowerCase().includes(q)); if(p){go('products');return;}
  const o=DB.orders.find(x=>x.code.toLowerCase().includes(q)||x.customer.name.toLowerCase().includes(q)); if(o){go('orders');return;}
  toast('Không tìm thấy kết quả cho "'+e.target.value+'"','info');}});
$('#bellBtn').addEventListener('click',()=>go('notifications'));
$('#refreshBtn').addEventListener('click',()=>{
  const btn=$('#refreshBtn');btn.style.opacity='.5';
  Promise.all([syncLiveSales(true),state.route==='dashboard'?refreshAnalytics(true):Promise.resolve()])
    .then(()=>toast('Đã làm mới dữ liệu ✓'))
    .catch(()=>toast('Không làm mới được — kiểm tra kết nối','err'))
    .finally(()=>{btn.style.opacity='1';});
});
