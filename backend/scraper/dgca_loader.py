"""
DGCA data loader — reads published DGCA reports (Excel/CSV), NOT a live
scrape target.

Sources:
  1. Monthly Domestic Passenger Traffic Reports (Excel/CSV)
  2. Average Fare Monitoring Data (Excel/CSV, sometimes PDF)

Published at: https://www.dgca.gov.in/digigov-portal/
Updates: Monthly (typically 15-20 days after month-end)

IMPORTANT: DGCA's web portal uses dynamic session-based URLs that change
frequently. The loader tries known URL patterns first, then falls back
to bundled static sample data (clearly labeled as fixture data).

This module returns GovernmentDataPoint-shaped dicts, NOT RawFare dicts.
"""
from __future__ import annotations

import io
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

logger = logging.getLogger(__name__)

_FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"

# Known DGCA data URLs — these change frequently; listed in order of
# likelihood. The loader tries each until one works.
_DGCA_TRAFFIC_URLS = [
    "https://www.dgca.gov.in/digigov-portal/jsp/dgca/InventoryList/dataReports/"
    "MonthlyDomesticPassengerTraffic.xlsx",
    "https://www.dgca.gov.in/digigov-portal/jsp/dgca/InventoryList/dataReports/"
    "domestic_traffic_statistics.csv",
]

_DGCA_FARE_URLS = [
    "https://www.dgca.gov.in/digigov-portal/jsp/dgca/InventoryList/dataReports/"
    "AverageDomesticFareData.xlsx",
    "https://www.dgca.gov.in/digigov-portal/jsp/dgca/InventoryList/dataReports/"
    "average_fare_monitoring.csv",
]

# Cache directory for downloaded files
_CACHE_DIR = Path(__file__).resolve().parent / "cache" / "dgca"


def _ensure_cache_dir() -> Path:
    """Create cache directory if it doesn't exist."""
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return _CACHE_DIR


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=5, max=30),
    retry=retry_if_exception_type((IOError, ConnectionError, TimeoutError)),
    reraise=True,
)
def _download_dataframe(url: str) -> Optional[pd.DataFrame]:
    """Download an Excel/CSV file from URL and return as DataFrame.

    Uses pandas' built-in URL reading with retry logic.
    Retries 3 times with exponential backoff (5s, 10s, 20s).
    """
    import requests

    logger.info("DGCA loader: Attempting download from %s", url)

    try:
        response = requests.get(url, timeout=30, headers={
            "User-Agent": "Mozilla/5.0 (compatible; AeroginBot/1.0; SIH26056 Research)",
        })
        response.raise_for_status()

        content_type = response.headers.get("Content-Type", "")
        content = io.BytesIO(response.content)

        if url.endswith(".xlsx") or "spreadsheet" in content_type:
            df = pd.read_excel(content, engine="openpyxl")
        elif url.endswith(".xls"):
            df = pd.read_excel(content)
        else:
            # Assume CSV
            df = pd.read_csv(content)

        # Cache the downloaded file
        cache_dir = _ensure_cache_dir()
        filename = url.split("/")[-1]
        cache_path = cache_dir / filename
        cache_path.write_bytes(response.content)
        logger.info("DGCA loader: Cached to %s", cache_path)

        return df

    except Exception as exc:
        logger.warning("DGCA loader: Download failed from %s: %s", url, exc)
        raise


def _load_from_cache(filename_pattern: str) -> Optional[pd.DataFrame]:
    """Try to load data from the local cache directory."""
    cache_dir = _ensure_cache_dir()
    for path in sorted(cache_dir.glob(filename_pattern), reverse=True):
        try:
            if path.suffix in (".xlsx", ".xls"):
                return pd.read_excel(path, engine="openpyxl")
            else:
                return pd.read_csv(path)
        except Exception as exc:
            logger.warning("DGCA cache read failed for %s: %s", path, exc)
    return None


