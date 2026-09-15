"""
SerpApi Google Flights provider.

Endpoint: GET https://serpapi.com/search?engine=google_flights
Auth: `api_key` query parameter. NEVER exposed to browser.
Free tier: ~100 searches/month per account.

Requires SERPAPI_KEY env var.
"""
from __future__ import annotations

import logging
import os
import time
from datetime import date as date_type, datetime, timezone
from typing import List

import httpx

from scraper.providers.base import FlightProvider, ProviderResult

logger = logging.getLogger(__name__)

try:
    from decouple import config
except ImportError:
    def config(key, default=""):
        return os.environ.get(key, default)

_BASE = "https://serpapi.com/search"

_CABIN_NUM = {
    "ECONOMY": "1",
    "PREMIUM_ECONOMY": "2",
    "BUSINESS": "3",
    "FIRST": "4",
}


def _get_api_keys() -> List[str]:
    """Retrieve all configured SerpApi keys from decouple config or os.environ."""
    keys: List[str] = []
    # Primary key (supports comma-separated list)
    primary = str(config("SERPAPI_KEY", default=os.environ.get("SERPAPI_KEY", "")))
    for k in primary.split(","):
        k = k.strip()
        if k and k not in keys:
            keys.append(k)
    # Additional numbered keys (SERPAPI_KEY_2, SERPAPI_KEY_3, ...)
    for i in range(2, 10):
        extra = str(config(f"SERPAPI_KEY_{i}", default=os.environ.get(f"SERPAPI_KEY_{i}", ""))).strip()
        if extra and extra not in keys:
            keys.append(extra)
    return keys


class GoogleFlightsProvider(FlightProvider):
    name = "google_flights"
    is_real = True

    def is_configured(self) -> bool:
        return bool(_get_api_keys())

    async def search_flights(
        self,
        origin: str,
        destination: str,
        travel_date: date_type,
        cabin_class: str,
    ) -> ProviderResult:
        keys = _get_api_keys()
        if not keys:
            return ProviderResult(
                provider=self.name,
                status="credentials_required",
                error="SERPAPI_KEY is empty.",
            )
        started = time.perf_counter()
        last_error = ""

        for idx, key in enumerate(keys):
            params = {
                "engine": "google_flights",
                "api_key": key,
                "type": "2",  # one-way
                "departure_id": origin,
                "arrival_id": destination,
                "outbound_date": travel_date.isoformat(),
                "travel_class": _CABIN_NUM.get(cabin_class, "1"),
                "currency": "INR",
                "hl": "en",
            }
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0)) as client:
                    r = await client.get(_BASE, params=params)
                    if r.status_code in (401, 403):
                        last_error = f"SerpApi auth failed (HTTP {r.status_code}) on key #{idx + 1}"
                        logger.warning(last_error)
                        continue
                    if r.status_code == 429:
                        last_error = f"SerpApi rate/quota limit reached on key #{idx + 1}"
                        logger.warning("%s, trying next key...", last_error)
                        continue
                    r.raise_for_status()
                    payload = r.json()
            except Exception as exc:  # noqa: BLE001
                last_error = str(exc)[:200]
                logger.warning("Google Flights (SerpApi) request failed on key #%d: %s", idx + 1, exc)
                continue

            if payload.get("error"):
                last_error = str(payload["error"])[:200]
                if any(w in last_error.lower() for w in ("quota", "searches", "limit", "credits", "unauthorized")):
                    logger.warning("SerpApi error '%s' on key #%d, trying next key...", last_error, idx + 1)
                    continue
                return ProviderResult(
                    provider=self.name,
                    status="error",
                    error=last_error,
                    latency_ms=int((time.perf_counter() - started) * 1000),
                )

            observations = _normalize_google_flights(payload, travel_date, cabin_class)
            return ProviderResult(
                provider=self.name,
                status="ok" if observations else "no_results",
                observations=observations,
                latency_ms=int((time.perf_counter() - started) * 1000),
            )

        return ProviderResult(
            provider=self.name,
            status="unavailable",
            error=f"All SerpApi keys exhausted/failed. Last error: {last_error}",
            latency_ms=int((time.perf_counter() - started) * 1000),
        )


def _normalize_google_flights(
    payload: dict, travel_date: date_type, cabin_class: str
) -> List[dict]:
    """SerpApi google_flights response → List[dict] for RawFare."""
    now = datetime.now(timezone.utc)
    currency = (payload.get("search_parameters") or {}).get("currency", "INR")
    itineraries = (payload.get("best_flights") or []) + (payload.get("other_flights") or [])
    out: List[dict] = []
    for itin in itineraries:
        try:
            price = itin.get("price")
            segments = itin.get("flights") or []
            if price is None or not segments:
                continue
            first, last = segments[0], segments[-1]
            dep_airport = first.get("departure_airport") or {}
            arr_airport = last.get("arrival_airport") or {}
            airline = first.get("airline") or "Unknown"
            flight_number = first.get("flight_number") or ""
            total_price = float(price)

            # Estimate fare/tax split (~85%/15%)
            fare_raw = round(total_price * 0.85, 2)
            taxes_raw = round(total_price - fare_raw, 2)

            out.append({
                "source": f"google_flights_{airline.replace(' ', '_')}",
                "origin": dep_airport.get("id") or "",
                "destination": arr_airport.get("id") or "",
                "departure_date": travel_date,
                "fare_raw": fare_raw,
                "taxes_raw": taxes_raw,
                "currency": currency,
                "scraped_at": now,
                "raw_payload": {
                    "provider": "google_flights",
                    "airline": airline,
                    "flight_number": flight_number,
                    "cabin_class": cabin_class,
                    "departure_time": dep_airport.get("time"),
                    "arrival_time": arr_airport.get("time"),
                    "duration_minutes": itin.get("total_duration"),
                    "stops": max(0, len(segments) - 1),
                    "total_price": total_price,
                    "mock": False,
                    "synthetic": False,
                },
            })
        except (KeyError, IndexError, ValueError, TypeError):
            continue
    return out
