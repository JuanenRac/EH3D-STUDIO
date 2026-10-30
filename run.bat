@echo off
rem Opens Studio in development: run.bat [SERVER_URL]  (the server whose API it talks to; default http://127.0.0.1:18200)
setlocal
cd /d "%~dp0"
if not exist node_modules call npm ci
if "%~1"=="" (set "EH3D_SERVER=http://127.0.0.1:18200") else (set "EH3D_SERVER=%~1")
call npm run dev
pause
endlocal
