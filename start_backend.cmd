@echo off
cd /d "%~dp0backend"

echo ============================================
echo   SIH26056 - Starting Django Backend
echo ============================================

IF NOT EXIST "venv" (
    echo Virtual environment not found. Creating one now...
    python -m venv venv
    echo Installing dependencies for the first time, this may take a minute...
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
) ELSE (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
    echo Skipping dependency check to speed up startup...
)

echo Applying database migrations...
python manage.py migrate

echo.
echo Starting Django server at http://127.0.0.1:8000/
echo Press CTRL+C to stop the server.
echo.
python manage.py runserver

echo.
echo Server stopped. Press any key to close this window.
pause >nul
