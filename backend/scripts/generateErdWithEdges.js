#!/usr/bin/env node
// Sinh ERD draw.io ĐẦY ĐỦ ĐƯỜNG NỐI, ký hiệu chân chim đúng lực lượng quan hệ.
//
//   node backend/scripts/generateErdWithEdges.js
//   → japano_erd_full.drawio.xml
//
// Khác generateMongoErdDrawio.js (bảng dạng HTML, mũi tên nét đứt không phân
// biệt lực lượng), file này dùng đúng quy ước đang vẽ tay: shape=table, khoá
// chính đặt tên <bảng>Id, cột PK/FK riêng — và mỗi đường nối mang đúng ký hiệu
// 1..1 / 0..1 / 0..N / 1..N đã ĐO trên dữ liệu thật.
//
// Ba loại đường:
//   · nét liền  = khoá ngoại thật, MongoDB có giá trị trỏ sang
//   · nét đứt   = quan hệ n–n lưu bằng MẢNG nhúng, không có bảng nối
//   · chấm gạch = luồng dữ liệu SAO CHÉP, cố ý không có khoá ngoại
//     (địa chỉ trong sổ → đơn hàng: đơn phải giữ nơi đã giao thật, không đổi
//      theo khi khách sửa sổ địa chỉ)
require('../instrument');
const fs = require('fs');
const path = require('path');
const { getDb, mongoEnabled } = require('../lib/mongo');

const OUTPUT = path.join(__dirname, '..', '..', 'japano_erd_full.drawio.xml');

// Ký hiệu chân chim của draw.io
const C = {
  one: 'ERmandOne',      // đúng một, bắt buộc      ||
  zeroOne: 'ERzeroToOne', // không hoặc một          o|
  many: 'ERoneToMany',    // một hoặc nhiều          |<
  zeroMany: 'ERzeroToMany', // không hoặc nhiều      o<
};

