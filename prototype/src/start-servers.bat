@echo off
REM Launch Sequence - starts Mission Control server and Expo web app in separate windows
start "Mission Control server" /d "%~dp0server" cmd /k npm run dev
start "Expo app (web)" /d "%~dp0app" cmd /k npx expo start --web
