from huggingface_hub import snapshot_download

models = [
    ("stabilityai/sdxl-turbo", "C:/jp/ai/v41/models/sdxl-turbo"),
    ("zhengchong/CatVTON", "C:/jp/ai/v41/models/catvton"),
    ("ZhengPeng7/BiRefNet", "C:/jp/ai/v41/models/birefnet"),
]

for repo, out in models:
    print(f"\n[DOWNLOAD] {repo} -> {out}")
    try:
        snapshot_download(
            repo_id=repo,
            local_dir=out,
            local_dir_use_symlinks=False,
            resume_download=True
        )
        print(f"[OK] {repo}")
    except Exception as e:
        print(f"[SKIP/FAIL] {repo}: {e}")
        print("Neu bi gated/license thi dang nhap HuggingFace roi chay lai.")
