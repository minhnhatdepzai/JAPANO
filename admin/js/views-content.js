/* ---------- trạng thái rỗng dùng chung ----------
 * Tham số đầu tên là `art` chứ không phải `icon`: trong phạm vi hàm, một tham
 * số tên `icon` sẽ che mất hàm icon() toàn cục của js/icons.js. */
function emptyBlock(art,title,desc,acts){
  const buttons=(acts||[]).map(a=>`<button class="btn ${a[0]}" onclick="${a[1]}">${a[2]}</button>`).join('');
  return `<div class="empty"><div class="art">${art}</div><h3>${esc(title)}</h3><p>${esc(desc)}</p>
  ${buttons?`<div class="acts">${buttons}</div>`:''}</div>`;}
function emptyPanel(art,title,desc,acts){
  return `<div class="panel">${emptyBlock(art,title,desc,acts)}</div>`;}
/* Bảng đã có dữ liệu nhưng bộ lọc không khớp — khác hẳn "chưa có gì". Ở đây
 * nói rõ là do bộ lọc và mời gỡ lọc, thay vì một dòng chữ xám cụt lủn. */
function emptyTR(n,t,reset){
  return `<tr class="emptyrow"><td colspan="${n}"><div class="emptycell">
    ${icon('search-outline',22)}
    <div>${esc(t||'Không có dữ liệu phù hợp.')}</div>
    ${reset?`<button class="btn sm" onclick="${reset}">Xoá bộ lọc</button>`:''}
  </div></td></tr>`;}
const avColor=n=>['#141414','#3D3D3D','#686868','#929292','#4A4A4A','#5C5C5C'][n.length%6];
const avatar=(n,cls='')=>`<div class="thumb sq ${cls}" style="background:${avColor(n)};font-size:12.5px">${esc(n.trim().slice(0,1).toUpperCase())}</div>`;

/* ---------- lists (for focus-preserving search) ---------- */
function ordList(){const q=(state.oQuery||'').toLowerCase();let l=DB.orders.filter(o=>state.oStatus==='all'||o.status===state.oStatus);
  if(q)l=l.filter(o=>o.code.toLowerCase().includes(q)||o.customer.name.toLowerCase().includes(q)||o.customer.phone.includes(q));return l.sort((a,b)=>b.createdAt-a.createdAt);}
function prodList(){const q=(state.pQuery||'').toLowerCase();let l=DB.products.filter(p=>state.pStatus==='all'||effStatus(p)===state.pStatus);
  if(q)l=l.filter(p=>p.name.toLowerCase().includes(q)||p.sku.toLowerCase().includes(q)||catName(p.cat).toLowerCase().includes(q));return l;}
function userList(){const q=(state.uQuery||'').toLowerCase();let l=DB.users.filter(u=>state.uRole==='all'||u.role===state.uRole);
  if(q)l=l.filter(u=>u.name.toLowerCase().includes(q)||u.email.toLowerCase().includes(q));return l;}

