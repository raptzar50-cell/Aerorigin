"""
DRF Views for the flight information API.
"""

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .flight_api import get_live_flight_info, get_flights_for_route, get_live_india_airport_traffic


@api_view(['GET'])
def flight_info(request):
    """
    GET /api/flights/info/?flight_number=AI-101
    Look up real-time info for a specific flight.
    """
    flight_number = request.query_params.get('flight_number')
    if not flight_number:
        return Response(
            {'error': 'flight_number query parameter is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    info = get_live_flight_info(flight_number)
    if info is None:
        return Response(
            {'error': f'No flight found for {flight_number}'},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(info.to_dict())


@api_view(['GET'])
def flights_for_route(request):
    """
    GET /api/flights/route/?origin=DEL&destination=BOM&date=2026-09-15
    Get all flights for a given route on a given date.
    """
    origin = request.query_params.get('origin')
    destination = request.query_params.get('destination')
    date = request.query_params.get('date')

    if not origin or not destination:
        return Response(
            {'error': 'origin and destination query parameters are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    flights = get_flights_for_route(origin, destination, date)
    return Response([f.to_dict() for f in flights])


@api_view(['GET'])
def live_airports_traffic(request):
    """
    GET /api/flights/live/
    Get real-time flight tracking and airport traffic statistics across Indian hubs.
    Powered by AviationStack.
    """
    traffic = get_live_india_airport_traffic()
    return Response(traffic)
