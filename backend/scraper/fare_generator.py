"""
Shared fare generation logic.

This module contains the core pricing model used by BOTH the synthetic
seed script (batch generation) and the MockFareScraper (on-demand
generation). This avoids duplicating the lead-time decay curve, noise
model, and anomaly injection logic.

The pricing model simulates realistic domestic Indian airfare behavior:
  fare = base_fare × source_modifier × lead_time_factor × dow_factor × trend_factor × (1 + noise)
  + optional anomaly spike/drop
"""

import random
import math
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.utils import timezone


# --- Route configuration ---
# Base fares reflect approximate route distance/popularity in INR
ROUTES = [
    {'origin': 'DEL', 'destination': 'BOM', 'base_fare': 5500, 'name': 'Delhi-Mumbai'},
    {'origin': 'BLR', 'destination': 'DEL', 'base_fare': 6200, 'name': 'Bangalore-Delhi'},
    {'origin': 'MAA', 'destination': 'CCU', 'base_fare': 5800, 'name': 'Chennai-Kolkata'},
    {'origin': 'HYD', 'destination': 'BOM', 'base_fare': 4800, 'name': 'Hyderabad-Mumbai'},
    {'origin': 'DEL', 'destination': 'GOI', 'base_fare': 4200, 'name': 'Delhi-Goa'},
    {'origin': 'BOM', 'destination': 'BLR', 'base_fare': 3900, 'name': 'Mumbai-Bangalore'},
]

SOURCES = ['AirlineA', 'AirlineB', 'OTA_X']

# Lead-time pricing parameters
# fare = base_fare × (1 + ALPHA × e^(-BETA × lead_time_days)) + noise
ALPHA = 0.8       # Max surcharge factor for last-minute bookings (~80% higher)
BETA = 0.05       # Decay rate — controls how quickly the surcharge drops off
NOISE_STD = 0.10  # Standard deviation for day-to-day noise (±5-15%)

# Anomaly injection parameters
ANOMALY_RATE = 0.02    # ~2% of records get an anomaly
ANOMALY_MIN = 0.25     # Minimum anomaly magnitude (25%)
ANOMALY_MAX = 0.50     # Maximum anomaly magnitude (50%)

# Lead-time options for seed data generation
LEAD_TIME_OPTIONS = [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60]


def get_route_base_fare(origin: str, destination: str) -> float:
    """
    Look up the base fare for a route. Falls back to a default if route
    is not in the predefined list (future-proofing for new routes).
    """
    for route in ROUTES:
        if route['origin'] == origin and route['destination'] == destination:
            return route['base_fare']
    # Fallback for unknown routes
    return 5000.0


def generate_fare_observation(
    origin: str,
    destination: str,
    departure_date: date,
    source: str,
    scrape_datetime: datetime | None = None,
    base_fare: float | None = None,
    source_modifier: float | None = None,
    day_offset: int = 0,
    is_mock: bool = False,
) -> dict:
    """
    Generate a single realistic fare observation.

    This is the CORE generation function shared by both the seed script
    (batch mode) and the MockFareScraper (on-demand mode).

    Args:
        origin: IATA origin code
        destination: IATA destination code
        departure_date: Departure date for this fare
        source: Data source identifier (e.g., "AirlineA")
        scrape_datetime: When the "scrape" happened (defaults to now)
        base_fare: Override route base fare (if None, looks up from ROUTES)
        source_modifier: Price modifier for this source (if None, random ±10%)
        day_offset: Days since start of generation (for trend calculation)
        is_mock: If True, marks raw_payload with {"mock": true}

    Returns:
        Dict shaped for direct RawFare insertion.
    """
    if scrape_datetime is None:
        scrape_datetime = timezone.now()

    if base_fare is None:
        base_fare = get_route_base_fare(origin, destination)

    if source_modifier is None:
        source_modifier = 1.0 + random.uniform(-0.10, 0.10)

    # Compute lead time
    scrape_date = scrape_datetime.date() if isinstance(scrape_datetime, datetime) else date.today()
    lead_time = (departure_date - scrape_date).days
    lead_time = max(lead_time, 1)  # Floor at 1 day

    # --- Core pricing model ---
    # Lead-time decay: last-minute is expensive, advance booking is cheaper
    lead_time_factor = 1.0 + ALPHA * math.exp(-BETA * lead_time)

    # Day-of-week seasonality (weekends slightly higher)
    dow_factor = 1.08 if departure_date.weekday() in (4, 5, 6) else 1.0

    # Seasonal trend (slight upward drift over time to make index interesting)
    trend_factor = 1.0 + 0.001 * day_offset

    # Random daily noise
    noise = random.gauss(0, NOISE_STD)

    fare = base_fare * source_modifier * lead_time_factor * dow_factor * trend_factor * (1 + noise)

    # --- Anomaly injection ---
    is_anomaly = random.random() < ANOMALY_RATE
    if is_anomaly:
        anomaly_magnitude = random.uniform(ANOMALY_MIN, ANOMALY_MAX)
        if random.random() < 0.7:  # 70% spikes, 30% drops
            fare *= (1 + anomaly_magnitude)
        else:
            fare *= (1 - anomaly_magnitude)

    fare = max(fare, 500)  # Floor at ₹500

    # Taxes: ~12-18% of base fare (simulating GST + surcharges)
    tax_rate = random.uniform(0.12, 0.18)
    taxes = fare * tax_rate

    # Build raw_payload
    raw_payload = {
        'source': source,
        'route': f'{origin}-{destination}',
        'generator_version': '2.0',
    }
    if is_mock:
        raw_payload['mock'] = True
    else:
        raw_payload['synthetic'] = True

    return {
        'source': source,
        'origin': origin,
        'destination': destination,
        'departure_date': departure_date,
        'fare_raw': round(fare, 2),
        'taxes_raw': round(taxes, 2),
        'currency': 'INR',
        'scraped_at': scrape_datetime,
        'raw_payload': raw_payload,
    }
