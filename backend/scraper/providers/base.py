"""
FlightProvider abstraction for live fare scraping.

All live API backends (Amadeus, Google Flights, Kiwi) implement this
contract. Adapted from the standalone fare-scraping backend to work
within the Django project's scraper module.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date as date_type
from typing import List, Optional


@dataclass
class ProviderResult:
    """Envelope returned by every provider so the caller learns *why* a
    provider returned zero observations without silently faking data."""
    provider: str
    status: str  # ok | no_results | unavailable | credentials_required | error
    observations: List[dict] = field(default_factory=list)
    latency_ms: int = 0
    error: Optional[str] = None


class FlightProvider(ABC):
    """Base class for all live flight-price API providers."""
    name: str = "abstract"
    is_real: bool = True

    @abstractmethod
    def is_configured(self) -> bool:
        """Return True if this provider has valid credentials configured."""
        ...

    @abstractmethod
    async def search_flights(
        self,
        origin: str,
        destination: str,
        travel_date: date_type,
        cabin_class: str,
    ) -> ProviderResult:
        """Search for flight offers and return normalized observations.

        Each observation in the result is a dict shaped for RawFare insertion:
        {
            "source": str,
            "origin": str,
            "destination": str,
            "departure_date": date,
            "fare_raw": float,
            "taxes_raw": float,
            "currency": str,
            "scraped_at": datetime,
            "raw_payload": dict,
        }
        """
        ...
