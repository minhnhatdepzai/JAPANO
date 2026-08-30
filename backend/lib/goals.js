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
  const healthGoal = ['gradual-loss','maintain','move-more','sleep-energy'].includes(String(input.healthGoal))
    ? String(input.healthGoal) : 'gradual-loss';
  const activityLevel = ['low','some','regular'].includes(String(input.activityLevel))
    ? String(input.activityLevel) : 'low';
  const validInputs = age >= 18 && age <= 100
    && heightCm >= 120 && heightCm <= 230
    && currentWeightKg >= 25 && currentWeightKg <= 300
    && targetWeightKg >= 25 && targetWeightKg <= 300;
  const currentBmi = validInputs ? currentWeightKg / ((heightCm / 100) ** 2) : 0;
  const targetBmi = validInputs ? targetWeightKg / ((heightCm / 100) ** 2) : 0;
  const lossKg = Math.max(0, currentWeightKg - targetWeightKg);
  const gainKg = Math.max(0, targetWeightKg - currentWeightKg);
  const under18 = age > 0 && age < 18;
  const unsafe = under18 || (targetBmi > 0 && targetBmi < 18.5) || (currentBmi > 0 && currentBmi < 18.5);
  const weeklyRateKg = lossKg > 0 ? 0.5 : 0;
  let status = 'wellness-maintenance';
  if (!validInputs) status = under18 ? 'needs-professional-guidance' : 'insufficient-input';
  else if (unsafe) status = 'needs-professional-guidance';
  else if (healthGoal === 'gradual-loss' && lossKg >= 0.5) status = 'gradual-loss';
  else if (gainKg >= 0.5) status = 'gradual-gain';

  const movementHabit = activityLevel === 'low'
    ? 'Bắt đầu 10–15 phút đi bộ ở tốc độ thoải mái, 5 ngày/tuần; mỗi 1–2 tuần tăng thêm 5 phút nếu cơ thể đáp ứng tốt.'
    : activityLevel === 'some'
      ? 'Duy trì 20–30 phút vận động mức vừa, 5 ngày/tuần; tăng dần thay vì dồn vào một buổi.'
      : 'Giữ tổng vận động mức vừa trong khoảng 150–300 phút/tuần và bố trí ngày hồi phục.';
  const focusHabit = healthGoal === 'sleep-energy'
    ? 'Giữ giờ ngủ và thức tương đối ổn định; giảm màn hình và caffeine vào cuối ngày nếu chúng làm bạn khó ngủ.'
    : healthGoal === 'move-more'
      ? 'Gắn vận động vào một mốc cố định: đi bộ 10 phút sau bữa trưa hoặc sau giờ làm.'
      : 'Giữ bữa ăn đều đặn, ưu tiên rau, đạm phù hợp và nước; không nhịn ăn để “bù”.';
  return {
    status,
    healthGoal,
    activityLevel,
    currentBmi: currentBmi ? rounded(currentBmi, 1) : null,
    targetBmi: targetBmi ? rounded(targetBmi, 1) : null,
    targetWeightKg: targetWeightKg || null,
    lossKg: rounded(lossKg, 1),
    gainKg: rounded(gainKg, 1),
    weeklyRateKg: unsafe || status !== 'gradual-loss' ? null : weeklyRateKg,
    estimatedWeeks: status === 'gradual-loss' ? Math.max(2, Math.ceil(lossKg / weeklyRateKg)) : null,
    activityMinutesPerWeek: 150,
    strengthDaysPerWeek: 2,
    safetyMessage: !validInputs && !under18
      ? 'Hãy nhập tuổi 18–100, chiều cao 120–230 cm và cân nặng 25–300 kg. JAPANO chưa tạo kế hoạch khi dữ liệu thiếu hoặc ngoài phạm vi kiểm tra.'
      : unsafe
      ? 'JAPANO không tạo lộ trình giảm cân cho người dưới 18 tuổi hoặc mục tiêu BMI dưới 18,5. Hãy trao đổi với bác sĩ/chuyên gia dinh dưỡng.'
      : 'Đây là lộ trình thói quen chung, không phải chẩn đoán hay đơn điều trị. Nếu có bệnh nền, mang thai, tiền sử rối loạn ăn uống hoặc đang dùng thuốc, hãy hỏi chuyên gia y tế.',
    habits: !validInputs ? [
      'Bổ sung đủ thông tin hợp lệ trước khi tạo lộ trình cá nhân.',
      'Trong lúc chờ, ưu tiên ngủ đủ, bữa ăn đều và vận động nhẹ theo khả năng.',
    ] : unsafe ? [
      'Ưu tiên ngủ đủ, vận động nhẹ nhàng và ăn uống đều đặn.',
      'Không nhịn ăn, không dùng thuốc giảm cân không được kê đơn.',
    ] : [
      movementHabit,
      'Tập sức mạnh toàn thân 2 ngày/tuần, có ngày nghỉ xen kẽ.',
      focusHabit,
      'Theo dõi giấc ngủ, năng lượng và mức vận động; cân tối đa 1 lần/tuần nếu việc cân không gây căng thẳng.',
    ],
    sources: [
      'https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html',
      'https://www.who.int/initiatives/behealthy/physical-activity',
    ],
  };
}

