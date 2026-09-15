"""
URL configuration for aerogin project.
"""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('fares.urls')),
    path('api/auth/', include('accounts.urls')),
    path('api/user/role-preferences/', include([
        path('', __import__('accounts').views.role_preferences, name='user-role-preferences')
    ])),
    path('api/user/api-keys/', include('api_access.urls')),
    path('api/flights/', include('services.urls')),
    path('api/scraper/', include('scrapers.urls')),
    
    # OpenAPI Docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]
