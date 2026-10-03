import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from model_readiness import missing_flux_files


class ReadinessTests(unittest.TestCase):
    def test_config_alone_does_not_mean_complete_model(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'model_index.json').write_text('{}')
            self.assertIn('transformer/diffusion_pytorch_model.safetensors', missing_flux_files(root))
            (root / 'text_encoder').mkdir()
            (root / 'text_encoder/model.safetensors.index.json').write_text(json.dumps({'weight_map': {'a':'part1.safetensors', 'b':'part2.safetensors'}}))
            (root / 'text_encoder/part1.safetensors').write_bytes(b'nonempty')
            self.assertIn('text_encoder/part2.safetensors', missing_flux_files(root))
            self.assertNotIn('text_encoder/part1.safetensors', missing_flux_files(root))

    def test_malformed_index_is_not_ready(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'text_encoder').mkdir()
            (root / 'text_encoder/model.safetensors.index.json').write_text('broken')
            self.assertIn('text_encoder/model.safetensors.index.json', missing_flux_files(root))


if __name__ == '__main__':
    unittest.main()
