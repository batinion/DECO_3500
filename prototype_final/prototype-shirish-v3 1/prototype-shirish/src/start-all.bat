@echo off
REM Starts all three servers, each in its own window (close a window to stop that server):
REM   http://localhost:4000  full Launch Sequence game (also serves the app to phones)
REM   http://localhost:4001  Rescue your memories (standalone)
REM   http://localhost:4002  Colour restore (standalone)
setlocal
cd /d "%~dp0"
call :setup server
call :setup rescue-game
call :setup colour-game
start "Launch Sequence (4000)" /d "%~dp0server" cmd /k npm start
start "Rescue your memories (4001)" /d "%~dp0rescue-game" cmd /k npm start
start "Colour restore (4002)" /d "%~dp0colour-game" cmd /k npm start
echo.
echo Started: 4000 (full game), 4001 (rescue), 4002 (colour).
exit /b 0

:setup
if exist "%~dp0%1\node_modules" exit /b 0
echo Installing %1 dependencies...
pushd "%~dp0%1"
call npm install
popd
exit /b 0
