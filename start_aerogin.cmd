@echo off
echo ============================================
echo   Starting Aerogin Full Stack Project
echo ============================================

echo [1/3] Starting Django Backend in a new window...
start "Aerogin Backend" cmd /c "%~dp0start_backend.cmd"

echo [2/3] Starting React Frontend in a new window...
start "Aerogin Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo [3/3] Waiting for frontend server to initialize...
timeout /t 4 /nobreak >nul

echo Opening browser at http://localhost:5173...
start http://localhost:5173

echo.
echo Both servers are now running in separate windows.
echo To stop them, simply close those terminal windows.
pause
