"""
Live fare scraper — bridges the Django FareScraper interface with real
flight-price API providers (Amadeus, Google Flights, Kiwi).

This is the DROP-IN replacement for MockFareScraper. It implements the
same FareScraper.scrape() contract but calls real APIs under the hood.

Architecture:
    FareScraper.scrape()          ← synchronous Django interface
        └─ asyncio.run()          ← bridge to async world
            └─ asyncio.gather()   ← parallel provider calls
                ├─ AmadeusProvider.search_flights()
                ├─ GoogleFlightsProvider.search_flights()
                └─ KiwiProvider.search_flights()

Each provider returns a ProviderResult with observations shaped as
RawFare-compatible dicts, which are collected and returned.

IMPORTANT: Every observation from this scraper has {"mock": false} in
raw_payload, distinguishing it from MockFareScraper's synthetic data.
"""

import asyncio
import logging
from datetime import date
from typing import List

from .base import FareScraper
from .providers.registry import build_default_registry, ProviderRegistry

logger = logging.getLogger(__name__)


class LiveFareScraper(FareScraper):
    """
    Live scraper that queries real flight-price APIs (Amadeus, Google
    Flights, Kiwi Tequila) in parallel and merges all results.

    Only providers with valid credentials are queried. If no provider
    is configured, returns an empty list (the caller — run_scrape_cycle
    — handles the "zero observations" case gracefully).
    """

    def __init__(self, registry: ProviderRegistry | None = None):
        self._registry = registry or build_default_registry()

    def scrape(self, origin: str, destination: str, departure_date: date) -> List[dict]:
        """
        Scrape fare data by querying all configured live providers in parallel.

        Args:
            origin: IATA airport code (e.g., "DEL")
            destination: IATA airport code (e.g., "BOM")
            departure_date: The departure date to scrape fares for

        Returns:
            A list of dicts, each shaped for direct RawFare insertion.
        """
        configured = self._registry.configured_providers()
        if not configured:
            logger.warning(
                "LiveFareScraper: No providers configured. "
                "Set AMADEUS_CLIENT_ID/SECRET, SERPAPI_KEY, or "
                "KIWI_TEQUILA_API_KEY in your .env file."
            )
            return []

        provider_names = [p.name for p in configured]
        logger.info(
            "LiveFareScraper: Querying %d provider(s) for %s→%s (dep: %s): %s",
            len(configured), origin, destination, departure_date,
            ", ".join(provider_names),
        )

        # Bridge sync → async: run all provider calls in parallel
        try:
            # Try to get a running event loop (e.g., in Jupyter or async context)
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # Already inside an event loop — use nest_asyncio or thread
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                results = pool.submit(
                    asyncio.run,
                    self._search_all(configured, origin, destination, departure_date)
                ).result()
        else:
            results = asyncio.run(
                self._search_all(configured, origin, destination, departure_date)
            )

        # Merge observations from all providers
        all_observations: List[dict] = []
        for result in results:
            if result.status == "ok":
                all_observations.extend(result.observations)
                logger.info(
                    "  %s: %d observations (latency: %dms)",
                    result.provider, len(result.observations), result.latency_ms,
                )
            else:
                logger.warning(
                    "  %s: status=%s, error=%s (latency: %dms)",
                    result.provider, result.status,
                    result.error or "none", result.latency_ms,
                )

        logger.info(
            "LiveFareScraper: Total %d observations from %d provider(s) for %s→%s",
            len(all_observations), len(configured), origin, destination,
        )

        return all_observations

    @staticmethod
    async def _search_all(providers, origin, destination, departure_date):
        """Run all provider searches in parallel."""
        tasks = [
            provider.search_flights(
                origin, destination, departure_date, "ECONOMY"
            )
            for provider in providers
        ]
        return await asyncio.gather(*tasks, return_exceptions=False)

    @property
    def name(self) -> str:
        configured = self._registry.configured_providers()
        names = [p.name for p in configured]
        return f"LiveFareScraper[{', '.join(names)}]"
