@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [1/4] Xoa model cu neu con ton tai...
if exist yolov8n.pt del /f /q yolov8n.pt

echo [2/4] Cai Python packages cho emotion/age model...
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r server\vision-requirements.txt

echo [3/4] Kiem tra backend syntax...
node --check server\index.mjs

echo [4/4] Hoan tat. Chay backend bang: npm run start-server
pause
