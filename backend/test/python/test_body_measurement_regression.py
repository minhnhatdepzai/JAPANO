"""Regression cho bước ĐO CƠ THỂ — những lỗi đã thật sự xảy ra trên máy thật.

Chạy:  python3 -m unittest discover -s backend/test/python -v

Mỗi bài ở đây tương ứng một chế độ hỏng đã quan sát được, không phải một tình
huống tưởng tượng. Ảnh gốc gây lỗi là người mẫu nữ gầy mặc áo đỏ, tay buông sát
thân, ảnh cắt ngang đùi: hệ thống trả 200-210cm, 110-120kg, vòng eo 150-160cm.

Test dựng mặt nạ tổng hợp thay vì đọc ảnh thật vì hai lý do: ảnh regression
không được commit vào repo, và mặt nạ tổng hợp cho phép điều khiển chính xác
từng biến (tay dính/không dính, cắt ở đâu, áo rộng bao nhiêu) để biết chắc bài
test đang đo cái gì.
"""

import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

BACKEND = Path(__file__).resolve().parents[2]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import body_analysis  # noqa: E402
import body_geometry  # noqa: E402
from body_analysis import (  # noqa: E402
    analyze_body, body_shape_ratios, estimate_height, estimate_weight,
    girth_plausibility, measure_body, pose_quality,
)

IMAGE_W, IMAGE_H = 900, 1400
VERTEX_Y = 40
STATURE_PX = 1300.0
CENTER_X = IMAGE_W // 2


def build_person(torso_half=95, arm_half=34, arm_gap=0, shoulder_joint_half=110,
                 hip_joint_half=70, crop_at=None, head_half=62):
    """Mặt nạ + pose của một người đứng thẳng, tay buông hai bên.

    `arm_gap=0` nghĩa là tay CHẠM thân — silhouette thành một dải liên tục, đúng
    tình huống đã làm hỏng phép đo eo trên ảnh thật.
    """
    mask = np.zeros((IMAGE_H, IMAGE_W), dtype=bool)
    shoulder_y = int(VERTEX_Y + STATURE_PX * 0.18)
    hip_y = int(VERTEX_Y + STATURE_PX * 0.485)
    knee_y = int(VERTEX_Y + STATURE_PX * 0.723)
    ankle_y = int(VERTEX_Y + STATURE_PX * 0.961)
    head_bottom = shoulder_y - 10

    mask[VERTEX_Y:head_bottom, CENTER_X - head_half:CENTER_X + head_half] = True
    mask[head_bottom:hip_y + 60, CENTER_X - torso_half:CENTER_X + torso_half] = True
    # Hai chân
    mask[hip_y + 60:ankle_y + 12, CENTER_X - torso_half:CENTER_X - 12] = True
    mask[hip_y + 60:ankle_y + 12, CENTER_X + 12:CENTER_X + torso_half] = True
    # Hai cánh tay: từ vai xuống quá hông một chút
    arm_top, arm_bottom = shoulder_y, hip_y + 40
    for sign in (-1, 1):
        inner = torso_half + arm_gap
        lo = CENTER_X + sign * (inner + (0 if sign > 0 else 2 * arm_half))
        hi = lo + 2 * arm_half
        mask[arm_top:arm_bottom, max(0, lo):min(IMAGE_W, hi)] = True

    if crop_at is not None:
        mask[crop_at:, :] = False

    keypoints = {
        'left_eye': [CENTER_X + 20, VERTEX_Y + 88, 0.95],
        'right_eye': [CENTER_X - 20, VERTEX_Y + 88, 0.95],
        'nose': [CENTER_X, VERTEX_Y + 112, 0.95],
        'left_shoulder': [CENTER_X + shoulder_joint_half, shoulder_y, 0.99],
        'right_shoulder': [CENTER_X - shoulder_joint_half, shoulder_y, 0.99],
        'left_elbow': [CENTER_X + torso_half + arm_gap + arm_half, shoulder_y + 220, 0.96],
        'right_elbow': [CENTER_X - torso_half - arm_gap - arm_half, shoulder_y + 220, 0.96],
        'left_wrist': [CENTER_X + torso_half + arm_gap + arm_half, hip_y + 30, 0.94],
        'right_wrist': [CENTER_X - torso_half - arm_gap - arm_half, hip_y + 30, 0.94],
        'left_hip': [CENTER_X + hip_joint_half, hip_y, 0.98],
        'right_hip': [CENTER_X - hip_joint_half, hip_y, 0.98],
        'left_knee': [CENTER_X + 45, knee_y, 0.95],
        'right_knee': [CENTER_X - 45, knee_y, 0.95],
        'left_ankle': [CENTER_X + 45, ankle_y, 0.92],
        'right_ankle': [CENTER_X - 45, ankle_y, 0.92],
    }
    if crop_at is not None:
        for name, point in list(keypoints.items()):
            if point[1] >= crop_at:
                # YOLO vẫn xuất khớp bị cắt, nhưng đẩy nó ra sát mép ảnh và hạ
                # độ tin cậy — chính xác điều đã xảy ra với hai đầu gối của ảnh
                # áo đỏ (y=1303/1319 trên ảnh cao 1320, conf 0.25/0.32).
                keypoints[name] = [point[0], min(crop_at - 1, IMAGE_H - 3), 0.28]
    pose = {
        'box': [CENTER_X - 220, VERTEX_Y, CENTER_X + 220,
                min(IMAGE_H - 1, crop_at or ankle_y + 20)],
        'keypoints': keypoints,
        'confidence': 0.93,
        'fallback': False,
        'inferredKeypoints': [],
    }
    return mask, pose


