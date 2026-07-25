@echo off
powershell -ExecutionPolicy Bypass -Command "Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:4000/api/v46/shop/seed-products' -ContentType 'application/json' -Body '{}' | ConvertTo-Json -Depth 5"
pause