/* ================= REVIEWS ================= */
const REVIEW_STATUS={approved:{t:'Đã duyệt',c:'b-green'},pending:{t:'Chờ kiểm tra',c:'b-amber'},rejected:{t:'Đã chặn',c:'b-red'}};
function viewReviews(){
  const all=[...(DB.reviews||[])].sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  const list=state.reviewStatus==='all'?all:all.filter(review=>review.status===state.reviewStatus);
  const count=status=>status==='all'?all.length:all.filter(review=>review.status===status).length;
  const rows=list.length?list.map(review=>{
    const reactions=(DB.reviewReactions||[]).filter(item=>item.reviewId===review.id),helpful=reactions.filter(item=>item.value==='helpful').length,notHelpful=reactions.filter(item=>item.value==='not_helpful').length;
    const engine=review.moderation?.engine||'Bộ lọc quy tắc',reason=review.moderation?.reason||'Chưa có kết luận';
    return `<tr><td><div class="bold">${esc(review.userName||review.userId)}</div><div class="faint mono" style="font-size:10.5px">${esc(review.userId)} · #${esc(review.orderCode||review.orderId)}</div></td><td><div class="bold">${esc(productLabel(review.productId))}</div><div style="color:var(--amber)">${icon('star').repeat(Number(review.rating||0))}${icon('star-outline').repeat(Math.max(0,5-Number(review.rating||0)))}</div></td><td style="max-width:350px"><div style="white-space:normal;line-height:1.5">${esc(review.comment)}</div><div class="faint" style="font-size:10.5px;margin-top:5px">${icon('thumbs-up-outline',12)} ${helpful} · ${icon('thumbs-down-outline',12)} ${notHelpful} · ${fmtDate(review.createdAt)}</div></td><td><div class="bold" style="font-size:11.5px">${esc(engine)}</div><div class="faint" style="font-size:10.5px;max-width:240px;white-space:normal">${esc(reason)}</div></td><td>${badge(REVIEW_STATUS,review.status)}</td><td class="right"><div style="display:flex;gap:5px;justify-content:flex-end;flex-wrap:wrap"><button class="btn sm" onclick="A.moderateReview('${escJs(review.id)}','approved')">Duyệt</button><button class="btn d sm" onclick="A.moderateReview('${escJs(review.id)}','rejected')">Chặn & học</button></div></td></tr>`;
  }).join(''):emptyTR(6,'Không có đánh giá phù hợp.');
  return `<div class="grid g-4 mb"><div class="kpi"><div class="lb">Tổng đánh giá xác minh</div><div class="v">${all.length}</div><div class="dl">chỉ từ đơn đã mua</div></div><div class="kpi"><div class="lb">Chờ kiểm tra</div><div class="v">${count('pending')}</div><div class="dl">ưu tiên xử lý</div></div><div class="kpi"><div class="lb">Đã chặn</div><div class="v">${count('rejected')}</div><div class="dl">mẫu chặn được học lại</div></div><div class="kpi"><div class="lb">Mô hình kiểm duyệt</div><div class="v" style="font-size:17px">Qwen 2.5 7B</div><div class="dl" style="color:var(--green)">đang hoạt động · chống lách luật</div></div></div><div class="filters"><div class="tabs">${[['all','Tất cả'],['pending','Chờ kiểm tra'],['approved','Đã duyệt'],['rejected','Đã chặn']].map(([key,label])=>`<button class="${state.reviewStatus===key?'on':''}" onclick="A.reviewTab('${escJs(key)}')">${label}<span class="c">${count(key)}</span></button>`).join('')}</div><span class="faint" style="font-size:11.5px">Mô hình phân tích ngữ nghĩa, viết tắt, chen ký tự, bỏ dấu, đảo cụm từ và công kích ám chỉ.</span></div><div class="panel"><div class="tablewrap"><table class="tbl acts"><thead><tr><th>Khách/đơn</th><th>Sản phẩm</th><th>Đánh giá</th><th>Kết luận AI</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

/* ================= USERS ================= */
/* Số lần thử đồ: bản ghi người dùng cũ có sẵn cột tổng, tài khoản mới thì
 * không — đếm thẳng từ lịch sử thử đồ. Cả hai đều là dữ liệu thật, không bịa. */
function userTryons(u){
  const cached=Number(u.tryons);
  if(Number.isFinite(cached))return cached;
  return (DB.tryonHistory||[]).filter(t=>String(t.userId)===String(u.id)).length;
}
function userVip(u){return u.vipMembership||{isVip:u.vip==='VIP',tier:u.vip||'Thành viên',currentMonth:{spend:0,threshold:5000000,remaining:5000000,progressPercent:0},daysRemaining:0,expiresAt:null,benefit:{discountPercent:10,discountedUnitsPerOrder:1}};}
function userRow(u){return `<tr>
  <td><div class="prod">${avatar(u.name)}<div><div class="bold" style="font-size:12.5px">${esc(u.name)}</div><div class="faint" style="font-size:11.5px">${esc(u.email)}</div></div></div></td>
  <td>${badge(ROLE,u.role)}</td>
  <td>${u.status==='locked'?'<span class="bdg b-red"><span class="d"></span>Đã khoá</span>':'<span class="bdg b-green"><span class="d"></span>Hoạt động</span>'}</td>
  <td class="center bold">${Number(u.orders)||0}</td>
  <td class="bold">${money(Number(u.spent)||0)}<div class="faint" style="font-size:10.5px">Tháng này ${money(userVip(u).currentMonth?.spend||0)} / ${money(userVip(u).currentMonth?.threshold||5000000)}</div></td>
  <td class="center">${userTryons(u)}</td>
  <td>${userVip(u).isVip?`<span class="bdg b-violet"><span class="d"></span>VIP · còn ${userVip(u).daysRemaining} ngày</span><div class="faint" style="font-size:10.5px;margin-top:3px">đến ${new Date(userVip(u).expiresAt).toLocaleDateString('vi-VN')}</div>`:'<span class="bdg b-blue"><span class="d"></span>Thành viên</span>'}</td>
  <td class="right"><div class="rowact"><button class="btn sm" onclick="A.openUser('${escJs(u.id)}')">Xem</button><button class="iconbtn ${u.status==='locked'?'':'d'}" title="${u.status==='locked'?'Mở khoá':'Khoá'}" onclick="A.toggleLock('${escJs(u.id)}')">${u.status==='locked'?icon('key-outline'):icon('lock-closed-outline')}</button></div></td></tr>`;}
function viewUsers(){
  if(!DB.seeded||DB.users.length===0)return emptyPanel(icon('people-outline'),'Chưa có người dùng','Người dùng đăng ký app sẽ hiển thị tại đây kèm lịch sử mua, chi tiêu và số lần thử đồ AI.',[['','A.seed()',`${icon('sparkles-outline')} Nạp dữ liệu demo`]]);
  const tabs=[['all','Tất cả'],['customer','Khách'],['staff','Nhân viên'],['admin','Admin'],['super_admin','Super Admin']];
  const cnt=r=>r==='all'?DB.users.length:DB.users.filter(u=>u.role===r).length;
  return `<div class="filters">
    <div class="tabs">${tabs.map(t=>`<button class="${state.uRole===t[0]?'on':''}" onclick="A.uTab('${escJs(t[0])}')">${t[1]}<span class="c">${cnt(t[0])}</span></button>`).join('')}</div>
    <div class="search" style="max-width:240px">${icon('search-outline')}<input placeholder="Tên hoặc email" value="${esc(state.uQuery||'')}" oninput="A.uSearch(this.value)"></div></div>
  <div class="panel"><div class="tablewrap"><table class="tbl acts">
    <thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th class="center">Đơn</th><th>Tổng chi</th><th class="center">Thử đồ AI</th><th>Hạng</th><th></th></tr></thead>
    <tbody id="userBody">${userList().map(userRow).join('')||emptyTR(8)}</tbody></table></div></div>`;}
function userDrawer(u){
  const his=DB.orders.filter(o=>String(o.userId||o.customer?.id||'')===String(u.id)||(!o.userId&&o.customer?.name===u.name)).sort((a,b)=>b.createdAt-a.createdAt),vip=userVip(u);
  const stat=(v,l)=>`<div class="ministat" ><div><div class="v">${v}</div><div class="lb">${l}</div></div></div>`;
  return `<div class="mh"><div style="display:flex;align-items:center;gap:12px">${avatar(u.name)}<div><h3 style="font-size:15px">${esc(u.name)}</h3><div class="faint" style="font-size:11.5px">${esc(u.email)} · ${badge(ROLE,u.role)}</div></div></div><div class="x" onclick="closeModal()">${icon('close',17)}</div></div>
  <div class="mb">
    <div class="grid g-2" style="gap:var(--sp-2)">${stat(Number(u.orders)||0,'Tổng đơn')}${stat(money(Number(u.spent)||0),'Tổng chi tiêu')}${stat(userTryons(u),'Lần thử đồ AI')}${stat(vip.isVip?'VIP':'Thành viên','Hạng hiện tại')}</div>
    <div class="panel" style="margin-top:12px;border-color:${vip.isVip?'var(--brand)':'var(--line2)'}"><div class="pb"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><div class="bold" style="font-size:13.5px">${icon('diamond-outline',13)} ${vip.isVip?'JAPANO VIP đang hiệu lực':'Tiến độ VIP tháng này'}</div><div class="faint" style="font-size:11.5px;margin-top:3px">${vip.isVip?`Hết hạn ${fmtDate(vip.expiresAt)} · còn ${vip.daysRemaining} ngày`:`Còn ${money(vip.currentMonth?.remaining||5000000)} để đạt mốc ${money(vip.currentMonth?.threshold||5000000)}`}</div></div><span class="bdg ${vip.isVip?'b-violet':'b-blue'}"><span class="d"></span>${vip.isVip?'Giảm 10% / 1 món mỗi đơn':`${vip.currentMonth?.progressPercent||0}%`}</span></div><div style="height:8px;background:var(--line2);border-radius:99px;overflow:hidden;margin-top:12px"><div style="height:100%;width:${Math.min(100,Number(vip.currentMonth?.progressPercent||0))}%;background:${vip.isVip?'#6D28D9':'var(--brand)'}"></div></div><div class="faint" style="display:flex;justify-content:space-between;font-size:10.5px;margin-top:5px"><span>Tháng này: ${money(vip.currentMonth?.spend||0)}</span><span>Mốc: ${money(vip.currentMonth?.threshold||5000000)}</span></div></div></div>
    ${(function(){const addrs=(DB.addresses||[]).filter(a=>a.userId===u.id);return `<div class="section-title" style="margin:16px 0 10px"><h2 style="font-size:13.5px">Sổ địa chỉ nhận hàng</h2><span class="sub">${addrs.length} địa chỉ</span></div>
    <div class="panel" style="padding:${addrs.length?'4px':'0'}">${addrs.length?addrs.map(a=>`<div style="padding:10px 12px;border-bottom:1px solid var(--hair,#eee)"><div class="bold" style="font-size:12.5px">${esc(a.title||'Địa chỉ')} ${a.isDefault?'<span class="bdg b-green" style="margin-left:6px"><span class="d"></span>Mặc định</span>':''}</div><div class="faint" style="font-size:11.5px;margin-top:2px">${esc(a.name)} · ${esc(a.phone)}</div><div class="faint" style="font-size:11.5px">${esc([a.street,a.ward,a.province].filter(Boolean).join(', '))}</div></div>`).join(''):'<div class="faint" style="font-size:11.5px;padding:12px">Khách chưa lưu địa chỉ nào.</div>'}</div>`;})()}
    ${(function(){const w=(DB.wishlists||[]).filter(x=>x.userId===u.id);const nameOf=s=>{const p=(DB.products||[]).find(pp=>pp.slug===s||pp.id===s);return p?p.name:s;};return `<div class="section-title" style="margin:16px 0 10px"><h2 style="font-size:13.5px">Sản phẩm yêu thích</h2><span class="sub">${w.length} món</span></div><div class="panel" style="padding:${w.length?'10px 12px':'0'}">${w.length?w.map(x=>`<span class="bdg b-gray" style="margin:0 6px 6px 0;display:inline-block">${icon('heart-outline',12)} ${esc(nameOf(x.productSlug))}</span>`).join(''):'<div class="faint" style="font-size:11.5px;padding:12px">Khách chưa thích sản phẩm nào.</div>'}</div>`;})()}
    <div class="section-title" style="margin:16px 0 10px"><h2 style="font-size:13.5px">Lịch sử đơn hàng</h2><span class="sub">${his.length} đơn</span></div>
    <div class="panel" ><table class="tbl"><tbody>
    ${his.length?his.map(o=>`<tr><td class="bold mono">#${o.code}</td><td class="faint">${fmtDate(o.createdAt)}</td><td>${badge(ORD,o.status)}</td><td class="right bold">${money(o.total)}</td></tr>`).join(''):emptyTR(4,'Chưa có đơn hàng.')}
    </tbody></table></div>
    ${isSuperAdmin()?`<div class="section-title" style="margin:16px 0 10px"><h2 style="font-size:13.5px">Quyền quản trị (Super Admin)</h2></div>
    <div class="panel" style="padding:12px">
      <div class="field"><label>Tên</label><input class="inp" id="ud-name" value="${esc(u.name)}"></div>
      <div class="field"><label>Email</label><input class="inp" id="ud-email" type="email" value="${esc(u.email)}"></div>
      <div class="field"><label>Vai trò</label><select class="sel" id="ud-role">
        <option value="customer" ${u.role==='customer'?'selected':''}>Khách hàng</option>
        <option value="staff" ${u.role==='staff'?'selected':''}>Nhân viên (chỉ quản lý sản phẩm của mình)</option>
        <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
        <option value="super_admin" ${u.role==='super_admin'?'selected':''}>Super Admin</option>
      </select></div>
      <button class="btn p" style="width:100%" onclick="A.saveUserAdmin('${escJs(u.id)}')">Lưu thay đổi quyền & thông tin</button>
    </div>`:''}
  </div>
  <div class="mf"><button class="btn ${u.status==='locked'?'p':'d'}" onclick="A.toggleLock('${escJs(u.id)}',1)">${u.status==='locked'?'Mở khoá tài khoản':'Khoá tài khoản'}</button></div>`;}

/* ================= KHÁM PHÁ NHẬT BẢN (đóng góp cộng đồng) ================= */
// Mức thưởng lấy từ máy chủ (backend/lib/communityRewards.js); nếu chưa tải kịp
// thì dùng tạm mặc định để giao diện không vỡ.
function spotRewardConfig(){return SPOT_REWARD||{amount:50000,minOrder:300000,validityDays:60};}
function suggestionCard(s){
  const reward=s.reward||{status:'pending'};
  const cls=reward.status==='approved'?'sugcard done':reward.status==='rejected'?'sugcard no':'sugcard';
  const badgeHtml=reward.status==='approved'
    ? `<span class="bdg b-green"><span class="d"></span>Đã thưởng ${money(reward.amount||0)}</span>`
    : reward.status==='rejected'
    ? '<span class="bdg b-red"><span class="d"></span>Không duyệt</span>'
    : '<span class="bdg b-amber"><span class="d"></span>Chờ duyệt</span>';
  const acts=reward.status==='pending'
    ? `<button class="btn p sm" onclick="A.approveSpot('${escJs(s.id)}')">${icon('checkmark-circle-outline')} Duyệt &amp; trả thưởng</button><button class="btn d sm" onclick="A.rejectSpot('${escJs(s.id)}')">Từ chối</button><button class="btn sm" onclick="A.delJapanSuggestion('${escJs(s.id)}')">${icon('trash-outline')} Xoá</button>`
    : `<button class="btn sm" onclick="A.delJapanSuggestion('${escJs(s.id)}')">${icon('trash-outline')} Xoá</button>`;
  return `<div class="${cls}">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
      <div style="flex:1;min-width:0">
        ${s.place?`<div class="bold" style="font-size:12.5px">${icon('location-outline',13)} ${esc(s.place)}</div>`:''}
        <div class="sugtext">${esc(s.suggestion)}</div>
        <div class="faint" style="font-size:10.5px;margin-top:3px">${esc(s.userName||'Khách')} · <span class="mono">${esc(s.userId||'')}</span> · ${fmtDate(s.createdAt)}</div>
        ${reward.voucherCode?`<div class="faint" style="font-size:10.5px;margin-top:3px">Mã đã gửi khách: <span class="mono bold">${esc(reward.voucherCode)}</span> · hạn ${esc(reward.expiry||'')}</div>`:''}
        ${reward.status==='rejected'&&reward.note?`<div class="faint" style="font-size:10.5px;margin-top:3px">Lý do: ${esc(reward.note)}</div>`:''}
      </div>
      <div>${badgeHtml}</div>
    </div>
    <div class="sugacts">${acts}</div>
  </div>`;
}
function viewJapan(){
  if(JAPAN_STATUS==='loading'||JAPAN_STATUS==='idle')return `<div class="panel"><div class="pb">${skRows(4)}</div></div>`;
  if(JAPAN_STATUS==='error')return errState();
  const revs=JAPAN.reviews||[],sugs=JAPAN.suggestions||[];
  const byPref={};sugs.forEach(s=>{(byPref[s.prefecture]=byPref[s.prefecture]||[]).push(s);});
  const stars=n=>icon('star').repeat(Math.max(0,Math.min(5,n||0)))+icon('star-outline').repeat(5-Math.max(0,Math.min(5,n||0)));
  const flag=st=>st==='pending'?'<span class="bdg b-amber" style="margin-left:6px"><span class="d"></span>Chờ kiểm duyệt</span>':'';
  const rewardCfg=spotRewardConfig();
  const pendingSugs=sugs.filter(s=>(s.reward?.status||'pending')==='pending').length;
  const rewarded=sugs.filter(s=>s.reward?.status==='approved').length;
  return `<div class="grid g-3-2 align-start">
    <div class="panel"><div class="ph"><h3>Đánh giá địa điểm</h3><span class="sub">${revs.length} đánh giá của khách</span></div>
      <div class="tablewrap"><table class="tbl acts"><thead><tr><th>Địa điểm</th><th>Khách</th><th class="center">Sao</th><th>Bình luận</th><th></th></tr></thead>
      <tbody>${revs.length?revs.map(r=>`<tr>
        <td><div class="bold">${esc(r.place)}</div><div class="faint" style="font-size:11.5px">${esc(r.prefecture)}${flag(r.status)}</div></td>
        <td class="faint" style="font-size:11.5px">${esc(r.userName||'Khách')}<div class="faint" style="font-size:10.5px">${fmtDate(r.createdAt)}</div></td>
        <td class="center" style="color:var(--ink);white-space:nowrap">${stars(r.rating)}</td>
        <td style="max-width:260px"><div style="font-size:12.5px">${esc(r.comment||'')}</div>${r.media?`<div class="faint" style="font-size:10.5px">${icon('link-outline',12)} ${esc(r.media.kind||'media')}</div>`:''}</td>
        <td class="right"><button class="btn d sm" onclick="A.delJapanReview('${escJs(r.id)}')">Xoá</button></td></tr>`).join(''):emptyTR(5,'Chưa có đánh giá địa điểm nào.')}</tbody></table></div></div>
    <div class="panel"><div class="ph"><h3>Đóng góp địa điểm chụp ảnh mới</h3><span class="sub">${sugs.length} gợi ý · ${pendingSugs} chờ duyệt · đã thưởng ${rewarded}</span></div>
      <div class="pb">
        <div class="banner warn" style="margin-bottom:12px"><div class="bi">${icon('gift-outline',15)}</div><div><b>Duyệt là khách nhận thưởng ngay.</b> Mỗi gợi ý được duyệt sẽ tự phát một voucher giảm ${money(rewardCfg.amount)} cho đơn từ ${money(rewardCfg.minOrder)}, hạn ${rewardCfg.validityDays} ngày, chỉ khách đó dùng được và chỉ thưởng một lần cho mỗi gợi ý. Chỉ duyệt khi địa điểm có thật và mô tả đủ dùng.</div></div>
        ${sugs.length?Object.keys(byPref).map(pref=>`<div style="margin-bottom:14px"><div class="bold" style="font-size:12.5px;margin-bottom:6px">${icon('map-outline',13)} ${esc(pref)} <span class="faint">(${byPref[pref].length})</span></div>${byPref[pref].map(suggestionCard).join('')}</div>`).join(''):'<div class="faint" style="font-size:12.5px;padding:8px">Chưa có gợi ý nào từ khách.</div>'}
      </div></div>
  </div>
  <div class="banner ok" style="margin-top:12px"><div class="bi">${icon('shield-checkmark-outline',15)}</div><div>Mọi đánh giá &amp; gợi ý đều đã qua <b>bộ lọc kiểm duyệt AI</b> (chống lách từ nhạy cảm) trước khi vào đây. Nội dung vi phạm bị chặn ngay từ app.</div></div>`;
}

/* ================= KIỂM DUYỆT AI (chống lách từ nhạy cảm) ================= */
function viewModeration(){
  const samples=(DB.moderationSamples||[]).filter(s=>s.label==='rejected');
  const model=MOD?.model||{name:'—',semantic:true,antiEvasion:true};
  const items=(MOD?.items||[]);
  const pending=items.filter(r=>r.status==='pending');
  const rejected=items.filter(r=>r.status==='rejected');
  const chip=(t,tone)=>`<span class="bdg ${tone}" style="margin:0 5px 5px 0;display:inline-block">${esc(t)}</span>`;
  const modRow=r=>`<tr><td><div class="bold">${esc(r.userName||'Khách')}</div><div class="faint" style="font-size:10.5px">${fmtDate(r.createdAt)} · ${esc(r.productId||'')}</div></td>
    <td style="max-width:280px"><div style="font-size:12.5px">${esc(r.comment||'')}</div><div class="faint" style="font-size:10.5px;margin-top:3px">${esc((r.moderation&&r.moderation.reason)||'')}</div></td>
    <td>${badge2(r.status)}</td>
    <td class="right" style="white-space:nowrap"><button class="btn p sm" onclick="A.modSet('${escJs(r.id)}','approved')">Duyệt</button> <button class="btn d sm" onclick="A.modSet('${escJs(r.id)}','rejected')">Chặn</button></td></tr>`;
  return `<div class="grid g-2-1 align-start">
    <div>
      <div class="panel"><div class="ph"><h3>Thử bộ lọc trực tiếp</h3><span class="sub">Kiểm tra một câu xem AI có chặn không (kể cả viết tắt/lách)</span></div>
        <div class="pb">
          <textarea id="mod-test" class="ta" placeholder="Ví dụ: shop lua dao vcl, dume — thử cả cc, v c l, đm…" style="min-height:70px"></textarea>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn p blk" onclick="A.testMod()">${icon('shield-checkmark-outline')} Kiểm tra</button>
            <button class="btn sm" onclick="document.getElementById('mod-test').value='shop lua dao vcl dume';A.testMod()">Mẫu chửi lách</button>
            <button class="btn sm" onclick="document.getElementById('mod-test').value='giao hơi chậm nhưng vải đẹp, đóng gói kỹ';A.testMod()">Mẫu góp ý hợp lệ</button></div>
          <div id="mod-result" style="margin-top:12px"></div>
        </div></div>
      <div class="panel" style="margin-top:14px"><div class="ph"><h3>Bình luận sản phẩm chờ / bị chặn</h3><span class="sub">${pending.length} chờ · ${rejected.length} đã chặn</span></div>
        <div class="tablewrap"><table class="tbl acts"><thead><tr><th>Khách</th><th>Nội dung</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody>${[...pending,...rejected].length?[...pending,...rejected].map(modRow).join(''):emptyTR(4,MOD_STATUS==='loading'?'Đang tải…':'Không có bình luận cần xử lý.')}</tbody></table></div></div>
    </div>
    <div>
      <div class="panel"><div class="ph"><h3>Cơ chế kiểm duyệt</h3></div><div class="pb">
        <div class="ministat" style="margin-bottom:8px"><div><div class="v" style="font-size:14px">${esc(model.name)}</div><div class="lb">Mô hình ngữ nghĩa (Ollama)</div></div></div>
        <div style="font-size:12.5px;line-height:1.7;color:var(--muted,#666)">
          <div>${icon('checkmark',13,'success')} Bỏ dấu, leetspeak (<code>v(l → vcl</code>), dồn ký tự lặp</div>
          <div>${icon('checkmark',13,'success')} Bắt viết tắt: <b>cc, vl, dm, vcl, dume…</b> kể cả chen khoảng trắng <code>v c l</code></div>
          <div>${icon('checkmark',13,'success')} Heuristic “mục tiêu + lời hạ nhục” (vd <i>shop … như chó</i>)</div>
          <div>${icon('checkmark',13,'success')} Mô hình AI hiểu ngữ cảnh, mỉa mai, ám chỉ</div>
          <div>${icon('checkmark',13,'success')} <b>Tự học</b> mẫu bị chặn để bắt biến thể mới</div>
        </div></div></div>
      <div class="panel" style="margin-top:14px"><div class="ph"><h3>Cụm từ đã học</h3><span class="sub">${samples.length} mẫu</span></div>
        <div class="pb" style="max-height:260px;overflow:auto">${samples.length?samples.slice(-60).reverse().map(s=>chip((s.learnedPhrases&&s.learnedPhrases[0])||s.normalizedText||'—','b-red')).join(''):'<div class="faint" style="font-size:12.5px">Chưa học mẫu nào. Khi có bình luận bị chặn, hệ thống tự lưu để lần sau bắt được.</div>'}</div></div>
    </div>
  </div>`;
}
function badge2(st){return st==='rejected'?'<span class="bdg b-red"><span class="d"></span>Đã chặn</span>':st==='pending'?'<span class="bdg b-amber"><span class="d"></span>Chờ duyệt</span>':'<span class="bdg b-green"><span class="d"></span>Đã duyệt</span>';}

/* ================= NOTIFICATIONS ================= */
function viewNotifications(){
  return `<div class="grid g-2 align-start">
    <div class="panel"><div class="ph"><h3>Soạn thông báo</h3><span class="sub">Gửi tới tất cả người dùng</span></div>
      <div class="pb">
        <div class="field"><label for="n-title">Tiêu đề</label><input id="n-title" class="inp" placeholder="VD: Ưu đãi cuối tuần -30%"></div>
        <div class="field"><label for="n-body">Nội dung</label><textarea id="n-body" class="ta" placeholder="Nội dung thông báo hiển thị trong app..."></textarea></div>
        <div class="row2"><div class="field"><label for="n-type">Loại</label><select id="n-type" class="sel"><option>Khuyến mãi</option><option>Hệ thống</option><option>Đơn hàng</option></select></div>
          <div class="field"><label for="n-target">Đối tượng (để trống = tất cả)</label><input id="n-target" class="inp" placeholder="Email khách hàng — để trống để gửi chung"></div></div>
        <div class="banner warn" style="margin:2px 0 12px"><div class="bi">${icon('megaphone-outline',15)}</div><div>Để trống ô Đối tượng: gửi cho <b>tất cả</b> ${DB.users.length} người dùng. Nhập email: chỉ <b>riêng khách đó</b> nhận được (cả trong app lẫn thông báo đẩy).</div></div>
        <button class="btn p blk" onclick="A.sendNoti()">${icon('megaphone-outline')} Gửi thông báo</button>
      </div></div>
    <div class="panel"><div class="ph"><h3>Đã gửi gần đây</h3><span class="sub">${DB.notifications.length} thông báo</span></div>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>Tiêu đề</th><th>Loại</th><th>Tiếp cận</th><th>Thời gian</th></tr></thead>
      <tbody>${DB.notifications.length?[...DB.notifications].reverse().map(n=>`<tr><td><div class="bold">${esc(n.title)}</div><div class="faint" style="font-size:11.5px;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n.body)}</div></td><td><span class="bdg ${n.type==='Khuyến mãi'?'b-amber':n.type==='Hệ thống'?'b-gray':'b-blue'}"><span class="d"></span>${n.type}</span></td><td class="bold">${n.reach}</td><td class="faint" style="font-size:11.5px">${ago(n.at)} trước</td></tr>`).join(''):emptyTR(4,'Chưa gửi thông báo nào.')}</tbody></table></div></div>
  </div>`;}

/* ================= CATEGORIES / VOUCHERS / BANNERS ================= */
function viewCategories(){
  return `<div class="filters"><div class="hspace"></div><button class="btn p" onclick="A.addCategory()">${icon('add')}Thêm danh mục</button></div>
  <div class="panel"><div class="tablewrap"><table class="tbl acts"><thead><tr><th>Danh mục</th><th>Kanji</th><th>Slug</th><th class="center">Sản phẩm</th><th></th></tr></thead>
  <tbody>${DB.categories.map(c=>`<tr><td class="bold">${esc(c.name)}</td><td style="font-size:16px">${c.kanji||'—'}</td><td class="mono faint">${c.id}</td><td class="center">${DB.products.filter(p=>p.cat===c.id).length}</td>
  <td class="right"><button class="iconbtn d" aria-label="Xoá danh mục ${esc(c.name)}" onclick="A.delCategory('${escJs(c.id)}')">${icon('trash-outline')}</button></td></tr>`).join('')}</tbody></table></div></div>`;}
function voucherRow(v){
  const isFlag=v.source==='flagcard-collection';
  return `<tr><td class="bold mono">${v.code}</td><td class="bold">${v.type==='percent'?v.value+'%':money(v.value)}</td><td>${v.min?money(v.min):'—'}</td>
  <td>${isFlag?`<span class="bdg b-violet"><span class="d"></span>${icon('flag-outline',12)} Thẻ địa danh</span>`:'<span class="bdg b-blue"><span class="d"></span>Khuyến mãi</span>'}</td>
  <td>${v.ownerUserId?`<span class="mono faint">${esc(v.ownerUserId)}</span>`:'<span class="faint">Công khai</span>'}</td>
  <td class="faint">${v.expiry}</td><td>${v.used}/${v.limit}</td>
  <td><button type="button" class="switch ${v.active?'on':''}" aria-label="${v.active?'Tắt':'Bật'} mã giảm giá ${esc(v.code)}" aria-pressed="${v.active?'true':'false'}" onclick="A.toggleVoucher('${escJs(v.code)}')"><i></i></button></td>
  <td class="right">${isFlag?'':`<button class="iconbtn d" aria-label="Xoá mã giảm giá ${esc(v.code)}" onclick="A.delVoucher('${escJs(v.code)}')">${icon('trash-outline')}</button>`}</td></tr>`;
}
function viewVouchers(){
  const flagV=DB.vouchers.filter(v=>v.source==='flagcard-collection');
  const promoV=DB.vouchers.filter(v=>v.source!=='flagcard-collection');
  const head=`<tr><th>Mã</th><th>Giảm</th><th>Đơn tối thiểu</th><th>Nguồn</th><th>Chủ sở hữu</th><th>Hạn dùng</th><th>Đã dùng</th><th>Trạng thái</th><th></th></tr>`;
  return `<div class="filters"><div class="hspace"></div><button class="btn p" onclick="A.addVoucher()">${icon('add')}Tạo voucher</button></div>
  ${flagV.length?`<div class="section-title"><h2>Mã giảm giá thưởng sưu tập thẻ địa danh</h2><span class="sub">${flagV.length} mã cá nhân · tự phát khi khách đủ bộ 7 thẻ</span></div>
  <div class="panel"><div class="tablewrap"><table class="tbl"><thead>${head}</thead><tbody>${flagV.map(voucherRow).join('')}</tbody></table></div></div>`:''}
  <div class="section-title"><h2>Voucher khuyến mãi chung</h2><span class="sub">${promoV.length} mã</span></div>
  <div class="panel">${promoV.length?`<div class="tablewrap"><table class="tbl"><thead>${head}</thead><tbody>${promoV.map(voucherRow).join('')}</tbody></table></div>`:emptyBlock(icon('ticket-outline'),'Chưa có voucher','Tạo mã giảm giá để chạy khuyến mãi.',[['p','A.addVoucher()',`${icon('add')} Tạo voucher`]])}</div>`;}

/* ================= FLAGCARDS ================= */
function requiredCardCount(){
  const active=(DB.flagcards||[]).filter(c=>c.active!==false).length||7;
  return Math.min(active,Math.max(1,+((DB.flagcardConfig||{}).requiredCards)||7));
}
function flagcardMini(c){
  return `<div class="panel" style="border-color:var(--line2)"><div class="pb" style="padding:12px">
    <div style="display:flex;align-items:center;gap:8px">
      <div style="width:34px;height:34px;border-radius:9px;background:${c.accent||'#A33A2F'}22;display:grid;place-items:center;font-size:17px">${c.glyph||icon('flag-outline')}</div>
      <div style="flex:1;min-width:0"><div class="bold" style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.title)}</div><div class="faint" style="font-size:10.5px">${esc(c.region)} · #${c.order}</div></div>
    </div>
    <div class="muted" style="font-size:11.5px;margin-top:8px;line-height:1.5;max-height:48px;overflow:hidden">${esc(c.summary||'')}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px">
      ${c.active!==false?'<span class="bdg b-green"><span class="d"></span>Đang phát</span>':'<span class="bdg b-gray"><span class="d"></span>Tạm ẩn</span>'}
      <button type="button" class="switch ${c.active!==false?'on':''}" aria-label="${c.active!==false?'Tạm ẩn':'Hiển thị'} thẻ ${esc(c.title)}" aria-pressed="${c.active!==false?'true':'false'}" onclick="A.toggleFlagcardActive('${escJs(c.id)}')"><i></i></button>
    </div>
  </div></div>`;
}
function collectionRow(c){
  const required=requiredCardCount();
  const owned=(c.cardIds||[]).length;
  const pct=Math.min(100,Math.round(owned/required*100));
  const user=(DB.users||[]).find(u=>u.id===c.userId);
  const glyphs=(c.cardIds||[]).map(id=>{const card=(DB.flagcards||[]).find(x=>x.id===id);return card?card.glyph:icon('flag-outline');}).join(' ')||'—';
  const voucher=c.rewardVoucherCode?(DB.vouchers||[]).find(v=>v.code===c.rewardVoucherCode):null;
  return `<tr>
    <td><div class="bold">${esc(user?.name||c.userId)}</div><div class="faint mono" style="font-size:10.5px">${esc(c.userId)}</div></td>
    <td><div style="width:120px;height:8px;background:var(--line2);border-radius:99px;overflow:hidden"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--brand),#C86A5E)"></div></div><div class="faint" style="font-size:10.5px;margin-top:3px">${owned}/${required}</div></td>
    <td style="font-size:15px">${glyphs}</td>
    <td>${voucher?`<span class="mono bold">${voucher.code}</span> <span class="bdg ${voucher.active?'b-green':'b-gray'}">${voucher.active?'Còn hạn':'Đã khoá'}</span>`:'<span class="faint">Chưa đủ bộ</span>'}</td>
    <td class="right">${voucher?`<button class="btn sm" onclick="A.go('vouchers')">Xem voucher</button>`:''}</td>
  </tr>`;
}
function viewFlagcards(){
  const cfg=DB.flagcardConfig||{active:true,qualifyingOrderMin:5000000,requiredCards:7,rewardPercent:50,rewardVoucherMinOrder:0,rewardValidityDays:90};
  const cards=DB.flagcards||[];
  const cols=DB.flagcardCollections||[];
  const required=requiredCardCount();
  const completed=cols.filter(c=>(c.cardIds||[]).length>=required).length;
  if(!cards.length)return emptyPanel(icon('flag-outline'),'Chưa có dữ liệu thẻ địa danh','Kết nối máy chủ (API trực tuyến) để tải bộ 7 thẻ địa danh lịch sử và cấu hình chương trình.',[['p','A.toggleApi()','Thử kết nối lại']]);
  return `<div class="grid g-2-1 align-start">
    <div>
      <div class="panel"><div class="ph"><h3>Bộ ${cards.length} thẻ địa danh lịch sử</h3><span class="sub">Mỗi đơn đạt điều kiện ngẫu nhiên nhận 1 thẻ chưa có</span></div>
        <div class="pb grid g-auto">${cards.map(flagcardMini).join('')}</div>
      </div>
      <div class="section-title"><h2>Người sưu tập</h2><span class="sub">${cols.length} khách đang sưu tập · ${completed} đã đủ ${required} thẻ</span></div>
      <div class="panel"><div class="tablewrap"><table class="tbl acts">
        <thead><tr><th>Khách hàng</th><th>Tiến độ</th><th>Thẻ đã có</th><th>Voucher thưởng</th><th></th></tr></thead>
        <tbody>${cols.length?cols.map(collectionRow).join(''):emptyTR(5,'Chưa có khách nào sưu tập thẻ địa danh.')}</tbody>
      </table></div></div>
    </div>
    <div>
      <div class="panel"><div class="ph"><h3>Điều kiện chương trình</h3></div><div class="pb">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0 14px;border-bottom:1px solid var(--line2)">
          <div><div class="bold" style="font-size:12.5px">Đang chạy chương trình</div><div class="faint" style="font-size:11.5px">Tắt để ngưng phát thẻ mới cho đơn hàng mới</div></div>
          <button type="button" class="switch ${cfg.active?'on':''}" aria-label="${cfg.active?'Tắt':'Bật'} chương trình thẻ địa danh" aria-pressed="${cfg.active?'true':'false'}" onclick="A.toggleFlagcardProgram()"><i></i></button>
        </div>
        <div class="field" style="margin-top:14px"><label for="fc-min">Đơn tối thiểu để nhận thẻ (₫)</label><input id="fc-min" class="inp mono" type="number" value="${cfg.qualifyingOrderMin}"></div>
        <div class="row2">
          <div class="field"><label for="fc-req">Số thẻ cần đủ bộ</label><input id="fc-req" class="inp mono" type="number" min="1" max="${cards.length}" value="${cfg.requiredCards}"></div>
          <div class="field"><label for="fc-pct">% giảm giá thưởng</label><input id="fc-pct" class="inp mono" type="number" min="1" max="100" value="${cfg.rewardPercent}"></div>
        </div>
        <div class="row2">
          <div class="field"><label for="fc-vmin">Đơn tối thiểu dùng voucher (₫)</label><input id="fc-vmin" class="inp mono" type="number" value="${cfg.rewardVoucherMinOrder}"></div>
          <div class="field"><label for="fc-days">Hạn dùng voucher (ngày)</label><input id="fc-days" class="inp mono" type="number" value="${cfg.rewardValidityDays}"></div>
        </div>
        <button class="btn p blk" onclick="A.saveFlagcardConfig()">Lưu cấu hình</button>
      </div></div>
      <div class="panel" style="margin-top:14px"><div class="ph"><h3>Cấp thẻ thủ công</h3></div><div class="pb">
        <div class="field"><label for="fc-grant-user">Khách hàng (userId)</label><input id="fc-grant-user" class="inp" placeholder="VD: demo-minh" list="fc-users"></div>
        <datalist id="fc-users">${(DB.users||[]).map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('')}${cols.map(c=>`<option value="${esc(c.userId)}">`).join('')}</datalist>
        <div class="field"><label for="fc-grant-card">Thẻ địa danh</label><select id="fc-grant-card" class="sel">${cards.map(c=>`<option value="${c.id}">${c.glyph} ${esc(c.title)}</option>`).join('')}</select></div>
        <button class="btn blk" onclick="A.grantFlagcard()">${icon('gift-outline')} Cấp thẻ cho khách</button>
        <div class="hint">Dùng khi hỗ trợ khách gặp lỗi đơn hàng hoặc tặng thẻ sự kiện.</div>
      </div></div>
    </div>
  </div>`;
}
function viewBanners(){
  return `<div class="filters"><div class="hspace"></div><button class="btn p" onclick="A.addBanner()">${icon('add')}Thêm ảnh quảng bá</button></div>
  <div class="grid g-3">${DB.banners.map(b=>`<div class="panel"><div style="height:110px;background:${b.img};border-radius:8px 8px 0 0;display:flex;align-items:flex-end;padding:12px"><div style="color:#fff"><div style="font-size:10.5px;letter-spacing:2px;opacity:.85">JAPANO</div><div style="font-weight:800;font-size:16px">${esc(b.title)}</div></div></div>
  <div class="pb" style="display:flex;align-items:center;justify-content:space-between"><div><div class="faint mono" style="font-size:11.5px">${esc(b.link)}</div><div style="margin-top:4px">${b.active?'<span class="bdg b-green"><span class="d"></span>Đang hiển thị</span>':'<span class="bdg b-gray"><span class="d"></span>Đã tắt</span>'}</div></div>
  <div style="display:flex;gap:8px;align-items:center"><button type="button" class="switch ${b.active?'on':''}" aria-label="${b.active?'Tắt':'Bật'} ảnh quảng bá ${esc(b.title)}" aria-pressed="${b.active?'true':'false'}" onclick="A.toggleBanner('${escJs(b.id)}')"><i></i></button><button class="iconbtn d" aria-label="Xoá ảnh quảng bá ${esc(b.title)}" onclick="A.delBanner('${escJs(b.id)}')">${icon('trash-outline')}</button></div></div></div>`).join('')||emptyPanel(icon('image-outline'),'Chưa có ảnh quảng bá','Thêm ảnh quảng bá để làm nổi bật khuyến mãi trên trang chủ ứng dụng.',[['p','A.addBanner()',`${icon('add')} Thêm ảnh quảng bá`]])}</div>`;}

/* ================= SETTINGS ================= */
function intRow(label,ok,key){return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line2)">
  <span class="dot ${ok?'g':'r'}"></span><div style="flex:1"><div class="bold" style="font-size:12.5px">${label}</div><div class="faint" style="font-size:11.5px">${ok?'Đã kết nối · hoạt động bình thường':'Chưa cấu hình / mất kết nối'}</div></div>
  <button class="btn sm" onclick="A.testInt('${escJs(key)}')">Kiểm tra</button></div>`;}
