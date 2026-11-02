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
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.models import update_last_login
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from .forms import RegisterForm
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


# ---------------------------------------------------------------------------
# Login and registration for the React website.
# They run the same Django forms the old template pages used, so the website
# shows exactly the same validation messages, and answer with a JWT pair.

FormTokens = inline_serializer('FormTokens', {
    'access': serializers.CharField(), 'refresh': serializers.CharField()})
FormErrors = inline_serializer('FormErrors', {
    'errors': serializers.DictField(child=serializers.ListField(child=serializers.CharField()))})


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


class FormLoginView(APIView):
    """Django's AuthenticationForm: field errors under 'errors', '__all__' = wrong password."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(
        request=inline_serializer('FormLoginRequest', {
            'username': serializers.CharField(), 'password': serializers.CharField()}),
        responses={200: FormTokens, 400: FormErrors},
    )
    def post(self, request):
        form = AuthenticationForm(request._request, data=request.data)
        if not form.is_valid():
            return Response({'errors': form.errors}, status=status.HTTP_400_BAD_REQUEST)
        user = form.get_user()
        update_last_login(None, user)
        return Response(tokens_for(user))


class FormRegisterView(APIView):
    """The registration form of the website (username, optional email, password1, password2)."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(
        request=inline_serializer('FormRegisterRequest', {
            'username': serializers.CharField(), 'email': serializers.CharField(required=False),
            'password1': serializers.CharField(), 'password2': serializers.CharField()}),
        responses={201: FormTokens, 400: FormErrors},
    )
    def post(self, request):
        form = RegisterForm(data=request.data)
        if not form.is_valid():
            return Response({'errors': form.errors}, status=status.HTTP_400_BAD_REQUEST)
        user = form.save()  # the Profile is created by accounts/signals.py
        update_last_login(None, user)
        return Response(tokens_for(user), status=status.HTTP_201_CREATED)