class TorsoSeparationTest(unittest.TestCase):
    """Bề ngang eo/hông không được bao gồm hai cánh tay."""

    def setUp(self):
        self.image = Image.new('RGB', (IMAGE_W, IMAGE_H), 'white')
        self._original = body_analysis.person_mask

    def tearDown(self):
        body_analysis.person_mask = self._original

    def measure(self, **kwargs):
        mask, pose = build_person(**kwargs)
        body_analysis.person_mask = lambda image, box=None, m=mask: m
        return measure_body(self.image, pose), pose

    def test_tay_buong_sat_than_khong_bi_tinh_vao_vong_eo(self):
        """Lỗi gốc: tay dính thân -> eo 497px trong khi hai khớp hông cách 214px."""
        touching, _ = self.measure(arm_gap=0)
        separated, _ = self.measure(arm_gap=40)
        raw = touching['torsoProfile']['waist']['rawSilhouettePx']
        carved = touching['waistPx']
        # Viền thô đúng là gồm cả hai tay...
        self.assertGreater(raw, carved * 1.3)
        # ...nhưng bề ngang thân đã cắt tay phải khớp với trường hợp tay dang ra.
        self.assertLess(abs(carved - separated['waistPx']) / separated['waistPx'], 0.20)
        self.assertTrue(touching['armsMergedIntoTorso'])

    def test_vong_eo_khong_rong_hon_muc_giai_phau_cho_phep(self):
        measure, _ = self.measure(arm_gap=0)
        hip_joint = measure['hipJointSpanPx']
        self.assertGreater(hip_joint, 0)
        # Ảnh thật từng cho eo/khoảng-cách-khớp-hông = 2.32. Giới hạn giải phẫu
        # suy từ ANSUR II (kể cả người BMI 43) thấp hơn hẳn mức đó.
        self.assertLess(measure['waistPx'] / hip_joint, 2.2)

    def test_tay_chong_hong_khong_lam_than_bi_do_hut(self):
        """Tay chống hông: khuỷu bạnh ra ngoài, cổ tay quay vào sát eo."""
        mask, pose = build_person(arm_gap=0)
        hip_y = pose['keypoints']['left_hip'][1]
        for side, sign in (('left', 1), ('right', -1)):
            pose['keypoints'][f'{side}_elbow'] = [CENTER_X + sign * 210, hip_y - 120, 0.95]
            pose['keypoints'][f'{side}_wrist'] = [CENTER_X + sign * 100, hip_y - 10, 0.93]
        body_analysis.person_mask = lambda image, box=None, m=mask: m
        measure = measure_body(self.image, pose)
        straight, _ = self.measure(arm_gap=0)
        # Cổ tay nằm sát eo không được kéo hai mép thân ép vào nhau.
        self.assertGreater(measure['waistPx'], straight['waistPx'] * 0.6)
        self.assertGreater(measure['waistPx'], 0)

    def test_nguoi_rat_map_khong_bi_kep_xuong_dang_gay(self):
        if body_geometry.CALIBRATION.get('source') == 'builtin-fallback':
            self.skipTest('thiếu body_geometry.calibration.json để kiểm dải người rất rộng')
        slim, _ = self.measure(torso_half=80, arm_gap=0)
        heavy, _ = self.measure(torso_half=190, arm_gap=0)
        self.assertGreater(heavy['waistPx'], slim['waistPx'] * 1.6)
        self.assertGreater(heavy['hipPx'], slim['hipPx'] * 1.3)

    def test_ao_rong_duoc_phat_hien_va_bao(self):
        fitted, _ = self.measure(torso_half=95, arm_gap=0)
        oversized, _ = self.measure(torso_half=160, arm_gap=0)
        self.assertGreater(oversized['clothingSlack'], fitted['clothingSlack'])


