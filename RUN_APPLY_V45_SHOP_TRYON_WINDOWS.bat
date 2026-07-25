@echo off
cd /d %~dp0
powershell -ExecutionPolicy Bypass -File ".\japano_mobile_v45\PATCH_V45_SHOP_TRYON_SERVER.ps1"
powershell -ExecutionPolicy Bypass -Command "npx expo install expo-image-picker"
powershell -ExecutionPolicy Bypass -Command "$f=(Select-String -Path '.\app\*','.\src\*','.\components\*' -Pattern 'Thử đồ AI','Demo Mode','AAE','credit','tryon','try-on' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1).Path; if($f){Copy-Item $f ($f+'.bak-v45-shop') -Force; $src='app/thu-do-ai-v45-shop'; Set-Content $f \"export { default } from './thu-do-ai-v45-shop';`n\" -Encoding UTF8; Write-Host '[OK] Replaced' $f}else{Write-Host '[WARN] Khong tu tim thay screen cu'}"
echo Done. Restart backend va app.
pause
