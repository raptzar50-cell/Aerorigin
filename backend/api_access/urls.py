from django.urls import path
from . import views

urlpatterns = [
    path('generate/', views.api_keys_list_generate, name='api-key-generate'),
    path('', views.api_keys_list_generate, name='api-key-list'),
    path('<int:pk>/revoke/', views.api_key_revoke, name='api-key-revoke'),
    path('<int:pk>/', views.api_key_delete, name='api-key-delete'),
]
