const { parseJsonText } = require('./productVision');

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const rounded = (value, digits = 0) => {
  const scale = 10 ** digits;
  return Math.round((Number(value) || 0) * scale) / scale;
};

function buildSavingPlan(input, product) {
  const price = Math.max(0, Number(product.price) || 0);
  const currentSavings = Math.max(0, Number(input.currentSavings) || 0);
  const monthlyIncome = Math.max(0, Number(input.monthlyIncome) || 0);
  const fixedExpenses = Math.max(0, Number(input.fixedExpenses) || 0);
  const requestedMonths = clamp(input.targetMonths || 6, 1, 24);
  const gap = Math.max(0, price - currentSavings);
  const disposable = Math.max(0, monthlyIncome - fixedExpenses);
  const deadlineAmount = gap / requestedMonths;
  const sustainableFloor = disposable * 0.12;
  const sustainableCap = disposable * 0.4;
  const requestedSaving = Math.max(0, Number(input.monthlySaving) || 0);
  const monthlySaving = gap === 0 ? 0 : rounded(Math.min(
    gap,
    sustainableCap || deadlineAmount,
    Math.max(requestedSaving, sustainableFloor, Math.min(deadlineAmount, sustainableCap || deadlineAmount)),
  ));
  const estimatedMonths = gap === 0 ? 0 : monthlySaving > 0 ? Math.ceil(gap / monthlySaving) : null;
  const percent = price ? clamp((currentSavings / price) * 100, 0, 100) : 100;
  return {
    productId: product.slug,
    productName: product.name,
    targetPrice: price,
    currentSavings,
    gap,
    progressPercent: rounded(percent, 1),
    disposableIncome: disposable,
    monthlySaving,
    weeklySaving: rounded(monthlySaving / 4.33),
    requestedMonths,
    estimatedMonths,
    feasibleByRequestedDate: gap === 0 || (estimatedMonths != null && estimatedMonths <= requestedMonths),
    milestones: [25, 50, 75, 100].map((milestone) => ({
      milestone,
      amount: rounded(price * milestone / 100),
      reached: percent >= milestone,
    })),
    actions: gap === 0 ? [
      'Bạn đã đủ ngân sách mục tiêu; kiểm tra lại size, màu và nhu cầu trước khi đặt.',
    ] : disposable <= 0 ? [
      'Thu nhập khả dụng đang bằng 0; chưa nên cam kết mua. Rà lại chi phí bắt buộc trước.',
      'Lưu sản phẩm vào yêu thích và đặt lại kế hoạch khi ngân sách dương.',
    ] : [
      `Tách tự động ${rounded(monthlySaving).toLocaleString('vi-VN')}₫ ngay sau ngày nhận thu nhập.`,
      `Giới hạn khoảng ${rounded(monthlySaving / 4.33).toLocaleString('vi-VN')}₫ mỗi tuần cho quỹ “${product.name}”.`,
      'Mỗi cuối tuần ghi lại một khoản đã tránh chi tiêu bốc đồng và chuyển đúng số đó vào quỹ.',
    ],
  };
}

