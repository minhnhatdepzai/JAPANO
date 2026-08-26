#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = '/home/nhat/Downloads/japano/ERD_JAPANO_DA_SUA';

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

function tableHeight(table) { return 34 + table.rows.length * 28; }

function tableCells(table) {
  const id = `t_${safeId(table.id)}`;
  const width = table.width || 400;
  const style = table.core ? CORE_TABLE_STYLE : TABLE_STYLE;
  const cells = [
    `        <mxCell id="${id}" value="${escapeXml(table.title)}" style="${style}" vertex="1" parent="1">`,
    `          <mxGeometry x="${table.x}" y="${table.y}" width="${width}" height="${tableHeight(table)}" as="geometry"/>`,
    '        </mxCell>',
  ];
  table.rows.forEach((row, index) => {
    const rowId = `${id}_r_${safeId(row.id)}`;
    cells.push(
      `        <mxCell id="${rowId}" style="${ROW_STYLE}" vertex="1" parent="${id}">`,
      `          <mxGeometry y="${34 + index * 28}" width="${width}" height="28" as="geometry"/>`,
      '        </mxCell>',
      `        <mxCell id="${rowId}_k" value="${escapeXml(row.key || '')}" style="${KEY_STYLE}" vertex="1" parent="${rowId}">`,
      '          <mxGeometry width="76" height="28" as="geometry"><mxRectangle width="76" height="28" as="alternateBounds"/></mxGeometry>',
      '        </mxCell>',
      `        <mxCell id="${rowId}_v" value="${escapeXml(row.label)}" style="${FIELD_STYLE}" vertex="1" parent="${rowId}">`,
      `          <mxGeometry x="76" width="${width - 76}" height="28" as="geometry"><mxRectangle width="${width - 76}" height="28" as="alternateBounds"/></mxGeometry>`,
      '        </mxCell>',
    );
  });
  return cells;
}

function rowId(tableId, row) { return `t_${safeId(tableId)}_r_${safeId(row)}`; }

function relationCell(relation, index) {
  const startArrow = relation.manyToMany ? 'ERzeroToMany' : (relation.childMaxOne ? 'ERzeroToOne' : 'ERzeroToMany');
  const endArrow = relation.manyToMany ? 'ERzeroToMany' : (relation.parentOptional ? 'ERzeroToOne' : 'ERmandOne');
  const style = [
    'edgeStyle=orthogonalEdgeStyle', 'rounded=0', 'orthogonalLoop=1', 'jettySize=12', 'html=1',
    'exitPerimeter=0', 'entryPerimeter=0', 'strokeColor=#000000', 'strokeWidth=1.5',
    'labelBackgroundColor=#FFFFFF', 'fontSize=10', `startArrow=${startArrow}`, 'startFill=0',
    `endArrow=${endArrow}`, 'endFill=0', `exitX=${relation.exitX ?? 1}`, `exitY=${relation.exitY ?? 0.5}`,
    `entryX=${relation.entryX ?? 0}`, `entryY=${relation.entryY ?? 0.5}`,
  ].join(';') + ';';
  const points = (relation.points || []).map(([x, y]) => `              <mxPoint x="${x}" y="${y}"/>`).join('\n');
  const geometry = points
    ? `          <mxGeometry relative="1" as="geometry"><Array as="points">\n${points}\n            </Array></mxGeometry>`
    : '          <mxGeometry relative="1" as="geometry"/>';
  return [
    `        <mxCell id="rel_${String(index + 1).padStart(2, '0')}" value="" style="${style}" edge="1" parent="1" source="${rowId(relation.fromTable, relation.fromRow)}" target="${rowId(relation.toTable, relation.toRow)}">`,
    geometry,
    '        </mxCell>',
  ];
}

