@echo off
cd /d C:\jp\v37
powershell -ExecutionPolicy Bypass -File ".\japano_web_v43\PATCH_V43_WEB_SERVER.ps1"
echo Done patch V43 web. Restart backend now.
pause