function buildWellnessPlan(input) {
  const age = Number(input.age) || 0;
  const heightCm = Number(input.heightCm) || 0;
  const currentWeightKg = Number(input.currentWeightKg) || 0;
  const targetWeightKg = Number(input.targetWeightKg) || 0;
  const currentBmi = heightCm > 0 && currentWeightKg > 0 ? currentWeightKg / ((heightCm / 100) ** 2) : 0;
  const targetBmi = heightCm > 0 && targetWeightKg > 0 ? targetWeightKg / ((heightCm / 100) ** 2) : 0;
  const lossKg = Math.max(0, currentWeightKg - targetWeightKg);
  const unsafe = (age > 0 && age < 18) || (targetBmi > 0 && targetBmi < 18.5) || (currentBmi > 0 && currentBmi < 18.5);
  const weeklyRateKg = lossKg > 0 ? 0.5 : 0;
  return {
    status: unsafe ? 'needs-professional-guidance' : lossKg > 0 ? 'gradual-loss' : 'wellness-maintenance',
    currentBmi: currentBmi ? rounded(currentBmi, 1) : null,
    targetBmi: targetBmi ? rounded(targetBmi, 1) : null,
    targetWeightKg: targetWeightKg || null,
    lossKg: rounded(lossKg, 1),
    weeklyRateKg: unsafe ? null : weeklyRateKg,
    estimatedWeeks: unsafe ? null : lossKg > 0 ? Math.max(2, Math.ceil(lossKg / weeklyRateKg)) : 4,
    activityMinutesPerWeek: 150,
    strengthDaysPerWeek: 2,
    safetyMessage: unsafe
      ? 'JAPANO không tạo lộ trình giảm cân cho người dưới 18 tuổi hoặc mục tiêu BMI dưới 18,5. Hãy trao đổi với bác sĩ/chuyên gia dinh dưỡng.'
      : 'Đây là lộ trình thói quen chung, không phải chẩn đoán hay đơn điều trị. Nếu có bệnh nền, mang thai, tiền sử rối loạn ăn uống hoặc đang dùng thuốc, hãy hỏi chuyên gia y tế.',
    habits: unsafe ? [
      'Ưu tiên ngủ đủ, vận động nhẹ nhàng và ăn uống đều đặn.',
      'Không nhịn ăn, không dùng thuốc giảm cân không được kê đơn.',
    ] : [
      'Bắt đầu bằng 20–30 phút đi bộ nhanh, 5 ngày/tuần; tăng dần theo thể lực.',
      'Tập sức mạnh toàn thân 2 ngày/tuần, có ngày nghỉ xen kẽ.',
      'Giữ bữa ăn đều đặn, ưu tiên rau, đạm phù hợp và nước; không nhịn ăn để “bù”.',
      'Theo dõi giấc ngủ, năng lượng và mức vận động; cân tối đa 1 lần/tuần nếu việc cân không gây căng thẳng.',
    ],
    sources: [
      'https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html',
      'https://www.who.int/initiatives/behealthy/physical-activity',
    ],
  };
}

function baseCoaching(product) {
  return {
    motivation: `Mục tiêu không phải ép mình thay đổi thật nhanh, mà là xây thói quen đủ bền để bạn tự tin mặc ${product.name} và vẫn giữ ngân sách an toàn.`,
    identityStatement: 'Tôi là người chăm sóc cơ thể bằng lựa chọn nhỏ, đồng thời chi tiêu có kế hoạch.',
    implementationIntentions: [
      'Nếu vừa nhận thu nhập, tôi sẽ chuyển tiền vào quỹ mua sắm trước khi mở ứng dụng giải trí.',
      'Nếu bỏ lỡ một buổi vận động, tôi sẽ quay lại bằng 10 phút đi bộ trong ngày kế tiếp.',
      'Nếu muốn mua bốc đồng, tôi sẽ chờ 24 giờ và kiểm tra lại quỹ mục tiêu.',
    ],
    obstaclePlans: [
      'Tuần bận: giảm thời lượng mỗi buổi nhưng giữ nhịp xuất hiện.',
      'Chi phí bất ngờ: ưu tiên quỹ khẩn cấp và kéo dài hạn mua thay vì vay để mua đồ.',
      'Tâm trạng xuống: chọn một hành động nhỏ có thể làm trong 5 phút, không tự trách.',
    ],
    weeklyFocus: 'Mỗi tuần chỉ nâng một thói quen: vận động, bữa ăn đều, ngủ hoặc tiết kiệm.',
    reflectionQuestion: 'Tuần này hành động nhỏ nào giúp bạn vừa khoẻ hơn vừa gần mục tiêu mua sắm hơn?',
    engine: 'SMART + implementation-intentions + habit-stacking',
  };
}

