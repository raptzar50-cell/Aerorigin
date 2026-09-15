from rest_framework.permissions import BasePermission
from .models import ApiKey

class IsAuthenticatedOrHasAPIKey(BasePermission):
    """
    Allows access only to users authenticated via Firebase (dashboard session)
    OR via a valid API Key.
    """
    def has_permission(self, request, view):
        # Check Firebase session
        if hasattr(request, 'user_profile') and request.user_profile:
            return True
            
        # Check API Key (DRF sets request.auth when using ApiKeyAuthentication)
        if request.auth and isinstance(request.auth, ApiKey):
            return True
            
        return False


class IsRegulator(BasePermission):
    """
    Restricts access to the 'regulator' and 'economist' roles, whether accessed
    via the dashboard (Firebase) or programmatically (API Key).
    """
    def has_permission(self, request, view):
        # First ensure they are authenticated
        is_auth = IsAuthenticatedOrHasAPIKey().has_permission(request, view)
        if not is_auth:
            return False

        allowed_roles = {'regulator', 'economist'}

        # Check role via Firebase
        if hasattr(request, 'user_profile') and request.user_profile:
            return request.user_profile.role in allowed_roles
            
        # Check role via API Key
        if request.auth and isinstance(request.auth, ApiKey):
            return request.auth.role_scope in allowed_roles
            
        return False
