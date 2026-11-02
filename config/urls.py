from django.contrib import admin
from django.urls import path, include

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import (
    SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView,)

urlpatterns = [
    path('admin/', admin.site.urls),

    # authentication
    path('api/v1/auth/', include('accounts.urls')),

    # API endpoints
    path('api/v1/', include('api.urls')),

    # openAPI schema
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path("", include("web.urls")),
    # API documentation
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # explicit JWT endpoints are already included through accounts.urls.
]
