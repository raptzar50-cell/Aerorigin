"""
Management command: evaluate_forecast_accuracy

Evaluates Chronos-2 index forecasts against actual index values.
Finds ForecastAccuracyLog entries where the forecast_date has passed
and an actual PriceIndex value is now available, then computes error
metrics.

This is the INFRASTRUCTURE for ongoing forecast accuracy monitoring.
Even with limited data during the hackathon, this pipeline demonstrates
the mechanism for real-world model evaluation.
"""

import logging
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Evaluate forecast accuracy — compare predicted vs actual index values'

    def handle(self, *args, **options):
        from fares.models import PriceIndex, ForecastAccuracyLog

        now = timezone.now()
        today = now.date()

        # Find unevaluated entries where an actual index value is available
        pending = ForecastAccuracyLog.objects.filter(
            actual_index__isnull=True,
        )

        if not pending.exists():
            self.stdout.write('No pending forecast evaluations found.')
            return

        self.stdout.write(f'Evaluating {pending.count()} pending forecasts...')

        evaluated_count = 0
        not_available = 0

        for entry in pending:
            # Look up actual index value for this date/route
            if entry.route:
                actual = PriceIndex.objects.filter(
                    route=entry.route,
                    period_type='daily',
                    index_date=entry.forecast_date,
                ).first()
            else:
                actual = PriceIndex.objects.filter(
                    route__isnull=True,
                    period_type='daily',
                    index_date=entry.forecast_date,
                ).first()

            if actual is None:
                not_available += 1
                continue

            actual_value = float(actual.index_value)
            predicted_value = float(entry.predicted_index)

            # Compute error metrics
            abs_error = abs(predicted_value - actual_value)
            pct_error = (abs_error / actual_value * 100) if actual_value > 0 else 0

            # Check if actual falls within prediction interval
            within = True
            if entry.lower_bound is not None and entry.upper_bound is not None:
                within = (
                    float(entry.lower_bound) <= actual_value <= float(entry.upper_bound)
                )

            entry.actual_index = Decimal(str(round(actual_value, 2)))
            entry.error = Decimal(str(round(abs_error, 2)))
            entry.error_pct = Decimal(str(round(pct_error, 2)))
            entry.within_interval = within
            entry.evaluated_at = now
            entry.save(update_fields=[
                'actual_index', 'error', 'error_pct',
                'within_interval', 'evaluated_at',
            ])

            evaluated_count += 1

        # Print summary
        self.stdout.write(self.style.SUCCESS(
            f'Evaluated {evaluated_count} forecasts '
            f'({not_available} dates not yet available in index data)'
        ))

        # Print aggregate accuracy if we have evaluated entries
        all_evaluated = ForecastAccuracyLog.objects.filter(
            actual_index__isnull=False
        )
        if all_evaluated.exists():
            from django.db.models import Avg
            agg = all_evaluated.aggregate(
                mae=Avg('error'),
                mape=Avg('error_pct'),
            )
            interval_hits = all_evaluated.filter(within_interval=True).count()
            total_eval = all_evaluated.count()

            self.stdout.write(
                f'\nOverall Forecast Accuracy (all evaluated):\n'
                f'  Total evaluated:        {total_eval}\n'
                f'  Mean Absolute Error:    {float(agg["mae"]):.2f}\n'
                f'  Mean Absolute % Error:  {float(agg["mape"]):.2f}%\n'
                f'  Interval Hit Rate:      {interval_hits}/{total_eval} '
                f'({interval_hits/total_eval*100:.1f}%)\n'
            )
