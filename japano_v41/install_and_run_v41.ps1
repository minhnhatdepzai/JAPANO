param(
  [ValidateSet('recommended','full','gateway-only','patch-only')]
  [string]$Mode = 'recommended'
)

$ErrorActionPreference = 'Continue'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$AiRoot = 'C:\jp\ai\v41'
$ModelRoot = Join-Path $AiRoot 'models'
$GatewayRoot = Join-Path $AiRoot 'gateway'
$LogRoot = Join-Path $AiRoot 'logs'
$GatewayPort = if ($env:JAPANO_AI_GATEWAY_PORT) { $env:JAPANO_AI_GATEWAY_PORT } else { '8001' }
$GatewayUrl = "http://127.0.0.1:$GatewayPort"

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function FailSoft($msg) { Write-Host "[SKIP/FAIL] $msg" -ForegroundColor DarkYellow }
function CmdExists($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

Step "Tao thu muc AI V41"
New-Item -ItemType Directory -Force -Path $AiRoot, $ModelRoot, $GatewayRoot, $LogRoot | Out-Null
Copy-Item -Force (Join-Path $PSScriptRoot 'gateway_v41.py') (Join-Path $GatewayRoot 'gateway_v41.py')
Copy-Item -Force (Join-Path $PSScriptRoot 'requirements_v41.txt') (Join-Path $GatewayRoot 'requirements_v41.txt')
Copy-Item -Force (Join-Path $PSScriptRoot 'model_manifest_v41.json') (Join-Path $AiRoot 'model_manifest_v41.json')

Step "Set bien moi truong Windows/Android/Java"
$javaHome = 'C:\Program Files\Android\Android Studio\jbr'
if (Test-Path "$javaHome\bin\java.exe") {
  $env:JAVA_HOME = $javaHome
  $env:Path = "$env:JAVA_HOME\bin;$env:Path"
  Ok "JAVA_HOME=$env:JAVA_HOME"
} else {
  Warn "Khong thay Android Studio JBR. Neu build Android loi JAVA_HOME, cai Android Studio/JDK 17-21."
}
$androidSdk = "$env:LOCALAPPDATA\Android\Sdk"
if (Test-Path $androidSdk) {
  $env:ANDROID_HOME = $androidSdk
  $env:ANDROID_SDK_ROOT = $androidSdk
  $env:Path = "$androidSdk\platform-tools;$androidSdk\emulator;$env:Path"
  if (Test-Path (Join-Path $ProjectRoot 'android')) {
    $sdkDir = $androidSdk -replace '\\','/'
    "sdk.dir=$sdkDir" | Set-Content -Path (Join-Path $ProjectRoot 'android\local.properties') -Encoding ASCII
  }
  Ok "ANDROID_HOME=$env:ANDROID_HOME"
}
$env:EXPO_PUBLIC_API_URL = if ($env:EXPO_PUBLIC_API_URL) { $env:EXPO_PUBLIC_API_URL } else { 'http://10.0.2.2:4000' }
$env:JAPANO_AI_GATEWAY_URL = $GatewayUrl
$env:JAPANO_AI_GATEWAY_URL_ANDROID = "http://10.0.2.2:$GatewayPort"
$env:JAPANO_AI_LOCAL_FIRST = '1'
$env:JAPANO_AI_ALLOW_API_FALLBACK = if ($env:JAPANO_AI_ALLOW_API_FALLBACK) { $env:JAPANO_AI_ALLOW_API_FALLBACK } else { '1' }

Step "Patch backend route V41"
if ($Mode -ne 'gateway-only') {
  powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'patch_server_v41.ps1') -ProjectRoot $ProjectRoot -GatewayPort $GatewayPort
}

Step "Cai Python venv cho AI Gateway"
$python = $env:PYTHON_BIN
if (-not $python) { $python = 'python' }
if (-not (CmdExists $python)) { $python = 'py' }
$venv = Join-Path $GatewayRoot '.venv'
if (-not (Test-Path (Join-Path $venv 'Scripts\python.exe'))) {
  & $python -m venv $venv
}
$py = Join-Path $venv 'Scripts\python.exe'
if (-not (Test-Path $py)) {
  Write-Host "[ERROR] Khong tao duoc Python venv. Hay cai Python 3.10/3.11 va chay lai." -ForegroundColor Red
  exit 1
}
& $py -m pip install --upgrade pip setuptools wheel
& $py -m pip install -r (Join-Path $GatewayRoot 'requirements_v41.txt')