class CroppedImageTest(unittest.TestCase):
    """Ảnh cắt ngang đùi không được ngoại suy chiều cao từ khớp đã bị cắt."""

    def setUp(self):
        self.image = Image.new('RGB', (IMAGE_W, IMAGE_H), 'white')
        self._original = body_analysis.person_mask

    def tearDown(self):
        body_analysis.person_mask = self._original

    def test_khop_sat_mep_anh_bi_loai_khoi_moc_do(self):
        # Cắt ở 900px: dưới hông (671) nhưng trên đầu gối (980), đúng kiểu ảnh
        # regression áo đỏ vốn cắt ngang đùi.
        mask, pose = build_person(crop_at=900)
        body_analysis.person_mask = lambda image, box=None, m=mask: m
        measure = measure_body(self.image, pose)
        # Đầu gối bị cắt -> không được coi là "nhìn thấy đầu gối".
        self.assertIn(measure['coverage'], ('hip', 'shoulder', 'partial'))
        self.assertFalse(measure['feetVisible'])

    def test_chieu_cao_khong_bao_gio_vuot_nguong_hop_ly(self):
        for crop in (None, 1200, 1000, 900, 820):
            mask, pose = build_person(crop_at=crop)
            body_analysis.person_mask = lambda image, box=None, m=mask: m
            measure = measure_body(self.image, pose)
            quality = pose_quality(pose, measure)
            height = estimate_height(measure, quality)
            if height['valueCm'] is None:
                continue
            self.assertLessEqual(height['valueCm'], body_analysis.HEIGHT_PLAUSIBLE_CM[1],
                                 f'crop={crop} cho chiều cao phi lý')
            self.assertGreaterEqual(height['valueCm'], body_analysis.HEIGHT_PLAUSIBLE_CM[0])
            # Ảnh regression áo đỏ từng rơi vào đúng bin 200-210.
            self.assertLess(height['maxCm'], 200, f'crop={crop} vẫn trả bin >= 200cm')


