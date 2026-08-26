"""Kiểm thử bộ ước lượng vóc dáng (backend/body_analysis.py).

Chạy:  python3 -m unittest discover -s backend/test/python -v

Không cần ảnh thật và không nạp model: bài test dựng một "người" tổng hợp có
tỉ lệ nhân trắc đã biết trước, thay hàm tách nền bằng mặt nạ tổng hợp đó, rồi
kiểm tra xem chuỗi suy luận có trả về đúng thứ nó hứa hay không — kể cả việc
TỪ CHỐI trả kết quả khi dữ liệu quá yếu.
"""

import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

BACKEND = Path(__file__).resolve().parents[2]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import body_analysis  # noqa: E402
from body_analysis import (  # noqa: E402
    analyze_body, body_shape_ratios, estimate_height, estimate_weight,
    measure_body, pose_quality, _row_runs,
)

# --- Người tổng hợp: cao 900px trên ảnh 1000px, tỉ lệ 7.5 đầu ----------------
VERTEX_Y = 50
STATURE_PX = 900
IMAGE_SIZE = (700, 1000)
HEAD_PX = STATURE_PX / 7.5  # người mẫu tổng hợp cao đúng 7.5 lần chiều dài đầu
EXPECTED_HEIGHT_CM = 7.5 * body_analysis.HEAD_LENGTH_CM


def synthetic_pose(with_ankles=True, confidence=0.9):
    def y_at(fraction):
        return VERTEX_Y + STATURE_PX * fraction

    center = IMAGE_SIZE[0] / 2
    eye_y = VERTEX_Y + HEAD_PX * body_analysis.VERTEX_TO_EYE_RATIO
    keypoints = {
        'left_eye': [center - 18, eye_y, 0.9],
        'right_eye': [center + 18, eye_y, 0.9],
        'nose': [center, VERTEX_Y + HEAD_PX * 0.63, 0.9],
        'left_shoulder': [center - 62, y_at(0.182), 0.9],
        'right_shoulder': [center + 62, y_at(0.182), 0.9],
        'left_hip': [center - 42, y_at(0.470), 0.9],
        'right_hip': [center + 42, y_at(0.470), 0.9],
        'left_knee': [center - 40, y_at(0.715), 0.85],
        'right_knee': [center + 40, y_at(0.715), 0.85],
    }
    if with_ankles:
        keypoints['left_ankle'] = [center - 40, y_at(0.961), 0.8]
        keypoints['right_ankle'] = [center + 40, y_at(0.961), 0.8]
    return {
        'box': [center - 110, VERTEX_Y, center + 110, VERTEX_Y + STATURE_PX],
        'keypoints': keypoints,
        'confidence': confidence,
        'fallback': False,
        'otherBoxes': [],
    }


