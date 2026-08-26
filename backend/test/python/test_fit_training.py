"""Kiểm thử orchestrator fine-tune và cơ chế nạp LoRA.

Chạy:  python3 -m unittest discover -s backend/test/python -v

Không train thật và không đụng GPU: các bài test ở đây khoá đúng những chỗ dễ
nói dối nhất — trạng thái TRAINED khi trainer lỗi, rò identity giữa train/test,
adapter nạp lại mỗi request, và secret lọt vào log.
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
AI_TRAINING = BACKEND / 'ai_training'
for path in (str(BACKEND), str(AI_TRAINING)):
    if path not in sys.path:
        sys.path.insert(0, path)

import train_fit_lora as orchestrator  # noqa: E402


def sample_row(person_id, verdict, index=0):
    return {
        'id': f'{person_id}_{verdict}',
        'personId': person_id,
        'person': f'person/{person_id}.jpg',
        'garment': f'garment/{person_id}.jpg',
        'target': f'target/{person_id}_{verdict}.png',
        'category': 'tops',
        'selectedSize': 'M',
        'recommendedSize': 'L',
        'fitVerdict': verdict,
        'severity': 0.5,
        'effects': [],
        'caption': f'FIT_TEST {verdict}',
        'provenance': 'synthetic-flux2-klein-fit-refine',
        'sourceDataset': 'test',
        'qualityGate': {'ok': True},
    }


class DatasetSchemaTest(unittest.TestCase):
    def test_thieu_truong_bat_buoc_bi_bat(self):
        rows = [sample_row('p1', v) for v in orchestrator.FIT_CLASSES]
        rows[0].pop('target')
        problems, _, _ = orchestrator.validate_dataset(rows, min_samples=1)
        self.assertTrue(any('target' in p for p in problems))

    def test_caption_thieu_thi_suy_ra_duoc_thay_vi_chan_ca_luot_train(self):
        # Caption là hàm thuần của (verdict, severity) nên metadata cũ không có
        # trường đó vẫn dùng được — không việc gì phải chặn cả lượt train.
        row = sample_row('p1', 'very_tight')
        row.pop('caption')
        caption = orchestrator.caption_of(row)
        self.assertIn('FIT_VERY_TIGHT', caption)
        self.assertIn('Edit only the clothing fit', caption)
        # Đã có caption thì giữ nguyên, không ghi đè.
        self.assertEqual(orchestrator.caption_of(sample_row('p1', 'good')), 'FIT_TEST good')

    def test_thieu_lop_bi_bat(self):
        rows = [sample_row(f'p{i}', 'good', i) for i in range(5)]
        problems, classes, identities = orchestrator.validate_dataset(rows, min_samples=1)
        self.assertTrue(any('Thiếu hoàn toàn lớp' in p for p in problems))
        self.assertEqual(classes['good'], 5)
        self.assertEqual(identities, 5)

    def test_qua_it_mau_bi_bat(self):
        rows = [sample_row('p1', 'good')]
        problems, _, _ = orchestrator.validate_dataset(rows, min_samples=100)
        self.assertTrue(any('tối thiểu 100' in p for p in problems))

    def test_metadata_that_cua_du_an_dung_schema(self):
        """Dataset thật trong repo phải luôn hợp lệ về schema."""
        rows = orchestrator.load_rows()
        if not rows:
            self.skipTest('Chưa sinh dataset')
        for row in rows:
            for field in ('id', 'personId', 'person', 'target', 'fitVerdict', 'provenance'):
                self.assertIn(field, row, f'{row.get("id")} thiếu {field}')
            self.assertIn(row['fitVerdict'], orchestrator.FIT_CLASSES)
            self.assertTrue(orchestrator.caption_of(row), f'{row["id"]} không dựng được caption')
            # Ảnh synthetic phải luôn khai báo nguồn gốc, không được giả làm ảnh thật.
            self.assertIn(row['provenance'], {'synthetic-flux2-klein-fit-refine', 'identity-copy'})


class IdentitySplitTest(unittest.TestCase):
    def setUp(self):
        self.rows = [sample_row(f'p{i}', v)
                     for i in range(10) for v in orchestrator.FIT_CLASSES]

    def test_khong_ro_identity_giua_cac_tap(self):
        splits = orchestrator.split_by_identity(self.rows)
        train = {r['personId'] for r in splits['train']}
        val = {r['personId'] for r in splits['validation']}
        test = {r['personId'] for r in splits['test']}
        self.assertFalse(train & test, 'identity rò giữa train và test')
        self.assertFalse(train & val, 'identity rò giữa train và validation')
        self.assertFalse(val & test, 'identity rò giữa validation và test')

    def test_moi_tap_deu_co_du_lieu(self):
        splits = orchestrator.split_by_identity(self.rows)
        for name in ('train', 'validation', 'test'):
            self.assertGreater(len(splits[name]), 0, f'{name} rỗng')

    def test_chia_lai_cho_ket_qua_giong_nhau(self):
        a = orchestrator.split_by_identity(self.rows)
        b = orchestrator.split_by_identity(self.rows)
        self.assertEqual([r['id'] for r in a['test']], [r['id'] for r in b['test']])

    def test_ty_le_split_gan_70_15_15(self):
        splits = orchestrator.split_by_identity(self.rows)
        total = len(self.rows)
        self.assertGreaterEqual(len(splits['train']) / total, 0.60)
        self.assertLessEqual(len(splits['train']) / total, 0.80)
        self.assertLessEqual(abs(len(splits['validation']) - len(splits['test'])), 7)


class StatusTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self._models, self._status = orchestrator.MODELS, orchestrator.STATUS_PATH
        orchestrator.MODELS = Path(self.tmp.name)
        orchestrator.STATUS_PATH = Path(self.tmp.name) / 'fit_lora.status.json'

    def tearDown(self):
        orchestrator.MODELS, orchestrator.STATUS_PATH = self._models, self._status
        self.tmp.cleanup()

    def test_chi_chap_nhan_trang_thai_hop_le(self):
        with self.assertRaises(AssertionError):
            orchestrator.write_status('DA_FINE_TUNE_XONG')

    def test_ghi_va_doc_lai_trang_thai(self):
        orchestrator.write_status('PILOT_PASSED', steps=30)
        data = orchestrator.read_status()
        self.assertEqual(data['status'], 'PILOT_PASSED')
        self.assertEqual(data['steps'], 30)

    def test_trang_thai_moi_khong_giu_ly_do_loi_cu(self):
        orchestrator.write_status('MODEL_NOT_TRAINED', reason='TRAINER_FAILED', exitCode=1)
        orchestrator.write_status('PILOT_PASSED', steps=30, exitCode=0)
        data = orchestrator.read_status()
        self.assertEqual(data['status'], 'PILOT_PASSED')
        self.assertNotIn('reason', data)
        self.assertEqual(data['exitCode'], 0)

    def test_trainer_that_bai_khong_duoc_ghi_TRAINED(self):
        """Mã thoát khác 0 phải cho ra MODEL_NOT_TRAINED, không bao giờ TRAINED."""
        orchestrator.write_status('MODEL_NOT_TRAINED', reason='TRAINER_FAILED', exitCode=1)
        self.assertEqual(orchestrator.read_status()['status'], 'MODEL_NOT_TRAINED')

    def test_khong_co_checkpoint_thi_khong_TRAINED(self):
        empty = Path(self.tmp.name) / 'empty_output'
        empty.mkdir()
        self.assertIsNone(orchestrator.find_checkpoint(empty))

    def test_tim_dung_file_checkpoint(self):
        out = Path(self.tmp.name) / 'out'
        out.mkdir()
        (out / 'pytorch_lora_weights.safetensors').write_bytes(b'x' * 32)
        found = orchestrator.find_checkpoint(out)
        self.assertIsNotNone(found)
        self.assertEqual(found.name, 'pytorch_lora_weights.safetensors')

    def test_status_khong_chua_secret(self):
        orchestrator.write_status('TRAINING', datasetDir='/home/nhat/jp/datasets/japano-fit-hf')
        text = orchestrator.STATUS_PATH.read_text()
        for secret in ('kaggle.json', 'KAGGLE_KEY', '"key"', 'password', 'Bearer '):
            self.assertNotIn(secret, text)


class TrainCommandTest(unittest.TestCase):
    def test_lenh_train_co_du_tham_so_bat_buoc(self):
        command = orchestrator.build_command(
            Path('/tmp/ds/train'), Path('/tmp/out'), max_steps=600, rank=8,
            resolution=512, resume=None, validation_image=None,
            checkpointing_steps=100, learning_rate=1e-4,
        )
        text = ' '.join(command)
        for flag in ('--pretrained_model_name_or_path', '--dataset_name', '--cond_image_column',
                     '--caption_column', '--rank', '--seed', '--gradient_checkpointing',
                     '--use_8bit_adam', '--mixed_precision', '--max_sequence_length'):
            self.assertIn(flag, text, f'thiếu {flag}')
        self.assertEqual(command[command.index('--max_sequence_length') + 1], '64')
        # Không được đẩy model lên Hub trong nhiệm vụ này.
        self.assertNotIn('--push_to_hub', text)
        # Hai cờ lượng tử hoá không được dùng đồng thời.
        self.assertFalse('--do_fp8_training' in text and '--bnb_quantization_config_path' in text)

    def test_cache_latent_chi_duoc_bat_khi_yeu_cau(self):
        base = dict(dataset_dir=Path('/tmp/ds/train'), output_dir=Path('/tmp/out'),
                    max_steps=30, rank=8, resolution=512, resume=None,
                    validation_image=None, checkpointing_steps=15, learning_rate=1e-4)
        self.assertNotIn('--cache_latents', orchestrator.build_command(**base))
        self.assertIn('--cache_latents', orchestrator.build_command(**base, cache_latents=True))

    def test_resume_them_dung_co(self):
        command = orchestrator.build_command(
            Path('/tmp/ds/train'), Path('/tmp/out'), 600, 8, 512, 'latest', None, 100, 1e-4)
        self.assertIn('--resume_from_checkpoint', command)
        self.assertIn('latest', command)


class FakePipe:
    """Pipeline giả để đếm số lần LoRA được nạp."""
    def __init__(self):
        self.load_calls = 0
        self.unload_calls = 0

    def load_lora_weights(self, path):
        self.load_calls += 1

    def unload_lora_weights(self):
        self.unload_calls += 1


class LoraLoadingTest(unittest.TestCase):
    """Nạp adapter đúng một lần — đây là lỗi hiệu năng đã từng có thật."""

    @classmethod
    def setUpClass(cls):
        try:
            import fashn_service  # noqa: F401
        except Exception as exc:  # torch/fastapi thiếu trong môi trường test
            raise unittest.SkipTest(f'không import được fashn_service: {exc}')

    def setUp(self):
        import fashn_service
        self.service = fashn_service
        self.tmp = tempfile.TemporaryDirectory()
        self.ckpt_a = Path(self.tmp.name) / 'a'
        self.ckpt_a.mkdir()
        (self.ckpt_a / 'pytorch_lora_weights.safetensors').write_bytes(b'A' * 128)
        self.ckpt_b = Path(self.tmp.name) / 'b'
        self.ckpt_b.mkdir()
        (self.ckpt_b / 'pytorch_lora_weights.safetensors').write_bytes(b'B' * 256)
        self._env = self.service.os.environ.get('JAPANO_FIT_LORA_PATH')
        self.service.LORA_STATE = {'loaded': False, 'path': '', 'fingerprint': '', 'pipe': None}

    def tearDown(self):
        if self._env is None:
            self.service.os.environ.pop('JAPANO_FIT_LORA_PATH', None)
        else:
            self.service.os.environ['JAPANO_FIT_LORA_PATH'] = self._env
        self.service.LORA_STATE = {'loaded': False, 'path': '', 'fingerprint': '', 'pipe': None}
        self.tmp.cleanup()

    def test_nap_dung_mot_lan_cho_nhieu_request(self):
        self.service.os.environ['JAPANO_FIT_LORA_PATH'] = str(self.ckpt_a)
        pipe = FakePipe()
        for _ in range(5):
            self.assertTrue(self.service.apply_fit_lora(pipe))
        self.assertEqual(pipe.load_calls, 1, 'LoRA bị nạp lại nhiều lần')

    def test_doi_checkpoint_thi_nap_lai(self):
        pipe = FakePipe()
        self.service.os.environ['JAPANO_FIT_LORA_PATH'] = str(self.ckpt_a)
        self.service.apply_fit_lora(pipe)
        self.service.os.environ['JAPANO_FIT_LORA_PATH'] = str(self.ckpt_b)
        self.service.apply_fit_lora(pipe)
        self.assertEqual(pipe.load_calls, 2)
        self.assertGreaterEqual(pipe.unload_calls, 1)

    def test_khong_cau_hinh_thi_khong_nap(self):
        self.service.os.environ.pop('JAPANO_FIT_LORA_PATH', None)
        pipe = FakePipe()
        self.assertFalse(self.service.apply_fit_lora(pipe))
        self.assertEqual(pipe.load_calls, 0)

    def test_checkpoint_thieu_thi_khong_nap_va_bao_loi(self):
        self.service.os.environ['JAPANO_FIT_LORA_PATH'] = str(Path(self.tmp.name) / 'khong-ton-tai')
        pipe = FakePipe()
        self.assertFalse(self.service.apply_fit_lora(pipe))
        self.assertEqual(self.service.fit_lora_status()['error'], 'checkpoint_missing')

    def test_thu_muc_khong_co_safetensors_thi_tu_choi(self):
        empty = Path(self.tmp.name) / 'empty'
        empty.mkdir()
        self.service.os.environ['JAPANO_FIT_LORA_PATH'] = str(empty)
        pipe = FakePipe()
        self.assertFalse(self.service.apply_fit_lora(pipe))
        self.assertEqual(self.service.fit_lora_status()['error'], 'no_safetensors')

    def test_health_bao_dung_trang_thai_va_khong_lo_secret(self):
        self.service.os.environ['JAPANO_FIT_LORA_PATH'] = str(self.ckpt_a)
        pipe = FakePipe()
        self.service.apply_fit_lora(pipe)
        status = self.service.fit_lora_status()
        self.assertTrue(status['adapterLoaded'])
        self.assertTrue(status['checkpointHash'])
        self.assertEqual(status['appliesToCategories'], self.service.FIT_LORA_CATEGORIES)
        blob = json.dumps(status)
        for secret in ('kaggle', 'KAGGLE', 'password', 'token'):
            self.assertNotIn(secret, blob.lower() if secret.islower() else blob)

    def test_lora_chi_ap_cho_danh_muc_da_train(self):
        # Miền dữ liệu là upper-body ⇒ mặc định chỉ 'tops'.
        self.assertIn('tops', self.service.FIT_LORA_CATEGORIES)
        self.assertNotIn('bottoms', self.service.FIT_LORA_CATEGORIES)
        self.assertNotIn('one-pieces', self.service.FIT_LORA_CATEGORIES)

    def test_danh_muc_ngoai_mien_thi_go_adapter(self):
        self.service.os.environ['JAPANO_FIT_LORA_PATH'] = str(self.ckpt_a)
        pipe = FakePipe()
        self.service.apply_fit_lora(pipe)
        self.assertFalse(self.service._detach_fit_lora(pipe))
        self.assertFalse(self.service.fit_lora_status()['adapterLoaded'])


class ProvenanceTest(unittest.TestCase):
    def test_manifest_dataset_co_license_va_khong_co_credential(self):
        manifest = BACKEND / 'ai_training/provenance/viton_hd.manifest.json'
        if not manifest.exists():
            self.skipTest('chưa tải dataset')
        data = json.loads(manifest.read_text(encoding='utf-8'))
        self.assertEqual(data['license'], 'CC-BY-NC-SA-4.0')
        self.assertFalse(data['containsCredential'])
        self.assertTrue(any('NonCommercial' in item for item in data['licenseImplications']))
        blob = manifest.read_text(encoding='utf-8').lower()
        for secret in ('kaggle.json', 'username', '"key"'):
            self.assertNotIn(secret, blob)


if __name__ == '__main__':
    unittest.main()
