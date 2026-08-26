"""Kiểm thử cổng độ che phủ — phần an toàn của thử đồ hở da.

Chạy:  python3 -m unittest discover -s backend/test/python -v

Dùng ảnh tổng hợp có kiểm soát (vẽ bằng PIL) thay vì ảnh người thật: bài test
cần biết CHÍNH XÁC vùng nào là da và vùng nào là vải để khẳng định cổng phản
ứng đúng, và không được đưa ảnh người thật vào repo.
"""

import sys
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

BACKEND = Path(__file__).resolve().parents[2]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from accessory_pipeline import coverage_quality, zone_box, BODY_ZONE_BOXES  # noqa: E402

SIZE = (600, 900)
SKIN = (222, 178, 142)
FABRIC = (40, 60, 120)
BACKGROUND = (245, 245, 245)
POSE = {'box': [150.0, 40.0, 450.0, 870.0], 'keypoints': {}, 'confidence': 0.9, 'fallback': False}


def render(*, chest=FABRIC, abdomen=FABRIC, pelvis=FABRIC, legs=FABRIC,
           shoulders=FABRIC, upper_arms=FABRIC, buttocks=FABRIC):
    """Vẽ một 'người' đơn giản với màu do từng vùng quyết định."""
    image = Image.new('RGB', SIZE, BACKGROUND)
    draw = ImageDraw.Draw(image)
    colors = {'chest': chest, 'abdomen': abdomen, 'pelvis': pelvis, 'legs': legs,
              'shoulders': shoulders, 'upperArms': upper_arms, 'buttocks': buttocks}
    # Vẽ theo thứ tự để vùng chồng nhau (pelvis/buttocks) không xoá nhau.
    for zone in ('upperArms', 'shoulders', 'chest', 'abdomen', 'buttocks', 'pelvis', 'legs'):
        box = zone_box(POSE, SIZE, zone)
        if box:
            draw.rectangle(box, fill=colors[zone])
    # Đầu luôn là da để phép so tông màu có mốc tham chiếu.
    draw.rectangle((260, 40, 340, 150), fill=SKIN)
    return image


class CoverageQualityTest(unittest.TestCase):
    def test_khung_vung_co_the_nam_trong_box_nguoi(self):
        for zone in BODY_ZONE_BOXES:
            box = zone_box(POSE, SIZE, zone)
            self.assertIsNotNone(box, zone)
            self.assertLess(box[0], box[2], zone)
            self.assertLess(box[1], box[3], zone)

    def test_ao_thuong_khong_doi_gi_thi_dat(self):
        clean = render()
        result = render()
        quality = coverage_quality(clean, result, POSE, {
            'allowedExposedZones': [], 'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        self.assertTrue(quality['ok'], quality['reasons'])

    def test_crop_top_ho_bung_la_HOP_LE_khong_bi_bao_loi(self):
        # Đây là ca hồi quy quan trọng: cổng cũ coi mọi vùng da mới là lỗi, nên
        # ảnh áo crop hợp lệ bị từ chối oan.
        clean = render()
        result = render(abdomen=SKIN)
        quality = coverage_quality(clean, result, POSE, {
            'allowedExposedZones': ['abdomen'], 'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        self.assertTrue(quality['ok'], quality['reasons'])
        self.assertGreater(quality['zones']['abdomen']['gain'], 0.3)

    def test_ao_sat_nach_ho_vai_va_bap_tay_la_hop_le(self):
        clean = render()
        result = render(shoulders=SKIN, upper_arms=SKIN)
        quality = coverage_quality(clean, result, POSE, {
            'allowedExposedZones': ['shoulders', 'upperArms'],
            'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        self.assertTrue(quality['ok'], quality['reasons'])

    def test_quan_short_ho_chan_la_hop_le(self):
        clean = render()
        result = render(legs=SKIN)
        quality = coverage_quality(clean, result, POSE, {
            'allowedExposedZones': ['legs'], 'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        self.assertTrue(quality['ok'], quality['reasons'])

    def test_ho_vung_nguc_LUON_la_loi_nghiem_trong(self):
        clean = render()
        result = render(chest=SKIN)
        quality = coverage_quality(clean, result, POSE, {
            # Kể cả khi ai đó cố khai báo ngực là vùng được phép hở.
            'allowedExposedZones': ['chest', 'abdomen'],
            'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        self.assertFalse(quality['ok'])
        self.assertTrue(any(r.startswith('required_zone_exposed:chest') for r in quality['reasons']),
                        quality['reasons'])

    def test_ho_vung_chau_la_loi_nghiem_trong(self):
        clean = render()
        result = render(pelvis=SKIN)
        quality = coverage_quality(clean, result, POSE, {
            'allowedExposedZones': ['legs'], 'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        self.assertFalse(quality['ok'])
        self.assertTrue(any('pelvis' in r for r in quality['reasons']), quality['reasons'])

    def test_da_moi_xuat_hien_ngoai_thiet_ke_bi_bao_loi(self):
        # Áo dài tay mà tự nhiên hở bắp tay = model đã cởi bớt đồ.
        clean = render()
        result = render(upper_arms=SKIN)
        quality = coverage_quality(clean, result, POSE, {
            'allowedExposedZones': ['abdomen'], 'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        self.assertFalse(quality['ok'])
        self.assertTrue(any(r.startswith('unexpected_skin') for r in quality['reasons']), quality['reasons'])

    def test_mau_da_lech_ton_giua_mat_va_bung_bi_bao_loi(self):
        clean = render()
        # Bụng được dựng lại bằng một mảng màu lệch hẳn tông so với khuôn mặt.
        result = render(abdomen=(120, 90, 70))
        quality = coverage_quality(clean, result, POSE, {
            'allowedExposedZones': ['abdomen'], 'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        # Mảng màu đó có thể không được nhận là "da"; nếu có thì phải bị bắt lệch tông.
        if 'abdomen' in quality['skinToneDeltas']:
            self.assertTrue(any('skin_tone_mismatch' in r for r in quality['reasons']), quality)

    def test_crop_top_bi_keo_dai_che_bung_thi_bi_canh_bao(self):
        # Lỗi kinh điển của áo crop: VTON dựng thành áo dài bình thường. Đây là
        # sai THIẾT KẾ chứ không phải lỗi an toàn, nên là cảnh báo — ảnh vẫn
        # được giữ và hệ thống sẽ chạy một lượt fit-refine để sửa.
        clean = render()
        result = render()  # bụng vẫn là vải, không hề hở
        quality = coverage_quality(clean, result, POSE, {
            'allowedExposedZones': ['abdomen'], 'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        self.assertTrue(quality['ok'], 'không được coi là lỗi an toàn')
        self.assertIn('intended_exposure_missing:abdomen', quality['warnings'])

    def test_crop_top_ho_bung_dung_thiet_ke_thi_khong_canh_bao(self):
        clean = render()
        result = render(abdomen=SKIN)
        quality = coverage_quality(clean, result, POSE, {
            'allowedExposedZones': ['abdomen'], 'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        self.assertTrue(quality['ok'])
        self.assertNotIn('intended_exposure_missing:abdomen', quality['warnings'])

    def test_mac_dinh_vung_bat_buoc_kin_van_ap_dung_khi_khong_khai_bao(self):
        clean = render()
        result = render(chest=SKIN)
        quality = coverage_quality(clean, result, POSE, {})
        self.assertFalse(quality['ok'])
        self.assertEqual(quality['requiredCoveredZones'], ['buttocks', 'chest', 'pelvis'])


if __name__ == '__main__':
    unittest.main()
