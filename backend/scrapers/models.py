from django.db import models

class ScrapeJob(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('success', 'Success'),
        ('empty', 'Empty'),
        ('failed', 'Failed'),
        ('blocked', 'Blocked'),
    )

    origin = models.CharField(max_length=10)
    destination = models.CharField(max_length=10)
    travel_date = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    
    result_count = models.IntegerField(default=0)
    error_message = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.origin} to {self.destination} on {self.travel_date} - {self.status}"

class ScrapedFare(models.Model):
    job = models.ForeignKey(ScrapeJob, on_delete=models.CASCADE, related_name='fares')
    airline = models.CharField(max_length=100)
    flight_code = models.CharField(max_length=20, null=True, blank=True)
    price = models.CharField(max_length=20)
    dep_time = models.CharField(max_length=20)
    dep_city = models.CharField(max_length=50, null=True, blank=True)
    arr_time = models.CharField(max_length=20)
    arr_city = models.CharField(max_length=50, null=True, blank=True)
    duration = models.CharField(max_length=20, null=True, blank=True)
    
    source = models.CharField(max_length=50, default='makemytrip_live')
    scraped_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.airline} - {self.price}"

