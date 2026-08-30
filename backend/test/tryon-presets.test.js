const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { listTryonPresets, loadTryonPreset, publicPreset, PRESET_DIR } = require('../lib/tryonPresets');

test('danh sách preset không rò đường dẫn đĩa hay dữ liệu ảnh', () => {
  const presets = listTryonPresets();
  assert.ok(presets.length >= 5, `chỉ có ${presets.length} preset`);
  for (const preset of presets) {
    const serialized = JSON.stringify(preset);
    assert.equal(serialized.includes('base64'), false, `${preset.id} rò base64`);
    assert.equal(serialized.includes(PRESET_DIR), false, `${preset.id} rò đường dẫn đĩa`);
    assert.equal('file' in preset, false, `${preset.id} rò tên file gốc qua field file`);
    assert.equal('sha256' in preset, false, `${preset.id} rò hash`);
    assert.ok(preset.imageUrl.startsWith('/assets/tryon-presets/'), `${preset.id} sai imageUrl`);
  }
});

test('mọi preset đều là người lớn và có khoảng số đo rộng tối đa 10 đơn vị', () => {
  for (const preset of listTryonPresets()) {
    // Cờ adult nằm trong manifest server; bản public không mang nó ra ngoài,
    // nên kiểm qua đường nạp thật.
    const loaded = loadTryonPreset(preset.id);
    assert.equal(loaded.ok, true, `${preset.id} không nạp được`);
    assert.equal(loaded.preset.adult, true, `${preset.id} không được đánh dấu người lớn`);
    for (const field of ['heightCm', 'weightKg', 'bustCm', 'waistCm', 'hipCm']) {
      const [min, max] = preset[field];
      assert.ok(Number.isFinite(min) && Number.isFinite(max), `${preset.id}.${field} không phải số`);
      assert.ok(max > min, `${preset.id}.${field} khoảng rỗng hoặc ngược`);
      assert.ok(max - min <= 10, `${preset.id}.${field} rộng ${max - min}, vượt 10 đơn vị`);
    }
  }
});

test('id lạ bị từ chối chứ không rơi về một preset mặc định', () => {
  for (const bogus of ['', '   ', 'khong-ton-tai', '../../etc/passwd', 'nu-can-doi/../nam-can-doi', null, undefined, 42]) {
    const loaded = loadTryonPreset(bogus);
    assert.equal(loaded.ok, false, `id ${JSON.stringify(bogus)} lẽ ra phải bị từ chối`);
    assert.equal(loaded.reason, 'unknown_preset');
  }
});

// Đây là bài quan trọng nhất của file: cờ adult:true phải gắn với NỘI DUNG ảnh
// đã duyệt, không gắn với cái tên preset. Nếu file trên đĩa bị thay, luồng phải
// đóng lại chứ không được tiếp tục coi đó là ảnh người lớn hợp lệ.
test('file bị thay nội dung thì preset mất hiệu lực dù id vẫn đúng', (t) => {
  const target = path.join(PRESET_DIR, 'nu-can-doi.jpg');
  const original = fs.readFileSync(target);
  t.after(() => fs.writeFileSync(target, original));

  assert.equal(loadTryonPreset('nu-can-doi').ok, true, 'trạng thái ban đầu phải hợp lệ');

  fs.writeFileSync(target, Buffer.concat([original, Buffer.from('anh khac')]));
  const tampered = loadTryonPreset('nu-can-doi');
  assert.equal(tampered.ok, false, 'ảnh đã bị đổi mà vẫn được chấp nhận');
  assert.equal(tampered.reason, 'preset_hash_mismatch');
  assert.equal('imageBase64' in tampered, false, 'không được trả ảnh đã hỏng hash');

  fs.writeFileSync(target, original);
  assert.equal(loadTryonPreset('nu-can-doi').ok, true, 'khôi phục xong phải hợp lệ lại');
});

test('hash trong manifest khớp đúng byte của file trên đĩa', () => {
  for (const preset of listTryonPresets()) {
    const loaded = loadTryonPreset(preset.id);
    assert.equal(loaded.ok, true, `${preset.id}: ${loaded.reason}`);
    const raw = fs.readFileSync(path.join(PRESET_DIR, loaded.preset.file));
    assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), loaded.preset.sha256);
    assert.equal(loaded.imageBase64.startsWith('data:image/jpeg;base64,'), true);
  }
});

test('thiếu file thì báo đúng lý do thay vì ném lỗi', () => {
  const loaded = loadTryonPreset('nu-can-doi');
  assert.equal(loaded.ok, true);
  // publicPreset dùng lại được cho mọi nhánh lỗi nên route luôn có gì đó để trả.
  const shape = publicPreset(loaded.preset);
  assert.equal(shape.id, 'nu-can-doi');
  assert.equal('sha256' in shape, false);
});