class DisplayContractTest(unittest.TestCase):
    """Hợp đồng hiển thị: mọi khoảng đưa lên UI rộng đúng 10 đơn vị."""

    def setUp(self):
        self.image = Image.new('RGB', (IMAGE_W, IMAGE_H), 'white')
        self._original = body_analysis.person_mask
        mask, self.pose = build_person(arm_gap=0)
        body_analysis.person_mask = lambda image, box=None, m=mask: m

    def tearDown(self):
        body_analysis.person_mask = self._original

    def test_moi_khoang_hien_thi_rong_dung_10(self):
        result = analyze_body(self.image, self.pose)
        height, weight = result['estimatedHeight'], result['estimatedWeight']
        if height['valueCm'] is not None:
            display_min, display_max = height['displayBinCm']
            self.assertEqual(display_max - display_min, 10)
            self.assertGreaterEqual(height['valueCm'], display_min)
            self.assertLessEqual(height['valueCm'], display_max)
            self.assertGreaterEqual(height['valueCm'], height['minCm'])
            self.assertLessEqual(height['valueCm'], height['maxCm'])
        if weight['valueKg'] is not None:
            display_min, display_max = weight['displayBinKg']
            self.assertEqual(display_max - display_min, 10)
            self.assertGreaterEqual(weight['valueKg'], display_min)
            self.assertLessEqual(weight['valueKg'], display_max)
            self.assertGreaterEqual(weight['valueKg'], weight['minKg'])
            self.assertLessEqual(weight['valueKg'], weight['maxKg'])
        for name, entry in (result['estimatedGirthRanges'] or {}).items():
            display_min, display_max = entry['displayBinCm']
            self.assertEqual(display_max - display_min, 10, f'{name} không phải bin 10cm')
            self.assertGreaterEqual(entry['valueCm'], display_min, name)
            self.assertLessEqual(entry['valueCm'], display_max, name)
            self.assertGreaterEqual(entry['valueCm'], entry['minCm'], name)
            self.assertLessEqual(entry['valueCm'], entry['maxCm'], name)

    def test_so_do_nguoi_dung_nhap_luon_thang_uoc_luong(self):
        result = analyze_body(self.image, self.pose, user_height_cm=158, user_weight_kg=47)
        self.assertEqual(result['estimatedHeight']['valueCm'], 158)
        self.assertEqual(result['estimatedHeight']['source'], 'user_provided')
        self.assertEqual(result['estimatedHeight']['confidence'], 1.0)
        self.assertEqual(result['estimatedWeight']['valueKg'], 47)
        self.assertEqual(result['estimatedWeight']['source'], 'user_provided')

    def test_anh_moi_khong_ke_thua_so_do_anh_cu(self):
        """analyze_body là hàm thuần trên ảnh — không có state giữa hai lượt."""
        slim_mask, slim_pose = build_person(torso_half=80, arm_gap=0)
        wide_mask, wide_pose = build_person(torso_half=185, arm_gap=0)
        body_analysis.person_mask = lambda image, box=None, m=slim_mask: m
        first = analyze_body(self.image, slim_pose)
        body_analysis.person_mask = lambda image, box=None, m=wide_mask: m
        second = analyze_body(self.image, wide_pose)
        body_analysis.person_mask = lambda image, box=None, m=slim_mask: m
        third = analyze_body(self.image, slim_pose)
        self.assertNotEqual(first['pixels']['waistPx'], second['pixels']['waistPx'])
        # Quay lại ảnh đầu phải cho đúng số của ảnh đầu, không phải số ảnh giữa.
        self.assertEqual(first['pixels']['waistPx'], third['pixels']['waistPx'])


class PlausibilityGateTest(unittest.TestCase):
    """Chốt chặn giải phẫu trên đầu ra."""

    def test_vong_do_bat_kha_thi_bi_loai(self):
        kept, rejected = girth_plausibility({'bust': 130.0, 'waist': 155.0, 'hip': 57.0}, 168.0)
        self.assertIn('hip', rejected)
        self.assertNotIn('hip', kept)

    def test_vong_do_hop_ly_duoc_giu(self):
        kept, rejected = girth_plausibility({'bust': 88.0, 'waist': 70.0, 'hip': 94.0}, 165.0)
        self.assertEqual(rejected, {})
        self.assertEqual(set(kept), {'bust', 'waist', 'hip'})

    def test_vong_lon_hon_chieu_cao_bi_loai(self):
        kept, rejected = girth_plausibility({'bust': 160.0}, 160.0)
        self.assertIn('bust', rejected)

    def test_can_nang_ngoai_dai_bmi_bi_loai(self):
        # 120kg ở 168cm là BMI 42.5 — hiếm nhưng có thật, phải đi qua được.
        self.assertTrue(body_analysis.weight_plausibility(120.0, 168.0)[0])
        # 160kg ở 168cm là BMI 56.7 — vượt mọi dải người trưởng thành.
        ok, reason = body_analysis.weight_plausibility(160.0, 168.0)
        self.assertFalse(ok)
        self.assertIn('BMI', reason)
        self.assertTrue(body_analysis.weight_plausibility(58.0, 168.0)[0])