function healthOr(value,fallback){return HEALTH.checked&&value!==null?value===true:Boolean(fallback);}
async function persistShop(patch){
  const result=await requestJSON('/shop',20000,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});
  DB.shop={...DB.shop,...patch,updatedAt:result.shop?.updatedAt||Date.now()};
  localStorage.setItem(LS,JSON.stringify(DB));
  return result.shop;
}
function viewSettings(){
  const sw=(on,fn,label)=>`<button type="button" class="switch ${on?'on':''}" aria-label="${on?'Tắt':'Bật'} ${esc(label)}" aria-pressed="${on?'true':'false'}" onclick="${fn}"><i></i></button>`;
  const locations=Array.isArray(DB.shop.locations)?DB.shop.locations:[];
  const locationEditor=locations.map((location,index)=>`<div data-store-location data-location-id="${esc(location.id||`japano-location-${index+1}`)}" style="padding:14px 0;border-top:1px solid var(--line2)">
    <div class="row2"><div class="field"><label for="location-${index}-name">Tên điểm JAPANO</label><input id="location-${index}-name" class="inp" data-location-name value="${esc(location.name||'')}"></div><div class="field"><label for="location-${index}-phone">Hotline tại điểm</label><input id="location-${index}-phone" class="inp" data-location-phone value="${esc(location.phone||DB.shop.hotline||'')}"></div></div>
    <div class="field"><label for="location-${index}-address">Địa chỉ hiển thị</label><input id="location-${index}-address" class="inp" data-location-address value="${esc(location.address||'')}"></div>
    <div class="row2"><div class="field"><label for="location-${index}-lat">Vĩ độ</label><input id="location-${index}-lat" class="inp mono" data-location-lat type="number" step="any" value="${Number(location.latitude||0)}"></div><div class="field"><label for="location-${index}-lng">Kinh độ</label><input id="location-${index}-lng" class="inp mono" data-location-lng type="number" step="any" value="${Number(location.longitude||0)}"></div></div>
    <div class="row2"><div class="field"><label for="location-${index}-hours">Giờ mở cửa</label><input id="location-${index}-hours" class="inp" data-location-hours value="${esc(location.openingHours||'Liên hệ trước khi đến')}"></div><div class="field"><label for="location-${index}-services">Dịch vụ (ngăn bằng dấu phẩy)</label><input id="location-${index}-services" class="inp" data-location-services value="${esc((location.services||[]).join(', '))}"></div></div>
    <label style="display:flex;align-items:center;gap:8px;min-height:44px"><input type="checkbox" data-location-active ${location.active!==false?'checked':''}> Hiển thị trên website</label>
  </div>`).join('');
  return `<div class="grid g-2 align-start">
    <div class="panel"><div class="ph"><h3>Thông tin cửa hàng</h3></div><div class="pb">
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">${DB.shop.logo?`<img src="${esc(DB.shop.logo)}" alt="Logo cửa hàng" style="width:58px;height:58px;border-radius:12px;object-fit:contain;background:#fff;border:1px solid var(--line);padding:4px">`:'<div style="width:58px;height:58px;border-radius:12px;background:var(--brand);color:#fff;display:grid;place-items:center;font-weight:800;font-size:22px">ジ</div>'}
      <div><button class="btn sm" onclick="A.uploadLogo()">Thay logo</button>${DB.shop.logo?'<button class="btn sm" style="margin-left:6px" onclick="A.removeLogo()">Gỡ logo</button>':''}<div class="hint" style="margin-top:4px">PNG/JPG/WebP/SVG · tối đa 3 MB · ứng dụng tự đồng nhận logo mới</div></div></div>
      <div class="field"><label for="set-name">Tên cửa hàng</label><input id="set-name" class="inp" value="${esc(DB.shop.name)}"></div>
      <div class="row2"><div class="field"><label for="set-hotline">Hotline</label><input id="set-hotline" class="inp" value="${esc(DB.shop.hotline)}"></div><div class="field"><label for="set-email">Email</label><input id="set-email" class="inp" value="${esc(DB.shop.email)}"></div></div>
      <div class="field"><label for="set-addr">Địa chỉ</label><input id="set-addr" class="inp" value="${esc(DB.shop.address)}"></div>
      <button class="btn p" onclick="A.saveShop()">Lưu thông tin</button>
      <div style="margin-top:20px"><div class="bold">Địa điểm trên website</div><div class="hint">Lưu trong <span class="mono">shop.locations[]</span>; không tạo bảng/collection cửa hàng riêng.</div>${locationEditor||'<div class="hint" style="padding:14px 0">Backend sẽ bổ sung điểm JAPANO — QTSC9 khi tải lại.</div>'}<button class="btn" onclick="A.saveStoreLocations()">Lưu địa điểm</button></div>
    </div></div>
    <div>
      <div class="panel"><div class="ph"><h3>Thanh toán &amp; vận chuyển</h3></div><div class="pb">
        <div class="field"><label for="set-ship">Phí vận chuyển mặc định</label><input id="set-ship" class="inp mono" type="number" value="${DB.shop.shipFee}" onchange="A.setShip(this.value)"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid var(--line2)"><div><div class="bold" style="font-size:12.5px">Thanh toán khi nhận (COD)</div><div class="faint" style="font-size:11.5px">Cho phép khách chọn COD</div></div>${sw(DB.shop.cod,"A.toggleShop('cod')",'thanh toán khi nhận hàng')}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid var(--line2)"><div><div class="bold" style="font-size:12.5px">Thanh toán Stripe</div><div class="faint" style="font-size:11.5px">Thẻ quốc tế qua Stripe Checkout</div></div>${sw(DB.shop.stripe,"A.toggleShop('stripe')",'thanh toán Stripe')}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid var(--line2)"><div><div class="bold" style="font-size:12.5px">Thanh toán VNPay</div><div class="faint" style="font-size:11.5px">Thẻ ATM nội địa, QR, ví qua VNPay Sandbox</div></div>${sw(DB.shop.vnpay,"A.toggleShop('vnpay')",'thanh toán VNPay')}</div>
      </div></div>
      <div class="panel" style="margin-top:14px"><div class="ph"><h3>Tích hợp &amp; trạng thái</h3></div><div class="pb" style="padding-top:4px">
        ${intRow('Cơ sở dữ liệu JSON',healthOr(HEALTH.database,NET_OK),'database')}
        ${intRow('Stripe · Chế độ thử nghiệm',healthOr(HEALTH.stripe,DB.shop.stripe&&NET_OK),'stripe')}
        ${intRow('VNPay · Chế độ thử nghiệm',healthOr(HEALTH.vnpay,DB.shop.vnpay&&NET_OK),'vnpay')}
        ${intRow('Cloudinary (ảnh)',healthOr(HEALTH.cloudinary,DB.integrations.cloudinary),'cloud')}
        ${intRow('Cổng AI / CatVTON',healthOr(anyStatus(HEALTH.gateway,HEALTH.catvton),DB.integrations.ai&&NET_OK),'ai')}
        ${intRow('Ollama · chatbot',healthOr(HEALTH.ollama,DB.integrations.ai&&NET_OK),'ollama')}
        ${intRow('Pillow · thử đồ dự phòng',healthOr(HEALTH.pillow,DB.integrations.ai),'pillow')}
      </div></div>
      <div class="panel" style="margin-top:14px;border-color:#F1CACA"><div class="ph"><h3 style="color:var(--red)">Vùng nguy hiểm</h3></div><div class="pb" style="display:flex;align-items:center;justify-content:space-between">
        <div><div class="bold" style="font-size:12.5px">Xoá toàn bộ dữ liệu</div><div class="faint" style="font-size:11.5px">Đưa hệ thống về trạng thái trống ban đầu</div></div>
        <button class="btn d" onclick="A.resetData()">Xoá dữ liệu</button></div></div>
    </div>
  </div>`;}

