# Aerogin: Scrapers and Models Documentation

This document provides a detailed overview of the web scrapers and machine learning models that power the Aerogin Real-Time Airfare Price Index Dashboard. 

## 1. Web Scrapers

The data ingestion pipeline in Aerogin relies on robust, concurrent web scraping mechanisms to fetch real-time airfare prices. The scraping architecture is built on a unified `FareScraper` interface with two primary concrete implementations:

### 1.1 `LiveFareScraper`
Located in `backend/scraper/live_scraper.py`.

The `LiveFareScraper` acts as the bridge between the synchronous Django backend and real, asynchronous flight-price APIs.

*   **Data Sources:** Directly queries Amadeus, Google Flights (via SerpAPI), and Kiwi Tequila.
*   **Concurrency:** Utilizes Python's `asyncio` to run searches across all configured providers in parallel, drastically reducing the overall latency of a scrape cycle.
*   **Bridge Mechanism:** The scraper is invoked synchronously (`scrape()` method) but uses `asyncio.run()` (or a `ThreadPoolExecutor` if already in an event loop) to seamlessly bridge the sync-to-async boundary.
*   **Data Shape:** Each provider returns a `ProviderResult` where the observations are transformed into dictionary shapes compatible with the `RawFare` database model.
*   **Provenance:** All data scraped through this component carries the `{"mock": false}` flag to clearly distinguish it from synthetic test data.

### 1.2 `RealFareScraper`
Located in `backend/scraper/real_scraper.py`.

The `RealFareScraper` is the unified production scraper that wraps both API providers and direct browser automation.

*   **Data Sources:**
    *   **MakeMyTrip:** Scraped directly using **Playwright** browser automation (with a fixture fallback if the real scrape is blocked).
    *   **Live APIs:** Also includes Amadeus, Google Flights, and Kiwi.
*   **Resilience & Retries:** Employs the `tenacity` library to provide exponential backoff and retry logic (`ConnectionError`, `TimeoutError`). If a specific provider crashes or is blocked, it fails gracefully, logs the error, and returns data from the surviving providers. It never crashes the entire scraping cycle.
*   **Execution:** Like the `LiveFareScraper`, it executes all underlying provider searches concurrently via `asyncio`.

*(Note: Government data loaders like DGCA and MoSPI operate on aggregate monthly statistics and are not part of the high-frequency fare scraper.)*

---

## 2. Machine Learning Models

The analytical pipeline is split into two stages: Anomaly Detection (Stage 1) and Forecasting (Stage 2).

### 2.1 Anomaly Detection: PyOD (Python Outlier Detection)
Located in `backend/detection/anomaly_detector.py`.

Before fare data is fed into the forecasting model, it must be screened for anomalies to ensure the price index isn't skewed by glitched pricing or temporary API errors.

*   **Algorithm:** Uses the **ECOD** (Empirical Cumulative Distribution-based Outlier Detection) algorithm from the `PyOD` library. ECOD is fast, parameter-free, and acts as an excellent default for univariate anomaly detection. (The architecture allows a one-line swap to other algorithms like Isolation Forest or KNN if needed).
*   **Per-Route Fitting:** Because airfare distributions vary wildly between different routes (e.g., DEL-BOM vs. rural routes), the system fits a separate PyOD detector instance for each route.
*   **Rolling Baseline:** The model fits itself on a rolling historical window (default 60 days) of trusted `CleanFare` data to establish what "normal" pricing looks like for that specific route.
*   **Scoring:** It scores new fare observations. If an observation exceeds the anomaly threshold, it is flagged (e.g., `FLAG_PYOD_ANOMALY`). Anomalous data is excluded from the subsequent prediction stage but stored and surfaced in the Data Quality UI for regulators to review.

### 2.2 Time-Series Forecasting: Amazon Chronos-2
Located in `backend/prediction/fare_predictor.py`.

Once the data is cleaned and anomalies are flagged, the system generates forecasts for future price indices.

*   **Algorithm:** Uses **Amazon Chronos-2**, a zero-shot time-series foundation model. 
*   **Zero-Shot Capabilities:** Unlike traditional models (like ARIMA or Prophet) which require explicit per-series training, Chronos-2 is a pre-trained foundation model. It can generate forecasts "out of the box" without needing a dedicated training phase on the Aerogin dataset.
*   **Probabilistic Forecasting:** Instead of providing just a single point estimate (which can be misleading), Chronos-2 outputs quantile forecasts. By default, it returns the 10th, 50th (median), and 90th percentiles, providing an 80% prediction interval to convey forecast uncertainty.
*   **Covariate-Informed Predictions:** The predictor leverages `lead_time_days` as a known future covariate. By passing how far in advance a ticket is being booked, Chronos-2 can significantly improve its forecast quality over a naive univariate baseline.
*   **Hardware Compatibility:** The model is explicitly configured for CPU inference (`device_map='cpu'`), making it highly portable and suitable for hackathon environments without dedicated GPU acceleration.
*   **Lazy Singleton Loading:** Because loading a foundation model takes time (~10-30 seconds) and memory, the `Chronos2Pipeline` is implemented as a lazy singleton. It is loaded only once and reused across all route prediction calls.
