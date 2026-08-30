#!/usr/bin/env node
/**
 * Kiểm tra metadata phong cảnh dùng để ghép người.
 *
 *   node scripts/validate_japan_scenes.js
 *
 * Vì sao cần: ảnh Naoshima cũ có giấy phép hợp lệ, nằm trên Wikimedia, đúng địa
 * điểm — và vẫn hoàn toàn không dùng được, vì nó chụp từ ngoài biển nên chỗ đặt
 * chân là mặt nước. Trong sáu ứng viên xem tay ngày 2026-08-29 có ba bị loại vì
 * lý do bố cục chứ không phải vì giấy phép hay độ phân giải. Mắt người bỏ sót
 * những lỗi đó rất dễ khi danh sách dài ra.
 *
 * Script KHÔNG gọi mạng: ảnh đã nằm trong repo.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { SCENES, sceneImagePath } = require(path.join(ROOT, 'backend/lib/japanScenes.js'));

const MIN_LONG_EDGE = 1600;
const MIN_SAFE_WIDTH = 0.25;
const MIN_SAFE_HEIGHT = 0.55;
const MAX_LANDMARK_OVERLAP = 0.25;

/** Kích thước ảnh JPEG/WebP/PNG đọc thẳng từ header, không cần thư viện ảnh. */
function imageSize(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.subarray(0, 2).toString('hex') === 'ffd8') {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      // SOF0..SOF15 trừ DHT/JPG/DAC — các marker này mang kích thước ảnh.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  if (buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') {
    if (buffer.subarray(12, 16).toString() === 'VP8X') {
      return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
    }
    if (buffer.subarray(12, 16).toString() === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

/** Điểm có nằm trong đa giác không (ray casting). */
function pointInPolygon(point, polygon) {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = (yi > py) !== (yj > py)
      && px < ((xj - xi) * (py - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function rectOverlap(a, b) {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y;
}

function validate(scene) {
  const problems = [];
  const warnings = [];
  const c = scene.composition || {};

  for (const field of ['sourceUrl', 'author', 'license', 'licenseUrl', 'attribution', 'checkedAt']) {
    if (!scene[field]) problems.push(`thiếu ${field}`);
  }

  const file = sceneImagePath(scene);
  let size = null;
  if (!fs.existsSync(file)) {
    problems.push(`không có file ảnh ${scene.imageFile}`);
  } else {
    size = imageSize(file);
    if (!size) problems.push('không đọc được kích thước ảnh');
    else if (Math.max(size.width, size.height) < MIN_LONG_EDGE) {
      problems.push(`cạnh dài ${Math.max(size.width, size.height)}px < ${MIN_LONG_EDGE}px`);
    }
  }

  const anchor = c.footAnchor;
  if (!anchor) problems.push('thiếu footAnchor');
  else {
    if (anchor.x < 0 || anchor.x > 1 || anchor.y < 0 || anchor.y > 1) {
      problems.push(`footAnchor (${anchor.x}, ${anchor.y}) nằm ngoài ảnh`);
    }
    // Điều kiện quan trọng nhất: chỗ đặt chân phải là MẶT ĐẤT. Đây chính là bài
    // kiểm tra mà ảnh Naoshima cũ trượt.
    if (Array.isArray(c.groundPolygon) && c.groundPolygon.length >= 3) {
      if (!pointInPolygon([anchor.x, anchor.y], c.groundPolygon)) {
        problems.push('footAnchor không nằm trong groundPolygon — người sẽ đứng trên nước, cây hoặc trời');
      }
    } else {
      problems.push('thiếu groundPolygon nên không kiểm được chỗ đặt chân');
    }
  }

  const ratio = c.personHeightRatio;
  if (!ratio) problems.push('thiếu personHeightRatio');
  else {
    if (!(ratio.min < ratio.preferred && ratio.preferred < ratio.max)) {
      problems.push(`personHeightRatio không tăng dần: ${ratio.min}/${ratio.preferred}/${ratio.max}`);
    }
    if (ratio.max > 0.85) problems.push(`personHeightRatio.max ${ratio.max} quá lớn — người sẽ lấn hết cảnh`);
    if (anchor && ratio.max) {
      const headY = anchor.y - ratio.max;
      if (headY < 0) problems.push(`ở kích thước lớn nhất, đầu vượt ra ngoài ảnh (y=${headY.toFixed(2)})`);
    }
  }

  const zone = c.safeZone;
  if (!zone) problems.push('thiếu safeZone');
  else {
    if (zone.width < MIN_SAFE_WIDTH) problems.push(`safeZone rộng ${zone.width} < ${MIN_SAFE_WIDTH}`);
    if (zone.height < MIN_SAFE_HEIGHT) problems.push(`safeZone cao ${zone.height} < ${MIN_SAFE_HEIGHT}`);
    if (anchor && (anchor.x < zone.x || anchor.x > zone.x + zone.width)) {
      warnings.push('footAnchor nằm ngoài safeZone theo chiều ngang');
    }
    const area = zone.width * zone.height;
    const covered = (c.landmarkAvoidRects || []).reduce((sum, r) => sum + rectOverlap(zone, r), 0);
    if (area > 0 && covered / area > MAX_LANDMARK_OVERLAP) {
      problems.push(`safeZone chồng landmark ${(covered / area * 100).toFixed(0)}% > ${MAX_LANDMARK_OVERLAP * 100}%`);
    }
  }

  if (!c.lightDirection) warnings.push('thiếu lightDirection — bóng đổ sẽ dùng mặc định');
  if (!(c.shadowOpacity > 0)) warnings.push('shadowOpacity bằng 0 — người sẽ trông như lơ lửng');

  for (const slot of c.personSlots || []) {
    if (slot.x < 0 || slot.x > 1) problems.push(`slot ${slot.id} có x=${slot.x} ngoài ảnh`);
    if (Array.isArray(c.groundPolygon) && anchor
        && !pointInPolygon([slot.x, anchor.y], c.groundPolygon)) {
      problems.push(`slot ${slot.id} (x=${slot.x}) không đứng trên mặt đất`);
    }
  }
  if (!(c.personSlots || []).length) problems.push('scene phải có ít nhất một personSlot');

  return { problems, warnings, size };
}

function main() {
  const seenImages = new Map();
  const seenSources = new Map();
  let failed = 0;

  console.log(`Kiểm tra ${SCENES.length} scene\n`);
  for (const scene of SCENES) {
    const { problems, warnings, size } = validate(scene);

    const imageKey = scene.imageFile;
    if (seenImages.has(imageKey)) problems.push(`trùng ảnh với scene ${seenImages.get(imageKey)}`);
    else seenImages.set(imageKey, scene.id);
    if (seenSources.has(scene.sourceUrl)) problems.push(`trùng nguồn với scene ${seenSources.get(scene.sourceUrl)}`);
    else seenSources.set(scene.sourceUrl, scene.id);

    const status = problems.length ? 'LỖI' : 'ĐẠT';
    if (problems.length) failed += 1;
    const zone = scene.composition.safeZone || {};
    console.log(`[${status}] ${scene.id}`);
    console.log(`       ${scene.spotPlace} (${scene.spotPrefecture}) · ${scene.name}`);
    console.log(`       ${size ? `${size.width}x${size.height}` : 'không rõ kích thước'} · ${scene.license} · ${scene.author}`);
    console.log(`       safe-zone ${(zone.width * zone.height * 100).toFixed(0)}% khung · ${(scene.composition.personSlots || []).length} vị trí đứng`);
    problems.forEach((p) => console.log(`       ✗ ${p}`));
    warnings.forEach((w) => console.log(`       ! ${w}`));
    console.log();
  }

  const spots = new Map();
  for (const scene of SCENES) {
    const key = `${scene.spotPlace} (${scene.spotPrefecture})`;
    spots.set(key, (spots.get(key) || 0) + 1);
  }
  console.log('Số góc chụp theo địa điểm:');
  for (const [spot, count] of spots) {
    console.log(`  ${count >= 2 ? ' ' : '!'} ${spot}: ${count}`);
  }

  console.log(`\n${SCENES.length - failed}/${SCENES.length} scene đạt.`);
  process.exit(failed ? 1 : 0);
}

main();
