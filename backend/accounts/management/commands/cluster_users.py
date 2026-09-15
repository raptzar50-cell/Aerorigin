"""
Management command: cluster_users

Implements lightweight "Users like you" clustering using k-means on a small
set of encoded preference features. This is a periodic batch job (not
real-time ML inference), appropriate for a 12-day prototype.

Run periodically (e.g., daily) to assign users to preference clusters:
    python manage.py cluster_users
    python manage.py cluster_users --clusters 5
"""

import logging
import numpy as np
from collections import Counter

from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

# Mapping of origin IATA codes to region indices for feature encoding
REGION_MAP = {
    # North India
    'DEL': 0, 'JAI': 0, 'LKO': 0, 'AMD': 0,
    # West India
    'BOM': 1, 'GOI': 1, 'PNQ': 1,
    # South India
    'BLR': 2, 'MAA': 2, 'HYD': 2, 'COK': 2, 'TRV': 2,
    # East India
    'CCU': 3, 'GAU': 3, 'IXB': 3, 'BBI': 3,
}

CABIN_MAP = {
    'economy': 0,
    'premium_economy': 1,
    'business': 2,
    'first': 3,
}


class Command(BaseCommand):
    help = 'Cluster users by preference features using k-means'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clusters',
            type=int,
            default=4,
            help='Number of clusters (default: 4)',
        )

    def handle(self, *args, **options):
        from accounts.models import UserDocument

        k = options['clusters']

        users = list(UserDocument.objects.all())
        if len(users) < k:
            self.stdout.write(self.style.WARNING(
                f'Only {len(users)} users found, need at least {k} for {k} clusters. '
                f'Skipping clustering.'
            ))
            return

        self.stdout.write(f'Clustering {len(users)} users into {k} clusters...')

        # Encode features
        features = []
        for user in users:
            prefs = user.preferences
            feature_vec = self._encode_user(prefs)
            features.append(feature_vec)

        X = np.array(features, dtype=float)

        # Normalize features to [0, 1] range
        mins = X.min(axis=0)
        maxs = X.max(axis=0)
        ranges = maxs - mins
        ranges[ranges == 0] = 1  # Avoid division by zero
        X_norm = (X - mins) / ranges

        # Run k-means
        from sklearn.cluster import KMeans
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X_norm)

        # Write cluster IDs back to MongoDB
        for user, label in zip(users, labels):
            if user.preferences is None:
                from accounts.models import UserPreferences
                user.preferences = UserPreferences()
            user.preferences.cluster_id = int(label)
            user.save()

        # Print cluster summary
        cluster_counts = Counter(labels)
        self.stdout.write(self.style.SUCCESS(f'\n✅ Clustering complete!'))
        self.stdout.write(f'   Algorithm: k-means (scikit-learn)')
        self.stdout.write(f'   Features: region, cabin class, saved routes count, search frequency')
        self.stdout.write(f'   Clusters: {k}\n')

        for cluster_id in sorted(cluster_counts.keys()):
            count = cluster_counts[cluster_id]
            cluster_users = [u for u, l in zip(users, labels) if l == cluster_id]

            # Summarize cluster characteristics
            regions = Counter()
            cabins = Counter()
            for u in cluster_users:
                p = u.preferences
                if p:
                    cabins[p.preferred_cabin or 'economy'] += 1
                    for entry in (p.search_history or [])[:10]:
                        region = REGION_MAP.get(entry.origin, -1)
                        if region >= 0:
                            region_names = {0: 'North', 1: 'West', 2: 'South', 3: 'East'}
                            regions[region_names[region]] += 1

            top_region = regions.most_common(1)[0][0] if regions else 'Unknown'
            top_cabin = cabins.most_common(1)[0][0] if cabins else 'economy'

            self.stdout.write(
                f'   Cluster {cluster_id}: {count} users | '
                f'Top region: {top_region} | '
                f'Top cabin: {top_cabin}'
            )

    def _encode_user(self, prefs) -> list[float]:
        """Encode user preferences into a numeric feature vector."""
        if prefs is None:
            return [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]

        # Feature 1-4: Region affinity (one-hot, based on search history origins)
        region_counts = [0.0, 0.0, 0.0, 0.0]  # N, W, S, E
        for entry in (prefs.search_history or []):
            region = REGION_MAP.get(entry.origin, -1)
            if 0 <= region <= 3:
                region_counts[region] += 1.0
        total_searches = sum(region_counts) or 1.0
        region_features = [c / total_searches for c in region_counts]

        # Feature 5: Cabin class (ordinal)
        cabin_feature = float(CABIN_MAP.get(prefs.preferred_cabin or 'economy', 0))

        # Feature 6: Number of saved routes
        saved_count = float(len(prefs.saved_routes or []))

        # Feature 7: Search frequency (total searches in history)
        search_freq = float(len(prefs.search_history or []))

        return region_features + [cabin_feature, saved_count, search_freq]
