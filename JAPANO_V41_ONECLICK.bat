@echo off
chcp 65001 >nul
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"
echo ============================================================
echo JAPANO V41 AI Fashion Studio - One Click
echo Root: %CD%
echo ============================================================
where powershell >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Khong tim thay PowerShell.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%japano_v41\install_and_run_v41.ps1" -Mode recommended
pause
