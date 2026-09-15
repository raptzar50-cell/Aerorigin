"""
Management command: run_prediction_cycle

STAGE 2 of the three-stage pipeline:
    MOCK SCRAPER → ANOMALY DETECTOR (PyOD) → [PREDICTOR (Chronos-2)]

For each tracked route, pulls anomaly-screened trusted history from
Stage 1, calls Chronos-2's zero-shot forecaster, and stores the
probabilistic forecast in the FarePrediction table.

Usage:
    python manage.py run_prediction_cycle
    python manage.py run_prediction_cycle --horizon 7
    python manage.py run_prediction_cycle --route DEL-BOM
"""

import logging
from decimal import Decimal

import pandas as pd
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from fares.models import CleanFare, FarePrediction
from detection.anomaly_detector import FLAG_PYOD_ANOMALY
from scraper.fare_generator import ROUTES

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Run Chronos-2 prediction cycle for all tracked routes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--horizon',
            type=int,
            default=14,
            help='Number of days to forecast ahead (default: 14)',
        )
        parser.add_argument(
            '--route',
            type=str,
            default=None,
            help='Predict for a specific route only (e.g., DEL-BOM)',
        )

    def handle(self, *args, **options):
        horizon = options['horizon']
        target_route = options['route']

        self.stdout.write('=' * 60)
        self.stdout.write('  CHRONOS-2 PREDICTION CYCLE')
        self.stdout.write('=' * 60)

        # Determine routes to predict
        if target_route:
            parts = target_route.split('-')
            if len(parts) != 2:
                self.stderr.write(self.style.ERROR(
                    f'Invalid route format: {target_route}. Expected: ORIGIN-DEST'
                ))
                return
            routes = [{'origin': parts[0], 'destination': parts[1]}]
        else:
            routes = ROUTES

        self.stdout.write(f'Routes: {len(routes)}')
        self.stdout.write(f'Forecast horizon: {horizon} days')

        # Load the predictor (lazy import to defer model loading)
        from prediction.fare_predictor import predict_fare_trend

        total_forecasts = 0
        route_results = {}

        for route_info in routes:
            origin = route_info['origin']
            destination = route_info['destination']
            route_code = f'{origin}-{destination}'

            self.stdout.write(f'\n  Processing {route_code}...')

            # Pull trusted history: valid records that are NOT flagged
            # as pyod_anomaly. This includes:
            #   - Records with 'pyod_clean' (explicitly screened as clean)
            #   - Records with no pyod flags (not yet screened — legacy data)
            # We EXCLUDE records with 'pyod_anomaly' since feeding known-bad
            # outlier data to the forecaster would corrupt its predictions.
            #
            # NOTE: SQLite doesn't support JSONField __contains lookups,
            # so we fetch all valid records and filter in Python.
            all_fares = list(
                CleanFare.objects
                .filter(
                    origin=origin,
                    destination=destination,
                    is_valid=True,
                )
                .order_by('departure_date')
                .values('departure_date', 'total_fare', 'lead_time_days', 'quality_flags')
            )

            # Exclude records flagged as anomalous by PyOD
            trusted_fares = [
                f for f in all_fares
                if not f['quality_flags']
                or FLAG_PYOD_ANOMALY not in f['quality_flags']
            ]

            if not trusted_fares:
                self.stdout.write(self.style.WARNING(
                    f'    No trusted history for {route_code}, skipping'
                ))
                route_results[route_code] = 'no data'
                continue

            # Convert to DataFrame for Chronos-2
            history_df = pd.DataFrame(list(trusted_fares))

            # Aggregate to daily averages (multiple observations per day)
            daily_df = (
                history_df
                .groupby('departure_date')
                .agg({
                    'total_fare': 'mean',
                    'lead_time_days': 'mean',
                })
                .reset_index()
                .rename(columns={'departure_date': 'timestamp'})
            )
            daily_df['total_fare'] = daily_df['total_fare'].astype(float)

            self.stdout.write(
                f'    Trusted history: {len(daily_df)} daily observations'
            )

            # Run prediction
            forecast_df = predict_fare_trend(
                route=route_code,
                history_df=daily_df,
                horizon_days=horizon,
            )

            if forecast_df is None:
                self.stdout.write(self.style.WARNING(
                    f'    Prediction failed for {route_code}'
                ))
                route_results[route_code] = 'failed'
                continue

            # Upsert forecasts into FarePrediction table
            upserted = 0
            for _, row in forecast_df.iterrows():
                FarePrediction.objects.update_or_create(
                    route=route_code,
                    forecast_date=row['forecast_date'],
                    model_name='chronos-2',
                    defaults={
                        'predicted_value': Decimal(str(round(float(row['predicted_value']), 2))),
                        'lower_bound': Decimal(str(round(float(row['lower_bound']), 2))),
                        'upper_bound': Decimal(str(round(float(row['upper_bound']), 2))),
                    },
                )
                upserted += 1

            total_forecasts += upserted
            route_results[route_code] = f'{upserted} forecasts'
            self.stdout.write(self.style.SUCCESS(
                f'    + {upserted} forecast records saved'
            ))

        # Summary
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('  PREDICTION CYCLE COMPLETE'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(f'  Total forecasts saved: {total_forecasts}')
        for route_code, result in sorted(route_results.items()):
            self.stdout.write(f'    {route_code}: {result}')
        self.stdout.write(self.style.SUCCESS('=' * 60))
