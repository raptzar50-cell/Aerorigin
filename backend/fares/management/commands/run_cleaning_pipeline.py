"""
Management command: run_cleaning_pipeline

Reads unprocessed RawFare rows, normalizes them into CleanFare, and runs
real anomaly detection:
  1. Day-over-day percentage change > threshold → 'price_outlier'
  2. Individual fare > sigma×σ from route's mean → 'statistical_outlier'

If a trained AnomalyModelVersion exists, uses its fitted parameters
(per-route means, stds, thresholds). Otherwise falls back to computing
statistics on the fly.

# TODO: SCRAPER-INTEGRATION — In production with a live scraper, this
# pipeline should be triggered automatically after each scrape batch
# completes (e.g., via a Celery task or a Django signal on RawFare bulk
# insert). For the prototype, it's run manually via management command.
"""

import logging
from collections import defaultdict
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Avg, StdDev, Q

from fares.models import RawFare, CleanFare, AnomalyModelVersion

logger = logging.getLogger(__name__)

# Default anomaly detection thresholds (used when no trained model exists)
DAY_OVER_DAY_THRESHOLD = 0.20   # 20% day-over-day change flags as price_outlier
STATISTICAL_SIGMA = 3.0          # 3 standard deviations flags as statistical_outlier
ROLLING_WINDOW_DAYS = 14         # Rolling window for computing mean/std

DOMESTIC_INDIAN_AIRPORTS = {
    'DEL', 'BOM', 'BLR', 'HYD', 'CCU', 'MAA', 'AMD', 'GOI', 'PNQ', 'ATQ', 'COK', 'TRV', 
    'CCJ', 'IXC', 'SXR', 'IXB', 'GAU', 'BBI', 'LKO', 'VNS', 'PAT', 'IXR', 'JAI', 'UDR', 
    'JDH', 'RPR', 'NAG', 'IDR', 'BHO', 'STV', 'IXZ', 'VTZ', 'TIR', 'CJB', 'IXM', 'TRZ', 
    'IXE', 'GOX', 'CNN', 'HBX', 'IMF', 'SHL', 'JRH', 'DIB', 'TCR', 'DED', 'PGH', 'GAY', 
    'LUH', 'BDQ', 'RAJ', 'BHU', 'JGA', 'KNU', 'PYG', 'VGA'
}

DOMESTIC_INDIAN_CARRIERS = [
    'indigo', 'air india', 'air_india', 'air india express', 'air_india_express', 
    'spicejet', 'akasa air', 'akasa_air', 'vistara', 'go first', 'go_first'
]



