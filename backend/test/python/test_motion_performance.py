import os
import unittest
from unittest import mock

from backend import motion_service


class MotionProfileTest(unittest.TestCase):
    def clean_motion_env(self):
        return mock.patch.dict(os.environ, {}, clear=True)

    def test_turbo_giu_nguyen_49_frame_va_dung_single_pass_guidance(self):
        with self.clean_motion_env():
            name, profile = motion_service.motion_profile("turbo")
        self.assertEqual(name, "turbo")
        self.assertEqual(profile["frames"], 49)
        self.assertEqual(profile["steps"], 12)
        self.assertEqual(profile["imageGuidance"], 1.0)
        self.assertEqual(profile["poseGuidance"], 1.0)

    def test_action_kho_dung_two_pass_thay_vi_ep_turbo(self):
        self.assertEqual(motion_service.DEFAULT_PROFILE_BY_MOTION["walk_natural"], "turbo")
        self.assertEqual(motion_service.DEFAULT_PROFILE_BY_MOTION["pose_sway"], "turbo")
        self.assertEqual(motion_service.DEFAULT_PROFILE_BY_MOTION["turn_show"], "turn_fast")
        self.assertGreater(motion_service.MOTION_PROFILES["turn_fast"]["imageGuidance"], 1.0)

    def test_override_frame_sai_hinh_dang_wan_bi_chan(self):
        with mock.patch.dict(os.environ, {"JAPANO_MOTION_FRAMES": "32"}):
            with self.assertRaisesRegex(ValueError, "4n\\+1"):
                motion_service.motion_profile("turbo")

    def test_doc_json_cuoi_cung_duoc_doc_lam_stage_metrics(self):
        parsed = motion_service.last_json_object('noise\n{"stage":"pose"}\n{"ok":true,"timings":{"totalSeconds":57.2}}\n')
        self.assertTrue(parsed["ok"])
        self.assertEqual(parsed["timings"]["totalSeconds"], 57.2)


if __name__ == "__main__":
    unittest.main()
