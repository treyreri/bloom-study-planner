from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include

from drf_spectacular.views import (
    SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView,)

urlpatterns = [
    path('admin/', admin.site.urls),

    # authentication (register, JWT token, refresh, logout)
    path('api/v1/auth/', include('accounts.urls')),

    # API endpoints
    path('api/v1/', include('api.urls')),

    # OpenAPI schema (YAML/JSON) and its two user interfaces
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # website pages (Django templates)
    path('', include('web.urls')),
]

if settings.DEBUG:
    # uploaded avatars during development
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
