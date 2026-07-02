@echo off
chcp 65001 >nul
cd /d "%~dp0"
call .\.venv\Scripts\activate.bat
npm run start-server
pause
