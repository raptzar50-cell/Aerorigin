"""
Django ORM models for stakeholder user profiles.

Architecture Decision — Firebase Auth + Django ORM:
    Authentication is handled entirely by Firebase Authentication
    (email/password + TOTP MFA). Django stores only the application-specific
    profile data (role, display name, dashboard preferences) linked to the
    Firebase UID. This replaces the earlier mongoengine/MongoDB approach.

    Why:
    1. Firebase handles auth security (password hashing, MFA, token management)
       using Google's audited, industry-standard implementation.
    2. Django manages application-specific data in the same SQLite/PostgreSQL
       database as fare/index data — no polyglot persistence complexity.
    3. The UserProfile is intentionally lightweight — it stores ROLE and
       PREFERENCES, not auth credentials.
"""

import uuid
from django.db import models


class UserProfile(models.Model):
    """
    Stakeholder user profile linked to a Firebase Authentication UID.

    Each authenticated user has exactly one UserProfile. The profile stores:
    - Their stakeholder role (determines default dashboard view)
    - Display name (for UI personalization)
    - Dashboard preferences (pinned routes, preferred period, theme)

    Roles control which widgets are EMPHASIZED (shown first), not which
    data is accessible — all authenticated users can access all data.
    """

    ROLE_CHOICES = [
        ('economist', 'Economist/Statistician'),
        ('regulator', 'Regulator/Policy Analyst'),
        ('researcher', 'Researcher/Analyst'),
        ('custom', 'Custom Dashboard'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    firebase_uid = models.CharField(
        max_length=128,
        unique=True,
        db_index=True,
        help_text='Firebase Authentication UID — the link between Firebase and Django',
    )
    email = models.EmailField(
        unique=True,
        help_text='User email (synced from Firebase on login)',
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='researcher',
        db_index=True,
        help_text='Stakeholder role — determines default dashboard widget ordering',
    )
    display_name = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='Display name for UI personalization',
    )
    organization = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='Organization name (e.g., "MoSPI", "DGCA", "IIT Delhi")',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_login_at = models.DateTimeField(null=True, blank=True)

    # Dashboard preferences — flexible JSON for UI state
    dashboard_preferences = models.JSONField(
        default=dict,
        blank=True,
        help_text='UI preferences: theme, preferred_period, pinned_routes, etc.',
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'

    def __str__(self):
        role_label = dict(self.ROLE_CHOICES).get(self.role, self.role)
        return f'{self.email} ({role_label})'

    def to_profile_dict(self):
        """Serialize user profile for API responses."""
        return {
            'id': str(self.id),
            'firebase_uid': self.firebase_uid,
            'email': self.email,
            'role': self.role,
            'role_label': dict(self.ROLE_CHOICES).get(self.role, self.role),
            'display_name': self.display_name,
            'organization': self.organization,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
            'dashboard_preferences': self.dashboard_preferences or {},
        }
