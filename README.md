# Aerogin — Real-Time Airfare Price Index Dashboard

**SIH26056 | Smart India Hackathon 2026 | Ministry of Statistics (MoSPI)**

A CPI-style airfare price index dashboard for government economists, regulators,
and researchers. Tracks domestic Indian airfare trends, forecasts price index
movement with Chronos-2, detects fare anomalies with PyOD, and provides
stakeholder-role-based views with data export capabilities.

**Primary Stakeholders**: MoSPI, DGCA, government economists/statisticians/regulators.

**Authentication**: Firebase Authentication with TOTP MFA (RFC 6238).

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Git

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Install Playwright browser (for MakeMyTrip scraping)
playwright install chromium

# Configure environment
copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux
# Edit .env if needed (defaults work for development)

# Run database migrations
python manage.py migrate
```

### 2a. Firebase Authentication Setup

```bash
# 1. Create a Firebase project at https://console.firebase.google.com
# 2. Enable Email/Password and Google authentication in Firebase Console
# 3. Generate your service account JSON key file (see Secrets & Credentials section below)
# 4. Set environment variables in backend/.env:
#    Option A (local dev path):
#    FIREBASE_SERVICE_ACCOUNT_PATH=c:/path/to/your/gitignored/serviceAccountKey.json
#
#    Option B (cloud/CI single string):
#    FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
#
#    FIREBASE_PROJECT_ID=your-project-id
# 5. For offline development without Firebase, set FIREBASE_DEV_BYPASS=True (default)
```

---

## Secrets & Credentials Security

> [!CAUTION]
> **CRITICAL SECURITY RULE:** NEVER commit `serviceAccountKey.json`, any `*credentials*.json` file, or `.env` files to git or GitHub. These contain root-level credentials with access to cloud databases, auth services, and billing.

### 1. What Stays Gitignored
The project `.gitignore` automatically blocks:
- `*serviceAccount*.json`, `*credentials*.json`, `firebase-adminsdk-*.json`
- `*.env`, `*.env.local`
- `*.pem`, `*.key`, `*.p12`

Only template files such as `.env.example` should ever be tracked in version control.

### 2. How to Obtain a Service Account Key
New team members must generate their own credentials directly from the Firebase Console rather than sharing keys over insecure channels:
1. Open [Firebase Console](https://console.firebase.google.com/) and navigate to your project.
2. Click the gear icon (**Project Settings**) &rarr; select the **Service accounts** tab.
3. Verify that **Firebase Admin SDK** is selected.
4. Click **Generate new private key**, then confirm by clicking **Generate key**.
5. Save the downloaded file locally outside of git tracking (e.g. `backend/serviceAccountKey.json`).

### 3. Setting Up the Environment Locally
In your local `backend/.env` file:
- **Local Development**: Set the path pointing to your local gitignored file:
  ```ini
  FIREBASE_SERVICE_ACCOUNT_PATH=c:/Users/username/Aerogin/backend/serviceAccountKey.json
  FIREBASE_PROJECT_ID=your-project-id
  ```
- **Cloud / CI/CD (Docker, Heroku, Railway, Render)**: Minify the downloaded JSON onto a single line and pass it as an environment variable:
  ```ini
  FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"..."}
  FIREBASE_PROJECT_ID=your-project-id
  ```

---

### 2b. Live Data Ingestion & Processing (100% Real-Time Data)

The platform operates on 100% genuine live market data with zero synthetic data models.

```bash
# Step 1: Scrape live airfares across tracked domestic routes via SerpAPI Google Flights pool
python manage.py run_scraper --all-routes

# Step 2: Clean scraped fares and run PyOD anomaly screening
python manage.py run_cleaning_pipeline

# Step 3: Compute CPI-style weighted Laspeyres price indices on real data
python manage.py compute_price_index

# Step 4: Calibrate and activate the PyOD anomaly detection model
python manage.py train_anomaly_detector

# Step 5: Load government reference benchmarks (DGCA + MoSPI)
python manage.py load_government_data --source all

# Step 6: Generate zero-shot Chronos-2 fare forecasts
python manage.py run_prediction_cycle

# Step 7: Generate 30-day index forecasts
python manage.py run_index_forecast
```

### 3. Start Backend Server

```bash
python manage.py runserver
# API available at http://localhost:8000/api/
# Live Air Traffic radar at http://localhost:8000/api/flights/live/
```

### 4. Frontend Setup (separate terminal)

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies API to Django)
npm run dev
# App available at http://localhost:5173/
```

---