function shoppingCoaching(product) {
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

function healthCoaching(wellness) {
  const blocked = ['needs-professional-guidance','insufficient-input'].includes(wellness.status);
  const focus = {
    'gradual-loss':'giảm cân từ từ',
    maintain:'duy trì thể trạng',
    'move-more':'vận động đều hơn',
    'sleep-energy':'ngủ và năng lượng',
  }[wellness.healthGoal] || 'sức khỏe bền vững';
  return {
    motivation: blocked
      ? 'Mục tiêu đầu tiên là có dữ liệu phù hợp và hỗ trợ an toàn; JAPANO sẽ không ép cơ thể theo một con số thiếu căn cứ.'
      : `Mục tiêu ${focus} nên được xây bằng hành động nhỏ có thể lặp lại, không bằng một tuần quá sức.`,
    identityStatement: 'Tôi là người chăm sóc sức khỏe bằng nhịp sống có thể duy trì, không tự phạt khi một ngày chưa như kế hoạch.',
    implementationIntentions: blocked ? [
      'Nếu còn thiếu dữ liệu hoặc có yếu tố sức khỏe đặc biệt, tôi sẽ hỏi bác sĩ/chuyên gia phù hợp trước khi đổi cân nặng.',
      'Nếu hôm nay ít năng lượng, tôi sẽ chọn vận động nhẹ theo khả năng thay vì cố quá sức.',
    ] : [
      'Nếu kết thúc bữa trưa hoặc giờ làm, tôi sẽ đi bộ 10 phút trước khi ngồi lâu trở lại.',
      'Nếu bỏ lỡ một buổi vận động, tôi sẽ quay lại bằng 10 phút nhẹ nhàng trong ngày kế tiếp.',
      'Nếu muốn thay đổi mọi thứ cùng lúc, tôi sẽ chỉ chọn một thói quen cho tuần này.',
    ],
    obstaclePlans: [
      'Tuần bận: giảm thời lượng mỗi buổi nhưng giữ nhịp xuất hiện.',
      'Đau, chóng mặt hoặc khó thở bất thường: dừng lại và tìm tư vấn y tế phù hợp.',
      'Tâm trạng xuống: chọn một hành động 5 phút và không dùng cân nặng để tự phán xét.',
    ],
    weeklyFocus: blocked ? 'Xác minh dữ liệu và điều kiện an toàn trước.' : `Tuần này tập trung vào ${focus}; chỉ tăng mức khó khi cơ thể đáp ứng tốt.`,
    reflectionQuestion: 'Hành động nào trong tuần vừa rồi giúp năng lượng hoặc giấc ngủ của bạn tốt hơn một chút?',
    engine: 'goal-specific-rules + implementation-intentions',
  };
}

function baseCoaching(product, wellness, goalType = 'shopping') {
  return goalType === 'health' ? healthCoaching(wellness) : shoppingCoaching(product);
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

async function enhanceCoaching({ product, saving, wellness, goalType = 'shopping', ollamaUrl, model = 'qwen2.5:7b', timeoutMs = 45000 }) {
  const fallback = baseCoaching(product, wellness, goalType);
  const prompt = [
    'Bạn là coach hành vi hỗ trợ người trưởng thành xây thói quen lành mạnh và tiết kiệm tiền.',
    'Dùng SMART goals, implementation intentions (nếu-thì), habit stacking và self-compassion.',
    'Không chẩn đoán tâm lý. Không shame cơ thể. Không khuyên nhịn ăn, bỏ bữa, thuốc giảm cân, vay tiền hay mua bằng mọi giá.',
    'Giữ nguyên mọi con số trong dữ liệu nền, không tự tạo calorie hay tốc độ giảm cân mới.',
    `Loại mục tiêu đang hiển thị: ${goalType}. Chỉ nói về đúng loại mục tiêu này.`,
    goalType === 'health'
      ? `Kế hoạch sức khoẻ: ${JSON.stringify(wellness)}`
      : `Sản phẩm cần tiết kiệm để mua: ${product.name}. Kế hoạch tài chính: ${JSON.stringify(saving)}`,
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
  const goalType = String(input.goalType) === 'health' ? 'health' : 'shopping';
  const wellness = buildWellnessPlan(input);
  return {
    goalType,
    saving: buildSavingPlan(input, product),
    wellness,
    coaching: baseCoaching(product, wellness, goalType),
    methodology: ['SMART goals', 'Implementation intentions', 'Habit stacking', 'Self-compassion', 'Progress milestones'],
    disclaimer: 'Lộ trình chỉ hỗ trợ lập kế hoạch thói quen và ngân sách, không thay thế tư vấn y tế, dinh dưỡng hoặc tài chính cá nhân.',
  };
}

module.exports = { buildSavingPlan, buildWellnessPlan, buildGoalPlan, enhanceCoaching, baseCoaching };
