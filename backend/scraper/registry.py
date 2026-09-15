"""
Scraper registry — factory pattern for selecting the active scraper.

This is the ONE place to change when swapping between scrapers.
Nothing else in the codebase should need to change.

Selection logic (in priority order):
    1. LIVE_MODE=True + REAL_SCRAPER=True → RealFareScraper
       (Playwright + API providers + fixture fallback)
    2. LIVE_MODE=True + REAL_SCRAPER=False → LiveFareScraper
       (API-only: Amadeus, Google Flights, Kiwi)
    3. LIVE_MODE=False → MockFareScraper
       (Synthetic data generation)
"""

import logging

from django.conf import settings

from .base import FareScraper

logger = logging.getLogger(__name__)


def get_active_scraper() -> FareScraper:
    """
    Returns the currently active scraper instance.

    Selection logic:
    1. If LIVE_MODE=True AND REAL_SCRAPER=True, use the RealFareScraper
       (MakeMyTrip Playwright + API providers + fixture fallback).
    2. If LIVE_MODE=True AND REAL_SCRAPER=False (or not set), use the
       LiveFareScraper (Amadeus / Google Flights / Kiwi APIs only).
    3. Otherwise, fall back to MockFareScraper.
    """
    if getattr(settings, 'LIVE_MODE', False):
        # Check for the new RealFareScraper first
        use_real = getattr(settings, 'REAL_SCRAPER', False)
        if use_real:
            try:
                from .real_scraper import RealFareScraper
                scraper = RealFareScraper()
                logger.info('Using %s (LIVE_MODE=True, REAL_SCRAPER=True)', scraper.name)
                return scraper
            except ImportError as e:
                logger.warning(
                    'REAL_SCRAPER=True but RealFareScraper import failed: %s. '
                    'Falling back to LiveFareScraper.', e
                )

        # Fall back to API-only LiveFareScraper
        try:
            from .live_scraper import LiveFareScraper
            scraper = LiveFareScraper()
            if scraper._registry.has_any_configured():
                logger.info('Using %s (LIVE_MODE=True)', scraper.name)
                return scraper
            else:
                logger.warning(
                    'LIVE_MODE=True but no provider has valid credentials. '
                    'Set AMADEUS_CLIENT_ID/SECRET, SERPAPI_KEY, or '
                    'KIWI_TEQUILA_API_KEY in .env. '
                    'Falling back to MockFareScraper.'
                )
        except ImportError as e:
            logger.warning(
                'LIVE_MODE=True but LiveFareScraper import failed: %s. '
                'Falling back to MockFareScraper.', e
            )

    from .mock_scraper import MockFareScraper
    logger.info('Using MockFareScraper (LIVE_MODE=%s)', getattr(settings, 'LIVE_MODE', False))
    return MockFareScraper()
