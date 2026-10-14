@echo off
REM Colour restore - standalone. Starts the server, then open the link it prints.
cd /d "%~dp0"
if not exist node_modules call npm install
start "Colour restore" cmd /k npm start
