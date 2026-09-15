"""
Unified real fare scraper — wraps Playwright-based OTA scrapers, existing
API providers (Amadeus/Google/Kiwi), and government data loaders under
the single FareScraper interface.

This is the DROP-IN replacement for MockFareScraper. Swap via
registry.py's get_active_scraper() — one line.

Architecture:
    RealFareScraper.scrape()          ← synchronous Django interface
        ├─ MakeMyTripProvider          ← Playwright (with fixture fallback)
        ├─ LiveFareScraper providers   ← Amadeus, Google, Kiwi APIs
        └─ (All providers run in parallel via asyncio)

Government data (DGCA/MoSPI) is NOT included in scrape() — those are
aggregate statistics that go into GovernmentDataPoint, not individual
fare quotes. They are loaded via the load_government_data management
command or the --source-type government flag in run_scrape_cycle.

IMPORTANT:
  - Every observation has "mock": false in raw_payload
  - Fixture-based observations have "fixture": true
  - Live observations have "fixture": false
  - Each source failure is logged but never crashes the cycle
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date
from typing import List, Optional

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from .base import FareScraper
from .providers.base import FlightProvider, ProviderResult

logger = logging.getLogger(__name__)


class RealFareScraper(FareScraper):
    """
    Production fare scraper that queries real sources:

    1. MakeMyTrip (Playwright + fixture fallback)
    2. Amadeus API (if credentials configured)
    3. Google Flights via SerpAPI (if credentials configured)
    4. Kiwi.com Tequila API (if credentials configured)

    Falls back gracefully when any source fails — never crashes.
    """

    def __init__(
        self,
        include_mmt: bool = True,
        include_api_providers: bool = True,
    ):
        """
        Args:
            include_mmt: Whether to include MakeMyTrip Playwright scraper
            include_api_providers: Whether to include API-based providers
                (Amadeus, Google, Kiwi)
        """
        self._providers: List[FlightProvider] = []
        self._include_mmt = include_mmt
        self._include_api = include_api_providers
        self._initialized = False

    def _lazy_init(self):
        """Lazily initialize providers to avoid import-time side effects."""
        if self._initialized:
            return
        self._initialized = True

        # Add MakeMyTrip Playwright provider
        if self._include_mmt:
            try:
                from .providers.makemytrip import MakeMyTripProvider
                self._providers.append(MakeMyTripProvider())
                logger.debug("RealFareScraper: MakeMyTripProvider registered")
            except ImportError as exc:
                logger.warning(
                    "RealFareScraper: MakeMyTripProvider import failed: %s", exc
                )

        # Add API-based providers from the existing registry
        if self._include_api:
            try:
                from .providers.registry import build_default_registry
                registry = build_default_registry()
                for provider in registry.configured_providers():
                    self._providers.append(provider)
                    logger.debug(
                        "RealFareScraper: API provider '%s' registered (configured)",
                        provider.name,
                    )
            except ImportError as exc:
                logger.warning(
                    "RealFareScraper: API provider registry import failed: %s", exc
                )

        if not self._providers:
            logger.warning(
                "RealFareScraper: No providers available! "
                "Scrape calls will return empty results. "
                "Check: Playwright installed? API keys in .env?"
            )
        else:
            names = [p.name for p in self._providers]
            logger.info(
                "RealFareScraper: Initialized with %d provider(s): %s",
                len(self._providers), ", ".join(names),
            )

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((ConnectionError, TimeoutError)),
        reraise=False,
    )
    def scrape(self, origin: str, destination: str, departure_date: date) -> List[dict]:
        """
        Scrape fare data from all configured real providers.

        Queries all providers in parallel, merges results, and returns
        a flat list of RawFare-compatible dicts.

        Degrades gracefully — if one provider fails, others still return
        their data. Only returns empty list if ALL providers fail.

        Args:
            origin: IATA airport code (e.g., "DEL")
            destination: IATA airport code (e.g., "BOM")
            departure_date: The departure date to scrape fares for

        Returns:
            List of dicts shaped for direct RawFare insertion.
        """
        self._lazy_init()

        if not self._providers:
            logger.warning(
                "RealFareScraper: No providers configured. "
                "Returning empty results for %s→%s",
                origin, destination,
            )
            return []

        provider_names = [p.name for p in self._providers]
        logger.info(
            "RealFareScraper: Querying %d provider(s) for %s→%s (dep: %s): %s",
            len(self._providers), origin, destination, departure_date,
            ", ".join(provider_names),
        )

        # Bridge sync → async
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                results = pool.submit(
                    asyncio.run,
                    self._search_all(origin, destination, departure_date)
                ).result()
        else:
            results = asyncio.run(
                self._search_all(origin, destination, departure_date)
            )

        # Merge and log results
        all_observations: List[dict] = []
        for result in results:
            if isinstance(result, Exception):
                logger.warning(
                    "RealFareScraper: Provider raised exception: %s", result
                )
                continue

            if result.status == "ok":
                all_observations.extend(result.observations)
                logger.info(
                    "  ✓ %s: %d observations (latency: %dms)%s",
                    result.provider, len(result.observations),
                    result.latency_ms,
                    f" [{result.error}]" if result.error else "",
                )
            elif result.status == "no_results":
                logger.info(
                    "  ○ %s: no results (latency: %dms)",
                    result.provider, result.latency_ms,
                )
            else:
                logger.warning(
                    "  ✗ %s: status=%s, error=%s (latency: %dms)",
                    result.provider, result.status,
                    result.error or "none", result.latency_ms,
                )

        logger.info(
            "RealFareScraper: Total %d observations from %d provider(s) for %s→%s",
            len(all_observations), len(self._providers), origin, destination,
        )

        return all_observations

    async def _search_all(
        self, origin: str, destination: str, departure_date: date
    ) -> List[ProviderResult]:
        """Run all provider searches in parallel with individual error handling."""
        tasks = []
        for provider in self._providers:
            tasks.append(
                self._safe_search(provider, origin, destination, departure_date)
            )
        return await asyncio.gather(*tasks, return_exceptions=True)

    @staticmethod
    async def _safe_search(
        provider: FlightProvider,
        origin: str,
        destination: str,
        departure_date: date,
    ) -> ProviderResult:
        """Wrap a single provider search with error handling.

        Never raises — returns a ProviderResult with error status instead.
        """
        try:
            return await provider.search_flights(
                origin, destination, departure_date, "ECONOMY"
            )
        except Exception as exc:
            logger.warning(
                "RealFareScraper: Provider '%s' crashed: %s",
                provider.name, exc,
            )
            return ProviderResult(
                provider=provider.name,
                status="error",
                error=str(exc)[:200],
                latency_ms=0,
            )

    @property
    def name(self) -> str:
        self._lazy_init()
        if not self._providers:
            return "RealFareScraper[no providers]"
        names = [p.name for p in self._providers]
        return f"RealFareScraper[{', '.join(names)}]"
