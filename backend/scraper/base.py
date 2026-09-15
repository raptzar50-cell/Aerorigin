"""
Abstract base class for fare scrapers.

This interface is CONTRACTUAL — any scraper (mock or real) must implement
this exact signature. When the real scraper arrives from its separate Git
repo, it should subclass FareScraper and implement scrape() with the same
return shape.

Each returned dict must match the RawFare model fields exactly so that
the pipeline can insert them directly.
"""

from abc import ABC, abstractmethod
from datetime import date, datetime


class FareScraper(ABC):
    """
    Base class for all fare scrapers.

    Implementations must return a list of dicts, each shaped exactly like
    a raw fare observation ready for insertion into the RawFare table.
    """

    @abstractmethod
    def scrape(self, origin: str, destination: str, departure_date: date) -> list[dict]:
        """
        Scrape fare data for a specific route and departure date.

        Args:
            origin: IATA airport code (e.g., "DEL")
            destination: IATA airport code (e.g., "BOM")
            departure_date: The departure date to scrape fares for

        Returns:
            A list of dicts, each shaped as:
            {
                "source": str,           # e.g., "AirlineA", "OTA_X"
                "origin": str,           # IATA code
                "destination": str,      # IATA code
                "departure_date": date,  # departure date
                "fare_raw": float,       # base fare before taxes
                "taxes_raw": float,      # tax/fee amount
                "currency": str,         # ISO 4217, default "INR"
                "scraped_at": datetime,  # when the scrape happened
                "raw_payload": dict,     # original data for debugging
            }
        """
        ...

    @property
    def name(self) -> str:
        """Human-readable name for this scraper, used in logs."""
        return self.__class__.__name__
