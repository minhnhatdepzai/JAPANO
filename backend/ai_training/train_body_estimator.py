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
ANTHRO_JSON = MODELS / 'anthropometry.json'
METRICS_PATH = MODELS / 'body_estimator.metrics.json'

# Ảnh chính diện chỉ đo được BỀ NGANG và chiều cao. Đặc trưng của model vì vậy
# chỉ gồm đúng những đại lượng đó — không dùng vòng đo hay độ sâu làm đầu vào,
# vì lúc suy luận sẽ không có chúng.
FEATURES = ['stature_cm', 'shoulder_breadth_cm', 'chest_breadth_cm',
            'waist_breadth_cm', 'hip_breadth_cm']
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


def train_target(rows, target, seed=17):
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
    x_train, x_test, y_train, y_test, _, sex_test = train_test_split(
        features, targets, sexes, test_size=0.2, random_state=seed)

    candidates = {
        'ridge': make_pipeline(StandardScaler(), RidgeCV()),
        'random_forest': RandomForestRegressor(n_estimators=300, random_state=seed, n_jobs=-1),
        'gradient_boosting': GradientBoostingRegressor(random_state=seed),
        'mlp': make_pipeline(StandardScaler(),
                             MLPRegressor(hidden_layer_sizes=(96, 48), max_iter=3000, random_state=seed)),
    }
    results, best = {}, None
    for name, model in candidates.items():
        model.fit(x_train, y_train)
        predicted = model.predict(x_test)
        mae = float(mean_absolute_error(y_test, predicted))
        results[name] = {
            'mae': round(mae, 3),
            'rmse': round(float(np.sqrt(mean_squared_error(y_test, predicted))), 3),
            'r2': round(float(r2_score(y_test, predicted)), 4),
        }
        if best is None or mae < best[1]:
            best = (name, mae, model, predicted)

    name, mae, model, predicted = best
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
    }


def train_ansur(args):
    import joblib

    rows = load_ansur()
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
    weight_model, weight_metrics = train_target(rows, 'weight_kg', args.seed)
    metrics['models']['weight_kg'] = weight_metrics
    joblib.dump({'model': weight_model, 'features': FEATURES}, WEIGHT_MODEL)
    print(f'\nCân nặng — model tốt nhất: {weight_metrics["bestModel"]} '
          f'MAE {weight_metrics["candidates"][weight_metrics["bestModel"]]["mae"]} kg '
          f'(R² {weight_metrics["candidates"][weight_metrics["bestModel"]]["r2"]})')
    print(f'  MAE theo giới tính: {weight_metrics["maePerSex"]}')

    girth_models = {}
    for target in ('chest_circ_cm', 'waist_circ_cm', 'hip_circ_cm'):
        model, girth_metrics = train_target(rows, target, args.seed)
        metrics['models'][target] = girth_metrics
        girth_models[target] = model
        best = girth_metrics['candidates'][girth_metrics['bestModel']]
        print(f'{target:14} — {girth_metrics["bestModel"]:18} MAE {best["mae"]:5.2f} cm  R² {best["r2"]}')
    joblib.dump({'models': girth_models, 'features': FEATURES}, GIRTH_MODEL)

    metrics['status'] = 'TRAINED'
    METRICS_PATH.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding='utf-8')
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
    args = parser.parse_args()
    if args.image:
        return train_image(args)
    return train_ansur(args)


if __name__ == '__main__':
    sys.exit(main())
