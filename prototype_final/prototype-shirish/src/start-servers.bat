@echo off
REM Launch Sequence - starts the server, which also serves the app.
REM Then open the link it prints on every phone/laptop on the same Wi-Fi. No host screen.
cd /d "%~dp0server"
if not exist node_modules call npm install
start "Launch Sequence server" cmd /k npm start
