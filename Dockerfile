# Django + DRF backend, served by gunicorn behind nginx-backend.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod

WORKDIR /app

COPY requirements.txt requirements-prod.txt ./
RUN pip install --no-cache-dir -r requirements-prod.txt

COPY . .

# run as an ordinary user; the static/media folders become shared volumes
RUN useradd --create-home bloom \
    && mkdir -p /app/staticfiles /app/media \
    && chown -R bloom:bloom /app
USER bloom

EXPOSE 8000

# on every start: apply migrations, collect admin/Swagger static files, run gunicorn
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn config.wsgi --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-2} --access-logfile -"]