class CalibrationContractTest(unittest.TestCase):
    """Calibration phải nạp được và mang đủ nguồn gốc."""

    def test_calibration_da_fit_tren_du_lieu_that(self):
        calibration = body_geometry.reload_calibration()
        if calibration.get('source') == 'builtin-fallback':
            self.skipTest('artifact body_geometry.calibration.json không có trong checkout')
        self.assertNotEqual(calibration.get('source'), 'builtin-fallback')
        self.assertGreater(calibration.get('trainRecords', 0), 1000)
        for level in ('shoulder', 'chest', 'waist', 'hip'):
            self.assertIn(level, calibration['torsoOverJoint'])
            self.assertIn(level, calibration['gateLimits'])

    def test_gioi_han_gate_du_rong_cho_nguoi_beo(self):
        # Giới hạn suy từ ANSUR II phải bao được người có bề ngang eo gấp 1.4
        # lần khoảng cách hai khớp vai — VITON-HD một mình chỉ cho tới 1.26.
        if body_geometry.CALIBRATION.get('source') == 'builtin-fallback':
            self.skipTest('artifact body_geometry.calibration.json không có trong checkout')
        limits = body_geometry.CALIBRATION['gateLimits']['waist']
        self.assertGreater(limits['high'], 1.4)


if __name__ == '__main__':
    unittest.main()


class SubjectSelectionTest(unittest.TestCase):
    """Ảnh nhiều người: phân tích/thử đồ đúng MỘT người ở tâm ảnh."""

    @staticmethod
    @staticmethod
    def select(boxes, confidences, core_confidences=None, size=(1000, 1000)):
        from accessory_pipeline import select_center_subject
        import numpy as np

        point_conf = np.zeros((len(boxes), 17), dtype=float)
        for index, confidence in enumerate(core_confidences or confidences):
            point_conf[index, [5, 6, 11, 12]] = confidence
        return select_center_subject(
            np.asarray(boxes, dtype=float), np.asarray(confidences, dtype=float),
            point_conf, size[0], size[1],
        )

    def test_nguoi_o_tam_thang_nguoi_to_o_ria(self):
        boxes = [(0, 0, 470, 1000), (430, 280, 570, 760)]
        selected, _ = self.select(boxes, [.95, .82])
        self.assertEqual(selected, 1)

    def test_chi_chon_mot_nguoi_o_tam_trong_anh_nhom(self):
        boxes = [(40, 180, 260, 900), (390, 120, 610, 920), (740, 170, 960, 900)]
        selected, _ = self.select(boxes, [.91, .88, .93])
        self.assertEqual(selected, 1)

    def test_nhan_dien_gia_o_tam_bi_loai_khi_khong_co_khop_than(self):
        boxes = [(420, 80, 580, 950), (120, 120, 380, 940)]
        selected, _ = self.select(
            boxes, [.18, .86], core_confidences=[0.0, .80],
        )
        self.assertEqual(selected, 1)

    def test_nguoi_o_tam_confidence_thap_nhung_khop_than_ro_van_duoc_chon(self):
        boxes = [(430, 150, 570, 900), (30, 80, 390, 960)]
        selected, _ = self.select(
            boxes, [.19, .91], core_confidences=[.82, .88],
        )
        self.assertEqual(selected, 0)

    def test_cum_hoa_cao_khong_duoc_thang_nguoi_that_pose_ro(self):
        """Ca Redmi thật: cổng hoa bị YOLO hiểu nhầm thành một người rất cao."""
        size = (1536, 2048)
        person = (558.0, 853.8, 908.9, 2007.8)
        flower_arch = (1188.2, 329.2, 1535.9, 2010.7)
        selected, _ = self.select(
            [person, flower_arch], [.893, .193], core_confidences=[.82, 0.0], size=size,
        )
        self.assertEqual(selected, 0)