function sanitizeCoaching(raw, fallback) {
  if (!raw || typeof raw !== 'object') return fallback;
  const text = JSON.stringify(raw).toLowerCase();
  if (/(nhịn ăn|bỏ bữa|thuốc giảm cân|gây nôn|thuốc xổ|tự trừng phạt|xấu hổ|trang trí nhà|không gian sống)/i.test(text)) return fallback;
  const arr = (value, fallbackValue) => {
    if (!Array.isArray(value)) return fallbackValue;
    const cleaned = value.map((item) => String(item || '').trim().slice(0, 260)).filter(Boolean).slice(0, 5);
    return [...cleaned, ...fallbackValue.filter((item) => !cleaned.includes(item))].slice(0, Math.max(3, cleaned.length));
  };
  return {
    motivation: String(raw.motivation || fallback.motivation).slice(0, 500),
    identityStatement: String(raw.identityStatement || fallback.identityStatement).slice(0, 300),
    implementationIntentions: arr(raw.implementationIntentions, fallback.implementationIntentions),
    obstaclePlans: arr(raw.obstaclePlans, fallback.obstaclePlans),
    weeklyFocus: String(raw.weeklyFocus || fallback.weeklyFocus).slice(0, 320),
    reflectionQuestion: String(raw.reflectionQuestion || fallback.reflectionQuestion).slice(0, 320),
    engine: 'qwen2.5:7b + safety-rules',
  };
}

async function enhanceCoaching({ product, saving, wellness, ollamaUrl, model = 'qwen2.5:7b', timeoutMs = 45000 }) {
  const fallback = baseCoaching(product);
  const prompt = [
    'Bạn là coach hành vi hỗ trợ người trưởng thành xây thói quen lành mạnh và tiết kiệm tiền.',
    'Dùng SMART goals, implementation intentions (nếu-thì), habit stacking và self-compassion.',
    'Không chẩn đoán tâm lý. Không shame cơ thể. Không khuyên nhịn ăn, bỏ bữa, thuốc giảm cân, vay tiền hay mua bằng mọi giá.',
    'Giữ nguyên mọi con số trong dữ liệu nền, không tự tạo calorie hay tốc độ giảm cân mới.',
    `Sản phẩm quần áo/phụ kiện để người dùng mặc: ${product.name}. Không mô tả như đồ trang trí hay vật dụng cho không gian sống.`,
    `Kế hoạch tài chính: ${JSON.stringify(saving)}`,
    `Kế hoạch sức khoẻ: ${JSON.stringify(wellness)}`,
    'Chỉ trả JSON schema:',
    '{"motivation":"...","identityStatement":"...","implementationIntentions":["..."],"obstaclePlans":["..."],"weeklyFocus":"...","reflectionQuestion":"..."}',
  ].join('\n');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${ollamaUrl.replace(/\/+$/, '')}/api/generate`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ model, prompt, stream: false, format: 'json', options: { temperature: 0.3, num_predict: 500 } }),
    });
    if (!response.ok) return fallback;
    const data = await response.json();
    return sanitizeCoaching(parseJsonText(data.response), fallback);
  } catch { return fallback; } finally { clearTimeout(timer); }
}

function buildGoalPlan(input, product) {
  return {
    saving: buildSavingPlan(input, product),
    wellness: buildWellnessPlan(input),
    coaching: baseCoaching(product),
    methodology: ['SMART goals', 'Implementation intentions', 'Habit stacking', 'Self-compassion', 'Progress milestones'],
    disclaimer: 'Lộ trình chỉ hỗ trợ lập kế hoạch thói quen và ngân sách, không thay thế tư vấn y tế, dinh dưỡng hoặc tài chính cá nhân.',
  };
}

module.exports = { buildSavingPlan, buildWellnessPlan, buildGoalPlan, enhanceCoaching };
