"""Huấn luyện bộ ước lượng cân nặng / vòng đo / tỉ lệ cơ thể cho JAPANO.

    python3 backend/ai_training/train_body_estimator.py --ansur     # train thật
    python3 backend/ai_training/train_body_estimator.py --image     # cần ảnh có nhãn

Hai nguồn dữ liệu, hai mức độ tin cậy KHÁC NHAU — không được trộn lẫn khi báo cáo
--------------------------------------------------------------------------------
1. `--ansur` (ĐANG DÙNG): ANSUR II, khảo sát nhân trắc quân đội Mỹ 2012,
   6.068 người thật, license CC0-1.0. Có số đo THẬT của cả bề ngang, độ sâu,
   vòng đo và cân nặng.

   Model học ánh xạ **SỐ ĐO VẬT LÝ → cân nặng / vòng đo**. Nó KHÔNG nhìn ảnh.
   Vì vậy MAE báo cáo ở đây là sai số của riêng bước hồi quy; sai số của bước
   ĐO TỪ ẢNH (pixel → cm) nằm ngoài con số này và cộng thêm vào lỗi cuối cùng.
   Tuyệt đối không được viết "AI đoán cân nặng từ ảnh sai X kg" dựa trên MAE này.

2. `--image`: cần ảnh người kèm chiều cao/cân nặng thật do chính họ cung cấp.
   Chưa tìm được dataset như vậy với license rõ ràng ⇒ trạng thái vẫn là
   MODEL_NOT_TRAINED cho nhánh end-to-end. Không bịa accuracy.

Vì sao việc này đáng làm
------------------------
Trước đây `body_analysis.py` dùng ba nhóm hằng số ĐOÁN:
  * tỉ lệ mốc cơ thể theo bảng Drillis & Contini 1966;
  * tỉ lệ độ sâu/bề ngang cố định 0.74 cho cả thân;
  * hệ số hiệu chuẩn thể tích 0.78 chọn tay từ đúng một tấm ảnh.
ANSUR II thay cả ba bằng số đo của 6.068 người thật. Riêng tỉ lệ độ sâu, số thật
là ngực 0.92 / eo 0.71 / hông 0.66 — dùng chung 0.74 sai nặng ở vòng ngực.

Hạn chế phải nói rõ trong báo cáo
---------------------------------
ANSUR II là quân nhân Mỹ: trẻ, thể trạng tốt hơn dân số chung, và KHÔNG đại diện
cho người Việt Nam. Model vì vậy có sai lệch hệ thống với khách hàng thật của
JAPANO. Đây là dữ liệu công khai tốt nhất tìm được có nhãn thật.
"""

import argparse
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / 'backend'
AI_TRAINING = BACKEND / 'ai_training'
MODELS = AI_TRAINING / 'models'
ANSUR_DIR = Path('/home/nhat/jp/datasets/ansur2')
WEIGHT_MODEL = MODELS / 'body_weight_estimator.joblib'
GIRTH_MODEL = MODELS / 'body_girth_estimators.joblib'
BMI_MODEL = MODELS / 'body_bmi_estimator.joblib'
ANTHRO_JSON = MODELS / 'anthropometry.json'
METRICS_PATH = MODELS / 'body_estimator.metrics.json'

# Ảnh chính diện chỉ đo được BỀ NGANG và chiều cao. Đặc trưng của model vì vậy
# chỉ gồm đúng những đại lượng đó — không dùng vòng đo hay độ sâu làm đầu vào,
# vì lúc suy luận sẽ không có chúng.
# `clothing_slack` là ĐẶC TRƯNG THỨ SÁU, không phải nhiễu ẩn.
#
# Bản train đầu tiên trộn độ rộng quần áo vào nhiễu rồi để model tự học cách trừ
# đi. Chấm trên BodyM (silhouette người mặc đồ bó sát) cho thấy nó trừ luôn cả
# phần không có: sai số lệch −10cm ở cả ba vòng và −9kg ở cân nặng. Model không
# có cách nào biết tấm ảnh này có áo rộng hay không nếu ta không nói cho nó.
#
# `body_analysis.measure_body` đã đo sẵn đại lượng đó (viền thô so với bề ngang
# khung xương cho phép), nên đưa thẳng nó vào làm đầu vào.
FEATURES = ['stature_cm', 'shoulder_breadth_cm', 'chest_breadth_cm',
            'waist_breadth_cm', 'hip_breadth_cm', 'clothing_slack']
