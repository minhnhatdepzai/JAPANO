/* ================= ORDERS ================= */
function orderRow(o){
  const thumbs=o.items.slice(0,3).map(it=>{const p=findProductForItem(it)||{colorHex:it.colorHex,cat:''};return thumb(p);}).join('');
  const nextStatus=(ORDER_NEXT[o.status]||[])[0];
  const next = nextStatus?{a:nextStatus,t:ORDER_STEP_LABEL[o.status]||'Bước tiếp',c:'p'}:null;
  return `<tr>
    <td class="bold mono">#${o.code}</td>
    <td>${esc(o.customer.name)}${o.vipDiscount?'<span class="bdg b-violet" style="margin-left:6px"><span class="d"></span>VIP -10%</span>':''}<div class="faint" style="font-size:11px">${o.customer.phone}</div></td>
    <td class="muted" style="max-width:180px"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(o.address)}">${esc(o.address)}</div></td>
    <td><div style="display:flex;align-items:center;gap:8px"><div class="stack">${thumbs}</div><span class="faint">${o.items.length} món</span></div></td>
    <td class="bold">${money(o.total)}</td>
    <td>${o.payment.method}<div style="margin-top:3px">${badge(PAY,o.payment.status)}</div></td>
    <td>${badge(ORD,o.status)}</td>
    <td class="faint" style="font-size:11px">${fmtDate(o.createdAt)}</td>
    <td class="right"><div style="display:flex;gap:6px;justify-content:flex-end">${next?`<button class="btn p sm" onclick="A.setOrder('${o.id}','${next.a}')">${next.t}</button>`:''}<button class="btn sm" onclick="A.openOrder('${o.id}')">Xem</button></div></td>
  </tr>`;
}
function viewOrders(){
  if(!DB.seeded||DB.orders.length===0)return emptyPanel('🧾','Chưa có đơn hàng','Khi khách đặt hàng thật trên ứng dụng, đơn sẽ tự động hiện chính xác tại đây.',[]);
  const q=(state.oQuery||'').toLowerCase();
  const tabs=[['all','Tất cả'],['pending','Chờ xác nhận'],['confirmed','Đã xác nhận'],['shipping','Đang giao'],['delivered','Chờ khách xác nhận'],['completed','Khách đã nhận'],['returned','Đã trả hàng'],['cancelled','Đã huỷ']];
  let list=DB.orders.filter(o=>state.oStatus==='all'||o.status===state.oStatus);
  if(q)list=list.filter(o=>o.code.toLowerCase().includes(q)||o.customer.name.toLowerCase().includes(q)||o.customer.phone.includes(q));
  list=[...list].sort((a,b)=>b.createdAt-a.createdAt);
  return `
  <div class="filters">
    <div class="tabs">${tabs.map(t=>`<button class="${state.oStatus===t[0]?'on':''}" onclick="A.oTab('${t[0]}')">${t[1]}<span class="c">${t[0]==='all'?DB.orders.length:countStatus(t[0])}</span></button>`).join('')}</div>
    <div class="search" style="max-width:260px"><span>🔍</span><input placeholder="Mã đơn / tên / SĐT" value="${esc(state.oQuery||'')}" oninput="A.oSearch(this.value)"></div>
    <div class="hspace"></div>
    <button class="btn" onclick="A.exportOrders()"><span class="ic">⇩</span>Xuất dữ liệu</button>
  </div>
  <div class="panel"><div class="tablewrap"><table class="tbl">
    <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Địa chỉ giao</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Thanh toán</th><th>Vận chuyển</th><th>Ngày</th><th></th></tr></thead>
    <tbody id="ordBody">${list.length?list.map(orderRow).join(''):`<tr><td colspan="9"><div style="text-align:center;color:var(--faint);padding:26px">Không có đơn phù hợp bộ lọc.</div></td></tr>`}</tbody>
  </table></div></div>`;
}