// [bảng con, trường FK, bảng cha, phía-cha, phía-con, kiểu, nhãn]
// Lực lượng lấy từ số đo thật; chỗ nào dữ liệu hiện tại hẹp hơn LUẬT thiết kế
// thì lấy theo luật và ghi rõ lý do — ERD phải mô tả luật, không phải mẫu.
const REL = [
  // ---- Trục sản phẩm
  ['products', 'categoryId', 'categories', C.one, C.many, 'fk', 'thuộc danh mục'],
  ['products', 'ownerId', 'users', C.zeroOne, C.zeroMany, 'fk', 'nhân viên đăng (nếu có)'],
  ['product_details', 'productId', 'products', C.one, C.one, 'fk', '1–1 bắt buộc'],
  ['product_variants', 'productId', 'products', C.one, C.many, 'fk', 'màu × size, giữ tồn kho'],
  ['product_media', 'productId', 'products', C.one, C.many, 'fk', 'ảnh / video'],
  ['ai_descriptions', 'productId', 'products', C.one, C.zeroOne, 'fk', 'cache mô tả AI'],
  // ---- Trục đơn hàng
  ['orders', 'userId', 'users', C.one, C.zeroMany, 'fk', 'khách đặt'],
  ['orders', 'voucherId', 'vouchers', C.zeroOne, C.zeroMany, 'fk', 'mã đã dùng (nếu có)'],
  ['order_items', 'orderId', 'orders', C.one, C.many, 'fk', 'đơn có ≥1 dòng hàng'],
  ['order_items', 'productId', 'products', C.one, C.zeroMany, 'fk', 'sản phẩm đã mua'],
  ['payments', 'orderId', 'orders', C.one, C.one, 'fk', 'mỗi đơn đúng 1 giao dịch'],
  ['payments', 'userId', 'users', C.one, C.zeroMany, 'fk', 'người trả'],
  ['return_requests', 'orderId', 'orders', C.one, C.zeroMany, 'fk', 'trả từng phần nhiều lần'],
  ['return_requests', 'paymentId', 'payments', C.zeroOne, C.zeroMany, 'fk', 'COD không có'],
  ['return_requests', 'userId', 'users', C.one, C.zeroMany, 'fk', 'người yêu cầu'],
  // ---- Đánh giá
  ['reviews', 'productId', 'products', C.one, C.zeroMany, 'fk', 'đánh giá sản phẩm'],
  ['reviews', 'userId', 'users', C.one, C.zeroMany, 'fk', 'người viết'],
  ['reviews', 'orderId', 'orders', C.one, C.zeroMany, 'fk', 'BẮT BUỘC — chống đánh giá ảo'],
  ['review_reactions', 'reviewId', 'reviews', C.one, C.zeroMany, 'fk', 'hữu ích / không'],
  ['review_reactions', 'userId', 'users', C.one, C.zeroMany, 'fk', 'mỗi người 1 lượt'],
  ['moderation_samples', 'reviewId', 'reviews', C.zeroOne, C.zeroMany, 'fk', 'mẫu học, có thể rỗng'],
  // ---- Người dùng — vệ tinh
  ['addresses', 'userId', 'users', C.one, C.zeroMany, 'fk', 'sổ địa chỉ'],
  ['profiles', 'userId', 'users', C.one, C.zeroOne, 'fk', 'hồ sơ phong cách'],
  ['push_tokens', 'userId', 'users', C.one, C.zeroMany, 'fk', 'mỗi thiết bị 1 token'],
  ['notifications', 'userId', 'users', C.zeroOne, C.zeroMany, 'fk', 'rỗng = gửi chung'],
  ['cart_items', 'userId', 'users', C.one, C.zeroMany, 'fk', 'giỏ đã đăng nhập'],
  ['cart_items', 'productId', 'products', C.one, C.zeroMany, 'fk', ''],
  ['wishlist_items', 'userId', 'users', C.one, C.zeroMany, 'fk', ''],
  ['wishlist_items', 'productId', 'products', C.one, C.zeroMany, 'fk', ''],
  ['goals', 'userId', 'users', C.one, C.zeroMany, 'fk', 'mục tiêu tiết kiệm'],
  ['goals', 'productId', 'products', C.one, C.zeroMany, 'fk', ''],
  ['search_logs', 'userId', 'users', C.one, C.zeroMany, 'fk', ''],
  ['chats', 'userId', 'users', C.zeroOne, C.zeroMany, 'fk', 'khách vãng lai = rỗng'],
  ['interactions', 'userId', 'users', C.zeroOne, C.zeroMany, 'fk', 'có thể là "guest"'],
  ['interactions', 'productId', 'products', C.one, C.zeroMany, 'fk', 'NGUỒN CHO GỢI Ý'],
  ['japan_spot_reviews', 'userId', 'users', C.one, C.zeroMany, 'fk', ''],
  ['japan_spot_suggestions', 'userId', 'users', C.one, C.zeroMany, 'fk', ''],
  // ---- Khuyến mãi
  ['voucher_redemptions', 'voucherId', 'vouchers', C.one, C.zeroMany, 'fk', 'ai đã dùng mã'],
  ['voucher_redemptions', 'orderId', 'orders', C.one, C.zeroOne, 'fk', 'mỗi đơn tối đa 1 mã'],
  ['voucher_redemptions', 'userId', 'users', C.one, C.zeroMany, 'fk', ''],
  ['vouchers', 'ownerUserId', 'users', C.zeroOne, C.zeroMany, 'fk', 'voucher đền bù riêng'],
  ['vouchers', 'issuedBy', 'users', C.zeroOne, C.zeroMany, 'fk', 'admin nào cấp'],
  ['vip_memberships', 'userId', 'users', C.one, C.zeroMany, 'fk', 'mỗi tháng 1 bản ghi'],
  ['vip_memberships', 'discountRuleId', 'discount_rules', C.one, C.zeroMany, 'fk', 'VIP dùng LUẬT, không dùng voucher'],
  ['flagcard_collections', 'userId', 'users', C.one, C.zeroOne, 'fk', 'bộ sưu tập của khách'],
  // ---- n–n lưu bằng mảng nhúng
  ['chats', 'productIds[]', 'products', C.zeroMany, C.zeroMany, 'array', 'sản phẩm bot gợi ý'],
  ['flagcards', 'recommendedProductIds[]', 'products', C.zeroMany, C.zeroMany, 'array', 'gợi ý theo địa danh'],
  ['flagcard_collections', 'cardIds[]', 'flagcards', C.zeroMany, C.zeroMany, 'array', 'thẻ đã sưu tầm'],
  ['vip_memberships', 'qualifyingOrderIds[]', 'orders', C.zeroMany, C.zeroMany, 'array', 'đơn đủ điều kiện lên hạng'],
  // ---- luồng sao chép, KHÔNG phải khoá ngoại
  ['orders', '(sao chép)', 'addresses', C.zeroOne, C.zeroMany, 'copy', 'tự điền lúc thanh toán rồi CHỤP LẠI'],
];

