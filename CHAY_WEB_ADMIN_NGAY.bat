@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo JAPANO V37 - CHAY WEB ADMIN NGAY
echo ========================================
echo.
where node >nul 2>nul || (echo [LOI] Chua cai Node.js LTS: https://nodejs.org/ & pause & exit /b 1)
where npm >nul 2>nul || (echo [LOI] Chua co npm. Cai Node.js LTS roi chay lai. & pause & exit /b 1)

if not exist package.json (
  echo [LOI] Ban dang khong dung dung thu muc. Thu muc nay phai co package.json.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/3] Dang cai node_modules...
  call npm install --legacy-peer-deps --no-audit --no-fund --prefer-online
  if errorlevel 1 (
    echo [LOI] npm install loi. Thu chay: npm cache clean --force
    pause
    exit /b 1
  )
) else (
  echo [1/3] node_modules da co, bo qua npm install.
)

(
  echo EXPO_PUBLIC_API_URL=
  echo EXPO_PUBLIC_API_TIMEOUT_MS=12000
) > .env

echo [2/3] Mo backend http://localhost:4000 ...
start "JAPANO V37 BACKEND" cmd /k "cd /d %~dp0 && npm run start-server"
timeout /t 4 /nobreak >nul

echo [3/3] Mo Expo Web Admin ...
start "JAPANO V37 WEB" cmd /k "cd /d %~dp0 && npx expo start --web -c"

echo.
echo Test backend: http://localhost:4000/api/health
echo Test Cloudinary: http://localhost:4000/api/cloudinary/config
echo Test Stripe: http://localhost:4000/api/stripe/config
echo Admin: mo web Expo, vao /admin, login a@gmail.com / 1
echo.
pause
