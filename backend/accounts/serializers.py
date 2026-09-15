"""
DRF Serializers for the stakeholder user profile API.
"""

from rest_framework import serializers
from .models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    """Full user profile serialization for API responses."""
    role_label = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            'id', 'firebase_uid', 'email', 'role', 'role_label',
            'display_name', 'organization', 'created_at', 'last_login_at',
            'dashboard_preferences',
        ]
        read_only_fields = ['id', 'firebase_uid', 'created_at', 'last_login_at']

    def get_role_label(self, obj):
        return dict(UserProfile.ROLE_CHOICES).get(obj.role, obj.role)


class ProfileUpdateSerializer(serializers.Serializer):
    """Validate profile update input."""
    role = serializers.ChoiceField(
        choices=UserProfile.ROLE_CHOICES,
        required=False,
    )
    display_name = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
    )
    organization = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
    )
    dashboard_preferences = serializers.DictField(
        required=False,
    )
