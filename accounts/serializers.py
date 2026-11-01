from django.contrib.auth import get_user_model, password_validation
from rest_framework import serializers
from .models import Profile
User = get_user_model()

#Serializer преобразует данные Python/Django в JSON и
# обратно. Он также проверяет входящие данные.

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True,
        validators=[password_validation.validate_password])
    password2 = serializers.CharField(write_only=True)
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2']

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({
                'password': 'Passwords do not match.'})
        return attrs
    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User.objects.create_user(
            password=password,  **validated_data)
        Profile.objects.create(user=user)
        return user


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source='user.username', read_only=True )
    email = serializers.EmailField(
        source='user.email', read_only=True)
    class Meta:
        model = Profile
        fields = [
            'id', 'username',
            'email', 'avatar',
            'accent_color', 'semester_goal', ]