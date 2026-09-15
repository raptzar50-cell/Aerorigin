"""
Management command: seed_synthetic_data

Generates realistic synthetic airfare data into the RawFare table,
simulating what a real scraper would produce. This data drives all
downstream pipeline stages and dashboard visualizations.

Uses the shared fare generation logic from scraper.fare_generator
(same model that MockFareScraper uses for on-demand generation).

# TODO: SCRAPER-INTEGRATION — Once the real scraper is connected and
# writing into RawFare, this command becomes unnecessary for production
# but remains useful for development/testing. You may want to add a
# guard: `if settings.LIVE_MODE: raise CommandError("Cannot seed in LIVE_MODE")`
"""

import random
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from fares.models import RawFare
from scraper.fare_generator import (
    ROUTES,
    SOURCES,
    LEAD_TIME_OPTIONS,
    generate_fare_observation,
)


# Time range
DAYS_OF_HISTORY = 90


class Command(BaseCommand):
    help = 'Generate synthetic airfare data into RawFare table'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=DAYS_OF_HISTORY,
            help=f'Number of days of historical data to generate (default: {DAYS_OF_HISTORY})',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing RawFare data before seeding',
        )

    def handle(self, *args, **options):
        days = options['days']
        if options['clear']:
            count = RawFare.objects.count()
            RawFare.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Cleared {count} existing RawFare records'))

        today = date.today()
        start_date = today - timedelta(days=days)

        records = []
        anomaly_count = 0
        total_count = 0

        for route in ROUTES:
            for source in SOURCES:
                # Source-specific price modifier (±10%) to simulate different pricing
                source_modifier = 1.0 + random.uniform(-0.10, 0.10)

                for day_offset in range(days):
                    scrape_date = start_date + timedelta(days=day_offset)
                    scrape_dt = timezone.make_aware(
                        datetime.combine(scrape_date, datetime.min.time().replace(hour=random.randint(6, 22)))
                    )

                    # For each scrape day, generate fares for several departure dates ahead
                    for lead_time in LEAD_TIME_OPTIONS:
                        departure = scrape_date + timedelta(days=lead_time)

                        # Use shared generation function
                        obs = generate_fare_observation(
                            origin=route['origin'],
                            destination=route['destination'],
                            departure_date=departure,
                            source=source,
                            scrape_datetime=scrape_dt,
                            base_fare=route['base_fare'],
                            source_modifier=source_modifier,
                            day_offset=day_offset,
                            is_mock=False,  # Seed data is marked synthetic, not mock
                        )

                        # Check if anomaly was injected (check payload)
                        if obs['raw_payload'].get('synthetic'):
                            # Count anomalies by checking if fare deviates significantly
                            # from expected (approximate check)
                            pass

                        records.append(RawFare(
                            source=obs['source'],
                            origin=obs['origin'],
                            destination=obs['destination'],
                            departure_date=obs['departure_date'],
                            fare_raw=Decimal(str(obs['fare_raw'])),
                            taxes_raw=Decimal(str(obs['taxes_raw'])),
                            currency=obs['currency'],
                            scraped_at=obs['scraped_at'],
                            raw_payload=obs['raw_payload'],
                        ))
                        total_count += 1

                        # Batch insert every 5000 records to manage memory
                        if len(records) >= 5000:
                            RawFare.objects.bulk_create(records)
                            records = []

        # Insert remaining records
        if records:
            RawFare.objects.bulk_create(records)

        self.stdout.write(self.style.SUCCESS(
            f'[OK] Seeded {total_count:,} RawFare records '
            f'({len(ROUTES)} routes x {len(SOURCES)} sources x {days} days x {len(LEAD_TIME_OPTIONS)} lead times)'
        ))