# Đặc trưng KHÔNG THANG ĐO: bốn bề ngang chia cho chiều cao. Ảnh đơn đo được
# chúng trực tiếp bằng pixel, không cần biết một centimet dài bao nhiêu pixel.
# Vì sao cần model riêng cho chúng: chiều cao ước lượng từ ảnh là hậu nghiệm của
# một prior dân số, sai số ~9cm; mọi bề ngang quy ra cm đều nhân sai số đó vào,
# rồi model cân nặng lại nhân tiếp. Model BMI này cắt đứt chuỗi nhân sai số —
# nó chỉ cần TỈ LỆ, và tỉ lệ thì đo được chính xác từ pixel.
RATIO_FEATURES = ['shoulder_ratio', 'chest_ratio', 'waist_ratio', 'hip_ratio', 'clothing_slack']
BMI_MODEL_NAME = 'body_bmi_estimator.joblib'
# Bề ngang vai đo trên silhouette là bideltoid (qua cơ delta), KHÔNG phải
# biacromial (khoảng cách hai mỏm vai) — biacromial nằm bên trong cơ thể.
ANSUR_COLUMNS = {
    'stature_cm': ('stature', 0.1),
    'shoulder_breadth_cm': ('bideltoidbreadth', 0.1),
    'chest_breadth_cm': ('chestbreadth', 0.1),
    'waist_breadth_cm': ('waistbreadth', 0.1),
    'hip_breadth_cm': ('hipbreadth', 0.1),
    'weight_kg': ('weightkg', 0.1),
    'chest_circ_cm': ('chestcircumference', 0.1),
    'waist_circ_cm': ('waistcircumference', 0.1),
    'hip_circ_cm': ('buttockcircumference', 0.1),
    'chest_depth_cm': ('chestdepth', 0.1),
    'waist_depth_cm': ('waistdepth', 0.1),
    'hip_depth_cm': ('buttockdepth', 0.1),
    'shoulder_height_cm': ('acromialheight', 0.1),
    'hip_height_cm': ('trochanterionheight', 0.1),
    'knee_height_cm': ('kneeheightmidpatella', 0.1),
}


def load_ansur():
    rows = []
    for name, sex in (('ANSUR II FEMALE Public.csv', 'F'), ('ANSUR II MALE Public.csv', 'M')):
        path = ANSUR_DIR / name
        if not path.exists():
            raise SystemExit(f'Không thấy {path}. Tải: kaggle datasets download -d seshadrikolluri/ansur-ii')
        with path.open(encoding='latin-1') as handle:
            for raw in csv.DictReader(handle):
                try:
                    row = {key: float(raw[col]) * scale for key, (col, scale) in ANSUR_COLUMNS.items()}
                except (KeyError, TypeError, ValueError):
                    continue
                if row['stature_cm'] <= 0 or row['weight_kg'] <= 0:
                    continue
                # Số đo ANSUR là đo bằng thước trên cơ thể, tức KHÔNG có quần áo.
                row['clothing_slack'] = 1.0
                row['sex'] = sex
                rows.append(row)
    return rows


