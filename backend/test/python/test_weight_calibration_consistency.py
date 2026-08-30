"""Hiệu chuẩn cân nặng phải kéo theo khoảng bất định và bin hiển thị.

Lỗi thật đã quan sát được (2026-08-29, khi dựng bộ mẫu thử nhanh): ảnh người mẫu
ngoại cỡ trả về

    valueKg 79.4 | minKg 70 | maxKg 80
    uncertaintyMinKg 48 | uncertaintyMaxKg 65 | displayBinKg [50, 60]

Điểm ước lượng 79.4 nằm NGOÀI khoảng bất định 48-65 của chính nó, và bin hiển
thị nói 50-60. Nguyên nhân: `calibrate_to_population` nâng valueKg lên nhưng
nhánh áp dụng chỉ cập nhật minKg/maxKg, để nguyên hai field uncertainty* và
displayBinKg từ trước hiệu chuẩn. Hệ quả không chỉ là hiển thị sai — gợi ý size
đọc phải con số của một cơ thể khác.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import body_analysis


class WeightCalibrationConsistency(unittest.TestCase):
    def _analyze_with_forced_calibration(self, factor):
        """Chạy analyze_body với một hiệu chuẩn cân nặng ép theo hệ số cho trước."""
        real = body_analysis.calibrate_to_population

        def fake(key, value, height_cm, slack, sex):
            if key == 'weight' and value is not None:
                return round(float(value) * factor, 1), True
            return real(key, value, height_cm, slack, sex)

        body_analysis.calibrate_to_population = fake
        try:
            return body_analysis.analyze_body(self.image, sex='female')
        finally:
            body_analysis.calibrate_to_population = real

    @classmethod
    def setUpClass(cls):
        preset = (Path(__file__).resolve().parents[3]
                  / 'mobile' / 'assets' / 'tryon-presets' / 'nu-mem-mai.jpg')
        if not preset.exists():
            raise unittest.SkipTest(f'thiếu ảnh mẫu {preset}')
        from PIL import Image
        cls.image = Image.open(preset).convert('RGB')

    def assert_weight_self_consistent(self, weight, label):
        value = weight.get('valueKg')
        if value is None:
            self.skipTest(f'{label}: pipeline không trả cân nặng, không có gì để kiểm')
        lo, hi = weight.get('uncertaintyMinKg'), weight.get('uncertaintyMaxKg')
        if lo is not None and hi is not None:
            self.assertLessEqual(
                lo, value + 0.5,
                f'{label}: biên dưới {lo} lớn hơn chính điểm ước lượng {value}')
            self.assertGreaterEqual(
                hi, value - 0.5,
                f'{label}: biên trên {hi} nhỏ hơn chính điểm ước lượng {value}')
        bin_min, bin_max = weight['displayBinKg']
        self.assertEqual([bin_min, bin_max], [weight['minKg'], weight['maxKg']],
                         f'{label}: displayBinKg lệch khỏi minKg/maxKg')
        self.assertTrue(
            bin_min <= value <= bin_max,
            f'{label}: bin hiển thị {bin_min}-{bin_max} không chứa giá trị {value}')

    def test_hieu_chuan_tang_can_nang_keo_theo_khoang_va_bin(self):
        result = self._analyze_with_forced_calibration(1.4)
        self.assert_weight_self_consistent(result['estimatedWeight'], 'hiệu chuẩn tăng 40%')

    def test_hieu_chuan_giam_can_nang_keo_theo_khoang_va_bin(self):
        result = self._analyze_with_forced_calibration(0.6)
        self.assert_weight_self_consistent(result['estimatedWeight'], 'hiệu chuẩn giảm 40%')

    def test_hieu_chuan_that_tren_anh_mau_ngoai_co(self):
        """Đường chạy thật, không ép hệ số: đây là ca đã sinh ra lỗi ban đầu."""
        result = body_analysis.analyze_body(self.image, sex='female')
        self.assert_weight_self_consistent(result['estimatedWeight'], 'hiệu chuẩn thật')


if __name__ == '__main__':
    unittest.main()
