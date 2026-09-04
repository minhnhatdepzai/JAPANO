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


def render_partial_chest(fraction):
    """Ảnh có ô ngực phần lớn là vải, chỉ một DẢI DỌC GIỮA là da.

    Mô phỏng áo khoác mở trước: `fraction` là bề rộng dải da so với bề rộng ô
    ngực. Trung bình da của cả ô vì thế thấp hơn nhiều so với ảnh cởi trần, đúng
    như ảnh thật đo được trên máy.
    """
    image = render()
    draw = ImageDraw.Draw(image)
    box = zone_box(POSE, SIZE, 'chest')
    x1, y1, x2, y2 = box
    width = x2 - x1
    strip = max(1, int(width * fraction))
    center = (x1 + x2) // 2
    draw.rectangle((center - strip // 2, y1, center + strip // 2, y2), fill=SKIN)
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

    def test_ao_khoac_mo_truoc_ho_mot_dai_nguc_duoc_CANH_BAO(self):
        """Hở ngực KHÔNG phải lúc nào cũng là cả ô ngực chuyển thành da.

        Áo khoác mở phía trước (haori, cardigan) chỉ hở một dải giữa; vải hai bên
        kéo trung bình cả ô xuống thấp. Đo trên máy 2026-09-02: thử haori lên
        người đang mặc áo dài tay kín, ngực đi từ 0.0014 lên 0.1422 mà cổng vẫn
        trả ok=True vì chỉ chặn khi vượt 0.34 — ảnh trả về là người cởi trần dưới
        lớp haori.

        Tín hiệu này hiện chỉ là CẢNH BÁO. Bản đầu tiên chặn thật, nhưng ngưỡng
        được hiệu chỉnh trên đúng một mẫu và đã đánh rớt hàng loạt ảnh hợp lệ
        (cổ kimono chữ V rơi trúng lõi ngực). Chặn thật chỉ bật lại qua
        JAPANO_COVERAGE_UNDRESS_BLOCK=1 sau khi hiệu chỉnh trên đủ mẫu.
        """
        clean = render()
        result = render_partial_chest(0.22)
        quality = coverage_quality(clean, result, POSE, {
            'allowedExposedZones': [], 'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        after = quality['zones']['chest']['after']
        self.assertLess(after, 0.34, 'ca kiểm thử phải nằm DƯỚI ngưỡng tuyệt đối cũ mới có ý nghĩa')
        # Không chặn ảnh...
        self.assertTrue(quality['ok'], quality['reasons'])
        # ...nhưng phải để lại dấu vết để lỗ hổng không bị quên.
        self.assertTrue(any(w.startswith('undressed_suspected:chest') for w in quality['warnings']),
                        quality['warnings'])
        self.assertTrue(quality['zones']['chest'].get('undressed'))

    def test_co_ao_ho_rat_it_khong_bi_chan_oan(self):
        """Đối chứng cho ca trên: cổ tròn/cổ tim thường chỉ hở vài phần trăm.

        Nhánh "đang mặc thành không mặc" phải đứng trên mức nhiễu này, nếu không
        mọi chiếc áo cổ tim trong catalog đều bị cổng an toàn chặn oan.
        """
        clean = render()
        result = render_partial_chest(0.05)
        quality = coverage_quality(clean, result, POSE, {
            'allowedExposedZones': [], 'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        self.assertTrue(quality['ok'], quality['zones']['chest'])

    def test_co_chu_v_rong_chi_canh_bao_khong_huy_anh(self):
        """Tín hiệu da mức vừa có thể là cổ áo/vải nude, không đủ để chặn."""
        clean = render()
        result = render_partial_chest(0.42)
        quality = coverage_quality(clean, result, POSE, {
            'allowedExposedZones': [], 'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        self.assertTrue(quality['ok'], quality)
        self.assertTrue(any(w.startswith('coverage_review:chest') for w in quality['warnings']), quality)

    def test_ho_vung_chau_la_loi_nghiem_trong(self):
        clean = render()
        result = render(pelvis=SKIN)
        quality = coverage_quality(clean, result, POSE, {
            'allowedExposedZones': ['legs'], 'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        self.assertFalse(quality['ok'])
        self.assertTrue(any('pelvis' in r for r in quality['reasons']), quality['reasons'])

    def test_bikini_cham_loi_vai_bao_ve_khong_danh_rot_da_hop_le_xung_quanh(self):
        clean = render()
        result = render(chest=SKIN, abdomen=SKIN, pelvis=SKIN, buttocks=SKIN,
                        legs=SKIN, shoulders=SKIN, upper_arms=SKIN)
        # Vải bikini chỉ cần nằm đúng lõi bảo vệ; da quanh cleavage, hông và
        # chân là đúng thiết kế. Vẽ lại ba lõi giống định nghĩa production.
        draw = ImageDraw.Draw(result)
        for zone in ('chest', 'pelvis', 'buttocks'):
            x1, y1, x2, y2 = zone_box(POSE, SIZE, zone)
            width, height = x2 - x1, y2 - y1
            draw.rectangle((x1 + width * .15, y1, x1 + width * .85, y1 + height * .58), fill=FABRIC)
        quality = coverage_quality(clean, result, POSE, {
            'coverageStyle': 'minimal-swimwear',
            'allowedExposedZones': ['abdomen', 'shoulders', 'upperArms', 'legs'],
            'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        self.assertTrue(quality['ok'], quality)
        self.assertLess(quality['zones']['pelvis']['protectedAfter'], .72)

    def test_bikini_van_chan_neu_loi_bao_ve_la_da(self):
        clean = render()
        result = render(chest=SKIN, abdomen=SKIN, pelvis=SKIN, buttocks=SKIN,
                        legs=SKIN, shoulders=SKIN, upper_arms=SKIN)
        quality = coverage_quality(clean, result, POSE, {
            'coverageStyle': 'minimal-swimwear',
            'allowedExposedZones': ['abdomen', 'shoulders', 'upperArms', 'legs'],
            'requiredCoveredZones': ['chest', 'pelvis', 'buttocks'],
        })
        self.assertFalse(quality['ok'])
        self.assertTrue(any(r.startswith('required_zone_exposed:') for r in quality['reasons']), quality)

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


# --- Vải màu nude không được tính là da trần --------------------------------
# Cardigan hồng phấn từng làm vùng ngực nhảy từ 13% lên 50% "da" và cổng an toàn
# huỷ ảnh của một người mặc kín — lỗi bắt được khi test thật trên Redmi.

class SkinToneReferenceTest(unittest.TestCase):
    def _anh_co_mat(self, mau_nguc):
        """Ảnh có khuôn mặt tông da rõ và vùng ngực màu tuỳ chọn."""
        image = Image.new('RGB', SIZE, BACKGROUND)
        draw = ImageDraw.Draw(image)
        draw.rectangle((250, 60, 350, 180), fill=SKIN)          # khuôn mặt
        draw.rectangle((180, 190, 420, 480), fill=mau_nguc)     # thân trên
        return image

    def _pose_co_mat(self):
        pose = dict(POSE)
        pose['keypoints'] = {
            'left_eye': [283.0, 110.0], 'right_eye': [317.0, 110.0], 'nose': [300.0, 140.0],
        }
        return pose

    def test_da_that_van_duoc_nhan_dien(self):
        from accessory_pipeline import face_skin_reference, _skin_ratio
        anh = self._anh_co_mat(SKIN)
        mau = face_skin_reference(anh, self._pose_co_mat())
        self.assertIsNotNone(mau, 'phải lấy được tông da từ khuôn mặt')
        ty_le = _skin_ratio(anh.crop((190, 200, 410, 470)), mau)
        self.assertGreater(ty_le, .9, 'da thật cùng tông với mặt phải được đếm')

    def test_vai_hong_phan_khong_bi_tinh_la_da(self):
        from accessory_pipeline import face_skin_reference, _skin_ratio
        HONG_PHAN = (238, 200, 196)
        anh = self._anh_co_mat(HONG_PHAN)
        mau = face_skin_reference(anh, self._pose_co_mat())
        self.assertIsNotNone(mau)
        vung = anh.crop((190, 200, 410, 470))
        self.assertGreater(_skin_ratio(vung), .5,
                           'ngưỡng chung vẫn nhận nhầm — đây chính là lý do cần mẫu da')
        self.assertLess(_skin_ratio(vung, mau), .1,
                        'có mẫu da khuôn mặt thì vải hồng phấn phải bị loại')

    def test_khong_thay_mat_thi_quay_ve_nguong_chung(self):
        from accessory_pipeline import face_skin_reference, _skin_ratio
        anh = self._anh_co_mat(SKIN)
        self.assertIsNone(face_skin_reference(anh, {'box': POSE['box'], 'keypoints': {}}))
        self.assertGreater(_skin_ratio(anh.crop((190, 200, 410, 470)), None), .9,
                           'thiếu mẫu thì phải chặt tay hơn, không được bỏ sót da')


# --- Vùng cơ thể neo theo keypoint ------------------------------------------
# Ô "ngực" từng được tính bằng tỉ lệ trên khung người (0.17-0.36 chiều cao) nên
# thực chất phủ CỔ. Đổi áo cổ lọ sang cardigan cổ V làm lộ cổ — chuyện bình
# thường — và cổng an toàn huỷ ảnh với lý do "hở ngực". Lỗi bắt được trên Redmi.

class ZoneAnchorTest(unittest.TestCase):
    """Vai ở y=200, hông ở y=470 -> thân dài 270px."""

    POSE = {
        'box': [150.0, 40.0, 450.0, 870.0], 'confidence': .9, 'fallback': False,
        'keypoints': {
            'left_shoulder': [240.0, 200.0], 'right_shoulder': [360.0, 200.0],
            'left_hip': [255.0, 470.0], 'right_hip': [345.0, 470.0],
        },
    }

    def test_o_nguc_nam_duoi_duong_vai(self):
        from accessory_pipeline import zone_box
        box = zone_box(self.POSE, SIZE, 'chest')
        self.assertGreater(box[1], 200, 'mép trên phải nằm DƯỚI vai, không trùm lên cổ')
        self.assertLess(box[3], 470, 'mép dưới phải nằm trên hông')

    def test_o_nguc_khong_con_dinh_co_khi_anh_cat_khac_nhau(self):
        """Cùng người, khung ảnh khác nhau -> ô ngực vẫn bám vai/hông."""
        from accessory_pipeline import zone_box
        rong = dict(self.POSE, box=[80.0, 10.0, 520.0, 940.0])
        self.assertEqual(zone_box(self.POSE, SIZE, 'chest'), zone_box(rong, SIZE, 'chest'))

    def test_thieu_keypoint_thi_quay_ve_ti_le_khung_nguoi(self):
        from accessory_pipeline import zone_box, BODY_ZONE_BOXES
        khong_kp = {'box': self.POSE['box'], 'keypoints': {}, 'confidence': .9, 'fallback': False}
        box = zone_box(khong_kp, SIZE, 'chest')
        x1, y1, x2, y2 = self.POSE['box']
        mong_doi_top = int(y1 + (y2 - y1) * BODY_ZONE_BOXES['chest'][1])
        self.assertEqual(box[1], mong_doi_top)

    def test_nguc_tran_that_su_van_bi_chan(self):
        """Nới ô ngực không được làm mất khả năng bắt ảnh cởi đồ."""
        from accessory_pipeline import zone_box, _skin_ratio
        anh = Image.new('RGB', SIZE, BACKGROUND)
        draw = ImageDraw.Draw(anh)
        box = zone_box(self.POSE, SIZE, 'chest')
        draw.rectangle(box, fill=SKIN)
        self.assertGreater(_skin_ratio(anh.crop(box)), .9,
                           'vùng ngực toàn da phải bị chấm là hở')