class Command(BaseCommand):
    help = 'Clean raw fares, normalize, and run anomaly detection'

    def add_arguments(self, parser):
        parser.add_argument(
            '--threshold',
            type=float,
            default=None,
            help='Day-over-day change threshold (default: from trained model or 0.20)',
        )
        parser.add_argument(
            '--sigma',
            type=float,
            default=None,
            help='Sigma threshold for statistical outliers (default: from trained model or 3.0)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing CleanFare data before running',
        )

    def handle(self, *args, **options):
        # Load trained model parameters if available
        active_model = AnomalyModelVersion.get_active()
        model_params = {}

        if active_model:
            self.stdout.write(self.style.SUCCESS(
                f'Using trained model v{active_model.version} '
                f'(trained on {active_model.record_count:,} records)'
            ))
            model_params = active_model.parameters or {}
            detection_config = model_params.get('detection_config', {})
            default_threshold = detection_config.get('dod_threshold', DAY_OVER_DAY_THRESHOLD)
            default_sigma = detection_config.get('sigma', STATISTICAL_SIGMA)
        else:
            self.stdout.write(self.style.WARNING(
                'No trained model found. Using default detection parameters. '
                'Run `python manage.py train_anomaly_detector` to train one.'
            ))
            default_threshold = DAY_OVER_DAY_THRESHOLD
            default_sigma = STATISTICAL_SIGMA

        # Command-line args override model parameters
        threshold = options['threshold'] if options['threshold'] is not None else default_threshold
        sigma = options['sigma'] if options['sigma'] is not None else default_sigma

        if options['clear']:
            count = CleanFare.objects.count()
            CleanFare.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Cleared {count} existing CleanFare records'))

        # Step 1: Find unprocessed RawFare rows
        processed_ids = set(
            CleanFare.objects.values_list('raw_fare_id', flat=True)
        )
        raw_fares = RawFare.objects.exclude(id__in=processed_ids).order_by('scraped_at')
        total_raw = raw_fares.count()

        if total_raw == 0:
            self.stdout.write(self.style.WARNING('No unprocessed RawFare records found'))
            return

        self.stdout.write(f'Processing {total_raw:,} unprocessed RawFare records...')

        # Step 2: Normalize and create CleanFare records
        clean_records = []
        seen_keys = set()  # For deduplication
        dupe_count = 0
        filtered_carrier_count = 0

        for rf in raw_fares.iterator(chunk_size=5000):
            # Compute derived fields
            scrape_date = rf.scraped_at.date()
            lead_time = (rf.departure_date - scrape_date).days
            total_fare = rf.fare_raw + rf.taxes_raw

            # Deduplication: same source + route + departure_date + scrape_date
            dedup_key = (rf.source, rf.origin, rf.destination, rf.departure_date, scrape_date)
            is_dupe = dedup_key in seen_keys
            if is_dupe:
                dupe_count += 1
            seen_keys.add(dedup_key)

            quality_flags = []
            
            # Carrier allowlist filter for Indian domestic routes
            is_domestic_route = (
                rf.origin in DOMESTIC_INDIAN_AIRPORTS and 
                rf.destination in DOMESTIC_INDIAN_AIRPORTS
            )
            is_allowed_carrier = True
            if is_domestic_route:
                source_lower = rf.source.lower()
                is_allowed_carrier = any(c in source_lower for c in DOMESTIC_INDIAN_CARRIERS)
                if not is_allowed_carrier:
                    quality_flags.append('international_on_domestic')
                    filtered_carrier_count += 1

            clean_records.append(CleanFare(
                raw_fare=rf,
                source=rf.source,
                origin=rf.origin,
                destination=rf.destination,
                departure_date=rf.departure_date,
                lead_time_days=max(lead_time, 0),
                total_fare=total_fare,
                is_valid=(not is_dupe) and is_allowed_carrier,
                quality_flags=quality_flags,
            ))

            # Batch insert
            if len(clean_records) >= 5000:
                CleanFare.objects.bulk_create(clean_records)
                clean_records = []

        if clean_records:
            CleanFare.objects.bulk_create(clean_records)

        self.stdout.write(self.style.SUCCESS(
            f'[OK] Created {total_raw:,} CleanFare records. '
            f'Marked invalid: {dupe_count} dupes, {filtered_carrier_count} filtered carriers.'
        ))

        # Step 3: Anomaly detection — using trained model parameters when available
        self.stdout.write('Running anomaly detection...')
        route_params = model_params.get('route_parameters', {})
        self._detect_day_over_day_anomalies(threshold)
        self._detect_statistical_outliers(sigma, route_params)

        # Summary
        flagged = CleanFare.objects.exclude(quality_flags=[]).count()
        self.stdout.write(self.style.SUCCESS(
            f'[OK] Anomaly detection complete: {flagged:,} records flagged'
        ))

    def _detect_day_over_day_anomalies(self, threshold):
        """
        For each route, compute the daily average fare, then flag any day
        where the day-over-day percentage change exceeds the threshold.
        """
        routes = (
            CleanFare.objects
            .filter(is_valid=True)
            .values_list('origin', 'destination')
            .distinct()
        )

        flagged_count = 0
        for origin, destination in routes:
            # Get daily average fares for this route, ordered by date
            daily_avgs = list(
                CleanFare.objects
                .filter(origin=origin, destination=destination, is_valid=True)
                .values('departure_date')
                .annotate(avg_fare=Avg('total_fare'))
                .order_by('departure_date')
            )

            # Compute day-over-day changes
            anomaly_dates = set()
            for i in range(1, len(daily_avgs)):
                prev_avg = float(daily_avgs[i - 1]['avg_fare'])
                curr_avg = float(daily_avgs[i]['avg_fare'])

                if prev_avg > 0:
                    pct_change = abs(curr_avg - prev_avg) / prev_avg
                    if pct_change > threshold:
                        anomaly_dates.add(daily_avgs[i]['departure_date'])

            # Flag all CleanFare records on anomaly dates for this route
            if anomaly_dates:
                records_to_flag = CleanFare.objects.filter(
                    origin=origin,
                    destination=destination,
                    departure_date__in=anomaly_dates,
                    is_valid=True,
                )
                for record in records_to_flag:
                    if 'price_outlier' not in record.quality_flags:
                        record.quality_flags = list(record.quality_flags) + ['price_outlier']
                        record.save(update_fields=['quality_flags'])
                        flagged_count += 1

        self.stdout.write(f'  -> {flagged_count:,} records flagged as price_outlier (>{threshold*100:.0f}% day-over-day)')

    def _detect_statistical_outliers(self, sigma, trained_route_params=None):
        """
        For each route, flag any fare more than `sigma` standard deviations
        from the route mean.

        If trained_route_params is provided (from a trained model), uses
        those pre-computed means/stds. Otherwise computes on the fly.
        """
        routes = (
            CleanFare.objects
            .filter(is_valid=True)
            .values_list('origin', 'destination')
            .distinct()
        )

        flagged_count = 0
        for origin, destination in routes:
            route_key = f'{origin}-{destination}'

            # Use trained parameters if available, otherwise compute
            if trained_route_params and route_key in trained_route_params:
                params = trained_route_params[route_key]
                mean_fare = params['mean_fare']
                std_fare = params['std_fare']
            else:
                stats = (
                    CleanFare.objects
                    .filter(origin=origin, destination=destination, is_valid=True)
                    .aggregate(
                        mean_fare=Avg('total_fare'),
                        std_fare=StdDev('total_fare'),
                    )
                )
                mean_fare = float(stats['mean_fare'] or 0)
                std_fare = float(stats['std_fare'] or 0)

            if std_fare == 0:
                continue

            lower_bound = mean_fare - sigma * std_fare
            upper_bound = mean_fare + sigma * std_fare

            outliers = CleanFare.objects.filter(
                origin=origin,
                destination=destination,
                is_valid=True,
            ).filter(
                Q(total_fare__lt=Decimal(str(lower_bound))) |
                Q(total_fare__gt=Decimal(str(upper_bound)))
            )

            for record in outliers:
                if 'statistical_outlier' not in record.quality_flags:
                    record.quality_flags = list(record.quality_flags) + ['statistical_outlier']
                    record.save(update_fields=['quality_flags'])
                    flagged_count += 1

        self.stdout.write(f'  -> {flagged_count:,} records flagged as statistical_outlier (>{sigma}s)')