## Data Sources — Transparency Report

The following table documents the active data sources powering the live dashboard:

| Source | Type | Status | Features & Fallback |
|--------|------|--------|---------------------|
| **Google Flights (SerpAPI)** | Search API | ✅ Live (Active Pool) | Multi-key pool (`SERPAPI_KEY`, `SERPAPI_KEY_2`, `SERPAPI_KEY_3`) with automated failover across 700+ verified live searches. Scrapes 1,500+ live fare quotes across all primary domestic corridors. |
| **AviationStack API** | Flight Radar API | ✅ Live (`FLIGHT_API_KEY`) | Powers real-time live airport departures & airspace tracking across top Indian hubs (`DEL`, `BOM`, `BLR`, `HYD`, `MAA`, `CCU`) with 90s server-side caching. |
| **DGCA Traffic Data** | Government report | ✅ Active Loader | Monthly passenger share and traffic data across domestic carriers. |
| **MoSPI CPI Transport Index** | Government statistics | ✅ Active Loader | CPI reference sub-indices for inflation comparison. |
| **Amadeus / Kiwi API** | Airline APIs | Optional Secondary | Available via `.env` credentials for additional fare verification. |

> **Honest Provenance Disclosure**: All synthetic data models have been purged from the database. Every fare observation in the system originates from live API provider responses with verified provenance metadata.

---

## Architecture

```
                 +-----------+
                 |  Scraper  |  RealFareScraper / LiveFareScraper
                 +-----+-----+
                       |
          +------------+------------+
          |            |            |
     Playwright    API Providers   Government
     (MakeMyTrip)  (Google SerpAPI, Loaders
                   Amadeus, Kiwi)  (DGCA,MoSPI)
                       |                 ↓
                       |           GovernmentDataPoint
          +------------+
          |
          v
+----------------------+----------------------+
|                  Django Backend              |
|  +----------+   +-----------+   +---------+ |
|  | RawFare  |-->| CleanFare |-->| PriceIdx| |
|  | (raw obs)|   | (cleaned  |   | (CPI    | |
|  |          |   |  +anomaly |   |  index) | |
|  |          |   |  flagging)|   |         | |
|  +----------+   +-----------+   +---------+ |
|                       |                      |
|                       v                      |
|              +------------------+            |
|              | AnomalyModel     |            |
|              | Version (v1,v2..)| ◄── train  |
|              +------------------+            |
|                                              |
|  DRF API: /api/routes/                       |
|           /api/index/                        |
|           /api/trends/lead-time/             |
|           /api/quality-report/               |
|           /api/stats/                        |
|           /api/model-versions/               |
+----------------------+-----------------------+
                       |
                       v
+----------------------+-----------------------+
|              React Frontend (PWA)            |
|  Overview | Route Detail | Data Quality      |
|  Trends Comparison | Model Performance       |
+----------------------------------------------+
```

### Stakeholder Role Model

| Role | Default View | Key Features |
|------|-------------|-------------|
| **Economist/Statistician** | Index charts prominent | Base-period controls, CPI alignment framing, CSV/JSON export |
| **Regulator/Policy Analyst** | Anomaly detection prominent | Flagged fares, carrier analysis, pricing pattern detection |
| **Researcher/Analyst** | Model metrics prominent | Dataset access, forecast accuracy, API documentation |

> All roles can access all data — the role only determines which widgets are shown first.

### Authentication Architecture

```
Firebase Client SDK (frontend) → Email/Password + TOTP MFA → Firebase ID Token
      ↓
Firebase Admin SDK (Django backend) → verify_id_token() → UserProfile (Django ORM)
      ↓
FirebaseAuthMiddleware → request.user_profile (role, preferences)
```

## Data Pipeline

| Step | Command | What it does |
|------|---------|-------------|
| Scrape | `run_scrape_cycle` | Runs full live scrape cycle (Google Flights SerpAPI, Live APIs) → clean → index. Auto-retrains every N cycles |
| Clean | `run_cleaning_pipeline` | Normalizes fares, computes lead_time_days, detects anomalies (>20% day-over-day change, >3σ statistical outliers) |
| Index | `compute_price_index` | Computes CPI-style index (base=100) for each route + national aggregate, daily/weekly/monthly |
| **Forecast** | **`run_index_forecast`** | **Runs Chronos-2 on PriceIndex series → 30-day forecast with 80% prediction interval + CPI impact notes** |
| **Evaluate** | **`evaluate_forecast_accuracy`** | **Compares predicted vs actual index values, computes MAE/MAPE/interval hit rate** |
| Gov Data | `load_government_data` | Loads DGCA traffic + avg fare data and MoSPI CPI indices into GovernmentDataPoint |
| Train | `train_anomaly_detector` | Refits anomaly detector parameters on real fares, saves versioned model with evaluation metrics |
| Evaluate | `evaluate_anomaly_detection` | Evaluates detector precision/recall/F1 against verified anomalies |

