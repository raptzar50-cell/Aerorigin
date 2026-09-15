# Aerogin — Complete Project Overview & Setup Guide

**SIH26056 | Smart India Hackathon 2026 | Ministry of Statistics (MoSPI)**

Welcome to Aerogin! This document serves as the master guide to understanding the entire project architecture, its core features, and specifically **what is required from your side** to take the project from its default "development/mock" state to a fully live, real-time production system.

---

## 1. What is Aerogin?

Aerogin is a real-time Airfare Price Index dashboard designed for government economists, regulators (DGCA), and researchers. It tracks domestic and international flight prices, computes a CPI-style inflation index, detects price anomalies (price gouging), and forecasts future fare trends.

### Core Capabilities:
- **Live Fare Scraping:** Fetches real-time flight prices across major corridors using SerpAPI (Google Flights), Amadeus, Kiwi, and MakeMyTrip (via Playwright headless browser).
- **Price Index Computation:** Calculates a weighted Laspeyres price index (base=100) akin to the national CPI.
- **AI Forecasting (Chronos-2):** Uses Amazon's zero-shot time-series foundation model to predict 30-day index movements.
- **Anomaly Detection (PyOD):** Automatically flags statistical outliers and sudden price surges.
- **Role-Based Views:** Tailored dashboard views for Economists, Regulators, and Researchers.
- **Real-Time Airspace Radar:** Live tracking of airport traffic and flight statuses using AviationStack.

---

## 2. Architecture & Tech Stack

Aerogin operates on a modern, decoupled architecture:

*   **Backend:** Django 4.2 (Python 3.10+), Django REST Framework. Handles data ingestion, scheduled ML pipelines, and serves the REST API. SQLite is used by default (ready for PostgreSQL).
*   **Frontend:** React 19 (Vite), Tailwind CSS v4, Recharts. A fast, responsive Single Page Application (SPA).
*   **Authentication:** Firebase Authentication with TOTP MFA support.
*   **Machine Learning:** `chronos-forecasting` for time-series predictions, `pyod` (ECOD algorithm) for anomaly detection, `scikit-learn`.
*   **Scraping Tools:** `playwright` (MakeMyTrip browser automation), `httpx` (API provider requests).

---

## 3. The Data Pipeline Lifecycle

To understand how Aerogin processes data, here is the automated lifecycle:

1.  **Scrape (`run_scrape_cycle`):** Fetches live fare quotes from OTA/Airline APIs.
2.  **Clean (`run_cleaning_pipeline`):** Normalizes data and flags initial anomalies.
3.  **Index (`compute_price_index`):** Computes the daily/weekly CPI-style indices.
4.  **Forecast (`run_index_forecast`):** Runs the Chronos-2 AI model to predict the next 30 days.
5.  **Train (`train_anomaly_detector`):** Retrains the PyOD anomaly model every few cycles to adapt to new market conditions.

---

## 4. What is Needed From Your Side? (CRITICAL)

Out of the box, Aerogin runs in a "safe development mode" using bundled mock data so you can view the UI without setting up credentials. **To activate the real live platform, you must complete the following steps:**

### A. Obtain API Keys
You need to sign up for the following free-tier services to pull real aviation data:

1.  **SerpAPI (Google Flights):** 
    *   Go to [serpapi.com](https://serpapi.com) and get a free API key. This is the primary engine for live fare prices.
2.  **AviationStack (Flight Radar):** 
    *   Go to [aviationstack.com](https://aviationstack.com/) and get a free API key. This powers the live flight tracking map.
3.  **(Optional) Amadeus & Kiwi.com:** 
    *   For fallback data, register at [developers.amadeus.com](https://developers.amadeus.com) (Client ID/Secret) and Kiwi Tequila (API Key).

### B. Configure Environment Variables
Open the `backend/.env` file and update it with your keys. You must also **toggle the system from Mock to Live mode**.

Update `backend/.env` exactly like this:
```env
# 1. Input your API Keys
SERPAPI_KEY=your_serpapi_key_here
FLIGHT_API_KEY=your_aviationstack_key_here

# (Optional Secondary Providers)
# AMADEUS_CLIENT_ID=...
# AMADEUS_CLIENT_SECRET=...
# KIWI_TEQUILA_API_KEY=...

# 2. Toggle LIVE MODE on (Disables Mock Data)
LIVE_MODE=True
REAL_SCRAPER=True

# 3. Enable the Real Flight Radar API
USE_MOCK_FLIGHT_API=False
FLIGHT_API_PROVIDER=aviationstack
```

### C. Setup Firebase Authentication (For Production)
The system currently bypasses login for ease of development. To enable real user accounts:
1.  Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project.
2.  Enable **Email/Password authentication**.
3.  Generate a **Service Account JSON key** (Project Settings -> Service Accounts -> Generate New Private Key).
4.  Update `backend/.env`:
    *   Set `FIREBASE_SERVICE_ACCOUNT_KEY_PATH=/absolute/path/to/your/serviceAccountKey.json`
    *   Set `FIREBASE_DEV_BYPASS=False`
5.  Update `frontend/.env` (create it if it doesn't exist) with your Firebase client config variables (e.g., `VITE_FIREBASE_API_KEY`).

### D. Automate the Scraper
The dashboard needs fresh data. You must set up a scheduled task to run the scraper pipeline automatically (e.g., every 6 hours).

**Windows Task Scheduler:**
Create a task that runs a batch script containing:
```cmd
cd C:\Users\hp\Aerogin\backend
call venv\Scripts\activate.bat
python manage.py run_scrape_cycle --source-type all
```
*(On Linux/Mac, use a cron job).*

---

## 5. Launching the Platform

Once configured, launching the app is simple. You can use the provided batch scripts in the project root:

*   **`blaster.cmd`**: A one-click launcher that kills old hanging ports, starts the Django backend, starts the React frontend, and opens the browser automatically.
*   **`start_aerogin.cmd`**: Starts the backend and frontend in separate command prompt windows for easier debugging.

**To trigger a manual live data refresh anytime:**
Open a terminal in the `backend` folder, activate the venv, and run:
`python manage.py run_scrape_cycle --source-type all`
