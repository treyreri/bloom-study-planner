from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.throttling import ScopedRateThrottle

from rest_framework_simplejwt.views import (
    TokenObtainPairView, TokenRefreshView, )
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from .models import Profile
from .serializers import RegisterSerializer, ProfileSerializer


class RegisterView(generics.CreateAPIView):
    queryset = Profile.objects.none()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'


class LoginView(TokenObtainPairView):
    """Returns an access and a refresh JWT for a username and password."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'


class RefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    def get_object(self):
        profile, created = Profile.objects.get_or_create(
            user=self.request.user  )
        return profile


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=inline_serializer('LogoutRequest', {'refresh': serializers.CharField()}),
        responses=inline_serializer('LogoutResponse', {'message': serializers.CharField()}),
    )
    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            raise ValidationError({
                'refresh': 'Нужен refresh-токен.' })
        try:
            token = RefreshToken(refresh_token)
            if str(token['user_id']) != str(request.user.pk):
                raise ValidationError({'refresh': 'Этот токен принадлежит другому пользователю.'})
            token.blacklist()
        except TokenError:
            raise ValidationError({
                'refresh': 'Refresh-токен недействителен или истёк.' })
        return Response(
            {'message': 'Вы вышли из аккаунта.'},
            status=status.HTTP_200_OK )
