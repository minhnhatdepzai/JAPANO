/* ================= SEED DEMO ================= */
const NAMES=['Trần Minh','Nguyễn Thu Hà','Lê Quốc Bảo','Phạm Mỹ Linh','Hoàng Anh Tú','Đặng Khánh Vy','Vũ Hải Nam','Bùi Ngọc Ánh','Đỗ Gia Huy','Phan Thảo My','Ngô Đức Thắng','Lý Cẩm Tú'];
const ADDR=['123 Lê Lợi, P. Bến Nghé, HCM','45 Bà Triệu, P. Hoàn Kiếm, Hà Nội','78 Trần Phú, P. Hải Châu, Đà Nẵng','12 Nguyễn Huệ, P. Bến Nghé, HCM','90 Cầu Giấy, P. Cầu Giấy, Hà Nội','56 Lê Duẩn, P. Hải Tĩnh'];
const PBASE=[
  ['Kimono truyền thống Hồng','ao-truyen-thong',1890000,2290000,'#C06A86','published'],
  ['Yukata vải bông xanh đen','ao-truyen-thong',1290000,1590000,'#243244','published'],
  ['Áo choàng Haori dáng dài','haori',1350000,1690000,'#33261d','published'],
  ['Áo len khoác dáng dài','haori',890000,1090000,'#6B7255','published'],
  ['Áo khoác kaki dáng dài','haori',990000,null,'#B08D3C','published'],
  ['Đồng phục thủy thủ nữ','trang-phuc',720000,null,'#243244','published'],
  ['Sơ mi trắng tay ngắn','trang-phuc',550000,null,'#E5E7EB','published'],
  ['Balo vải Nhật','phu-kien',490000,null,'#8A2F26','published'],
  ['Guốc gỗ Geta','phu-kien',420000,null,'#7c5a3a','draft'],
  ['Dù Nhật bản','phu-kien',350000,null,'#6B7255','published'],
  ['Trang phục hóa thân Furina','cosplay',980000,null,'#4FA3D1','published'],
  ['Trang phục hóa thân Yae Miko','cosplay',1050000,1250000,'#C0483B','hidden'],
];
function slugify(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}
function mkVariants(name,forceZero){const pre=slugify(name).slice(0,6).toUpperCase();const cols=[['Sumi','#1A1410'],['Shu','#A33A2F'],['Aizome','#243244']].slice(0,rand(1,3));
  const out=[];cols.forEach(c=>SIZES.slice(0,rand(2,4)).forEach(sz=>out.push({colorName:c[0],colorHex:c[1],size:sz,sku:`${pre}-${c[0].slice(0,2).toUpperCase()}-${sz}`,stock:forceZero?0:rand(0,40)})));return out;}
function seedDemo(){
  const now=Date.now();
  DB.products=PBASE.map((b,i)=>{const [name,cat,price,old,hex,status]=b;const forceZero=false;
    let v=mkVariants(name,false); if(name.includes('Furina')&&false){} 
    // make one product actually out of stock
    if(i===7){v=v.map(x=>({...x,stock:0}));}
    return{id:'p'+(i+1),name,sku:slugify(name).slice(0,6).toUpperCase(),cat,brand:'JAPANO',price,old,sale:null,discountPercent:old?Math.round((1-price/old)*100):0,status,colorHex:hex,
      tags:cat==='cosplay'?['cosplay','sự kiện']:['nhật bản', catName(cat).toLowerCase()],
      desc:'', story:'', images:[], videos:[], variants:v,source:'demo'};});
  // orders
  const statuses=['pending','pending','confirmed','shipping','shipping','completed','completed','completed','cancelled'];
  DB.orders=Array.from({length:14},(_,i)=>{
    const st=statuses[i%statuses.length];
    const nItems=rand(1,3);const items=Array.from({length:nItems},()=>{const p=pick(DB.products);const v=pick(p.variants);return{slug:p.id,name:p.name,colorName:v.colorName,colorHex:v.colorHex,size:v.size,qty:rand(1,2),price:p.price};});
    const total=items.reduce((s,it)=>s+it.price*it.qty,0)+DB.shop.shipFee;
    const method=pick(['COD','Stripe']);const payStat= st==='completed'?'paid': method==='Stripe'?(pick(['paid','paid','unpaid'])): (st==='cancelled'?'unpaid':'unpaid');
    const created=now-rand(0,28)*86400000-rand(0,20)*3600000;
    const order={id:'o'+(i+1),code:'JP'+ (240700+ i), customer:{name:NAMES[i%NAMES.length],phone:'09'+rand(10000000,99999999)},
      address:ADDR[i%ADDR.length],items,total,ship:DB.shop.shipFee,
      payment:{method,status:payStat,txn: method==='Stripe'? 'pi_'+Math.random().toString(36).slice(2,12):'—'},
      status:st,createdAt:created,history:[],source:'demo'};
    // history chain
    const chain=['pending','confirmed','shipping','completed'];const idx=chain.indexOf(st);
    if(st==='cancelled'){order.history=[{s:'pending',at:created},{s:'cancelled',at:created+3600000}];}
    else{order.history=chain.slice(0,idx+1).map((s,k)=>({s,at:created+k*8*3600000}));}
    return order;});
  // users
  const roles=['admin','staff','staff','customer','customer','customer','customer','customer','customer'];
  DB.users=Array.from({length:9},(_,i)=>{const name=NAMES[i];const orders=rand(0,24);return{
    id:'u'+(i+1),name,email:slugify(name).replace(/-/g,'.')+'@japano.vn',role:roles[i],status: i===6?'locked':'active',
    orders,spent:orders*rand(200000,900000),tryons:rand(0,40),vip: orders>15?'VIP':orders>6?'Thành viên':'Mới',joinedAt:now-rand(1,300)*86400000};});
  // notifications
  DB.notifications=[
    {id:'n0',title:'🚩 Sưu tầm 7 thẻ địa danh — nhận ngay mã giảm 50%!',body:'Mỗi đơn hàng đủ điều kiện tặng 1 thẻ địa danh Nhật Bản. Đủ bộ 7 thẻ, giảm ngay 50% mọi sản phẩm.',type:'Khuyến mãi',action:'flagcard-intro',reach:DB.users.length,at:now-30*60000},
    {id:'n1',title:'Ưu đãi Thu — giảm 20% Haori',body:'Cách tân tủ đồ mùa lá đỏ, dùng mã THU20',type:'Khuyến mãi',reach:DB.users.length,at:now-2*3600000},
    {id:'n2',title:'Bảo trì hệ thống 02:00–03:00',body:'App có thể gián đoạn ngắn để nâng cấp.',type:'Hệ thống',reach:DB.users.length,at:now-2*86400000},
  ];
  DB.vouchers=[
    {code:'THU20',type:'percent',value:20,min:500000,expiry:'2025-12-31',limit:500,used:132,active:true},
    {code:'FREESHIP',type:'amount',value:30000,min:0,expiry:'2025-11-30',limit:1000,used:410,active:true},
    {code:'VIP100',type:'amount',value:100000,min:1500000,expiry:'2025-12-15',limit:200,used:57,active:false},
  ];
  DB.banners=[
    {id:'b1',title:'BST Thu — Momiji',img:'#8A2F26',link:'/category/ao-truyen-thong',active:true,order:1},
    {id:'b2',title:'Cách tân Nhật Bản',img:'#243244',link:'/culture',active:true,order:2},
    {id:'b3',title:'Cosplay Fest',img:'#6D28D9',link:'/category/cosplay',active:false,order:3},
  ];
  DB.seeded=true;save();
}
function drawDashCharts(){}

