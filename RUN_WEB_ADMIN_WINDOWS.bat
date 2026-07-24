@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo JAPANO - Run Web Admin + Backend
echo ========================================
echo.
where node >nul 2>nul || (echo [LOI] Chua cai Node.js LTS. & pause & exit /b 1)
where npm >nul 2>nul || (echo [LOI] Chua co npm. & pause & exit /b 1)

if not exist node_modules (
  echo Dang cai node_modules...
  call npm install --legacy-peer-deps --no-audit --no-fund
  if errorlevel 1 (
    echo [LOI] npm install loi.
    pause
    exit /b 1
  )
)

(
  echo EXPO_PUBLIC_API_URL=
  echo EXPO_PUBLIC_API_TIMEOUT_MS=12000
) > .env

echo Mo backend o http://localhost:4000 ...
start "JAPANO BACKEND" cmd /k "cd /d %~dp0 && npm run start-server"
timeout /t 4 /nobreak >nul

echo Mo Expo Web. Vao /admin de quan tri.
start "JAPANO WEB ADMIN" cmd /k "cd /d %~dp0 && npx expo start --web -c"
echo.
echo Test backend: mo http://localhost:4000/api/health trong trinh duyet.
pause
