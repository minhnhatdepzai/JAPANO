#!/usr/bin/env bash
set -euo pipefail

REPOSITORY="${JAPANO_AI_RELEASE_REPOSITORY:-minhnhatdepzai/JAPANO}"
TAG="${JAPANO_AI_RELEASE_TAG:-ai-runtime-2026-10-07}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOWNLOAD_DIR="${JAPANO_AI_DOWNLOAD_DIR:-$ROOT_DIR/.ai-release-download}"

usage() {
  echo "Usage: $0 [--tag TAG] [--download-dir DIR]"
  echo "Downloads the pre-trained JAPANO artifacts and local runtime model bundle from GitHub Releases."
}

while (($#)); do
  case "$1" in
    --tag)
      TAG="$2"
      shift 2
      ;;
    --download-dir)
      DOWNLOAD_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for command_name in gh sha256sum tar zstd; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
done

mkdir -p "$DOWNLOAD_DIR"
echo "Downloading JAPANO AI release $TAG from $REPOSITORY ..."
gh release download "$TAG" \
  --repo "$REPOSITORY" \
  --pattern 'japano-ai-*' \
  --pattern 'SHA256SUMS' \
  --dir "$DOWNLOAD_DIR" \
  --clobber

(
  cd "$DOWNLOAD_DIR"
  sha256sum --check SHA256SUMS
)

extract_parts() {
  local prefix="$1"
  local destination="$2"
  local archive="$DOWNLOAD_DIR/${prefix}.tar.zst"
  local -a parts=()

  mapfile -d '' parts < <(find "$DOWNLOAD_DIR" -maxdepth 1 -type f \
    -name "${prefix}.tar.zst.part-*" -print0 | sort -z)
  mkdir -p "$destination"
  if ((${#parts[@]})); then
    cat "${parts[@]}" | tar --zstd -xf - -C "$destination"
  elif [[ -f "$archive" ]]; then
    tar --zstd -xf "$archive" -C "$destination"
  else
    echo "Missing archive or parts for $prefix" >&2
    exit 1
  fi
}

extract_parts japano-ai-trained-runs "$ROOT_DIR"
extract_parts japano-ai-workbench "$ROOT_DIR"
extract_parts japano-ai-flux "$HOME/jp/ai"
extract_parts japano-ai-fashn "$HOME/jp/ai"
extract_parts japano-ai-motion "$HOME/jp/ai"
extract_parts japano-ai-hf-cache "$HOME/.cache/huggingface"
extract_parts japano-ai-ollama-qwen3-vl "$HOME"
extract_parts japano-ai-body-cache "$HOME"

echo "AI artifacts restored and SHA-256 verified."
echo "No fine-tuning or model-weight download is required."
echo "Install the documented Node/Python system dependencies, configure .env, then run: ./run-all.sh --no-phone"