def fit_anthropometry(rows):
    """Tỉ lệ nhân trắc đo trên người thật — thay cho bảng hằng số 1966.

    Trả về cả độ lệch chuẩn để `body_analysis.py` dựng khoảng tin cậy từ phân bố
    thật thay vì một con số ± chọn tay.
    """
    import statistics

    def ratio_stats(numerator, denominator='stature_cm'):
        values = [r[numerator] / r[denominator] for r in rows if r[denominator] > 0]
        return {'mean': round(statistics.mean(values), 5), 'sd': round(statistics.pstdev(values), 5)}

    # Mốc đo TỪ ĐỈNH ĐẦU xuống = 1 - (chiều cao mốc / stature).
    def from_top(column):
        stats = ratio_stats(column)
        return {'mean': round(1 - stats['mean'], 5), 'sd': stats['sd']}

    anthro = {
        'source': 'ANSUR II (2012 US Army Anthropometric Survey), CC0-1.0',
        'sampleSize': len(rows),
        'populationCaveat': 'Quân nhân Mỹ — không đại diện cho người Việt Nam hay dân số chung.',
        'statureFractionFromTop': {
            'shoulder': from_top('shoulder_height_cm'),
            'hip': from_top('hip_height_cm'),
            'knee': from_top('knee_height_cm'),
        },
        'depthOverBreadth': {
            'chest': ratio_stats('chest_depth_cm', 'chest_breadth_cm'),
            'waist': ratio_stats('waist_depth_cm', 'waist_breadth_cm'),
            'hip': ratio_stats('hip_depth_cm', 'hip_breadth_cm'),
        },
        'breadthOverStature': {
            'shoulder': ratio_stats('shoulder_breadth_cm'),
            'chest': ratio_stats('chest_breadth_cm'),
            'waist': ratio_stats('waist_breadth_cm'),
            'hip': ratio_stats('hip_breadth_cm'),
        },
        'bmi': {
            'mean': round(statistics.mean(r['weight_kg'] / (r['stature_cm'] / 100) ** 2 for r in rows), 2),
            'sd': round(statistics.pstdev(r['weight_kg'] / (r['stature_cm'] / 100) ** 2 for r in rows), 2),
        },
    }
    return anthro


# Bộ nhiễu mô phỏng đúng những gì bước ĐO TỪ ẢNH làm sai. Model cũ học trên số
# đo bằng thước rồi được cho ăn số đo từ silhouette người mặc quần áo — lệch miền
# tới 8 độ lệch chuẩn, và hệ thống phải veto nó bằng một cổng out-of-distribution.
# Veto đó lại đẩy mọi ảnh cắt chân sang một công thức BMI tuyến tính thô, chính
# là nhánh đã trả 119.8kg cho một người mẫu gầy.
#
# Cách chữa đúng là dạy model chịu được nhiễu đó, chứ không phải chặn model lại.
CORRUPTIONS = {
    # Quần áo chỉ làm đường viền RỘNG RA, không bao giờ hẹp lại -> nhiễu một phía.
    'clothing_slack': {'chest': (0.0, 0.22), 'waist': (0.0, 0.30), 'hip': (0.0, 0.26),
                       'shoulder': (0.0, 0.14)},
    # Phần cánh tay còn sót lại sau khi cắt bằng khung xương.
    'arm_residual': {'waist': (0.0, 0.12), 'hip': (0.0, 0.10), 'chest': (0.0, 0.08)},
    # Chiều cao giờ là hậu nghiệm của prior nên sai số của nó lớn và hai phía.
    'height': (-0.10, 0.10),
    # Nhiễu đo chung: viền răng cưa, nghiêng người, phối cảnh.
    'measurement': (-0.05, 0.05),
}
FEATURE_INDEX = {'stature': 0, 'shoulder': 1, 'chest': 2, 'waist': 3, 'hip': 4}
SLACK_INDEX = 5
SCHEMA_VERSION = 3


def _serialized_size(model):
    import io
    import joblib
    buffer = io.BytesIO()
    joblib.dump(model, buffer)
    return int(buffer.tell())


