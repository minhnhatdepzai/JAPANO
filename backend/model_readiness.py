"""Check complete Diffusers checkpoints, not just their small config files."""
import json
from pathlib import Path


def missing_flux_files(root):
    root = Path(root)
    missing = []
    for name in ['model_index.json', 'transformer/config.json',
                 'transformer/diffusion_pytorch_model.safetensors',
                 'vae/config.json', 'vae/diffusion_pytorch_model.safetensors',
                 'text_encoder/config.json', 'tokenizer/tokenizer_config.json',
                 'scheduler/scheduler_config.json']:
        path = root / name
        if not path.is_file() or path.stat().st_size == 0:
            missing.append(name)
    index = root / 'text_encoder/model.safetensors.index.json'
    try:
        shards = set(json.loads(index.read_text())['weight_map'].values())
        if not shards: raise ValueError('empty index')
        for shard in shards:
            path = root / 'text_encoder' / shard
            if not path.is_file() or path.stat().st_size == 0:
                missing.append('text_encoder/' + shard)
    except (OSError, ValueError, KeyError, TypeError):
        missing.append('text_encoder/model.safetensors.index.json')
    return sorted(missing)