function buildDocument(spec) {
  const body = ['        <mxCell id="0"/>', '        <mxCell id="1" parent="0"/>'];
  spec.tables.forEach((table) => body.push(...tableCells(table)));
  spec.relations.forEach((relation, index) => body.push(...relationCell(relation, index)));
  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" agent="JAPANO tables-only ERD builder" pages="1">
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
  id: 'japano-recommendation-tables-only',
  name: 'Gợi Ý Sản Phẩm — bảng và quan hệ',
  pageWidth: 2500,
  pageHeight: 1450,
  tables: [
    { id: 'profiles', title: 'Hồ Sơ Người Dùng [profiles]', x: 700, y: 100, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã hồ sơ' }, { id: 'userId', key: 'FK1', label: 'userId — Mã người dùng' },
      { id: 'preferredStyles', label: 'preferredStyles[] — Phong cách thích' }, { id: 'occasion', label: 'occasion — Dịp sử dụng' }, { id: 'budget', label: 'budget — Ngân sách' },
    ] },
    { id: 'interactions', title: 'Tương Tác Người Dùng [interactions]', x: 40, y: 500, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã tương tác' }, { id: 'userId', key: 'FK1', label: 'userId — Mã người dùng' },
      { id: 'productId', key: 'FK2', label: 'productId — Mã sản phẩm' }, { id: 'type', label: 'type — view/search/wishlist/cart/tryon/chat/goal' },
      { id: 'value', label: 'value — Cường độ tín hiệu' }, { id: 'createdAt', label: 'createdAt — Thời điểm' },
    ] },
    { id: 'orders', title: 'Đơn Hàng [orders]', x: 700, y: 820, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã đơn hàng' }, { id: 'userId', key: 'FK1', label: 'userId — Mã người dùng' },
      { id: 'status', label: 'status — Trạng thái thành công' }, { id: 'createdAt', label: 'createdAt — Thời điểm mua' },
    ] },
    { id: 'order_items', title: 'Chi Tiết Đơn Hàng [order_items]', x: 700, y: 1080, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã dòng hàng' }, { id: 'orderId', key: 'FK1', label: 'orderId — Mã đơn hàng' },
      { id: 'productId', key: 'FK2', label: 'productId — Mã sản phẩm' }, { id: 'qty', label: 'qty — Số lượng mua' }, { id: 'price', label: 'price — Giá snapshot' },
    ] },
    { id: 'users', title: 'Người Dùng [users]', core: true, x: 700, y: 520, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã người dùng' }, { id: 'role', label: 'role — Vai trò' }, { id: 'createdAt', label: 'createdAt — Ngày tham gia' },
    ] },
    { id: 'products', title: 'Sản Phẩm [products]', core: true, x: 1400, y: 520, width: 430, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã sản phẩm' }, { id: 'categoryId', key: 'FK1', label: 'categoryId — Mã danh mục' },
      { id: 'slug', label: 'slug — Đường dẫn định danh' }, { id: 'name', label: 'name — Tên hiển thị' }, { id: 'price', label: 'price — Giá bán' }, { id: 'status', label: 'status — Trạng thái' },
    ] },
    { id: 'product_details', title: 'Chi Tiết Sản Phẩm [product_details]', x: 1400, y: 820, width: 430, rows: [
      { id: '_id', key: 'PK', label: '_id — Mongo document' }, { id: 'productId', key: 'FK1', label: 'productId — Mã sản phẩm' },
      { id: 'tags', label: 'tags[] — Nhãn nội dung' }, { id: 'visualTags', label: 'visualTags[] — Đặc trưng thị giác' }, { id: 'description', label: 'description/story — Mô tả' },
    ] },
    { id: 'categories', title: 'Danh Mục Sản Phẩm [categories]', x: 2050, y: 80, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã danh mục' }, { id: 'name', label: 'name — Tên danh mục' },
    ] },
    { id: 'product_variants', title: 'Biến Thể Sản Phẩm [product_variants]', x: 2050, y: 360, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã biến thể' }, { id: 'productId', key: 'FK1', label: 'productId — Mã sản phẩm' },
      { id: 'colorName', label: 'colorName — Màu' }, { id: 'size', label: 'size — Kích cỡ' }, { id: 'stock', label: 'stock — Tồn kho' },
    ] },
    { id: 'flagcards', title: 'Thẻ Địa Danh [flagcards]', x: 2050, y: 700, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã thẻ địa danh' }, { id: 'recommendedProductIds', key: 'N:N', label: 'recommendedProductIds[] — Gợi ý sản phẩm' }, { id: 'region', label: 'region — Khu vực/chủ đề' },
    ] },
  ],
  relations: [
    { fromTable: 'profiles', fromRow: 'userId', toTable: 'users', toRow: 'id', childMaxOne: true, exitX: 0.5, exitY: 1, entryX: 0.5, entryY: 0, points: [[900, 190], [900, 554]] },
    { fromTable: 'interactions', fromRow: 'userId', toTable: 'users', toRow: 'id', exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5, points: [[560, 576], [560, 568]] },
    { fromTable: 'interactions', fromRow: 'productId', toTable: 'products', toRow: 'id', exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5, points: [[620, 604], [620, 1000], [1340, 1000], [1340, 568]] },
    { fromTable: 'orders', fromRow: 'userId', toTable: 'users', toRow: 'id', exitX: 0.5, exitY: 0, entryX: 0.5, entryY: 1, points: [[900, 882], [900, 582]] },
    { fromTable: 'order_items', fromRow: 'orderId', toTable: 'orders', toRow: 'id', exitX: 0, exitY: 0.5, entryX: 0, entryY: 0.5, points: [[500, 1156], [500, 868]] },
    { fromTable: 'order_items', fromRow: 'productId', toTable: 'products', toRow: 'id', exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5, points: [[1200, 1184], [1200, 760], [1360, 760], [1360, 568]] },
    { fromTable: 'product_details', fromRow: 'productId', toTable: 'products', toRow: 'id', childMaxOne: true, exitX: 0, exitY: 0, entryX: 0, entryY: 0.5, points: [[1180, 882], [1180, 568]] },
    { fromTable: 'products', fromRow: 'categoryId', toTable: 'categories', toRow: 'id', exitX: 1, exitY: 0.5, entryX: 0, entryY: 0.5, points: [[1950, 596], [1950, 128]] },
    { fromTable: 'product_variants', fromRow: 'productId', toTable: 'products', toRow: 'id', exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5, points: [[1950, 436], [1950, 568]] },
    { fromTable: 'flagcards', fromRow: 'recommendedProductIds', toTable: 'products', toRow: 'id', manyToMany: true, exitX: 0, exitY: 0.5, entryX: 0, entryY: 0.5, points: [[1980, 776], [1980, 740], [1240, 740], [1240, 568]] },
  ],
};

