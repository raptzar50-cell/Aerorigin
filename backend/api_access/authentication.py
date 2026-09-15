import time
from django.core.cache import cache
from django.contrib.auth.hashers import check_password
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed, Throttled
from .models import ApiKey, ApiKeyUsageLog

class ApiKeyAuthentication(BaseAuthentication):
    """
    Custom authentication class that verifies API keys passed in the
    'Authorization: Bearer <key>' or 'X-API-Key' header.
    """

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        api_key_header = request.headers.get('X-API-Key', '')

        raw_key = None
        if auth_header.startswith('Bearer '):
            raw_key = auth_header[7:]
        elif api_key_header:
            raw_key = api_key_header

        if not raw_key:
            return None  # Fallback to other authentication methods if no key provided

        # Extract prefix to optimize DB lookup
        prefix = raw_key[:8]
        
        try:
            # We filter by prefix to limit the number of check_password calls
            api_keys = ApiKey.objects.filter(key_prefix=prefix, is_active=True)
            
            valid_key = None
            for key_obj in api_keys:
                if check_password(raw_key, key_obj.key_hash):
                    valid_key = key_obj
                    break
                    
            if not valid_key:
                return None  # Fallback: maybe it's a Firebase token or other auth method

            # Check expiration
            if valid_key.expires_at and valid_key.expires_at < timezone.now():
                raise AuthenticationFailed('API key has expired.')

            # Check rate limiting
            cache_key = f'ratelimit:apikey:{valid_key.id}'
            requests_this_hour = cache.get(cache_key, 0)
            
            if requests_this_hour >= valid_key.rate_limit_per_hour:
                raise Throttled(detail=f'Rate limit exceeded ({valid_key.rate_limit_per_hour}/hour).')
            
            # Increment rate limit cache (1 hour timeout)
            if requests_this_hour == 0:
                cache.set(cache_key, 1, timeout=3600)
            else:
                cache.incr(cache_key)

            # Update last used timestamp (using update() to avoid triggering signals/save loops)
            ApiKey.objects.filter(id=valid_key.id).update(last_used_at=timezone.now())

            # Return a tuple of (user, auth)
            # DRF sets request.user and request.auth.
            # We set request.user to the UserProfile and request.auth to the ApiKey instance.
            # This allows views to inspect request.auth to see if it was an API key.
            return (valid_key.owner, valid_key)

        except Exception:
            return None

    def authenticate_header(self, request):
        return 'Bearer'

class ApiKeyLoggingMiddleware:
    """
    Middleware to log API key usage to the database.
    Since DRF views handle the response, we can log the status code here.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # request.auth is populated by DRF's authentication classes
        if hasattr(request, 'auth') and isinstance(request.auth, ApiKey):
            # Fire and forget logging
            ApiKeyUsageLog.objects.create(
                api_key=request.auth,
                endpoint_called=request.path,
                response_status=response.status_code
            )
            
        return response
