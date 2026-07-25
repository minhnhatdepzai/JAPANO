@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo =========================================
echo JAPANO - EAS Android Development Build
echo =========================================

echo.
echo [1/6] Set npm registry...
call npm config set registry https://registry.npmjs.org/

echo.
echo [2/6] Install Node packages...
call npm i --legacy-peer-deps --no-audit --no-fund
if errorlevel 1 goto fail

echo.
echo [3/6] Ensure expo-dev-client is installed for this Expo SDK...
call npx expo install expo-dev-client
if errorlevel 1 goto fail

echo.
echo [4/6] Install EAS CLI if missing...
where eas >nul 2>nul
if errorlevel 1 (
  call npm install -g eas-cli
  if errorlevel 1 goto fail
)

echo.
echo [5/6] Login/check Expo account...
call eas whoami >nul 2>nul
if errorlevel 1 (
  echo Bạn chưa login Expo. Vui lòng đăng nhập ở bước tiếp theo.
  call eas login
  if errorlevel 1 goto fail
)

echo.
echo [6/6] Link project to EAS if needed, then build Android development APK...
if not exist ".eas\project.json" (
  call eas init
)
call eas build --platform android --profile development
if errorlevel 1 goto fail

echo.
echo Build đã gửi lên EAS. Khi build xong, terminal sẽ hiện link/QR tải APK.
pause
exit /b 0

:fail
echo.
echo Có lỗi khi build EAS. Hãy đọc dòng lỗi phía trên.
pause
exit /b 1