/* ================= DASHBOARD ================= */
function orderTime(o){const t=new Date(o.createdAt||o.orderDate||0).getTime();return Number.isFinite(t)?t:0;}
function orderAmount(o){return Number(o.total??o.totalAmount??0)||0;}
function revenueOrder(o){const s=String(o.status||o.orderStatus||'').toLowerCase(),p=String(o.payment?.status||o.paymentStatus||'').toLowerCase();return !['cancelled','canceled','returned','refunded','failed'].includes(s)&&(p==='paid'||s==='completed');}
function isSampleOrder(o){return ['demo','admin-test'].includes(String(o.source||''))||/^o\d{1,3}$/.test(String(o.id||''))||/pi_seed_/i.test(String(o.payment?.txn||''));}
function dashboardOrders(){return state.dataScope==='all'?DB.orders:DB.orders.filter(o=>!isSampleOrder(o));}
function revenueBetween(start,end,orders=dashboardOrders()){const a=+start,b=+end;return orders.filter(o=>revenueOrder(o)&&orderTime(o)>=a&&orderTime(o)<b).reduce((sum,o)=>sum+orderAmount(o),0);}
function periodBounds(span,index,total){
  const now=new Date();let start,end;
  if(span==='day'){start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-(total-1-index));end=new Date(+start+86400000);}
  else if(span==='week'){const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),offset=(today.getDay()+6)%7,base=new Date(+today-offset*86400000);start=new Date(+base-(total-1-index)*7*86400000);end=new Date(+start+7*86400000);}
  else if(span==='month'){start=new Date(now.getFullYear(),now.getMonth()-(total-1-index),1);end=new Date(start.getFullYear(),start.getMonth()+1,1);}
  else{start=new Date(now.getFullYear()-(total-1-index),0,1);end=new Date(start.getFullYear()+1,0,1);}
  return{start,end};
}
function revenuePeriodOrders(span,index){const rows=revBy(span),bounds=periodBounds(span,index,rows.length);return{...bounds,orders:dashboardOrders().filter(o=>revenueOrder(o)&&orderTime(o)>=+bounds.start&&orderTime(o)<+bounds.end)};}
function revenueWindow(span){
  const rows=revBy(span);if(!rows.length)return{start:new Date(),end:new Date(),orders:[]};
  const first=periodBounds(span,0,rows.length),last=periodBounds(span,rows.length-1,rows.length);
  return{start:first.start,end:last.end,orders:dashboardOrders().filter(o=>revenueOrder(o)&&orderTime(o)>=+first.start&&orderTime(o)<+last.end)};
}
function revenueSummaryHTML(span){
  const data=revBy(span),windowData=revenueWindow(span),paid=windowData.orders,total=paid.reduce((sum,o)=>sum+orderAmount(o),0),average=paid.length?Math.round(total/paid.length):0;
  const best=data.reduce((winner,row)=>Number(row.value||0)>Number(winner?.value||0)?row:winner,null);
  return `<div class="chartsummary"><div class="cell" onclick="A.revenueSummary()"><span>Tổng theo biểu đồ</span><b>${money(total)}</b></div><div class="cell" onclick="A.revenueSummary()"><span>Đơn có doanh thu</span><b>${paid.length}</b></div><div class="cell" onclick="A.revenueSummary()"><span>Giá trị đơn trung bình</span><b>${money(average)}</b></div><div class="cell" onclick="A.revPoint('${escJs(span)}',${Math.max(0,data.indexOf(best))})"><span>Kỳ cao nhất · ${esc(best?.label||'—')}</span><b>${money(Number(best?.value||0))}</b></div></div>`;
}
function localRevenueBy(span){
  const now=new Date();
  if(span==='day'){
    return Array.from({length:7},(_,i)=>{const a=new Date(now.getFullYear(),now.getMonth(),now.getDate()-(6-i)),b=new Date(+a+86400000);return{label:a.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}),value:revenueBetween(a,b)};});
  }
  if(span==='week'){
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),offset=(today.getDay()+6)%7,base=new Date(+today-offset*86400000);
    return Array.from({length:8},(_,i)=>{const a=new Date(+base-(7-i)*7*86400000),b=new Date(+a+7*86400000);return{label:a.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}),value:revenueBetween(a,b)};});
  }
  if(span==='month'){
    return Array.from({length:12},(_,i)=>{const a=new Date(now.getFullYear(),now.getMonth()-(11-i),1),b=new Date(a.getFullYear(),a.getMonth()+1,1);return{label:'T'+(a.getMonth()+1)+'/'+String(a.getFullYear()).slice(-2),value:revenueBetween(a,b)};});
  }
  return Array.from({length:5},(_,i)=>{const year=now.getFullYear()-(4-i);return{label:String(year),value:revenueBetween(new Date(year,0,1),new Date(year+1,0,1))};});
}
function revBy(span){const remote=ANALYTICS?.revenueByPeriod?.[span];return Array.isArray(remote)&&remote.length?remote:localRevenueBy(span);}
function compareRevenue(current,previous){
  if(!previous)return current>0?{text:'phát sinh mới',tone:'up'}:{text:'chưa phát sinh',tone:null};
  const pct=Math.round((current-previous)/previous*100);return{text:Math.abs(pct)+'% so với kỳ trước',tone:pct>0?'up':pct<0?'down':null};
}
function monthHistory(count=12){
  const now=new Date();return Array.from({length:count},(_,i)=>{const offset=i-count+1,a=new Date(now.getFullYear(),now.getMonth()+offset,1),b=new Date(now.getFullYear(),now.getMonth()+offset+1,1);return{label:'T'+(a.getMonth()+1)+'/'+String(a.getFullYear()).slice(-2),value:revenueBetween(a,b)};});
}
function localForecast(){
  const history=monthHistory(12),ys=history.map(x=>x.value),n=ys.length,mx=(n-1)/2,my=ys.reduce((a,b)=>a+b,0)/Math.max(1,n);
  let sxy=0,sxx=0,syy=0,ssr=0;ys.forEach((y,i)=>{sxy+=(i-mx)*(y-my);sxx+=(i-mx)**2;syy+=(y-my)**2;});
  const slope=sxx?sxy/sxx:0,intercept=my-slope*mx;ys.forEach((y,i)=>{ssr+=(y-(slope*i+intercept))**2;});
  const now=new Date(),forecast=Array.from({length:3},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()+i+1,1);return{label:'T'+(d.getMonth()+1)+'/'+String(d.getFullYear()).slice(-2),value:Math.max(0,Math.round(slope*(n+i)+intercept)),forecast:true};});
  return{history,forecast,slope,r2:syy?Math.max(0,1-ssr/syy):0,mape:0,trend:slope>=0?'tăng':'giảm',algorithm:'OLS dự phòng trên doanh thu 12 tháng',demo:false,local:true,models:[{name:'Linear Regression OLS · dự phòng',weight:1}]};
}
function forecastData(){
  const remote=ANALYTICS?.revenueForecast;
  if(remote){
    const history=cleanSeries(remote.history||remote.actual||remote.revenueHistory).slice(-12);
    const forecast=cleanSeries(remote.forecast||remote.predictions||remote.nextMonths).slice(0,3).map(x=>({...x,forecast:true}));
    if(history.length||forecast.length)return{...remote,history,forecast,local:false};
  }
  return localForecast();
}
function forecastModelSummary(forecast){
  const rows=Array.isArray(forecast?.models)?forecast.models:[];
  if(!rows.length)return esc(forecast?.algorithm||'Ensemble OLS + Holt + WMA');
  return rows.map(m=>`${esc(m.name||m.key||'Mô hình')} ${Number.isFinite(Number(m.weight))?'· '+Math.round(Number(m.weight)*100)+'%':''}`).join(' · ');
}
function predictionScore(p){const raw=Number(p.score??p.demandScore??p.probability??0)||0;return Math.round((raw<=1&&raw>0?raw*100:raw)*10)/10;}
function predictionName(p){const product=DB.products.find(x=>[x.id,x.slug].filter(Boolean).map(String).includes(String(p.productId||p.id||'')));return p.name||p.productName||product?.name||p.productId||'Sản phẩm';}
function productLabel(id){const key=String(id||'');const p=DB.products.find(x=>[x.id,x.slug].filter(Boolean).map(String).includes(key));return p?.name||key||'Sản phẩm';}
function analyticsSegments(){const s=ANALYTICS?.segments;return Array.isArray(s)?s:(Array.isArray(s?.clusters)?s.clusters:[]);}
function renderPredictions(){
  const rows=(ANALYTICS?.predictions||[]).slice(0,6);if(!rows.length)return emptyMini('Chưa đủ dữ liệu dự đoán nhu cầu');
  return `<div class="tablewrap"><table class="tbl"><thead><tr><th>Sản phẩm</th><th>Nhu cầu dự đoán</th><th>Điểm</th><th>Tín hiệu</th></tr></thead><tbody>${rows.map(p=>{const f=p.features||{};return `<tr><td class="bold">${esc(predictionName(p))}</td><td>${esc(p.predictedDemand||p.demand||'Đang tính')}</td><td><span class="bdg ${predictionScore(p)>=70?'b-green':predictionScore(p)>=45?'b-amber':'b-gray'}">${predictionScore(p)} điểm</span></td><td class="faint" style="font-size:11px">Bán ${Number(f.sold||0)} · Yêu thích ${Number(f.wishlist||f.wishlists||0)} · Giỏ ${Number(f.cart||f.carts||0)}</td></tr>`;}).join('')}</tbody></table></div>`;
}
function renderCategoryTrends(){
  const rows=(ANALYTICS?.categoryTrends||[]).slice(0,7);if(!rows.length)return emptyMini('Chưa đủ tín hiệu xu hướng danh mục');
  return hbars(rows.map(r=>({name:catName(r.category||r.cat||'general'),value:Number(r.score??((r.sold||0)*3+(r.wishlists||0)*2+(r.carts||0)))||0,fmt:`${Number(r.sold||0)} bán`})));
}
function renderSegments(){
  const rows=analyticsSegments();if(!rows.length)return emptyMini('Chưa đủ khách hàng để phân khúc K-Means');
  const colors=['#A33A2F','#243244','#6B7255'];
  return `<div class="metriccards">${rows.slice(0,3).map((s,i)=>`<div class="metriccard" style="border-top:3px solid ${colors[i%colors.length]}"><div class="bold">${esc(s.name||'Nhóm '+(i+1))}</div><div class="mv">${Number(s.size||s.count||0)}</div><div class="ml">khách hàng</div><div class="faint" style="font-size:10.5px;margin-top:7px">Chi TB ${money(Number(s.avgSpend||s.averageSpend||0))}<br>${Number(s.avgOrders||s.averageOrders||0)} đơn · ${Number(s.avgRecency||s.recency||0)} ngày gần nhất</div></div>`).join('')}</div>`;
}
function renderInventoryRisks(){
  const rows=(ANALYTICS?.inventoryRisks||[]).slice(0,7);if(!rows.length)return emptyMini('Chưa phát hiện rủi ro tồn kho');
  return `<div class="tablewrap"><table class="tbl"><thead><tr><th>Sản phẩm</th><th>Tồn</th><th>Dự báo 30 ngày</th><th>Cạn kho</th><th>Mức rủi ro</th></tr></thead><tbody>${rows.map(r=>{const danger=r.inventoryRisk==='Hết hàng'||r.inventoryRisk==='Rủi ro cao';const watch=r.inventoryRisk==='Cần theo dõi';return `<tr><td class="bold">${esc(r.name||productLabel(r.productId||r.id))}</td><td>${Number(r.stock||0)}</td><td>${Number(r.forecastUnits30||0)} SP<div class="faint" style="font-size:10px">${money(Number(r.forecastRevenue30||0))}</div></td><td>${r.daysToStockout!=null&&Number.isFinite(Number(r.daysToStockout))?Number(r.daysToStockout).toFixed(1)+' ngày':Number(r.stock||0)===0?'Đã hết':'—'}</td><td><span class="bdg ${danger?'b-red':watch?'b-amber':'b-green'}">${esc(r.inventoryRisk||'Cần theo dõi')}</span></td></tr>`;}).join('')}</tbody></table></div>`;
}
function renderChurnRisks(){
  const rows=(ANALYTICS?.churnRisks||[]).slice(0,7);if(!rows.length)return emptyMini('Chưa đủ dữ liệu để ước tính churn');
  return `<div class="tablewrap"><table class="tbl"><thead><tr><th>Khách hàng</th><th>RFM</th><th>Nguy cơ</th><th>Gợi ý chăm sóc</th></tr></thead><tbody>${rows.map(r=>{const pct=Math.max(0,Math.min(100,Number(r.churnProbability||0)));const tone=r.risk==='Cao'?'b-red':r.risk==='Trung bình'?'b-amber':'b-green';return `<tr><td class="bold">${esc(r.name||r.userId||'Khách JAPANO')}<div class="faint" style="font-size:10px">${Number(r.recencyDays||0)} ngày chưa mua</div></td><td>${Number(r.frequency||0)} đơn<div class="faint" style="font-size:10px">${money(Number(r.monetary||0))}</div></td><td><span class="bdg ${tone}">${Math.round(pct)}% · ${esc(r.risk||'—')}</span></td><td class="faint" style="font-size:11px">${esc(r.action||'Theo dõi thêm hành vi mua sắm.')}</td></tr>`;}).join('')}</tbody></table></div>`;
}
function renderMarketBasket(){
  const rows=(ANALYTICS?.marketBasketRules||[]).slice(0,7);if(!rows.length)return emptyMini('Chưa đủ đơn có nhiều sản phẩm để tìm luật mua kèm');
  return `<div class="tablewrap"><table class="tbl"><thead><tr><th>Nếu khách chọn</th><th>Thường mua/phối thêm</th><th>Confidence</th><th>Lift</th><th>Support</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="bold">${esc(productLabel(r.antecedent))}</td><td>${esc(productLabel(r.consequent))}</td><td><span class="bdg ${Number(r.confidence)>=.6?'b-green':'b-blue'}">${Math.round(Number(r.confidence||0)*100)}%</span></td><td class="bold">${Number(r.lift||0).toFixed(2)}×</td><td>${(Number(r.support||0)*100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>`;
}
function renderSearchIntelligence(){
  const s=ANALYTICS?.searchIntelligence||{};
  const rows=(s.topQueries||[]).slice(0,8);
  const table=rows.length?`<div class="tablewrap"><table class="tbl"><thead><tr><th>Từ khoá</th><th>Số lượt tìm</th><th>Không ra kết quả</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="bold">${esc(r.query)}</td><td>${Number(r.count||0)}</td><td>${r.zeroResults?`<span class="bdg b-amber">${Number(r.zeroResults)}</span>`:'—'}</td></tr>`).join('')}</tbody></table></div>`:emptyMini('Chưa có lượt tìm kiếm nào được ghi nhận');
  return `<div class="metriccards" style="margin-bottom:12px"><div class="metriccard"><div class="ml">Tổng lượt tìm (14 ngày)</div><div class="mv">${Number(s.totalSearches||0).toLocaleString('vi-VN')}</div></div><div class="metriccard"><div class="ml">Từ khoá khác nhau</div><div class="mv">${Number(s.uniqueQueries||0)}</div></div><div class="metriccard"><div class="ml">Tỉ lệ không ra kết quả</div><div class="mv" style="${(Number(s.zeroResultRate)||0)>0.2?'color:var(--red)':''}">${Math.round((Number(s.zeroResultRate)||0)*100)}%</div></div></div>${table}`;
}
function renderZeroResultSearches(){
  const rows=(ANALYTICS?.searchIntelligence?.zeroResultQueries||[]).slice(0,8);
  if(!rows.length)return emptyMini('Chưa có từ khoá nào tìm mà không ra kết quả — tốt!');
  return `<div class="tablewrap"><table class="tbl"><thead><tr><th>Từ khoá</th><th>Số lần không ra kết quả</th><th>Tỉ lệ</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="bold">${esc(r.query)}</td><td><span class="bdg b-red">${Number(r.zeroResults||0)}</span></td><td>${Math.round(Number(r.zeroResultRate||0)*100)}%</td></tr>`).join('')}</tbody></table></div><div class="faint" style="font-size:11px;line-height:1.55;margin-top:9px">Đây là nhu cầu thật của khách chưa có sản phẩm đáp ứng — cân nhắc nhập thêm hàng hoặc đổi tên/tag sản phẩm hiện có cho khớp từ khoá này.</div>`;
}
function renderAnalyticsModels(){
  const rows=ANALYTICS?.models||[];if(!rows.length)return emptyMini('Backend chưa trả danh sách model');
  return `<div class="tablewrap"><table class="tbl"><thead><tr><th>Mô hình</th><th>Phương pháp</th><th>Chỉ số hiện tại</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="bold">${esc(r.name||'Mô hình')}</td><td class="faint">${esc(r.type||r.algorithm||'—')}</td><td>${esc(r.metric||r.status||'Đang hoạt động')}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderRecommendationHealth(){
  const h=ANALYTICS?.recommendationHealth||{},c=h.typeCounts||{};
  const active=h.active===true;
  const stages=[
    ['Selective SSM',h.selectiveSsmActive],
    ['LightGCN',h.lightGcnActive],
    ['Next-item',h.autoregressiveNextItemActive],
    ['Pairwise ranker',h.pairwiseRankerActive],
  ];
  return `<div class="pb"><div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:12px"><span class="bdg ${active?'b-green':'b-amber'}"><span class="d"></span>${active?'Pipeline đang hoạt động':'Chờ tín hiệu hành vi'}</span>${stages.map(([name,on])=>`<span class="bdg ${on?'b-blue':'b-gray'}"><span class="d"></span>${esc(name)} · ${on?'active':'chờ dữ liệu'}</span>`).join('')}</div>
  <div class="metriccards"><div class="metriccard"><div class="ml">Hành vi đã học</div><div class="mv">${Number(h.interactions||0).toLocaleString('vi-VN')}</div></div><div class="metriccard"><div class="ml">Cạnh user–item</div><div class="mv">${Number(h.graphEdges||0)}</div></div><div class="metriccard"><div class="ml">Chuyển tiếp session</div><div class="mv">${Number(h.transitionCount||0)}</div></div><div class="metriccard"><div class="ml">Training pairs</div><div class="mv">${Number(h.trainingPairs||0)}</div></div><div class="metriccard"><div class="ml">Phủ sản phẩm</div><div class="mv">${Math.round(Number(h.itemCoverage||0)*100)}%</div></div><div class="metriccard"><div class="ml">Feedback âm</div><div class="mv">${Number(h.negativeFeedbackEvents||0)}</div></div></div>
  <div class="modelmeta" style="margin-top:12px"><span>Xem ${Number(c.view||0)} · Tìm kiếm ${Number(c.search||0)} · Yêu thích ${Number(c.wishlist||0)} · Giỏ ${Number(c.cart||0)} · Thử đồ ${Number(c.tryon||0)} · Mua ${Number(c.purchase||0)}</span></div>
  <div class="faint" style="font-size:11px;line-height:1.55;margin-top:9px">${esc(h.algorithm||'Tổ hợp lọc cộng tác, nội dung và xu hướng theo thời gian.')}</div></div>`;
}
function renderBotIntelligence(){
  const h=ANALYTICS?.botIntelligence||{},intents=h.intentCounts||{};
  const confidence=h.averageConfidence==null?'—':Math.round(Number(h.averageConfidence)*100)+'%';
  const fallback=Math.round(Number(h.fallbackRate||0)*100);
  const topIntent=Object.entries(intents).sort((a,b)=>Number(b[1])-Number(a[1]))[0];
  return `<div class="pb"><div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px"><span class="bdg ${h.status==='active'?'b-green':'b-amber'}"><span class="d"></span>${h.status==='active'?'Có telemetry thật':'Chờ lượt chat mới'}</span><span class="bdg ${h.grounded?'b-blue':'b-red'}">${h.grounded?'Catalog-grounded':'Chưa grounded'}</span></div>
  <div class="metriccards"><div class="metriccard"><div class="ml">Lượt đã định tuyến</div><div class="mv">${Number(h.requests||0)}</div></div><div class="metriccard"><div class="ml">Confidence TB</div><div class="mv">${confidence}</div></div><div class="metriccard"><div class="ml">Độ trễ TB</div><div class="mv">${h.averageLatencyMs==null?'—':Math.round(Number(h.averageLatencyMs))+' ms'}</div></div><div class="metriccard"><div class="ml">Ollama rewrite</div><div class="mv">${Number(h.llmResponses||0)}</div></div><div class="metriccard"><div class="ml">Intent fallback</div><div class="mv">${fallback}%</div></div></div>
  <div class="modelmeta" style="margin-top:12px"><span>mLSTM-style memory · semantic hashing · sparse MoE${topIntent?` · intent nhiều nhất: ${esc(topIntent[0])} (${Number(topIntent[1])})`:''}</span></div>
  <div class="faint" style="font-size:11px;line-height:1.55;margin-top:9px">Ori định tuyến bằng memory/retrieval cục bộ; Ollama chỉ viết lại câu đã grounded và luôn có fallback không GPU.</div></div>`;
}
function insight(icon,tint,title,body,action='',actionText=''){
  return `<div class="ins"><span class="bi ${tint}">${icon}</span><p><b>${esc(title)}</b> ${esc(body)}</p>${action?`<span class="go" onclick="${action}">${esc(actionText)}</span>`:''}</div>`;
}
function managementInsights({lowStock,outCnt,pending}){
  const items=[],forecast=forecastData(),preds=ANALYTICS?.predictions||[],trends=ANALYTICS?.categoryTrends||[];
  if(ANALYTICS&&forecast.forecast?.length){const next=forecast.forecast[0],up=String(forecast.trend||'').toLowerCase()==='tăng'||Number(forecast.slope)>=0;items.push(insight(up?'↑':'↓',up?'tint-green':'tint-amber',`Ensemble dự báo tháng tới ${money(next.value)}`,`Xu hướng ${up?'tăng':'giảm'}; OLS R² ${Number(forecast.r2||0).toFixed(2)}${forecast.demo?' · kết quả đang dùng dữ liệu demo.':'.'}`));}
  if(preds.length){const p=[...preds].sort((a,b)=>predictionScore(b)-predictionScore(a))[0];items.push(insight('✦','tint-violet',`${predictionName(p)} đạt ${predictionScore(p)} điểm nhu cầu`,p.suggestion||'Ưu tiên hiển thị, tồn kho và chiến dịch phù hợp theo DemandScore.','A.go(\'products\')','Xem SP'));}
  if(trends.length){const t=[...trends].sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0))[0];items.push(insight('↗','tint-blue',`${catName(t.category||t.cat||'general')} đang dẫn xu hướng`,`Tín hiệu: ${Number(t.sold||0)} đã bán, ${Number(t.wishlists||0)} yêu thích, ${Number(t.carts||0)} trong giỏ.`));}
  if(lowStock+outCnt>0)items.push(insight('⚠','tint-amber',`${lowStock+outCnt} sản phẩm sắp/đã hết hàng`,`Có ${outCnt} sản phẩm hết hàng; nên kiểm tra và nhập bổ sung.`,`A.go('products')`,'Nhập kho'));
  if(pending>0){const old=dashboardOrders().filter(o=>o.status==='pending'&&Date.now()-orderTime(o)>86400000).length;items.push(insight('◷','tint-blue',`${pending} đơn chờ xử lý`,old?`${old} đơn đã chờ quá 24 giờ.`:'Chưa có đơn nào chờ quá 24 giờ.',`A.go('orders')`,'Xử lý'));}
  if(items.length<4){const missing=DB.products.filter(p=>!p.story).length;if(missing)items.push(insight('✎','tint-violet',`${missing} sản phẩm chưa có câu chuyện`,'Có thể bổ sung mô tả văn hoá để hỗ trợ chuyển đổi.','A.autoStories()','Tạo tự động'));}
  return items.slice(0,4).join('')||insight('✓','tint-green','Chưa có cảnh báo quản lý','Dữ liệu vận hành hiện chưa phát hiện tín hiệu cần ưu tiên.');
}
function countStatus(s,orders=DB.orders){return orders.filter(o=>o.status===s).length;}
function renderLiveCommerce(){
  const carts=[...(DB.carts||[])].sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
  const typeLabel={cart:'Giỏ hàng',search:'Tìm kiếm',view:'Xem sản phẩm',tryon:'Thử đồ',wishlist:'Yêu thích',purchase:'Mua hàng',chat:'Trò chuyện',goal:'Mục tiêu'};
  const events=[...(DB.interactions||[])].filter(row=>row.source!=='demo').sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,8);
  const cartRows=carts.length?carts.slice(0,8).map(item=>`<tr><td class="bold">${esc(item.userId)}</td><td>${esc(productLabel(item.productId))}</td><td>${esc(item.color)} · ${esc(item.size)}</td><td class="center bold">${Number(item.quantity||0)}</td><td>${fmtDate(item.updatedAt)}</td></tr>`).join(''):emptyTR(5,'Hiện không có sản phẩm nào trong giỏ đã đồng bộ.');
  const eventRows=events.length?events.map(item=>`<tr><td>${fmtDate(item.createdAt)}</td><td class="bold">${esc(item.userId)}</td><td><span class="bdg b-blue">${esc(typeLabel[item.type]||item.type)}</span></td><td>${esc(productLabel(item.productId))}</td><td class="right mono">${Number(item.value||0)}</td></tr>`).join(''):emptyTR(5,'Chưa có hành vi thực tế.');
  return `<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:14px"><div class="panel"><div class="ph"><h3>Giỏ hàng đang hoạt động</h3><span class="dataflag">${carts.length} dòng thực</span></div><div class="tablewrap"><table class="tbl"><thead><tr><th>Khách</th><th>Sản phẩm</th><th>Phân loại</th><th class="center">SL</th><th>Cập nhật</th></tr></thead><tbody>${cartRows}</tbody></table></div></div><div class="panel"><div class="ph"><h3>Hoạt động mới nhất</h3><span class="sub">tự làm mới mỗi 3 giây</span></div><div class="tablewrap"><table class="tbl"><thead><tr><th>Thời gian</th><th>Khách</th><th>Hành vi</th><th>Sản phẩm</th><th class="right">SL</th></tr></thead><tbody>${eventRows}</tbody></table></div></div></div>`;
}
function viewDashboard(){
  if(!DB.seeded)return dashEmpty();
  const dOrders=dashboardOrders(),statusCount=s=>countStatus(s,dOrders);
  const now=new Date(),dayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()),monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  const today=revenueBetween(dayStart,new Date(+dayStart+86400000)),yesterday=revenueBetween(new Date(+dayStart-86400000),dayStart);
  const month=revenueBetween(monthStart,new Date(now.getFullYear(),now.getMonth()+1,1)),prevMonth=revenueBetween(new Date(now.getFullYear(),now.getMonth()-1,1),monthStart);
  const totalOrders=dOrders.length;const completed=statusCount('completed');
  const conv=totalOrders? Math.round(completed/totalOrders*100):0;
  const lowStock=DB.products.filter(p=>stock(p)>0&&stock(p)<=5).length;
  const outCnt=DB.products.filter(p=>effStatus(p)==='out').length;
  const newUsers=DB.users.filter(u=>Number(u.joinedAt||new Date(u.createdAt||0).getTime())>=Date.now()-30*86400000).length;
  const activeVip=DB.users.filter(u=>userVip(u).isVip).length;
  const notBuyable=DB.products.filter(p=>!buyable(p)).length;
  const kpi=(lb,val,ic,tint,detail,action='')=>`<div class="kpi" ${action?`onclick="${action}" style="cursor:pointer"`:''}><div class="top"><span class="lb">${lb}</span><span class="ic ${tint}">${ic}</span></div><div class="v">${val}</div>${detail?`<div class="dl ${detail.tone==='up'?'up':detail.tone==='down'?'dn':''}" style="${detail.tone?'':'color:var(--faint)'}">${detail.tone==='up'?'▲ ':detail.tone==='down'?'▼ ':''}${detail.text}</div>`:''}</div>`;
  const ms=(ic,tint,v,lb)=>`<div class="ministat"><span class="ic ${tint}">${ic}</span><div><div class="v">${v}</div><div class="lb">${lb}</div></div></div>`;
  // segments
  const segs=[{label:'Chờ xử lý',status:'pending',value:statusCount('pending'),color:'#B45309'},{label:'Đang giao',status:'shipping',value:statusCount('shipping')+statusCount('confirmed'),color:'#1D4ED8'},{label:'Hoàn tất',status:'completed',value:completed,color:'#15803D'},{label:'Đã huỷ',status:'cancelled',value:statusCount('cancelled'),color:'#B91C1C'}];
  // top products by qty sold (from non-cancelled orders)
  const soldMap={};dOrders.forEach(o=>{if(!revenueOrder(o))return;(o.items||[]).forEach(it=>{const key=orderItemKey(it);soldMap[key]=(soldMap[key]||0)+(Number(it.qty||it.quantity)||0);});});
  const topP=Object.entries(soldMap).map(([id,q])=>{const p=DB.products.find(x=>[x.id,x.slug].filter(Boolean).map(String).includes(id));return{name:p?p.name:id,value:q,fmt:q+' cái'};}).sort((a,b)=>b.value-a.value).slice(0,5);
  const catMap={};dOrders.forEach(o=>{if(!revenueOrder(o))return;(o.items||[]).forEach(it=>{const p=findProductForItem(it);if(p)catMap[p.cat]=(catMap[p.cat]||0)+(Number(it.qty||it.quantity)||0)*(Number(it.price||it.unitPrice)||0);});});
  const catColors={'ao-truyen-thong':'#A33A2F','haori':'#243244','trang-phuc':'#6B7255','phu-kien':'#B08D3C','cosplay':'#6D28D9'};
  const topC=Object.entries(catMap).map(([c,v])=>({label:catName(c),value:v,color:catColors[c]||'#999'})).sort((a,b)=>b.value-a.value);
  const recent=[...dOrders].sort((a,b)=>orderTime(b)-orderTime(a)).slice(0,6),forecast=forecastData(),todayCmp=compareRevenue(today,yesterday),monthCmp=compareRevenue(month,prevMonth);
  return `
  <div class="filters" style="margin-bottom:14px"><div class="tabs"><button class="${state.dataScope==='live'?'on':''}" onclick="A.dataScope('live')">Dữ liệu thực <span class="c">${Number(ANALYTICS?.sourceCounts?.liveOrders??dOrders.length)}</span></button><button class="${state.dataScope==='all'?'on':''}" onclick="A.dataScope('all')">Tất cả, gồm dữ liệu mẫu <span class="c">${DB.orders.length}</span></button></div><span class="faint" style="font-size:11px">${state.dataScope==='live'?'Đã loại đơn mẫu và đơn kiểm thử khỏi báo cáo.':'Đang hiển thị cả dữ liệu mẫu để kiểm thử mô hình.'}</span></div>
  <div class="grid kpis">
    ${kpi('Doanh thu hôm nay',money(today),'💰','tint-brand',todayCmp,"A.rev('day')")}
    ${kpi('Doanh thu tháng',money(month),'📈','tint-green',monthCmp,"A.rev('month')")}
    ${kpi('Tổng đơn hàng',totalOrders,'🧾','tint-blue',{text:statusCount('pending')+' chờ xử lý',tone:null},"A.orderDrill('all')")}
    ${kpi('Tỷ lệ hoàn tất',conv+'%','🎯','tint-violet',{text:completed+' đơn hoàn tất',tone:null},"A.orderDrill('completed')")}
  </div>

  <div class="grid" style="grid-template-columns:2fr 1fr;margin-top:14px">
    <div class="panel">
      <div class="ph"><h3>Doanh thu</h3>
        <div class="seg" id="revSeg">
          <button data-s="day" onclick="A.rev('day')" class="${state.revSpan==='day'?'on':''}">Ngày</button>
          <button data-s="week" onclick="A.rev('week')" class="${state.revSpan==='week'?'on':''}">Tuần</button>
          <button data-s="month" onclick="A.rev('month')" class="${state.revSpan==='month'?'on':''}">Tháng</button>
          <button data-s="year" onclick="A.rev('year')" class="${state.revSpan==='year'?'on':''}">Năm</button>
        </div>
      </div>
      <div class="pb"><div id="revChart">${bars(revBy(state.revSpan),state.revSpan)}</div><div id="revSummary">${revenueSummaryHTML(state.revSpan)}</div></div>
    </div>
    <div class="ai panel">
      <div class="ph"><h3>✦ Gợi ý quản lý thông minh</h3><span class="sub" style="color:#8b9099">${ANALYTICS?'dựa trên dữ liệu phân tích':'dựa trên vận hành'}</span></div>
      <div>${managementInsights({lowStock,outCnt,pending:statusCount('pending')})}</div>
    </div>
  </div>

  <div class="grid" style="grid-template-columns:repeat(4,1fr);margin-top:14px">
    ${ms('◷','tint-amber',statusCount('pending'),'Đơn chờ xử lý')}
    ${ms('🚚','tint-blue',statusCount('shipping')+statusCount('confirmed'),'Đơn đang giao')}
    ${ms('✓','tint-green',completed,'Đơn hoàn tất')}
    ${ms('✕','tint-red',statusCount('cancelled'),'Đơn đã huỷ')}
    ${ms('👘','tint-brand',DB.products.length,'Tổng sản phẩm')}
    ${ms('📉','tint-amber',lowStock+outCnt,'Sắp/hết hàng')}
    ${ms('🧍','tint-blue',newUsers,'Người dùng mới (30d)')}
    ${ms('💎','tint-violet',activeVip,'VIP đang hiệu lực')}
    ${ms('🛑','tint-violet',notBuyable,'SP không thể mua')}
  </div>

  ${renderLiveCommerce()}

  <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:14px">
    <div class="panel"><div class="ph"><h3>Đơn theo trạng thái</h3><span class="sub">nhấn để xem chi tiết</span></div><div class="pb">${donut(segs,true)}</div></div>
    <div class="panel"><div class="ph"><h3>Sản phẩm bán chạy nhất</h3><span class="sub">theo số lượng</span></div><div class="pb">${topP.length?hbars(topP):emptyMini('Chưa có dữ liệu bán')}</div></div>
  </div>

  <div class="grid" style="grid-template-columns:2fr 1fr;margin-top:14px">
    <div class="panel"><div class="ph"><h3>Dự báo doanh thu · Mô hình tổ hợp</h3><div class="modelmeta">${sourceFlag(Boolean(forecast.demo),Boolean(forecast.local))}<span>12 tháng thực tế + 3 tháng dự báo</span></div></div><div class="pb">
      ${bars([...forecast.history,...forecast.forecast])}
      <div class="modelmeta" style="margin-top:10px"><span style="width:10px;height:10px;border-radius:3px;background:var(--brand)"></span>Thực tế <span style="width:10px;height:10px;border-radius:3px;background:var(--blue);margin-left:8px"></span>Dự báo <span style="margin-left:auto">OLS R² ${Number(forecast.r2||0).toFixed(2)} · MAPE ${Number(forecast.mape||0).toFixed(1)}% · xu hướng ${esc(forecast.trend||'—')}</span></div>
      <div class="modelmeta" style="margin-top:7px"><span>${forecastModelSummary(forecast)}</span></div>
    </div></div>
    <div class="panel"><div class="ph"><h3>Phân khúc K-Means</h3>${sourceFlag(Boolean(ANALYTICS?.segments?.demo||modelDemo(['k-means','phan khuc'])))}</div><div class="pb">${renderSegments()}<div class="modelmeta" style="margin-top:10px"><span>${esc(ANALYTICS?.segments?.algorithm||'K-Means k=3 trên chi tiêu, số đơn và recency')}</span></div></div></div>
  </div>

  <div class="grid" style="grid-template-columns:3fr 2fr;margin-top:14px">
    <div class="panel"><div class="ph"><h3>Dự đoán nhu cầu sản phẩm</h3><div class="modelmeta">${sourceFlag(modelDemo(['nhu cau','demand']))}<span>Điểm nhu cầu</span></div></div>${renderPredictions()}</div>
    <div class="panel"><div class="ph"><h3>Xu hướng danh mục</h3>${sourceFlag(modelDemo(['xu huong','trend']))}</div><div class="pb">${renderCategoryTrends()}<div class="modelmeta" style="margin-top:12px"><span>Điểm = bán ×3 + yêu thích ×2 + giỏ hàng</span></div></div></div>
  </div>

  <div class="grid" style="grid-template-columns:3fr 2fr;margin-top:14px">
    <div class="panel"><div class="ph"><h3>Recommendation · Post-Transformer MoE</h3><div class="modelmeta">${sourceFlag(false,false)}<span>diagnostics trực tiếp từ pipeline</span></div></div>${renderRecommendationHealth()}</div>
    <div class="panel"><div class="ph"><h3>Botchat Ori · Memory & Routing</h3><div class="modelmeta">${sourceFlag(false,false)}<span>telemetry từ hội thoại thật</span></div></div>${renderBotIntelligence()}</div>
  </div>

  <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:14px">
    <div class="panel"><div class="ph"><h3>Rủi ro tồn kho · 30 ngày</h3><div class="modelmeta">${sourceFlag(modelDemo(['demand','nhu cau']))}<span>Đà tăng trưởng + tốc độ bán</span></div></div>${renderInventoryRisks()}</div>
    <div class="panel"><div class="ph"><h3>Khách có nguy cơ rời bỏ</h3><div class="modelmeta">${sourceFlag(modelDemo(['rfm','churn']))}<span>Nguy cơ rời bỏ theo RFM</span></div></div>${renderChurnRisks()}</div>
  </div>

  <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:14px">
    <div class="panel"><div class="ph"><h3>Luật mua kèm / phối đồ</h3><div class="modelmeta">${sourceFlag(modelDemo(['market basket','association']))}<span>Hỗ trợ · độ tin cậy · độ nâng</span></div></div>${renderMarketBasket()}</div>
    <div class="panel"><div class="ph"><h3>Mô hình đang hoạt động</h3><div class="modelmeta">${sourceFlag(Boolean(ANALYTICS?.demo))}<span>${(ANALYTICS?.models||[]).length} mô hình</span></div></div>${renderAnalyticsModels()}</div>
  </div>

  <div class="grid" style="grid-template-columns:3fr 2fr;margin-top:14px">
    <div class="panel"><div class="ph"><h3>Search Intelligence · Từ khoá khách tìm</h3><div class="modelmeta">${sourceFlag(false,false)}<span>ghi nhận từ mọi lượt tìm trên app</span></div></div><div class="pb">${renderSearchIntelligence()}</div></div>
    <div class="panel"><div class="ph"><h3>Từ khoá không ra kết quả</h3><div class="modelmeta">${sourceFlag(false,false)}<span>nhu cầu chưa được đáp ứng</span></div></div><div class="pb">${renderZeroResultSearches()}</div></div>
  </div>

  <div class="grid" style="grid-template-columns:1fr 2fr;margin-top:14px">
    <div class="panel"><div class="ph"><h3>Danh mục dẫn đầu</h3><span class="sub">theo doanh thu</span></div><div class="pb">${topC.length?donut(topC):emptyMini('Chưa có dữ liệu')}</div></div>
    <div class="panel"><div class="ph"><h3>Đơn hàng gần đây</h3><span class="sub"><a onclick="A.go('orders')" style="color:var(--brand);font-weight:700;cursor:pointer">Xem tất cả →</a></span></div>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Tổng</th><th>Thanh toán</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${recent.map(o=>`<tr>
        <td class="bold mono">#${o.code}</td>
        <td>${esc(o.customer.name)}<div class="faint" style="font-size:11px">${fmtDate(o.createdAt)}</div></td>
        <td class="bold">${money(o.total)}</td>
        <td>${o.payment.method} ${badge(PAY,o.payment.status)}</td>
        <td>${badge(ORD,o.status)}</td>
        <td class="right"><button class="btn sm" onclick="A.openOrder('${escJs(o.id)}')">Xem</button></td>
      </tr>`).join('')}
      </tbody></table></div>
    </div>
  </div>`;
}
function emptyMini(t){return `<div style="text-align:center;color:var(--faint);padding:30px 10px"><div style="font-size:26px">📊</div><div style="margin-top:8px;font-size:12px">${t}</div></div>`;}
function dashEmpty(){
  const kz=(lb,ic,tint)=>`<div class="kpi" style="opacity:.75"><div class="top"><span class="lb">${lb}</span><span class="ic ${tint}">${ic}</span></div><div class="v">0</div><div class="dl" style="color:var(--faint)">— chưa có dữ liệu</div></div>`;
  return `<div class="grid kpis">${kz('Doanh thu hôm nay','💰','tint-brand')}${kz('Tổng đơn hàng','🧾','tint-blue')}${kz('Tổng sản phẩm','👘','tint-green')}${kz('Người dùng','👥','tint-violet')}</div>
  <div class="panel" style="margin-top:16px"><div class="empty">
    <div class="art">🌸</div>
    <h3>Bắt đầu với JAPANO Admin</h3>
    <p>Cơ sở dữ liệu đang trống. Hãy thêm sản phẩm thật hoặc nhập dữ liệu hiện có; đơn hàng và doanh thu sẽ chỉ xuất hiện khi ứng dụng phát sinh giao dịch thực tế.</p>
    <div class="acts">
      <button class="btn p" onclick="A.addProduct()">＋ Thêm sản phẩm</button>
      <button class="btn" onclick="A.importCSV()">⇪ Nhập tệp CSV/Excel</button>
    </div>
    <div style="margin-top:22px;display:flex;gap:26px;flex-wrap:wrap;justify-content:center;color:var(--muted);font-size:12px">
      <div>1 · Thêm/nhập sản phẩm</div><div>2 · Nhận đơn hàng</div><div>3 · Theo dõi doanh thu &amp; AI gợi ý</div>
    </div>
  </div></div>`;
}
