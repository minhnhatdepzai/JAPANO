@echo off
setlocal
cd /d C:\jp\v37
echo ============================================================
echo JAPANO V43 WEB FULL - products / tryon / webcam / link input
echo ============================================================

powershell -ExecutionPolicy Bypass -File ".\japano_web_v43\PATCH_V43_WEB_SERVER.ps1"

echo.
echo [1/4] Start AI Gateway if needed...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=(Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue); if(!$p){Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-Command','& \"C:\jp\ai\v41\RUN_JAPANO_AI_GATEWAY_V41.bat\"'} else {Write-Host 'AI Gateway already running on :8001'}"

echo.
echo [2/4] Start backend :4000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=(Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue); if(!$p){$cmd='cd C:\jp\v37; Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; .\.venv\Scripts\Activate.ps1; $env:PYTHON_BIN=\"$PWD\.venv\Scripts\python.exe\"; $env:JAPANO_AI_GATEWAY_URL=\"http://127.0.0.1:8001\"; npm run start-server'; Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-Command',$cmd} else {Write-Host 'Backend already running on :4000'}"

echo.
echo [3/4] Wait backend then seed V43 products...
timeout /t 8 /nobreak >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:4000/api/v43/web/seed-products' | ConvertTo-Json -Depth 4 } catch { Write-Host '[WARN] Seed failed. Backend may still be starting:' $_.Exception.Message }"

echo.
echo [4/4] Start Expo Web...
start "" http://localhost:8081/web
powershell -NoExit -ExecutionPolicy Bypass -Command "cd C:\jp\v37; $env:EXPO_PUBLIC_API_URL='http://localhost:4000'; npx expo start --web -c"
