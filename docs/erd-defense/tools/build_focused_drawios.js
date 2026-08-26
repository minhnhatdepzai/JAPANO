#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = process.env.JAPANO_ERD_OUTPUT_DIR || '/home/nhat/Downloads';

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeId(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

const TABLE_STYLE = 'shape=table;startSize=34;container=1;collapsible=0;childLayout=tableLayout;fixedRows=1;rowLines=1;fontStyle=1;align=left;resizeLast=1;html=1;strokeColor=#000000;fillColor=#FFFFFF;fontColor=#111111;strokeWidth=1.4;swimlaneFillColor=#EDEDED;';
const CORE_TABLE_STYLE = TABLE_STYLE.replace('fillColor=#FFFFFF', 'fillColor=#FFFDF6').replace('swimlaneFillColor=#EDEDED', 'swimlaneFillColor=#FFE9A8').replace('strokeWidth=1.4', 'strokeWidth=1.8');
const ROW_STYLE = 'shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;fillColor=#FFFFFF;collapsible=0;dropTarget=0;top=0;left=0;right=0;bottom=1;strokeColor=#000000;strokeWidth=1.1;';
const KEY_STYLE = 'shape=partialRectangle;connectable=0;fillColor=#F2F2F2;top=0;left=0;bottom=0;right=1;align=left;verticalAlign=middle;spacingLeft=8;fontStyle=1;fontSize=10;overflow=hidden;whiteSpace=wrap;html=1;strokeColor=#000000;strokeWidth=1.1;';
const FIELD_STYLE = 'shape=partialRectangle;connectable=0;fillColor=#FFFFFF;top=0;left=0;bottom=0;right=0;align=left;verticalAlign=middle;spacingLeft=8;fontSize=11;overflow=hidden;whiteSpace=wrap;html=1;strokeColor=#000000;strokeWidth=1.1;';

function tableHeight(table) {
  return 34 + table.rows.length * 28;
}

function tableCells(table) {
  const id = `t_${safeId(table.id)}`;
  const width = table.width || 380;
  const height = tableHeight(table);
  const style = table.core ? CORE_TABLE_STYLE : TABLE_STYLE;
  const cells = [
    `        <mxCell id="${id}" value="${escapeXml(table.title)}" style="${style}" vertex="1" parent="1">`,
    `          <mxGeometry x="${table.x}" y="${table.y}" width="${width}" height="${height}" as="geometry"/>`,
    '        </mxCell>',
  ];
  table.rows.forEach((row, index) => {
    const rowId = `${id}_r_${safeId(row.id)}`;
    cells.push(
      `        <mxCell id="${rowId}" style="${ROW_STYLE}" vertex="1" parent="${id}">`,
      `          <mxGeometry y="${34 + index * 28}" width="${width}" height="28" as="geometry"/>`,
      '        </mxCell>',
      `        <mxCell id="${rowId}_k" value="${escapeXml(row.key || '')}" style="${KEY_STYLE}" vertex="1" parent="${rowId}">`,
      '          <mxGeometry width="68" height="28" as="geometry"><mxRectangle width="68" height="28" as="alternateBounds"/></mxGeometry>',
      '        </mxCell>',
      `        <mxCell id="${rowId}_v" value="${escapeXml(row.label)}" style="${FIELD_STYLE}" vertex="1" parent="${rowId}">`,
      `          <mxGeometry x="68" width="${width - 68}" height="28" as="geometry"><mxRectangle width="${width - 68}" height="28" as="alternateBounds"/></mxGeometry>`,
      '        </mxCell>',
    );
  });
  return cells;
}

function rowId(tableId, rowIdValue) {
  return `t_${safeId(tableId)}_r_${safeId(rowIdValue)}`;
}

function relationCell(relation, index) {
  const startArrow = relation.manyToMany ? 'ERzeroToMany' : (relation.childMaxOne ? 'ERzeroToOne' : 'ERzeroToMany');
  const endArrow = relation.manyToMany ? 'ERzeroToMany' : (relation.parentOptional ? 'ERzeroToOne' : 'ERmandOne');
  const style = [
    'edgeStyle=orthogonalEdgeStyle', 'rounded=0', 'orthogonalLoop=1', 'jettySize=16', 'html=1',
    'exitPerimeter=0', 'entryPerimeter=0', 'strokeColor=#000000', 'strokeWidth=1.5',
    'labelBackgroundColor=#FFFFFF', 'fontSize=10', `startArrow=${startArrow}`, 'startFill=0',
    `endArrow=${endArrow}`, 'endFill=0', `exitX=${relation.exitX ?? 1}`, 'exitY=0.5',
    `entryX=${relation.entryX ?? 0}`, 'entryY=0.5',
  ].join(';') + ';';
  const points = (relation.points || []).map(([x, y]) => `              <mxPoint x="${x}" y="${y}"/>`).join('\n');
  const geometry = points
    ? `          <mxGeometry relative="1" as="geometry"><Array as="points">\n${points}\n            </Array></mxGeometry>`
    : '          <mxGeometry relative="1" as="geometry"/>';
  return [
    `        <mxCell id="rel_${String(index + 1).padStart(2, '0')}" value="${escapeXml(relation.label || '')}" style="${style}" edge="1" parent="1" source="${rowId(relation.fromTable, relation.fromRow)}" target="${rowId(relation.toTable, relation.toRow)}">`,
    geometry,
    '        </mxCell>',
  ];
}

function processCell(process) {
  const id = `p_${safeId(process.id)}`;
  return [
    `        <mxCell id="${id}" value="${escapeXml(process.label)}" style="rounded=1;whiteSpace=wrap;html=1;strokeColor=#C77C02;fillColor=#FFF2CC;fontColor=#111111;strokeWidth=2;fontStyle=1;fontSize=14;align=left;verticalAlign=top;spacing=12;" vertex="1" parent="1">`,
    `          <mxGeometry x="${process.x}" y="${process.y}" width="${process.width}" height="${process.height}" as="geometry"/>`,
    '        </mxCell>',
  ];
}

function flowCell(flow, index) {
  const source = flow.fromProcess ? `p_${safeId(flow.from)}` : `t_${safeId(flow.from)}`;
  const target = flow.toProcess ? `p_${safeId(flow.to)}` : `t_${safeId(flow.to)}`;
  const points = (flow.points || []).map(([x, y]) => `              <mxPoint x="${x}" y="${y}"/>`).join('\n');
  const geometry = points
    ? `          <mxGeometry relative="1" as="geometry"><Array as="points">\n${points}\n            </Array></mxGeometry>`
    : '          <mxGeometry relative="1" as="geometry"/>';
  const style = [
    'edgeStyle=orthogonalEdgeStyle', 'rounded=0', 'orthogonalLoop=1', 'jettySize=16', 'html=1',
    'dashed=1', 'dashPattern=8 5', 'strokeColor=#1A73E8', 'strokeWidth=2', 'endArrow=block',
    'endFill=1', 'fontColor=#174EA6', 'fontSize=10', 'labelBackgroundColor=#FFFFFF',
    `exitX=${flow.exitX ?? 0.5}`, `exitY=${flow.exitY ?? 1}`, `entryX=${flow.entryX ?? 0.5}`, `entryY=${flow.entryY ?? 0}`,
  ].join(';') + ';';
  return [
    `        <mxCell id="flow_${String(index + 1).padStart(2, '0')}" value="${escapeXml(flow.label || '')}" style="${style}" edge="1" parent="1" source="${source}" target="${target}">`,
    geometry,
    '        </mxCell>',
  ];
}

function noteCell(note, index) {
  return [
    `        <mxCell id="note_${index + 1}" value="${escapeXml(note.label)}" style="rounded=0;whiteSpace=wrap;html=1;strokeColor=${note.stroke || '#666666'};fillColor=${note.fill || '#F7F7F7'};fontColor=#222222;fontSize=11;align=left;verticalAlign=top;spacing=10;" vertex="1" parent="1">`,
    `          <mxGeometry x="${note.x}" y="${note.y}" width="${note.width}" height="${note.height}" as="geometry"/>`,
    '        </mxCell>',
  ];
}

function buildDocument(spec) {
  const body = ['        <mxCell id="0"/>', '        <mxCell id="1" parent="0"/>'];
  body.push(
    `        <mxCell id="title" value="${escapeXml(spec.title)}" style="rounded=0;whiteSpace=wrap;html=1;strokeColor=#000000;fillColor=#FFFFFF;fontStyle=1;fontSize=18;align=left;verticalAlign=middle;spacingLeft=12;" vertex="1" parent="1">`,
    `          <mxGeometry x="40" y="20" width="${spec.pageWidth - 80}" height="58" as="geometry"/>`,
    '        </mxCell>',
  );
  spec.tables.forEach((table) => body.push(...tableCells(table)));
  (spec.processes || []).forEach((process) => body.push(...processCell(process)));
  (spec.relations || []).forEach((relation, index) => body.push(...relationCell(relation, index)));
  (spec.flows || []).forEach((flow, index) => body.push(...flowCell(flow, index)));
  (spec.notes || []).forEach((note, index) => body.push(...noteCell(note, index)));
  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" agent="JAPANO source-first generator" pages="1">
  <diagram id="${escapeXml(spec.id)}" name="${escapeXml(spec.name)}">
    <mxGraphModel dx="2200" dy="1600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${spec.pageWidth}" pageHeight="${spec.pageHeight}" background="#FFFFFF" math="0" shadow="0">
      <root>
${body.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;
}

const recommendation = {
  id: 'japano-recommendation-flow',
  name: 'Gợi Ý Sản Phẩm — ERD logic và luồng xử lý',
  title: 'GỢI Ý SẢN PHẨM — ERD LOGIC + LUỒNG XỬ LÝ THỰC TẾ',
  pageWidth: 2300,
  pageHeight: 1700,
  tables: [
    { id: 'profiles', title: 'Hồ Sơ Người Dùng [profiles]', x: 40, y: 170, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã hồ sơ' }, { id: 'userId', key: 'FK1', label: 'userId — Mã người dùng' },
      { id: 'preferredStyles', label: 'preferredStyles[] — Phong cách thích' }, { id: 'occasion', label: 'occasion — Dịp sử dụng' }, { id: 'budget', label: 'budget — Ngân sách' },
    ] },
    { id: 'interactions', title: 'Tương Tác Người Dùng [interactions]', x: 40, y: 480, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã tương tác' }, { id: 'userId', key: 'FK1', label: 'userId — Mã người dùng' },
      { id: 'productId', key: 'FK2', label: 'productId — Mã sản phẩm' }, { id: 'type', label: 'type — view/search/wishlist/cart/tryon/chat/goal' },
      { id: 'value', label: 'value — Cường độ tín hiệu' }, { id: 'createdAt', label: 'createdAt — Thời điểm' },
    ] },
    { id: 'orders', title: 'Đơn Hàng [orders]', x: 40, y: 840, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã đơn hàng' }, { id: 'userId', key: 'FK1', label: 'userId — Mã người dùng' },
      { id: 'status', label: 'status — Trạng thái thành công' }, { id: 'createdAt', label: 'createdAt — Thời điểm mua' },
    ] },
    { id: 'order_items', title: 'Chi Tiết Đơn Hàng [order_items]', x: 40, y: 1110, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã dòng hàng' }, { id: 'orderId', key: 'FK1', label: 'orderId — Mã đơn hàng' },
      { id: 'productId', key: 'FK2', label: 'productId — Mã sản phẩm' }, { id: 'qty', label: 'qty — Số lượng mua' },
      { id: 'price', label: 'price — Giá snapshot' },
    ] },
    { id: 'users', title: 'Người Dùng [users]', core: true, x: 650, y: 280, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã người dùng' }, { id: 'role', label: 'role — Vai trò' },
      { id: 'createdAt', label: 'createdAt — Ngày tham gia' },
    ] },
    { id: 'products', title: 'Sản Phẩm [products]', core: true, x: 1210, y: 260, width: 430, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã sản phẩm' }, { id: 'categoryId', key: 'FK1', label: 'categoryId — Mã danh mục' },
      { id: 'slug', label: 'slug — Đường dẫn định danh' }, { id: 'name', label: 'name — Tên hiển thị' },
      { id: 'price', label: 'price — Giá bán' }, { id: 'status', label: 'status — Trạng thái xuất bản' },
    ] },
    { id: 'product_details', title: 'Chi Tiết Sản Phẩm [product_details]', x: 1210, y: 690, width: 430, rows: [
      { id: '_id', key: 'PK', label: '_id — Mongo document' }, { id: 'productId', key: 'FK1', label: 'productId — Mã sản phẩm' },
      { id: 'tags', label: 'tags[] — Nhãn nội dung' }, { id: 'visualTags', label: 'visualTags[] — Đặc trưng thị giác' },
      { id: 'description', label: 'description/story — Nội dung mô tả' },
    ] },
    { id: 'categories', title: 'Danh Mục Sản Phẩm [categories]', x: 1840, y: 120, width: 410, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã danh mục' }, { id: 'name', label: 'name — Tên danh mục' },
    ] },
    { id: 'product_variants', title: 'Biến Thể Sản Phẩm [product_variants]', x: 1840, y: 390, width: 410, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã biến thể' }, { id: 'productId', key: 'FK1', label: 'productId — Mã sản phẩm' },
      { id: 'colorName', label: 'colorName — Màu' }, { id: 'size', label: 'size — Kích cỡ' },
      { id: 'stock', label: 'stock — Tồn kho để lọc gợi ý' },
    ] },
    { id: 'flagcards', title: 'Thẻ Địa Danh [flagcards]', x: 1840, y: 790, width: 410, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã thẻ địa danh' },
      { id: 'recommendedProductIds', key: 'N:N', label: 'recommendedProductIds[] — Sản phẩm gợi ý' },
      { id: 'region', label: 'region — Khu vực/chủ đề' },
    ] },
  ],
  processes: [
    { id: 'recommend_engine', x: 650, y: 1130, width: 990, height: 270, label: '<b>BỘ MÁY GỢI Ý SẢN PHẨM — KHÔNG PHẢI COLLECTION</b><br/><br/>backend/lib/recommend.js + advancedRecommend.js<br/>• Trọng số: purchase 6; cart 4; try-on 3.5; wishlist 3; chat/goal 2.5; search 2; view 1<br/>• Kết hợp collaborative filtering, matrix factorization, content/tags, trending, market basket, sequence và graph<br/>• Kết quả được tính online, cache 60 giây; trả danh sách slug sản phẩm hiện có, không ghi bảng recommendations.' },
  ],
  relations: [
    { fromTable: 'profiles', fromRow: 'userId', toTable: 'users', toRow: 'id', childMaxOne: true },
    { fromTable: 'interactions', fromRow: 'userId', toTable: 'users', toRow: 'id' },
    { fromTable: 'interactions', fromRow: 'productId', toTable: 'products', toRow: 'id' },
    { fromTable: 'orders', fromRow: 'userId', toTable: 'users', toRow: 'id' },
    { fromTable: 'order_items', fromRow: 'orderId', toTable: 'orders', toRow: 'id' },
    { fromTable: 'order_items', fromRow: 'productId', toTable: 'products', toRow: 'id' },
    { fromTable: 'products', fromRow: 'categoryId', toTable: 'categories', toRow: 'id' },
    { fromTable: 'product_details', fromRow: 'productId', toTable: 'products', toRow: 'id', childMaxOne: true },
    { fromTable: 'product_variants', fromRow: 'productId', toTable: 'products', toRow: 'id' },
    { fromTable: 'flagcards', fromRow: 'recommendedProductIds', toTable: 'products', toRow: 'id', manyToMany: true, label: 'N:N nhúng' },
  ],
  flows: [
    { from: 'profiles', to: 'recommend_engine', toProcess: true, label: 'cold-start/style', exitX: 1, exitY: 1, entryX: 0.1 },
    { from: 'interactions', to: 'recommend_engine', toProcess: true, label: 'tín hiệu hành vi', exitX: 1, exitY: 1, entryX: 0.28 },
    { from: 'orders', to: 'recommend_engine', toProcess: true, label: 'đơn thành công', exitX: 1, exitY: 1, entryX: 0.43 },
    { from: 'order_items', to: 'recommend_engine', toProcess: true, label: 'purchase/market basket', exitX: 1, exitY: 0.5, entryX: 0.5 },
    { from: 'products', to: 'recommend_engine', toProcess: true, label: 'tags/giá/danh mục', exitX: 0.5, exitY: 1, entryX: 0.72 },
    { from: 'product_details', to: 'recommend_engine', toProcess: true, label: 'tags/visualTags/story', exitX: 0.5, exitY: 1, entryX: 0.8 },
    { from: 'product_variants', to: 'recommend_engine', toProcess: true, label: 'lọc hết hàng', exitX: 0, exitY: 1, entryX: 0.93 },
    { from: 'recommend_engine', fromProcess: true, to: 'products', label: 'xếp hạng sản phẩm', exitX: 0.8, exitY: 0, entryX: 0.5, entryY: 1 },
  ],
  notes: [
    { x: 40, y: 1490, width: 2210, height: 100, fill: '#E8F0FE', stroke: '#1A73E8', label: '<b>Quy ước:</b> dây đen chân quạ = logical reference giữa collection; dây xanh nét đứt = luồng đọc/tính toán, không phải FK. Các hành vi wishlist/cart/try-on/chat/goal/search được chuẩn hóa thành interaction trước khi chấm điểm. Flagcard là nhánh gợi ý theo nội dung địa danh, tách khỏi hybrid recommender.' },
  ],
};

