"""
PyOD-based anomaly detection for the Aerogin fare pipeline.

STAGE 1 of the three-stage pipeline:
    MOCK SCRAPER → [ANOMALY DETECTOR (PyOD)] → PREDICTOR (Chronos-2)

This module replaces/augments the existing rule-based anomaly detection
(rolling-baseline, sigma thresholds) with a proper ML-based detector
from the PyOD library.

Design decisions:
- DETECTOR_CLASS is a module-level setting — swap detector in one line.
- Per-route fitting: each route gets its own detector instance because
  fare distributions vary significantly across routes.
- Refit-per-batch: since data volume is small (~hundreds of records per
  route), refitting on each batch is cheap (~5ms) and avoids stale
  detector state.  A serialized-detector approach (pickle the fitted model,
  load on next batch) would be better at scale but adds complexity we
  don't need for this prototype.
- Observations flagged as anomalous are STORED and shown in the Data
  Quality UI, but excluded from what feeds the predictor (Stage 2).
"""

import logging
import pickle
from typing import NamedTuple

import numpy as np
from pyod.models.ecod import ECOD

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# ONE-LINE DETECTOR SWAP: Change this to any PyOD model class.
# ---------------------------------------------------------------------------
DETECTOR_CLASS = ECOD

# PyOD contamination parameter
CONTAMINATION = 0.05

# Quality flag strings used in CleanFare.quality_flags
FLAG_PYOD_ANOMALY = 'pyod_anomaly'
FLAG_PYOD_CLEAN = 'pyod_clean'


def extract_features(records, route_mean: float) -> np.ndarray:
    """
    Extract multi-dimensional features for PyOD models:
    - relative_price: price relative to route average
    - lead_time_days: days between booking and departure
    - is_weekend: 1 if departure is on weekend, 0 otherwise
    """
    X = []
    for r in records:
        rel_price = float(r.total_fare) / route_mean if route_mean > 0 else 1.0
        lead_time = float(r.lead_time_days)
        is_weekend = 1.0 if r.departure_date.weekday() >= 5 else 0.0
        X.append([rel_price, lead_time, is_weekend])
    return np.array(X, dtype=np.float64)


class PreTrainedPyODDetector:
    """
    Wrapper for a serialized, pre-trained PyOD model for a specific route.
    """
    def __init__(self, model_blob: bytes, route_mean: float):
        self.model = pickle.loads(model_blob)
        self.route_mean = route_mean

    def score(self, records) -> list[bool]:
        """
        Scores a list of CleanFare records.
        Returns: list of booleans (True if anomaly, False if inlier)
        """
        if not records:
            return []
        
        X = extract_features(records, self.route_mean)
        labels = self.model.predict(X)
        return [bool(l) for l in labels]

