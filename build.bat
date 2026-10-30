@echo off
rem PRETTY_RUN_BEGIN
set "NOPAUSE=1"
if not defined PRETTY_MODE set "PRETTY_MODE=build"
set "PRETTY_PY=python"
where py >nul 2>&1 && set "PRETTY_PY=py -3"
if not defined PRETTY_RUN if exist "%~dp0tools\pretty_run.py" (
    set "PRETTY_RUN=1"
    %PRETTY_PY% "%~dp0tools\pretty_run.py" --wrap --mode %PRETTY_MODE% -- cmd /d /c "%~f0" %*
    exit /b
)
rem PRETTY_RUN_END
rem EH3D-STUDIO: installs what it needs (npm ci) the first time and builds the pages into dist\.
setlocal
cd /d "%~dp0"
if not exist node_modules call npm ci
if errorlevel 1 goto :end
call npm run build
:end
if not defined NOPAUSE pause
endlocal
