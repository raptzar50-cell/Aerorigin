"""
Django settings for aerogin project.
SIH26056 — Real-Time Airfare Price Index using Web Scraping & Analytics
"""

import os
from pathlib import Path
from decouple import config, Csv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='django-insecure-dev-key-change-me')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1,testserver', cast=Csv())

# Propagate credentials from .env to os.environ for external provider clients
for _var in (
    'SERPAPI_KEY', 'SERPAPI_KEY_2', 'SERPAPI_KEY_3',
    'AMADEUS_CLIENT_ID', 'AMADEUS_CLIENT_SECRET', 'AMADEUS_BASE_URL',
    'KIWI_TEQUILA_API_KEY', 'KIWI_TEQUILA_BASE_URL',
    'FLIGHT_API_KEY', 'FLIGHT_API_PROVIDER',
):
    _val = config(_var, default='')
    if _val and _var not in os.environ:
        os.environ[_var] = _val

# Flight Info API settings
USE_MOCK_FLIGHT_API = config('USE_MOCK_FLIGHT_API', default=False, cast=bool)
FLIGHT_API_KEY = config('FLIGHT_API_KEY', default='')
FLIGHT_API_PROVIDER = config('FLIGHT_API_PROVIDER', default='aviationstack')

# --------------------------------------------------------------------------
# LIVE_MODE — Scraper Integration Extension Point
# --------------------------------------------------------------------------
LIVE_MODE = config('LIVE_MODE', default=False, cast=bool)

# --------------------------------------------------------------------------
# Real Scraper Configuration
# --------------------------------------------------------------------------
REAL_SCRAPER = config('REAL_SCRAPER', default=False, cast=bool)

# MakeMyTrip scraper delays (seconds) — respectful anti-bot pacing
MMT_SCRAPE_DELAY_MIN = config('MMT_SCRAPE_DELAY_MIN', default=5, cast=int)
MMT_SCRAPE_DELAY_MAX = config('MMT_SCRAPE_DELAY_MAX', default=10, cast=int)
MMT_USE_FIXTURE_FALLBACK = config('MMT_USE_FIXTURE_FALLBACK', default=True, cast=bool)

# --------------------------------------------------------------------------
# Scraper & Anomaly Detection Configuration
# --------------------------------------------------------------------------
SCRAPE_CYCLE_RETRAIN_INTERVAL = config('RETRAIN_EVERY_N_CYCLES', default=5, cast=int)
ANOMALY_MODEL_DIR = BASE_DIR / 'anomaly_models'

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'corsheaders',
    # Local apps
    'fares',
    'accounts',
    'scrapers',
    'api_access',
    'drf_spectacular',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # Custom — Firebase auth for stakeholder users
    'accounts.middleware.FirebaseAuthMiddleware',
    # Custom - API Key Usage Logging
    'api_access.authentication.ApiKeyLoggingMiddleware',
]

ROOT_URLCONF = 'aerogin.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'aerogin.wsgi.application'

# Database — SQLite for prototype, switch to PostgreSQL for production
DATABASES = {
    'default': {
        'ENGINE': config('DATABASE_ENGINE', default='django.db.backends.sqlite3'),
        'NAME': BASE_DIR / config('DATABASE_NAME', default='db.sqlite3'),
    }
}

# --------------------------------------------------------------------------
# Firebase Authentication
# --------------------------------------------------------------------------
# Path to the Firebase service account JSON key file (for backend token
# verification via firebase-admin SDK).
FIREBASE_SERVICE_ACCOUNT_KEY_PATH = config(
    'FIREBASE_SERVICE_ACCOUNT_KEY_PATH', default=''
)
FIREBASE_PROJECT_ID = config('FIREBASE_PROJECT_ID', default='')

# Development bypass — set to True ONLY in development when Firebase is
# not configured yet. Allows mock tokens for testing.
FIREBASE_DEV_BYPASS = config('FIREBASE_DEV_BYPASS', default=True, cast=bool)

# --------------------------------------------------------------------------
# Flight Info API — Real-time flight status
# --------------------------------------------------------------------------
USE_MOCK_FLIGHT_API = config('USE_MOCK_FLIGHT_API', default=True, cast=bool)
FLIGHT_API_KEY = config('FLIGHT_API_KEY', default='')
FLIGHT_API_PROVIDER = config('FLIGHT_API_PROVIDER', default='')

# --------------------------------------------------------------------------
# CPI Illustrative Calculation
# --------------------------------------------------------------------------
# Approximate weight of air transport in India's CPI basket (Transport
# and Communication sub-index). Used for illustrative "what would this
# mean for CPI" calculations — clearly labeled as illustrative.
CPI_AIR_TRANSPORT_WEIGHT = config(
    'CPI_AIR_TRANSPORT_WEIGHT', default=0.0218, cast=float
)

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'Aerogin Data API',
    'DESCRIPTION': 'Programmatic access to Aerogin airfare indexes, predictions, and anomalies.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SECURITY': [{'ApiKeyAuth': []}],
}

# CORS
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
    cast=Csv()
)

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'accounts': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO',
        },
        'services': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO',
        },
        'scraper': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO',
        },
        'fares': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO',
        },
    },
}
