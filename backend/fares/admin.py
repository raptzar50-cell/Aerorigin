"""
Admin registration for fare models.
"""

from django.contrib import admin
from .models import RawFare, CleanFare, PriceIndex, AnomalyModelVersion, FarePrediction, GovernmentDataPoint


@admin.register(RawFare)
class RawFareAdmin(admin.ModelAdmin):
    list_display = ['source', 'origin', 'destination', 'departure_date', 'fare_raw', 'taxes_raw', 'scraped_at']
    list_filter = ['source', 'origin', 'destination']
    search_fields = ['origin', 'destination', 'source']
    date_hierarchy = 'scraped_at'


@admin.register(CleanFare)
class CleanFareAdmin(admin.ModelAdmin):
    list_display = ['origin', 'destination', 'departure_date', 'total_fare', 'lead_time_days', 'is_valid', 'quality_flags']
    list_filter = ['is_valid', 'origin', 'destination', 'source']
    search_fields = ['origin', 'destination']
    date_hierarchy = 'departure_date'


@admin.register(PriceIndex)
class PriceIndexAdmin(admin.ModelAdmin):
    list_display = ['index_date', 'route', 'index_value', 'avg_fare', 'sample_size', 'period_type']
    list_filter = ['period_type', 'route']
    date_hierarchy = 'index_date'


@admin.register(AnomalyModelVersion)
class AnomalyModelVersionAdmin(admin.ModelAdmin):
    list_display = ['version', 'trained_at', 'record_count', 'is_active', 'get_f1', 'get_precision', 'get_recall']
    list_filter = ['is_active']
    readonly_fields = ['version', 'trained_at', 'record_count', 'parameters', 'metrics']

    @admin.display(description='F1 Score')
    def get_f1(self, obj):
        f1 = obj.metrics.get('f1_score') if obj.metrics else None
        return f'{f1:.1%}' if f1 is not None else '-'

    @admin.display(description='Precision')
    def get_precision(self, obj):
        p = obj.metrics.get('precision') if obj.metrics else None
        return f'{p:.1%}' if p is not None else '-'

    @admin.display(description='Recall')
    def get_recall(self, obj):
        r = obj.metrics.get('recall') if obj.metrics else None
        return f'{r:.1%}' if r is not None else '-'


@admin.register(FarePrediction)
class FarePredictionAdmin(admin.ModelAdmin):
    list_display = ['route', 'forecast_date', 'predicted_value', 'lower_bound', 'upper_bound', 'model_name', 'generated_at']
    list_filter = ['route', 'model_name']
    date_hierarchy = 'forecast_date'
    readonly_fields = ['generated_at']


@admin.register(GovernmentDataPoint)
class GovernmentDataPointAdmin(admin.ModelAdmin):
    list_display = ['source', 'metric_name', 'metric_value', 'period_start', 'period_end', 'period_type', 'get_dimensions', 'fetched_at']
    list_filter = ['source', 'metric_name', 'period_type']
    search_fields = ['source', 'metric_name']
    date_hierarchy = 'period_start'
    readonly_fields = ['fetched_at']

    @admin.display(description='Dimensions')
    def get_dimensions(self, obj):
        if not obj.dimensions:
            return '-'
        return ', '.join(f'{k}={v}' for k, v in obj.dimensions.items())

