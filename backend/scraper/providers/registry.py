"""
Provider registry — manages all live flight-price API providers.

Knows which providers are registered and which have valid credentials.
Used by LiveFareScraper to query all configured providers in parallel.
"""
from __future__ import annotations

import logging
from typing import Dict, List

from scraper.providers.base import FlightProvider

logger = logging.getLogger(__name__)


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: Dict[str, FlightProvider] = {}

    def register(self, provider: FlightProvider) -> None:
        self._providers[provider.name] = provider
        logger.debug("Registered provider: %s (configured=%s)", provider.name, provider.is_configured())

    def all(self) -> List[FlightProvider]:
        return list(self._providers.values())

    def get(self, name: str) -> FlightProvider | None:
        return self._providers.get(name)

    def configured_providers(self) -> List[FlightProvider]:
        """Return only providers that have valid credentials."""
        return [p for p in self._providers.values() if p.is_configured()]

    def has_any_configured(self) -> bool:
        """Return True if at least one provider has valid credentials."""
        return any(p.is_configured() for p in self._providers.values())


def build_default_registry() -> ProviderRegistry:
    """Create a registry with all three live providers registered."""
    from scraper.providers.amadeus import AmadeusProvider
    from scraper.providers.google_flights import GoogleFlightsProvider
    from scraper.providers.kiwi import KiwiProvider

    registry = ProviderRegistry()
    registry.register(AmadeusProvider())
    registry.register(GoogleFlightsProvider())
    registry.register(KiwiProvider())
    return registry
