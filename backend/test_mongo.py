import os
import django
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from decouple import config

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aerogin.settings')
django.setup()

from django.conf import settings

uri = settings.MONGO_URI
print(f"Testing connection to: {uri.split('@')[-1] if '@' in uri else uri}")

import certifi

client = MongoClient(uri, server_api=ServerApi('1'), tlsCAFile=certifi.where())

try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(f"Connection failed: {e}")
