"""
Production settings: DEBUG off, PostgreSQL, HTTPS-only cookies.

Every value below comes from environment variables (see .env.example).
"""
from decouple import Csv

from .base import *  # noqa: F401,F403
from .base import MIDDLEWARE, SECRET_KEY, config

if not SECRET_KEY:
    raise RuntimeError('SECRET_KEY must be set in the environment for production.')

DEBUG = False

ALLOWED_HOSTS = config('ALLOWED_HOSTS', cast=Csv())
CSRF_TRUSTED_ORIGINS = config('CSRF_TRUSTED_ORIGINS', default='', cast=Csv())

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
        'CONN_MAX_AGE': 60,
    }
}

# WhiteNoise serves the collected static files (CSS, JS, images) in production
MIDDLEWARE = MIDDLEWARE.copy()
MIDDLEWARE.insert(MIDDLEWARE.index('django.middleware.security.SecurityMiddleware') + 1,
                  'whitenoise.middleware.WhiteNoiseMiddleware')

STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

# HTTPS
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=0, cast=int)
SECURE_CONTENT_TYPE_NOSNIFF = True
