@echo off
cd /d %~dp0
powershell -ExecutionPolicy Bypass -File ".\japano_mobile_v46\PATCH_V46_SEED_SHOP_PRODUCTS_SERVER.ps1"
echo.
echo [OK] Patch xong. Restart backend, sau do chay:
echo powershell -ExecutionPolicy Bypass -Command "Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:4000/api/v46/shop/seed-products' -ContentType 'application/json' -Body '{}'"
pause
