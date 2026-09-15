"""
URL routing for the fares API.
"""

from django.urls import path
from . import views

urlpatterns = [
    # Core endpoints (existing)
    path('routes/', views.routes_list, name='routes-list'),
    path('index/', views.index_timeseries, name='index-timeseries'),
    path('trends/lead-time/', views.lead_time_trends, name='lead-time-trends'),
    path('quality-report/', views.quality_report, name='quality-report'),
    path('stats/', views.dashboard_stats, name='dashboard-stats'),
    path('model-versions/', views.model_versions, name='model-versions'),
    path('predictions/', views.predictions, name='predictions'),
    path('predictions/table/', views.prediction_table, name='prediction-table'),

    # Index forecast endpoints (Chronos-2 reframed for MoSPI stakeholders)
    path('index-forecast/', views.index_forecast, name='index-forecast'),
    path('forecast-accuracy/', views.forecast_accuracy, name='forecast-accuracy'),

    # Export endpoints (CSV/JSON for statistician stakeholders)
    path('export/index/', views.export_index, name='export-index'),
    path('export/fares/', views.export_fares, name='export-fares'),

    # Data provenance transparency
    path('data-provenance/', views.data_provenance, name='data-provenance'),

    # Live Search & Airports Autocomplete
    path('airports/', views.airports_list, name='airports-list'),
    path('live-search/', views.live_fare_search, name='live-fare-search'),
]
