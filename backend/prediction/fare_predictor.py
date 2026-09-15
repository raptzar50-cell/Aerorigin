"""
Chronos-2-based fare forecasting for the Aerogin pipeline.

STAGE 2 of the three-stage pipeline:
    MOCK SCRAPER → ANOMALY DETECTOR (PyOD) → [PREDICTOR (Chronos-2)]

This module uses Amazon's Chronos-2 foundation model for zero-shot
time series forecasting. Key properties:
- ZERO-SHOT: No training required. The model produces probabilistic
  forecasts out of the box from any numeric time series.
- PROBABILISTIC: Returns quantile forecasts (not just point estimates),
  which is more credible and useful than a bare point prediction.
- CPU-compatible: Chronos-2 explicitly supports CPU inference, which
  matters since we likely won't have a GPU in a hackathon environment.

The Chronos2Pipeline instance is loaded ONCE (lazy singleton) and reused
across all prediction calls to avoid the ~10-30s model load overhead on
every call.
"""

import logging
from datetime import timedelta
from typing import Optional

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy singleton for the Chronos-2 pipeline.
# Loading the model takes ~10-30s and ~2GB RAM, so we do it exactly once.
# ---------------------------------------------------------------------------
_pipeline = None
_pipeline_loading = False

# Model to load from Hugging Face Hub
MODEL_NAME = 'amazon/chronos-2'

# Default forecast horizon
DEFAULT_HORIZON_DAYS = 14

# Quantile levels for probabilistic forecast (80% interval + median)
QUANTILE_LEVELS = [0.1, 0.5, 0.9]


def get_pipeline():
    """
    Get or create the Chronos-2 pipeline singleton.

    Returns the loaded pipeline, or None if loading fails (e.g., model
    not downloaded yet, insufficient memory, etc.).
    """
    global _pipeline, _pipeline_loading

    if _pipeline is not None:
        return _pipeline

    if _pipeline_loading:
        logger.warning('Chronos-2 pipeline is already loading (concurrent call)')
        return None

    _pipeline_loading = True
    try:
        logger.info('Loading Chronos-2 pipeline from %s (this takes ~30s)...', MODEL_NAME)

        from chronos import BaseChronosPipeline

        _pipeline = BaseChronosPipeline.from_pretrained(
            MODEL_NAME,
            device_map='cpu',  # Use "cuda" only if a GPU is actually available;
                               # Chronos-2 explicitly supports CPU inference,
                               # which matters since we likely won't have a GPU
                               # in this hackathon environment
        )

        logger.info('Chronos-2 pipeline loaded successfully')
        return _pipeline

    except Exception as e:
        logger.error('Failed to load Chronos-2 pipeline: %s', e)
        return None
    finally:
        _pipeline_loading = False


def predict_fare_trend(
    route: str,
    history_df: pd.DataFrame,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
) -> Optional[pd.DataFrame]:
    """
    Forecast future fare values for a single route using Chronos-2.

    Args:
        route: Route code (e.g., "DEL-BOM") — for labeling only
        history_df: The ANOMALY-SCREENED clean_fares time series for one
                    route. Must have columns:
                      - 'timestamp' (datetime): observation date
                      - 'total_fare' (float): fare value (target)
                    Sourced from Stage 1's trusted output only.
        horizon_days: Number of days to forecast ahead (default: 14)

    Returns:
        DataFrame with columns:
          - forecast_date (date)
          - predicted_value (float) — median forecast (0.5 quantile)
          - lower_bound (float) — 10th percentile
          - upper_bound (float) — 90th percentile
        Or None if prediction fails.
    """
    pipeline = get_pipeline()
    if pipeline is None:
        logger.error('Cannot predict: Chronos-2 pipeline not available')
        return None

    if len(history_df) < 3:
        logger.warning(
            'Route %s: insufficient history (%d records) for prediction',
            route, len(history_df),
        )
        return None

    # Build the input DataFrame in Chronos-2's expected long format:
    # columns: item_id, timestamp, target
    context_df = pd.DataFrame({
        'item_id': route,
        'timestamp': pd.to_datetime(history_df['timestamp']),
        'target': history_df['total_fare'].astype(float),
    })

    # Sort and regularize to daily frequency so Chronos can infer frequency properly
    context_df = context_df.sort_values('timestamp').reset_index(drop=True)
    try:
        resampled = context_df.set_index('timestamp').resample('D').mean()
        resampled['target'] = resampled['target'].interpolate(method='linear').ffill().bfill()
        resampled['item_id'] = route
        context_df = resampled.reset_index()
    except Exception as e:
        logger.debug('Frequency resampling note for %s: %s', route, e)

    logger.info(
        'Route %s: forecasting %d days from %d historical observations',
        route, horizon_days, len(context_df),
    )

    try:
        # Chronos-2's pandas API: predict_df
        pred_df = pipeline.predict_df(
            context_df,
            prediction_length=horizon_days,
            quantile_levels=QUANTILE_LEVELS,
        )

        last_date = context_df['timestamp'].max()

        result = pd.DataFrame({
            'forecast_date': pred_df['timestamp'].dt.date if 'timestamp' in pred_df.columns
                             else [(last_date + timedelta(days=i+1)).date()
                                   for i in range(len(pred_df))],
            'predicted_value': pred_df['0.5'].values if '0.5' in pred_df.columns
                               else pred_df['predictions'].values,
            'lower_bound': pred_df['0.1'].values if '0.1' in pred_df.columns
                           else pred_df['predictions'].values * 0.9,
            'upper_bound': pred_df['0.9'].values if '0.9' in pred_df.columns
                           else pred_df['predictions'].values * 1.1,
        })

        logger.info(
            'Route %s: forecast generated — median range [%.0f, %.0f]',
            route,
            result['predicted_value'].min(),
            result['predicted_value'].max(),
        )

        return result

    except Exception as e:
        logger.warning('Route %s: Chronos-2 model predict failed (%s), using statistical trend fallback', route, e)
        # Fallback: trend extrapolation with expanding prediction intervals
        last_date = context_df['timestamp'].max()
        last_val = float(context_df['target'].iloc[-1])
        mean_val = float(context_df['target'].mean())
        std_val = float(context_df['target'].std()) if len(context_df) > 1 else max(mean_val * 0.05, 50.0)

        forecast_dates = [(last_date + timedelta(days=i + 1)).date() for i in range(horizon_days)]
        predicted_values = [round(last_val * 0.7 + mean_val * 0.3, 2)] * horizon_days
        lower_bounds = [round(max(0, predicted_values[i] - 1.28 * std_val * np.sqrt(1 + i * 0.05)), 2) for i in range(horizon_days)]
        upper_bounds = [round(predicted_values[i] + 1.28 * std_val * np.sqrt(1 + i * 0.05), 2) for i in range(horizon_days)]

        return pd.DataFrame({
            'forecast_date': forecast_dates,
            'predicted_value': predicted_values,
            'lower_bound': lower_bounds,
            'upper_bound': upper_bounds,
        })


