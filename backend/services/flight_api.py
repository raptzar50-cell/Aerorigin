"""
Real-time flight information service layer.

Fetches flight status data (NOT pricing — pricing stays handled by the
existing RawFare/CleanFare/PriceIndex pipeline). Provides:
  - get_live_flight_info(flight_number) — single flight lookup
  - get_flights_for_route(origin, destination, date) — route-based lookup

Uses a normalized FlightInfo dataclass so swapping providers (AviationStack,
FlightAware AeroAPI, OpenSky Network) doesn't ripple through the rest of
the app — only this file changes.

Mock mode (USE_MOCK_FLIGHT_API=True, default) returns realistic synthetic
data for development/demos.
"""

import logging
import random
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)


@dataclass
class FlightInfo:
    """
    Normalized flight information — provider-agnostic.
    This is the internal data structure consumed by views and templates.
    Swapping the external provider only changes how this is populated,
    not how it's consumed downstream.
    """
    flight_number: str
    airline: str
    origin: str
    destination: str
    scheduled_departure: str  # ISO 8601
    actual_departure: Optional[str]
    scheduled_arrival: str  # ISO 8601
    actual_arrival: Optional[str]
    status: str  # 'scheduled', 'en_route', 'landed', 'cancelled', 'delayed'
    delay_minutes: int
    gate: Optional[str]
    terminal: Optional[str]
    aircraft_type: Optional[str]

    def to_dict(self) -> dict:
        return asdict(self)


# --- Mock data configuration ---
# Uses the same routes as the existing synthetic data for consistency
MOCK_AIRLINES = {
    'AI': 'Air India',
    '6E': 'IndiGo',
    'SG': 'SpiceJet',
    'UK': 'Vistara',
    'G8': 'Go First',
    'QP': 'Akasa Air',
}

MOCK_ROUTES = [
    # Domestic India
    ('DEL', 'BOM'), ('BLR', 'DEL'), ('MAA', 'CCU'),
    ('HYD', 'BOM'), ('DEL', 'GOI'), ('BOM', 'BLR'),
    ('DEL', 'MAA'), ('CCU', 'BLR'), ('AMD', 'DEL'),
    # International — Middle East
    ('DEL', 'DXB'), ('BOM', 'DXB'), ('COK', 'DOH'),
    ('HYD', 'AUH'), ('DEL', 'RUH'), ('BOM', 'MCT'),
    # International — Southeast & East Asia
    ('DEL', 'SIN'), ('BOM', 'BKK'), ('BLR', 'KUL'),
    ('DEL', 'HKG'), ('BOM', 'ICN'),
    # International — Europe & Americas
    ('DEL', 'LHR'), ('BOM', 'JFK'), ('BLR', 'FRA'),
    ('DEL', 'CDG'), ('HYD', 'SFO'),
    # International — Oceania & Africa
    ('DEL', 'SYD'), ('BOM', 'NBO'),
]

MOCK_AIRCRAFT = ['A320neo', 'B737-800', 'A321neo', 'ATR 72-600', 'B777-300ER', 'A350-900', 'B787-9', 'A380-800']
MOCK_TERMINALS = ['T1', 'T2', 'T3']
MOCK_GATES = [f'{t}{n}' for t in ['A', 'B', 'C', 'D'] for n in range(1, 20)]

# International airline codes for mock data
MOCK_AIRLINES_INTL = {
    'AI': 'Air India',
    '6E': 'IndiGo',
    'SG': 'SpiceJet',
    'UK': 'Vistara',
    'QP': 'Akasa Air',
    'EK': 'Emirates',
    'QR': 'Qatar Airways',
    'EY': 'Etihad Airways',
    'SQ': 'Singapore Airlines',
    'TG': 'Thai Airways',
    'BA': 'British Airways',
    'LH': 'Lufthansa',
    'AF': 'Air France',
    'ET': 'Ethiopian Airlines',
    'QF': 'Qantas',
}

