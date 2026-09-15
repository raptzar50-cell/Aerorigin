"""
DRF Views for stakeholder user profiles.

All authentication is handled by Firebase — these endpoints manage the
Django-side UserProfile (role, preferences, organization) linked to
Firebase UIDs.
"""

import logging
from datetime import datetime

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import UserProfile
from .serializers import UserProfileSerializer, ProfileUpdateSerializer

logger = logging.getLogger(__name__)


@api_view(['POST'])
def sync_profile(request):
    """
    POST /api/auth/sync-profile/

    Called by the frontend after successful Firebase authentication.
    Creates or updates the Django UserProfile for this Firebase user.

    Expects the Firebase ID token in the Authorization header (verified
    by FirebaseAuthMiddleware). The middleware sets request.firebase_uid
    and request.firebase_email.

    Optional body fields for first-time setup:
        - role: 'economist' | 'regulator' | 'researcher'
        - display_name: string
        - organization: string
    """
    uid = request.firebase_uid
    email = request.firebase_email

    if not uid:
        return Response(
            {'error': 'Firebase authentication required.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Try to find by UID first
    profile = UserProfile.objects.filter(firebase_uid=uid).first()
    created = False

    if not profile and email:
        # Fallback to finding by email if UID changed (dev mode / auth reset)
        profile = UserProfile.objects.filter(email=email).first()
        if profile:
            profile.firebase_uid = uid
            profile.save(update_fields=['firebase_uid'])

    if not profile:
        profile = UserProfile.objects.create(
            firebase_uid=uid,
            email=email or '',
            role=request.data.get('role', 'researcher'),
            display_name=request.data.get('display_name', ''),
            organization=request.data.get('organization', ''),
        )
        created = True

    if not created:
        # Update email if changed in Firebase
        if email and profile.email != email:
            profile.email = email

        # Update last login timestamp
        profile.last_login_at = timezone.now()
        profile.save(update_fields=['email', 'last_login_at'])
    else:
        profile.last_login_at = timezone.now()
        profile.save(update_fields=['last_login_at'])
        logger.info('New stakeholder profile created: %s (role: %s)', email, profile.role)

    serializer = UserProfileSerializer(profile)
    return Response({
        'message': 'Profile synced successfully.',
        'profile': serializer.data,
        'created': created,
    }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(['GET', 'PATCH'])
def profile(request):
    """
    GET  /api/auth/profile/ — Retrieve user profile + role.
    PATCH /api/auth/profile/ — Update role, display_name, organization,
                               dashboard_preferences.
    """
    user_profile = request.user_profile
    if not user_profile:
        return Response(
            {'error': 'Authentication required. Sign in with Firebase.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if request.method == 'GET':
        serializer = UserProfileSerializer(user_profile)
        return Response(serializer.data)

    # PATCH — update profile fields
    serializer = ProfileUpdateSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)

    data = serializer.validated_data
    updated_fields = []

    if 'role' in data:
        user_profile.role = data['role']
        updated_fields.append('role')
    if 'display_name' in data:
        user_profile.display_name = data['display_name']
        updated_fields.append('display_name')
    if 'organization' in data:
        user_profile.organization = data['organization']
        updated_fields.append('organization')
    if 'dashboard_preferences' in data:
        # Merge with existing preferences rather than replacing
        existing = user_profile.dashboard_preferences or {}
        existing.update(data['dashboard_preferences'])
        user_profile.dashboard_preferences = existing
        updated_fields.append('dashboard_preferences')

    if updated_fields:
        user_profile.save(update_fields=updated_fields)

    result_serializer = UserProfileSerializer(user_profile)
    return Response(result_serializer.data)


@api_view(['GET', 'PUT'])
def role_preferences(request):
    """
    GET /api/user/role-preferences/ -> returns current role + enabled panel list
    PUT /api/user/role-preferences/ -> updates role and, if custom, the specific panel selections
    """
    user_profile = request.user_profile
    if not user_profile:
        return Response(
            {'error': 'Authentication required. Sign in with Firebase.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if request.method == 'GET':
        enabled_panels = user_profile.dashboard_preferences.get('custom_panels', [])
        return Response({
            'role': user_profile.role,
            'custom_panels': enabled_panels
        })

    # PUT
    data = request.data
    role = data.get('role')
    custom_panels = data.get('custom_panels')
    
    updated_fields = []
    
    if role and role in dict(UserProfile.ROLE_CHOICES):
        user_profile.role = role
        updated_fields.append('role')
        
    if custom_panels is not None and isinstance(custom_panels, list):
        existing = user_profile.dashboard_preferences or {}
        existing['custom_panels'] = custom_panels
        user_profile.dashboard_preferences = existing
        updated_fields.append('dashboard_preferences')
        
    if updated_fields:
        user_profile.save(update_fields=updated_fields)

    return Response({
        'role': user_profile.role,
        'custom_panels': user_profile.dashboard_preferences.get('custom_panels', [])
    })


@api_view(['GET'])
def role_info(request):
    """
    GET /api/auth/roles/

    Public endpoint — returns information about available stakeholder roles
    and their default dashboard emphases. Useful for the role selection UI.
    """
    roles = [
        {
            'id': 'economist',
            'label': 'Economist/Statistician',
            'description': (
                'Focus on index construction methodology, base-period selection, '
                'CPI-alignment framing, and data export for external statistical work.'
            ),
            'primary_widgets': [
                'national_index_chart',
                'per_route_index',
                'base_period_controls',
                'export_tools',
            ],
            'icon': '📊',
        },
        {
            'id': 'regulator',
            'label': 'Regulator/Policy Analyst',
            'description': (
                'Focus on anomaly detection, dynamic-pricing pattern detection, '
                'flagged fare anomalies by route and carrier for spotting '
                'potentially unfair pricing behavior.'
            ),
            'primary_widgets': [
                'anomaly_detection_summary',
                'flagged_fares_table',
                'carrier_route_filtering',
                'pricing_pattern_indicators',
            ],
            'icon': '🔍',
        },
        {
            'id': 'researcher',
            'label': 'Researcher/Analyst',
            'description': (
                'Focus on raw and cleaned dataset access, model performance '
                'and evaluation metrics, forecast accuracy tracking, and '
                'API documentation for programmatic access.'
            ),
            'primary_widgets': [
                'dataset_overview',
                'model_performance',
                'forecast_accuracy',
                'api_documentation',
            ],
            'icon': '🔬',
        },
    ]
    return Response(roles)
