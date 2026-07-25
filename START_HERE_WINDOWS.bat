@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ========================================
echo JAPANO - Setup + Run Backend + Expo Go
 echo ========================================
echo.

where node >nul 2>nul || (echo [LOI] Chua cai Node.js LTS. & pause & exit /b 1)
where npm >nul 2>nul || (echo [LOI] Chua co npm. & pause & exit /b 1)
where py >nul 2>nul || (echo [LOI] Chua cai Python 3.11. & pause & exit /b 1)
where ollama >nul 2>nul || echo [CANH BAO] Chua cai Ollama, backend van chay nhung chatbot Ollama co the loi.

echo [1/8] Set npm registry public...
npm config set registry https://registry.npmjs.org/
npm config set legacy-peer-deps true
npm config set audit false
npm config set fund false

if not exist node_modules (
  echo.
  echo [2/8] Dang cai node_modules...
  call npm install --legacy-peer-deps --no-audit --no-fund --prefer-online
  if errorlevel 1 (
    echo [LOI] npm install loi. Mo INSTALL_NODE_FAST_WINDOWS.bat de cai rieng va xem loi.
    pause
    exit /b 1
  )
) else (
  echo [2/8] node_modules da co, bo qua npm install.
)

echo.
echo [3/8] Tao .venv Python neu chua co...
if not exist .venv (
  py -3.11 -m venv .venv
  if errorlevel 1 (
    echo [LOI] Khong tao duoc .venv. Hay cai Python 3.11 roi chay lai.
    pause
    exit /b 1
  )
)

echo.
echo [4/8] Cai Python AI packages Emotion/Age model...
.\.venv\Scripts\python.exe -m pip install --upgrade pip setuptools wheel
.\.venv\Scripts\pip.exe install -r server\vision-requirements.txt

echo.
echo [5/8] Dat API URL o che do tu dong...
(
  echo EXPO_PUBLIC_API_URL=
  echo EXPO_PUBLIC_API_TIMEOUT_MS=12000
) > .env
echo API URL: AUTO - Web dung localhost/host hien tai, Expo Go dung IP may chay Metro.

echo.
echo [6/8] Tai model Ollama neu co Ollama...
where ollama >nul 2>nul && ollama pull qwen2.5:1.5b

echo.
echo [7/8] Mo Ollama server...
where ollama >nul 2>nul && start "OLLAMA" cmd /k "ollama serve"

echo.
echo [8/8] Mo backend va Expo Go...
start "JAPANO BACKEND" cmd /k "cd /d %~dp0 && .\.venv\Scripts\activate.bat && npm run start-server"
timeout /t 4 /nobreak >nul
start "JAPANO EXPO GO" cmd /k "cd /d %~dp0 && npx expo start -c --host lan"

echo.
echo Da mo 3 cua so: Ollama, Backend, Expo Go.
echo Dung dien thoai mo Expo Go va quet QR.
pause