def corrupt_features(features, rng, strength=1.0):
    """Sinh biến thể "giống ảnh" của một hàng số đo bằng thước.

    Một hệ số `slack` được bốc MỘT LẦN cho cả hàng rồi áp lên từng mốc theo mức
    tối đa của mốc đó, và chính hệ số ấy được ghi vào đặc trưng thứ sáu. Nhờ vậy
    model học "trừ bớt ĐÚNG phần được báo là quần áo", chứ không trừ mù.
    """
    import numpy as np

    noisy = np.array(features, dtype=float)
    noisy[FEATURE_INDEX['stature']] *= 1.0 + rng.uniform(*CORRUPTIONS['height']) * strength
    slack_level = rng.uniform(0.0, 1.0)
    for name, index in FEATURE_INDEX.items():
        if name == 'stature':
            continue
        slack = CORRUPTIONS['clothing_slack'].get(name)
        if slack:
            noisy[index] *= 1.0 + (slack[0] + (slack[1] - slack[0]) * slack_level) * strength
        arm = CORRUPTIONS['arm_residual'].get(name)
        if arm:
            noisy[index] *= 1.0 + rng.uniform(*arm) * strength
        noisy[index] *= 1.0 + rng.uniform(*CORRUPTIONS['measurement']) * strength
    # Độ rộng quần áo mà hệ thống ĐO ĐƯỢC, kèm sai số đo của chính phép đo đó.
    if noisy.size > SLACK_INDEX:
        observed = 1.0 + slack_level * CORRUPTIONS['clothing_slack']['waist'][1] * strength
        noisy[SLACK_INDEX] = max(1.0, observed * (1.0 + rng.uniform(-0.04, 0.04)))
    return noisy


def augment(x, y, rng, copies=4):
    import numpy as np
    xs, ys = [x], [y]
    for _ in range(copies):
        xs.append(np.array([corrupt_features(row, rng) for row in x]))
        ys.append(y)
    return np.concatenate(xs), np.concatenate(ys)


