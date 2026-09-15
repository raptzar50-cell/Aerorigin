import logging
from decimal import Decimal
from django.db.models import Avg, Min, Max
from django.utils import timezone
from datetime import timedelta
from fares.models import HistoricalBookingCurve, CleanFare

logger = logging.getLogger(__name__)

def get_bucket(days):
    if days <= 1: return (1, 1)
    if 2 <= days <= 3: return (2, 3)
    if 4 <= days <= 7: return (4, 7)
    if 8 <= days <= 14: return (8, 14)
    if 15 <= days <= 30: return (15, 30)
    if 31 <= days <= 60: return (31, 60)
    return (61, 999)

def predict_price(route, airline, flight_class, days_until_departure):
    """
    Predicts the price by blending historical data and live data.
    """
    bucket_min, bucket_max = get_bucket(days_until_departure)
    
    # 1. Historical Baseline
    qs_hist = HistoricalBookingCurve.objects.filter(
        route=route,
        flight_class=flight_class,
        days_left__gte=bucket_min,
        days_left__lte=bucket_max
    )
    
    # Try exact airline, if not fallback to all airlines for this route/class
    hist_airline_qs = qs_hist.filter(airline=airline)
    if hist_airline_qs.exists():
        qs_hist = hist_airline_qs
        airline_match = "exact"
    else:
        airline_match = "any"

    hist_agg = qs_hist.aggregate(avg_price=Avg('price'))
    hist_avg = hist_agg['avg_price']
    
    if hist_avg is None:
        # Fallback to similar distance? For now, insufficient data
        return {
            'route': route,
            'airline': airline,
            'days_out': days_until_departure,
            'predicted_price': None,
            'confidence': 'low',
            'based_on': 'insufficient_data'
        }
    
    hist_avg = float(hist_avg)
    
    # 2. Live Current Price
    try:
        origin, dest = route.split('-')
    except ValueError:
        origin, dest = route[:3], route[-3:]
        
    recent_cutoff = timezone.now() - timedelta(days=7)
    
    live_qs = CleanFare.objects.filter(
        origin=origin,
        destination=dest,
        is_valid=True,
        created_at__gte=recent_cutoff,
        lead_time_days__gte=bucket_min,
        lead_time_days__lte=bucket_max
    )
    
    # Since CleanFare doesn't store airline easily (it might be in source/raw_payload but not explicitly as a column),
    # we just take the route average for the live bucket.
    live_agg = live_qs.aggregate(avg_fare=Avg('total_fare'))
    live_avg = live_agg['avg_fare']
    
    predicted_price = hist_avg
    based_on = 'historical_only'
    confidence = 'medium' if airline_match == 'exact' else 'low'
    
    if live_avg is not None:
        live_avg = float(live_avg)
        # Compute scaling ratio
        # Avoid extreme scaling: clamp ratio between 0.5 and 2.0
        ratio = live_avg / hist_avg
        ratio = max(0.5, min(2.0, ratio))
        
        predicted_price = hist_avg * ratio
        based_on = 'blended'
        confidence = 'high' if airline_match == 'exact' else 'medium'
    
    return {
        'route': route,
        'airline': airline,
        'days_out': days_until_departure,
        'predicted_price': round(predicted_price, 2),
        'confidence': confidence,
        'based_on': based_on
    }
