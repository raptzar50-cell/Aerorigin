#!/bin/bash

# Change directory to the script's location, then into 'backend'
cd "$(dirname "$0")/backend" || exit 1

echo "============================================"
echo "  SIH26056 - Starting Django Backend"
echo "============================================"

if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Creating one now..."
    python3 -m venv venv
    echo "Installing dependencies for the first time, this may take a minute..."
    source venv/bin/activate
    pip install -r requirements.txt
else
    echo "Activating virtual environment..."
    source venv/bin/activate
    echo "Checking dependencies..."
    pip install -r requirements.txt --quiet
fi

echo "Applying database migrations..."
python manage.py migrate

echo ""
echo "Starting Django server at http://127.0.0.1:8000/"
echo "Press CTRL+C to stop the server."
echo ""
python manage.py runserver

echo ""
echo "Server stopped. Press any key to close this window."
read -n 1 -s -r -p ""
echo ""
