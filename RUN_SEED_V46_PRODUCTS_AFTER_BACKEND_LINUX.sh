#!/usr/bin/env bash
set -e
echo "Seeding V46 shop products into database..."
curl -X POST "http://127.0.0.1:4000/api/v46/shop/seed-products" \
  -H "Content-Type: application/json" \
  -d "{}"
echo
echo "Done seed V46."
