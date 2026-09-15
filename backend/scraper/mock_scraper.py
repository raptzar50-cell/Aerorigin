"""
Mock fare scraper — generates synthetic observations on-demand.

This is the DROP-IN placeholder for the real scraper. When the real
scraper arrives from its separate Git repo, it replaces this class but
implements the same FareScraper interface, so nothing else changes.

IMPORTANT: Every observation from this scraper is marked with
{"mock": true} in raw_payload. This flag MUST persist in the database
so we can always distinguish mock vs. real data.
"""

import logging
import random
from datetime import date, timedelta

from django.utils import timezone

from .base import FareScraper
from .fare_generator import (
    SOURCES,
    generate_fare_observation,
    get_route_base_fare,
)

logger = logging.getLogger(__name__)


class MockFareScraper(FareScraper):
    """
    Mock scraper that generates synthetic fare observations using the
    same pricing model as the seed data — behavior is indistinguishable
    from the seed data already in the system.
    """

    def scrape(self, origin: str, destination: str, departure_date: date) -> list[dict]:
        """
        Generate 1-3 fake observations from 2-3 random sources.

        Uses the SAME pricing model as the synthetic seed data via
        the shared generate_fare_observation() function.
        """
        now = timezone.now()
        num_observations = random.randint(1, 3)
        selected_sources = random.sample(SOURCES, k=min(num_observations, len(SOURCES)))

        observations = []
        for source in selected_sources:
            obs = generate_fare_observation(
                origin=origin,
                destination=destination,
                departure_date=departure_date,
                source=source,
                scrape_datetime=now,
                is_mock=True,  # Marks raw_payload with {"mock": true}
            )
            observations.append(obs)

        logger.info(
            'MockFareScraper generated %d synthetic observations for %s-%s (dep: %s)',
            len(observations),
            origin,
            destination,
            departure_date,
        )

        return observations

    @property
    def name(self) -> str:
        return 'MockFareScraper'
