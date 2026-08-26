// Đo chất lượng bộ phân loại độ vừa vặn (lib/fitAnalysis.js).
//
//   node backend/ai_training/evaluate_fit_classifier.js
//   node backend/ai_training/evaluate_fit_classifier.js --cases duong/dan/toi/cases.jsonl
//
// PHẢI ĐỌC TRƯỚC KHI ĐƯA SỐ VÀO BÁO CÁO:
// Tệp `fit_cases.jsonl` đi kèm chứa nhãn do CON NGƯỜI viết tay theo đặc tả
// nghiệp vụ (bảng ánh xạ bậc size ↔ mức vừa vặn, cộng các ca dựa trên số đo
// vòng thật). Vì vậy điểm số ở đây đo mức TUÂN THỦ ĐẶC TẢ của bộ phân loại,
// không phải mức trùng khớp với cảm nhận của người mặc thật. Muốn có con số
// thứ hai đó thì phải chấm tay ảnh thật — xem evaluate_tryon_manual.py.
const fs = require('fs');
const path = require('path');

const { analyzeFit } = require('../lib/fitAnalysis');

const CLASSES = [
  'very_tight', 'tight', 'slightly_tight', 'good',
  'slightly_loose', 'loose', 'very_loose',
];

function parseArgs(argv) {
  const args = { cases: path.join(__dirname, 'fit_cases.jsonl') };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--cases') args.cases = argv[index + 1];
    if (argv[index] === '--json') args.json = true;
  }
  return args;
}

function loadCases(file) {
  if (!fs.existsSync(file)) {
    console.error(`Không tìm thấy tệp ca kiểm thử: ${file}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'))
    .map((line, index) => {
      try { return JSON.parse(line); } catch (error) {
        console.error(`Dòng ${index + 1} không phải JSON hợp lệ: ${error.message}`);
        process.exit(1);
        return null;
      }
    });
}

function macroF1(matrix) {
  const scores = CLASSES.map((cls) => {
    const truePositive = matrix[cls]?.[cls] || 0;
    const predicted = CLASSES.reduce((sum, other) => sum + (matrix[other]?.[cls] || 0), 0);
    const actual = CLASSES.reduce((sum, other) => sum + (matrix[cls]?.[other] || 0), 0);
    if (!actual && !predicted) return null; // lớp không xuất hiện -> không tính vào trung bình
    const precision = predicted ? truePositive / predicted : 0;
    const recall = actual ? truePositive / actual : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { cls, precision, recall, f1, support: actual };
  }).filter(Boolean);
  const macro = scores.reduce((sum, row) => sum + row.f1, 0) / Math.max(1, scores.length);
  return { scores, macro };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = loadCases(args.cases);
  const matrix = {};
  const mistakes = [];
  let correct = 0;

  for (const item of cases) {
    const result = analyzeFit({
      chosenSize: item.chosenSize,
      recommendedSize: item.recommendedSize,
      profile: item.profile || {},
      zone: item.zone || 'upper',
      category: item.category || 'tops',
      bodyAnalysis: item.bodyAnalysis || null,
    });
    const expected = item.expected;
    matrix[expected] = matrix[expected] || {};
    matrix[expected][result.verdict] = (matrix[expected][result.verdict] || 0) + 1;
    if (result.verdict === expected) correct += 1;
    else mistakes.push({ id: item.id, expected, predicted: result.verdict, severity: result.severity });
  }

  const accuracy = correct / Math.max(1, cases.length);
  const { scores, macro } = macroF1(matrix);

  if (args.json) {
    console.log(JSON.stringify({
      samples: cases.length, accuracy, macroF1: macro, matrix, mistakes,
      note: 'Nhãn viết tay theo đặc tả nghiệp vụ — đo mức tuân thủ đặc tả, không phải cảm nhận người mặc.',
    }, null, 2));
    return;
  }

  console.log(`Bộ phân loại độ vừa vặn — ${cases.length} ca kiểm thử`);
  console.log(`  Accuracy : ${(accuracy * 100).toFixed(1)}%`);
  console.log(`  Macro F1 : ${macro.toFixed(3)}`);
  console.log('\nTheo từng lớp:');
  for (const row of scores) {
    console.log(`  ${row.cls.padEnd(16)} P=${row.precision.toFixed(2)} R=${row.recall.toFixed(2)} F1=${row.f1.toFixed(2)} (n=${row.support})`);
  }
  console.log('\nMa trận nhầm lẫn (hàng = nhãn thật, cột = dự đoán):');
  const header = CLASSES.map((cls) => cls.slice(0, 6).padStart(7)).join('');
  console.log(`  ${''.padEnd(16)}${header}`);
  for (const actual of CLASSES) {
    const row = CLASSES.map((predicted) => String(matrix[actual]?.[predicted] || 0).padStart(7)).join('');
    console.log(`  ${actual.padEnd(16)}${row}`);
  }
  if (mistakes.length) {
    console.log('\nCa sai:');
    for (const mistake of mistakes) {
      console.log(`  ${mistake.id}: mong đợi ${mistake.expected}, nhận ${mistake.predicted} (severity ${mistake.severity})`);
    }
  }
  console.log('\nLưu ý: nhãn ở đây do người viết theo đặc tả nghiệp vụ, nên con số này đo mức');
  console.log('tuân thủ đặc tả. Chất lượng ảnh thật phải chấm tay bằng evaluate_tryon_manual.py.');
}

main();
