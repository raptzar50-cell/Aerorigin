from django.db import models
from accounts.models import UserProfile

class ApiKey(models.Model):
    """
    API Key for programmatic access to Aerogin data endpoints.
    """
    owner = models.ForeignKey(
        UserProfile, 
        on_delete=models.CASCADE, 
        related_name='api_keys',
        help_text='The user who generated and owns this key.'
    )
    key_hash = models.CharField(
        max_length=128, 
        unique=True,
        help_text='Hashed version of the raw API key.'
    )
    key_prefix = models.CharField(
        max_length=8, 
        db_index=True,
        help_text='First 8 characters of the raw key, used for display/identification.'
    )
    role_scope = models.CharField(
        max_length=20,
        choices=UserProfile.ROLE_CHOICES,
        help_text="The role this key is scoped to (matches the owner's role)."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        null=True, blank=True,
        help_text='When the key expires. If null, it never expires.'
    )
    is_active = models.BooleanField(
        default=True,
        help_text='Whether this key is active. Uncheck to revoke.'
    )
    last_used_at = models.DateTimeField(null=True, blank=True)
    rate_limit_per_hour = models.PositiveIntegerField(
        default=100,
        help_text='Maximum allowed requests per hour for this key.'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.key_prefix}... ({self.owner.email})"


class ApiKeyUsageLog(models.Model):
    """
    Audit log of API key usage.
    """
    api_key = models.ForeignKey(
        ApiKey, 
        on_delete=models.CASCADE, 
        related_name='usage_logs'
    )
    endpoint_called = models.CharField(max_length=255)
    called_at = models.DateTimeField(auto_now_add=True, db_index=True)
    response_status = models.PositiveIntegerField()

    class Meta:
        ordering = ['-called_at']

    def __str__(self):
        return f"{self.api_key.key_prefix} - {self.endpoint_called} ({self.response_status})"
