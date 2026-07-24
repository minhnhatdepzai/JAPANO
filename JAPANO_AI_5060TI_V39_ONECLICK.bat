@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

title JAPANO AI 5060Ti V39 Local-First OneClick

REM ================================================================
REM  JAPANO AI FASHION ASSISTANT V39 - NVIDIA 5060Ti 16GB
REM  1 file chạy toàn bộ hướng Local-First + API fallback.
REM
REM  MỤC TIÊU:
REM  - Giữ nguyên API cũ: Gemini / Fotor / Cloudinary / Stripe / MongoDB.
REM  - Ưu tiên AI local qua Ollama trước; khi local lỗi/chưa có model thì backend vẫn còn API/demomode fallback.
REM  - Tối ưu cho NVIDIA 5060Ti 16GB: dùng model 14B khi tải được, 8B khi cần nhanh.
REM  - Chạy máy ảo Android Studio / Pixel 8 Pro bằng 10.0.2.2 thay cho IP LAN.
REM
REM  MODEL MATRIX TRONG FILE:
REM  [Chat chính chất lượng]      qwen3:14b
REM  [Chat nhanh mặc định]       qwen3:8b
REM  [Fallback nhẹ]              qwen2.5:7b
REM  [Vision ảnh]                llama3.2-vision:11b, gemma4:12b nếu Ollama hỗ trợ
REM  [Embedding text]            nomic-embed-text, qwen3-embedding:0.6b, qwen3-embedding:4b nếu Ollama hỗ trợ
REM  [Tạo ảnh khuyên dùng]       SDXL-Turbo, FLUX.2 klein 4B, FLUX.1-schnell, SD3.5 Turbo, Qwen-Image
REM  [Try-on / Fashion local]    CatVTON
REM  [Tách nền / mask]           BiRefNet, SAM 2
REM  [Camera realtime]           MediaPipe + YOLO
REM
REM  LƯU Ý:
REM  - File này tự kéo model Ollama. Các model ảnh rất nặng như FLUX/CatVTON/Qwen-Image
REM    không nhúng trực tiếp vào file .bat; chúng được liệt kê trong file và để dành cho bước ComfyUI/CatVTON.
REM  - Nếu model Ollama nào chưa tồn tại trên registry của bạn, script sẽ bỏ qua và dùng model đã tải được.
REM  - Chạy tốt nhất ở project path ngắn: C:\jp\v37
REM ================================================================

echo.
echo ================================================================
echo   JAPANO AI 5060Ti V39 - LOCAL FIRST ONE CLICK
echo ================================================================
echo.

REM --- Locate project ---
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR:~0,-1%"

if not exist "%PROJECT_DIR%\package.json" (
  if exist "C:\jp\v37\package.json" (
    set "PROJECT_DIR=C:\jp\v37"
  )
)

if not exist "%PROJECT_DIR%\package.json" (
  echo [LOI] Khong thay package.json.
  echo Hay copy file nay vao thu muc project, vi du: C:\jp\v37
  echo Hoac dam bao project nam tai C:\jp\v37
  pause
  exit /b 1
)

cd /d "%PROJECT_DIR%"
echo [OK] Project: %CD%

REM --- Basic checks ---
where npm >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua co Node.js/npm. Hay cai Node.js LTS roi chay lai.
  pause
  exit /b 1
)

REM --- Java + Android SDK ---
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "Path=%JAVA_HOME%\bin;%Path%"

set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "Path=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%Path%"

if not exist "%JAVA_HOME%\bin\java.exe" (
  echo [CANH BAO] Khong thay Java Android Studio tai: %JAVA_HOME%
  echo Neu build loi JAVA_HOME, hay cai Android Studio day du.
) else (
  echo [OK] JAVA_HOME=%JAVA_HOME%
)

if not exist "%ANDROID_HOME%" (
  echo [LOI] Khong thay Android SDK tai: %ANDROID_HOME%
  echo Mo Android Studio ^> SDK Manager de kiem tra Android SDK Location.
  pause
  exit /b 1
) else (
  echo [OK] ANDROID_HOME=%ANDROID_HOME%
)

REM --- Node dependencies ---
if not exist "%PROJECT_DIR%\node_modules" (
  echo.
  echo [JAPANO] Cai node_modules lan dau...
  call npm install --legacy-peer-deps
  if errorlevel 1 (
    echo [LOI] npm install that bai.
    pause
    exit /b 1
  )
) else (
  echo [OK] node_modules da co. Bo qua npm install.
)

