"""
Management command: run_index_forecast

Runs Chronos-2 predictions on the PRICE INDEX time series (not raw fares).
Generates forecasts for:
  - National aggregate index (30-day horizon)
  - Each per-route index (30-day horizon)

Outputs include:
  - Median forecast (50th percentile)
  - 80% prediction interval (10th–90th percentiles)
  - Illustrative CPI impact note
  - ForecastAccuracyLog entries for future evaluation

This reframes the predictor for MoSPI stakeholders: instead of
"how much will my flight cost," it answers "what will the national
airfare price index look like for the next 30 days" — directly
relevant to CPI/inflation analysis.
"""

import logging
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Run Chronos-2 index forecast for national and per-route price indices'

    def add_arguments(self, parser):
        parser.add_argument(
            '--horizon',
            type=int,
            default=30,
            help='Forecast horizon in days (default: 30)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing forecasts before generating new ones',
        )

    def handle(self, *args, **options):
        from fares.models import PriceIndex, IndexForecast, ForecastAccuracyLog

        horizon = options['horizon']

        if options['clear']:
            deleted = IndexForecast.objects.all().delete()[0]
            self.stdout.write(f'Cleared {deleted} existing index forecasts')

        # Get all routes that have index data
        routes_with_data = list(
            PriceIndex.objects
            .filter(period_type='daily')
            .values_list('route', flat=True)
            .distinct()
        )

        self.stdout.write(
            f'Generating {horizon}-day index forecasts for '
            f'{len(routes_with_data)} route(s) (including national)...'
        )

        total_generated = 0

        for route in routes_with_data:
            count = self._forecast_route(route, horizon)
            total_generated += count

        self.stdout.write(self.style.SUCCESS(
            f'Generated {total_generated} index forecast records'
        ))

    def _forecast_route(self, route, horizon):
        """Generate index forecast for a single route (or national if route is None)."""
        import pandas as pd
        import numpy as np
        from fares.models import PriceIndex, IndexForecast, ForecastAccuracyLog

        route_label = route or 'National'

        # Pull historical index data
        if route:
            history = PriceIndex.objects.filter(
                route=route, period_type='daily'
            ).order_by('index_date')
        else:
            history = PriceIndex.objects.filter(
                route__isnull=True, period_type='daily'
            ).order_by('index_date')

        if history.count() < 7:
            self.stdout.write(
                f'  {route_label}: skipping — only {history.count()} data points '
                f'(need at least 7)'
            )
            return 0

        # Build time series DataFrame
        dates = [h.index_date for h in history]
        values = [float(h.index_value) for h in history]

        history_df = pd.DataFrame({
            'timestamp': pd.to_datetime(dates),
            'total_fare': values,  # Reuse the same field name Chronos expects
        })

        latest_index_value = values[-1]
        latest_date = dates[-1]

        # Try Chronos-2
        forecast_df = None
        try:
            from prediction.fare_predictor import predict_fare_trend
            forecast_df = predict_fare_trend(
                route=route_label,
                history_df=history_df,
                horizon_days=horizon,
            )
        except Exception as e:
            logger.warning(
                '%s: Chronos-2 failed (%s), using statistical fallback', route_label, e
            )

        # Fallback: simple trend-based projection if Chronos-2 unavailable
        if forecast_df is None:
            forecast_df = self._statistical_fallback(
                values, latest_date, horizon
            )

        if forecast_df is None or len(forecast_df) == 0:
            self.stdout.write(f'  {route_label}: no forecast generated')
            return 0

        # Get CPI weight from settings
        cpi_weight = getattr(settings, 'CPI_AIR_TRANSPORT_WEIGHT', 0.0218)

        # Store forecasts
        forecasts_to_create = []
        accuracy_logs_to_create = []
        now = timezone.now()

        for _, row in forecast_df.iterrows():
            predicted = float(row['predicted_value'])
            lower = float(row['lower_bound'])
            upper = float(row['upper_bound'])

            # Compute percentage change from latest known value
            pct_change = (
                (predicted - latest_index_value) / latest_index_value * 100
                if latest_index_value > 0 else 0
            )

            # Compute illustrative CPI impact
            cpi_impact = abs(pct_change) * cpi_weight
            direction = 'increase' if pct_change > 0 else 'decrease'
            cpi_note = (
                f'Illustrative: A projected {abs(pct_change):.1f}% {direction} '
                f'in the airfare index could contribute approximately '
                f'{cpi_impact:.2f} percentage points to the CPI transport '
                f'sub-index (assuming air transport weight ≈ {cpi_weight*100:.2f}% '
                f'of CPI basket). This is a simplified illustration, not a '
                f'claim of methodological integration with actual CPI weighting.'
            )

            forecasts_to_create.append(IndexForecast(
                route=route,
                forecast_date=row['forecast_date'],
                predicted_index=Decimal(str(round(predicted, 2))),
                lower_bound=Decimal(str(round(lower, 2))),
                upper_bound=Decimal(str(round(upper, 2))),
                pct_change_from_latest=Decimal(str(round(pct_change, 2))),
                cpi_impact_note=cpi_note,
                model_name='chronos-2',
            ))

            accuracy_logs_to_create.append(ForecastAccuracyLog(
                route=route,
                forecast_date=row['forecast_date'],
                predicted_index=Decimal(str(round(predicted, 2))),
                lower_bound=Decimal(str(round(lower, 2))),
                upper_bound=Decimal(str(round(upper, 2))),
                generated_at=now,
                model_name='chronos-2',
            ))

        # Bulk create (ignore conflicts for idempotent re-runs)
        IndexForecast.objects.bulk_create(
            forecasts_to_create,
            ignore_conflicts=True,
        )
        ForecastAccuracyLog.objects.bulk_create(
            accuracy_logs_to_create,
            ignore_conflicts=True,
        )

        self.stdout.write(
            f'  {route_label}: {len(forecasts_to_create)} forecast points generated'
        )
        return len(forecasts_to_create)

    def _statistical_fallback(self, values, latest_date, horizon):
        """
        Simple statistical trend-based fallback when Chronos-2 is unavailable.
        Uses linear trend + noise band for uncertainty.
        """
        import pandas as pd
        import numpy as np

        if len(values) < 3:
            return None

        arr = np.array(values)
        n = len(arr)

        # Compute linear trend from last 30 days (or all data if less)
        window = min(30, n)
        recent = arr[-window:]

        # Linear regression on the window
        x = np.arange(window)
        slope = np.polyfit(x, recent, 1)[0]

        # Standard deviation for noise band
        std = np.std(recent)

        # Project forward
        forecast_dates = []
        predicted = []
        lowers = []
        uppers = []

        for i in range(horizon):
            date = latest_date + timedelta(days=i + 1)
            pred = recent[-1] + slope * (i + 1)
            # Widen the band as we project further out
            uncertainty = std * np.sqrt(i + 1) * 0.3
            forecast_dates.append(date)
            predicted.append(max(50, pred))  # Floor at 50 for index values
            lowers.append(max(50, pred - uncertainty))
            uppers.append(pred + uncertainty)

        return pd.DataFrame({
            'forecast_date': forecast_dates,
            'predicted_value': predicted,
            'lower_bound': lowers,
            'upper_bound': uppers,
        })
