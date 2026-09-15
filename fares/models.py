import uuid
from django.db import models

class RawFare(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source = models.CharField(max_length=255)
    origin = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    departure_date = models.DateField()
    fare_raw = models.DecimalField(max_digits=10, decimal_places=2)
    taxes_raw = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default="INR")
    scraped_at = models.DateTimeField(auto_now_add=True)
    raw_payload = models.JSONField()

class CleanFare(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    raw_fare = models.ForeignKey(RawFare, on_delete=models.CASCADE)
    source = models.CharField(max_length=255)
    origin = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    departure_date = models.DateField()
    lead_time_days = models.IntegerField()
    total_fare = models.DecimalField(max_digits=10, decimal_places=2)
    is_valid = models.BooleanField(default=True)
    quality_flags = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

class PriceIndex(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    index_date = models.DateField()
    route = models.CharField(max_length=255, null=True, blank=True)
    index_value = models.DecimalField(max_digits=10, decimal_places=2)
    avg_fare = models.DecimalField(max_digits=10, decimal_places=2)
    sample_size = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