/* ---------- AI text ---------- */
function sampleImgURL(hex,k){const svg=`<svg xmlns='http://www.w3.org/2000/svg' width='160' height='190'><rect width='160' height='190' fill='${hex}'/><text x='50%' y='54%' font-size='60' text-anchor='middle' fill='rgba(255,255,255,.85)' font-family='serif'>${k}</text></svg>`;return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg);}
function genDesc(p){const c=catName(p.cat).toLowerCase();return `${p.name} — thiết kế mang tinh thần Nhật Bản, phom dáng tối giản dễ phối. Chất liệu thoáng nhẹ, đường may tỉ mỉ, phù hợp ${c==='cosplay'?'sự kiện & chụp ảnh':'đi làm, dạo phố và những dịp thường ngày'}. Item lý tưởng để "cách tân" tủ đồ theo lối iki.`;}
function genStory(p){const M={
  'ao-truyen-thong':`Bắt nguồn từ thời Heian và hoàn thiện ở thời Edo, ${p.name.toLowerCase()} mang theo triết lý wabi-sabi — vẻ đẹp của sự mộc mạc, tự nhiên. Mỗi nếp vải, mỗi sắc nhuộm đều gợi nhắc mùa và tâm thế người mặc. Khoác lên mình, bạn không chỉ mặc một bộ trang phục mà đang kể một câu chuyện văn hoá.`,
  'haori':`Thời Edo, haori là áo khoác của võ sĩ và thương nhân, thể hiện cốt cách qua chi tiết kín đáo bên trong. Ngày nay, ${p.name.toLowerCase()} được "cách tân" thành item khoác ngoài thanh lịch — buông hờ, không cài, để phom áo rủ tự nhiên theo tinh thần iki.`,
  'trang-phuc':`Lấy cảm hứng từ phố Nhật hiện đại, ${p.name.toLowerCase()} đề cao sự gọn gàng và lớp lang. Tối giản mà tinh tế — đúng tinh thần "ít hơn nhưng chất hơn" của người Nhật.`,
  'phu-kien':`Người Nhật tin rằng phụ kiện "komono" hoàn thiện một bộ đồ. ${p.name} là điểm chạm nhỏ nhưng tinh tế, làm thủ công tỉ mỉ từ vật liệu tự nhiên, mang lại nét duyên kín đáo cho tổng thể.`,
  'cosplay':`${p.name} tái hiện nhân vật với sự chỉn chu từng chi tiết — từ phom dáng đến phụ kiện đặc trưng. Hoá thân trọn vẹn, tự tin toả sáng tại mọi sự kiện.`,
};return M[p.cat]||M['haori'];}


