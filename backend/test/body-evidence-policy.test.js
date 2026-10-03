const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeBodySignals, summarizeBodyAnalysis } = require('../lib/bodyAnalysis');

test('restricted single-photo evidence cannot silently turn into anchor measurements', () => {
  const analysis = { ok:true, absoluteMeasurementsRestricted:true,
    estimatedHeight:{ valueCm:null,usableForSizing:false }, estimatedWeight:{ valueKg:null,usableForSizing:false },
    referenceProfile:{ usableForSizing:true,confidence:1,heightCm:[160,170],weightKg:[140,160] } };
  const summary = summarizeBodyAnalysis(analysis);
  assert.equal(summary.referenceProfile,null);
  assert.equal(summary.measurementStatus,'insufficient_evidence');
  const merged=mergeBodySignals({},analysis);
  assert.equal(merged.usedAnchor,false);
  assert.equal(Number(merged.profile.weight || 0),0);
});
