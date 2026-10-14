@echo off
REM Starts all three servers, each in its own window:
REM   http://localhost:4000  full Launch Sequence game
REM   http://localhost:4001  Rescue your memories (standalone)
REM   http://localhost:4002  Colour restore (standalone)
REM Close a window to stop that server.
cd /d "%~dp0"
for %%D in (server rescue-game colour-game) do (
  if not exist "%%D\node_modules" (
    echo Installing %%D dependencies...
    pushd "%%D"
    call npm install
    popd
  )
)
start "Launch Sequence (4000)" /d "%~dp0server" cmd /k npm start
start "Rescue your memories (4001)" /d "%~dp0rescue-game" cmd /k npm start
start "Colour restore (4002)" /d "%~dp0colour-game" cmd /k npm start
echo.
echo Started: 4000 (full game), 4001 (rescue), 4002 (colour).