def train_target(rows, target, seed=17, robust=False, copies=4):
    """Train + so sánh vài họ model, trả model tốt nhất theo MAE trên tập test."""
    import numpy as np
    from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
    from sklearn.linear_model import RidgeCV
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
    from sklearn.model_selection import train_test_split
    from sklearn.neural_network import MLPRegressor
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    features = np.array([[r[f] for f in FEATURES] for r in rows])
    targets = np.array([r[target] for r in rows])
    sexes = np.array([r['sex'] for r in rows])
    # Mỗi hàng ANSUR là MỘT người đo đúng một lần, nên chia theo hàng đã là chia
    # theo danh tính. Quan trọng: chia TRƯỚC khi augment, để bản gốc và các bản
    # nhiễu của cùng một người không nằm ở hai phía.
    x_train, x_test, y_train, y_test, _, sex_test = train_test_split(
        features, targets, sexes, test_size=0.2, random_state=seed)
    rng = np.random.default_rng(seed)
    x_test_noisy = np.array([corrupt_features(row, rng) for row in x_test])
    if robust:
        x_train, y_train = augment(x_train, y_train, rng, copies)

    candidates = {
        'ridge': make_pipeline(StandardScaler(), RidgeCV()),
        # Giới hạn độ sâu/số cây: nhân 5 lần dữ liệu bằng augmentation làm rừng
        # không giới hạn phình lên 654MB, mà checkpoint đó phải nạp trong ngân
        # sách 2 giây của bước phân tích cơ thể.
        'random_forest': RandomForestRegressor(n_estimators=200, max_depth=14, min_samples_leaf=4,
                                               random_state=seed, n_jobs=-1),
        'gradient_boosting': GradientBoostingRegressor(random_state=seed),
        'mlp': make_pipeline(StandardScaler(),
                             MLPRegressor(hidden_layer_sizes=(96, 48), max_iter=3000, random_state=seed)),
    }
    results, best, candidates_scored = {}, None, []
    for name, model in candidates.items():
        model.fit(x_train, y_train)
        predicted = model.predict(x_test)
        noisy_predicted = model.predict(x_test_noisy)
        mae = float(mean_absolute_error(y_test, predicted))
        noisy_mae = float(mean_absolute_error(y_test, noisy_predicted))
        results[name] = {
            'mae': round(mae, 3),
            'rmse': round(float(np.sqrt(mean_squared_error(y_test, predicted))), 3),
            'r2': round(float(r2_score(y_test, predicted)), 4),
            # Sai số trên đầu vào ĐÃ LÀM NHIỄU GIỐNG ẢNH — đây mới là con số phản
            # ánh điều kiện chạy thật, `mae` ở trên là điều kiện phòng thí nghiệm.
            'maeCorrupted': round(noisy_mae, 3),
            'r2Corrupted': round(float(r2_score(y_test, noisy_predicted)), 4),
        }
        # Chọn model theo điều kiện chạy thật, không theo điều kiện lý tưởng.
        score = noisy_mae if robust else mae
        results[name]['checkpointBytes'] = _serialized_size(model)
        candidates_scored.append((name, score, model, predicted))

    # Trong số các model cách model tốt nhất dưới 3% MAE, lấy model NHẸ NHẤT.
    # Chênh lệch 0.16 kg không đáng đổi bằng một checkpoint 654MB phải nạp lại
    # mỗi lần tiến trình phân tích khởi động.
    floor = min(item[1] for item in candidates_scored)
    affordable = [item for item in candidates_scored if item[1] <= floor * 1.03]
    best = min(affordable, key=lambda item: results[item[0]]['checkpointBytes'])

    name, score, model, predicted = best
    # Sai số theo giới tính: model KHÔNG biết giới tính (ảnh không cho biết đáng
    # tin), nên phải công bố cái giá của việc đó.
    per_sex = {}
    for sex in ('F', 'M'):
        mask = sex_test == sex
        if mask.sum():
            per_sex[sex] = round(float(mean_absolute_error(y_test[mask], predicted[mask])), 3)
    return model, {
        'target': target, 'bestModel': name, 'candidates': results,
        'trainSamples': int(len(x_train)), 'testSamples': int(len(x_test)),
        'maePerSex': per_sex, 'featureOrder': FEATURES,
        'robustToImageNoise': bool(robust),
        'selectedBy': ('maeCorrupted' if robust else 'mae') + ' + nhỏ nhất trong ngưỡng 3%',
        'checkpointBytes': results[name]['checkpointBytes'],
        'augmentCopies': copies if robust else 0,
    }


def add_ratio_features(rows):
    """Thêm bề ngang/chiều cao và BMI vào từng hàng ANSUR."""
    for row in rows:
        stature = row['stature_cm']
        row['shoulder_ratio'] = row['shoulder_breadth_cm'] / stature
        row['chest_ratio'] = row['chest_breadth_cm'] / stature
        row['waist_ratio'] = row['waist_breadth_cm'] / stature
        row['hip_ratio'] = row['hip_breadth_cm'] / stature
        row.setdefault('clothing_slack', 1.0)
        row['bmi'] = row['weight_kg'] / (stature / 100.0) ** 2
    return rows


def corrupt_ratios(features, rng, strength=1.0):
    """Nhiễu cho đặc trưng tỉ lệ — cùng bộ nhiễu, bỏ thành phần chiều cao."""
    import numpy as np

    noisy = np.array(features, dtype=float)
    slack_level = rng.uniform(0.0, 1.0)
    for index, name in enumerate(('shoulder', 'chest', 'waist', 'hip')):
        slack = CORRUPTIONS['clothing_slack'].get(name)
        if slack:
            noisy[index] *= 1.0 + (slack[0] + (slack[1] - slack[0]) * slack_level) * strength
        arm = CORRUPTIONS['arm_residual'].get(name)
        if arm:
            noisy[index] *= 1.0 + rng.uniform(*arm) * strength
        noisy[index] *= 1.0 + rng.uniform(*CORRUPTIONS['measurement']) * strength
    if noisy.size > 4:
        observed = 1.0 + slack_level * CORRUPTIONS['clothing_slack']['waist'][1] * strength
        noisy[4] = max(1.0, observed * (1.0 + rng.uniform(-0.04, 0.04)))
    return noisy


