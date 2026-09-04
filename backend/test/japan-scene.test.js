const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  ALLOWED_IMAGE_HOSTS, assertAllowedUrl, findSceneBackground,
} = require('../lib/japanScenePhoto');
const { SCENE_BACKGROUNDS, listSceneBackgrounds } = require('../lib/japanSceneBackgrounds');

// Bảng của backend và danh sách của app phải là MỘT. Nếu app hiện một địa điểm
// mà backend không tra được, người dùng bấm "chụp ảnh ở đây" và nhận lỗi 404 —
// một lỗi chỉ lộ ra trên thiết bị thật nếu không có bài kiểm tra này.
test('bảng địa điểm của backend khớp danh sách trong mobile/lib/japanSpots.ts', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'mobile', 'lib', 'japanSpots.ts'), 'utf8');
  const fromMobile = [...source.matchAll(/\{ place: '([^']+)', photoUrl: '([^']+)', prefecture: '([^']+)'/g)]
    .map((match) => ({ place: match[1], photoUrl: match[2], prefecture: match[3] }));

  assert.ok(fromMobile.length >= 35, `chỉ đọc được ${fromMobile.length} địa điểm từ file mobile`);
  assert.equal(SCENE_BACKGROUNDS.length, fromMobile.length, 'số địa điểm hai bên lệch nhau');

  for (const spot of fromMobile) {
    const backend = findSceneBackground(spot.place, spot.prefecture);
    assert.ok(backend, `backend thiếu địa điểm "${spot.place}" (${spot.prefecture})`);
    assert.equal(backend.photoUrl, spot.photoUrl, `ảnh nền của "${spot.place}" lệch giữa hai bên`);
  }
});

test('tra cứu chỉ khớp tuyệt đối, không đoán gần đúng', () => {
  assert.ok(findSceneBackground('Phố cổ Gion', 'Kyoto'));
  // Sai tỉnh là sai địa điểm — không được rơi về một địa điểm cùng tên ở nơi khác.
  assert.equal(findSceneBackground('Phố cổ Gion', 'Tokyo'), null);
  assert.equal(findSceneBackground('Gion', 'Kyoto'), null);
  assert.equal(findSceneBackground('', ''), null);
  assert.equal(findSceneBackground(null, undefined), null);
});

// Đây là bài quan trọng nhất của file. Nếu backend chịu tải ảnh nền theo địa
// chỉ do client đưa, nó thành công cụ quét mạng nội bộ (SSRF). Client chỉ được
// gửi TÊN địa điểm; địa chỉ luôn do máy chủ tự tra.
test('chỉ chấp nhận HTTPS tới host ảnh đã duyệt', () => {
  assert.deepEqual(ALLOWED_IMAGE_HOSTS, ['upload.wikimedia.org']);
  assert.ok(assertAllowedUrl('https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/x.jpg'));

  const blocked = [
    'http://upload.wikimedia.org/x.jpg',
    'https://evil.example.com/x.jpg',
    'https://127.0.0.1/x.jpg',
    'https://169.254.169.254/latest/meta-data/',
    'https://localhost:4100/api/state',
    'file:///etc/passwd',
    'https://upload.wikimedia.org.evil.com/x.jpg',
  ];
  for (const url of blocked) {
    assert.throws(() => assertAllowedUrl(url), `địa chỉ lẽ ra phải bị chặn: ${url}`);
  }
});

test('mọi ảnh nền đều nằm trên host đã duyệt và dùng HTTPS', () => {
  for (const spot of SCENE_BACKGROUNDS) {
    assert.doesNotThrow(() => assertAllowedUrl(spot.photoUrl), `${spot.place}: ảnh nền sai host`);
    assert.ok(spot.sourceUrl.startsWith('https://'), `${spot.place}: nguồn phải là HTTPS`);
    assert.ok(spot.sourceLabel.length > 3, `${spot.place}: thiếu nhãn nguồn`);
  }
});

test('danh sách công khai không mang địa chỉ ảnh ra ngoài', () => {
  const listed = listSceneBackgrounds();
  assert.equal(listed.length, SCENE_BACKGROUNDS.length);
  for (const spot of listed) {
    assert.equal('photoUrl' in spot, false, `${spot.place} vẫn lộ photoUrl — client không cần và không được biết`);
    assert.ok(spot.place && spot.prefecture);
  }
});
