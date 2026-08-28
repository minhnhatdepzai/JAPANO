"""Kiểm thử cổng "AI sửa cơ thể hay sửa quần áo" của hiệu ứng độ vừa vặn.

Chạy:  python3 -m unittest discover -s backend/test/python -v

Bộ test này khoá lại hai lỗi đã thực sự xảy ra khi chạy thật, cùng khiến MỌI
hiệu ứng áo rộng bị huỷ oan (`body_changed_not_garment`) dù ảnh kết quả hoàn
toàn hợp lệ:

1. Số đo được chuẩn hoá theo chiều cao BOX NGƯỜI. Áo rất rộng làm box phình ra,
   nên khoảng cách hai mắt "đổi" tới 28% dù khuôn mặt không dịch một pixel nào.
2. Cổng dừng ngay ở mốc lệch đầu tiên, nên một keypoint nhiễu đủ phủ quyết tất cả.
"""

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

BACKEND = Path(__file__).resolve().parents[2]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from accessory_pipeline import _body_geometry, fit_effect_quality  # noqa: E402

FRAME = (600, 900)


def pose(box, *, eyes=((280.0, 120.0), (320.0, 120.0)), nose=(300.0, 145.0),
         shoulders=((250.0, 200.0), (350.0, 200.0)), hips=((265.0, 470.0), (335.0, 470.0))):
    left_eye, right_eye = eyes
    left_shoulder, right_shoulder = shoulders
    left_hip, right_hip = hips
    return {
        'box': list(box),
        'confidence': 0.9,
        'fallback': False,
        'keypoints': {
            'left_eye': list(left_eye), 'right_eye': list(right_eye), 'nose': list(nose),
            'left_shoulder': list(left_shoulder), 'right_shoulder': list(right_shoulder),
            'left_hip': list(left_hip), 'right_hip': list(right_hip),
        },
    }


def drift(before, after, key):
    return abs(after[key] - before[key]) / max(.02, abs(before[key]))


class BodyGeometryFrameTest(unittest.TestCase):
    def test_khuon_mat_khong_doi_thi_khong_lech_du_box_phinh_ra(self):
        """Áo rủ rộng làm box người cao và rộng thêm; mặt giữ nguyên vị trí."""
        truoc = _body_geometry(pose([200.0, 90.0, 400.0, 800.0]), FRAME)
        # Cùng khuôn mặt, cùng vai/hông — chỉ box là to ra vì vải rủ.
        sau = _body_geometry(pose([150.0, 90.0, 450.0, 880.0]), FRAME)
        for key in ('eyeSpan', 'eyeToNose', 'noseY'):
            self.assertLess(drift(truoc, sau, key), .02, f'{key} phải gần như bất động')

    def test_chuan_hoa_theo_box_moi_la_thu_tao_ra_lech_gia(self):
        """Đối chứng: chính cách chuẩn hoá cũ sinh ra con số lệch vô lý."""
        truoc = _body_geometry(pose([200.0, 90.0, 400.0, 800.0]))   # không truyền khung ảnh
        sau = _body_geometry(pose([150.0, 90.0, 450.0, 880.0]))
        self.assertGreater(drift(truoc, sau, 'eyeSpan'), .08,
                           'nếu con số này nhỏ thì bài test đối chứng đã mất ý nghĩa')

    def test_ai_thu_nho_co_the_thi_moi_moc_deu_lech(self):
        """Biến dạng thật: cả khuôn mặt lẫn thân đều co lại cùng lúc."""
        truoc = _body_geometry(pose([200.0, 90.0, 400.0, 800.0]), FRAME)
        sau = _body_geometry(
            pose([200.0, 90.0, 400.0, 800.0],
                 eyes=((288.0, 120.0), (312.0, 120.0)), nose=(300.0, 135.0),
                 shoulders=((265.0, 200.0), (335.0, 200.0)), hips=((275.0, 380.0), (325.0, 380.0))),
            FRAME)
        lech = [key for key in ('eyeSpan', 'eyeToNose', 'torso') if drift(truoc, sau, key) > .18]
        self.assertGreaterEqual(len(lech), 2, 'biến dạng thật phải làm nhiều mốc cùng lệch')

    def test_thieu_keypoint_thi_tra_none_chu_khong_no(self):
        thieu = {'box': [200.0, 90.0, 400.0, 800.0], 'keypoints': {}, 'confidence': .9, 'fallback': False}
        hinh = _body_geometry(thieu, FRAME)
        self.assertIsNotNone(hinh)
        self.assertIsNone(hinh['eyeSpan'])
        self.assertIsNone(hinh['torso'])

    def test_khong_co_box_thi_tra_none(self):
        self.assertIsNone(_body_geometry({'keypoints': {}}, FRAME))

    def test_ao_chat_khong_duoc_lam_no_vai_va_than_nguoi(self):
        truoc = pose([200.0, 90.0, 400.0, 800.0])
        sau = pose(
            [185.0, 90.0, 415.0, 820.0],
            shoulders=((240.0, 200.0), (360.0, 200.0)),
            hips=((265.0, 510.0), (335.0, 510.0)),
        )
        anh = Image.new('RGB', FRAME, (80, 80, 80))
        with patch('accessory_pipeline.analyze', side_effect=[sau, truoc]):
            quality = fit_effect_quality(
                anh, anh, None, 'upper', {'verdict': 'very_tight', 'tearAllowed': True},
            )
        self.assertIn('body_changed_not_garment', quality['reasons'])


if __name__ == '__main__':
    unittest.main()
