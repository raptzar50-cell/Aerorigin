"""
Management command: compute_price_index

Reads valid CleanFare data, computes CPI-style price index values
(base period = earliest date = index 100), and writes to PriceIndex.

Supports daily, weekly, and monthly rollup periods.
Computes both per-route and national aggregate indices.
"""

from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Avg, Count, Min

from fares.models import CleanFare, PriceIndex


class Command(BaseCommand):
    help = 'Compute CPI-style price index from CleanFare data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing PriceIndex data before computing',
        )

    def handle(self, *args, **options):
        if options['clear']:
            count = PriceIndex.objects.count()
            PriceIndex.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Cleared {count} existing PriceIndex records'))

        valid_fares = CleanFare.objects.filter(is_valid=True)
        if not valid_fares.exists():
            self.stdout.write(self.style.WARNING('No valid CleanFare records found'))
            return

        # Get all unique routes — use set() to guarantee dedup (SQLite quirk)
        routes = list(set(
            valid_fares
            .values_list('origin', 'destination')
            .distinct()
        ))
        self.stdout.write(f'Computing index for {len(routes)} routes...')

        total_records = 0

        # Compute per-route indices
        for origin, destination in routes:
            route_code = f'{origin}-{destination}'
            route_fares = valid_fares.filter(origin=origin, destination=destination)
            total_records += self._compute_index_for_queryset(route_fares, route_code)

        # Compute national aggregate index (all routes combined)
        total_records += self._compute_index_for_queryset(valid_fares, route=None)

        self.stdout.write(self.style.SUCCESS(
            f'[OK] Computed {total_records:,} PriceIndex records '
            f'({len(routes)} routes + national aggregate x 3 periods)'
        ))

    def _compute_index_for_queryset(self, queryset, route):
        """Compute daily, weekly, and monthly index values for a queryset."""
        records_created = 0

        # Get daily averages
        daily_data = list(
            queryset
            .values('departure_date')
            .annotate(avg_fare=Avg('total_fare'), sample_size=Count('id'))
            .order_by('departure_date')
        )

        if not daily_data:
            return 0

        # Base period: earliest date's average fare = index 100
        base_fare = float(daily_data[0]['avg_fare'])
        if base_fare == 0:
            return 0

        # --- Daily index ---
        daily_records = []
        for row in daily_data:
            avg = float(row['avg_fare'])
            index_val = (avg / base_fare) * 100.0

            daily_records.append(PriceIndex(
                index_date=row['departure_date'],
                route=route,
                index_value=Decimal(str(round(index_val, 2))),
                avg_fare=Decimal(str(round(avg, 2))),
                sample_size=row['sample_size'],
                period_type='daily',
            ))

        # Upsert: delete existing then bulk create
        PriceIndex.objects.filter(route=route, period_type='daily').delete()
        PriceIndex.objects.bulk_create(daily_records)
        records_created += len(daily_records)

        # --- Weekly index ---
        weekly_buckets = defaultdict(lambda: {'total_fare': 0, 'count': 0})
        for row in daily_data:
            # ISO week start (Monday)
            d = row['departure_date']
            week_start = d - timedelta(days=d.weekday())
            weekly_buckets[week_start]['total_fare'] += float(row['avg_fare']) * row['sample_size']
            weekly_buckets[week_start]['count'] += row['sample_size']

        weekly_records = []
        for week_start in sorted(weekly_buckets.keys()):
            bucket = weekly_buckets[week_start]
            avg = bucket['total_fare'] / bucket['count']
            index_val = (avg / base_fare) * 100.0

            weekly_records.append(PriceIndex(
                index_date=week_start,
                route=route,
                index_value=Decimal(str(round(index_val, 2))),
                avg_fare=Decimal(str(round(avg, 2))),
                sample_size=bucket['count'],
                period_type='weekly',
            ))

        PriceIndex.objects.filter(route=route, period_type='weekly').delete()
        PriceIndex.objects.bulk_create(weekly_records)
        records_created += len(weekly_records)

        # --- Monthly index ---
        monthly_buckets = defaultdict(lambda: {'total_fare': 0, 'count': 0})
        for row in daily_data:
            month_start = row['departure_date'].replace(day=1)
            monthly_buckets[month_start]['total_fare'] += float(row['avg_fare']) * row['sample_size']
            monthly_buckets[month_start]['count'] += row['sample_size']

        monthly_records = []
        for month_start in sorted(monthly_buckets.keys()):
            bucket = monthly_buckets[month_start]
            avg = bucket['total_fare'] / bucket['count']
            index_val = (avg / base_fare) * 100.0

            monthly_records.append(PriceIndex(
                index_date=month_start,
                route=route,
                index_value=Decimal(str(round(index_val, 2))),
                avg_fare=Decimal(str(round(avg, 2))),
                sample_size=bucket['count'],
                period_type='monthly',
            ))

        PriceIndex.objects.filter(route=route, period_type='monthly').delete()
        PriceIndex.objects.bulk_create(monthly_records)
        records_created += len(monthly_records)

        route_label = route or 'National'
        self.stdout.write(f'  {route_label}: {len(daily_records)} daily, {len(weekly_records)} weekly, {len(monthly_records)} monthly')

        return records_created