/* ================= STRIPE PAYMENTS ================= */
function paymentOrder(p){return DB.orders.find(o=>o.id===p.orderId||o.code===p.orderCode)||null;}
function orderPayment(o){return (DB.payments||[]).find(p=>p.orderId===o.id||p.orderCode===o.code)||null;}
function paymentList(){
  const q=(state.payQuery||'').trim().toLowerCase();
  let list=[...(DB.payments||[])];
  if(state.payStatus!=='all')list=list.filter(p=>p.status===state.payStatus);
  if(q)list=list.filter(p=>[p.code,p.orderCode,p.transactionCode,p.paymentIntentId,p.checkoutSessionId,p.userId].some(v=>String(v||'').toLowerCase().includes(q)));
  return list.sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
}
function paymentRow(p){
  const o=paymentOrder(p);const intent=String(p.paymentIntentId||p.transactionCode||'');
  const isVnpay=p.provider==='vnpay';
  const realStripe=!isVnpay&&intent.startsWith('pi_')&&!intent.startsWith('pi_seed_');
  const canRefund=(realStripe||isVnpay)&&p.refundable&&['paid','partially_refunded'].includes(p.status);
  const card=isVnpay
    ?(p.vnpBankCode?`${p.vnpBankCode}${p.vnpCardType?' · '+p.vnpCardType:''}`:'—')
    :(p.card?.last4?`${String(p.card.brand||'card').toUpperCase()} •••• ${p.card.last4}`:'—');
  const waitingLabel=isVnpay?'Đang chờ VNPay':'Đang chờ Stripe';
  return `<tr>
    <td><div class="bold mono">${esc(p.code||p.id)}</div><div class="faint" style="font-size:10.5px">${esc(p.provider||'stripe')}</div></td>
    <td><button class="link" onclick="A.openOrder('${esc(o?.id||p.orderId)}')">#${esc(p.orderCode||o?.code||'—')}</button></td>
    <td>${badge(PAY,p.status)}${p.refundedAmount?`<div class="faint" style="font-size:10.5px;margin-top:3px">Đã hoàn ${money(p.refundedAmount)}</div>`:''}</td>
    <td class="bold">${money(p.amount||0)}<div class="faint" style="font-size:10px;text-transform:uppercase">${esc(p.currency||'vnd')}</div></td>
    <td><div class="mono" style="font-size:10.5px;max-width:210px;overflow:hidden;text-overflow:ellipsis" title="${esc(intent)}">${esc(intent||waitingLabel)}</div><div class="faint" style="font-size:10.5px;margin-top:3px">${esc(card)}</div></td>
    <td class="faint" style="font-size:11px">${fmtDate(p.paidAt||p.createdAt)}</td>
    <td class="right"><div style="display:flex;gap:6px;justify-content:flex-end">
      <button class="btn sm" onclick="A.openPayment('${p.id}')">Chi tiết</button>
      ${realStripe?`<button class="btn sm" onclick="A.openStripePayment('${p.id}')">Stripe ↗</button>`:''}
      ${canRefund?`<button class="btn d sm" onclick="A.refundPayment('${p.id}')">Hoàn tiền</button>`:''}
    </div></td>
  </tr>`;
}
function viewPayments(){
  const all=DB.payments||[];
  const paid=all.filter(p=>p.status==='paid').reduce((s,p)=>s+Number(p.amount||0),0);
  const refunded=all.reduce((s,p)=>s+Number(p.refundedAmount||0),0);
  const pending=all.filter(p=>p.status==='pending').length;
  const real=all.filter(p=>p.provider==='stripe'&&String(p.paymentIntentId||'').startsWith('pi_')&&!String(p.paymentIntentId).startsWith('pi_seed_')).length;
  const tabs=[['all','Tất cả'],['paid','Đã thanh toán'],['pending','Đang chờ'],['refund_pending','Đang hoàn'],['partially_refunded','Hoàn một phần'],['refunded','Đã hoàn'],['failed','Thất bại']];
  const list=paymentList();
  return `<div class="grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
    <div class="kpi"><div class="lb">Tổng đã thu</div><div class="v">${money(paid)}</div><div class="dl" style="color:var(--faint)">Chế độ thử nghiệm Stripe &amp; VNPay</div></div>
    <div class="kpi"><div class="lb">Đã hoàn tiền</div><div class="v">${money(refunded)}</div><div class="dl" style="color:var(--faint)">Đồng bộ Refund API</div></div>
    <div class="kpi"><div class="lb">Đang chờ</div><div class="v">${pending}</div><div class="dl" style="color:var(--faint)">Checkout Session / VNPay Sandbox</div></div>
    <div class="kpi"><div class="lb">Giao dịch Stripe thật</div><div class="v">${real}</div><div class="dl" style="color:var(--faint)">Không tính dữ liệu mẫu</div></div>
  </div>
  <div class="banner warn" style="margin-bottom:14px"><div class="bi">💳</div><div><b>Stripe &amp; VNPay ở chế độ thử nghiệm.</b> Giao dịch và hoàn tiền trên trang này không thu hoặc trả tiền thật. Mã giao dịch và mã hoàn tiền được lưu vào cơ sở dữ liệu JAPANO.</div><div class="acts"><button class="btn sm" onclick="window.open('https://dashboard.stripe.com/test/payments','_blank')">Mở trang Stripe ↗</button><button class="btn sm" onclick="A.refreshPayments()">↻ Đối soát VNPay</button></div></div>
  <div class="filters">
    <div class="tabs">${tabs.map(t=>`<button class="${state.payStatus===t[0]?'on':''}" onclick="A.payTab('${t[0]}')">${t[1]}<span class="c">${t[0]==='all'?all.length:all.filter(p=>p.status===t[0]).length}</span></button>`).join('')}</div>
    <div class="search" style="max-width:290px"><span>🔍</span><input placeholder="Mã thanh toán / PI / đơn" value="${esc(state.payQuery||'')}" oninput="A.paySearch(this.value)"></div>
    <button class="btn" onclick="A.refreshPayments()">↻ Làm mới</button>
  </div>
  <div class="panel"><div class="tablewrap"><table class="tbl">
    <thead><tr><th>Mã thanh toán</th><th>Đơn hàng</th><th>Trạng thái</th><th>Số tiền</th><th>Giao dịch / thẻ</th><th>Thời gian</th><th></th></tr></thead>
    <tbody id="payBody">${list.length?list.map(paymentRow).join(''):`<tr><td colspan="7"><div style="text-align:center;color:var(--faint);padding:30px">Chưa có giao dịch phù hợp.</div></td></tr>`}</tbody>
  </table></div></div>`;
}
function paymentDrawer(p){
  const o=paymentOrder(p);const refunds=p.refunds||[];const intent=String(p.paymentIntentId||p.transactionCode||'');
  const rows=refunds.length?refunds.map(r=>`<tr><td class="mono">${esc(r.id)}</td><td>${badge(PAY,r.status==='succeeded'?'refunded':r.status)}</td><td class="right bold">${money(r.amount||0)}</td><td class="faint">${fmtDate(r.createdAt)}</td></tr>`).join(''):`<tr><td colspan="4" class="center faint" style="padding:20px">Chưa có lần hoàn tiền.</td></tr>`;
  const isVnpay=p.provider==='vnpay';
  const real=!isVnpay&&intent.startsWith('pi_')&&!intent.startsWith('pi_seed_');
  const canRefund=(real||isVnpay)&&p.refundable&&['paid','partially_refunded'].includes(p.status);
  const providerLabel=isVnpay?'VNPay':'Stripe';
  const promoTag=p.promotionCode?` · ${esc(p.promotionCode)}`:'';
  return `<div class="mh"><div><h3>Giao dịch ${esc(p.code||p.id)}</h3><div class="faint" style="font-size:11.5px">${badge(PAY,p.status)} · Chế độ thử nghiệm ${providerLabel}</div></div><div class="x" onclick="closeModal()">✕</div></div>
  <div class="mb"><div class="panel" style="box-shadow:none"><div class="pb">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px">
      <div><span class="faint">Đơn hàng</span><div class="bold">#${esc(p.orderCode||o?.code||'—')}</div></div>
      <div><span class="faint">Số tiền</span><div class="bold">${money(p.amount||0)}</div></div>
      ${isVnpay?`
      <div><span class="faint">Mã giao dịch VNPay</span><div class="mono" style="word-break:break-all">${esc(intent||'—')}</div></div>
      <div><span class="faint">Mã GD ngân hàng</span><div class="mono" style="word-break:break-all">${esc(p.vnpTransactionNo||'—')}</div></div>
      <div><span class="faint">Ngân hàng</span><div class="bold">${p.vnpBankCode?`${esc(p.vnpBankCode)}${p.vnpCardType?' · '+esc(p.vnpCardType):''}`:'—'}</div></div>
      `:`
      <div><span class="faint">Mã PaymentIntent</span><div class="mono" style="word-break:break-all">${esc(intent||'—')}</div></div>
      <div><span class="faint">Checkout Session</span><div class="mono" style="word-break:break-all">${esc(p.checkoutSessionId||'—')}</div></div>
      <div><span class="faint">Charge ID</span><div class="mono" style="word-break:break-all">${esc(p.chargeId||'—')}</div></div>
      <div><span class="faint">Thẻ test</span><div class="bold">${p.card?.last4?`${esc(String(p.card.brand||'card').toUpperCase())} •••• ${esc(p.card.last4)}`:'—'}</div></div>
      `}
      <div><span class="faint">Đã hoàn</span><div class="bold">${money(p.refundedAmount||0)}</div></div>
      <div><span class="faint">Ưu đãi ${providerLabel}</span><div class="bold" style="color:var(--green)">-${money(p.paymentDiscount||0)}${promoTag}</div></div>
      <div><span class="faint">Khách thanh toán</span><div class="bold">${esc(p.customer?.name||o?.customer?.name||'—')}</div><div class="faint">${esc(p.customer?.email||'')}</div></div>
      ${!isVnpay?`<div><span class="faint">Biên nhận Stripe</span><div>${p.receiptUrl?`<a href="${esc(p.receiptUrl)}" target="_blank" style="color:var(--brand);font-weight:700">Mở biên nhận ↗</a>`:'—'}</div></div>`:''}
    </div></div></div>
    <div class="section-title" style="margin:16px 0 10px"><h2 style="font-size:13px">Lịch sử hoàn tiền</h2></div>
    <div class="panel" style="box-shadow:none"><table class="tbl"><thead><tr><th>Mã hoàn tiền</th><th>Trạng thái</th><th class="right">Số tiền</th><th>Thời gian</th></tr></thead><tbody>${rows}</tbody></table></div>
  </div><div class="mf"><button class="btn" onclick="closeModal()">Đóng</button>${real?`<button class="btn" onclick="A.openStripePayment('${p.id}')">Mở Stripe ↗</button>`:''}${canRefund?`<button class="btn d" onclick="closeModal();A.refundPayment('${p.id}')">Hoàn tiền thử nghiệm</button>`:''}</div>`;
}