## Scraper Selection & Hybrid Cadences

### Scraper Selection (via `registry.py`)

The system supports live scraper modes, selected via environment variables:

| LIVE_MODE | REAL_SCRAPER | Active Scraper | What it uses |
|-----------|-------------|----------------|--------------|
| `True` | `False` | `LiveFareScraper` | Multi-key SerpAPI Google Flights Pool (`SERPAPI_KEY`, `SERPAPI_KEY_2`) + Amadeus + Kiwi |
| `True` | `True` | `RealFareScraper` | Live Playwright browser scraping + SerpAPI Google Flights + Live APIs |

### Hybrid Cadences (via `--source-type` flag)

OTA/airline sources update in real-time; government sources update monthly.
Use the `--source-type` flag to run them at appropriate cadences:

```bash
# Frequent: OTA/airline fare scraping (run hourly/daily via cron)
python manage.py run_scrape_cycle --source-type ota

# Infrequent: Government data loading (run monthly)
python manage.py run_scrape_cycle --source-type government

# Everything at once (default)
python manage.py run_scrape_cycle --source-type all

# Standalone government data loading
python manage.py load_government_data --source dgca
python manage.py load_government_data --source mospi
python manage.py load_government_data --source all
```

### Cron Schedule Example

```crontab
# OTA fares: every 6 hours
0 */6 * * * cd /path/to/backend && python manage.py run_scrape_cycle --source-type ota

# Government data: 1st of every month at 9 AM
0 9 1 * * cd /path/to/backend && python manage.py load_government_data --source all
```

## Anomaly Detector Retraining

### Manual Retraining
```bash
python manage.py train_anomaly_detector
```

### Automatic Retraining
Retraining triggers automatically every `RETRAIN_EVERY_N_CYCLES` scrape cycles
(default: 5, configurable in `.env`). Each `run_scrape_cycle` increments a counter
and retrains when the threshold is hit.

### Model Version History
- **Dashboard**: Data Quality page → "Anomaly Detector Performance" section
- **Admin**: Django admin → Anomaly Model Versions
- **CLI**: `python manage.py train_anomaly_detector` prints version + metrics

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/routes/` | List tracked routes with stats |
| `GET /api/index/?route=DEL-BOM&period=daily` | Index time series |
| `GET /api/trends/lead-time/?route=DEL-BOM` | Lead-time elasticity data |
| `GET /api/quality-report/` | Anomaly detection report with provenance |
| `GET /api/stats/` | Dashboard headline statistics + data provenance breakdown |
| `GET /api/model-versions/` | Anomaly model version history |
| **`GET /api/index-forecast/?route=DEL-BOM`** | **Chronos-2 index forecast with confidence intervals** |
| **`GET /api/forecast-accuracy/`** | **Forecast accuracy tracking (predicted vs actual)** |
| **`GET /api/export/index/?format=csv`** | **Export index data as CSV/JSON** |
| **`GET /api/export/fares/?format=json`** | **Export fare records as CSV/JSON** |
| **`GET /api/data-provenance/`** | **Data source transparency breakdown** |
| `POST /api/auth/sync-profile/` | Sync Firebase user with Django profile |
| `GET /api/auth/profile/` | Get user profile + stakeholder role |
| `PATCH /api/auth/profile/` | Update role, display name, preferences |
| `GET /api/auth/roles/` | List available stakeholder roles |

## Tech Stack

- **Backend**: Django 4.2, Django REST Framework, SQLite (PostgreSQL-ready)
- **Frontend**: React 19, Vite, Tailwind CSS v4, Recharts
- **Authentication**: Firebase Authentication + TOTP MFA (firebase-admin for backend verification)
- **Forecasting**: Amazon Chronos-2 (zero-shot time-series foundation model)
- **Anomaly Detection**: PyOD (ECOD algorithm) with versioned model tracking
- **Real Scraping**: Playwright (MakeMyTrip), httpx (API providers)
- **Data Loading**: pandas, openpyxl (DGCA/MoSPI Excel/CSV reports)
- **Retry Logic**: tenacity (exponential backoff on all network calls)

---

*Built for Smart India Hackathon 2026*