Step "Thu cai PyTorch CUDA neu chua co"
& $py -c "import torch; print('[OK] torch', torch.__version__, 'cuda=', torch.cuda.is_available())"
if ($LASTEXITCODE -ne 0) {
  Warn "Torch chua co. Thu cai torch CUDA. Neu loi, script van tiep tuc de gateway chay CPU/fallback."
  & $py -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
  if ($LASTEXITCODE -ne 0) {
    & $py -m pip install torch torchvision
  }
}

if ($Mode -ne 'gateway-only' -and $Mode -ne 'patch-only') {
  Step "Keo Ollama model chat/vision/embedding"
  if (CmdExists ollama) {
    Start-Process -WindowStyle Minimized -FilePath "ollama" -ArgumentList "serve" -ErrorAction SilentlyContinue | Out-Null
    Start-Sleep -Seconds 2
    $ollamaModels = @('qwen3:8b','qwen3:14b','llama3.2-vision:11b','nomic-embed-text')
    foreach ($m in $ollamaModels) {
      Write-Host "ollama pull $m"
      & ollama pull $m
      if ($LASTEXITCODE -ne 0) { FailSoft "Khong pull duoc $m. Co the model khong ton tai trong Ollama cua may ban hoac mang loi." }
    }
  } else {
    Warn "Chua cai Ollama. Bo qua Ollama pull. Cai Ollama roi chay lai de co qwen/vision."
  }

  Step "Tai model Hugging Face theo manifest"
  & $py -m pip install "huggingface_hub[cli]" hf_transfer
  $env:HF_HUB_ENABLE_HF_TRANSFER = '1'
  $manifest = Get-Content (Join-Path $AiRoot 'model_manifest_v41.json') -Raw | ConvertFrom-Json
  $targets = if ($Mode -eq 'full') { $manifest.models } else { $manifest.models | Where-Object { $_.tier -eq 'recommended' } }
  foreach ($item in $targets) {
    $dest = Join-Path $ModelRoot $item.local_dir
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Write-Host "`n[MODEL] $($item.name) -> $dest"
    if ($item.type -eq 'python_package') { continue }
    if ($item.type -eq 'note_only') { Warn $item.note; continue }
    if ($item.repo -and $item.repo -ne '') {
      & $py -m huggingface_hub.cli download $item.repo --local-dir $dest --local-dir-use-symlinks False
      if ($LASTEXITCODE -ne 0) {
        FailSoft "Tai $($item.repo) chua thanh cong. Co the repo gated/doi license/can HF token. Xem model_manifest_v41.json de sua repo/token."
      }
    }
  }
}

Step "Tao file chay gateway"
$runGateway = Join-Path $AiRoot 'RUN_JAPANO_AI_GATEWAY_V41.bat'
@"
@echo off
chcp 65001 >nul
set JAPANO_AI_MODELS_DIR=$ModelRoot
set JAPANO_AI_GATEWAY_PORT=$GatewayPort
set OLLAMA_URL=http://127.0.0.1:11434
set OLLAMA_TEXT_MODEL=qwen3:8b
set OLLAMA_VISION_MODEL=llama3.2-vision:11b
cd /d "$GatewayRoot"
"$py" gateway_v41.py
pause
"@ | Set-Content -Path $runGateway -Encoding ASCII
Ok "Gateway runner: $runGateway"

Step "Mo gateway V41"
Start-Process -FilePath $runGateway -WindowStyle Normal
Start-Sleep -Seconds 5
try {
  $health = Invoke-RestMethod -Uri "$GatewayUrl/health" -TimeoutSec 5
  Ok "AI Gateway da chay: $GatewayUrl/health"
  $health | ConvertTo-Json -Depth 6
} catch {
  Warn "Chua ping duoc gateway. Neu cua so gateway dang cai/load model, cho them vai phut roi mo $GatewayUrl/health"
}

Step "Cach chay app"
Write-Host "Terminal 1 backend:"
Write-Host "  cd $ProjectRoot"
Write-Host "  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass"
Write-Host "  .\.venv\Scripts\Activate.ps1"
Write-Host "  `$env:PYTHON_BIN=`"`$PWD\.venv\Scripts\python.exe`""
Write-Host "  `$env:JAPANO_AI_GATEWAY_URL=`"$GatewayUrl`""
Write-Host "  npm run start-server"
Write-Host ""
Write-Host "Terminal 2 app Android emulator:"
Write-Host "  cd $ProjectRoot"
Write-Host "  `$env:EXPO_PUBLIC_API_URL=`"http://10.0.2.2:4000`""
Write-Host "  npx expo start -c --dev-client"
Write-Host ""
Write-Host "Neu chua co dev build tren may ao:"
Write-Host "  npx expo run:android"