def predict_fare_trend_with_covariates(
    route: str,
    history_df: pd.DataFrame,
    future_lead_times: list[int],
    horizon_days: int = DEFAULT_HORIZON_DAYS,
) -> Optional[pd.DataFrame]:
    """
    Forecast with lead_time_days as a known future covariate.

    Chronos-2 supports covariate-informed forecasting — passing
    lead_time_days as a known future covariate should measurably
    improve forecast quality over the naive univariate baseline.

    Args:
        route: Route code
        history_df: Must have columns: timestamp, total_fare, lead_time_days
        future_lead_times: Known future lead_time_days values for the
                          forecast horizon
        horizon_days: Number of days to forecast

    Returns:
        Same shape as predict_fare_trend output, or None on failure.
    """
    pipeline = get_pipeline()
    if pipeline is None:
        return None

    if 'lead_time_days' not in history_df.columns:
        logger.info('No lead_time_days covariate — falling back to univariate')
        return predict_fare_trend(route, history_df, horizon_days)

    # Build context DataFrame with covariate
    context_df = pd.DataFrame({
        'item_id': route,
        'timestamp': pd.to_datetime(history_df['timestamp']),
        'target': history_df['total_fare'].astype(float),
        'lead_time_days': history_df['lead_time_days'].astype(float),
    })
    context_df = context_df.sort_values('timestamp').reset_index(drop=True)

    # Build future covariate DataFrame
    last_date = context_df['timestamp'].max()
    future_dates = [last_date + timedelta(days=i+1) for i in range(horizon_days)]

    # Pad future_lead_times if shorter than horizon
    if len(future_lead_times) < horizon_days:
        future_lead_times = future_lead_times + [future_lead_times[-1]] * (
            horizon_days - len(future_lead_times)
        )

    future_df = pd.DataFrame({
        'item_id': route,
        'timestamp': future_dates,
        'lead_time_days': [float(lt) for lt in future_lead_times[:horizon_days]],
    })

    try:
        pred_df = pipeline.predict_df(
            context_df,
            future_df=future_df,
            prediction_length=horizon_days,
            quantile_levels=QUANTILE_LEVELS,
        )

        result = pd.DataFrame({
            'forecast_date': pred_df['timestamp'].dt.date if 'timestamp' in pred_df.columns
                             else [d.date() for d in future_dates],
            'predicted_value': pred_df['0.5'].values if '0.5' in pred_df.columns
                               else pred_df['predictions'].values,
            'lower_bound': pred_df['0.1'].values if '0.1' in pred_df.columns
                           else pred_df['predictions'].values * 0.9,
            'upper_bound': pred_df['0.9'].values if '0.9' in pred_df.columns
                           else pred_df['predictions'].values * 1.1,
        })

        return result

    except Exception as e:
        logger.error('Route %s: covariate prediction failed: %s', route, e)
        # Fall back to univariate
        return predict_fare_trend(route, history_df, horizon_days)
