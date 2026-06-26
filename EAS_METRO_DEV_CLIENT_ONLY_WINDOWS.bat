@echo off
chcp 65001 >nul
cd /d "%~dp0"
npx expo start --dev-client --host lan -c
pause
