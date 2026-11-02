from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Profile

User = get_user_model()
PASSWORD = 'Bloom-pass-2026'


class RegistrationTests(APITestCase):
    url = '/api/v1/auth/register/'

    def test_register_creates_user_and_profile(self):
        response = self.client.post(self.url, {
            'username': 'alice', 'email': 'alice@example.com',
            'password': PASSWORD, 'password2': PASSWORD,
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn('password', response.data)
        user = User.objects.get(username='alice')
        self.assertTrue(Profile.objects.filter(user=user).exists())

    def test_passwords_must_match(self):
        response = self.client.post(self.url, {
            'username': 'alice', 'password': PASSWORD, 'password2': PASSWORD + 'x',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password2', response.data)

    def test_weak_password_is_rejected(self):
        response = self.client.post(self.url, {
            'username': 'alice', 'password': '12345', 'password2': '12345',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_duplicate_email_is_rejected(self):
        User.objects.create_user('bob', 'same@example.com', PASSWORD)
        response = self.client.post(self.url, {
            'username': 'alice', 'email': 'same@example.com',
            'password': PASSWORD, 'password2': PASSWORD,
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_created_user_gets_profile_too(self):
        user = User.objects.create_superuser('admin2', 'a@example.com', PASSWORD)
        self.assertTrue(Profile.objects.filter(user=user).exists())


class JwtTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('alice', password=PASSWORD)

    def get_tokens(self):
        response = self.client.post('/api/v1/auth/token/', {
            'username': 'alice', 'password': PASSWORD})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data

    def test_token_gives_access_to_protected_endpoint(self):
        tokens = self.get_tokens()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')
        response = self.client.get('/api/v1/tasks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_protected_endpoint_without_token_is_401(self):
        response = self.client.get('/api/v1/tasks/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_wrong_password_gives_no_token(self):
        response = self.client.post('/api/v1/auth/token/', {
            'username': 'alice', 'password': 'wrong'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_returns_new_access_token(self):
        tokens = self.get_tokens()
        response = self.client.post('/api/v1/auth/token/refresh/', {'refresh': tokens['refresh']})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_logout_blacklists_refresh_token(self):
        tokens = self.get_tokens()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')
        response = self.client.post('/api/v1/auth/logout/', {'refresh': tokens['refresh']})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post('/api/v1/auth/token/refresh/', {'refresh': tokens['refresh']})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cannot_logout_with_someone_elses_refresh_token(self):
        User.objects.create_user('bob', password=PASSWORD)
        bob_tokens = self.client.post('/api/v1/auth/token/', {
            'username': 'bob', 'password': PASSWORD}).data
        tokens = self.get_tokens()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')
        response = self.client.post('/api/v1/auth/logout/', {'refresh': bob_tokens['refresh']})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ProfileTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('alice', password=PASSWORD)
        self.client.force_authenticate(self.user)

    def test_get_own_profile(self):
        response = self.client.get('/api/v1/profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'alice')

    def test_update_profile_and_name(self):
        response = self.client.patch('/api/v1/profile/', {
            'first_name': 'Алиса', 'accent_color': 'lavender', 'semester_goal': 'Сдать SQL'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Алиса')
        self.assertEqual(self.user.profile.accent_color, 'lavender')

    def test_username_is_read_only(self):
        self.client.patch('/api/v1/profile/', {'username': 'hacker'})
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'alice')

    def test_invalid_accent_color(self):
        response = self.client.patch('/api/v1/profile/', {'accent_color': 'black'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class FormAuthApiTests(APITestCase):
    """Login/registration used by the React website: Django form messages + JWT."""

    def test_form_login_success_returns_jwt(self):
        User.objects.create_user('alice', password=PASSWORD)
        response = self.client.post('/api/v1/auth/form-login/', {'username': 'alice', 'password': PASSWORD})
        self.assertEqual(response.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')
        self.assertEqual(self.client.get('/api/v1/profile/').data['username'], 'alice')

    def test_form_login_wrong_password_uses_django_message(self):
        User.objects.create_user('alice', password=PASSWORD)
        response = self.client.post('/api/v1/auth/form-login/', {'username': 'alice', 'password': 'nope'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['errors']['__all__'], [
            'Пожалуйста, введите правильные имя пользователя и пароль. '
            'Оба поля могут быть чувствительны к регистру.'])

    def test_form_login_empty_fields(self):
        response = self.client.post('/api/v1/auth/form-login/', {'username': '', 'password': ''})
        self.assertEqual(response.data['errors'], {
            'username': ['Обязательное поле.'], 'password': ['Обязательное поле.']})

    def test_form_register_creates_user_profile_and_tokens(self):
        response = self.client.post('/api/v1/auth/form-register/', {
            'username': 'alice', 'email': '', 'password1': PASSWORD, 'password2': PASSWORD})
        self.assertEqual(response.status_code, 201)
        self.assertIn('access', response.data)
        self.assertTrue(Profile.objects.filter(user__username='alice').exists())

    def test_form_register_errors_match_the_old_form(self):
        User.objects.create_user('demo', email='demo@example.com', password=PASSWORD)
        response = self.client.post('/api/v1/auth/form-register/', {
            'username': 'demo', 'email': 'demo@example.com', 'password1': PASSWORD, 'password2': PASSWORD})
        self.assertEqual(response.data['errors'], {
            'username': ['Пользователь с таким именем уже существует.'],
            'email': ['Пользователь с таким email уже существует.']})
        response = self.client.post('/api/v1/auth/form-register/', {
            'username': 'newgirl', 'password1': PASSWORD, 'password2': 'other'})
        self.assertEqual(response.data['errors'], {'password2': ['Введенные пароли не совпадают.']})