/* ================= RETURNS & REFUNDS ================= */
function returnOrder(r){return DB.orders.find(o=>o.id===r.orderId||o.code===r.orderCode)||null;}
function returnPayment(r){return (DB.payments||[]).find(p=>p.id===r.paymentId||p.orderId===r.orderId)||null;}
function returnList(){
  const q=(state.returnQuery||'').trim().toLowerCase();
  let list=[...(DB.returnRequests||[])];
  if(state.returnStatus!=='all')list=list.filter(r=>r.status===state.returnStatus);
  if(q)list=list.filter(r=>[r.code,r.orderCode,r.paymentCode,r.reason,r.userId,r.refundId].some(v=>String(v||'').toLowerCase().includes(q)));
  return list.sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
}
function returnActions(r,small=true){
  const cls=small?' sm':'';
  if(r.status==='requested')return `<button class="btn p${cls}" onclick="A.returnAction('${r.id}','approve')">Duyệt</button><button class="btn d${cls}" onclick="A.returnAction('${r.id}','reject')">Từ chối</button>`;
  // approved: chờ khách gửi hàng về. Khách mang trực tiếp tới cửa hàng thì vẫn
  // bấm "Đã nhận & kiểm hàng" được ngay, không cần bước vận đơn.
  if(r.status==='approved'||r.status==='shipped_back')return `<button class="btn g${cls}" onclick="A.returnAction('${r.id}','receive')">Đã nhận & kiểm hàng</button><button class="btn d${cls}" onclick="A.returnAction('${r.id}','reject')">Từ chối</button>`;
  if(r.status==='received'||r.status==='refund_failed'){const p=returnPayment(r);const providerLabel=r.codManualRefund?'thủ công (COD)':p?.provider==='vnpay'?'VNPay':'Stripe';return `<button class="btn d${cls}" onclick="A.returnAction('${r.id}','refund')">Hoàn ${providerLabel}</button>`;}
  return '';
}
// Yêu cầu trả từng món trong đơn nhiều sản phẩm: hiện rõ trả món nào, mấy cái.
function returnScopeBadge(r){
  if(r.kind==='cancel')return '';
  const count=(r.items||[]).reduce((sum,item)=>sum+Number(item.qty||0),0);
  return r.coversWholeOrder
    ? '<span class="bdg b-gray" style="margin-left:6px"><span class="d"></span>Cả đơn</span>'
    : `<span class="bdg b-amber" style="margin-left:6px"><span class="d"></span>${count} món</span>`;
}
function policyStageList(stages){
  return (stages||[]).map((stage,index)=>`<div class="polstage">
    <div class="polnum">${index+1}</div>
    <div><div class="polname">${esc(stage.label)}</div>
      <div class="polactor">Ai xác nhận: <b>${esc((POLICY?.actors||{})[stage.actor]||stage.actor)}</b>${stage.timerDays?` · trong ${stage.timerDays} ngày`:''}</div>
      <div class="poldesc">${esc(stage.description)}</div></div>
  </div>`).join('');
}
function returnPolicyPanel(){
  if(!POLICY){
    return `<div class="banner warn" style="margin-bottom:14px"><div class="bi">↩</div><div><b>Đang tải quy trình chuẩn…</b> Nội dung lấy trực tiếp từ máy chủ để trang quản trị và ứng dụng luôn mô tả cùng một quy trình.</div></div>`;
  }
  const t=POLICY.timers||{};
  return `<div class="panel" style="margin-bottom:14px"><div class="ph"><h3>Quy trình chuẩn · ai xác nhận bước nào</h3><span class="sub">Nguồn: backend/lib/fulfillmentPolicy.js · phiên bản ${esc(POLICY.version||'')}</span></div>
    <div class="pb">
      <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
        <div class="ministat" style="box-shadow:none"><div><div class="v">${t.autoConfirmDays}</div><div class="lb">ngày khách xác nhận nhận hàng</div></div></div>
        <div class="ministat" style="box-shadow:none"><div><div class="v">${t.returnWindowDays}</div><div class="lb">ngày được đổi/trả</div></div></div>
        <div class="ministat" style="box-shadow:none"><div><div class="v">${t.shipBackDays}</div><div class="lb">ngày khách gửi hàng về</div></div></div>
        <div class="ministat" style="box-shadow:none"><div><div class="v">${t.inspectionDays}</div><div class="lb">ngày cửa hàng kiểm hàng</div></div></div>
      </div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:16px;align-items:start">
        <div><div class="section-title" style="margin:0 0 8px"><h2 style="font-size:12.5px">Đơn hàng</h2></div>${policyStageList(POLICY.order?.stages)}</div>
        <div><div class="section-title" style="margin:0 0 8px"><h2 style="font-size:12.5px">Đổi / trả hàng</h2></div>${policyStageList(POLICY.return?.stages)}</div>
      </div>
      <div class="section-title" style="margin:16px 0 8px"><h2 style="font-size:12.5px">Điều kiện đổi/trả</h2></div>
      <ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.75;color:var(--muted,#666)">${(POLICY.return?.conditions||[]).map(item=>`<li>${esc(item)}</li>`).join('')}</ul>
    </div></div>`;
}
function returnKindBadge(r){return r.kind==='cancel'?'<span class="bdg b-gray" style="margin-left:6px"><span class="d"></span>Huỷ đơn</span>':'<span class="bdg b-violet" style="margin-left:6px"><span class="d"></span>Trả hàng</span>';}
function returnRow(r){const o=returnOrder(r);const p=returnPayment(r);const isVnpay=p?.provider==='vnpay';const method=isVnpay?`${p?.vnpBankCode||'VNPAY'}${p?.vnpCardType?' · '+p.vnpCardType:''}`:`${p?.card?.brand||'CARD'} •••• ${p?.card?.last4||'—'}`;return `<tr>
  <td><div class="bold mono">${esc(r.code)}${returnKindBadge(r)}${returnScopeBadge(r)}</div><div class="faint" style="font-size:10.5px">${fmtDate(r.createdAt)}</div></td>
  <td><button class="link" onclick="A.openOrder('${esc(o?.id||r.orderId)}')">#${esc(r.orderCode||o?.code||'—')}</button><div class="faint" style="font-size:10.5px">${esc(o?.customer?.name||r.userId||'')}</div></td>
  <td>${badge(RET,r.status)}</td><td style="max-width:240px"><div class="bold" style="font-size:11.5px">${esc(r.reason)}</div><div class="faint" style="font-size:10.5px;white-space:normal;line-height:1.45">${esc((r.items||[]).map(item=>`${item.name} ×${item.qty}`).join(', ')||r.note||'Không có ghi chú')}</div></td>
  <td class="bold">${money(r.amount||0)}<div class="faint" style="font-size:10px">${esc(method)}</div></td>
  <td><div class="mono" style="font-size:10.5px">${esc(r.refundId||'Chưa tạo Refund')}</div></td>
  <td class="right"><div style="display:flex;gap:6px;justify-content:flex-end">${returnActions(r)}<button class="btn sm" onclick="A.openReturn('${r.id}')">Chi tiết</button></div></td></tr>`;}
