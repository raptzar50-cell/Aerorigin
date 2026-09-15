# Aerogin Project Status & Real-Time Data Setup Guide

This document outlines the current state of the Aerogin project and provides a **step-by-step checklist** of everything you need to do to transition the platform from using mock/synthetic data to **real-time, dynamic data that you can actually use.**

## 1. Current State of the Project

- **Backend:** Fully functional Django 4.2 REST API.
- **Frontend:** React 19 Single Page Application (Vite + Tailwind CSS).
- **Data Pipeline:** Complete ETL pipeline (Extract, Transform, Load) capable of computing CPI-style indices, forecasting with Chronos-2, and detecting anomalies with PyOD.
- **Current Data Source:** Out-of-the-box, the app runs in a "safe development mode" using synthetic ticket prices and static government fixtures so that you can view the UI without needing API keys.

---

## 2. Checklist: How to Enable Real-Time Dynamic Data

To make the site pull real, live ticket prices and flight statuses, follow these exact steps:

### Step 1: Obtain API Keys
You need to sign up for the following third-party services to get access to real-time aviation data:

*   **Amadeus API (Airline Data):**
    *   Go to [developers.amadeus.com](https://developers.amadeus.com) and create a free account.
    *   Create a new app in your workspace to generate an **API Key** (`CLIENT_ID`) and **API Secret** (`CLIENT_SECRET`).
*   **Kiwi.com Tequila (OTA Data):**
    *   Go to the Kiwi Tequila portal and register for a partner API key.
*   **SerpAPI (Google Flights Data):**
    *   Go to [serpapi.com](https://serpapi.com) and register for a free tier API key.
*   **Flight Status API (Real-time arrivals/departures):**
    *   Sign up for [AviationStack](https://aviationstack.com/) (or FlightAware/OpenSky) to get an API key.

### Step 2: Configure Your `.env` File
Open the `backend/.env` file and input the keys you just generated. **Crucially, you must flip the toggle variables from `False` to `True`** to tell the backend to stop using mock data.

Update these specific lines in `backend/.env`:

```env
# 1. Provide your API Keys
AMADEUS_CLIENT_ID=your_amadeus_client_id_here
AMADEUS_CLIENT_SECRET=your_amadeus_client_secret_here
KIWI_TEQUILA_API_KEY=your_kiwi_key_here
SERPAPI_KEY=your_serpapi_key_here
FLIGHT_API_KEY=your_aviationstack_key_here

# 2. Toggle LIVE MODE on
LIVE_MODE=True
REAL_SCRAPER=True

# 3. Enable the Real Flight Status API
USE_MOCK_FLIGHT_API=False
FLIGHT_API_PROVIDER=aviationstack
```

### Step 3: Run the Real-Time Scraper Pipeline
Once the keys are in place, your backend is ready to fetch real data! Instead of using the `seed_synthetic_data` command, you will now use the **Scrape Cycle**.

Open a terminal in the `backend` folder and run:
```bash
python manage.py run_scrape_cycle --source-type all
```
*What this does:*
1. Reaches out to Amadeus, Kiwi, Google Flights, and MakeMyTrip (via a headless browser) to scrape real-time ticket prices.
2. Cleans and normalizes the data.
3. Runs the PyOD Anomaly Detection model to flag price gouging.
4. Updates the CPI price indices.

*(Note: The MakeMyTrip scraper uses an automated browser and is subject to anti-bot blocking. If it gets blocked, it will gracefully skip MakeMyTrip and rely on your API providers).*

### Step 4: Automate the Data Pipeline
To make the dashboard truly dynamic without you having to manually type commands, you need to schedule the scraper to run automatically (e.g., every 6 hours).

**On Windows (Task Scheduler):**
Create a new Basic Task in Windows Task Scheduler that runs a `.cmd` script every 6 hours containing:
```cmd
cd C:\Users\hp\Aerogin\backend
call venv\Scripts\activate.bat
python manage.py run_scrape_cycle --source-type ota
```

---

## 3. (Optional) Production Authentication
If you want to move away from the local development bypass and secure the app with real authentication:

1. **Firebase:** Create a project at `console.firebase.google.com`, enable Email/Password auth, and download the `serviceAccountKey.json`. Point `FIREBASE_SERVICE_ACCOUNT_KEY_PATH` to this file in your `.env`.
2. **Disable Bypass:** Set `FIREBASE_DEV_BYPASS=False` in `backend/.env`.
3. **Frontend Env:** Add a `.env` file in the `frontend/` directory containing your `VITE_FIREBASE_API_KEY` and other Firebase client config variables.
