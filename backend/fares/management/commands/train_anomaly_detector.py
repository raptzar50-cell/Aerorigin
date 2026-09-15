"""
Management command: train_anomaly_detector

Trains a separate PyOD ECOD model per route.
Performs grid search on contamination parameter to maximize F1/Precision on a proxy ground truth.
Stores the trained models in AnomalyModelVersion.
"""
import logging
import pickle

from django.core.management.base import BaseCommand
from django.db.models import Avg, StdDev, Count
from django.utils import timezone

from fares.models import CleanFare, AnomalyModelVersion
from detection.anomaly_detector import extract_features, DETECTOR_CLASS

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Train per-route PyOD anomaly detectors with grid search'

    def add_arguments(self, parser):
        parser.add_argument(
            '--min-records',
            type=int,
            default=30,
            help='Minimum records required to train a per-route model (default: 30)'
        )
        parser.add_argument(
            '--notes',
            type=str,
            default='',
            help='Optional notes for this training run'
        )

    def handle(self, *args, **options):
        min_records = options['min_records']
        notes = options['notes']

        self.stdout.write('=' * 60)
        self.stdout.write('  ANOMALY DETECTOR TRAINING (PER-ROUTE PyOD)')
        self.stdout.write('=' * 60)

        valid_fares = CleanFare.objects.filter(is_valid=True)
        if not valid_fares.exists():
            self.stderr.write(self.style.ERROR('No valid CleanFare records found.'))
            return
            
        routes = list(set(valid_fares.values_list('origin', 'destination').distinct()))
        next_version = AnomalyModelVersion.get_next_version()
        
        trained_routes = 0
        skipped_routes = 0
        
        contaminations = [0.02, 0.05, 0.08, 0.1]
        
        for origin, destination in routes:
            route_key = f"{origin}-{destination}"
            qs = valid_fares.filter(origin=origin, destination=destination).order_by('departure_date')
            count = qs.count()
            
            if count < min_records:
                skipped_routes += 1
                continue
                
            stats = qs.aggregate(mean_fare=Avg('total_fare'), std_fare=StdDev('total_fare'))
            route_mean = float(stats['mean_fare'] or 0)
            route_std = float(stats['std_fare'] or 0)
            
            records = list(qs)
            
            # Proxy ground truth: z-score > 3
            proxy_anomalies = set()
            if route_std > 0:
                for r in records:
                    if abs(float(r.total_fare) - route_mean) / route_std > 3.0:
                        proxy_anomalies.add(r.id)
                        
            X = extract_features(records, route_mean)
            
            best_f1 = -1.0
            best_model = None
            best_contam = None
            best_metrics = {}
            
            for contam in contaminations:
                try:
                    detector = DETECTOR_CLASS(contamination=contam)
                except TypeError:
                    detector = DETECTOR_CLASS()
                    detector.contamination = contam
                    
                detector.fit(X)
                labels = detector.predict(X)
                
                detected_ids = set()
                for i, is_anomaly in enumerate(labels):
                    if is_anomaly:
                        detected_ids.add(records[i].id)
                        
                tp = len(proxy_anomalies & detected_ids)
                fp = len(detected_ids - proxy_anomalies)
                fn = len(proxy_anomalies - detected_ids)
                
                prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
                rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
                f1 = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0.0
                
                # If there are no proxy anomalies, we just pick the first one or the one with lowest FP?
                # Let's prefer higher f1, or if f1 is 0 for all, prefer lower contamination to be conservative.
                if f1 > best_f1:
                    best_f1 = f1
                    best_model = detector
                    best_contam = contam
                    best_metrics = {
                        'precision': prec,
                        'recall': rec,
                        'f1_score': f1,
                        'true_positives': tp,
                        'false_positives': fp,
                        'false_negatives': fn,
                        'total_known_anomalies': len(proxy_anomalies),
                        'total_detected': len(detected_ids)
                    }

            # If no proxy anomalies, f1 will be 0.0 for all, and best_contam will be 0.02 (the first one).
            
            # Check previous active model for this route to ensure we don't regress
            prev_active = AnomalyModelVersion.objects.filter(is_active=True, route=route_key).first()
            is_better = True
            if prev_active and prev_active.metrics:
                prev_prec = prev_active.metrics.get('precision', 0)
                prev_rec = prev_active.metrics.get('recall', 0)
                new_prec = best_metrics.get('precision', 0)
                new_rec = best_metrics.get('recall', 0)
                
                if new_prec < prev_prec:
                    if new_prec > 0.0 or prev_prec == 0.0:
                        is_better = False
                        self.stdout.write(self.style.WARNING(f"  [{route_key}] New model prec {new_prec:.1%} < prev {prev_prec:.1%}. Marking inactive."))
                elif new_prec > prev_prec and new_rec < prev_rec and new_rec < 0.8:
                    is_better = False
                    self.stdout.write(self.style.WARNING(f"  [{route_key}] Precision improved but recall tanked to {new_rec:.1%}. Marking inactive."))

            if is_better and prev_active:
                prev_active.is_active = False
                prev_active.save(update_fields=['is_active'])

            # Serialize model
            model_blob = pickle.dumps(best_model)
            
            # Save new model version
            AnomalyModelVersion.objects.create(
                version=next_version,
                route=route_key,
                record_count=count,
                contamination=best_contam,
                model_blob=model_blob,
                parameters={'route_mean': route_mean, 'route_std': route_std},
                metrics=best_metrics,
                is_active=is_better,
                notes=notes or f"Auto-trained on {count} records",
            )
            
            trained_routes += 1
            status_str = "ACTIVE" if is_better else "INACTIVE"
            self.stdout.write(
                f"  {route_key}: n={count}, contam={best_contam}, "
                f"Prec={best_metrics.get('precision', 0):.1%}, Rec={best_metrics.get('recall', 0):.1%} [{status_str}]"
            )

        self.stdout.write('\n' + '=' * 60)
        self.stdout.write('  TRAINING COMPLETE')
        self.stdout.write('=' * 60)
        self.stdout.write(f'  Model Run Version: v{next_version}')
        self.stdout.write(f'  Routes Trained:    {trained_routes}')
        self.stdout.write(f'  Routes Skipped:    {skipped_routes} (< {min_records} records)')
        self.stdout.write('=' * 60)