function viewReturns(){
  const all=DB.returnRequests||[];const waiting=all.filter(r=>['requested','approved','received'].includes(r.status)).length;const refunded=all.filter(r=>r.status==='refunded').reduce((s,r)=>s+Number(r.amount||0),0);const list=returnList();
  const tabs=[['all','Tất cả'],['requested','Chờ duyệt'],['approved','Chờ khách gửi'],['shipped_back','Khách đã gửi về'],['received','Đã nhận hàng'],['refund_pending','Đang hoàn'],['refunded','Đã hoàn'],['rejected','Từ chối']];
  return `<div class="grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px"><div class="kpi"><div class="lb">Tổng yêu cầu</div><div class="v">${all.length}</div><div class="dl">Mã RMA/RTN riêng</div></div><div class="kpi"><div class="lb">Cần xử lý</div><div class="v">${waiting}</div><div class="dl" style="color:var(--amber)">Duyệt · nhận hàng · hoàn tiền</div></div><div class="kpi"><div class="lb">Đã hoàn tiền</div><div class="v">${money(refunded)}</div><div class="dl">Qua Stripe &amp; VNPay</div></div></div>
  ${returnPolicyPanel()}
  <div class="filters"><div class="tabs">${tabs.map(t=>`<button class="${state.returnStatus===t[0]?'on':''}" onclick="A.returnTab('${t[0]}')">${t[1]}<span class="c">${t[0]==='all'?all.length:all.filter(r=>r.status===t[0]).length}</span></button>`).join('')}</div><div class="search" style="max-width:280px"><span>🔍</span><input placeholder="Mã trả hàng / đơn / refund" value="${esc(state.returnQuery||'')}" oninput="A.returnSearch(this.value)"></div><button class="btn" onclick="A.refreshReturns()">↻ Làm mới</button></div>
  <div class="panel"><div class="tablewrap"><table class="tbl"><thead><tr><th>Mã trả hàng</th><th>Đơn hàng</th><th>Trạng thái</th><th>Lý do</th><th>Tiền hoàn</th><th>Mã hoàn tiền</th><th></th></tr></thead><tbody id="returnBody">${list.length?list.map(returnRow).join(''):`<tr><td colspan="7"><div style="text-align:center;color:var(--faint);padding:30px">Chưa có yêu cầu trả hàng phù hợp.</div></td></tr>`}</tbody></table></div></div>`;
}
function returnDrawer(r){const o=returnOrder(r),p=returnPayment(r);const timeline=(r.timeline||[]).map(item=>`<div class="n done"><div class="dotn"></div><div><div class="tl-b">${esc(RET[item.s]?.t||item.s)}</div><div class="tl-t">${fmtDate(item.at)}${item.note?` · ${esc(item.note)}`:''}${item.refundId?` · <span class="mono">${esc(item.refundId)}</span>`:''}</div></div></div>`).join('');
  const photos=(r.photos||[]).length?`<div class="section-title" style="margin:16px 0 10px"><h2 style="font-size:13px">Ảnh khách đính kèm</h2></div><div style="display:flex;gap:8px;flex-wrap:wrap">${r.photos.map(url=>`<a href="${esc(url)}" target="_blank"><img src="${esc(url)}" style="width:84px;height:84px;object-fit:cover;border-radius:9px;border:1px solid var(--line)"></a>`).join('')}</div>`:'';
  const itemRows=(r.items||[]).length?`<div class="section-title" style="margin:16px 0 10px"><h2 style="font-size:13px">Sản phẩm khách yêu cầu trả</h2><span class="sub">${r.coversWholeOrder?'Toàn bộ đơn':'Trả một phần đơn'}</span></div>
  <div class="panel" style="box-shadow:none"><table class="tbl"><thead><tr><th>Sản phẩm</th><th class="center">SL trả</th><th class="right">Tiền hàng</th></tr></thead><tbody>${r.items.map(item=>`<tr><td><div class="bold" style="font-size:12.5px">${esc(item.name)}</div><div class="faint" style="font-size:11px">${esc(item.colorName||'')} · Kích cỡ ${esc(item.size||'')}</div></td><td class="center">×${item.qty}</td><td class="right bold">${money(Number(item.price||0)*Number(item.qty||0))}</td></tr>`).join('')}</tbody></table></div>`:'';
  const b=r.refundBreakdown;
  const breakdown=b?`<div class="panel" style="box-shadow:none;margin-top:12px"><div class="pb" style="font-size:12px">
    <div class="faint" style="font-size:10.5px;text-transform:uppercase;margin-bottom:6px">Cách tính tiền hoàn</div>
    <div style="display:flex;justify-content:space-between"><span class="muted">Tiền hàng của các món được trả</span><b>${money(b.itemsValue||0)}</b></div>
    ${b.discountAllocated?`<div style="display:flex;justify-content:space-between;margin-top:4px"><span class="muted">Giảm giá đơn phân bổ theo tỉ lệ</span><b style="color:var(--red)">-${money(b.discountAllocated)}</b></div>`:''}
    ${b.vipDiscountAllocated?`<div style="display:flex;justify-content:space-between;margin-top:4px"><span class="muted">Ưu đãi VIP của đúng món này</span><b style="color:var(--red)">-${money(b.vipDiscountAllocated)}</b></div>`:''}
    <div style="display:flex;justify-content:space-between;margin-top:4px"><span class="muted">Phí vận chuyển ${b.shipRefunded?'(trả cả đơn nên hoàn lại)':'(trả một phần nên không hoàn)'}</span><b style="color:${b.shipRefunded?'var(--green)':'var(--faint)'}">${b.shipRefunded?'+'+money(b.shipRefunded):money(0)}</b></div>
    <div style="display:flex;justify-content:space-between;margin-top:8px;border-top:1px solid var(--line2);padding-top:8px"><span class="bold">Tổng hoàn</span><b style="font-size:14px;color:var(--brand)">${money(r.amount||0)}</b></div>
  </div></div>`:'';
  const shipBack=r.shipBack?`<div class="banner ok" style="margin-top:12px"><div class="bi">📦</div><div><b>Khách đã gửi hàng về.</b> ${esc(r.shipBack.carrier)} · mã vận đơn <span class="mono">${esc(r.shipBack.trackingCode)}</span> — khai báo lúc ${fmtDate(r.shipBack.at)}.</div></div>`
    :r.status==='approved'?`<div class="banner warn" style="margin-top:12px"><div class="bi">⏳</div><div><b>Đang chờ khách gửi hàng về.</b> Khách nhập mã vận đơn chiều về trong ứng dụng${r.shipBackDeadline?`, hạn ${fmtDate(r.shipBackDeadline)}`:''}. Khách mang trực tiếp tới cửa hàng thì bấm luôn "Đã nhận & kiểm hàng".</div></div>`:'';
  return `<div class="mh"><div><h3>Yêu cầu ${esc(r.code)}${returnKindBadge(r)}${returnScopeBadge(r)}</h3><div style="margin-top:4px">${badge(RET,r.status)}</div></div><div class="x" onclick="closeModal()">✕</div></div><div class="mb">
  <div class="panel" style="box-shadow:none"><div class="pb" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px"><div><span class="faint">Đơn hàng</span><div class="bold">#${esc(r.orderCode)}</div></div><div><span class="faint">Khách hàng</span><div class="bold">${esc(o?.customer?.name||r.userId)}</div></div><div><span class="faint">Số tiền hoàn</span><div class="bold">${money(r.amount)}</div></div><div><span class="faint">Thanh toán</span><div class="bold">${r.codManualRefund?'COD (hoàn thủ công)':`${esc(String(p?.card?.brand||p?.provider||'card').toUpperCase())} •••• ${esc(p?.card?.last4||'—')}`}</div></div><div><span class="faint">PaymentIntent</span><div class="mono" style="word-break:break-all">${esc(p?.paymentIntentId||'—')}</div></div><div><span class="faint">Refund ID</span><div class="mono" style="word-break:break-all">${esc(r.refundId||'—')}</div></div></div></div>
  <div class="panel" style="box-shadow:none;margin-top:12px"><div class="pb"><div class="faint" style="font-size:10.5px;text-transform:uppercase">${r.kind==='cancel'?'Lý do khách huỷ đơn':'Lý do khách trả hàng'}</div><div class="bold" style="margin-top:5px">${esc(r.reason)}</div><div class="muted" style="font-size:12px;margin-top:5px">${esc(r.note||'Không có ghi chú thêm.')}</div></div></div>
  ${itemRows}
  ${breakdown}
  ${shipBack}
  ${photos}
  <div class="section-title" style="margin:16px 0 10px"><h2 style="font-size:13px">Lịch sử xử lý</h2></div><div class="timeline">${timeline}</div></div>
  <div class="mf"><button class="btn" onclick="closeModal()">Đóng</button>${p?`<button class="btn" onclick="A.openPayment('${p.id}')">Xem thanh toán</button>`:''}<button class="btn" onclick="A.promptVoucher('${r.userId}','${esc(r.orderCode)}')">🎁 Gửi voucher đền bù</button>${returnActions(r,false)}</div>`;}