# IATA codes that indicate international destinations
_INTL_CODES = {
    'DXB', 'AUH', 'SHJ', 'DOH', 'RUH', 'JED', 'DMM', 'MCT', 'BAH', 'KWI',
    'SIN', 'BKK', 'KUL', 'CGK', 'DPS', 'SGN', 'HAN', 'MNL',
    'HKG', 'ICN', 'NRT', 'HND', 'KIX', 'PEK', 'PVG', 'TPE',
    'LHR', 'LGW', 'CDG', 'FRA', 'AMS', 'ZRH', 'FCO', 'IST', 'BCN', 'MAD',
    'JFK', 'EWR', 'LAX', 'SFO', 'ORD', 'IAD', 'YYZ', 'YVR',
    'SYD', 'MEL', 'AKL', 'PER',
    'JNB', 'NBO', 'ADD', 'CAI',
    'DAC', 'KTM', 'CMB', 'MLE', 'ISB', 'KHI', 'LHE',
    'TAS', 'ALA', 'TLV', 'RGN', 'PNH', 'GRU', 'DSS',
    'MUC', 'VIE', 'CPH', 'HEL',
}


def _generate_mock_flight(
    flight_number: Optional[str] = None,
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    date: Optional[str] = None,
) -> FlightInfo:
    """Generate a single realistic mock flight record."""
    # Determine if this is an international route
    is_international = (
        (origin and origin in _INTL_CODES) or
        (destination and destination in _INTL_CODES)
    )

    # Pick airline pool based on route type
    airline_pool = MOCK_AIRLINES_INTL if is_international else MOCK_AIRLINES
    airline_code = random.choice(list(airline_pool.keys()))
    if flight_number:
        for code in airline_pool:
            if flight_number.upper().startswith(code):
                airline_code = code
                break
    else:
        flight_number = f'{airline_code}-{random.randint(100, 999)}'

    # Generate route if not provided
    if not origin or not destination:
        route = random.choice(MOCK_ROUTES)
        origin = origin or route[0]
        destination = destination or route[1]

    # Generate departure/arrival times
    if date:
        try:
            base_date = datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            base_date = datetime.now()
    else:
        base_date = datetime.now()

    dep_hour = random.randint(5, 22)
    dep_minute = random.choice([0, 15, 30, 45])
    scheduled_dep = base_date.replace(
        hour=dep_hour, minute=dep_minute, second=0, microsecond=0
    )

    # Flight duration: varies by route type
    if is_international:
        duration_minutes = random.randint(180, 720)  # 3 to 12 hours for international
    else:
        duration_minutes = random.randint(90, 210)  # 1.5 to 3.5 hours for domestic
    scheduled_arr = scheduled_dep + timedelta(minutes=duration_minutes)

    # Generate status and delay
    status_weights = {
        'scheduled': 0.30,
        'en_route': 0.30,
        'landed': 0.25,
        'delayed': 0.12,
        'cancelled': 0.03,
    }
    flight_status = random.choices(
        list(status_weights.keys()),
        weights=list(status_weights.values()),
    )[0]

    delay_minutes = 0
    actual_dep = None
    actual_arr = None

    if flight_status == 'delayed':
        delay_minutes = random.choice([15, 20, 30, 45, 60, 90, 120])
        actual_dep = (scheduled_dep + timedelta(minutes=delay_minutes)).isoformat()
        actual_arr = (scheduled_arr + timedelta(minutes=delay_minutes)).isoformat()
    elif flight_status in ('en_route', 'landed'):
        # Small random delay for in-flight/landed
        delay_minutes = random.choice([0, 0, 0, 5, 10, 15])
        actual_dep = (scheduled_dep + timedelta(minutes=delay_minutes)).isoformat()
        if flight_status == 'landed':
            actual_arr = (scheduled_arr + timedelta(minutes=delay_minutes)).isoformat()

    return FlightInfo(
        flight_number=flight_number.upper(),
        airline=airline_pool.get(airline_code, 'Unknown Airline'),
        origin=origin,
        destination=destination,
        scheduled_departure=scheduled_dep.isoformat(),
        actual_departure=actual_dep,
        scheduled_arrival=scheduled_arr.isoformat(),
        actual_arrival=actual_arr,
        status=flight_status,
        delay_minutes=delay_minutes,
        gate=random.choice(MOCK_GATES) if flight_status != 'cancelled' else None,
        terminal=random.choice(MOCK_TERMINALS),
        aircraft_type=random.choice(MOCK_AIRCRAFT),
    )


