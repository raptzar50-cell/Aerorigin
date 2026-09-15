"""
Management command: analyze_anomaly_false_positives

Diagnose false positives in the anomaly detection pipeline.
Pulls records flagged as 'price_outlier' (or 'pyod_anomaly') and shows:
- route, price
- deviation from the route's mean/median
- number of total observations for that route
Prints a summary to identify if false positives are concentrated on sparse routes.
"""

from collections import defaultdict
import numpy as np

from django.core.management.base import BaseCommand
from django.db.models import Avg, StdDev, Count

from fares.models import CleanFare


class Command(BaseCommand):
    help = 'Analyze anomaly false positives to diagnose precision issues'

    def handle(self, *args, **options):
        self.stdout.write('=' * 60)
        self.stdout.write('  ANOMALY DIAGNOSTIC REPORT')
        self.stdout.write('=' * 60)

        # 1. Gather stats per route
        routes = CleanFare.objects.filter(is_valid=True).values_list('origin', 'destination').distinct()
        
        route_stats = {}
        for origin, destination in routes:
            qs = CleanFare.objects.filter(origin=origin, destination=destination, is_valid=True)
            stats = qs.aggregate(
                mean_fare=Avg('total_fare'),
                count=Count('id')
            )
            
            # Use numpy for median
            fares = list(qs.values_list('total_fare', flat=True))
            median_fare = float(np.median(fares)) if fares else 0.0
            
            route_stats[f'{origin}-{destination}'] = {
                'mean': float(stats['mean_fare'] or 0),
                'median': median_fare,
                'count': stats['count'],
            }

        # 2. Get flagged anomalies
        anomalies = []
        for cf in CleanFare.objects.filter(is_valid=True):
            flags = cf.quality_flags or []
            if 'price_outlier' in flags or 'pyod_anomaly' in flags:
                anomalies.append(cf)

        self.stdout.write(f'Found {len(anomalies)} total anomalies flagged.\n')

        # 3. Analyze each anomaly
        sparse_route_anomalies = 0
        SPARSE_THRESHOLD = 30
        route_anomaly_counts = defaultdict(int)

        for cf in anomalies:
            route_key = f'{cf.origin}-{cf.destination}'
            stats = route_stats[route_key]
            route_anomaly_counts[route_key] += 1
            
            mean_dev = (float(cf.total_fare) - stats['mean']) / stats['mean'] if stats['mean'] > 0 else 0
            median_dev = (float(cf.total_fare) - stats['median']) / stats['median'] if stats['median'] > 0 else 0
            
            if stats['count'] < SPARSE_THRESHOLD:
                sparse_route_anomalies += 1
                
            self.stdout.write(
                f"[{route_key}] Fare: INR {cf.total_fare} "
                f"| Mean dev: {mean_dev*100:+.1f}% "
                f"| Median dev: {median_dev*100:+.1f}% "
                f"| Route N={stats['count']}"
            )

        # 4. Print Summary
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write('  SUMMARY')
        self.stdout.write('=' * 60)
        self.stdout.write(f"Total flagged anomalies: {len(anomalies)}")
        self.stdout.write(
            f"Anomalies on sparse routes (N < {SPARSE_THRESHOLD}): "
            f"{sparse_route_anomalies} ({(sparse_route_anomalies/max(1, len(anomalies)))*100:.1f}%)"
        )
        
        self.stdout.write("\nAnomaly concentration by route:")
        sorted_counts = sorted(route_anomaly_counts.items(), key=lambda x: x[1], reverse=True)
        for route_key, count in sorted_counts[:10]:
            stats = route_stats[route_key]
            self.stdout.write(f"  {route_key}: {count} anomalies (Total N={stats['count']})")
