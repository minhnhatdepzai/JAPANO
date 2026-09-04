import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scene_compose import UnsafePlacementError, compose_scene  # noqa: E402


class SceneComposeGroundGateTests(unittest.TestCase):
    def setUp(self):
        self.person = Image.new('RGB', (200, 400), (210, 150, 110))
        self.background = Image.new('RGB', (900, 600), (90, 140, 90))
        self.mask = np.zeros((400, 200), dtype=bool)
        # Thân và hai chân có bề ngang tiếp xúc thật. Chỉ kiểm tâm sẽ bỏ lọt
        # ca groundPolygon quá hẹp dưới đây.
        self.mask[20:300, 45:155] = True
        self.mask[300:395, 48:85] = True
        self.mask[300:395, 115:152] = True

    @staticmethod
    def composition(ground_polygon):
        return {
            'footAnchor': {'x': .5, 'y': .95},
            'personHeightRatio': {'min': .45, 'preferred': .55, 'max': .65},
            'groundPolygon': ground_polygon,
            'lightDirection': 'front',
            'lightTemperature': 'neutral',
            'shadowOpacity': .2,
            'shadowBlur': 12,
            'shadowAngle': 0,
        }

    def test_full_contact_span_on_ground_is_accepted(self):
        result, placement = compose_scene(
            self.person, self.background, self.mask,
            composition=self.composition([[0, .72], [1, .72], [1, 1], [0, 1]]),
            output_width=480, output_height=720,
        )
        self.assertEqual(result.size, (480, 720))
        self.assertTrue(placement['groundSafe'])
        self.assertGreaterEqual(len(placement['contactPoints']), 2)

    def test_center_anchor_cannot_hide_feet_outside_ground(self):
        with self.assertRaises(UnsafePlacementError):
            compose_scene(
                self.person, self.background, self.mask,
                composition=self.composition([[.485, .72], [.515, .72], [.515, 1], [.485, 1]]),
                output_width=480, output_height=720,
            )


if __name__ == '__main__':
    unittest.main()
