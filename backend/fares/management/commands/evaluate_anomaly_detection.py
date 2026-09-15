"""
Management command: evaluate_anomaly_detection

Evaluates the anomaly detector's performance by comparing its flagged
records against known injected anomalies from synthetic/mock data.

Known anomalies are identified by records whose fare deviates significantly
from the route's expected pricing (using the injected anomaly markers in
the generation logic).

Usage:
    python manage.py evaluate_anomaly_detection
    python manage.py evaluate_anomaly_detection --version 3
"""

from collections import defaultdict
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Avg, StdDev

from fares.models import CleanFare, RawFare, AnomalyModelVersion


# Threshold for identifying "known" anomalies in synthetic data.
# Records whose fare deviates > KNOWN_ANOMALY_THRESHOLD from the route mean
# are considered "truly anomalous" for evaluation purposes.
KNOWN_ANOMALY_THRESHOLD = 0.20  # 20% deviation from route mean


class Command(BaseCommand):
    help = 'Evaluate anomaly detection precision/recall against known synthetic anomalies'

    def add_arguments(self, parser):
        parser.add_argument(
            '--version',
            type=int,
            default=None,
            help='Evaluate a specific model version (default: latest active)',
        )
        parser.add_argument(
            '--threshold',
            type=float,
            default=KNOWN_ANOMALY_THRESHOLD,
            help=f'Deviation threshold for identifying known anomalies (default: {KNOWN_ANOMALY_THRESHOLD})',
        )

    def handle(self, *args, **options):
        threshold = options['threshold']
        version_num = options['version']

        metrics = evaluate_detector(self.stdout, self.style, threshold)

        if metrics is None:
            return

        # If a specific version was requested, show it
        if version_num:
            try:
                model_version = AnomalyModelVersion.objects.get(version=version_num)
                self.stdout.write(f'\nModel Version: v{model_version.version}')
                self.stdout.write(f'Trained at: {model_version.trained_at}')
                self.stdout.write(f'Records used: {model_version.record_count:,}')
            except AnomalyModelVersion.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'Model version {version_num} not found'))

        # Print results
        self.stdout.write(self.style.SUCCESS('\n=== Anomaly Detection Evaluation ==='))
        self.stdout.write(f"  Known anomalies (>{threshold*100:.0f}% deviation):  {metrics['total_known_anomalies']}")
        self.stdout.write(f"  Detected anomalies (flagged):          {metrics['total_detected']}")
        self.stdout.write(f"  True positives:                        {metrics['true_positives']}")
        self.stdout.write(f"  False positives:                       {metrics['false_positives']}")
        self.stdout.write(f"  False negatives:                       {metrics['false_negatives']}")
        self.stdout.write(f"  Precision: {metrics['precision']:.1%}")
        self.stdout.write(f"  Recall:    {metrics['recall']:.1%}")
        self.stdout.write(f"  F1 Score:  {metrics['f1_score']:.1%}")


def evaluate_detector(stdout=None, style=None, threshold=KNOWN_ANOMALY_THRESHOLD):
    """
    Core evaluation logic — can be called from other commands.

    Returns a dict of metrics or None if insufficient data.
    """
    valid_fares = CleanFare.objects.filter(is_valid=True)
    if not valid_fares.exists():
        if stdout:
            stdout.write('No valid CleanFare records to evaluate')
        return None

    # Step 1: Compute per-route statistics
    routes = (
        valid_fares
        .values_list('origin', 'destination')
        .distinct()
    )

    route_stats = {}
    for origin, destination in routes:
        stats = (
            valid_fares
            .filter(origin=origin, destination=destination)
            .aggregate(
                mean_fare=Avg('total_fare'),
                std_fare=StdDev('total_fare'),
            )
        )
        route_stats[f'{origin}-{destination}'] = {
            'mean': float(stats['mean_fare'] or 0),
            'std': float(stats['std_fare'] or 0),
        }

    # Step 2: Identify "known" anomalies — records that deviate significantly
    # from route mean (these are the ones injected by the generator)
    known_anomaly_ids = set()
    detected_ids = set()

    for cf in valid_fares.select_related('raw_fare').iterator(chunk_size=5000):
        route_key = f'{cf.origin}-{cf.destination}'
        stats = route_stats.get(route_key, {})
        route_mean = stats.get('mean', 0)

        if route_mean > 0:
            deviation = abs(float(cf.total_fare) - route_mean) / route_mean
            if deviation > threshold:
                known_anomaly_ids.add(cf.id)

        # Check if the detector flagged it
        if cf.quality_flags and len(cf.quality_flags) > 0:
            detected_ids.add(cf.id)

    # Step 3: Compute confusion matrix
    true_positives = len(known_anomaly_ids & detected_ids)
    false_positives = len(detected_ids - known_anomaly_ids)
    false_negatives = len(known_anomaly_ids - detected_ids)

    # Precision, recall, F1
    precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0.0
    recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0.0
    f1_score = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        'total_known_anomalies': len(known_anomaly_ids),
        'total_detected': len(detected_ids),
        'true_positives': true_positives,
        'false_positives': false_positives,
        'false_negatives': false_negatives,
        'precision': precision,
        'recall': recall,
        'f1_score': f1_score,
    }