// Bố cục theo cột: mỗi cột một nhóm nghiệp vụ, giảm cắt nhau.
const LAYOUT = [
  { x: 60, tables: ['categories', 'products', 'product_details', 'product_variants', 'product_media', 'ai_descriptions'] },
  { x: 500, tables: ['orders', 'order_items', 'payments', 'return_requests'] },
  { x: 940, tables: ['users', 'addresses', 'profiles', 'push_tokens', 'notifications'] },
  { x: 1380, tables: ['cart_items', 'wishlist_items', 'goals', 'search_logs', 'chats', 'interactions'] },
  { x: 1820, tables: ['vouchers', 'voucher_redemptions', 'discount_rules', 'vip_memberships'] },
  { x: 2260, tables: ['reviews', 'review_reactions', 'moderation_samples', 'japan_spot_reviews', 'japan_spot_suggestions'] },
  { x: 2700, tables: ['flagcards', 'flagcard_collections', 'banners', 'settings'] },
];

const xml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pkName = (table) => `${table.replace(/_(.)/g, (_, c) => c.toUpperCase())}Id`;

const W = 240; const ROW = 26; const HEAD = 30; const GAP = 70;

function tableCell(id, name, rows, x, y) {
  const height = HEAD + rows.length * ROW;
  const out = [`        <mxCell id="${id}" value="${xml(name)}" style="shape=table;startSize=30;container=1;collapsible=1;childLayout=tableLayout;fixedRows=1;rowLines=0;fontStyle=1;align=center;resizeLast=1;html=1;strokeColor=#000000;fillColor=#ffffff;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${W}" height="${height}" as="geometry"/></mxCell>`];
  rows.forEach((row, index) => {
    const rid = `${id}_r${index}`;
    const bottom = index === 0 ? 1 : 0;
    out.push(`        <mxCell id="${rid}" style="shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;fillColor=none;collapsible=0;dropTarget=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;top=0;left=0;right=0;bottom=${bottom};strokeColor=#000000;" vertex="1" parent="${id}"><mxGeometry y="${HEAD + index * ROW}" width="${W}" height="${ROW}" as="geometry"/></mxCell>`);
    out.push(`        <mxCell id="${rid}_k" value="${xml(row.key)}" style="shape=partialRectangle;connectable=0;fillColor=none;top=0;left=0;bottom=0;right=0;fontStyle=1;fontSize=10;overflow=hidden;whiteSpace=wrap;html=1;strokeColor=#000000;" vertex="1" parent="${rid}"><mxGeometry width="34" height="${ROW}" as="geometry"><mxRectangle width="34" height="${ROW}" as="alternateBounds"/></mxGeometry></mxCell>`);
    const style = row.key === 'PK' ? 'fontStyle=5' : 'fontStyle=0';
    out.push(`        <mxCell id="${rid}_v" value="${xml(row.field)}" style="shape=partialRectangle;connectable=0;fillColor=none;top=0;left=0;bottom=0;right=0;align=left;spacingLeft=6;fontSize=11;${style};overflow=hidden;whiteSpace=wrap;html=1;strokeColor=#000000;" vertex="1" parent="${rid}"><mxGeometry x="34" width="${W - 34}" height="${ROW}" as="geometry"><mxRectangle width="${W - 34}" height="${ROW}" as="alternateBounds"/></mxGeometry></mxCell>`);
  });
  return { xmlText: out.join('\n'), height };
}

