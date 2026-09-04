"""Fail-closed audit for external virtual-try-on training sources.

This script never downloads data and never treats a mirror license as proof of
commercial rights. It verifies the local VITON-HD package used by the academic
experiment and makes license/access blockers visible before any training run.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "provenance" / "tryon_sources.manifest.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def count_files(path: Path) -> int:
    return sum(1 for item in path.iterdir() if item.is_file()) if path.is_dir() else 0


def main() -> int:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    sources = {item["id"]: item for item in data["sources"]}
    viton = sources["viton-hd-local"]
    root = Path(viton["localPath"])
    problems: list[str] = []

    expected = {"train": int(viton["trainPairs"]), "test": int(viton["testPairs"])}
    for split, total in expected.items():
        for folder in ("image", "cloth", "cloth-mask", "openpose_json", "image-parse-v3"):
            actual = count_files(root / split / folder)
            if actual != total:
                problems.append(f"{split}/{folder}: expected {total}, found {actual}")

    original = ROOT / "provenance" / "viton_hd.manifest.json"
    original_data = json.loads(original.read_text(encoding="utf-8"))
    for filename, expected_hash in original_data.get("checksums", {}).items():
        path = root / filename
        if not path.is_file():
            problems.append(f"missing checksum target: {path}")
        elif sha256(path) != expected_hash:
            problems.append(f"checksum mismatch: {path}")

    unsafe = [
        item["id"] for item in data["sources"]
        if item.get("policy") != "commercial_ok" and item.get("decision", "").lower().startswith("use in production")
    ]
    if unsafe:
        problems.append("non-commercial source incorrectly approved for production: " + ", ".join(unsafe))

    print(f"TRYON_DATA_SOURCES={len(sources)}")
    print(f"VITON_HD_LOCAL={'OK' if root.is_dir() and not problems else 'FAILED'}")
    print(f"TRAIN_PAIRS={expected['train']} TEST_PAIRS={expected['test']}")
    print("PRODUCTION_CHECKPOINT_APPROVED=false")
    for item in data["sources"]:
        print(f"- {item['id']}: {item['downloadStatus']} | {item['policy']}")
    if problems:
        for problem in problems:
            print(f"ERROR: {problem}")
        return 1
    print("AUDIT_OK — local academic dataset is intact; external license gates remain enforced.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