def train_bmi(rows, seed=17, robust=True, copies=4):
    """BMI ← bốn tỉ lệ bề ngang/chiều cao. Không dùng chiều cao tuyệt đối."""
    import numpy as np
    from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
    from sklearn.linear_model import RidgeCV
    from sklearn.metrics import mean_absolute_error, r2_score
    from sklearn.model_selection import train_test_split
    from sklearn.neural_network import MLPRegressor
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    features = np.array([[row[name] for name in RATIO_FEATURES] for row in rows])
    targets = np.array([row['bmi'] for row in rows])
    x_train, x_test, y_train, y_test = train_test_split(
        features, targets, test_size=0.2, random_state=seed)
    rng = np.random.default_rng(seed)
    x_noisy = np.array([corrupt_ratios(row, rng) for row in x_test])
    if robust:
        extra = [np.array([corrupt_ratios(row, rng) for row in x_train]) for _ in range(copies)]
        x_train = np.concatenate([x_train, *extra])
        y_train = np.concatenate([y_train] * (copies + 1))

    candidates = {
        'ridge': make_pipeline(StandardScaler(), RidgeCV()),
        'random_forest': RandomForestRegressor(n_estimators=200, max_depth=14, min_samples_leaf=4,
                                               random_state=seed, n_jobs=-1),
        'gradient_boosting': GradientBoostingRegressor(random_state=seed),
        'mlp': make_pipeline(StandardScaler(),
                             MLPRegressor(hidden_layer_sizes=(64, 32), max_iter=2000, random_state=seed)),
    }
    results, scored = {}, []
    for name, model in candidates.items():
        model.fit(x_train, y_train)
        noisy_mae = float(mean_absolute_error(y_test, model.predict(x_noisy)))
        results[name] = {
            'mae': round(float(mean_absolute_error(y_test, model.predict(x_test))), 3),
            'maeCorrupted': round(noisy_mae, 3),
            'r2Corrupted': round(float(r2_score(y_test, model.predict(x_noisy))), 4),
            'checkpointBytes': _serialized_size(model),
        }
        scored.append((name, noisy_mae, model))
    floor = min(item[1] for item in scored)
    name, _, model = min([item for item in scored if item[1] <= floor * 1.03],
                         key=lambda item: results[item[0]]['checkpointBytes'])
    return model, {
        'target': 'bmi', 'bestModel': name, 'candidates': results,
        'featureOrder': RATIO_FEATURES, 'robustToImageNoise': bool(robust),
        'trainSamples': int(len(x_train)), 'testSamples': int(len(y_test)),
        'note': ('Đầu vào là TỈ LỆ đo trên pixel nên không kế thừa sai số của chiều cao '
                 'ước lượng. Nhân với (chiều cao/100)^2 để ra cân nặng.'),
    }


def checkpoint_metadata(seed, robust, copies):
    """Siêu dữ liệu bắt buộc đi kèm mọi checkpoint — để sau này còn truy được."""
    import hashlib
    import subprocess
    from datetime import datetime, timezone

    try:
        commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=str(ROOT),
                                capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception:
        commit = ''
    source = Path(__file__).read_bytes()
    return {
        'featureSchemaVersion': SCHEMA_VERSION,
        'featureOrder': FEATURES,
        'datasetVersion': 'ANSUR II Public (FEMALE+MALE CSV), CC0-1.0',
        'trainingSeed': seed,
        'robustToImageNoise': bool(robust),
        'augmentCopies': copies if robust else 0,
        'corruptions': CORRUPTIONS if robust else None,
        'trainedAt': datetime.now(timezone.utc).isoformat(),
        'codeCommit': commit,
        'trainerSha256': hashlib.sha256(source).hexdigest(),
    }


