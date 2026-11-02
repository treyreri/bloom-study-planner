from django.contrib.auth import get_user_model
from django.urls import reverse
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


class WebAuthTests(APITestCase):
    """The website uses Django sessions: register, log in, log out."""

    def test_register_page_creates_account_and_logs_in(self):
        response = self.client.post(reverse('register'), {
            'username': 'alice', 'password1': PASSWORD, 'password2': PASSWORD})
        self.assertRedirects(response, reverse('today'), fetch_redirect_response=False)
        self.assertTrue(User.objects.filter(username='alice').exists())
        self.assertEqual(self.client.get(reverse('today')).status_code, 200)

    def test_login_and_logout(self):
        User.objects.create_user('alice', password=PASSWORD)
        response = self.client.post(reverse('login'), {'username': 'alice', 'password': PASSWORD})
        self.assertRedirects(response, reverse('today'), fetch_redirect_response=False)

        response = self.client.post(reverse('logout'))
        self.assertRedirects(response, reverse('home'), fetch_redirect_response=False)
        response = self.client.get(reverse('today'))
        self.assertEqual(response.status_code, 302)

    def test_app_pages_require_login(self):
        for name in ['today', 'month', 'tasks', 'study', 'habits', 'focus', 'diary', 'garden', 'profile']:
            response = self.client.get(reverse(name))
            self.assertEqual(response.status_code, 302, name)
            self.assertIn(reverse('login'), response['Location'])
