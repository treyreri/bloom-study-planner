from django.urls import path

from .views import ( RegisterView, LoginView, RefreshView, ProfileView, LogoutView, )

# Mounted at /api/v1/auth/
urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    # the specification calls the JWT endpoint /auth/token/;
    # /auth/login/ and /auth/refresh/ are kept for existing clients
    path('token/', LoginView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', RefreshView.as_view(), name='token_refresh'),
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', RefreshView.as_view(), name='refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('profile/', ProfileView.as_view(), name='auth-profile'),
]
