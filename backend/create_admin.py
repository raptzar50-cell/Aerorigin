import os
import sys
import django
from mongoengine import connect

# Setup django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aerogin.settings")
django.setup()

from accounts.models import UserDocument, UserPreferences
from accounts.utils.security import hash_password
from django.conf import settings

def main():
    try:
        email = "admin@aerogin.com"
        
        # Check if exists
        user = UserDocument.objects(email=email).first()
        if user:
            print(f"User {email} already exists.")
        else:
            password_hash, password_salt = hash_password("admin123")
            user = UserDocument(
                email=email,
                password_hash=password_hash,
                password_salt=password_salt,
                preferences=UserPreferences(),
            )
            user.save()
            print(f"User {email} created successfully.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
