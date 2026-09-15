"""
Firebase Authentication Middleware for Django.

Extracts the Firebase ID token from the Authorization header, verifies it
via the Firebase Admin SDK, and attaches the corresponding Django UserProfile
to the request as `request.user_profile`.

This replaces the earlier JWT + MongoDB middleware. Firebase handles all
authentication concerns; Django only looks up the application-specific
profile data by Firebase UID.
"""

import logging

logger = logging.getLogger(__name__)


class FirebaseAuthMiddleware:
    """
    Django middleware that extracts and verifies Firebase ID tokens.

    Sets:
        request.user_profile — UserProfile instance if authenticated, else None
        request.firebase_uid — Firebase UID string if authenticated, else None
        request.firebase_email — Email from Firebase token if present, else None
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.user_profile = None
        request.firebase_uid = None
        request.firebase_email = None

        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            try:
                from .firebase_auth import verify_firebase_token

                decoded = verify_firebase_token(token)
                if decoded:
                    uid = decoded.get('uid')
                    email = decoded.get('email', '')
                    request.firebase_uid = uid
                    request.firebase_email = email

                    if uid:
                        from .models import UserProfile
                        try:
                            request.user_profile = UserProfile.objects.get(
                                firebase_uid=uid
                            )
                        except UserProfile.DoesNotExist:
                            # User authenticated via Firebase but hasn't synced
                            # profile yet — this is normal on first login.
                            # The sync-profile endpoint will create it.
                            logger.debug(
                                'Firebase UID %s authenticated but no '
                                'UserProfile exists yet',
                                uid,
                            )
            except Exception as e:
                logger.debug('Firebase auth middleware error: %s', e)

        response = self.get_response(request)
        return response
