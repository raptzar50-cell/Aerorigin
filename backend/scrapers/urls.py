from django.urls import path
from .views import ScraperTriggerView, ScraperJobsView, ScraperJobDetailView, ScrapedFareDetailView

urlpatterns = [
    path('trigger/', ScraperTriggerView.as_view(), name='scraper-trigger'),
    path('jobs/', ScraperJobsView.as_view(), name='scraper-jobs'),
    path('jobs/<int:job_id>/', ScraperJobDetailView.as_view(), name='scraper-job-detail'),
    path('fares/<int:fare_id>/', ScrapedFareDetailView.as_view(), name='scraped-fare-detail'),
]
