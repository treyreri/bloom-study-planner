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

# Static files are served by nginx-backend (docker-compose.yml). WhiteNoise stays
# as a fallback for hosts without nginx (e.g. a single Render web service).
MIDDLEWARE = MIDDLEWARE.copy()
MIDDLEWARE.insert(MIDDLEWARE.index('django.middleware.security.SecurityMiddleware') + 1,
                  'whitenoise.middleware.WhiteNoiseMiddleware')

STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

# Behind nginx: trust its X-Forwarded-Proto / X-Forwarded-Host headers
# (so avatar URLs and redirects use the public address).
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

# HTTPS. Keep the defaults (True) on a real server with HTTPS; the local
# docker-compose stack on http://localhost sets them to False.
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
SESSION_COOKIE_SECURE = config('SECURE_COOKIES', default=True, cast=bool)
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=0, cast=int)
SECURE_CONTENT_TYPE_NOSNIFF = True

# Email over SMTP (the app sends no emails itself; Django needs a real backend in production)
MAILERS = {
    'default': {
        'BACKEND': 'django.core.mail.backends.smtp.EmailBackend',
        'OPTIONS': {
            'host': config('EMAIL_HOST', default='localhost'),
            'port': config('EMAIL_PORT', default=25, cast=int),
            'username': config('EMAIL_HOST_USER', default=''),
            'password': config('EMAIL_HOST_PASSWORD', default=''),
            'use_tls': config('EMAIL_USE_TLS', default=False, cast=bool),
        },
    },
}