def sha256_of(path):
    import hashlib
    digest = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def train_ansur(args):
    import joblib

    rows = add_ratio_features(load_ansur())
    print(f'ANSUR II: {len(rows)} người ({sum(1 for r in rows if r["sex"] == "F")} nữ, '
          f'{sum(1 for r in rows if r["sex"] == "M")} nam)')

    anthro = fit_anthropometry(rows)
    MODELS.mkdir(parents=True, exist_ok=True)
    ANTHRO_JSON.write_text(json.dumps(anthro, ensure_ascii=False, indent=2), encoding='utf-8')
    print('\nTỉ lệ nhân trắc đã fit (thay hằng số 1966):')
    for name, stats in anthro['statureFractionFromTop'].items():
        print(f'  mốc {name:9} từ đỉnh đầu: {stats["mean"]:.4f} ± {stats["sd"]:.4f}')
    print('Tỉ lệ độ sâu / bề ngang (trước đây dùng chung 0.74):')
    for name, stats in anthro['depthOverBreadth'].items():
        print(f'  {name:6}: {stats["mean"]:.3f} ± {stats["sd"]:.3f}')

    metrics = {
        'source': anthro['source'],
        'sampleSize': len(rows),
        'populationCaveat': anthro['populationCaveat'],
        'metricNature': (
            'MAE đo trên ánh xạ SỐ ĐO VẬT LÝ → mục tiêu. KHÔNG bao gồm sai số của '
            'bước đo từ ảnh (pixel → cm). Không được trình bày như sai số end-to-end từ ảnh.'
        ),
        'models': {},
    }
    meta = checkpoint_metadata(args.seed, args.robust, args.augment_copies)
    metrics['checkpointMetadata'] = meta
    weight_model, weight_metrics = train_target(rows, 'weight_kg', args.seed, args.robust, args.augment_copies)
    metrics['models']['weight_kg'] = weight_metrics
    joblib.dump({'model': weight_model, 'features': FEATURES, 'metadata': meta,
                 'metrics': weight_metrics}, WEIGHT_MODEL)
    print(f'\nCân nặng — model tốt nhất: {weight_metrics["bestModel"]} '
          f'MAE {weight_metrics["candidates"][weight_metrics["bestModel"]]["mae"]} kg '
          f'(R² {weight_metrics["candidates"][weight_metrics["bestModel"]]["r2"]})')
    print(f'  MAE theo giới tính: {weight_metrics["maePerSex"]}')

    girth_models = {}
    for target in ('chest_circ_cm', 'waist_circ_cm', 'hip_circ_cm'):
        model, girth_metrics = train_target(rows, target, args.seed, args.robust, args.augment_copies)
        metrics['models'][target] = girth_metrics
        girth_models[target] = model
        best = girth_metrics['candidates'][girth_metrics['bestModel']]
        print(f'{target:14} — {girth_metrics["bestModel"]:18} MAE {best["mae"]:5.2f} cm  R² {best["r2"]}')
    joblib.dump({'models': girth_models, 'features': FEATURES, 'metadata': meta}, GIRTH_MODEL)

    bmi_model, bmi_metrics = train_bmi(rows, args.seed, args.robust, args.augment_copies)
    metrics['models']['bmi'] = bmi_metrics
    joblib.dump({'model': bmi_model, 'features': RATIO_FEATURES, 'metadata': meta,
                 'metrics': bmi_metrics}, BMI_MODEL)
    best_bmi = bmi_metrics['candidates'][bmi_metrics['bestModel']]
    print(f"bmi (tỉ lệ)    — {bmi_metrics['bestModel']:18} MAE {best_bmi['mae']:5.2f} "
          f"| nhiễu {best_bmi['maeCorrupted']:5.2f}")

    metrics['status'] = 'TRAINED'
    metrics['checkpoints'] = {
        'body_weight_estimator.joblib': {'sha256': sha256_of(WEIGHT_MODEL),
                                         'bytes': WEIGHT_MODEL.stat().st_size},
        'body_girth_estimators.joblib': {'sha256': sha256_of(GIRTH_MODEL),
                                         'bytes': GIRTH_MODEL.stat().st_size},
        'body_bmi_estimator.joblib': {'sha256': sha256_of(BMI_MODEL),
                                      'bytes': BMI_MODEL.stat().st_size},
    }
    out = Path(args.metrics_out) if args.metrics_out else METRICS_PATH
    out.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'\n-> {WEIGHT_MODEL}\n-> {GIRTH_MODEL}\n-> {ANTHRO_JSON}\n-> {METRICS_PATH}')
    return 0


