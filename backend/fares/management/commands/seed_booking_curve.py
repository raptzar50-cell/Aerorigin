import csv
import logging
import time
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import transaction
from fares.models import HistoricalBookingCurve

logger = logging.getLogger(__name__)

CITY_MAP = {
    'Delhi': 'DEL',
    'Mumbai': 'BOM',
    'Bangalore': 'BLR',
    'Kolkata': 'CCU',
    'Hyderabad': 'HYD',
    'Chennai': 'MAA'
}

class Command(BaseCommand):
    help = 'Seeds historical booking curve data from a CSV file.'

    def handle(self, *args, **options):
        csv_path = Path('c:/Users/hp/Aerogin/ion.csv')
        if not csv_path.exists():
            self.stderr.write(self.style.ERROR(f'File not found: {csv_path}'))
            return

        self.stdout.write(f'Reading from {csv_path}...')
        start_time = time.time()
        
        batch_size = 5000
        batch = []
        rows_read = 0
        inserted_total = 0

        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows_read += 1
                
                src = row.get('source_city')
                dst = row.get('destination_city')
                if not src or not dst:
                    continue

                route = f"{CITY_MAP.get(src, src)}-{CITY_MAP.get(dst, dst)}"
                
                # We skip missing essential data
                try:
                    price = float(row.get('price', 0))
                    days_left = int(row.get('days_left', 0))
                    duration = float(row.get('duration', 0))
                except (ValueError, TypeError):
                    continue
                
                obj = HistoricalBookingCurve(
                    route=route,
                    airline=row.get('airline'),
                    flight_class=row.get('class'),
                    days_left=days_left,
                    duration=duration,
                    stops=row.get('stops'),
                    price=price
                )
                batch.append(obj)

                if len(batch) >= batch_size:
                    inserted = HistoricalBookingCurve.objects.bulk_create(batch, ignore_conflicts=True)
                    inserted_total += len(inserted)
                    batch = []
                    self.stdout.write(f'Processed {rows_read} rows...')

            if batch:
                inserted = HistoricalBookingCurve.objects.bulk_create(batch, ignore_conflicts=True)
                inserted_total += len(inserted)

        elapsed = time.time() - start_time
        self.stdout.write(self.style.SUCCESS(
            f'Finished in {elapsed:.2f}s! '
            f'Read: {rows_read}, Inserted/Skipped: {inserted_total} (bulk_create with ignore_conflicts).'
        ))