const refund = {
  id: 'japano-product-refund-flow',
  name: 'Sản Phẩm — Trả Hàng và Hoàn Tiền',
  title: 'SẢN PHẨM → ĐƠN HÀNG → TRẢ HÀNG / HOÀN TIỀN — ĐẦY ĐỦ CHUỖI DỮ LIỆU',
  pageWidth: 2450,
  pageHeight: 2200,
  tables: [
    { id: 'users', title: 'Người Dùng [users]', x: 40, y: 160, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã người dùng' }, { id: 'role', label: 'role — Vai trò' },
    ] },
    { id: 'vouchers', title: 'Phiếu Giảm Giá [vouchers]', x: 40, y: 430, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã phiếu giảm giá' }, { id: 'ownerUserId', key: 'FK1', label: 'ownerUserId — Người nhận (tùy chọn)' },
      { id: 'issuedBy', label: 'issuedBy/source — Nguồn cấp và audit' }, { id: 'type', label: 'type/value — Loại và giá trị giảm' },
      { id: 'min', label: 'min — Giá trị đơn tối thiểu' },
    ] },
    { id: 'vip_memberships', title: 'Thành Viên VIP [vip_memberships]', x: 40, y: 820, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã kỳ VIP' }, { id: 'userId', key: 'FK1', label: 'userId — Mã người dùng' },
      { id: 'discountRuleId', key: 'FK2', label: 'discountRuleId — Quy tắc giảm giá' }, { id: 'status', label: 'status — Trạng thái kỳ VIP' },
      { id: 'startsAt', label: 'startsAt/endsAt — Hiệu lực' },
    ] },
    { id: 'discount_rules', title: 'Quy Tắc Giảm Giá [discount_rules]', x: 40, y: 1210, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã quy tắc' }, { id: 'type', label: 'type/value — Loại và mức giảm' },
      { id: 'scope', label: 'scope — Phạm vi áp dụng' }, { id: 'maxUnits', label: 'maxUnitsPerOrder — Số lượng tối đa' },
    ] },
    { id: 'orders', title: 'Đơn Hàng [orders]', core: true, x: 710, y: 180, width: 430, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã đơn hàng' }, { id: 'userId', key: 'FK1', label: 'userId — Mã người dùng' },
      { id: 'voucherId', key: 'FK2', label: 'voucherId — Phiếu áp dụng (tùy chọn)' }, { id: 'status', label: 'status — Trạng thái đơn' },
      { id: 'total', label: 'subtotal/discount/ship/total — Snapshot tiền' }, { id: 'vipDiscount', label: 'vipDiscount/vipPromotion — Ưu đãi VIP đã dùng' },
      { id: 'stockRestoredAt', label: 'stockRestoredAt — Mốc hoàn kho' },
    ] },
    { id: 'payments', title: 'Thanh Toán [payments]', x: 710, y: 710, width: 430, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã thanh toán' }, { id: 'orderId', key: 'FK1', label: 'orderId — Mã đơn hàng' },
      { id: 'userId', key: 'FK2', label: 'userId — Mã người dùng' }, { id: 'provider', label: 'provider — Stripe/VNPay/COD' },
      { id: 'amount', label: 'amount — Số tiền thanh toán' }, { id: 'refundedAmount', label: 'refundedAmount/refundedAt — Kết quả hoàn' },
      { id: 'transactionCode', label: 'transactionCode — Mã đối soát' },
    ] },
    { id: 'voucher_redemptions', title: 'Lượt Sử Dụng Phiếu [voucher_redemptions]', x: 710, y: 1220, width: 430, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã lượt sử dụng' }, { id: 'voucherId', key: 'FK1', label: 'voucherId — Mã phiếu' },
      { id: 'userId', key: 'FK2', label: 'userId — Mã người dùng' }, { id: 'orderId', key: 'FK3', label: 'orderId — Mã đơn hàng' },
      { id: 'discountAmount', label: 'discountAmount — Số tiền đã giảm' },
    ] },
    { id: 'products', title: 'Sản Phẩm [products]', core: true, x: 1310, y: 160, width: 430, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã sản phẩm' }, { id: 'slug', label: 'slug — Định danh hiển thị' },
      { id: 'status', label: 'status — Trạng thái sản phẩm' },
    ] },
    { id: 'product_variants', title: 'Biến Thể Sản Phẩm [product_variants]', x: 1950, y: 160, width: 420, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã biến thể' }, { id: 'productId', key: 'FK1', label: 'productId — Mã sản phẩm' },
      { id: 'colorName', label: 'colorName — Màu' }, { id: 'size', label: 'size — Kích cỡ' },
      { id: 'stock', label: 'stock — Tồn kho hoàn lại' },
    ] },
    { id: 'order_items', title: 'Chi Tiết Đơn Hàng [order_items]', core: true, x: 1310, y: 500, width: 430, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã dòng hàng' }, { id: 'orderId', key: 'FK1', label: 'orderId — Mã đơn hàng' },
      { id: 'productId', key: 'FK2', label: 'productId — Mã sản phẩm' }, { id: 'qty', label: 'qty — Số lượng mua' },
      { id: 'price', label: 'price/name/color/size — Snapshot lịch sử' },
    ] },
    { id: 'return_requests', title: 'Yêu Cầu Trả Hàng [return_requests]', core: true, x: 1310, y: 900, width: 430, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã yêu cầu trả hàng' }, { id: 'orderId', key: 'FK1', label: 'orderId — Mã đơn hàng' },
      { id: 'userId', key: 'FK2', label: 'userId — Mã người dùng' }, { id: 'paymentId', key: 'FK3', label: 'paymentId — Thanh toán cần hoàn (tùy chọn)' },
      { id: 'items', label: 'items[] — Dòng hàng và số lượng trả' }, { id: 'status', label: 'status/timeline — Quy trình xử lý' },
      { id: 'amount', label: 'amount/refundStatus/refundId — Kết quả hoàn' }, { id: 'tracking', label: 'carrier/tracking — Gửi hàng trả' },
    ] },
    { id: 'notifications', title: 'Thông Báo [notifications]', x: 1950, y: 900, width: 420, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã thông báo' }, { id: 'userId', key: 'FK1', label: 'userId — Người nhận (có thể broadcast)' },
      { id: 'type', label: 'type — return/refund/order' }, { id: 'data', label: 'data — Deep-link và mã nghiệp vụ' },
    ] },
  ],
  processes: [
    { id: 'refund_engine', x: 710, y: 1670, width: 1030, height: 260, label: '<b>TÍNH VÀ THỰC HIỆN HOÀN TIỀN — KHÔNG PHẢI COLLECTION</b><br/><br/>backend/lib/refundMath.js + routes/returns.js + routes/orders.js<br/>• Hoàn theo từng dòng hàng và số lượng; phân bổ giảm giá theo tỷ lệ<br/>• Chỉ hoàn phí vận chuyển khi toàn bộ đơn đủ điều kiện<br/>• Cập nhật return_requests + payments + orders; hoàn kho idempotent<br/>• Gửi thông báo trạng thái cho khách/Admin.' },
  ],
  relations: [
    { fromTable: 'orders', fromRow: 'userId', toTable: 'users', toRow: 'id', exitX: 0, entryX: 1 },
    { fromTable: 'orders', fromRow: 'voucherId', toTable: 'vouchers', toRow: 'id', parentOptional: true, exitX: 0, entryX: 1 },
    { fromTable: 'vouchers', fromRow: 'ownerUserId', toTable: 'users', toRow: 'id', parentOptional: true, exitX: 0, entryX: 1 },
    { fromTable: 'order_items', fromRow: 'orderId', toTable: 'orders', toRow: 'id', exitX: 0, entryX: 1 },
    { fromTable: 'order_items', fromRow: 'productId', toTable: 'products', toRow: 'id', exitX: 1, entryX: 0 },
    { fromTable: 'product_variants', fromRow: 'productId', toTable: 'products', toRow: 'id', exitX: 0, entryX: 1 },
    { fromTable: 'payments', fromRow: 'orderId', toTable: 'orders', toRow: 'id', exitX: 0.5, entryX: 0.5 },
    { fromTable: 'payments', fromRow: 'userId', toTable: 'users', toRow: 'id', exitX: 0, entryX: 1 },
    { fromTable: 'return_requests', fromRow: 'orderId', toTable: 'orders', toRow: 'id', exitX: 0, entryX: 1 },
    { fromTable: 'return_requests', fromRow: 'userId', toTable: 'users', toRow: 'id', exitX: 0, entryX: 1 },
    { fromTable: 'return_requests', fromRow: 'paymentId', toTable: 'payments', toRow: 'id', parentOptional: true, exitX: 0, entryX: 1 },
    { fromTable: 'voucher_redemptions', fromRow: 'voucherId', toTable: 'vouchers', toRow: 'id', exitX: 0, entryX: 1 },
    { fromTable: 'voucher_redemptions', fromRow: 'userId', toTable: 'users', toRow: 'id', exitX: 0, entryX: 1 },
    { fromTable: 'voucher_redemptions', fromRow: 'orderId', toTable: 'orders', toRow: 'id', exitX: 0.5, entryX: 0.5 },
    { fromTable: 'vip_memberships', fromRow: 'userId', toTable: 'users', toRow: 'id', exitX: 1, entryX: 0 },
    { fromTable: 'vip_memberships', fromRow: 'discountRuleId', toTable: 'discount_rules', toRow: 'id', exitX: 0.5, entryX: 0.5 },
    { fromTable: 'notifications', fromRow: 'userId', toTable: 'users', toRow: 'id', parentOptional: true, exitX: 0, entryX: 1 },
  ],
  flows: [
    { from: 'orders', to: 'refund_engine', toProcess: true, label: 'tổng/giảm/phí ship', exitX: 0.5, exitY: 1, entryX: 0.1 },
    { from: 'order_items', to: 'refund_engine', toProcess: true, label: 'dòng và số lượng trả', exitX: 0.5, exitY: 1, entryX: 0.3 },
    { from: 'payments', to: 'refund_engine', toProcess: true, label: 'provider/transaction', exitX: 0.5, exitY: 1, entryX: 0.5 },
    { from: 'return_requests', to: 'refund_engine', toProcess: true, label: 'trạng thái kiểm hàng', exitX: 0.5, exitY: 1, entryX: 0.7 },
    { from: 'voucher_redemptions', to: 'refund_engine', toProcess: true, label: 'ưu đãi đã dùng', exitX: 0.5, exitY: 1, entryX: 0.85 },
    { from: 'refund_engine', fromProcess: true, to: 'notifications', label: 'thông báo kết quả', exitX: 1, exitY: 0.5, entryX: 0.5, entryY: 1 },
  ],
  notes: [
    { x: 40, y: 2010, width: 2330, height: 100, fill: '#FCE8E6', stroke: '#D93025', label: '<b>Điểm phải nói đúng khi bảo vệ:</b> JAPANO không có collection “refunds” riêng. Yêu cầu và timeline nằm ở return_requests; số tiền/trạng thái hoàn nằm ở return_requests và payments; orders/order_items giữ snapshot để tính đúng từng món. Dây xanh là luồng nghiệp vụ, không phải FK.' },
  ],
};

const outputs = [
  ['JAPANO_ERD_nho_Goi_Y_San_Pham_RO_NET.drawio', recommendation],
  ['JAPANO_ERD_nho_San_Pham_Hoan_Tien_RO_NET.drawio', refund],
];

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
for (const [filename, spec] of outputs) {
  const output = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(output, buildDocument(spec), 'utf8');
  console.log(output);
}
