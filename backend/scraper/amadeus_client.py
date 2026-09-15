"""
Thin async client for Amadeus Flight Offers Search v2.

Handles OAuth2 token lifecycle (auto-refresh) and the flight-offers
search call. If AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET are empty,
`is_configured()` returns False and callers should skip this module.

Adapted from the standalone fare-scraping backend to work within the
Django project.
"""
from __future__ import annotations

import asyncio
import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_BASE = os.environ.get("AMADEUS_BASE_URL", "https://test.api.amadeus.com")
_CID = os.environ.get("AMADEUS_CLIENT_ID", "")
_CSECRET = os.environ.get("AMADEUS_CLIENT_SECRET", "")

_token: Optional[str] = None
_token_expires_at = datetime.min.replace(tzinfo=timezone.utc)
_token_lock = asyncio.Lock()


def is_configured() -> bool:
    return bool(_CID and _CSECRET)


async def _get_token() -> str:
    global _token, _token_expires_at
    now = datetime.now(timezone.utc)
    if _token and now < _token_expires_at:
        return _token
    async with _token_lock:
        now = datetime.now(timezone.utc)
        if _token and now < _token_expires_at:
            return _token
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{_BASE}/v1/security/oauth2/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": _CID,
                    "client_secret": _CSECRET,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            r.raise_for_status()
            payload = r.json()
        _token = payload["access_token"]
        _token_expires_at = now + timedelta(
            seconds=max(60, int(payload.get("expires_in", 1799)) - 60)
        )
        return _token


async def search_flight_offers(
    origin: str, destination: str, travel_date: str, cabin: str, adults: int = 1
) -> list[dict]:
    """Call Amadeus Flight Offers Search v2 and return the raw offers list."""
    token = await _get_token()
    params = {
        "originLocationCode": origin,
        "destinationLocationCode": destination,
        "departureDate": travel_date,
        "adults": adults,
        "travelClass": cabin,
        "max": 50,
        "currencyCode": "INR",
    }
    async with httpx.AsyncClient(timeout=25) as client:
        r = await client.get(
            f"{_BASE}/v2/shopping/flight-offers",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        if r.status_code == 401:
            # Force refresh once
            global _token
            _token = None
            token = await _get_token()
            r = await client.get(
                f"{_BASE}/v2/shopping/flight-offers",
                params=params,
                headers={"Authorization": f"Bearer {token}"},
            )
        r.raise_for_status()
        return r.json().get("data", [])
