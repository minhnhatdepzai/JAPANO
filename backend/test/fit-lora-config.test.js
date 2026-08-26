// Cấu hình LoRA fit nhìn từ phía backend Node.
//
// Phần train và nạp adapter nằm ở Python; ở đây chỉ khoá những gì backend Node
// chịu trách nhiệm: đọc đúng cờ môi trường, giới hạn LoRA trong miền dữ liệu đã
// train, và tuyệt đối không để lộ secret ra response.
const test = require('node:test');
const assert = require('node:assert/strict');

const { fitConfig } = require('../lib/tryonConfig');

const withEnv = (patch, run) => {
  const previous = {};
  for (const [key, value] of Object.entries(patch)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { return run(); } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test('mặc định LoRA fit chỉ áp cho tops (miền dữ liệu đã train)', () => {
  withEnv({ JAPANO_FIT_LORA_CATEGORIES: undefined }, () => {
    const config = fitConfig();
    assert.deepEqual(config.fitLoraCategories, ['tops']);
    // Quần, đồ liền thân, kimono KHÔNG được dùng checkpoint train từ VITON-HD.
    assert.ok(!config.fitLoraCategories.includes('bottoms'));
    assert.ok(!config.fitLoraCategories.includes('one-pieces'));
  });
});

test('mở rộng danh mục LoRA phải là hành động có chủ đích qua env', () => {
  withEnv({ JAPANO_FIT_LORA_CATEGORIES: 'tops, one-pieces' }, () => {
    assert.deepEqual(fitConfig().fitLoraCategories, ['tops', 'one-pieces']);
  });
});

test('không cấu hình checkpoint thì fitLoraPath rỗng, không phải undefined', () => {
  withEnv({ JAPANO_FIT_LORA_PATH: undefined }, () => {
    assert.equal(fitConfig().fitLoraPath, '');
  });
});

test('fitConfig chỉ trả đường dẫn và cờ — không mang theo giá trị nhạy cảm nào', () => {
  withEnv({
    JAPANO_FIT_LORA_PATH: '/home/nhat/Downloads/japano/backend/ai_training/models/fit_lora',
    KAGGLE_KEY: 'gia-lap-khong-duoc-lo',
  }, () => {
    const blob = JSON.stringify(fitConfig());
    assert.ok(!blob.includes('gia-lap-khong-duoc-lo'));
    assert.ok(!blob.toLowerCase().includes('kaggle'));
    assert.ok(!blob.toLowerCase().includes('token'));
  });
});

test('ngưỡng fit đọc được từ env và có mặc định an toàn', () => {
  withEnv({ JAPANO_FIT_REFINE_MIN_SEVERITY: undefined, JAPANO_FIT_TEAR_MIN_SEVERITY: undefined }, () => {
    const config = fitConfig();
    assert.equal(config.fitRefineMinSeverity, 0.35);
    assert.equal(config.fitTearMinSeverity, 0.85);
  });
  withEnv({ JAPANO_FIT_TEAR_MIN_SEVERITY: '0.95' }, () => {
    assert.equal(fitConfig().fitTearMinSeverity, 0.95);
  });
});
