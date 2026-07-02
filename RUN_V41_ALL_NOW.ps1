$ErrorActionPreference="Continue"
cd C:\jp\v37

Write-Host "=== JAPANO V41 ALL-IN-ONE FIX + RUN ===" -ForegroundColor Cyan

$py="C:\jp\ai\v41\gateway\.venv\Scripts\python.exe"

Write-Host "`n=== 1) Fix HuggingFace + CUDA PyTorch ===" -ForegroundColor Yellow
& $py -m pip install -U pip setuptools wheel
& $py -m pip install -U "huggingface_hub[hf_xet]" hf_transfer

Write-Host "`n=== Cai PyTorch CUDA, uu tien cu128, fail thi cu126 ===" -ForegroundColor Yellow
& $py -m pip uninstall -y torch torchvision torchaudio
& $py -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
if ($LASTEXITCODE -ne 0) {
  Write-Host "cu128 fail, thu cu126..." -ForegroundColor Yellow
  & $py -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
}

Write-Host "`n=== Check GPU ===" -ForegroundColor Yellow
& $py -c "import torch; print('TORCH=', torch.__version__); print('CUDA=', torch.cuda.is_available()); print('GPU=', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NO CUDA')"

Write-Host "`n=== 2) Tai model anh / try-on / xoa nen ===" -ForegroundColor Yellow

$downloadPy = @"
from huggingface_hub import snapshot_download

models = [
    ("stabilityai/sdxl-turbo", "C:/jp/ai/v41/models/sdxl-turbo"),
    ("zhengchong/CatVTON", "C:/jp/ai/v41/models/catvton"),
    ("ZhengPeng7/BiRefNet", "C:/jp/ai/v41/models/birefnet"),
]

for repo, out in models:
    print(f"\n[DOWNLOAD] {repo} -> {out}")
    try:
        snapshot_download(
            repo_id=repo,
            local_dir=out,
            local_dir_use_symlinks=False,
            resume_download=True
        )
        print(f"[OK] {repo}")
    except Exception as e:
        print(f"[SKIP/FAIL] {repo}: {e}")
        print("Neu bi gated/license thi dang nhap HuggingFace roi chay lai.")
"@

$downloadFile="C:\jp\v37\japano_v41\download_v41_models_fixed.py"
$downloadPy | Set-Content $downloadFile -Encoding UTF8
& $py $downloadFile

Write-Host "`n=== 3) Mo AI Gateway V41 ===" -ForegroundColor Yellow
Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-Command','& "C:\jp\ai\v41\RUN_JAPANO_AI_GATEWAY_V41.bat"'

Start-Sleep -Seconds 5

Write-Host "`n=== 4) Mo backend server :4000 ===" -ForegroundColor Yellow
$backendCmd = @"
cd C:\jp\v37
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
`$env:PYTHON_BIN="`$PWD\.venv\Scripts\python.exe"
`$env:JAPANO_AI_GATEWAY_URL="http://127.0.0.1:8001"
npm run start-server
"@
Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-Command',$backendCmd

Start-Sleep -Seconds 8

Write-Host "`n=== 5) Mo app tren Android Emulator ===" -ForegroundColor Yellow
$appCmd = @"
cd C:\jp\v37
`$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
`$env:Path="`$env:JAVA_HOME\bin;`$env:Path"
`$env:ANDROID_HOME="`$env:LOCALAPPDATA\Android\Sdk"
`$env:ANDROID_SDK_ROOT="`$env:LOCALAPPDATA\Android\Sdk"
`$env:Path="`$env:ANDROID_HOME\platform-tools;`$env:ANDROID_HOME\emulator;`$env:Path"
`$sdkDir=`$env:ANDROID_HOME -replace '\\','/'
"sdk.dir=`$sdkDir" | Set-Content -Path ".\android\local.properties" -Encoding ASCII
`$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:4000"

adb devices
npx expo start -c --dev-client

Write-Host "`nNeu no bao chua co development build, terminal nay se build app sau 5 giay..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
npx expo run:android
"@
Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-Command',$appCmd

Write-Host "`nDONE. Da mo 3 cua so: Gateway, Backend, App." -ForegroundColor Green
Write-Host "Test Gateway: http://127.0.0.1:8001/health"
