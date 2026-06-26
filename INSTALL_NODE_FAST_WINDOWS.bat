@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ========================================
echo JAPANO - Cai Node packages nhanh, khong bi ket registry
echo ========================================
echo.
where node >nul 2>nul || (echo [LOI] Chua cai Node.js LTS. & pause & exit /b 1)
where npm >nul 2>nul || (echo [LOI] Chua co npm. & pause & exit /b 1)

echo [1/5] Set registry public npmjs...
npm config set registry https://registry.npmjs.org/
npm config set legacy-peer-deps true
npm config set audit false
npm config set fund false
npm config set fetch-retries 3
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000

echo.
echo [2/5] Xoa node_modules cu neu co...
if exist node_modules rmdir /s /q node_modules

echo.
echo [3/5] Kiem tra package-lock khong con registry noi bo...
findstr /i "applied-caas internal.api.openai artifactory" package-lock.json >nul 2>nul
if %errorlevel%==0 (
  echo [CANH BAO] package-lock van con registry noi bo. Dang xoa package-lock de npm tao lai public...
  del /f /q package-lock.json
)

echo.
echo [4/5] Verify npm cache...
npm cache verify

echo.
echo [5/5] Cai packages...
npm install --legacy-peer-deps --no-audit --no-fund --prefer-online
if errorlevel 1 (
  echo.
  echo [LOI] npm install that bai. Thu cach manh tay hon...
  npm cache clean --force
  npm install --legacy-peer-deps --no-audit --no-fund --prefer-online
)

echo.
echo ========================================
echo XONG NODE PACKAGES
echo ========================================
pause
