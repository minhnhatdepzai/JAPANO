@echo off
powershell -ExecutionPolicy Bypass -Command "Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:4000/api/v47/shop/seed-extra-accessories' -ContentType 'application/json' -Body '{}' | ConvertTo-Json -Depth 6"
pause