REM --- Android local.properties ---
if not exist "%PROJECT_DIR%\android" (
  echo.
  echo [JAPANO] Chua co thu muc android. Dang prebuild...
  call npx expo prebuild --platform android
  if errorlevel 1 (
    echo [LOI] expo prebuild that bai.
    pause
    exit /b 1
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$sdk=$env:ANDROID_HOME -replace '\\','/'; Set-Content -Path '.\android\local.properties' -Value ('sdk.dir=' + $sdk) -Encoding ASCII"

REM --- Reduce Android emulator build arch to x86_64 for faster emulator builds ---
powershell -NoProfile -ExecutionPolicy Bypass -Command "if(Test-Path '.\android\gradle.properties'){ $p='.\android\gradle.properties'; $s=Get-Content $p -Raw; if($s -match '(?m)^reactNativeArchitectures='){ $s=$s -replace '(?m)^reactNativeArchitectures=.*','reactNativeArchitectures=x86_64' } else { $s += \"`r`nreactNativeArchitectures=x86_64`r`n\" }; Set-Content $p $s -Encoding UTF8 }"

REM --- Clean dangerous long/native cache only ---
if exist ".\android\app\.cxx" rmdir /s /q ".\android\app\.cxx"
if exist ".\android\build" rmdir /s /q ".\android\build"
if exist ".\android\app\build" rmdir /s /q ".\android\app\build"

REM --- Install/Start Ollama ---
where ollama >nul 2>nul
if errorlevel 1 (
  echo.
  echo [JAPANO] Chua thay Ollama. Thu cai bang winget...
  where winget >nul 2>nul
  if errorlevel 1 (
    echo [LOI] Khong co winget. Hay cai Ollama thu cong: https://ollama.com/download
    pause
    exit /b 1
  )
  winget install --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements
)

where ollama >nul 2>nul
if errorlevel 1 (
  echo [LOI] Cai Ollama xong nhung lenh ollama chua nhan. Dong terminal/VSCode mo lai roi chay file nay.
  pause
  exit /b 1
)

echo.
echo [JAPANO] Kiem tra Ollama server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing 'http://localhost:11434/api/tags' -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo [JAPANO] Dang mo Ollama server o cua so rieng...
  start "JAPANO Ollama :11434" cmd /k "ollama serve"
  timeout /t 8 /nobreak >nul
)

REM --- Pull models. Error is allowed; script will continue. ---
echo.
echo ================================================================
echo   PULL MODEL OLLAMA - uu tien 5060Ti 16GB
echo ================================================================
call :PullModel "qwen3:8b" "Chat nhanh cho user"
call :PullModel "qwen3:14b" "Chat chinh chat luong cao cho 5060Ti 16GB"
call :PullModel "qwen2.5:7b" "Fallback nhe neu qwen3 khong co"
call :PullModel "llama3.2-vision:11b" "Vision doc anh"
call :PullModel "gemma4:12b" "Vision du phong neu Ollama co"
call :PullModel "nomic-embed-text" "Embedding text on dinh"
call :PullModel "qwen3-embedding:0.6b" "Embedding Qwen nhe neu Ollama co"
call :PullModel "qwen3-embedding:4b" "Embedding Qwen manh neu Ollama co"

REM --- Select primary model ---
set "PRIMARY_MODEL=qwen3:14b"
ollama list | findstr /i /c:"qwen3:14b" >nul 2>nul
if errorlevel 1 set "PRIMARY_MODEL=qwen3:8b"
ollama list | findstr /i /c:"!PRIMARY_MODEL!" >nul 2>nul
if errorlevel 1 set "PRIMARY_MODEL=qwen2.5:7b"

echo.
echo [JAPANO] Model chat se dung: !PRIMARY_MODEL!
echo [JAPANO] API backend cho Android Emulator: http://10.0.2.2:4000

REM --- Write runner folder ---
if not exist ".japano-run" mkdir ".japano-run"

REM --- Backend runner ---
(
echo $ErrorActionPreference = 'Continue'
echo Set-Location -LiteralPath '%PROJECT_DIR%'
echo Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
echo if ^(Test-Path '.\.venv\Scripts\Activate.ps1'^) { . '.\.venv\Scripts\Activate.ps1' }
echo $env:PYTHON_BIN = Join-Path ^(Get-Location^) '.venv\Scripts\python.exe'
echo $env:PYTHONIOENCODING = 'utf-8'
echo $env:PYTHONUTF8 = '1'
echo $env:CUDA_VISIBLE_DEVICES = '0'
echo $env:OLLAMA_URL = 'http://localhost:11434'
echo $env:OLLAMA_MODEL = '%PRIMARY_MODEL%'
echo $env:OLLAMA_TIMEOUT_MS = '60000'
echo $env:OLLAMA_COOLDOWN_MS = '15000'
echo $env:AI_LOCAL_FIRST = '1'
echo $env:JAPANO_GPU_PROFILE = 'NVIDIA_5060TI_16GB'
echo $env:LOCAL_AI_CHAT_FAST = 'qwen3:8b'
echo $env:LOCAL_AI_CHAT_BEST = 'qwen3:14b'
echo $env:LOCAL_AI_VISION = 'llama3.2-vision:11b'
echo $env:LOCAL_AI_EMBED_TEXT = 'nomic-embed-text'
echo $env:LOCAL_AI_IMAGE_FAST = 'SDXL-Turbo'
echo $env:LOCAL_AI_IMAGE_BEST = 'FLUX.2-klein-4B'
echo $env:LOCAL_AI_TRYON = 'CatVTON'
echo $env:LOCAL_AI_SEGMENT = 'SAM2/BiRefNet'
echo Write-Host '[JAPANO] Backend local-first dang chay tai http://localhost:4000'
echo npm run start-server
) > ".japano-run\backend.ps1"

REM --- Frontend/dev-client runner ---
(
echo $ErrorActionPreference = 'Continue'
echo Set-Location -LiteralPath '%PROJECT_DIR%'
echo $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
echo $env:ANDROID_HOME = '%ANDROID_HOME%'
echo $env:ANDROID_SDK_ROOT = '%ANDROID_SDK_ROOT%'
echo $env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
echo $env:EXPO_PUBLIC_API_URL = 'http://10.0.2.2:4000'
echo $env:EXPO_PUBLIC_AI_MODE = 'local-first-api-fallback'
echo $env:EXPO_PUBLIC_GPU_PROFILE = 'NVIDIA_5060TI_16GB'
echo Write-Host '[JAPANO] Expo dev client se ket noi API: ' $env:EXPO_PUBLIC_API_URL
echo npx expo start -c --dev-client
) > ".japano-run\expo-dev-client.ps1"

REM --- Start backend in new PowerShell window ---
echo.
echo [JAPANO] Mo backend server o cua so rieng...
start "JAPANO Backend :4000" powershell -NoExit -ExecutionPolicy Bypass -File "%PROJECT_DIR%\.japano-run\backend.ps1"

REM --- Wait backend health ---
echo [JAPANO] Doi backend :4000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; for($i=0;$i -lt 45;$i++){ try { Invoke-WebRequest -UseBasicParsing 'http://localhost:4000/api/health' -TimeoutSec 2 | Out-Null; $ok=$true; break } catch { Start-Sleep -Seconds 2 } }; if($ok){ exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo [CANH BAO] Chua ping duoc /api/health. Van tiep tuc mo app, neu app loi hay xem cua so Backend.
) else (
  echo [OK] Backend da san sang.
)

REM --- Ensure emulator/device ---
echo.
echo [JAPANO] Kiem tra Android emulator/device...
adb devices | findstr /r /c:"device$" >nul 2>nul
if errorlevel 1 (
  echo [JAPANO] Chua thay emulator. Thu mo AVD dau tien...
  set "FIRST_AVD="
  for /f "usebackq tokens=*" %%A in (`emulator -list-avds`) do (
    if not defined FIRST_AVD set "FIRST_AVD=%%A"
  )
  if defined FIRST_AVD (
    echo [JAPANO] Dang mo emulator: !FIRST_AVD!
    start "JAPANO Android Emulator" "%ANDROID_HOME%\emulator\emulator.exe" -avd "!FIRST_AVD!" -gpu host
    echo [JAPANO] Doi emulator boot...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "for($i=0;$i -lt 90;$i++){ $d = adb devices; if($d -match 'device\s*$'){ exit 0 }; Start-Sleep -Seconds 2 }; exit 1"
  ) else (
    echo [LOI] Khong tim thay AVD. Hay tao Pixel 8 Pro trong Android Studio truoc.
    pause
    exit /b 1
  )
)

adb devices
echo.

REM --- Check if dev build installed ---
set "APP_PACKAGE=com.leminhnhat123.japanofashionai"
adb shell pm list packages %APP_PACKAGE% | findstr /i "%APP_PACKAGE%" >nul 2>nul
if errorlevel 1 (
  echo ================================================================
  echo   LAN DAU: Build va cai dev app vao Android Emulator
  echo ================================================================
  set "EXPO_PUBLIC_API_URL=http://10.0.2.2:4000"
  set "EXPO_PUBLIC_AI_MODE=local-first-api-fallback"
  call npx expo run:android
  if errorlevel 1 (
    echo.
    echo [LOI] Build Android that bai.
    echo Neu thay loi "No matching variant" hay chay:
    echo   rmdir /s /q node_modules
    echo   rmdir /s /q android
    echo   npm install --legacy-peer-deps
    echo   npx expo prebuild --platform android
    echo Roi chay lai file nay.
    pause
    exit /b 1
  )
) else (
  echo ================================================================
  echo   APP DA CAI: Mo Metro dev-client
  echo ================================================================
  powershell -NoExit -ExecutionPolicy Bypass -File "%PROJECT_DIR%\.japano-run\expo-dev-client.ps1"
)

echo.
echo [DONE] JAPANO AI 5060Ti da khoi dong.
pause
exit /b 0

:PullModel
set "MODEL_NAME=%~1"
set "MODEL_NOTE=%~2"
echo.
echo [MODEL] %MODEL_NAME% - %MODEL_NOTE%
ollama list | findstr /i /c:"%MODEL_NAME%" >nul 2>nul
if not errorlevel 1 (
  echo [OK] Da co %MODEL_NAME%
  exit /b 0
)
ollama pull "%MODEL_NAME%"
if errorlevel 1 (
  echo [SKIP] Khong keo duoc %MODEL_NAME%. Se dung model/API fallback neu can.
  exit /b 0
)
echo [OK] Tai xong %MODEL_NAME%
exit /b 0