const refund = {
  id: 'japano-refund-tables-only',
  name: 'Sản Phẩm — Trả Hàng và Hoàn Tiền — bảng và quan hệ',
  pageWidth: 2500,
  pageHeight: 1400,
  tables: [
    { id: 'users', title: 'Người Dùng [users]', x: 40, y: 80, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã người dùng' }, { id: 'role', label: 'role — Vai trò' },
    ] },
    { id: 'vouchers', title: 'Phiếu Giảm Giá [vouchers]', x: 40, y: 350, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã phiếu' }, { id: 'ownerUserId', key: 'FK1', label: 'ownerUserId — Người nhận (tùy chọn)' },
      { id: 'issuedBy', label: 'issuedBy/source — Nguồn cấp' }, { id: 'type', label: 'type/value — Loại và giá trị' }, { id: 'min', label: 'min — Đơn tối thiểu' },
    ] },
    { id: 'vip_memberships', title: 'Thành Viên VIP [vip_memberships]', x: 40, y: 650, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã kỳ VIP' }, { id: 'userId', key: 'FK1', label: 'userId — Mã người dùng' },
      { id: 'discountRuleId', key: 'FK2', label: 'discountRuleId — Quy tắc' }, { id: 'status', label: 'status — Trạng thái' }, { id: 'startsAt', label: 'startedAt/expiresAt — Hiệu lực' },
    ] },
    { id: 'discount_rules', title: 'Quy Tắc Giảm Giá [discount_rules]', x: 40, y: 950, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã quy tắc' }, { id: 'type', label: 'type/value — Loại và mức giảm' },
      { id: 'scope', label: 'scope — Phạm vi áp dụng' }, { id: 'maxUnits', label: 'maxUnitsPerOrder — Giới hạn' },
    ] },
    { id: 'orders', title: 'Đơn Hàng [orders]', core: true, x: 750, y: 100, width: 430, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã đơn hàng' }, { id: 'userId', key: 'FK1', label: 'userId — Mã người dùng' },
      { id: 'voucherId', key: 'FK2', label: 'voucherId — Phiếu áp dụng (tùy chọn)' }, { id: 'status', label: 'status — Trạng thái đơn' },
      { id: 'total', label: 'subtotal/discount/ship/total — Snapshot tiền' }, { id: 'vipDiscount', label: 'vipDiscount/vipPromotion — Ưu đãi VIP' }, { id: 'stockRestoredAt', label: 'stockRestoredAt — Hoàn kho' },
    ] },
    { id: 'payments', title: 'Thanh Toán [payments]', x: 750, y: 500, width: 430, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã thanh toán' }, { id: 'orderId', key: 'FK1', label: 'orderId — Mã đơn hàng' },
      { id: 'userId', key: 'FK2', label: 'userId — Mã người dùng' }, { id: 'provider', label: 'provider — Stripe/VNPay/COD' },
      { id: 'amount', label: 'amount — Số tiền thanh toán' }, { id: 'refundedAmount', label: 'refundedAmount/refundedAt — Đã hoàn' }, { id: 'transactionCode', label: 'transactionCode — Đối soát' },
    ] },
    { id: 'voucher_redemptions', title: 'Lượt Sử Dụng Phiếu [voucher_redemptions]', x: 750, y: 900, width: 430, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã lượt dùng' }, { id: 'voucherId', key: 'FK1', label: 'voucherId — Mã phiếu' },
      { id: 'userId', key: 'FK2', label: 'userId — Mã người dùng' }, { id: 'orderId', key: 'FK3', label: 'orderId — Mã đơn hàng' }, { id: 'discount', label: 'discount — Số tiền giảm' },
    ] },
    { id: 'products', title: 'Sản Phẩm [products]', core: true, x: 1500, y: 100, width: 430, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã sản phẩm' }, { id: 'slug', label: 'slug — Định danh' }, { id: 'status', label: 'status — Trạng thái' },
    ] },
    { id: 'product_variants', title: 'Biến Thể Sản Phẩm [product_variants]', x: 2050, y: 100, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã biến thể' }, { id: 'productId', key: 'FK1', label: 'productId — Mã sản phẩm' },
      { id: 'colorName', label: 'colorName — Màu' }, { id: 'size', label: 'size — Kích cỡ' }, { id: 'stock', label: 'stock — Tồn kho' },
    ] },
    { id: 'order_items', title: 'Chi Tiết Đơn Hàng [order_items]', core: true, x: 1500, y: 450, width: 430, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã dòng hàng' }, { id: 'orderId', key: 'FK1', label: 'orderId — Mã đơn hàng' },
      { id: 'productId', key: 'FK2', label: 'productId — Mã sản phẩm' }, { id: 'qty', label: 'qty — Số lượng' }, { id: 'price', label: 'price/name/color/size — Snapshot' },
    ] },
    { id: 'return_requests', title: 'Yêu Cầu Trả Hàng [return_requests]', core: true, x: 1500, y: 850, width: 430, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã yêu cầu' }, { id: 'orderId', key: 'FK1', label: 'orderId — Mã đơn hàng' },
      { id: 'userId', key: 'FK2', label: 'userId — Mã người dùng' }, { id: 'paymentId', key: 'FK3', label: 'paymentId — Thanh toán (tùy chọn)' },
      { id: 'items', label: 'items[] — Dòng hàng và số lượng trả' }, { id: 'status', label: 'status/timeline — Quy trình' },
      { id: 'amount', label: 'amount/refundStatus/refundId — Kết quả hoàn' }, { id: 'tracking', label: 'carrier/tracking — Gửi hàng trả' },
    ] },
    { id: 'notifications', title: 'Thông Báo [notifications]', x: 2050, y: 850, width: 400, rows: [
      { id: 'id', key: 'PK', label: 'id — Mã thông báo' }, { id: 'userId', key: 'FK1', label: 'userId — Người nhận' },
      { id: 'type', label: 'type — return/refund/order' }, { id: 'data', label: 'data/action — Deep-link nghiệp vụ' },
    ] },
  ],
  relations: [
    { fromTable: 'orders', fromRow: 'userId', toTable: 'users', toRow: 'id', exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5, points: [[600, 176], [600, 128]] },
    { fromTable: 'orders', fromRow: 'voucherId', toTable: 'vouchers', toRow: 'id', parentOptional: true, exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5, points: [[540, 204], [540, 398]] },
    { fromTable: 'vouchers', fromRow: 'ownerUserId', toTable: 'users', toRow: 'id', parentOptional: true, exitX: 0, exitY: 0.5, entryX: 0, entryY: 0.5, points: [[10, 426], [10, 128]] },
    { fromTable: 'order_items', fromRow: 'orderId', toTable: 'orders', toRow: 'id', exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5, points: [[1250, 526], [1250, 148]] },
    { fromTable: 'order_items', fromRow: 'productId', toTable: 'products', toRow: 'id', exitX: 1, exitY: 0.5, entryX: 1, entryY: 0.5, points: [[1980, 554], [1980, 148]] },
    { fromTable: 'payments', fromRow: 'orderId', toTable: 'orders', toRow: 'id', exitX: 0, exitY: 0.5, entryX: 0, entryY: 0.5, points: [[680, 576], [680, 148]] },
    { fromTable: 'payments', fromRow: 'userId', toTable: 'users', toRow: 'id', exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5, points: [[520, 604], [520, 128]] },
    { fromTable: 'return_requests', fromRow: 'orderId', toTable: 'orders', toRow: 'id', exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5, points: [[1280, 926], [1280, 148]] },
    { fromTable: 'return_requests', fromRow: 'userId', toTable: 'users', toRow: 'id', exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5, points: [[1360, 954], [1360, 850], [480, 850], [480, 128]] },
    { fromTable: 'return_requests', fromRow: 'paymentId', toTable: 'payments', toRow: 'id', parentOptional: true, exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5, points: [[1300, 982], [1300, 548]] },
    { fromTable: 'voucher_redemptions', fromRow: 'voucherId', toTable: 'vouchers', toRow: 'id', exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5, points: [[600, 976], [600, 398]] },
    { fromTable: 'voucher_redemptions', fromRow: 'userId', toTable: 'users', toRow: 'id', exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5, points: [[560, 1004], [560, 128]] },
    { fromTable: 'voucher_redemptions', fromRow: 'orderId', toTable: 'orders', toRow: 'id', exitX: 1, exitY: 0.5, entryX: 1, entryY: 0.5, points: [[1220, 1032], [1220, 148]] },
    { fromTable: 'vip_memberships', fromRow: 'userId', toTable: 'users', toRow: 'id', exitX: 0, exitY: 0.5, entryX: 0, entryY: 0.5, points: [[20, 726], [20, 128]] },
    { fromTable: 'vip_memberships', fromRow: 'discountRuleId', toTable: 'discount_rules', toRow: 'id', exitX: 0, exitY: 0.5, entryX: 0, entryY: 0.5, points: [[0, 754], [0, 998]] },
    { fromTable: 'notifications', fromRow: 'userId', toTable: 'users', toRow: 'id', exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5, points: [[1980, 926], [1980, 760], [500, 760], [500, 128]] },
    { fromTable: 'product_variants', fromRow: 'productId', toTable: 'products', toRow: 'id', exitX: 0, exitY: 0.5, entryX: 1, entryY: 0.5, points: [[2010, 176], [2010, 148]] },
  ],
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const outputs = [
  ['JAPANO_ERD_nho_Goi_Y_San_Pham_RO_NET.drawio', recommendation],
  ['JAPANO_ERD_nho_San_Pham_Hoan_Tien_RO_NET.drawio', refund],
];
for (const [filename, spec] of outputs) {
  const output = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(output, buildDocument(spec), 'utf8');
  console.log(output);
}
