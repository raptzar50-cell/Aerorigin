@echo off
title Aerogin Blaster Launcher
echo ======================================================
echo           AEROGIN ONE-CLICK BLASTER LAUNCHER
echo ======================================================
echo.

set ROOT_DIR=%~dp0
set BACKEND_DIR=%ROOT_DIR%backend
set FRONTEND_DIR=%ROOT_DIR%frontend

:: Locate Python in backend venv or root venv
if exist "%BACKEND_DIR%\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%BACKEND_DIR%\venv\Scripts\python.exe"
) else if exist "%ROOT_DIR%venv\Scripts\python.exe" (
    set "PYTHON_EXE=%ROOT_DIR%venv\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

echo [1/4] Terminating lingering processes on ports 8000 and 5173...
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173"') do taskkill /f /pid %%a >nul 2>&1

echo [2/4] Starting Django Backend server...
start "Aerogin Backend" cmd /k "title Aerogin Backend && cd /d "%BACKEND_DIR%" && "%PYTHON_EXE%" manage.py migrate --noinput && "%PYTHON_EXE%" manage.py runserver 127.0.0.1:8000"

echo [3/4] Starting React Frontend server...
start "Aerogin Frontend" cmd /k "title Aerogin Frontend && cd /d "%FRONTEND_DIR%" && npm run dev"

echo [4/4] Initializing services (waiting 5 seconds)...
powershell -NoProfile -Command "Start-Sleep -Seconds 5"

echo Opening Aerogin Dashboard...
start http://127.0.0.1:5173

echo.
echo ======================================================
echo   Both Backend and Frontend are successfully launched!
echo   Close the popped-up terminal windows to stop them.
echo ======================================================
pause
