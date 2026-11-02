"""Development settings: DEBUG on, SQLite, a fallback secret key."""
from .base import *  # noqa: F401,F403
from .base import SECRET_KEY, config

DEBUG = config('DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']

# Only for local development. Production refuses to start without SECRET_KEY.
SECRET_KEY = SECRET_KEY or 'django-insecure-dev-only-key-change-me'
