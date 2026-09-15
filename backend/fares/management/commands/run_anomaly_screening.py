"""
Management command: run_anomaly_screening

STAGE 1 of the three-stage pipeline:
    MOCK SCRAPER → [ANOMALY DETECTOR (PyOD)] → PREDICTOR (Chronos-2)

Screens recent CleanFare records using the PyOD-based anomaly detector.
Records are tagged with either 'pyod_clean' (trusted, feeds predictor)
or 'pyod_anomaly' (flagged, shown in quality UI but excluded from
predictor input).

Usage:
    python manage.py run_anomaly_screening
    python manage.py run_anomaly_screening --rescreen
"""

import logging
from collections import defaultdict

from django.core.management.base import BaseCommand

from fares.models import CleanFare, AnomalyModelVersion
from detection.anomaly_detector import (
    PreTrainedPyODDetector,
    FLAG_PYOD_ANOMALY,
    FLAG_PYOD_CLEAN,
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Screen CleanFare records for anomalies using PyOD'

    def add_arguments(self, parser):
        parser.add_argument(
            '--rescreen',
            action='store_true',
            help='Re-screen all records, not just unscreened ones',
        )

    def handle(self, *args, **options):
        rescreen = options['rescreen']

        self.stdout.write('=' * 60)
        self.stdout.write('  PyOD ANOMALY SCREENING')
        self.stdout.write('=' * 60)

        # Find records to screen
        if rescreen:
            record_ids = list(
                CleanFare.objects
                .filter(is_valid=True)
                .values_list('id', flat=True)
            )
            self.stdout.write(self.style.WARNING('Re-screening ALL valid records'))
        else:
            all_valid = CleanFare.objects.filter(is_valid=True).only('id', 'quality_flags')
            record_ids = [
                r.id for r in all_valid
                if not r.quality_flags
                or (FLAG_PYOD_CLEAN not in r.quality_flags
                    and FLAG_PYOD_ANOMALY not in r.quality_flags)
            ]
        total = len(record_ids)

        if total == 0:
            self.stdout.write(self.style.WARNING(
                'No unscreened records found. Use --rescreen to re-screen all.'
            ))
            return

        self.stdout.write(f'Records to screen: {total:,}')

        CHUNK_SIZE = 5000
        total_trusted = 0
        total_anomalous = 0
        all_stats = {}

        # Pre-load active models per route
        active_models_qs = AnomalyModelVersion.objects.filter(is_active=True).exclude(route__isnull=True)
        detectors = {}
        for m in active_models_qs:
            if m.model_blob:
                route_mean = m.parameters.get('route_mean', 0.0)
                try:
                    detectors[m.route] = PreTrainedPyODDetector(m.model_blob, route_mean)
                except Exception as e:
                    logger.error(f"Failed to load model for {m.route}: {e}")

        self.stdout.write(f'Loaded {len(detectors)} active per-route PyOD models.')

        for i in range(0, len(record_ids), CHUNK_SIZE):
            chunk = record_ids[i:i + CHUNK_SIZE]
            records = CleanFare.objects.filter(id__in=chunk, is_valid=True)

            # Group by route
            route_groups = defaultdict(list)
            for record in records:
                route_key = f"{record.origin}-{record.destination}"
                route_groups[route_key].append(record)

            records_to_update = []
            
            for route_code, route_records in route_groups.items():
                if route_code not in all_stats:
                    all_stats[route_code] = {'trusted': 0, 'anomalous': 0}
                
                detector = detectors.get(route_code)
                
                if not detector:
                    # No active model for this route (e.g. < 30 records). Bypass PyOD screening.
                    for record in route_records:
                        flags = list(record.quality_flags) if record.quality_flags else []
                        flags = [f for f in flags if f not in (FLAG_PYOD_ANOMALY, FLAG_PYOD_CLEAN)]
                        flags.append(FLAG_PYOD_CLEAN)
                        record.quality_flags = flags
                        records_to_update.append(record)
                        all_stats[route_code]['trusted'] += 1
                        total_trusted += 1
                    continue
                
                # We have a detector
                is_anomalies = detector.score(route_records)
                
                for record, is_anomaly in zip(route_records, is_anomalies):
                    flags = list(record.quality_flags) if record.quality_flags else []
                    flags = [f for f in flags if f not in (FLAG_PYOD_ANOMALY, FLAG_PYOD_CLEAN)]
                    
                    if is_anomaly:
                        flags.append(FLAG_PYOD_ANOMALY)
                        all_stats[route_code]['anomalous'] += 1
                        total_anomalous += 1
                    else:
                        flags.append(FLAG_PYOD_CLEAN)
                        all_stats[route_code]['trusted'] += 1
                        total_trusted += 1
                        
                    record.quality_flags = flags
                    records_to_update.append(record)

            if records_to_update:
                CleanFare.objects.bulk_update(records_to_update, ['quality_flags'], batch_size=1000)

        # Print per-route stats
        self.stdout.write('\n  Per-route results:')
        for route_code, stats in sorted(all_stats.items()):
            self.stdout.write(
                f'    {route_code}: '
                f'{stats["trusted"]} trusted, '
                f'{stats["anomalous"]} anomalous'
            )

        # Summary
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS('  SCREENING COMPLETE'))
        self.stdout.write('=' * 60)
        self.stdout.write(f'  Total screened:   {total:,}')
        self.stdout.write(f'  Trusted (clean):  {total_trusted:,}')
        self.stdout.write(f'  Anomalous:        {total_anomalous:,}')
        anomaly_pct = (total_anomalous / total * 100) if total > 0 else 0
        self.stdout.write(f'  Anomaly rate:     {anomaly_pct:.1f}%')
        self.stdout.write('=' * 60)
