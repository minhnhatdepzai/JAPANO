"""Cổng chất lượng phụ kiện với món NHỎ (trâm cài, kẹp tóc).

Lỗi có thật, đo trên máy 2026-09-03: "Trâm cài tóc Kanzashi" đã được đặt đúng
thái dương nhưng cổng vẫn trả `hair_clip_missing` và huỷ ảnh. Nguyên nhân là
phép đo lấy TRUNG BÌNH trên nửa cái đầu, trong khi cái trâm chỉ chiếm vài phần
trăm diện tích đó — tín hiệu thật bị pha loãng xuống dưới ngưỡng.

Số đo thật sau khi chuyển sang đo ĐỈNH theo ô nhỏ:
    trâm Kanzashi : trung bình 2.318  ->  đỉnh 14.565
    kẹp nơ        : trung bình 8.072  ->  đỉnh 89.894
Ảnh không đổi gì thì mọi ô đều bằng 0, nên ngưỡng 9 vẫn tách được hai phía.
"""

import sys
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from accessory_pipeline import accessory_quality  # noqa: E402

SIZE = (300, 460)
POSE_BOX = [80, 20, 220, 440]


def person(clip_at=None, clip_size=14):
    """Người đơn giản; `clip_at` vẽ một vật NHỎ cạnh thái dương."""
    image = Image.new('RGB', SIZE, (240, 240, 240))
    draw = ImageDraw.Draw(image)
    draw.rectangle((80, 20, 220, 440), fill=(70, 80, 110))       # thân
    draw.ellipse((122, 24, 178, 92), fill=(226, 186, 150))       # đầu
    if clip_at is not None:
        x, y = clip_at
        draw.ellipse((x, y, x + clip_size, y + clip_size), fill=(220, 30, 60))
    return image


def quality(clean, result, kinds):
    with_pose = accessory_quality(clean, result, kinds)
    return with_pose


class SmallAccessoryGateTest(unittest.TestCase):
    def test_vat_nho_canh_thai_duong_duoc_nhan_ra(self):
        clean = person()
        result = person(clip_at=(120, 34))
        report = quality(clean, result, ['hair_clip'])
        self.assertNotIn('hair_clip_missing', report['reasons'], report)
        self.assertGreater(report['clipPeakDiff'], 9, report)

    def test_khong_dan_gi_thi_van_bi_bao_thieu(self):
        """Đối chứng: nới cách đo KHÔNG được làm mất khả năng bắt ảnh y hệt."""
        clean = person()
        result = person()
        report = quality(clean, result, ['hair_clip'])
        self.assertIn('hair_clip_missing', report['reasons'], report)
        self.assertLess(report['clipPeakDiff'], 9, report)

    def test_do_dinh_nhay_hon_han_do_trung_binh_tren_vat_nho(self):
        """Chính là lý do phải đổi cách đo, khoá lại bằng số."""
        clean = person()
        result = person(clip_at=(120, 34))
        report = quality(clean, result, ['hair_clip'])
        avg = max(report['leftHeadDiff'], report['rightHeadDiff'])
        self.assertGreater(report['clipPeakDiff'], avg * 2,
                           f"đỉnh {report['clipPeakDiff']} phải vượt xa trung bình {avg}")


if __name__ == '__main__':
    unittest.main()
