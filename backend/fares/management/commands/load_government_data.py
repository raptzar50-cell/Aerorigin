"""
Management command: load_government_data

Loads government data (DGCA passenger traffic, DGCA average fares,
MoSPI CPI transport indices) into the GovernmentDataPoint model.

These sources update monthly — don't schedule frequent runs. Typically
called via:
    python manage.py load_government_data --source all
    python manage.py load_government_data --source dgca
    python manage.py load_government_data --source mospi

Or as part of:
    python manage.py run_scrape_cycle --source-type government
"""

import logging
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import IntegrityError

from fares.models import GovernmentDataPoint

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Load DGCA and MoSPI government data into GovernmentDataPoint'

    def add_arguments(self, parser):
        parser.add_argument(
            '--source',
            choices=['dgca', 'mospi', 'all'],
            default='all',
            help='Which government source to load (default: all)',
        )
        parser.add_argument(
            '--no-fixture',
            action='store_true',
            help='Disable fixture fallback — only use live/cached data',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing government data before loading',
        )

    def handle(self, *args, **options):
        source = options['source']
        use_fixture = not options['no_fixture']
        clear = options['clear']

        if clear:
            if source == 'all':
                count = GovernmentDataPoint.objects.all().delete()[0]
            elif source == 'dgca':
                count = GovernmentDataPoint.objects.filter(
                    source__startswith='dgca_'
                ).delete()[0]
            else:
                count = GovernmentDataPoint.objects.filter(
                    source__startswith='mospi_'
                ).delete()[0]
            self.stdout.write(f'Cleared {count} existing records')

        total_loaded = 0

        # --- DGCA Data ---
        if source in ('dgca', 'all'):
            total_loaded += self._load_dgca(use_fixture)

        # --- MoSPI Data ---
        if source in ('mospi', 'all'):
            total_loaded += self._load_mospi(use_fixture)

        self.stdout.write(self.style.SUCCESS(
            f'[OK] Loaded {total_loaded} government data points'
        ))

    def _load_dgca(self, use_fixture: bool) -> int:
        """Load DGCA data and insert into GovernmentDataPoint."""
        self.stdout.write('Loading DGCA data...')

        try:
            from scraper.dgca_loader import load_all as load_dgca
            records = load_dgca(use_fixture=use_fixture)
        except ImportError as exc:
            self.stderr.write(self.style.ERROR(
                f'  DGCA loader import failed: {exc}'
            ))
            return 0
        except Exception as exc:
            self.stderr.write(self.style.ERROR(
                f'  DGCA loader failed: {exc}'
            ))
            return 0

        return self._insert_records(records, 'DGCA')

    def _load_mospi(self, use_fixture: bool) -> int:
        """Load MoSPI data and insert into GovernmentDataPoint."""
        self.stdout.write('Loading MoSPI data...')

        try:
            from scraper.mospi_loader import load_all as load_mospi
            records = load_mospi(use_fixture=use_fixture)
        except ImportError as exc:
            self.stderr.write(self.style.ERROR(
                f'  MoSPI loader import failed: {exc}'
            ))
            return 0
        except Exception as exc:
            self.stderr.write(self.style.ERROR(
                f'  MoSPI loader failed: {exc}'
            ))
            return 0

        return self._insert_records(records, 'MoSPI')

    def _insert_records(self, records: list, source_label: str) -> int:
        """Insert records into GovernmentDataPoint, skipping duplicates."""
        if not records:
            self.stdout.write(f'  {source_label}: No records to load')
            return 0

        inserted = 0
        skipped = 0

        for record in records:
            try:
                # Convert dimensions dict to a hashable form for unique_together
                # Django's unique_together with JSONField uses exact match
                obj, created = GovernmentDataPoint.objects.update_or_create(
                    source=record['source'],
                    metric_name=record['metric_name'],
                    period_start=record['period_start'],
                    dimensions=record['dimensions'],
                    defaults={
                        'metric_value': record['metric_value'],
                        'period_end': record['period_end'],
                        'period_type': record.get('period_type', 'monthly'),
                        'fetched_at': record['fetched_at'],
                        'raw_payload': record.get('raw_payload', {}),
                    },
                )
                if created:
                    inserted += 1
                else:
                    skipped += 1

            except (IntegrityError, Exception) as exc:
                logger.debug(
                    "%s: Skipping record (%s/%s/%s): %s",
                    source_label,
                    record.get('source'),
                    record.get('metric_name'),
                    record.get('period_start'),
                    exc,
                )
                skipped += 1
                continue

        self.stdout.write(
            f'  {source_label}: {inserted} inserted, {skipped} updated/skipped '
            f'(total records: {len(records)})'
        )
        return inserted