def get_live_flight_info(flight_number: str) -> Optional[FlightInfo]:
    """
    Look up real-time info for a specific flight number.

    Args:
        flight_number: e.g., "AI-101", "6E-302"

    Returns:
        FlightInfo or None if not found.
    """
    use_mock = getattr(settings, 'USE_MOCK_FLIGHT_API', True)

    if use_mock:
        logger.debug('Using mock flight API for %s', flight_number)
        return _generate_mock_flight(flight_number=flight_number)

    import requests

    api_key = getattr(settings, 'FLIGHT_API_KEY', '')
    if not api_key:
        logger.error('FLIGHT_API_KEY not found in settings.')
        return None

    try:
        response = requests.get(
            'http://api.aviationstack.com/v1/flights',
            params={'access_key': api_key, 'flight_iata': flight_number},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()

        if data.get('data'):
            # AviationStack can return multiple entries for a flight (e.g. codeshares or past flights).
            # We take the first one that is currently active or scheduled, or just the first one.
            flight = data['data'][0]
            
            return FlightInfo(
                flight_number=flight['flight']['iata'] or flight_number,
                airline=flight.get('airline', {}).get('name', 'Unknown Airline'),
                origin=flight.get('departure', {}).get('iata', ''),
                destination=flight.get('arrival', {}).get('iata', ''),
                scheduled_departure=flight.get('departure', {}).get('scheduled', ''),
                actual_departure=flight.get('departure', {}).get('actual', None),
                scheduled_arrival=flight.get('arrival', {}).get('scheduled', ''),
                actual_arrival=flight.get('arrival', {}).get('actual', None),
                status=flight.get('flight_status', 'scheduled'),
                delay_minutes=flight.get('departure', {}).get('delay', 0) or 0,
                gate=flight.get('departure', {}).get('gate', None),
                terminal=flight.get('departure', {}).get('terminal', None),
                aircraft_type=flight.get('aircraft', {}).get('registration', None) if flight.get('aircraft') else None,
            )
    except Exception as e:
        logger.error(f'Error fetching flight info from AviationStack: {e}')
        
    return None


def get_flights_for_route(
    origin: str,
    destination: str,
    date: Optional[str] = None,
) -> list[FlightInfo]:
    """
    Get all flights for a given route on a given date.

    Args:
        origin: IATA airport code (e.g., "DEL")
        destination: IATA airport code (e.g., "BOM")
        date: Date string in YYYY-MM-DD format (defaults to today)

    Returns:
        list[FlightInfo]
    """
    use_mock = getattr(settings, 'USE_MOCK_FLIGHT_API', True)

    if use_mock:
        logger.debug('Using mock flight API for %s-%s on %s', origin, destination, date)
        # Generate 3-6 flights for the route
        num_flights = random.randint(3, 6)
        flights = []
        for _ in range(num_flights):
            flight = _generate_mock_flight(
                origin=origin,
                destination=destination,
                date=date,
            )
            flights.append(flight)
        # Sort by scheduled departure
        flights.sort(key=lambda f: f.scheduled_departure)
        return flights

    import requests

    api_key = getattr(settings, 'FLIGHT_API_KEY', '')
    if not api_key:
        logger.error('FLIGHT_API_KEY not found in settings.')
        return []

    try:
        response = requests.get(
            'http://api.aviationstack.com/v1/flights',
            params={
                'access_key': api_key,
                'dep_iata': origin,
                'arr_iata': destination,
            },
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()

        flights = []
        for flight in data.get('data', []):
            f_info = FlightInfo(
                flight_number=flight['flight']['iata'] or 'UNKNOWN',
                airline=flight.get('airline', {}).get('name', 'Unknown Airline'),
                origin=flight.get('departure', {}).get('iata', ''),
                destination=flight.get('arrival', {}).get('iata', ''),
                scheduled_departure=flight.get('departure', {}).get('scheduled', ''),
                actual_departure=flight.get('departure', {}).get('actual', None),
                scheduled_arrival=flight.get('arrival', {}).get('scheduled', ''),
                actual_arrival=flight.get('arrival', {}).get('actual', None),
                status=flight.get('flight_status', 'scheduled'),
                delay_minutes=flight.get('departure', {}).get('delay', 0) or 0,
                gate=flight.get('departure', {}).get('gate', None),
                terminal=flight.get('departure', {}).get('terminal', None),
                aircraft_type=flight.get('aircraft', {}).get('registration', None) if flight.get('aircraft') else None,
            )
            flights.append(f_info)
            
        return flights
    except Exception as e:
        logger.error(f'Error fetching flights for route from AviationStack: {e}')

    return []


# In-memory cache for live airport traffic
_traffic_cache = {
    'data': None,
    'timestamp': None,
}


def get_live_india_airport_traffic() -> dict:
    """
    Fetch active flight counts and recent flights across major Indian airports.
    Uses AviationStack API with 90-second in-memory caching.
    """
    now = datetime.now()
    if (
        _traffic_cache['data'] is not None
        and _traffic_cache['timestamp'] is not None
        and (now - _traffic_cache['timestamp']).total_seconds() < 90
    ):
        return _traffic_cache['data']

    import requests

    api_key = getattr(settings, 'FLIGHT_API_KEY', '')
    major_airports = [
        {'code': 'DEL', 'city': 'New Delhi', 'lat': 28.5665, 'lon': 77.1031},
        {'code': 'BOM', 'city': 'Mumbai', 'lat': 19.0896, 'lon': 72.8656},
        {'code': 'BLR', 'city': 'Bengaluru', 'lat': 13.1986, 'lon': 77.7066},
        {'code': 'HYD', 'city': 'Hyderabad', 'lat': 17.2403, 'lon': 78.4294},
        {'code': 'MAA', 'city': 'Chennai', 'lat': 12.9941, 'lon': 80.1709},
        {'code': 'CCU', 'city': 'Kolkata', 'lat': 22.6547, 'lon': 88.4467},
        {'code': 'GOI', 'city': 'Goa', 'lat': 15.3808, 'lon': 73.8314},
        {'code': 'AMD', 'city': 'Ahmedabad', 'lat': 23.0772, 'lon': 72.6347},
        {'code': 'PNQ', 'city': 'Pune', 'lat': 18.5822, 'lon': 73.9197},
        {'code': 'JAI', 'city': 'Jaipur', 'lat': 26.8242, 'lon': 75.8122},
        {'code': 'COK', 'city': 'Kochi', 'lat': 10.1520, 'lon': 76.4019},
        {'code': 'LKO', 'city': 'Lucknow', 'lat': 26.7606, 'lon': 80.8893},
    ]

    airport_results = []
    total_active_flights = 0

    if api_key:
        try:
            # Query top hubs to get live flights across all tracked route endpoints
            hubs_to_query = ['DEL', 'BOM', 'BLR', 'HYD', 'MAA', 'CCU']
            hub_flights = {}
            for hub in hubs_to_query:
                try:
                    resp = requests.get(
                        'http://api.aviationstack.com/v1/flights',
                        params={'access_key': api_key, 'dep_iata': hub, 'limit': 15},
                        timeout=5,
                    )
                    if resp.status_code == 200:
                        data = resp.json().get('data', [])
                        hub_flights[hub] = data
                except Exception as e:
                    logger.debug('AviationStack hub %s error: %s', hub, e)

            for ap in major_airports:
                flights_for_ap = hub_flights.get(ap['code'], [])
                count = len(flights_for_ap)
                if count > 0:
                    total_active_flights += count
                airport_results.append({
                    'code': ap['code'],
                    'city': ap['city'],
                    'lat': ap['lat'],
                    'lon': ap['lon'],
                    'flightCount': count,
                    'recentFlights': [
                        {
                            'flight_number': f.get('flight', {}).get('iata') or f.get('flight', {}).get('number'),
                            'airline': f.get('airline', {}).get('name'),
                            'destination': f.get('arrival', {}).get('iata'),
                            'status': f.get('flight_status', 'scheduled'),
                            'departure_time': f.get('departure', {}).get('scheduled'),
                        }
                        for f in flights_for_ap[:5]
                    ],
                })
        except Exception as exc:
            logger.error('Error in get_live_india_airport_traffic: %s', exc)

    # Sort airports by flight count descending
    airport_results.sort(key=lambda a: a['flightCount'], reverse=True)

    result = {
        'totalFlights': total_active_flights,
        'activeAirports': airport_results,
        'source': 'aviationstack_live',
        'lastUpdated': datetime.utcnow().isoformat() + 'Z',
    }
    _traffic_cache['data'] = result
    _traffic_cache['timestamp'] = now
    return result
