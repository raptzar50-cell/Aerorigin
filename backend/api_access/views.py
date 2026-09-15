import secrets
from django.contrib.auth.hashers import make_password
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import ApiKey

MAX_KEYS_PER_USER = 3

def get_profile_from_request(request):
    """Helper to ensure user is authenticated via dashboard session (Firebase)"""
    if hasattr(request, 'user_profile') and request.user_profile:
        return request.user_profile
    return None

@api_view(['GET', 'POST'])
def api_keys_list_generate(request):
    profile = get_profile_from_request(request)
    if not profile:
        return Response({'detail': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)

    if request.method == 'GET':
        keys = ApiKey.objects.filter(owner=profile).order_by('-created_at')
        data = [{
            'id': k.id,
            'key_prefix': k.key_prefix,
            'created_at': k.created_at,
            'expires_at': k.expires_at,
            'is_active': k.is_active,
            'last_used_at': k.last_used_at,
            'rate_limit_per_hour': k.rate_limit_per_hour,
        } for k in keys]
        return Response(data)

    elif request.method == 'POST':
        # Check limit
        active_keys_count = ApiKey.objects.filter(owner=profile, is_active=True).count()
        if active_keys_count >= MAX_KEYS_PER_USER:
            return Response(
                {'error': f'You have reached the maximum limit of {MAX_KEYS_PER_USER} active keys.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate new key
        raw_key = secrets.token_urlsafe(32)
        key_prefix = raw_key[:8]
        key_hash = make_password(raw_key)

        api_key = ApiKey.objects.create(
            owner=profile,
            key_hash=key_hash,
            key_prefix=key_prefix,
            role_scope=profile.role,
        )

        return Response({
            'raw_key': raw_key,
            'id': api_key.id,
            'key_prefix': key_prefix,
            'role_scope': api_key.role_scope,
            'message': 'Warning: This raw key will never be shown again. Please copy it immediately.'
        }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def api_key_revoke(request, pk):
    profile = get_profile_from_request(request)
    if not profile:
        return Response(status=status.HTTP_401_UNAUTHORIZED)
        
    try:
        api_key = ApiKey.objects.get(pk=pk, owner=profile)
        api_key.is_active = False
        api_key.save(update_fields=['is_active'])
        return Response({'status': 'revoked'})
    except ApiKey.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)


@api_view(['DELETE'])
def api_key_delete(request, pk):
    profile = get_profile_from_request(request)
    if not profile:
        return Response(status=status.HTTP_401_UNAUTHORIZED)
        
    try:
        api_key = ApiKey.objects.get(pk=pk, owner=profile)
        api_key.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except ApiKey.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