def load_traffic_data(use_fixture: bool = True) -> List[Dict[str, Any]]:
    """Load DGCA monthly domestic passenger traffic data.

    Attempts:
    1. Download from known DGCA URLs
    2. Load from local cache
    3. Fall back to bundled fixture data (if use_fixture=True)

    Returns a list of GovernmentDataPoint-shaped dicts.
    """
    df = None

    # Step 1: Try live download
    for url in _DGCA_TRAFFIC_URLS:
        try:
            df = _download_dataframe(url)
            if df is not None and not df.empty:
                logger.info(
                    "DGCA traffic data: Loaded %d rows from %s",
                    len(df), url,
                )
                break
        except Exception as exc:
            logger.warning("DGCA traffic URL failed: %s — %s", url, exc)
            continue

    # Step 2: Try cache
    if df is None or df.empty:
        df = _load_from_cache("*traffic*.*")
        if df is not None and not df.empty:
            logger.info("DGCA traffic data: Loaded %d rows from cache", len(df))

    # Step 3: Fixture fallback
    if (df is None or df.empty) and use_fixture:
        fixture_path = _FIXTURES_DIR / "dgca_sample_traffic.csv"
        if fixture_path.exists():
            df = pd.read_csv(fixture_path)
            logger.info(
                "DGCA traffic data: Using fixture fallback (%d rows) from %s",
                len(df), fixture_path,
            )
        else:
            logger.error("DGCA traffic fixture not found: %s", fixture_path)
            return []

    if df is None or df.empty:
        logger.error("DGCA traffic data: All sources exhausted. No data loaded.")
        return []

    return _normalize_traffic_records(df, is_fixture=(df is not None and use_fixture))


def _normalize_traffic_records(
    df: pd.DataFrame, is_fixture: bool = False
) -> List[Dict[str, Any]]:
    """Normalize traffic DataFrame into GovernmentDataPoint-shaped dicts."""
    now = datetime.now(timezone.utc)
    records: List[Dict[str, Any]] = []

    # Standardize column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    for _, row in df.iterrows():
        try:
            # Parse month/year
            month_str = str(row.get("month", ""))
            year = int(row.get("year", 0))

            if "-" in month_str:
                # Format: "2025-10"
                parts = month_str.split("-")
                year = int(parts[0])
                month_num = int(parts[1])
            else:
                month_num = int(month_str) if month_str.isdigit() else 1

            if year < 2020 or year > 2030:
                continue

            period_start = date(year, month_num, 1)
            # End of month
            if month_num == 12:
                period_end = date(year + 1, 1, 1)
            else:
                period_end = date(year, month_num + 1, 1)

            airline = str(row.get("airline", "Unknown")).strip()

            # Passengers carried
            passengers = row.get("passengers_carried")
            if passengers and pd.notna(passengers):
                records.append({
                    "source": "dgca_traffic",
                    "metric_name": "passengers_carried",
                    "metric_value": Decimal(str(int(float(passengers)))),
                    "period_start": period_start,
                    "period_end": period_end,
                    "period_type": "monthly",
                    "dimensions": {"airline": airline},
                    "fetched_at": now,
                    "raw_payload": {
                        "fixture": is_fixture,
                        "source_note": str(row.get("source_note", "")),
                    },
                })

            # Load factor
            load_factor = row.get("load_factor_pct")
            if load_factor and pd.notna(load_factor):
                records.append({
                    "source": "dgca_traffic",
                    "metric_name": "load_factor_pct",
                    "metric_value": Decimal(str(round(float(load_factor), 2))),
                    "period_start": period_start,
                    "period_end": period_end,
                    "period_type": "monthly",
                    "dimensions": {"airline": airline},
                    "fetched_at": now,
                    "raw_payload": {
                        "fixture": is_fixture,
                        "source_note": str(row.get("source_note", "")),
                    },
                })

            # Flights operated
            flights = row.get("flights_operated")
            if flights and pd.notna(flights):
                records.append({
                    "source": "dgca_traffic",
                    "metric_name": "flights_operated",
                    "metric_value": Decimal(str(int(float(flights)))),
                    "period_start": period_start,
                    "period_end": period_end,
                    "period_type": "monthly",
                    "dimensions": {"airline": airline},
                    "fetched_at": now,
                    "raw_payload": {
                        "fixture": is_fixture,
                        "source_note": str(row.get("source_note", "")),
                    },
                })

        except (ValueError, TypeError, KeyError) as exc:
            logger.debug("DGCA traffic: Skipping malformed row: %s", exc)
            continue

    logger.info("DGCA traffic data: Normalized %d data points", len(records))
    return records


