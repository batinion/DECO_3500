@echo off
REM Starts the full Launch Sequence game flow:
REM   http://localhost:4000  full Launch Sequence game (also serves the app to phones)
setlocal
cd /d "%~dp0"
call :setup server
start "Launch Sequence (4000)" /d "%~dp0server" cmd /k npm start
echo.
echo Started: 4000 (full game).
exit /b 0

:setup
if exist "%~dp0%1\node_modules" exit /b 0
echo Installing %1 dependencies...
pushd "%~dp0%1"
call npm install
popd
exit /b 0