/* ---------- Chẩn đoán thử đồ AI ------------------------------------------
 * Mỗi lượt thử đồ ghi lại số liệu chẩn đoán vào interactions[].metadata (xem
 * backend/routes/tryon.js). Màn này đọc thẳng dữ liệu đó — không lưu ảnh, chỉ
 * số — để biết hệ thống đã CHỌN mức vừa vặn nào và có dựng được hiệu ứng hay
 * không. Đây là chỗ để đối chiếu khi một ảnh trông không như mong đợi. */
const FIT_LABEL={
  very_tight:'Rất chật',tight:'Chật',slightly_tight:'Hơi chật',good:'Vừa',
  slightly_loose:'Hơi rộng',loose:'Rộng',very_loose:'Rất rộng',unknown:'Chưa rõ',
};
const FIT_TONE={very_tight:'r',tight:'r',slightly_tight:'a',good:'g',slightly_loose:'a',loose:'r',very_loose:'r',unknown:''};

function tryonRuns(){
  const seen=new Set();
  return [...(DB.interactions||[])]
    .filter(row=>row.type==='tryon'&&row.metadata&&row.metadata.fit)
    .sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0))
    // Mặc cả bộ sinh ra nhiều interaction cùng runId — mỗi lượt chỉ hiện một dòng.
    .filter(row=>{const id=row.metadata.runId||row.id;if(seen.has(id))return false;seen.add(id);return true;});
}