def synthetic_mask(torso_width=150, head_width=110, leg_width=70, arm_width=34):
    """Mặt nạ hình người: đầu, thân, HAI TAY rời và hai chân.

    Hai tay được vẽ tách khỏi thân (có khe hở) để bài test đi qua đúng nhánh
    tách nhiều đoạn trên một hàng — nhánh quyết định việc tay được tính bằng
    tiết diện tròn thay vì tiết diện dẹt của thân.
    """
    width, height = IMAGE_SIZE
    mask = np.zeros((height, width), dtype=bool)
    center = width // 2
    shoulder_y = int(VERTEX_Y + STATURE_PX * 0.182)
    hip_y = int(VERTEX_Y + STATURE_PX * 0.470)
    ankle_y = int(VERTEX_Y + STATURE_PX * 0.961)
    wrist_y = int(VERTEX_Y + STATURE_PX * 0.485)

    mask[VERTEX_Y:shoulder_y, center - head_width // 2:center + head_width // 2] = True
    mask[shoulder_y:hip_y, center - torso_width // 2:center + torso_width // 2] = True
    for offset in (-1, 1):
        arm_center = center + offset * (torso_width // 2 + arm_width)
        mask[shoulder_y:wrist_y, arm_center - arm_width // 2:arm_center + arm_width // 2] = True
        leg_center = center + offset * (torso_width // 4)
        mask[hip_y:ankle_y, leg_center - leg_width // 2:leg_center + leg_width // 2] = True
    return mask


class BodyAnalysisTest(unittest.TestCase):
    def setUp(self):
        self.image = Image.new('RGB', IMAGE_SIZE, (240, 240, 240))
        self.pose = synthetic_pose()
        self._original_mask_fn = body_analysis.person_mask
        self.mask = synthetic_mask()
        body_analysis.person_mask = lambda image, box=None: self.mask

    def tearDown(self):
        body_analysis.person_mask = self._original_mask_fn

    def test_row_runs_tach_dung_cac_doan_lien_tuc(self):
        row = np.array([0, 1, 1, 0, 0, 1, 1, 1, 0], dtype=bool)
        self.assertEqual(_row_runs(row), [(1, 2), (5, 7)])
        self.assertEqual(_row_runs(np.zeros(5, dtype=bool)), [])

    def test_do_dung_chieu_cao_pixel_va_chieu_dai_dau(self):
        measure = measure_body(self.image, self.pose)
        self.assertAlmostEqual(measure['staturePx'], STATURE_PX, delta=6)
        self.assertAlmostEqual(measure['headPx'], HEAD_PX, delta=6)
        self.assertEqual(measure['coverage'], 'full')
        self.assertTrue(measure['feetVisible'])

    def test_mode_a_uoc_luong_chieu_cao_theo_chieu_dai_dau(self):
        measure = measure_body(self.image, self.pose)
        quality = pose_quality(self.pose, measure)
        height = estimate_height(measure, quality)
        self.assertEqual(height['mode'], 'A')
        # 7.5 đầu * chiều dài đầu chuẩn, cho phép sai số của phép đo pixel.
        self.assertAlmostEqual(height['valueCm'], EXPECTED_HEIGHT_CM, delta=4.0)
        # Luôn trả về KHOẢNG, và khoảng phải thật sự bao quanh giá trị.
        self.assertLess(height['minCm'], height['valueCm'])
        self.assertGreater(height['maxCm'], height['valueCm'])
        self.assertGreater(height['confidence'], 0.35)

    def test_mode_b_uu_tien_chieu_cao_nguoi_dung_nhap(self):
        measure = measure_body(self.image, self.pose)
        quality = pose_quality(self.pose, measure)
        height = estimate_height(measure, quality, user_height_cm=163)
        self.assertEqual(height['mode'], 'B')
        self.assertEqual(height['valueCm'], 163)
        self.assertEqual(height['confidence'], 1.0)
        self.assertEqual(height['source'], 'user_provided')

    def test_mode_b_vat_chuan_trong_anh(self):
        measure = measure_body(self.image, self.pose)
        quality = pose_quality(self.pose, measure)
        # Vật chuẩn dài 30cm chiếm 150px -> 5 px/cm -> 900px ≈ 180cm.
        height = estimate_height(measure, quality, reference={'pixelLength': 150, 'realLengthCm': 30})
        self.assertEqual(height['source'], 'reference_object')
        self.assertAlmostEqual(height['valueCm'], 180.0, delta=1.0)

    def test_khong_du_du_lieu_thi_tra_none_thay_vi_bia_so(self):
        weak_pose = synthetic_pose(with_ankles=False, confidence=0.05)
        weak_pose['keypoints'].pop('left_eye')
        weak_pose['keypoints'].pop('right_eye')
        weak_pose['keypoints'].pop('nose')
        weak_pose['fallback'] = True
        measure = measure_body(self.image, weak_pose)
        quality = pose_quality(weak_pose, measure)
        height = estimate_height(measure, quality)
        self.assertIsNone(height['valueCm'])
        self.assertIsNone(height['minCm'])
        weight = estimate_weight(measure, body_shape_ratios(measure), height, quality)
        self.assertIsNone(weight['valueKg'])
        # Ảnh yếu này vừa mất mốc bàn chân vừa mất khớp mặt: cả hai lý do đều
        # dẫn tới từ chối, miễn là KHÔNG trả về một con số bịa.
        self.assertIn(weight['model'], {'insufficient_data', 'partial_body_not_measurable'})
        self.assertLessEqual(weight['confidence'], 0.35)

    def test_anh_khong_thay_ban_chan_thi_khong_uoc_luong_can_nang(self):
        # Không thể cân một cơ thể chỉ nhìn thấy một nửa — dù tư thế rất rõ nét.
        cropped = synthetic_pose(with_ankles=True)
        cropped['keypoints'].pop('left_ankle')
        cropped['keypoints'].pop('right_ankle')
        measure = measure_body(self.image, cropped)
        self.assertEqual(measure['coverage'], 'knee')
        quality = pose_quality(cropped, measure)
        height = estimate_height(measure, quality, user_height_cm=170)
        weight = estimate_weight(measure, body_shape_ratios(measure), height, quality)
        self.assertIsNone(weight['valueKg'])
        self.assertEqual(weight['model'], 'partial_body_not_measurable')

    def test_can_nang_tra_ve_khoang_hop_ly(self):
        measure = measure_body(self.image, self.pose)
        shape = body_shape_ratios(measure)
        quality = pose_quality(self.pose, measure)
        height = estimate_height(measure, quality)
        weight = estimate_weight(measure, shape, height, quality)
        self.assertIsNotNone(weight['valueKg'])
        self.assertLess(weight['minKg'], weight['valueKg'])
        self.assertGreater(weight['maxKg'], weight['valueKg'])
        bmi = weight['valueKg'] / (height['valueCm'] / 100) ** 2
        self.assertGreater(bmi, 14)
        self.assertLess(bmi, 45)

    def test_nguoi_ro_hon_thi_can_nang_uoc_luong_cao_hon(self):
        thin = synthetic_mask(torso_width=120, head_width=100, leg_width=55)
        wide = synthetic_mask(torso_width=230, head_width=120, leg_width=95)
        results = []
        for mask in (thin, wide):
            body_analysis.person_mask = lambda image, box=None, m=mask: m
            measure = measure_body(self.image, self.pose)
            shape = body_shape_ratios(measure)
            quality = pose_quality(self.pose, measure)
            height = estimate_height(measure, quality, user_height_cm=170)
            results.append(estimate_weight(measure, shape, height, quality)['valueKg'])
        self.assertLess(results[0], results[1])

    def test_can_nang_nguoi_dung_nhap_luon_thang_uoc_luong(self):
        measure = measure_body(self.image, self.pose)
        shape = body_shape_ratios(measure)
        quality = pose_quality(self.pose, measure)
        height = estimate_height(measure, quality, user_height_cm=170)
        weight = estimate_weight(measure, shape, height, quality, user_weight_kg=65)
        self.assertEqual(weight['valueKg'], 65)
        self.assertEqual(weight['source'], 'user_provided')

    def test_vong_do_tu_anh_duoc_danh_dau_la_do_quan_ao(self):
        # Silhouette của người mặc quần áo là silhouette của quần áo — kết quả
        # phải nói rõ điều đó để không ai đem số này đi chốt size.
        result = analyze_body(self.image, self.pose)
        self.assertTrue(result['girthsMeasureClothing'])

    def test_analyze_body_tra_du_cau_truc_cho_api(self):
        result = analyze_body(self.image, self.pose)
        self.assertTrue(result['ok'])
        for key in ('bodyShape', 'estimatedHeight', 'estimatedWeight', 'quality', 'warnings'):
            self.assertIn(key, result)
        self.assertIn('bodyWidthRatio', result['bodyShape'])
        self.assertIn('poseConfidence', result['quality'])
        self.assertTrue(any('sai số' in warning for warning in result['warnings']))
        # Vòng đo suy từ silhouette là đầu vào cho bảng size.
        self.assertIn('bust', result['estimatedGirths'])


if __name__ == '__main__':
    unittest.main()
