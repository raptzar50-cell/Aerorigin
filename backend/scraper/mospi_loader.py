"""
MoSPI / eSankhyiki data loader — reads published CPI sub-index data.

Sources:
  1. CPI Transport Sub-Index (monthly, from MoSPI CPI releases)
  2. CPI Air Transport component (if disaggregated data is available)

Published at:
  - https://www.mospi.gov.in (press releases)
  - https://esankhyiki.mospi.gov.in (statistical data portal)

ACCESS CONSTRAINTS:
    eSankhyiki requires registration for bulk data downloads. This loader
    attempts to read from known public URLs but falls back to bundled
    static sample data (clearly labeled) when access is restricted.

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

# Known MoSPI/eSankhyiki URLs — these require registration for bulk
# access, so they are unlikely to work without credentials.
_MOSPI_CPI_URLS = [
    "https://www.mospi.gov.in/sites/default/files/press_releases_statements/"
    "CPI_monthly_all_india.xlsx",
    "https://esankhyiki.mospi.gov.in/api/data/cpi/transport",
]

# Cache directory
_CACHE_DIR = Path(__file__).resolve().parent / "cache" / "mospi"


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
    """Download a data file from MoSPI/eSankhyiki and return as DataFrame.

    Retries 3 times with exponential backoff (5s, 10s, 20s).
    """
    import requests

    logger.info("MoSPI loader: Attempting download from %s", url)

    try:
        response = requests.get(url, timeout=30, headers={
            "User-Agent": "Mozilla/5.0 (compatible; AeroginBot/1.0; SIH26056 Research)",
            "Accept": "application/json, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
        response.raise_for_status()

        content_type = response.headers.get("Content-Type", "")

        if "json" in content_type:
            # eSankhyiki API returns JSON
            data = response.json()
            if isinstance(data, list):
                df = pd.DataFrame(data)
            elif isinstance(data, dict) and "data" in data:
                df = pd.DataFrame(data["data"])
            else:
                df = pd.json_normalize(data)
        elif url.endswith(".xlsx") or "spreadsheet" in content_type:
            content = io.BytesIO(response.content)
            df = pd.read_excel(content, engine="openpyxl")
        else:
            content = io.BytesIO(response.content)
            df = pd.read_csv(content)

        # Cache the downloaded file
        cache_dir = _ensure_cache_dir()
        filename = url.split("/")[-1].split("?")[0]
        if not filename:
            filename = "mospi_data.csv"
        cache_path = cache_dir / filename
        cache_path.write_bytes(response.content)
        logger.info("MoSPI loader: Cached to %s", cache_path)

        return df

    except Exception as exc:
        logger.warning("MoSPI loader: Download failed from %s: %s", url, exc)
        raise


def _load_from_cache(filename_pattern: str) -> Optional[pd.DataFrame]:
    """Try to load data from the local cache directory."""
    cache_dir = _ensure_cache_dir()
    for path in sorted(cache_dir.glob(filename_pattern), reverse=True):
        try:
            if path.suffix in (".xlsx", ".xls"):
                return pd.read_excel(path, engine="openpyxl")
            elif path.suffix == ".json":
                return pd.read_json(path)
            else:
                return pd.read_csv(path)
        except Exception as exc:
            logger.warning("MoSPI cache read failed for %s: %s", path, exc)
    return None


def load_cpi_data(use_fixture: bool = True) -> List[Dict[str, Any]]:
    """Load MoSPI CPI transport sub-index data.

    Attempts:
    1. Download from known MoSPI/eSankhyiki URLs
    2. Load from local cache
    3. Fall back to bundled fixture data (if use_fixture=True)

    Returns GovernmentDataPoint-shaped dicts.
    """
    df = None

    # Step 1: Try live download
    for url in _MOSPI_CPI_URLS:
        try:
            df = _download_dataframe(url)
            if df is not None and not df.empty:
                logger.info(
                    "MoSPI CPI data: Loaded %d rows from %s",
                    len(df), url,
                )
                break
        except Exception as exc:
            logger.warning("MoSPI CPI URL failed: %s — %s", url, exc)
            continue

    # Step 2: Try cache
    if df is None or df.empty:
        df = _load_from_cache("*cpi*.*")
        if df is not None and not df.empty:
            logger.info("MoSPI CPI data: Loaded %d rows from cache", len(df))

    # Step 3: Fixture fallback
    if (df is None or df.empty) and use_fixture:
        fixture_path = _FIXTURES_DIR / "mospi_sample_cpi.csv"
        if fixture_path.exists():
            df = pd.read_csv(fixture_path)
            logger.info(
                "MoSPI CPI data: Using fixture fallback (%d rows) from %s",
                len(df), fixture_path,
            )
        else:
            logger.error("MoSPI CPI fixture not found: %s", fixture_path)
            return []

    if df is None or df.empty:
        logger.error("MoSPI CPI data: All sources exhausted. No data loaded.")
        return []

    return _normalize_cpi_records(df, is_fixture=(df is not None and use_fixture))


def _normalize_cpi_records(
    df: pd.DataFrame, is_fixture: bool = False
) -> List[Dict[str, Any]]:
    """Normalize CPI DataFrame into GovernmentDataPoint-shaped dicts."""
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

            base_year = str(row.get("base_year", "2012"))

            # CPI General
            cpi_general = row.get("cpi_general")
            if cpi_general and pd.notna(cpi_general):
                records.append({
                    "source": "mospi_cpi",
                    "metric_name": "cpi_general",
                    "metric_value": Decimal(str(round(float(cpi_general), 2))),
                    "period_start": period_start,
                    "period_end": period_end,
                    "period_type": "monthly",
                    "dimensions": {"base_year": base_year, "category": "general"},
                    "fetched_at": now,
                    "raw_payload": {
                        "fixture": is_fixture,
                        "source_note": str(row.get("source_note", "")),
                    },
                })

            # CPI Transport
            cpi_transport = row.get("cpi_transport")
            if cpi_transport and pd.notna(cpi_transport):
                records.append({
                    "source": "mospi_cpi",
                    "metric_name": "cpi_transport",
                    "metric_value": Decimal(str(round(float(cpi_transport), 2))),
                    "period_start": period_start,
                    "period_end": period_end,
                    "period_type": "monthly",
                    "dimensions": {"base_year": base_year, "category": "transport"},
                    "fetched_at": now,
                    "raw_payload": {
                        "fixture": is_fixture,
                        "source_note": str(row.get("source_note", "")),
                    },
                })

            # CPI Air Transport (sub-component)
            cpi_air = row.get("cpi_air_transport")
            if cpi_air and pd.notna(cpi_air):
                records.append({
                    "source": "mospi_cpi",
                    "metric_name": "cpi_air_transport",
                    "metric_value": Decimal(str(round(float(cpi_air), 2))),
                    "period_start": period_start,
                    "period_end": period_end,
                    "period_type": "monthly",
                    "dimensions": {"base_year": base_year, "category": "air_transport"},
                    "fetched_at": now,
                    "raw_payload": {
                        "fixture": is_fixture,
                        "source_note": str(row.get("source_note", "")),
                    },
                })

        except (ValueError, TypeError, KeyError) as exc:
            logger.debug("MoSPI CPI: Skipping malformed row: %s", exc)
            continue

    logger.info("MoSPI CPI data: Normalized %d data points", len(records))
    return records


def load_all(use_fixture: bool = True) -> List[Dict[str, Any]]:
    """Load all MoSPI data.

    Currently only CPI data. Future: add Statistical Abstract data.
    """
    all_records: List[Dict[str, Any]] = []

    try:
        cpi = load_cpi_data(use_fixture=use_fixture)
        all_records.extend(cpi)
    except Exception as exc:
        logger.error("MoSPI CPI loader failed: %s", exc)

    logger.info("MoSPI loader: Total %d data points loaded", len(all_records))
    return all_records