class SubjectIsolationTest(unittest.TestCase):
    def test_anh_nhom_chi_giu_nguoi_chinh(self):
        from accessory_pipeline import isolate_primary_subject

        image = Image.new('RGB', (300, 400), (20, 120, 80))
        draw = ImageDraw.Draw(image)
        draw.rectangle((10, 80, 80, 380), fill=(240, 40, 40))
        draw.rectangle((110, 40, 190, 390), fill=(40, 80, 240))
        draw.rectangle((220, 70, 290, 380), fill=(240, 220, 40))
        mask = np.zeros((400, 300), dtype=bool)
        mask[40:391, 110:191] = True

        isolated, info = isolate_primary_subject(
            image, (110, 40, 190, 390), [(10, 80, 80, 380), (220, 70, 290, 380)],
            subject_mask=mask,
        )
        self.assertTrue(info['applied'])
        self.assertEqual(info['removedPeople'], 2)
        self.assertEqual(isolated.getpixel((150, 200)), (40, 80, 240))
        self.assertNotEqual(isolated.getpixel((40, 200)), (240, 40, 40))
        self.assertNotEqual(isolated.getpixel((250, 200)), (240, 220, 40))

class CutOffRowTest(unittest.TestCase):
    """Ảnh cắt ngay tại hàng đo: phải trả null, không phải một con số sai."""

    def setUp(self):
        self.image = Image.new('RGB', (IMAGE_W, IMAGE_H), 'white')
        self._original = body_analysis.person_mask

    def tearDown(self):
        body_analysis.person_mask = self._original

    def analyze(self, crop_at=None):
        mask, pose = build_person(arm_gap=0, crop_at=crop_at)
        body_analysis.person_mask = lambda image, box=None, m=mask: m
        return analyze_body(self.image, pose)

    def test_vong_do_o_hang_bi_cat_tra_null(self):
        """Cắt ngang hông thì vòng hông KHÔNG được có giá trị."""
        cropped = self.analyze(crop_at=760)
        cut = cropped.get('measurementRowsCutOff') or []
        if not cut:
            self.skipTest('mặt nạ tổng hợp không rơi vào ca hàng đo sát mép')
        for name in cut:
            key = {'chest': 'bust', 'waist': 'waist', 'hip': 'hip'}[name]
            self.assertIsNone((cropped.get('estimatedGirthRanges') or {}).get(key),
                              f'{key} phải là null khi hàng đo bị cắt')
            self.assertIn(key, cropped.get('rejectedGirths') or {})

    def test_can_nang_khong_duoc_suy_tu_hang_bi_cat(self):
        cropped = self.analyze(crop_at=760)
        if not (cropped.get('measurementRowsCutOff') or []):
            self.skipTest('mặt nạ tổng hợp không rơi vào ca hàng đo sát mép')
        weight = cropped['estimatedWeight']
        self.assertIsNone(weight['valueKg'],
                          'ảnh cắt tại hàng đo thì thà nói chưa đo được còn hơn trả số sai')
        self.assertFalse(weight.get('usableForSizing'))
        self.assertIn('unusableReason', weight)

    def test_anh_du_nguoi_van_ra_so_binh_thuong(self):
        """Chốt chặn mới không được làm hỏng ảnh bình thường."""
        full = self.analyze(crop_at=None)
        self.assertEqual(full.get('measurementRowsCutOff'), None)
        self.assertIsNotNone(full['estimatedWeight']['valueKg'])
