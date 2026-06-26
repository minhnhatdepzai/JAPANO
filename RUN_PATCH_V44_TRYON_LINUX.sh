#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
chmod +x ./japano_mobile_v44/PATCH_V44_MOBILE_TRYON_SERVER.sh
./japano_mobile_v44/PATCH_V44_MOBILE_TRYON_SERVER.sh
echo
echo "Done. Hay restart backend."
