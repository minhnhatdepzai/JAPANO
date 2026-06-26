#!/usr/bin/env bash
set -e
curl -X POST "http://127.0.0.1:4000/api/v49/shop/seed-extra-accessories" \
  -H "Content-Type: application/json" \
  -d "{}"
echo
echo "Done seed V49 accessories."
