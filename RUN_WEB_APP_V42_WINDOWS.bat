@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo JAPANO V42 WEB - Patch + Gateway + Backend + Web Frontend
echo Root: %CD%
echo ============================================================

powershell -NoProfile -ExecutionPolicy Bypass -File ".\japano_web_v42\PATCH_V42_WEB_SERVER.ps1"
if errorlevel 1 pause & exit /b 1

REM Mo AI Gateway neu chua chay. Neu port 8001 da chay thi cua so nay co the bao trung port, khong sao.
start "JAPANO AI Gateway V41" powershell -NoExit -ExecutionPolicy Bypass -Command "if ((Test-NetConnection 127.0.0.1 -Port 8001).TcpTestSucceeded) { Write-Host 'Gateway 8001 dang chay roi'; } else { & 'C:\jp\ai\v41\RUN_JAPANO_AI_GATEWAY_V41.bat' }"

timeout /t 3 /nobreak > nul

start "JAPANO Backend 4000" powershell -NoExit -ExecutionPolicy Bypass -Command "cd C:\jp\v37; Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; .\.venv\Scripts\Activate.ps1; $env:PYTHON_BIN='$PWD\.venv\Scripts\python.exe'; $env:JAPANO_AI_GATEWAY_URL='http://127.0.0.1:8001'; npm run start-server"

timeout /t 8 /nobreak > nul

start "JAPANO Web Frontend" powershell -NoExit -ExecutionPolicy Bypass -Command "cd C:\jp\v37; $env:EXPO_PUBLIC_API_URL='http://localhost:4000'; npx expo start --web -c"

timeout /t 5 /nobreak > nul
start http://localhost:8081/web

echo.
echo Da mo Gateway, Backend va Web Frontend.
echo Neu browser chua mo duoc, thu: http://localhost:8081/web
echo Neu Expo dung port khac, xem cua so JAPANO Web Frontend.
pause
