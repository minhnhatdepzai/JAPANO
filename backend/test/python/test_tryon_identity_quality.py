import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from accessory_pipeline import add_safe_seam_split, add_safe_tight_fit, tryon_quality  # noqa: E402


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

    def test_vet_buc_duong_may_khong_cham_vao_mat(self):
        source = person_image()
        with patch('accessory_pipeline.analyze', return_value=POSE):
            changed, seam = add_safe_seam_split(source)
        self.assertTrue(seam['applied'])
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
