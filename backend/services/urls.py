"""
URL routing for the flight information API.
"""

from django.urls import path
from . import views

urlpatterns = [
    path('info/', views.flight_info, name='flight-info'),
    path('route/', views.flights_for_route, name='flights-for-route'),
    path('live/', views.live_airports_traffic, name='flights-live'),
]
