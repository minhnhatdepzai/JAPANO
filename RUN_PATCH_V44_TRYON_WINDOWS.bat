@echo off
cd /d %~dp0
powershell -ExecutionPolicy Bypass -File ".\japano_mobile_v44\PATCH_V44_MOBILE_TRYON_SERVER.ps1"
echo.
echo Done. Hay restart backend.
pause
