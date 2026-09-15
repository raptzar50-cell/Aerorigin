@echo off
title Aerogin Blaster Launcher
echo ======================================================
echo           AEROGIN ONE-CLICK BLASTER LAUNCHER
echo ======================================================
echo.

echo [1/4] Clearing previous port bindings (8000, 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo [2/4] Starting Django Backend server...
start "Aerogin Backend" cmd /k "title Aerogin Backend && cd /d "%~dp0backend" && "%~dp0backend\venv\Scripts\python.exe" manage.py runserver 127.0.0.1:8000"

echo [3/4] Starting React Frontend server...
start "Aerogin Frontend" cmd /k "title Aerogin Frontend && cd /d "%~dp0frontend" && npm run dev"

echo [4/4] Waiting for services to initialize...
timeout /t 3 /nobreak >nul

echo Opening Aerogin Dashboard...
start http://127.0.0.1:5173

echo.
echo ======================================================
echo   Both Backend & Frontend are successfully launched!
echo   Close the popped-up terminal windows to stop them.
echo ======================================================
pause
