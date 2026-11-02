from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from .models import Profile
User = get_user_model()

#Serializer преобразует данные Python/Django в JSON и
# обратно. Он также проверяет входящие данные.

MAX_AVATAR_SIZE = 2 * 1024 * 1024  # 2 MB


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    password2 = serializers.CharField(write_only=True, style={'input_type': 'password'})
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'password2']
        read_only_fields = ['id']

    def validate_email(self, email):
        if email and User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('Пользователь с таким email уже существует.')
        return email

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({
                'password2': 'Пароли не совпадают.'})
        # build an unsaved user so validators can compare
        # the password with the username and email
        user = User(username=attrs['username'], email=attrs.get('email', ''))
        try:
            password_validation.validate_password(attrs['password'], user)
        except DjangoValidationError as error:
            raise serializers.ValidationError({'password': list(error.messages)})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        # the Profile is created by the post_save signal (accounts/signals.py)
        return User.objects.create_user(password=password, **validated_data)


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source='user.username', read_only=True )
    email = serializers.EmailField(
        source='user.email', read_only=True)
    first_name = serializers.CharField(
        source='user.first_name', required=False, allow_blank=True, max_length=150)
    class Meta:
        model = Profile
        fields = [
            'id', 'username',
            'email', 'first_name', 'avatar',
            'accent_color', 'semester_goal', ]
        read_only_fields = ['id']

    def validate_avatar(self, avatar):
        if avatar and avatar.size > MAX_AVATAR_SIZE:
            raise serializers.ValidationError('Аватар должен быть меньше 2 МБ.')
        return avatar

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        if 'first_name' in user_data:
            instance.user.first_name = user_data['first_name']
            instance.user.save(update_fields=['first_name'])
        return super().update(instance, validated_data)
