const test = require('node:test');
const assert = require('node:assert/strict');

const { orderAddress } = require('../lib/emails');

test('hoá đơn giữ nguyên snapshot địa chỉ dạng chuỗi của đơn', () => {
  assert.equal(orderAddress({ address: '12 Trần Phú, Hà Đông, Hà Nội' }), '12 Trần Phú, Hà Đông, Hà Nội');
});

test('hoá đơn dựng địa chỉ từ addressDetails khi đơn cũ thiếu chuỗi tổng', () => {
  assert.equal(orderAddress({
    addressDetails: { street: '25 Nguyễn Huệ', ward: 'Phường Bến Nghé', province: 'TP Hồ Chí Minh' },
  }), '25 Nguyễn Huệ, Phường Bến Nghé, TP Hồ Chí Minh');
});
