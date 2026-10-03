import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from accessory_pipeline import add_safe_seam_split, add_safe_tight_fit, normalized_pose_drift, tryon_quality  # noqa: E402


POSE = {
    'box': [40, 10, 160, 230],
    'confidence': .95,
    'fallback': False,
    'otherBoxes': [],
    'inferredKeypoints': [],
    'keypoints': {
        'left_eye': [85, 38, .9], 'right_eye': [115, 38, .9],
        'nose': [100, 50, .9],
        'left_shoulder': [72, 78, .9], 'right_shoulder': [128, 78, .9],
        'left_elbow': [58, 125, .9], 'right_elbow': [142, 125, .9],
        'left_hip': [82, 158, .9], 'right_hip': [118, 158, .9],
    },
    'poseSuitability': {'requiresRepose': False, 'reasons': []},
}


def person_image(face=(205, 150, 125), garment=(40, 90, 170)):
    image = Image.new('RGB', (200, 240), (235, 235, 235))
    draw = ImageDraw.Draw(image)
    draw.ellipse((75, 20, 125, 70), fill=face)
    draw.rectangle((60, 72, 140, 170), fill=garment)
    # Kết cấu vải để quality gate không coi áo là một hình phẳng bị blur.
    for y in range(78, 168, 8):
        draw.line((62, y, 138, y), fill=(230, 230, 230), width=2)
    draw.rectangle((78, 170, 96, 230), fill=(55, 55, 65))
    draw.rectangle((104, 170, 122, 230), fill=(55, 55, 65))
    return image


