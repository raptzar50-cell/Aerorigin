"""
DRF Serializers for the Airfare Price Index API.
"""

from rest_framework import serializers
from .models import (
    RawFare, CleanFare, PriceIndex, AnomalyModelVersion,
    FarePrediction, IndexForecast, ForecastAccuracyLog,
)


class RouteSerializer(serializers.Serializer):
    """Summary info about a tracked route."""
    route = serializers.CharField()
    origin = serializers.CharField()
    destination = serializers.CharField()
    latest_index = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    avg_fare = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    sample_size = serializers.IntegerField()
    total_observations = serializers.IntegerField()


class PriceIndexSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceIndex
        fields = ['index_date', 'route', 'index_value', 'avg_fare', 'sample_size', 'period_type']


class LeadTimeBucketSerializer(serializers.Serializer):
    """Average fare by lead-time bucket."""
    bucket = serializers.CharField()
    bucket_label = serializers.CharField()
    avg_fare = serializers.DecimalField(max_digits=10, decimal_places=2)
    sample_size = serializers.IntegerField()
    min_fare = serializers.DecimalField(max_digits=10, decimal_places=2)
    max_fare = serializers.DecimalField(max_digits=10, decimal_places=2)


class QualityFlaggedRecordSerializer(serializers.Serializer):
    """A flagged anomalous record for the quality report."""
    id = serializers.UUIDField()
    route = serializers.CharField()
    origin = serializers.CharField()
    destination = serializers.CharField()
    departure_date = serializers.DateField()
    total_fare = serializers.DecimalField(max_digits=10, decimal_places=2)
    quality_flags = serializers.ListField(child=serializers.CharField())
    flag_type = serializers.CharField()
    magnitude = serializers.FloatField(allow_null=True)
    source = serializers.CharField()
    provenance = serializers.CharField(required=False, default='unknown')


class QualityReportSummarySerializer(serializers.Serializer):
    """Summary statistics for the quality report."""
    total_records = serializers.IntegerField()
    total_flagged = serializers.IntegerField()
    flagged_percentage = serializers.FloatField()
    price_outlier_count = serializers.IntegerField()
    statistical_outlier_count = serializers.IntegerField()
    last_scrape_at = serializers.DateTimeField(allow_null=True)
    data_freshness_hours = serializers.FloatField(allow_null=True)


class StatsSerializer(serializers.Serializer):
    """Headline dashboard statistics with data provenance."""
    current_index = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    index_change_7d = serializers.FloatField(allow_null=True)
    index_change_30d = serializers.FloatField(allow_null=True)
    total_routes = serializers.IntegerField()
    total_observations = serializers.IntegerField()
    last_updated = serializers.DateTimeField(allow_null=True)
    data_provenance = serializers.DictField(required=False)


class AnomalyModelVersionSerializer(serializers.ModelSerializer):
    """Anomaly detector model version with metrics."""
    class Meta:
        model = AnomalyModelVersion
        fields = ['version', 'trained_at', 'record_count', 'parameters', 'metrics', 'is_active', 'notes']


class FarePredictionSerializer(serializers.ModelSerializer):
    """Chronos-2 fare prediction with probabilistic bounds."""
    class Meta:
        model = FarePrediction
        fields = [
            'route', 'forecast_date', 'predicted_value',
            'lower_bound', 'upper_bound', 'generated_at', 'model_name',
        ]


class IndexForecastSerializer(serializers.ModelSerializer):
    """Chronos-2 price INDEX forecast with confidence intervals and CPI impact."""
    class Meta:
        model = IndexForecast
        fields = [
            'route', 'forecast_date', 'predicted_index',
            'lower_bound', 'upper_bound', 'pct_change_from_latest',
            'cpi_impact_note', 'generated_at', 'model_name',
        ]


class ForecastAccuracyLogSerializer(serializers.ModelSerializer):
    """Forecast accuracy tracking — predicted vs actual."""
    class Meta:
        model = ForecastAccuracyLog
        fields = [
            'route', 'forecast_date', 'predicted_index', 'actual_index',
            'error', 'error_pct', 'within_interval',
            'lower_bound', 'upper_bound',
            'generated_at', 'evaluated_at', 'model_name',
        ]
