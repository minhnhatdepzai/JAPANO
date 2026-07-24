@echo off
cd /d "%~dp0"
set EXPO_PUBLIC_API_URL=http://localhost:4000
npx expo start --web -c
