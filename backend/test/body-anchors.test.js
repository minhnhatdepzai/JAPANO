const test = require('node:test');
const assert = require('node:assert/strict');

const { SIGNATURES, matchBodyAnchor } = require('../lib/bodyAnchors');
const { mergeBodySignals, summarizeBodyAnalysis } = require('../lib/bodyAnalysis');

const analysisFor = (id, extra = {}) => ({
  ok: true,
  bodyShape: { ...SIGNATURES[id] },
  quality: { analysisConfidence: 1, fullBodyVisible: true },
  estimatedHeight: { valueCm: null, minCm: null, maxCm: null, confidence: 0 },
  estimatedWeight: { valueKg: null, minKg: null, maxKg: null, confidence: 0 },
  estimatedGirthRanges: {},
  ...extra,
});

test('5 mẫu chạy ngầm: chữ ký mỗi mẫu tự khớp đúng body profile', () => {
  const expected = {
    'nam-can-doi': 'regular',
    'nu-can-doi': 'regular',
    'nu-mem-mai': 'curvy',
    'nu-nang-dong': 'athletic',
    'nu-thanh-manh': 'slim',
  };
  for (const [id, bodyProfile] of Object.entries(expected)) {
    const match = matchBodyAnchor(analysisFor(id));
    assert.ok(match, `${id} không tìm được anchor`);
    assert.equal(match.bodyProfile, bodyProfile);
    assert.equal(match.usableForSizing, true);
    // Response không được làm lộ ảnh/nội dung preset cho UI khách hàng.
    assert.equal('id' in match, false);
    assert.equal('imageUrl' in match, false);
    assert.equal('file' in match, false);
  }
});

test('thiếu đặc trưng hình học thì không ép vào một mẫu ngẫu nhiên', () => {
  assert.equal(matchBodyAnchor({ ok: true, bodyShape: {} }), null);
  assert.equal(matchBodyAnchor({ ok: true, bodyShape: { bodyWidthRatio: 0.2, torsoRatio: 0.3 } }), null);
});

test('anchor chỉ bổ sung prior chọn size, không giả làm estimate đo được', () => {
  const analysis = analysisFor('nu-mem-mai');
  analysis.referenceProfile = matchBodyAnchor(analysis);
  const merged = mergeBodySignals({}, analysis);
  assert.equal(merged.usedEstimate, false);
  assert.equal(merged.usedAnchor, true);
  assert.equal(merged.sources.height, 'body-anchor-prior');
  assert.equal(merged.sources.weight, 'body-anchor-prior');
  assert.equal(merged.profile.height, 155);
  assert.equal(merged.profile.weight, 115);

  const summary = summarizeBodyAnalysis(analysis);
  assert.equal(summary.measurementStatus, 'insufficient_evidence');
  assert.equal(summary.estimatedHeight.valueCm, null);
  assert.match(summary.measurementMessage, /dải vóc dáng tham chiếu/i);
});

test('estimate ảnh đủ tin cậy luôn thắng midpoint của anchor', () => {
  const analysis = analysisFor('nu-can-doi', {
    estimatedHeight: { valueCm: 172, minCm: 170, maxCm: 180, confidence: 0.7 },
    estimatedWeight: { valueKg: 68, minKg: 60, maxKg: 70, confidence: 0.65 },
  });
  analysis.referenceProfile = matchBodyAnchor(analysis);
  const merged = mergeBodySignals({}, analysis);
  assert.equal(merged.profile.height, 172);
  assert.equal(merged.profile.weight, 68);
  assert.equal(merged.sources.height, 'image-estimation');
  assert.equal(merged.sources.weight, 'image-estimation');
  assert.equal(merged.usedAnchor, false);
});

test('ảnh bị cắt chân nói rõ lý do thay vì trông như model không chạy', () => {
  const summary = summarizeBodyAnalysis(analysisFor('nu-can-doi', {
    quality: {
      analysisConfidence: 0.83,
      fullBodyVisible: false,
      headVisible: true,
      feetVisible: false,
      coverage: 'knee',
    },
    absoluteMeasurementsRestricted: true,
  }));
  assert.equal(summary.measurementStatus, 'insufficient_evidence');
  assert.match(summary.measurementMessage, /không thấy trọn bàn chân/i);
  assert.doesNotMatch(summary.measurementMessage, /dải vóc dáng tham chiếu/i);
});

test('ảnh ngồi hoặc cắt chân có dự đoán thống kê vẫn mang trạng thái partial', () => {
  const summary = summarizeBodyAnalysis(analysisFor('nu-can-doi', {
    quality: {
      analysisConfidence: 0.83,
      fullBodyVisible: false,
      headVisible: true,
      feetVisible: false,
      coverage: 'knee',
    },
    absoluteMeasurementsRestricted: true,
    measurementStatus: 'partial',
    estimatedHeight: { valueCm: 161.4, minCm: 156, maxCm: 166, confidence: 0.28, usableForSizing: false },
    estimatedWeight: { valueKg: 56.6, minKg: 52, maxKg: 62, confidence: 0.28, usableForSizing: false },
    estimatedGirthRanges: {
      bust: { valueCm: 87, confidence: 0.22, usableForSizing: false },
      waist: { valueCm: 76.4, confidence: 0.22, usableForSizing: false },
      hip: { valueCm: 95.3, confidence: 0.22, usableForSizing: false },
    },
    girthsArePopulationPrior: true,
  }));
  assert.equal(summary.measurementStatus, 'partial');
  assert.equal(summary.girthsArePopulationPrior, true);
  assert.match(summary.measurementMessage, /ảnh thiếu một phần cơ thể hoặc đang ngồi/i);
  assert.match(summary.measurementMessage, /không dùng.*tự chọn size/i);
});