function orderDrawer(o){
  const chain=['pending','confirmed','shipping','completed'];
  const pay=orderPayment(o);
  const isVnpay=/vnpay/i.test(o.payment.method);
  const items=o.items.map(it=>{const p=findProductForItem(it)||{colorHex:it.colorHex,cat:''};const vipOn=o.vipPromotion&&String(it.slug||it.productId)===String(o.vipPromotion.productId)&&(!o.vipPromotion.colorName||it.colorName===o.vipPromotion.colorName)&&(!o.vipPromotion.size||it.size===o.vipPromotion.size);
    return `<tr><td><div class="prod">${thumb(p)}<div><div class="bold" style="font-size:12.5px">${esc(it.name)}${vipOn?'<span class="bdg b-violet" style="margin-left:6px"><span class="d"></span>VIP -10% · 1 món</span>':''}</div><div class="faint" style="font-size:11px">${esc(it.colorName)} · Kích cỡ ${it.size}</div></div></div></td><td class="center">×${it.qty}</td><td class="right bold">${money(it.price*it.qty)}</td></tr>`;}).join('');
  const hist=o.history.map((h,i)=>{const meta=ORD[h.s]||PAY[h.s]||{t:h.s};return `<div class="n done"><div class="dotn"></div><div><div class="tl-b">${esc(meta.t)}</div><div class="tl-t">${fmtDate(h.at)}${h.txn?` · <span class="mono">${esc(h.txn)}</span>`:''}</div></div></div>`;}).join('');
  const cancellable=['pending','pending_payment','confirmed'].includes(o.status);
  const actions = ['cancelled','completed','returned'].includes(o.status)
     ? `<span class="muted" style="font-size:12px;align-self:center">Đơn đã ${o.status==='completed'?'được khách xác nhận nhận hàng':o.status==='returned'?'trả hàng và hoàn tiền':'huỷ'} — không thể thay đổi trạng thái.</span>`
     : `${o.status==='pending'||o.status==='pending_payment'?`<button class="btn p" onclick="A.setOrder('${o.id}','${o.status==='pending_payment'?'pending':'confirmed'}',1)">${o.status==='pending_payment'?'Ghi nhận đã thanh toán':'Xác nhận đơn'}</button>`:''}
        ${o.status==='confirmed'?`<button class="btn p" onclick="A.setOrder('${o.id}','shipping',1)">Bàn giao đơn vị vận chuyển</button>`:''}
        ${o.status==='shipping'?`<button class="btn p" onclick="A.setOrder('${o.id}','delivered',1)">Đơn vị vận chuyển đã giao</button>`:''}
        ${o.status==='delivered'?`<button class="btn g" onclick="A.setOrder('${o.id}','completed',1)">Xác nhận thay khách (hỗ trợ)</button>`:''}
        ${cancellable?`<button class="btn d" onclick="A.cancelOrder('${o.id}')">Huỷ đơn</button>`:''}`;
  const stageHint = o.status==='shipping'
     ? 'Hàng đang ở đơn vị vận chuyển. Khi bên vận chuyển báo đã giao, bấm "Đơn vị vận chuyển đã giao" — khách sẽ nhận thông báo để kiểm hàng và tự xác nhận.'
     : o.status==='delivered'
     ? 'Đang chờ KHÁCH bấm "Đã nhận hàng" trong ứng dụng. Hệ thống tự chốt sau 7 ngày. Chỉ xác nhận thay khách khi khách trực tiếp báo qua hotline.'
     : '';
  return `<div class="mh"><div><h3>Đơn #${o.code}</h3><div class="faint" style="font-size:11.5px">${fmtDate(o.createdAt)} · ${badge(ORD,o.status)}</div></div><div class="x" onclick="closeModal()">✕</div></div>
  <div class="mb">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="panel" style="box-shadow:none"><div class="pb"><div class="faint" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Người nhận</div>
        <div class="bold">${esc(o.customer.name)}</div><div class="muted" style="font-size:12px;margin-top:2px">📞 ${o.customer.phone}</div><div class="muted" style="font-size:12px;margin-top:4px">📍 ${esc(o.address)}</div></div></div>
      <div class="panel" style="box-shadow:none"><div class="pb"><div class="faint" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Thanh toán</div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px"><span class="muted">Phương thức</span><b>${o.payment.method}</b></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-top:4px"><span class="muted">Trạng thái</span>${badge(PAY,o.payment.status)}</div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-top:4px"><span class="muted">Mã giao dịch</span><span class="mono faint">${esc(o.payment.txn)}</span></div>
        ${isVnpay&&pay?`
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-top:4px"><span class="muted">Ngân hàng</span><b>${pay.vnpBankCode?`${esc(pay.vnpBankCode)}${pay.vnpCardType?' · '+esc(pay.vnpCardType):''}`:'—'}</b></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-top:4px"><span class="muted">Mã GD ngân hàng</span><span class="mono faint">${esc(pay.vnpTransactionNo||'—')}</span></div>
        `:''}
        ${o.returnRequest?`<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-top:4px"><span class="muted">Trả hàng</span><button class="link" onclick="A.openReturn('${o.returnRequest.id}')">${esc(o.returnRequest.code)} · ${esc(RET[o.returnRequest.status]?.t||o.returnRequest.status)}</button></div>`:''}
        ${pay?`<button class="btn sm" style="margin-top:8px;width:100%" onclick="A.openPayment('${pay.id}')">Xem chi tiết giao dịch</button>`:''}
        ${o.payment.method==='COD'&&o.payment.status!=='paid'&&o.status!=='cancelled'?`<button class="btn sm" style="margin-top:8px;width:100%" onclick="A.markPaid('${o.id}')">Đánh dấu đã thanh toán COD</button>`:''}
      </div></div>
    </div>
    <div class="section-title" style="margin:16px 0 10px"><h2 style="font-size:13px">Sản phẩm đã mua</h2></div>
    <div class="panel" style="box-shadow:none"><table class="tbl"><tbody>${items}</tbody>
      <tfoot>${o.voucherDiscount?`<tr><td class="muted">Voucher</td><td></td><td class="right" style="color:var(--brand)">-${money(o.voucherDiscount)}</td></tr>`:''}
      ${o.paymentDiscount?`<tr><td class="muted">${esc(o.paymentPromotion?.label||'Ưu đãi thanh toán trực tuyến')}</td><td></td><td class="right" style="color:var(--green)">-${money(o.paymentDiscount)}</td></tr>`:''}
      ${o.vipDiscount?`<tr><td class="muted">💎 ${esc(o.vipPromotion?.label||'VIP giảm 10% cho 1 sản phẩm')} · ${esc(o.vipPromotion?.productName||'')}</td><td></td><td class="right" style="color:var(--violet,#6D28D9)">-${money(o.vipDiscount)}</td></tr>`:''}
      <tr><td class="muted">Phí vận chuyển</td><td></td><td class="right">${money(o.ship)}</td></tr>
      <tr><td class="bold">Tổng cộng</td><td></td><td class="right bold" style="color:var(--brand);font-size:15px">${money(o.total)}</td></tr></tfoot></table></div>
    <div class="section-title" style="margin:16px 0 10px"><h2 style="font-size:13px">Lịch sử trạng thái</h2></div>
    <div class="timeline">${hist}</div>
    ${stageHint?`<div class="banner warn" style="margin-top:14px"><div class="bi">🚚</div><div>${stageHint}</div></div>`:''}
  </div>
  <div class="mf">${actions}</div>`;
}

/* ================= PRODUCTS ================= */
function stockBadge(p){const s=stock(p);if(effStatus(p)==='out'||s===0)return `<span class="bdg b-red"><span class="d"></span>Hết hàng</span>`;if(s<=5)return `<span class="bdg b-amber"><span class="d"></span>${s} · sắp hết</span>`;return `<span class="mono bold">${s}</span>`;}
function prodRow(p){
  return `<tr>
    <td><div class="prod">${thumb(p)}<div><div class="bold" style="font-size:12.5px">${esc(p.name)}</div><div class="faint mono" style="font-size:11px">${esc(p.sku)}${buyable(p)?'':' · <span style="color:var(--red)">không mua được</span>'}</div></div></div></td>
    <td>${esc(catName(p.cat))}</td>
    <td><b>${money(p.price)}</b>${p.old?`<div class="faint" style="font-size:11px;text-decoration:line-through">${money(p.old)}</div><span class="bdg b-red" style="margin-top:3px">-${Math.round((1-p.price/p.old)*100)}%</span>`:''}</td>
    <td>${stockBadge(p)}</td>
    <td class="center">${p.variants.length}</td>
    <td>${badge(PST,effStatus(p))}</td>
    <td class="right"><div style="display:flex;gap:6px;justify-content:flex-end">
      <button class="iconbtn" title="Sửa" onclick="A.editProduct('${p.id}')">✎</button>
      <button class="iconbtn" title="${p.status==='hidden'?'Hiện':'Ẩn'}" onclick="A.toggleHide('${p.id}')">${p.status==='hidden'?'👁️':'🚫'}</button>
      ${STAFF_ONLY?'':`<button class="iconbtn d" title="Xoá" onclick="A.delProduct('${p.id}')">🗑️</button>`}
    </div></td>
  </tr>`;
}
function viewProducts(){
  if(!DB.seeded||DB.products.length===0)return emptyPanel('👘',STAFF_ONLY?'Bạn chưa có sản phẩm nào':'Chưa có sản phẩm',STAFF_ONLY?'Thêm sản phẩm đầu tiên do bạn phụ trách với ảnh, video, biến thể màu, kích cỡ và tồn kho.':'Thêm sản phẩm đầu tiên với ảnh, video, biến thể màu, kích cỡ và tồn kho.',STAFF_ONLY?[['p','A.addProduct()','＋ Thêm sản phẩm']]:[['p','A.addProduct()','＋ Thêm sản phẩm'],['','A.importCSV()','⇪ Nhập tệp CSV']]);
  const q=(state.pQuery||'').toLowerCase();
  const tabs=[['all','Tất cả'],['published','Đang bán'],['out','Hết hàng'],['hidden','Đã ẩn'],['draft','Nháp']];
  let list=DB.products.filter(p=>state.pStatus==='all'||effStatus(p)===state.pStatus);
  if(q)list=list.filter(p=>p.name.toLowerCase().includes(q)||p.sku.toLowerCase().includes(q)||catName(p.cat).toLowerCase().includes(q));
  const cnt=s=>s==='all'?DB.products.length:DB.products.filter(p=>effStatus(p)===s).length;
  return `
  <div class="filters">
    <div class="tabs">${tabs.map(t=>`<button class="${state.pStatus===t[0]?'on':''}" onclick="A.pTab('${t[0]}')">${t[1]}<span class="c">${cnt(t[0])}</span></button>`).join('')}</div>
    <div class="search" style="max-width:240px"><span>🔍</span><input placeholder="Tên, mã hàng, danh mục" value="${esc(state.pQuery||'')}" oninput="A.pSearch(this.value)"></div>
    <div class="hspace"></div>
    ${STAFF_ONLY?'':'<button class="btn" onclick="A.importCSV()"><span class="ic">⇪</span>Nhập dữ liệu</button><button class="btn" onclick="A.exportCSV()"><span class="ic">⇩</span>Xuất dữ liệu</button>'}
    <button class="btn p" onclick="A.addProduct()"><span class="ic">＋</span>Thêm sản phẩm</button>
  </div>
  ${STAFF_ONLY?'<div class="hint" style="margin:-4px 0 12px">Bạn chỉ thấy và quản lý được sản phẩm do chính mình thêm vào.</div>':''}
  <div class="panel"><div class="tablewrap"><table class="tbl">
    <thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Giá</th><th>Tồn kho</th><th class="center">Biến thể</th><th>Trạng thái</th><th></th></tr></thead>
    <tbody id="prodBody">${list.length?list.map(prodRow).join(''):`<tr><td colspan="7"><div style="text-align:center;color:var(--faint);padding:26px">Không có sản phẩm phù hợp.</div></td></tr>`}</tbody>
  </table></div></div>`;
}

/* ---------- product editor ---------- */
let editing=null;
function blankProduct(){return{id:null,name:'',sku:'',cat:'ao-truyen-thong',brand:'JAPANO',price:0,old:null,sale:null,discountPercent:0,status:'draft',colorHex:'#8A2F26',tags:[],desc:'',story:'',images:[],videos:[],variants:[{colorName:'Mực',colorHex:'#1A1410',size:'M',sku:'',stock:10}]};}
function readEditorForm(){
  if(!editing)return; const g=id=>{const e=$('#'+id);return e?e.value:'';};
  editing.name=g('f-name');editing.cat=g('f-cat');editing.brand=g('f-brand');
  editing.tags=g('f-tags').split(',').map(s=>s.trim()).filter(Boolean);
  const listPrice=Math.max(0,+g('f-list-price')||0),promoPrice=Math.max(0,+g('f-promo-price')||0);
  editing.price=promoPrice>0&&promoPrice<listPrice?promoPrice:listPrice;
  editing.old=promoPrice>0&&promoPrice<listPrice?listPrice:null;
  editing.sale=null;editing.discountPercent=editing.old?Math.round((1-editing.price/editing.old)*100):0;
  editing.status=g('f-status');editing.desc=g('f-desc');editing.story=g('f-story');
  document.querySelectorAll('#varBody tr').forEach((tr,i)=>{if(!editing.variants[i])return;
    editing.variants[i].colorName=tr.querySelector('.v-cn').value;
    editing.variants[i].size=tr.querySelector('.v-sz').value;
    editing.variants[i].sku=tr.querySelector('.v-sku').value;
    editing.variants[i].stock=+tr.querySelector('.v-st').value||0;
    // Ô giá bỏ trống = biến thể này theo giá chung của sản phẩm. Phải XOÁ hẳn
    // trường thay vì lưu 0, vì 0 sẽ bị hiểu là "miễn phí" ở những nơi khác.
    const vp=Math.max(0,+tr.querySelector('.v-price').value||0);
    if(vp>0)editing.variants[i].price=vp;else delete editing.variants[i].price;});
}
function editorHTML(){
  const p=editing;const pre=slugify(p.name||'SP').slice(0,6).toUpperCase();
  const imgs=p.images.map((src,i)=>`<div class="it"><img src="${esc(src)}" alt="Ảnh sản phẩm">${i===0?'<span class="cov">Ảnh bìa</span>':''}<span class="rm" onclick="A.rmImg(${i})">✕</span></div>`).join('');
  const videos=(p.videos||[]).map((item,i)=>{const src=typeof item==='string'?item:item.url;return `<div class="it"><video src="${esc(src)}" muted controls preload="metadata"></video><span class="kind">ĐOẠN PHIM</span><span class="rm" onclick="A.rmVideo(${i})">✕</span></div>`;}).join('');
  const listPrice=Number(p.old||p.price||0),promoPrice=p.old?Number(p.price||0):0,discount=promoPrice&&listPrice>promoPrice?Math.round((1-promoPrice/listPrice)*100):0;
  const varRows=p.variants.map((v,i)=>`<tr>
     <td><button type="button" class="swatchbtn" onclick="A.pick(${i})"><span class="c" style="background:${v.colorHex}"></span><input class="v-cn inp" style="border:none;padding:0;width:74px" value="${esc(v.colorName)}"></button></td>
     <td><select class="v-sz sel">${SIZES.map(s=>`<option ${v.size===s?'selected':''}>${s}</option>`).join('')}</select></td>
     <td><input class="v-sku inp mono" value="${esc(v.sku||`${pre}-${(v.colorName||'CO').slice(0,2).toUpperCase()}-${v.size}`)}"></td>
     <td style="width:120px"><input class="v-price inp mono" type="number" min="0" step="1000" placeholder="${Number(p.price||0)}" value="${Number(v.price)>0?Number(v.price):''}" title="Bỏ trống = dùng giá chung của sản phẩm"></td>
     <td style="width:90px"><input class="v-st inp mono" type="number" value="${v.stock}"></td>
     <td><button class="iconbtn d" onclick="A.rmVar(${i})">✕</button></td></tr>`).join('');
  return `<div class="mh"><h3>${p.id?'Sửa sản phẩm':'Thêm sản phẩm'}</h3><div class="x" onclick="closeModal()">✕</div></div>
  <div class="mb" style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
    <div>
      <div class="field"><label>Hình ảnh và video sản phẩm</label>
        <div class="imgs" id="imgGrid">${imgs}${videos}<div class="add" onclick="A.addImg()"><div style="text-align:center"><div style="font-size:20px">＋</div><div style="font-size:10px">Thêm ảnh</div></div></div><div class="add" onclick="A.addVideo()"><div style="text-align:center"><div style="font-size:20px">▶</div><div style="font-size:10px">Thêm video</div></div></div></div>
        <div class="hint">Ảnh đầu là ảnh bìa · video MP4/WebM tối đa 25 MB · <a onclick="A.sampleImg()" style="color:var(--brand);cursor:pointer;font-weight:700">Dùng ảnh mẫu</a></div>
      </div>
      <div class="field"><label>Tên sản phẩm</label><input id="f-name" class="inp" value="${esc(p.name)}" placeholder="VD: Áo Haori dáng dài"></div>
      <div class="row2"><div class="field"><label>Danh mục</label><select id="f-cat" class="sel">${CATS.map(c=>`<option value="${c.id}" ${p.cat===c.id?'selected':''}>${c.kanji} ${c.name}</option>`).join('')}</select></div>
        <div class="field"><label>Thương hiệu</label><input id="f-brand" class="inp" value="${esc(p.brand)}"></div></div>
      <div class="row2"><div class="field"><label>Giá niêm yết</label><input id="f-list-price" class="inp mono" type="number" min="0" value="${listPrice}" oninput="A.pricePreview()"></div>
        <div class="field"><label>Giá khuyến mãi (không bắt buộc)</label><input id="f-promo-price" class="inp mono" type="number" min="0" value="${promoPrice||''}" oninput="A.pricePreview()"></div></div>
      <div id="pricePreview" class="hint" style="background:var(--panel2);border:1px solid var(--line2);padding:9px 10px;border-radius:7px;margin-top:-7px;margin-bottom:13px">Giá thực bán: <b>${money(promoPrice||listPrice)}</b>${discount?` · tự động giảm <b style="color:var(--red)">${discount}%</b>`:' · không giảm giá'}</div>
      <div class="field"><label>Trạng thái</label><select id="f-status" class="sel">
        <option value="published" ${p.status==='published'?'selected':''}>Đang bán</option>
        <option value="hidden" ${p.status==='hidden'?'selected':''}>Đã ẩn</option>
        <option value="draft" ${p.status==='draft'?'selected':''}>Bản nháp</option></select></div>
      <div class="field"><label>Tag (phân cách bằng dấu phẩy)</label><input id="f-tags" class="inp" value="${esc(p.tags.join(', '))}"></div>
    </div>
    <div>
      <div class="field"><label style="display:flex;justify-content:space-between">Mô tả nhanh <button type="button" class="btn sm" onclick="A.aiDesc()">✦ AI mô tả</button></label>
        <textarea id="f-desc" class="ta" placeholder="Mô tả ngắn gọn sản phẩm...">${esc(p.desc)}</textarea></div>
      <div class="field"><label style="display:flex;justify-content:space-between">Câu chuyện văn hoá <button type="button" class="btn sm" onclick="A.aiStory()">✦ AI viết chuyện</button></label>
        <textarea id="f-story" class="ta" style="min-height:120px" placeholder="AI có thể viết câu chuyện văn hoá Nhật cho sản phẩm...">${esc(p.story)}</textarea></div>
      <div class="field"><label style="display:flex;justify-content:space-between;align-items:center">Biến thể (màu · kích cỡ · mã hàng · giá riêng · tồn kho) <button type="button" class="btn sm" onclick="A.addVar()">＋ Biến thể</button></label>
        <div style="border:1px solid var(--line);border-radius:8px;overflow:hidden">
        <table class="vtbl"><thead><tr><th>Màu</th><th>Kích cỡ</th><th>Mã hàng</th><th>Giá riêng</th><th>Tồn</th><th></th></tr></thead><tbody id="varBody">${varRows}</tbody></table></div>
        <div class="hint">Tổng tồn kho: <b id="varTotal">${p.variants.reduce((s,v)=>s+(+v.stock||0),0)}</b> · Chạm ô màu để mở bảng chọn màu.<br>
        <b>Giá riêng</b>: bỏ trống thì biến thể theo giá chung ${money(Number(p.price||0))}. Chỉ điền khi màu/size đó bán giá khác — ví dụ size XXL tốn vải hơn.</div>
      </div>
    </div>
  </div>
  <div class="mf"><button class="btn" onclick="closeModal()">Huỷ</button><button class="btn p" onclick="A.saveProduct()">${p.id?'Lưu thay đổi':'Tạo sản phẩm'}</button></div>`;
}
function openEditor(){openModal(editorHTML(),'lg');}

/* ---------- color picker ---------- */
function hsv2hex(h,s,v){s/=100;v/=100;const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;let r,g,b;
  if(h<60){r=c;g=x;b=0}else if(h<120){r=x;g=c;b=0}else if(h<180){r=0;g=c;b=x}else if(h<240){r=0;g=x;b=c}else if(h<300){r=x;g=0;b=c}else{r=c;g=0;b=x}
  const t=n=>('0'+Math.round((n+m)*255).toString(16)).slice(-2);return('#'+t(r)+t(g)+t(b)).toUpperCase();}
function hex2hsv(hex){hex=hex.replace('#','');if(hex.length===3)hex=hex.split('').map(c=>c+c).join('');
  const r=parseInt(hex.slice(0,2),16)/255,g=parseInt(hex.slice(2,4),16)/255,b=parseInt(hex.slice(4,6),16)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}
  return{h,s:mx?d/mx*100:0,v:mx*100};}
let cpk={h:0,s:80,v:80,idx:0};
function openPicker(idx){readEditorForm();cpk.idx=idx;const cur=editing.variants[idx].colorHex||'#A33A2F';const hsv=hex2hsv(cur);cpk.h=hsv.h;cpk.s=hsv.s;cpk.v=hsv.v;
  openModal(`<div class="mh"><h3>Chọn màu biến thể</h3><div class="x" onclick="A.pickCancel()">✕</div></div>
  <div class="mb"><div class="cp">
    <div class="sv" id="sv"><div class="svh" id="svh"></div></div>
    <div class="hue" id="hue"><div class="hh" id="hh"></div></div>
    <div class="presets" id="presets">${PALETTE.map(c=>`<div class="sw" style="background:${c}" onclick="A.pickPreset('${c}')"></div>`).join('')}</div>
    <div class="out"><div class="prev" id="cpPrev"></div><input class="inp mono" id="cpHex" style="width:120px" value="${cur}" oninput="A.pickHex(this.value)"><span class="faint" style="font-size:11px">Kéo trên bảng để chọn màu</span></div>
  </div></div>
  <div class="mf"><button class="btn" onclick="A.pickCancel()">Huỷ</button><button class="btn p" onclick="A.pickApply()">Áp dụng màu</button></div>`);
  wirePicker();pickRender();
}
function pickRender(){const hex=hsv2hex(cpk.h,cpk.s,cpk.v);const sv=$('#sv');
  sv.style.background=`linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,${hsv2hex(cpk.h,100,100)})`;
  $('#svh').style.left=cpk.s+'%';$('#svh').style.top=(100-cpk.v)+'%';
  $('#hh').style.left=(cpk.h/360*100)+'%';
  $('#cpPrev').style.background=hex;$('#cpHex').value=hex;}
function wirePicker(){
  const sv=$('#sv'),hue=$('#hue');
  const svMove=e=>{const r=sv.getBoundingClientRect();const x=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));const y=Math.min(1,Math.max(0,(e.clientY-r.top)/r.height));cpk.s=x*100;cpk.v=(1-y)*100;pickRender();};
  const hueMove=e=>{const r=hue.getBoundingClientRect();const x=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));cpk.h=x*360;pickRender();};
  const down=(el,mv)=>el.addEventListener('pointerdown',e=>{el.setPointerCapture(e.pointerId);mv(e);const m=ev=>mv(ev);const up=()=>{el.removeEventListener('pointermove',m);el.removeEventListener('pointerup',up);};el.addEventListener('pointermove',m);el.addEventListener('pointerup',up);});
  down(sv,svMove);down(hue,hueMove);
}
