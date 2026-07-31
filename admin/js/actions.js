/* ================= ACTION NAMESPACE ================= */
window.A={
  go, toggleApi(){toast('Đang kết nối lại backend…','info');bootstrap();},
  openSettings(){go('settings');},
  async seed(){try{const r=await fetch(API+'/seed',{method:'POST'});if(!r.ok)throw 0;DB=await r.json();NET_OK=true;}catch(e){seedDemo();NET_OK=false;}refreshChrome();renderView();toast('Đã nạp dữ liệu demo ✓');},
  rev(s){state.revSpan=s;const c=$('#revChart'),sum=$('#revSummary');if(c)c.innerHTML=bars(revBy(s),s);if(sum)sum.innerHTML=revenueSummaryHTML(s);document.querySelectorAll('#revSeg button').forEach(b=>b.classList.toggle('on',b.dataset.s===s));},
  async dataScope(scope){state.dataScope=scope==='all'?'all':'live';ANALYTICS_STATUS='idle';renderView();await refreshAnalytics(true);},
  revPoint(span,index){const row=revBy(span)[index]||{},detail=revenuePeriodOrders(span,index),orders=detail.orders,total=orders.reduce((sum,o)=>sum+orderAmount(o),0);openModal(`<div class="mh"><div><h3>Chi tiết doanh thu · ${esc(row.label||'Kỳ đã chọn')}</h3><div class="faint" style="font-size:11px">${detail.start.toLocaleDateString('vi-VN')} – ${new Date(+detail.end-1).toLocaleDateString('vi-VN')} · ${state.dataScope==='live'?'dữ liệu thực':'gồm dữ liệu mẫu'}</div></div><div class="x" onclick="closeModal()">✕</div></div><div class="mb"><div class="metriccards"><div class="metriccard"><div class="ml">Doanh thu</div><div class="mv">${money(total)}</div></div><div class="metriccard"><div class="ml">Số đơn</div><div class="mv">${orders.length}</div></div><div class="metriccard"><div class="ml">Trung bình/đơn</div><div class="mv">${money(orders.length?total/orders.length:0)}</div></div></div><div class="tablewrap" style="margin-top:14px"><table class="tbl"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Thời gian</th><th class="right">Số tiền</th></tr></thead><tbody>${orders.length?orders.sort((a,b)=>orderTime(b)-orderTime(a)).map(o=>`<tr onclick="closeModal();A.openOrder('${o.id}')" style="cursor:pointer"><td class="bold">#${esc(o.code)}</td><td>${esc(o.customer?.name||o.userId||'Khách')}</td><td>${fmtDate(orderTime(o))}</td><td class="right bold">${money(orderAmount(o))}</td></tr>`).join(''):emptyTR(4,'Kỳ này chưa có đơn tạo doanh thu.')}</tbody></table></div></div>`,`lg`);},
  revenueSummary(){const windowData=revenueWindow(state.revSpan),orders=windowData.orders,total=orders.reduce((sum,o)=>sum+orderAmount(o),0),spanName={day:'7 ngày',week:'8 tuần',month:'12 tháng',year:'5 năm'}[state.revSpan]||'khoảng đang xem';openModal(`<div class="mh"><h3>Tổng hợp doanh thu · ${spanName}</h3><div class="x" onclick="closeModal()">✕</div></div><div class="mb"><div class="metriccards"><div class="metriccard"><div class="ml">Tổng doanh thu</div><div class="mv">${money(total)}</div></div><div class="metriccard"><div class="ml">Đơn có doanh thu</div><div class="mv">${orders.length}</div></div><div class="metriccard"><div class="ml">Giá trị trung bình</div><div class="mv">${money(orders.length?total/orders.length:0)}</div></div></div><p class="faint" style="margin-top:14px;font-size:11.5px">Khoảng biểu đồ: ${windowData.start.toLocaleDateString('vi-VN')} – ${new Date(+windowData.end-1).toLocaleDateString('vi-VN')}. Chỉ tính đơn đã thanh toán hoặc hoàn tất; loại đơn huỷ, trả hàng, thất bại và hoàn tiền. Phạm vi: ${state.dataScope==='live'?'dữ liệu phát sinh thực':'toàn bộ, gồm dữ liệu mẫu'}.</p><div class="tablewrap" style="margin-top:14px"><table class="tbl"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Thời gian</th><th class="right">Số tiền</th></tr></thead><tbody>${orders.length?[...orders].sort((a,b)=>orderTime(b)-orderTime(a)).map(o=>`<tr onclick="closeModal();A.openOrder('${o.id}')" style="cursor:pointer"><td class="bold">#${esc(o.code)}</td><td>${esc(o.customer?.name||o.userId||'Khách')}</td><td>${fmtDate(orderTime(o))}</td><td class="right bold">${money(orderAmount(o))}</td></tr>`).join(''):emptyTR(4,'Khoảng này chưa có đơn tạo doanh thu.')}</tbody></table></div></div>`,`lg`);},
  orderDrill(status){let orders=dashboardOrders();if(status==='paid')orders=orders.filter(revenueOrder);else if(status==='shipping')orders=orders.filter(o=>['shipping','confirmed'].includes(o.status));else if(status!=='all')orders=orders.filter(o=>o.status===status);openModal(`<div class="mh"><div><h3>Danh sách đơn · ${status==='all'?'Tất cả':status==='paid'?'Có doanh thu':ORD[status]?.t||status}</h3><div class="faint" style="font-size:11px">${orders.length} đơn · nhấn một dòng để mở chi tiết</div></div><div class="x" onclick="closeModal()">✕</div></div><div class="tablewrap"><table class="tbl"><thead><tr><th>Mã</th><th>Khách</th><th>Ngày</th><th>Trạng thái</th><th class="right">Tổng</th></tr></thead><tbody>${orders.length?orders.sort((a,b)=>orderTime(b)-orderTime(a)).map(o=>`<tr onclick="closeModal();A.openOrder('${o.id}')" style="cursor:pointer"><td class="bold">#${esc(o.code)}</td><td>${esc(o.customer?.name||'Khách')}</td><td>${fmtDate(orderTime(o))}</td><td>${badge(ORD,o.status)}</td><td class="right bold">${money(orderAmount(o))}</td></tr>`).join(''):emptyTR(5,'Không có đơn phù hợp.')}</tbody></table></div>`,`lg`);},
  autoStories(){let n=0;DB.products.forEach(p=>{if(!p.story){p.story=genStory(p);n++;}});save();toast('AI đã viết câu chuyện cho '+n+' sản phẩm ✓');if(state.route==='dashboard'||state.route==='products')renderView();},
  /* orders */
  oTab(s){state.oStatus=s;renderView();},
  oSearch(v){state.oQuery=v;const tb=$('#ordBody');if(tb)tb.innerHTML=ordList().map(orderRow).join('')||emptyTR(9,'Không có đơn phù hợp.');},
  exportOrders(){downloadCSV('japano-orders.csv',[['Ma don','Khach','SDT','Dia chi','Tong','Thanh toan','Trang thai','VIP san pham','VIP giam']].concat(DB.orders.map(o=>[o.code,o.customer.name,o.customer.phone,o.address,o.total,o.payment.method+'/'+o.payment.status,(ORD[o.status]||{t:o.status}).t,o.vipPromotion?.productName||'',o.vipDiscount||0])));toast('Đã xuất '+DB.orders.length+' đơn ✓');},
  openOrder(id){const o=DB.orders.find(x=>x.id===id);if(o)openDrawer(orderDrawer(o));},
  async setOrder(id,st,drawer){const o=DB.orders.find(x=>x.id===id);if(!o)return;try{const result=await requestJSON('/orders/'+encodeURIComponent(id),12000,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:st})});Object.assign(o,result.order);toast('Đơn #'+o.code+' → '+ORD[st].t+' ✓');renderView();if(drawer)openDrawer(orderDrawer(o));}catch(e){toast('Không cập nhật được đơn hàng','err');}},
  cancelOrder(id){const o=DB.orders.find(x=>x.id===id);if(!o)return;const p=(DB.payments||[]).find(x=>x.orderId===o.id);if(/stripe|vnpay/i.test(o.payment.method)&&o.payment.status==='paid'&&p){closeModal();A.refundPayment(p.id);return;}confirmModal('Huỷ đơn hàng?','Đơn #'+o.code+' sẽ được đánh dấu là đã huỷ.',async()=>{await A.setOrder(id,'cancelled',false);const latest=DB.orders.find(x=>x.id===id);if(latest)openDrawer(orderDrawer(latest));},true);},
  async markPaid(id){const o=DB.orders.find(x=>x.id===id);if(!o)return;try{const result=await requestJSON('/orders/'+encodeURIComponent(id),12000,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({paymentStatus:'paid'})});Object.assign(o,result.order);toast('Đã lưu thông tin giao dịch · đã thanh toán ✓');openDrawer(orderDrawer(o));renderView();}catch(e){toast('Không cập nhật được thanh toán','err');}},
  /* Stripe payments */
  payTab(s){state.payStatus=s;renderView();},
  paySearch(v){state.payQuery=v;const tb=$('#payBody');if(tb)tb.innerHTML=paymentList().map(paymentRow).join('')||emptyTR(7,'Không có giao dịch phù hợp.');},
  async refreshPayments(){try{await Promise.all([fetch(API+'/stripe/reconcile',{method:'POST'}),fetch(API+'/vnpay/reconcile',{method:'POST'})]);DB=await requestJSON('/state',8000);NET_OK=true;refreshChrome();renderView();toast('Đã đối soát trạng thái trực tiếp với Stripe &amp; VNPay ✓');}catch(e){toast('Không tải được dữ liệu thanh toán','err');}},
  openPayment(id){const p=(DB.payments||[]).find(x=>x.id===id);if(p)openDrawer(paymentDrawer(p));},
  openStripePayment(id){const p=(DB.payments||[]).find(x=>x.id===id);const pi=String(p?.paymentIntentId||p?.transactionCode||'');if(!pi.startsWith('pi_')||pi.startsWith('pi_seed_')){toast('Giao dịch mẫu không có trên trang quản lý Stripe','info');return;}window.open('https://dashboard.stripe.com/test/payments/'+encodeURIComponent(pi),'_blank');},
  refundPayment(id){const p=(DB.payments||[]).find(x=>x.id===id);if(!p)return;const providerLabel=p.provider==='vnpay'?'VNPay':'Stripe';const remain=Math.max(0,Number(p.amount||0)-Number(p.refundedAmount||0));confirmModal(`Hoàn tiền ${providerLabel} thử nghiệm?`,`Hoàn toàn bộ số tiền còn lại ${money(remain)} cho giao dịch ${esc(p.code)}. ${providerLabel} sẽ tạo mã hoàn tiền thật trong chế độ thử nghiệm.`,async()=>{try{toast(`Đang gửi yêu cầu hoàn tiền ${providerLabel}…`,'info');const r=await fetch(API+'/payments/'+encodeURIComponent(id)+'/refund',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const data=await r.json();if(!r.ok)throw new Error(data.message||'Hoàn tiền thất bại');DB=await requestJSON('/state',8000);refreshChrome();renderView();toast('Hoàn tiền thành công · '+data.refund.id+' ✓');}catch(e){toast(e.message||`${providerLabel} không hoàn tiền được`,'err');}},false);},
  /* returns */
  returnTab(s){state.returnStatus=s;renderView();},
  returnSearch(v){state.returnQuery=v;const tb=$('#returnBody');if(tb)tb.innerHTML=returnList().map(returnRow).join('')||emptyTR(7,'Không có yêu cầu trả hàng phù hợp.');},
  openReturn(id){const r=(DB.returnRequests||[]).find(x=>x.id===id);if(r)openDrawer(returnDrawer(r));},
  async refreshReturns(){try{await Promise.all([fetch(API+'/stripe/reconcile',{method:'POST'}),fetch(API+'/vnpay/reconcile',{method:'POST'})]);DB=await requestJSON('/state',8000);NET_OK=true;refreshChrome();renderView();toast('Đã đồng bộ trả hàng và hoàn tiền ✓');}catch(e){toast('Không đồng bộ được yêu cầu trả hàng','err');}},
  returnAction(id,action){const r=(DB.returnRequests||[]).find(x=>x.id===id);if(!r)return;const isCancel=r.kind==='cancel';const rp=returnPayment(r);const providerLabel=r.codManualRefund?'thủ công (COD)':rp?.provider==='vnpay'?'VNPay':'Stripe';const copy={
    approve:isCancel?['Chấp nhận huỷ đơn?','Đơn sẽ chuyển sang trạng thái đã huỷ ngay lập tức.']:['Duyệt yêu cầu trả hàng?','Khách sẽ được hướng dẫn gửi sản phẩm về cửa hàng.'],
    reject:isCancel?['Từ chối yêu cầu huỷ?','Đơn tiếp tục được xử lý bình thường, không huỷ.']:['Từ chối yêu cầu trả hàng?','Hàng không đủ điều kiện hoàn tiền và sẽ được gửi trả lại khách.'],
    receive:['Xác nhận đã nhận hàng?',`Sau bước này quản trị viên có thể hoàn tiền ${providerLabel} cho khách.`],
    refund:[`Hoàn tiền ${providerLabel}?`,`Sẽ hoàn ${money(r.amount)} cho khách${r.codManualRefund?' (đơn COD — cần tự chuyển khoản/tiền mặt rồi mới bấm xác nhận này)':' về đúng phương thức đã thanh toán'}.`],
  }[action]||['Cập nhật yêu cầu?','Xác nhận thao tác.'];
  confirmModal(copy[0],copy[1],async()=>{try{toast('Đang xử lý '+r.code+'…','info');const resp=await fetch(API+'/returns/'+encodeURIComponent(id)+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});const data=await resp.json();if(!resp.ok)throw new Error(data.message||'Không xử lý được');DB=await requestJSON('/state',8000);refreshChrome();renderView();toast(action==='refund'?'Đã hoàn tiền'+(data.refund?.id?' · '+data.refund.id:'')+' ✓':'Đã cập nhật '+r.code+' ✓');}catch(e){toast(e.message||'Không xử lý được yêu cầu','err');}},action==='reject');},
  promptVoucher(userId,orderCode){
    const value=prompt('Giảm bao nhiêu % cho khách này? (1-100)','10');
    if(value==null)return;
    const percent=Math.max(1,Math.min(100,Number(value)||0));
    const reason=prompt('Lý do cấp voucher (khách sẽ thấy lý do này):','Xin lỗi vì sự cố với đơn '+(orderCode||''));
    if(!reason)return;
    (async()=>{try{toast('Đang tạo voucher…','info');const resp=await fetch(API+'/admin/customers/'+encodeURIComponent(userId)+'/voucher',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'percent',value:percent,reason})});const data=await resp.json();if(!resp.ok)throw new Error(data.message||'Không tạo được voucher');DB=await requestJSON('/state',8000);refreshChrome();renderView();toast('Đã gửi voucher '+data.voucher.code+' ✓');}catch(e){toast(e.message||'Không tạo được voucher','err');}})();
  },
  /* products */
  pTab(s){state.pStatus=s;renderView();},
  pSearch(v){state.pQuery=v;const tb=$('#prodBody');if(tb)tb.innerHTML=prodList().map(prodRow).join('')||emptyTR(7,'Không có sản phẩm phù hợp.');},
  addProduct(){editing=blankProduct();openEditor();},
  editProduct(id){const p=DB.products.find(x=>x.id===id);if(!p)return;editing=JSON.parse(JSON.stringify(p));editing.images||=[];editing.videos||=[];editing.variants||=[];openEditor();},
  pricePreview(){const list=Math.max(0,+($('#f-list-price')?.value||0)),promo=Math.max(0,+($('#f-promo-price')?.value||0)),box=$('#pricePreview');if(!box)return;const valid=promo>0&&promo<list,actual=valid?promo:list,pct=valid?Math.round((1-promo/list)*100):0;box.innerHTML=`Giá thực bán: <b>${money(actual)}</b>${pct?` · tự động giảm <b style="color:var(--red)">${pct}%</b>`:promo>=list&&promo>0?' · <b style="color:var(--red)">giá khuyến mãi phải thấp hơn giá niêm yết</b>':' · không giảm giá'}`;},
  async saveProduct(){const list=+($('#f-list-price')?.value||0),promo=+($('#f-promo-price')?.value||0);if(list<=0){toast('Giá niêm yết phải lớn hơn 0','err');return;}if(promo>0&&promo>=list){toast('Giá khuyến mãi phải thấp hơn giá niêm yết','err');return;}readEditorForm();if(!editing.name.trim()){toast('Vui lòng nhập tên sản phẩm','err');return;}
    editing.sku=editing.sku||slugify(editing.name).slice(0,6).toUpperCase();
    if(editing.variants[0])editing.colorHex=editing.variants[0].colorHex;
    if(!editing.id){editing.id='p'+Date.now();editing.slug=slugify(editing.name);editing.source='admin';}
    try{const result=await requestJSON('/products/'+encodeURIComponent(editing.id),30000,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(editing)});const i=DB.products.findIndex(p=>p.id===editing.id);if(i>=0)DB.products[i]=result.product;else DB.products.push(result.product);DB.seeded=true;localStorage.setItem(LS,JSON.stringify(DB));closeModal();refreshChrome();renderView();toast('Đã lưu sản phẩm và đồng bộ sang ứng dụng ✓');}catch(e){toast(e.message||'Không lưu được sản phẩm','err');}},
  delProduct(id){const p=DB.products.find(x=>x.id===id);confirmModal('Xoá sản phẩm?','"'+p.name+'" sẽ bị xoá khỏi cửa hàng. Thao tác không thể hoàn tác.',async()=>{try{await requestJSON('/products/'+encodeURIComponent(id),10000,{method:'DELETE'});DB.products=DB.products.filter(x=>x.id!==id);localStorage.setItem(LS,JSON.stringify(DB));refreshChrome();renderView();toast('Đã xoá sản phẩm','info');}catch(e){toast('Không xoá được sản phẩm','err');}},true);},
  async toggleHide(id){const p=DB.products.find(x=>x.id===id);if(!p)return;p.status=p.status==='hidden'?'published':'hidden';try{const result=await requestJSON('/products/'+encodeURIComponent(id),30000,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});Object.assign(p,result.product);localStorage.setItem(LS,JSON.stringify(DB));renderView();toast(p.status==='hidden'?'Đã ẩn sản phẩm':'Đã hiển thị sản phẩm ✓');}catch(e){toast('Không cập nhật được sản phẩm','err');}},
  addVar(){readEditorForm();editing.variants.push({colorName:'Màu mới',colorHex:'#A33A2F',size:'M',sku:'',stock:0});openEditor();},
  rmVar(i){readEditorForm();editing.variants.splice(i,1);if(!editing.variants.length)editing.variants.push({colorName:'Sumi',colorHex:'#1A1410',size:'M',sku:'',stock:0});openEditor();},
  addImg(){readEditorForm();const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.multiple=true;inp.onchange=e=>{const fs=[...e.target.files];let left=fs.length;if(!left)return;fs.forEach(f=>{const r=new FileReader();r.onload=()=>{editing.images.push(r.result);if(--left===0)openEditor();};r.readAsDataURL(f);});};inp.click();},
  addVideo(){readEditorForm();const inp=document.createElement('input');inp.type='file';inp.accept='video/mp4,video/webm,video/quicktime';inp.multiple=true;inp.onchange=e=>{const files=[...e.target.files];if(!files.length)return;const tooLarge=files.find(f=>f.size>25*1024*1024);if(tooLarge){toast('Đoạn phim '+tooLarge.name+' vượt quá 25 MB','err');return;}let left=files.length;files.forEach(file=>{const reader=new FileReader();reader.onload=()=>{editing.videos||=[];editing.videos.push({url:reader.result,name:file.name,type:file.type||'video/mp4'});if(--left===0)openEditor();};reader.readAsDataURL(file);});};inp.click();},
  sampleImg(){readEditorForm();editing.images.push(sampleImgURL(editing.variants[0]?.colorHex||'#8A2F26',catKanji(editing.cat)));openEditor();},
  rmImg(i){readEditorForm();editing.images.splice(i,1);openEditor();},
  rmVideo(i){readEditorForm();editing.videos.splice(i,1);openEditor();},
  aiDesc(){const t=$('#f-desc');const b=event.target;b.textContent='✦ Đang tạo...';setTimeout(()=>{readEditorForm();t.value=genDesc(editing);b.textContent='✦ AI mô tả';toast('AI đã tạo mô tả ✓');},700);},
  aiStory(){const t=$('#f-story');const b=event.target;b.textContent='✦ Đang viết...';setTimeout(()=>{readEditorForm();t.value=genStory(editing);b.textContent='✦ AI viết chuyện';toast('AI đã viết câu chuyện ✓');},800);},
  pick(i){openPicker(i);},
  pickPreset(hex){const h=hex2hsv(hex);cpk.h=h.h;cpk.s=h.s;cpk.v=h.v;pickRender();},
  pickHex(v){if(/^#?[0-9a-fA-F]{6}$/.test(v)){const h=hex2hsv(v);cpk.h=h.h;cpk.s=h.s;cpk.v=h.v;pickRender();}},
  pickApply(){editing.variants[cpk.idx].colorHex=hsv2hex(cpk.h,cpk.s,cpk.v);openEditor();},
  pickCancel(){openEditor();},
  /* reviews */
  reviewTab(status){state.reviewStatus=status;renderView();},
  async moderateReview(id,status){try{await requestJSON('/reviews/'+encodeURIComponent(id)+'/moderation',12000,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});await syncLiveSales(false);renderView();toast(status==='approved'?'Đã duyệt đánh giá ✓':'Đã chặn và bổ sung mẫu cho bộ lọc ✓');}catch(e){toast('Không cập nhật được kiểm duyệt','err');}},
  /* users */
  uTab(s){state.uRole=s;renderView();},
  uSearch(v){state.uQuery=v;const tb=$('#userBody');if(tb)tb.innerHTML=userList().map(userRow).join('')||emptyTR(8);},
  async saveUserAdmin(id){
    const name=$('#ud-name')?.value.trim(),email=$('#ud-email')?.value.trim(),role=$('#ud-role')?.value;
    try{
      const resp=await fetch(API+'/admin/users/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,role})});
      const data=await resp.json();
      if(!resp.ok)throw new Error(data.message||'Không cập nhật được người dùng');
      const u=DB.users.find(x=>x.id===id);
      if(u)Object.assign(u,data.user);
      if(String(ADMIN_USER?.id)===String(id))applyAdminUser({...ADMIN_USER,...data.user});
      localStorage.setItem(LS,JSON.stringify(DB));
      renderView();openDrawer(userDrawer(u));
      toast('Đã cập nhật quyền & thông tin ✓');
    }catch(e){toast(e.message||'Không cập nhật được người dùng','err');}
  },
  openUser(id){const u=DB.users.find(x=>x.id===id);if(u)openDrawer(userDrawer(u));},
  toggleLock(id,drawer){const u=DB.users.find(x=>x.id===id);u.status=u.status==='locked'?'active':'locked';save();renderView();toast(u.status==='locked'?'Đã khoá '+u.name:'Đã mở khoá '+u.name,'info');if(drawer)openDrawer(userDrawer(u));},
  /* Khám phá Nhật Bản */
  delJapanReview(id){confirmModal('Xoá đánh giá địa điểm?','Đánh giá này sẽ bị gỡ khỏi mục Khám phá Nhật Bản trong app.',async()=>{try{const r=await fetch(API+'/japan-spots/reviews/'+encodeURIComponent(id),{method:'DELETE'});if(!r.ok)throw 0;await loadJapan();toast('Đã xoá đánh giá ✓');}catch(e){toast('Không xoá được','err');}},true);},
  delJapanSuggestion(id){confirmModal('Xoá gợi ý?','Gợi ý địa điểm này sẽ bị gỡ khỏi hệ thống.',async()=>{try{const r=await fetch(API+'/japan-spots/suggestions/'+encodeURIComponent(id),{method:'DELETE'});if(!r.ok)throw 0;await loadJapan();toast('Đã xoá gợi ý ✓');}catch(e){toast('Không xoá được','err');}},true);},
  /* Kiểm duyệt AI */
  async testMod(){const t=(document.getElementById('mod-test')||{}).value||'';const box=document.getElementById('mod-result');if(!t.trim()){box.innerHTML='<div class="faint" style="font-size:12px">Nhập nội dung để kiểm tra.</div>';return;}box.innerHTML='<div class="faint" style="font-size:12px">Đang kiểm tra…</div>';try{const d=await requestJSON('/moderation/test',12000,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:t})});const tone=d.decision==='rejected'?'b-red':d.decision==='pending'?'b-amber':'b-green';const label=d.decision==='rejected'?'❌ BỊ CHẶN':d.decision==='pending'?'⏳ CHỜ DUYỆT':'✅ HỢP LỆ';box.innerHTML=`<div class="banner ${d.decision==='rejected'?'err':d.decision==='approved'?'ok':'warn'}"><div class="bi">${d.decision==='rejected'?'🛑':d.decision==='approved'?'✅':'⏳'}</div><div><b>${label}</b> · điểm ${Math.round((d.score||0)*100)}% · engine: ${esc(d.engine||'')}<div style="font-size:11.5px;margin-top:4px">${esc(d.reason||'')}</div>${(d.categories||[]).length?`<div style="margin-top:6px">${d.categories.map(c=>`<span class="bdg ${tone}" style="margin:0 4px 4px 0;display:inline-block">${esc(c)}</span>`).join('')}</div>`:''}${d.normalized?`<div class="faint" style="font-size:10.5px;margin-top:4px">Chuẩn hoá: <code>${esc(d.normalized)}</code></div>`:''}</div></div>`;}catch(e){box.innerHTML='<div class="faint" style="font-size:12px;color:var(--red,#c00)">Không kiểm tra được (backend/model chưa sẵn sàng).</div>';}},
  async modSet(id,status){try{const r=await fetch(API+'/reviews/'+encodeURIComponent(id)+'/moderation',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});if(!r.ok)throw 0;await loadModeration();try{DB=await requestJSON('/state',6000);}catch(_){}refreshChrome();toast(status==='approved'?'Đã duyệt bình luận ✓':'Đã chặn bình luận ✓');}catch(e){toast('Không cập nhật được','err');}},
  /* notifications */
  sendNoti(){const t=$('#n-title').value.trim(),b=$('#n-body').value.trim(),ty=$('#n-type').value,targetEmail=($('#n-target').value||'').trim().toLowerCase();
    if(!t||!b){toast('Nhập tiêu đề và nội dung','err');return;}
    let userId=null;
    if(targetEmail){const user=(DB.users||[]).find(u=>String(u.email||'').toLowerCase()===targetEmail);if(!user){toast('Không tìm thấy khách hàng với email này','err');return;}userId=user.id;}
    const who=userId?'riêng khách '+targetEmail:'tất cả '+DB.users.length+' người dùng';
    confirmModal('Gửi thông báo?','Thông báo sẽ được gửi tới '+who+' (cả trong app lẫn thông báo đẩy).',async()=>{
      try{
        toast('Đang gửi…','info');
        const resp=await fetch(API+'/admin/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:t,body:b,type:ty,userId})});
        const data=await resp.json();
        if(!resp.ok)throw new Error(data.message||'Không gửi được');
        DB=await requestJSON('/state',8000);refreshChrome();renderView();
        toast('Đã gửi tới '+who+' ✓');
      }catch(e){toast(e.message||'Không gửi được thông báo','err');}
    });},
  /* categories */
  addCategory(){openModal(`<div class="mh"><h3>Thêm danh mục</h3><div class="x" onclick="closeModal()">✕</div></div><div class="mb"><div class="field"><label>Tên danh mục</label><input id="c-name" class="inp" placeholder="VD: Túi xách"></div><div class="field"><label>Kanji (tuỳ chọn)</label><input id="c-kanji" class="inp" placeholder="鞄"></div></div><div class="mf"><button class="btn" onclick="closeModal()">Huỷ</button><button class="btn p" onclick="A.saveCategory()">Thêm</button></div>`);},
  saveCategory(){const n=$('#c-name').value.trim();if(!n){toast('Nhập tên danh mục','err');return;}DB.categories.push({id:slugify(n),name:n,kanji:$('#c-kanji').value.trim()});save();closeModal();renderView();toast('Đã thêm danh mục ✓');},
  delCategory(id){const used=DB.products.filter(p=>p.cat===id).length;confirmModal('Xoá danh mục?',(used?'Có '+used+' sản phẩm thuộc danh mục này. ':'')+'Bạn chắc chắn muốn xoá?',()=>{DB.categories=DB.categories.filter(c=>c.id!==id);save();renderView();toast('Đã xoá danh mục','info');},true);},
  /* vouchers */
  addVoucher(){openModal(`<div class="mh"><h3>Tạo voucher</h3><div class="x" onclick="closeModal()">✕</div></div><div class="mb">
    <div class="row2"><div class="field"><label>Mã</label><input id="v-code" class="inp mono" placeholder="THU20"></div><div class="field"><label>Loại</label><select id="v-type" class="sel"><option value="percent">Phần trăm (%)</option><option value="amount">Số tiền (₫)</option></select></div></div>
    <div class="row2"><div class="field"><label>Giá trị</label><input id="v-val" class="inp mono" type="number" placeholder="20"></div><div class="field"><label>Đơn tối thiểu</label><input id="v-min" class="inp mono" type="number" placeholder="0"></div></div>
    <div class="row2"><div class="field"><label>Hạn dùng</label><input id="v-exp" class="inp" type="date"></div><div class="field"><label>Giới hạn lượt</label><input id="v-lim" class="inp mono" type="number" placeholder="500"></div></div>
    </div><div class="mf"><button class="btn" onclick="closeModal()">Huỷ</button><button class="btn p" onclick="A.saveVoucher()">Tạo</button></div>`);},
  saveVoucher(){const code=$('#v-code').value.trim().toUpperCase();if(!code){toast('Nhập mã voucher','err');return;}DB.vouchers.push({code,type:$('#v-type').value,value:+$('#v-val').value||0,min:+$('#v-min').value||0,expiry:$('#v-exp').value||'—',limit:+$('#v-lim').value||100,used:0,active:true});save();closeModal();renderView();toast('Đã tạo voucher '+code+' ✓');},
  toggleVoucher(code){const v=DB.vouchers.find(x=>x.code===code);v.active=!v.active;save();renderView();},
  delVoucher(code){confirmModal('Xoá voucher?','Mã '+code+' sẽ bị xoá.',()=>{DB.vouchers=DB.vouchers.filter(x=>x.code!==code);save();renderView();toast('Đã xoá voucher','info');},true);},
  /* flagcards */
  toggleFlagcardProgram(){DB.flagcardConfig.active=!DB.flagcardConfig.active;save();renderView();toast(DB.flagcardConfig.active?'Đã bật chương trình thẻ địa danh ✓':'Đã tạm dừng chương trình thẻ địa danh','info');},
  saveFlagcardConfig(){
    DB.flagcardConfig={...DB.flagcardConfig,
      qualifyingOrderMin:Math.max(0,+$('#fc-min').value||0),
      requiredCards:Math.max(1,+$('#fc-req').value||7),
      rewardPercent:Math.min(100,Math.max(1,+$('#fc-pct').value||50)),
      rewardVoucherMinOrder:Math.max(0,+$('#fc-vmin').value||0),
      rewardValidityDays:Math.max(1,+$('#fc-days').value||90),
    };
    save();renderView();toast('Đã lưu cấu hình chương trình thẻ địa danh ✓');
  },
  toggleFlagcardActive(id){const c=(DB.flagcards||[]).find(x=>x.id===id);if(!c)return;c.active=c.active===false?true:false;save();renderView();toast(c.active?'Đã bật lại thẻ':'Đã tạm ẩn thẻ','info');},
  async grantFlagcard(){
    const userId=($('#fc-grant-user').value||'').trim();const cardId=$('#fc-grant-card').value;
    if(!userId){toast('Nhập userId khách hàng','err');return;}
    try{
      const r=await fetch(API+'/flagcards/admin/grant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,cardId})});
      const data=await r.json();
      if(!r.ok||!data.ok){toast(data.message||'Không cấp được thẻ','err');return;}
      DB=await requestJSON('/state',6000);NET_OK=true;refreshChrome();renderView();
      toast('Đã cấp thẻ cho '+userId+' ✓');
    }catch(e){toast('Không kết nối được backend để cấp thẻ','err');}
  },
  /* banners */
  addBanner(){openModal(`<div class="mh"><h3>Thêm ảnh quảng bá</h3><div class="x" onclick="closeModal()">✕</div></div><div class="mb"><div class="field"><label>Tiêu đề</label><input id="bn-title" class="inp" placeholder="Bộ sưu tập mới"></div><div class="field"><label>Liên kết</label><input id="bn-link" class="inp mono" placeholder="/category/haori"></div><div class="field"><label>Màu nền</label><div class="chips">${['#8A2F26','#243244','#6B7255','#B08D3C','#6D28D9'].map(c=>`<div class="sw" onclick="A._bnc='${c}';document.querySelectorAll('#bnc .sw').forEach(x=>x.style.outline='');this.style.outline='2px solid #A33A2F'" style="width:30px;height:30px;border-radius:6px;background:${c};cursor:pointer"></div>`).join('')}</div><div id="bnc"></div></div></div><div class="mf"><button class="btn" onclick="closeModal()">Huỷ</button><button class="btn p" onclick="A.saveBanner()">Thêm</button></div>`);A._bnc='#8A2F26';},
  saveBanner(){const t=$('#bn-title').value.trim();if(!t){toast('Nhập tiêu đề','err');return;}DB.banners.push({id:'b'+Date.now(),title:t,img:A._bnc||'#8A2F26',link:$('#bn-link').value||'/',active:true,order:DB.banners.length+1});save();closeModal();renderView();toast('Đã thêm ảnh quảng bá ✓');},
  toggleBanner(id){const b=DB.banners.find(x=>x.id===id);b.active=!b.active;save();renderView();},
  delBanner(id){DB.banners=DB.banners.filter(x=>x.id!==id);save();renderView();toast('Đã xoá ảnh quảng bá','info');},
  /* settings */
  async saveShop(){const patch={name:$('#set-name').value,hotline:$('#set-hotline').value,email:$('#set-email').value,address:$('#set-addr').value};try{await persistShop(patch);toast('Đã lưu thông tin cửa hàng ✓');}catch(e){toast('Không lưu được thông tin cửa hàng','err');}},
  async setShip(v){try{await persistShop({shipFee:+v||0});toast('Đã cập nhật phí vận chuyển');}catch(e){toast('Không cập nhật được phí vận chuyển','err');}},
  async toggleShop(k){const value=!DB.shop[k];try{await persistShop({[k]:value});renderView();}catch(e){toast('Không cập nhật được cấu hình','err');}},
  uploadLogo(){const inp=document.createElement('input');inp.type='file';inp.accept='image/png,image/jpeg,image/webp,image/svg+xml';inp.onchange=e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>3*1024*1024){toast('Logo vượt quá 3 MB','err');return;}const reader=new FileReader();reader.onload=async()=>{try{await persistShop({logo:String(reader.result)});renderView();toast('Đã đổi logo · ứng dụng sẽ tự cập nhật ✓');}catch(err){toast('Không tải được logo','err');}};reader.readAsDataURL(file);};inp.click();},
  async removeLogo(){try{await persistShop({logo:null});renderView();toast('Đã gỡ logo');}catch(e){toast('Không gỡ được logo','err');}},
  async testInt(k){const started=performance.now();await refreshHealth(false);const statuses={database:HEALTH.database,cloud:HEALTH.cloudinary,ai:anyStatus(HEALTH.gateway,HEALTH.catvton),ollama:HEALTH.ollama,pillow:HEALTH.pillow,stripe:HEALTH.stripe,vnpay:HEALTH.vnpay};const ok=statuses[k]===true;if(state.route==='settings')renderView();toast(ok?`Kết nối ${k.toUpperCase()} OK · ${Math.max(1,Math.round(performance.now()-started))}ms ✓`:`${k.toUpperCase()} chưa sẵn sàng` ,ok?'info':'err');},
  importCSV(){const inp=document.createElement('input');inp.type='file';inp.accept='.csv,.txt';inp.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const lines=r.result.split(/\r?\n/).filter(Boolean);let n=0;lines.slice(1).forEach(ln=>{const[name,cat,price,stock]=ln.split(',');if(!name)return;DB.products.push({id:'p'+Date.now()+n,name:name.trim(),sku:slugify(name).slice(0,6).toUpperCase(),cat:(DB.categories.find(c=>c.id===(cat||'').trim())?cat.trim():'phu-kien'),brand:'JAPANO',price:+price||0,old:null,sale:null,status:'published',colorHex:'#8A2F26',tags:[],desc:'',story:'',images:[],variants:[{colorName:'Mặc định',colorHex:'#8A2F26',size:'M',sku:'',stock:+stock||0}]});n++;});DB.seeded=true;save();refreshChrome();renderView();toast('Đã nhập '+n+' sản phẩm ✓');}catch(err){toast('Tệp CSV không hợp lệ','err');}};r.readAsText(f);};inp.click();},
  exportCSV(){downloadCSV('japano-products.csv',[['Ten','Danh muc','Gia','Ton kho','Trang thai']].concat(DB.products.map(p=>[p.name,p.cat,p.price,stock(p),effStatus(p)])));toast('Đã xuất '+DB.products.length+' sản phẩm ✓');},
  resetData(){confirmModal('Xoá toàn bộ dữ liệu?','Toàn bộ sản phẩm, đơn hàng, người dùng sẽ bị xoá và hệ thống trở về trạng thái trống. Không thể hoàn tác.',()=>{fetch(API+'/reset',{method:'POST'}).then(r=>r.json()).then(st=>{DB=st;NET_OK=true;go('dashboard');toast('Đã xoá toàn bộ dữ liệu','info');}).catch(()=>{DB=emptyDB();save();go('dashboard');toast('Đã xoá toàn bộ dữ liệu','info');});},true);},
};
function downloadCSV(name,rows){const csv=rows.map(r=>r.map(c=>`"${(''+c).replace(/"/g,'""')}"`).join(',')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();}

/* ================= INIT ================= */
$('#apiToggle').addEventListener('click',()=>A.toggleApi());
ensureAdminSession().then(bootstrap);
