"""
Amadeus Flight Offers Search provider — real live data when configured.

Requires AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET env vars.
Uses the async Amadeus client for token management and API calls,
then normalizes results into RawFare-compatible dicts.
"""
from __future__ import annotations

import logging
import time
from datetime import date as date_type

import httpx

from scraper.amadeus_client import is_configured as amadeus_configured, search_flight_offers
from scraper.normalizer import normalize_amadeus_offers
from scraper.providers.base import FlightProvider, ProviderResult

logger = logging.getLogger(__name__)


class AmadeusProvider(FlightProvider):
    name = "amadeus"
    is_real = True

    def is_configured(self) -> bool:
        return amadeus_configured()

    async def search_flights(
        self,
        origin: str,
        destination: str,
        travel_date: date_type,
        cabin_class: str,
    ) -> ProviderResult:
        if not self.is_configured():
            return ProviderResult(
                provider=self.name,
                status="credentials_required",
                error="AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET are empty.",
            )
        started = time.perf_counter()
        try:
            raw = await search_flight_offers(
                origin, destination, travel_date.isoformat(), cabin_class, adults=1
            )
        except httpx.HTTPStatusError as exc:
            return ProviderResult(
                provider=self.name,
                status="error",
                error=f"Amadeus HTTP {exc.response.status_code}",
                latency_ms=int((time.perf_counter() - started) * 1000),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Amadeus request failed: %s", exc)
            return ProviderResult(
                provider=self.name,
                status="unavailable",
                error=str(exc),
                latency_ms=int((time.perf_counter() - started) * 1000),
            )
        observations = normalize_amadeus_offers(raw, travel_date, cabin_class)
        return ProviderResult(
            provider=self.name,
            status="ok" if observations else "no_results",
            observations=observations,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
