"""
Firebase Admin SDK integration for Django backend token verification.

This module initializes the Firebase Admin SDK and provides a function
to verify Firebase ID tokens on incoming API requests. The Firebase app
is initialized lazily (once) on first use.

Architecture:
    Frontend (Firebase Client SDK) handles:
        - User registration (email/password)
        - Login (email/password + optional TOTP MFA)
        - Token refresh

    Backend (this module) handles:
        - Verifying the Firebase ID token on every authenticated request
        - Extracting the user's Firebase UID from the verified token
        - Looking up/creating the Django UserProfile by UID
"""

import logging
from pathlib import Path
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)

_firebase_app = None
_firebase_init_attempted = False


def _get_firebase_app():
    """
    Get or initialize the Firebase Admin SDK app (lazy singleton).

    Reads the service account key file path from settings.FIREBASE_SERVICE_ACCOUNT_KEY_PATH.
    If the path is not set or the file doesn't exist, Firebase verification
    will be unavailable (graceful degradation for development).
    """
    global _firebase_app, _firebase_init_attempted

    if _firebase_app is not None:
        return _firebase_app

    if _firebase_init_attempted:
        return None

    _firebase_init_attempted = True

    try:
        import firebase_admin
        from firebase_admin import credentials

        key_path = getattr(settings, 'FIREBASE_SERVICE_ACCOUNT_KEY_PATH', '')

        if key_path and Path(key_path).exists():
            cred = credentials.Certificate(str(key_path))
            _firebase_app = firebase_admin.initialize_app(cred)
            logger.info('Firebase Admin SDK initialized from service account key')
        else:
            # Try default credentials (useful in GCP environments)
            # or initialize without credentials for development
            project_id = getattr(settings, 'FIREBASE_PROJECT_ID', '')
            if project_id:
                _firebase_app = firebase_admin.initialize_app(
                    options={'projectId': project_id}
                )
                logger.info(
                    'Firebase Admin SDK initialized with project ID: %s '
                    '(no service account key — token verification may fail '
                    'unless running in a GCP environment)',
                    project_id,
                )
            else:
                logger.warning(
                    'Firebase Admin SDK not initialized: '
                    'FIREBASE_SERVICE_ACCOUNT_KEY_PATH not set or file not found, '
                    'and FIREBASE_PROJECT_ID not set. '
                    'Set these in .env to enable Firebase auth verification.'
                )
                return None

        return _firebase_app

    except Exception as e:
        logger.error('Failed to initialize Firebase Admin SDK: %s', e)
        return None


def verify_firebase_token(id_token: str) -> Optional[dict]:
    """
    Verify a Firebase ID token and return the decoded claims.

    Args:
        id_token: The Firebase ID token string from the client.

    Returns:
        dict: Decoded token claims (contains 'uid', 'email', etc.)
              or None if verification fails.
    """
    app = _get_firebase_app()

    if app is None:
        # Firebase not configured — check if we're in development mode
        if getattr(settings, 'DEBUG', False) and getattr(settings, 'FIREBASE_DEV_BYPASS', False):
            logger.warning(
                'Firebase not configured and FIREBASE_DEV_BYPASS=True — '
                'accepting unverified tokens for development only'
            )
            # In dev bypass mode, try to decode without verification
            # This is ONLY for development when Firebase is not set up yet
            return _dev_bypass_decode(id_token)
        logger.debug('Firebase not configured — cannot verify token')
        return None

    try:
        from firebase_admin import auth

        decoded = auth.verify_id_token(id_token, app=app)
        return decoded

    except Exception as e:
        logger.debug('Firebase token verification failed: %s', e)
        return None


def _dev_bypass_decode(id_token: str) -> Optional[dict]:
    """
    DEVELOPMENT ONLY: Accept a simple JSON token for testing without Firebase.

    In dev bypass mode, the frontend can send a mock token containing
    a JSON object with 'uid' and 'email' fields. This is NEVER used
    in production (FIREBASE_DEV_BYPASS must be explicitly set to True).
    """
    import json
    import base64

    try:
        parts = id_token.split('.')
        if len(parts) == 3:
            # It's a JWT from frontend Firebase Auth. Parse payload without verifying signature.
            payload = parts[1]
            padded = payload + '=' * (4 - len(payload) % 4)
            decoded = json.loads(base64.urlsafe_b64decode(padded))
            uid = decoded.get('user_id') or decoded.get('sub')
            email = decoded.get('email', '')
            if uid:
                logger.warning('DEV BYPASS: Accepting unverified real JWT for uid=%s', uid)
                return {'uid': uid, 'email': email, **decoded}

        # Try to decode as a simple base64-encoded JSON (mock token)
        padded = id_token + '=' * (4 - len(id_token) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(padded))
        if 'uid' in decoded and 'email' in decoded:
            logger.warning(
                'DEV BYPASS: Accepting unverified mock token for uid=%s',
                decoded['uid'],
            )
            return decoded
    except Exception:
        pass

    return None
