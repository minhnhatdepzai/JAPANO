@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo =========================================
echo JAPANO - Start Backend + Metro Dev Client
echo =========================================

for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.InterfaceAlias -notmatch 'Loopback|Virtual|VMware|vEthernet|Docker'} | Select-Object -First 1 -ExpandProperty IPAddress)"') do set IP=%%i

if not "%IP%"=="" (
  echo EXPO_PUBLIC_API_URL=http://%IP%:4000>.env
  echo .env đã set EXPO_PUBLIC_API_URL=http://%IP%:4000
) else (
  echo Không tự tìm được IP. Hãy sửa tay file .env nếu app không vào được backend.
)

echo.
echo Mở backend...
start "JAPANO Backend" cmd /k "cd /d %~dp0 && if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat && npm run start-server"

echo.
echo Mở Metro cho EAS Development Build...
start "JAPANO Metro Dev Client" cmd /k "cd /d %~dp0 && npx expo start --dev-client --host lan -c"

echo.
echo Sau khi Metro hiện QR, mở app Development Build trên điện thoại rồi Scan QR / Fetch development servers.
pause
