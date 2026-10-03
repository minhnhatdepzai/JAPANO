"""Resume pinned upstream motion weights; never downloads customer data or executes model code."""
import argparse
import os
from pathlib import Path

JOBS = {
    'animation': ('MochunniaN1/One-to-All-1.3b_1', '99dc3796f33b6438d627dc042caa2b43afcbcb50',
                  'checkpoints/One-to-All-1.3b_1', ['*.json', '*.safetensors', 'README.md']),
    'text-vae': ('Wan-AI/Wan2.1-T2V-1.3B-Diffusers', '0fad780a534b6463e45facd96134c9f345acfa5b',
                 'pretrained_models/Wan2.1-T2V-1.3B-Diffusers', ['vae/*', 'text_encoder/*', 'tokenizer/*', 'model_index.json']),
    'pose': ('Wan-AI/Wan2.2-Animate-14B', 'cb93a225fbaf1ca100f54e79da8f994995b689b3',
             'pretrained_models', ['process_checkpoint/det/*', 'process_checkpoint/pose2d/*']),
}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('component', choices=JOBS)
    parser.add_argument('--root', type=Path, default=Path.home() / 'jp/ai/One-to-All-Animation')
    args = parser.parse_args()
    # Hundreds of small external ONNX tensors are much faster over ordinary HTTP.
    if args.component == 'pose':
        os.environ['HF_HUB_DISABLE_XET'] = '1'
    from huggingface_hub import snapshot_download
    repo, revision, subdir, patterns = JOBS[args.component]
    print(f'Downloading {repo}@{revision}', flush=True)
    destination = snapshot_download(repo, revision=revision, local_dir=args.root / subdir,
                                    allow_patterns=patterns, max_workers=12 if args.component == 'pose' else 3)
    print(f'Complete: {destination}', flush=True)
