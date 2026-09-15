"""
URL routing for the accounts API.
"""

from django.urls import path
from . import views

urlpatterns = [
    path('sync-profile/', views.sync_profile, name='auth-sync-profile'),
    path('profile/', views.profile, name='auth-profile'),
    path('roles/', views.role_info, name='auth-roles'),
]
