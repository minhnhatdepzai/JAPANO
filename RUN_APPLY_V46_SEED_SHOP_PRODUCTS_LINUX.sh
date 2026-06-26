#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
chmod +x ./japano_mobile_v46/PATCH_V46_SEED_SHOP_PRODUCTS_SERVER.sh
./japano_mobile_v46/PATCH_V46_SEED_SHOP_PRODUCTS_SERVER.sh

echo
echo "[OK] Patch xong."
echo "Bây giờ restart backend, sau đó chạy:"
echo "curl -X POST http://127.0.0.1:4000/api/v46/shop/seed-products -H 'Content-Type: application/json' -d '{}'"