def train_image(args):
    """Nhánh end-to-end từ ảnh — cần ảnh có nhãn thật, hiện chưa có."""
    labels = AI_TRAINING / 'body_dataset' / 'labels.csv'
    if not labels.exists():
        print('MODEL_NOT_TRAINED')
        print('Chưa có backend/ai_training/body_dataset/labels.csv (ảnh + chiều cao/cân nặng thật).')
        print('Đã tìm trên Kaggle: các bộ số đo cơ thể đều là CSV KHÔNG có ảnh người tương ứng,')
        print('nên không thể train ảnh→cân nặng mà không bịa dữ liệu.')
        return 1
    print('Có labels.csv — dùng quy trình trích đặc trưng từ ảnh.')
    return 0


def main():
    parser = argparse.ArgumentParser(description='Train bộ ước lượng vóc dáng')
    parser.add_argument('--ansur', action='store_true', help='Train trên ANSUR II (mặc định)')
    parser.add_argument('--image', action='store_true', help='Nhánh end-to-end từ ảnh có nhãn')
    parser.add_argument('--seed', type=int, default=17)
    parser.add_argument('--robust', action='store_true',
                        help='Train trên đặc trưng đã làm nhiễu giống ảnh (chọn model theo maeCorrupted)')
    parser.add_argument('--augment-copies', type=int, default=4)
    parser.add_argument('--metrics-out', default=None)
    parser.add_argument('--models-dir', default=None,
                        help='ghi checkpoint vào thư mục khác — dùng cho thí nghiệm ablation')
    parser.add_argument('--no-slack-feature', action='store_true',
                        help='bỏ đặc trưng clothing_slack (nhánh đối chứng)')
    args = parser.parse_args()
    if args.models_dir:
        global MODELS, WEIGHT_MODEL, GIRTH_MODEL, BMI_MODEL, ANTHRO_JSON, METRICS_PATH
        MODELS = Path(args.models_dir)
        MODELS.mkdir(parents=True, exist_ok=True)
        WEIGHT_MODEL = MODELS / 'body_weight_estimator.joblib'
        GIRTH_MODEL = MODELS / 'body_girth_estimators.joblib'
        BMI_MODEL = MODELS / 'body_bmi_estimator.joblib'
        ANTHRO_JSON = MODELS / 'anthropometry.json'
        METRICS_PATH = MODELS / 'body_estimator.metrics.json'
    if args.no_slack_feature:
        global FEATURES, RATIO_FEATURES
        FEATURES = [name for name in FEATURES if name != 'clothing_slack']
        RATIO_FEATURES = [name for name in RATIO_FEATURES if name != 'clothing_slack']
    if args.image:
        return train_image(args)
    return train_ansur(args)


if __name__ == '__main__':
    sys.exit(main())