function edgeCell(id, source, target, parentSide, childSide, kind, label) {
  const look = kind === 'array'
    ? 'dashed=1;dashPattern=8 6;strokeColor=#B8860B;'
    : kind === 'copy'
      ? 'dashed=1;dashPattern=1 4;strokeColor=#A33A2F;'
      : 'strokeColor=#243244;';
  // KHÔNG ghim exitX/entryX: bảng cha nằm cả hai phía trong bố cục nhiều cột,
  // ghim cứng là đường phải đi vòng ra sau lưng bảng. Để draw.io tự chọn cạnh.
  const style = 'edgeStyle=entityRelationEdgeStyle;rounded=0;html=1;'
    + `startArrow=${childSide};startFill=0;endArrow=${parentSide};endFill=0;${look}`
    + 'fontSize=9;labelBackgroundColor=#ffffff;jettySize=auto;orthogonalLoop=1;';
  return `        <mxCell id="${id}" value="${xml(label)}" style="${style}" edge="1" parent="1" source="${source}" target="${target}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
}

async function main() {
  if (!mongoEnabled()) { console.error('Thiếu MONGODB_URI.'); process.exit(1); }
  const db = await getDb();

  // Lấy field thật từ DB để sơ đồ không lệch với cơ sở dữ liệu.
  const fkByTable = new Map();
  for (const [child, field, parent] of REL) {
    if (field.startsWith('(')) continue;
    if (!fkByTable.has(child)) fkByTable.set(child, new Map());
    fkByTable.get(child).set(field.replace('[]', ''), parent);
  }

  const tables = LAYOUT.flatMap((col) => col.tables);
  const schema = new Map();
  for (const name of tables) {
    const docs = await db.collection(name).find({}).limit(40).toArray();
    const seen = [];
    for (const doc of docs) for (const key of Object.keys(doc)) {
      if (key === '_id' || key === 'demoBatch' || seen.includes(key)) continue;
      seen.push(key);
    }
    const fks = fkByTable.get(name) || new Map();
    const rows = [{ key: 'PK', field: pkName(name) }];
    for (const key of seen) {
      if (key === 'id') continue;                       // trùng khoá chính
      if (fks.has(key)) rows.push({ key: 'FK', field: key });
    }
    for (const key of seen) {
      if (key === 'id' || fks.has(key)) continue;
      rows.push({ key: '', field: key });
    }
    schema.set(name, rows.slice(0, 26));
  }

  const parts = [];
  const positions = new Map();
  for (const col of LAYOUT) {
    let y = 60;
    for (const name of col.tables) {
      const { xmlText, height } = tableCell(`t_${name}`, name, schema.get(name), col.x, y);
      parts.push(xmlText);
      positions.set(name, { x: col.x, y, height });
      y += height + GAP;
    }
  }

  REL.forEach(([child, field, parent, pSide, cSide, kind, label], index) => {
    const text = label ? `${field} · ${label}` : field;
    parts.push(edgeCell(`e_${index}`, `t_${child}`, `t_${parent}`, pSide, cSide, kind, text));
  });

  const legend = `<div style="font-family:Helvetica;font-size:11px;text-align:left">
<b style="font-size:13px">Chú giải</b><br/><br/>
<b>Ký hiệu chân chim</b><br/>
|| đúng một, bắt buộc &nbsp;·&nbsp; o| không hoặc một<br/>
|&lt; một hoặc nhiều &nbsp;·&nbsp; o&lt; không hoặc nhiều<br/><br/>
<b>Loại đường</b><br/>
<span style="color:#243244">━━━</span> khoá ngoại thật<br/>
<span style="color:#B8860B">┅┅┅</span> n–n lưu bằng mảng nhúng, không có bảng nối<br/>
<span style="color:#A33A2F">┈┈┈</span> sao chép dữ liệu, cố ý KHÔNG có khoá ngoại<br/><br/>
<b>Vì sao đơn hàng không nối thẳng vào addresses</b><br/>
Địa chỉ tự điền lúc thanh toán rồi được CHỤP vào đơn.<br/>
Nếu chỉ trỏ khoá ngoại, khách sửa hoặc xoá địa chỉ trong sổ<br/>
là đơn đã giao tháng trước cũng đổi theo. Đơn hàng phải giữ<br/>
đúng nơi đã giao thật. Cùng lý do với customer, productName,<br/>
price trong order_items.</div>`;
  parts.push(`        <mxCell id="legend" value="${xml(legend)}" style="rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacing=10;fillColor=#FBF7EF;strokeColor=#243244;" vertex="1" parent="1"><mxGeometry x="2700" y="1750" width="360" height="300" as="geometry"/></mxCell>`);

  const doc = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" type="device">
  <diagram id="japano-erd-full" name="JAPANO — ERD đầy đủ">
    <mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="3120" pageHeight="2400" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${parts.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;
  fs.writeFileSync(OUTPUT, doc);
  const fk = REL.filter((r) => r[5] === 'fk').length;
  const arr = REL.filter((r) => r[5] === 'array').length;
  const cp = REL.filter((r) => r[5] === 'copy').length;
  console.log(`Đã ghi ${OUTPUT}`);
  console.log(`  ${tables.length} bảng · ${REL.length} đường nối (${fk} khoá ngoại · ${arr} n–n qua mảng · ${cp} sao chép)`);
  process.exit(0);
}

main().catch((error) => { console.error('✗', error.stack || error.message); process.exit(1); });
