"""
Management command: run_scrape_cycle

Triggers one full scrape cycle across all tracked routes via the active
scraper (mock, live API, or real), then feeds results through the entire
pipeline:
  scraper → RawFare → cleaning → anomaly detection → price index

Supports hybrid cadences via --source-type:
  - ota:        Run OTA/airline fare scraping only (frequent: hourly/daily)
  - government: Run DGCA + MoSPI data loading only (infrequent: monthly)
  - all:        Run everything (default)

This is the command the scheduler calls repeatedly, and the command a
real cron/Celery task would also call once deployed properly.

Usage:
    python manage.py run_scrape_cycle
    python manage.py run_scrape_cycle --lead-days 7 14 30
    python manage.py run_scrape_cycle --source-type ota
    python manage.py run_scrape_cycle --source-type government
"""

import logging
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone

from fares.models import RawFare
from scraper.fare_generator import ROUTES
from scraper.registry import get_active_scraper

logger = logging.getLogger(__name__)

# File-based cycle counter for auto-retrain trigger
CYCLE_COUNTER_KEY = '_scrape_cycle_count'


class Command(BaseCommand):
    help = 'Run one scrape cycle across all tracked routes, then clean and reindex'

    def add_arguments(self, parser):
        parser.add_argument(
            '--lead-days',
            nargs='+',
            type=int,
            default=[3, 7, 14, 30],
            help='Lead time days to scrape for each route (default: 3 7 14 30)',
        )
        parser.add_argument(
            '--skip-pipeline',
            action='store_true',
            help='Only scrape, skip cleaning and index computation',
        )
        parser.add_argument(
            '--skip-retrain',
            action='store_true',
            help='Skip automatic retraining even if cycle threshold is reached',
        )
        parser.add_argument(
            '--skip-prediction',
            action='store_true',
            help='Skip the Chronos-2 prediction stage',
        )
        parser.add_argument(
            '--source-type',
            choices=['ota', 'government', 'all'],
            default='all',
            help=(
                'Which sources to run: '
                '"ota" = OTA/airline fare scraping only (frequent), '
                '"government" = DGCA + MoSPI data loading only (infrequent/monthly), '
                '"all" = both (default)'
            ),
        )

    def handle(self, *args, **options):
        lead_days = options['lead_days']
        skip_pipeline = options['skip_pipeline']
        skip_retrain = options['skip_retrain']
        skip_prediction = options['skip_prediction']
        source_type = options['source_type']

        self.stdout.write(f'Source type: {source_type}')

        # --- OTA/Airline fare scraping ---
        if source_type in ('ota', 'all'):
            self._run_ota_scrape(lead_days)

        # --- Government data loading (DGCA + MoSPI) ---
        if source_type in ('government', 'all'):
            self._run_government_load()

        # Run the downstream pipeline
        if not skip_pipeline and source_type in ('ota', 'all'):
            self._run_pipeline(skip_prediction)

        # Auto-retrain check
        if not skip_retrain and source_type in ('ota', 'all'):
            self._check_auto_retrain()

    def _run_ota_scrape(self, lead_days):
        """Run the OTA/airline fare scraping cycle."""
        scraper = get_active_scraper()
        self.stdout.write(f'Active scraper: {scraper.name}')

        today = date.today()
        total_observations = 0
        total_inserted = 0

        # Scrape each tracked route
        for route in ROUTES:
            origin = route['origin']
            destination = route['destination']

            for lead in lead_days:
                departure = today + timedelta(days=lead)

                try:
                    observations = scraper.scrape(origin, destination, departure)
                except Exception as e:
                    self.stderr.write(self.style.ERROR(
                        f'  ERROR scraping {origin}-{destination} dep={departure}: {e}'
                    ))
                    continue

                total_observations += len(observations)

                # Insert into RawFare
                raw_fares = []
                for obs in observations:
                    raw_fares.append(RawFare(
                        source=obs['source'],
                        origin=obs['origin'],
                        destination=obs['destination'],
                        departure_date=obs['departure_date'],
                        fare_raw=Decimal(str(obs['fare_raw'])),
                        taxes_raw=Decimal(str(obs['taxes_raw'])),
                        currency=obs.get('currency', 'INR'),
                        scraped_at=obs['scraped_at'],
                        raw_payload=obs['raw_payload'],
                    ))

                if raw_fares:
                    RawFare.objects.bulk_create(raw_fares)
                    total_inserted += len(raw_fares)

        self.stdout.write(self.style.SUCCESS(
            f'[OK] {scraper.name} generated {total_observations} observations, '
            f'{total_inserted} inserted into RawFare'
        ))

    def _run_government_load(self):
        """Load government data (DGCA + MoSPI) into GovernmentDataPoint."""
        self.stdout.write('Loading government data (DGCA + MoSPI)...')
        try:
            call_command('load_government_data', source='all')
        except Exception as e:
            self.stderr.write(self.style.ERROR(
                f'  Government data loading failed: {e}'
            ))

    def _run_pipeline(self, skip_prediction):
        """Run the downstream processing pipeline."""
        # Stage 0: Basic cleaning / normalization (existing pipeline)
        self.stdout.write('Running cleaning pipeline...')
        call_command('run_cleaning_pipeline')

        # Stage 1: PyOD anomaly screening
        self.stdout.write('Running PyOD anomaly screening...')
        try:
            call_command('run_anomaly_screening')
        except Exception as e:
            self.stderr.write(self.style.ERROR(
                f'  Anomaly screening failed: {e}'
            ))

        # Price index computation (uses cleaned, screened data)
        self.stdout.write('Computing price index...')
        call_command('compute_price_index')

        # Stage 2: Chronos-2 prediction
        if not skip_prediction:
            self.stdout.write('Running Chronos-2 prediction cycle...')
            try:
                call_command('run_prediction_cycle')
            except Exception as e:
                self.stderr.write(self.style.ERROR(
                    f'  Prediction cycle failed: {e}'
                ))

        self.stdout.write(self.style.SUCCESS(
            '[OK] Full pipeline cycle complete '
            '(scraper -> cleaning -> anomaly screening -> '
            'price index -> prediction)'
        ))

    def _check_auto_retrain(self):
        """
        Check if we've hit the retrain interval and trigger retraining.
        Uses Django's cache framework or a simple file counter.
        """
        retrain_interval = getattr(settings, 'SCRAPE_CYCLE_RETRAIN_INTERVAL', 5)

        try:
            from django.core.cache import cache
            cycle_count = cache.get(CYCLE_COUNTER_KEY, 0) + 1
            cache.set(CYCLE_COUNTER_KEY, cycle_count, timeout=None)
        except Exception:
            # Fallback: use a file-based counter
            import json
            from pathlib import Path
            counter_file = Path(settings.BASE_DIR) / '.scrape_cycle_count'
            try:
                cycle_count = int(counter_file.read_text().strip()) + 1
            except (FileNotFoundError, ValueError):
                cycle_count = 1
            counter_file.write_text(str(cycle_count))

        self.stdout.write(
            f'  Scrape cycle #{cycle_count} (retrain every {retrain_interval} cycles)'
        )

        if cycle_count % retrain_interval == 0:
            self.stdout.write(self.style.WARNING(
                f'  → Retrain threshold reached (cycle #{cycle_count}). '
                f'Triggering anomaly detector retraining...'
            ))
            try:
                call_command('train_anomaly_detector')
            except Exception as e:
                self.stderr.write(self.style.ERROR(f'  Retraining failed: {e}'))
