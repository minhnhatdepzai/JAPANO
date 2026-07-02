@echo off
cd /d %~dp0
powershell -ExecutionPolicy Bypass -File ".\japano_mobile_v47\PATCH_V47_SELECTED_PRODUCT_SERVER.ps1"
powershell -ExecutionPolicy Bypass -Command "npx expo install expo-image-picker"
echo Done patch V47. Restart backend, then run RUN_SEED_V47_EXTRA_ACCESSORIES_AFTER_BACKEND_WINDOWS.bat
pause