def load_fare_data(use_fixture: bool = True) -> List[Dict[str, Any]]:
    """Load DGCA average fare monitoring data.

    Attempts the same download → cache → fixture fallback chain as
    load_traffic_data().

    Returns GovernmentDataPoint-shaped dicts.
    """
    df = None

    # Step 1: Try live download
    for url in _DGCA_FARE_URLS:
        try:
            df = _download_dataframe(url)
            if df is not None and not df.empty:
                logger.info(
                    "DGCA fare data: Loaded %d rows from %s",
                    len(df), url,
                )
                break
        except Exception:
            continue

    # Step 2: Try cache
    if df is None or df.empty:
        df = _load_from_cache("*fare*.*")
        if df is not None and not df.empty:
            logger.info("DGCA fare data: Loaded %d rows from cache", len(df))

    # Step 3: Fixture fallback
    if (df is None or df.empty) and use_fixture:
        fixture_path = _FIXTURES_DIR / "dgca_sample_fares.csv"
        if fixture_path.exists():
            df = pd.read_csv(fixture_path)
            logger.info(
                "DGCA fare data: Using fixture fallback (%d rows) from %s",
                len(df), fixture_path,
            )
        else:
            logger.error("DGCA fare fixture not found: %s", fixture_path)
            return []

    if df is None or df.empty:
        logger.error("DGCA fare data: All sources exhausted. No data loaded.")
        return []

    return _normalize_fare_records(df, is_fixture=(df is not None and use_fixture))


def _normalize_fare_records(
    df: pd.DataFrame, is_fixture: bool = False
) -> List[Dict[str, Any]]:
    """Normalize fare DataFrame into GovernmentDataPoint-shaped dicts."""
    now = datetime.now(timezone.utc)
    records: List[Dict[str, Any]] = []

    # Standardize column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    for _, row in df.iterrows():
        try:
            month_str = str(row.get("month", ""))
            year = int(row.get("year", 0))

            if "-" in month_str:
                parts = month_str.split("-")
                year = int(parts[0])
                month_num = int(parts[1])
            else:
                month_num = int(month_str) if month_str.isdigit() else 1

            if year < 2020 or year > 2030:
                continue

            period_start = date(year, month_num, 1)
            if month_num == 12:
                period_end = date(year + 1, 1, 1)
            else:
                period_end = date(year, month_num + 1, 1)

            route = str(row.get("route", "")).strip()

            # Average fare
            avg_fare = row.get("avg_fare_inr")
            if avg_fare and pd.notna(avg_fare):
                records.append({
                    "source": "dgca_avg_fare",
                    "metric_name": "avg_fare_inr",
                    "metric_value": Decimal(str(round(float(avg_fare), 2))),
                    "period_start": period_start,
                    "period_end": period_end,
                    "period_type": "monthly",
                    "dimensions": {"route": route},
                    "fetched_at": now,
                    "raw_payload": {
                        "fixture": is_fixture,
                        "min_fare": float(row.get("min_fare_inr", 0)),
                        "max_fare": float(row.get("max_fare_inr", 0)),
                        "sample_size": int(row.get("sample_size", 0)),
                        "source_note": str(row.get("source_note", "")),
                    },
                })

        except (ValueError, TypeError, KeyError) as exc:
            logger.debug("DGCA fare: Skipping malformed row: %s", exc)
            continue

    logger.info("DGCA fare data: Normalized %d data points", len(records))
    return records


def load_all(use_fixture: bool = True) -> List[Dict[str, Any]]:
    """Load all DGCA data (traffic + fares).

    Convenience function that calls both loaders and merges results.
    Each loader degrades independently — one can fail without affecting
    the other.
    """
    all_records: List[Dict[str, Any]] = []

    try:
        traffic = load_traffic_data(use_fixture=use_fixture)
        all_records.extend(traffic)
    except Exception as exc:
        logger.error("DGCA traffic loader failed: %s", exc)

    try:
        fares = load_fare_data(use_fixture=use_fixture)
        all_records.extend(fares)
    except Exception as exc:
        logger.error("DGCA fare loader failed: %s", exc)

    logger.info(
        "DGCA loader: Total %d data points loaded (%d traffic, %d fares)",
        len(all_records),
        sum(1 for r in all_records if r["source"] == "dgca_traffic"),
        sum(1 for r in all_records if r["source"] == "dgca_avg_fare"),
    )

    return all_records
