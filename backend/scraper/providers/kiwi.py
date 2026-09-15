"""
Kiwi.com Tequila API provider.

Endpoint: GET {KIWI_TEQUILA_BASE_URL}/v2/search
Auth: `apikey` HTTP header. NEVER exposed to browser.

As of 2026, Tequila is partner-restricted. If your key was issued via
a partnership portal, KIWI_TEQUILA_BASE_URL and KIWI_TEQUILA_API_KEY
should come from that portal. Set both env vars to enable this provider.

Requires KIWI_TEQUILA_API_KEY env var.
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

_KEY = os.environ.get("KIWI_TEQUILA_API_KEY", "")
_BASE = os.environ.get("KIWI_TEQUILA_BASE_URL", "https://tequila-api.kiwi.com").rstrip("/")

_CABIN_CODE = {
    "ECONOMY": "M",
    "PREMIUM_ECONOMY": "W",
    "BUSINESS": "C",
    "FIRST": "F",
}

CARRIER_NAMES = {
    "6E": "IndiGo",
    "AI": "Air India",
    "UK": "Vistara",
    "SG": "SpiceJet",
    "QP": "Akasa Air",
    "I5": "Air India Express",
    "EK": "Emirates",
    "SQ": "Singapore Airlines",
    "BA": "British Airways",
    "TG": "Thai Airways",
    "CX": "Cathay Pacific",
    "QR": "Qatar Airways",
    "AF": "Air France",
    "LH": "Lufthansa",
    "TK": "Turkish Airlines",
    "EY": "Etihad Airways",
    "MH": "Malaysia Airlines",
}


class KiwiProvider(FlightProvider):
    name = "kiwi"
    is_real = True

    def is_configured(self) -> bool:
        return bool(_KEY)

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
                error="KIWI_TEQUILA_API_KEY is empty.",
            )
        started = time.perf_counter()
        date_str = travel_date.strftime("%d/%m/%Y")
        params = {
            "fly_from": origin,
            "fly_to": destination,
            "date_from": date_str,
            "date_to": date_str,
            "curr": "INR",
            "adults": 1,
            "selected_cabins": _CABIN_CODE.get(cabin_class, "M"),
            "one_for_city": 0,
            "sort": "price",
            "limit": 30,
        }
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0)) as client:
                r = await client.get(
                    f"{_BASE}/v2/search",
                    params=params,
                    headers={"apikey": _KEY, "Accept": "application/json"},
                )
                if r.status_code in (401, 403):
                    return ProviderResult(
                        provider=self.name,
                        status="error",
                        error=f"Kiwi access denied (HTTP {r.status_code}); verify partner entitlement.",
                        latency_ms=int((time.perf_counter() - started) * 1000),
                    )
                if r.status_code == 429:
                    return ProviderResult(
                        provider=self.name,
                        status="unavailable",
                        error="Kiwi rate limit reached (HTTP 429).",
                        latency_ms=int((time.perf_counter() - started) * 1000),
                    )
                r.raise_for_status()
                payload = r.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Kiwi Tequila request failed: %s", exc)
            return ProviderResult(
                provider=self.name,
                status="unavailable",
                error=str(exc)[:200],
                latency_ms=int((time.perf_counter() - started) * 1000),
            )

        observations = _normalize_kiwi(payload, travel_date, cabin_class)
        return ProviderResult(
            provider=self.name,
            status="ok" if observations else "no_results",
            observations=observations,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )


def _normalize_kiwi(
    payload: dict, travel_date: date_type, cabin_class: str
) -> List[dict]:
    """Tequila response → List[dict] for RawFare."""
    now = datetime.now(timezone.utc)
    currency = payload.get("currency", "INR")
    out: List[dict] = []
    for item in payload.get("data") or []:
        try:
            route = item.get("route") or []
            if not route:
                continue
            first = route[0]
            carrier = first.get("airline") or ""
            airline_name = CARRIER_NAMES.get(carrier, carrier or "Unknown")
            flight_number = f"{carrier}{first.get('flight_no', '')}"

            total_price = float(item.get("price", 0))
            if total_price <= 0:
                continue

            # Estimate fare/tax split (~85%/15%)
            fare_raw = round(total_price * 0.85, 2)
            taxes_raw = round(total_price - fare_raw, 2)

            duration = item.get("duration") or {}
            total_seconds = duration.get("total")
            duration_minutes = int(total_seconds / 60) if total_seconds else None

            out.append({
                "source": f"kiwi_{airline_name.replace(' ', '_')}",
                "origin": first.get("flyFrom") or item.get("flyFrom") or "",
                "destination": (route[-1].get("flyTo")) or item.get("flyTo") or "",
                "departure_date": travel_date,
                "fare_raw": fare_raw,
                "taxes_raw": taxes_raw,
                "currency": currency,
                "scraped_at": now,
                "raw_payload": {
                    "provider": "kiwi",
                    "airline": airline_name,
                    "flight_number": flight_number,
                    "cabin_class": cabin_class,
                    "departure_time": item.get("local_departure"),
                    "arrival_time": item.get("local_arrival"),
                    "duration_minutes": duration_minutes,
                    "stops": max(0, len(route) - 1),
                    "total_price": total_price,
                    "mock": False,
                    "synthetic": False,
                },
            })
        except (KeyError, IndexError, ValueError, TypeError):
            continue
    return out
