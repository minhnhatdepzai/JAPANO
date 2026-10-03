const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultPoseIdForSex, needsPoseCorrection } = require('../routes/tryon');

const crossedArms = {
  garmentRegion:{ ok:false, reason:'hands_cover_chest' },
  poseSuitability:{ requiresRepose:true, reasons:['hands_cover_torso'] },
};
test('crossed arms preserve the original head and pose instead of triggering whole-person generation', () => {
  assert.equal(needsPoseCorrection(crossedArms), false);
  assert.equal(needsPoseCorrection(crossedArms, true), true);
});
test('genuine geometric problems still request pose correction', () => {
  assert.equal(needsPoseCorrection({
    ...crossedArms,
    inferredKeypoints: ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'],
    poseSuitability:{ requiresRepose:true, reasons:['hands_cover_torso','occluded_torso'] },
  }), true);
  assert.equal(needsPoseCorrection({ garmentRegion:{ ok:false, reason:'shoulders_not_visible' } }), true);
  assert.equal(needsPoseCorrection({}), false);
});
test('ảnh ngồi chỉ mất khớp hông vẫn mặc trực tiếp và giữ dáng gốc', () => {
  const seatedPose = {
    garmentRegion: { ok:true, reason:'ok' },
    inferredKeypoints: ['left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'],
    poseSuitability: { requiresRepose:true, reasons:['occluded_torso'] },
  };
  assert.equal(needsPoseCorrection(seatedPose), false);
});
test('ảnh đã đứng giữ nguyên dáng kể cả đứng nghiêng, lệch vai, giơ tay hoặc bắt chéo chân', () => {
  const standingPose = {
    garmentRegion: { ok:true, reason:'ok' },
    poseSuitability: {
      requiresRepose:true,
      reasons:['side_profile','tilted_shoulders','leaning_body','arms_raised'],
    },
  };
  assert.equal(needsPoseCorrection(standingPose), false);
});
test('ảnh đứng cầm máy và bị cắt chân vẫn giữ cử chỉ gốc', () => {
  const cameraPose = {
    garmentRegion: { ok:true, reason:'ok' },
    inferredKeypoints: ['left_ankle', 'right_ankle'],
    keypoints: {
      left_wrist:[260, 390, .92], right_wrist:[320, 405, .91],
      left_ankle:[250, 890, .05], right_ankle:[340, 890, .05],
    },
    poseSuitability: { requiresRepose:true, reasons:['cropped_feet'] },
  };
  assert.equal(needsPoseCorrection(cameraPose), false);
});
test('hồ sơ nam dùng dáng trung tính; không suy đoán giới tính từ ảnh trống', () => {
  assert.equal(defaultPoseIdForSex('male'), 'relaxed-masculine');
  assert.equal(defaultPoseIdForSex('nam'), 'relaxed-masculine');
  assert.equal(defaultPoseIdForSex('female'), 'relaxed');
  assert.equal(defaultPoseIdForSex(''), 'relaxed');
});