class TryOnIdentityQualityTest(unittest.TestCase):
    def test_normalized_pose_drift_accepts_small_detector_jitter(self):
        source = {'box':[0, 0, 100, 200], 'keypoints':{
            'left_wrist':[20, 90, .9], 'right_wrist':[80, 90, .9],
            'left_knee':[40, 145, .9], 'right_knee':[60, 145, .9],
        }}
        result = {'box':[10, 20, 210, 420], 'keypoints':{
            'left_wrist':[52, 202, .9], 'right_wrist':[168, 198, .9],
            'left_knee':[92, 310, .9], 'right_knee':[128, 312, .9],
        }}
        drift = normalized_pose_drift(source, result)
        self.assertEqual(drift['changed'], 0)
        self.assertEqual(drift['changedGroups'], 0)
        self.assertLess(drift['mean'], .04)

    def test_normalized_pose_drift_detects_changed_limbs(self):
        source = {'box':[0, 0, 100, 200], 'keypoints':{
            'left_wrist':[20, 90, .9], 'right_wrist':[80, 90, .9],
            'left_knee':[40, 145, .9], 'right_knee':[60, 145, .9],
        }}
        result = {'box':[0, 0, 100, 200], 'keypoints':{
            'left_wrist':[50, 35, .9], 'right_wrist':[50, 35, .9],
            'left_knee':[18, 155, .9], 'right_knee':[82, 155, .9],
        }}
        drift = normalized_pose_drift(source, result)
        self.assertGreaterEqual(drift['changed'], 2)
        self.assertEqual(drift['changedGroups'], 2)
        self.assertGreater(drift['mean'], .105)

    def test_normalized_pose_drift_does_not_treat_sleeve_detector_shift_as_full_pose_change(self):
        source = {'box':[0, 0, 100, 200], 'keypoints':{
            'left_elbow':[20, 70, .9], 'right_elbow':[80, 70, .9],
            'left_wrist':[18, 105, .9], 'right_wrist':[82, 105, .9],
            'left_knee':[40, 145, .9], 'right_knee':[60, 145, .9],
            'left_ankle':[40, 190, .9], 'right_ankle':[60, 190, .9],
        }}
        result = {'box':[0, 0, 100, 200], 'keypoints':{
            'left_elbow':[46, 58, .9], 'right_elbow':[54, 58, .9],
            'left_wrist':[45, 96, .9], 'right_wrist':[55, 96, .9],
            'left_knee':[41, 146, .9], 'right_knee':[59, 146, .9],
            'left_ankle':[41, 189, .9], 'right_ankle':[59, 189, .9],
        }}
        drift = normalized_pose_drift(source, result)
        self.assertGreaterEqual(drift['changed'], 2)
        self.assertEqual(drift['changedGroups'], 1)

    def test_long_garment_ignores_detector_drift_in_occluded_limb_groups(self):
        source = {'box':[0, 0, 100, 200], 'keypoints':{
            'left_wrist':[20, 90, .9], 'right_wrist':[80, 90, .9],
            'left_knee':[40, 145, .9], 'right_knee':[60, 145, .9],
        }}
        result = {'box':[0, 0, 100, 200], 'keypoints':{
            'left_wrist':[50, 35, .9], 'right_wrist':[50, 35, .9],
            'left_knee':[18, 155, .9], 'right_knee':[82, 155, .9],
        }}
        drift = normalized_pose_drift(source, result, ['arms', 'legs'])
        self.assertGreaterEqual(drift['changed'], 2)
        self.assertEqual(drift['detectedChangedGroups'], 2)
        self.assertEqual(drift['changedGroups'], 0)
        self.assertEqual(drift['ignoredGroups'], ['arms', 'legs'])

    def test_doi_mat_bi_chan_du_trang_phuc_da_thay(self):
        source = person_image()
        changed = person_image(face=(20, 20, 20), garment=(170, 50, 50))
        with patch('accessory_pipeline.analyze', return_value=POSE):
            quality = tryon_quality(source, changed, POSE, strict_identity=True)
        self.assertIn('face_changed_or_covered', quality['reasons'])
        self.assertFalse(quality['ok'])

    def test_giu_mat_khong_bi_chan_nham_khi_ao_thay_doi(self):
        source = person_image()
        changed = person_image(garment=(170, 50, 50))
        with patch('accessory_pipeline.analyze', return_value=POSE):
            quality = tryon_quality(source, changed, POSE, strict_identity=True)
        self.assertNotIn('face_changed_or_covered', quality['reasons'])
        self.assertLess(quality['faceDiff'], 45.0)

    def test_doi_tu_the_khong_bi_chan_boi_so_pixel_nhung_cong_cau_truc_van_chay(self):
        source = person_image()
        changed = person_image(face=(20, 20, 20), garment=(170, 50, 50))
        with patch('accessory_pipeline.analyze', return_value=POSE):
            quality = tryon_quality(source, changed, POSE, strict_identity=False)
        self.assertNotIn('face_changed_or_covered', quality['reasons'])
        self.assertNotIn('body_changed_not_garment', quality['reasons'])
        self.assertNotIn('garment_unchanged', quality['reasons'])

    def test_vet_buc_duong_may_khong_cham_vao_mat(self):
        source = person_image()
        with patch('accessory_pipeline.analyze', return_value=POSE):
            changed, seam = add_safe_seam_split(source)
        self.assertTrue(seam['applied'])
        self.assertEqual(seam['exposedZone'], 'upper_arm')
        self.assertEqual(seam['underlay'], 'matched_skin_tone')
        self.assertEqual(source.crop((75, 20, 125, 70)).tobytes(), changed.crop((75, 20, 125, 70)).tobytes())
        self.assertNotEqual(source.tobytes(), changed.tobytes())

    def test_vai_cang_chi_doi_texture_than_ao_khong_doi_mat(self):
        source = person_image()
        with patch('accessory_pipeline.analyze', return_value=POSE):
            changed, effect = add_safe_tight_fit(source, 1.0)
        self.assertTrue(effect['applied'])
        self.assertEqual(effect['tensionIntensity'], 1.0)
        self.assertEqual(source.crop((75, 20, 125, 70)).tobytes(), changed.crop((75, 20, 125, 70)).tobytes())
        self.assertNotEqual(source.crop((60, 90, 140, 155)).tobytes(), changed.crop((60, 90, 140, 155)).tobytes())


if __name__ == '__main__':
    unittest.main()
