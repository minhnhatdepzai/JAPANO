@echo off
chcp 65001 >nul
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"
echo ============================================================
echo JAPANO V41 AI Fashion Studio - FULL MODELS
echo Root: %CD%
echo ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%japano_v41\install_and_run_v41.ps1" -Mode full
pause