function viewTryonDiagnostics(){
  const runs=tryonRuns();
  if(!runs.length){
    return `<div class="panel"><div class="empty"><div class="art">${icon('body-outline',28)}</div>
      <h3>Chưa có lượt thử đồ nào được ghi chẩn đoán</h3>
      <p>Hãy tạo một ảnh thử đồ trong ứng dụng di động. Mỗi lượt sẽ ghi lại size đã chọn, size khuyến nghị, mức vừa vặn, ước lượng vóc dáng và thời gian xử lý.</p>
    </div></div>`;
  }
  const withEffect=runs.filter(row=>row.metadata.fit.effectApplied).length;
  const needEffect=runs.filter(row=>row.metadata.fit.verdict&&row.metadata.fit.verdict!=='good'&&row.metadata.fit.verdict!=='unknown').length;
  const times=runs.map(row=>Number(row.metadata.durationMs||0)).filter(Boolean);
  const median=times.length?Math.round(times.sort((a,b)=>a-b)[Math.floor(times.length/2)]/1000):0;
  const rows=runs.slice(0,60).map(row=>{
    const fit=row.metadata.fit||{};
    const body=row.metadata.body;
    const heightRange=body&&body.heightRange&&body.heightRange[0]!=null?`${Math.round(body.heightRange[0])}–${Math.round(body.heightRange[1])} cm`:'—';
    const weightRange=body&&body.weightRange&&body.weightRange[0]!=null?`${Math.round(body.weightRange[0])}–${Math.round(body.weightRange[1])} kg`:'—';
    const gate=(row.metadata.qualityGate||[]).join(', ')||'sạch';
    // Cột an toàn: loại trang phục, có phải lượt 18+ không, và cổng độ che phủ
    // có cho qua không. Đây là thứ cần xem đầu tiên khi có khiếu nại về ảnh.
    const sf=row.metadata.safety;
    const safetyCell=!sf?'—':[
      `<span class="bdg ${sf.requires18Plus?'b-violet':'b-gray'}"><span class="d"></span>${sf.requires18Plus?'18+':'thường'}</span>`,
      sf.coverageOk===false?`<div class="faint" style="font-size:10.5px;color:var(--danger)">che phủ: ${(sf.coverageReasons||[]).join(', ')}</div>`
        :sf.coverageOk===true?'<div class="faint" style="font-size:10.5px">che phủ đạt</div>':'',
      (sf.allowedExposedZones||[]).length?`<div class="faint" style="font-size:10.5px">hở theo thiết kế: ${sf.allowedExposedZones.join(', ')}</div>`:'',
    ].filter(Boolean).join('');
    const effect=fit.effectApplied
      ?'<span class="bdg b-green"><span class="d"></span>đã dựng</span>'
      :fit.verdict==='good'||fit.verdict==='unknown'
        ?'<span class="bdg b-gray"><span class="d"></span>không cần</span>'
        :'<span class="bdg b-amber"><span class="d"></span>không dựng được</span>';
    return `<tr>
      <td>${new Date(Number(row.createdAt||0)).toLocaleString('vi-VN')}</td>
      <td>${(row.metadata.garments||[]).join(', ')||row.productId||'—'}</td>
      <td><b>${fit.chosenSize||'—'}</b> / ${fit.recommendedSize||'—'}</td>
      <td><span class="dot ${FIT_TONE[fit.verdict]||''}"></span> ${FIT_LABEL[fit.verdict]||fit.verdict||'—'} (${fit.severity??0})</td>
      <td>${(fit.signals||[]).join('+')||'—'}</td>
      <td>${effect}${(fit.effectReasons||[]).length?`<div class="faint" style="font-size:10.5px">${fit.effectReasons.join(', ')}</div>`:''}</td>
      <td>${safetyCell}</td>
      <td>${heightRange}<div class="faint" style="font-size:10.5px">${weightRange}${body?` · tin cậy ${body.confidence}`:''}</div></td>
      <td>${gate}</td>
      <td>${row.metadata.durationMs?Math.round(row.metadata.durationMs/1000)+'s':'—'}</td>
      <td class="faint" style="font-size:10.5px">${row.metadata.effectEngine||row.metadata.engine||'—'}</td>
    </tr>`;
  }).join('');
  const kpi=(label,value,detail,ic,tint)=>`<div class="kpi"><div class="top"><span class="lb">${label}</span><span class="ic ${tint}">${icon(ic,16)}</span></div><div class="v">${value}</div><div class="dl">${detail}</div></div>`;
  return `<div class="grid kpis">
      ${kpi('Lượt thử đồ đã ghi',runs.length,'có chẩn đoán độ vừa vặn','body-outline','tint-blue')}
      ${kpi('Cần mô phỏng fit',needEffect,'lượt lệch size','resize-outline','tint-amber')}
      ${kpi('Đã dựng hiệu ứng',`${withEffect}/${needEffect||0}`,`${needEffect?Math.round(withEffect/needEffect*100):0}% thành công`,'sparkles-outline','tint-violet')}
      ${kpi('Thời gian trung vị',`${median}s`,'mỗi lượt thử đồ','time-outline','tint-brand')}
    </div>
    <div class="panel mt"><div class="ph"><h3>AI Try-On Diagnostics</h3><span class="sub">Size đã chọn, mức vừa vặn, ước lượng vóc dáng và cổng chất lượng của từng lượt</span></div>
      <div class="tablewrap"><table class="tbl">
        <thead><tr><th>Thời gian</th><th>Sản phẩm</th><th>Chọn / Khuyến nghị</th><th>Mức vừa vặn</th><th>Tín hiệu</th><th>Hiệu ứng fit</th><th>An toàn</th><th>Vóc dáng ước lượng</th><th>Cổng chất lượng</th><th>Thời gian</th><th>Engine</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div class="pb"><p class="faint" style="font-size:11.5px">Chiều cao và cân nặng là ƯỚC LƯỢNG từ ảnh 2D, luôn hiển thị dạng khoảng. Số đo thật do khách nhập luôn được ưu tiên hơn ước lượng khi tính size.</p></div>
    </div>`;
}
