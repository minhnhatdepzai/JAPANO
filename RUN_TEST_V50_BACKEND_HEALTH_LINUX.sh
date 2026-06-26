#!/usr/bin/env bash
set -e
echo "=== Test backend ==="
curl -s http://127.0.0.1:4000/api/v49/shop/products | head -c 500 || true
echo
echo
echo "=== Test gateway health ==="
curl -s http://127.0.0.1:8001/health || true
echo
