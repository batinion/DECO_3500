@echo off
REM Rescue your memories - standalone. Starts the server, then open the link it prints.
cd /d "%~dp0"
if not exist node_modules call npm install
start "Rescue your memories" cmd /k npm start
