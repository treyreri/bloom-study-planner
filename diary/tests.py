from datetime import date

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import WeeklyReflection

User = get_user_model()
MONDAY = date(2026, 11, 2)


class ReflectionApiTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user('alice')
        self.client.force_authenticate(self.alice)

    def test_create_reflection(self):
        response = self.client.post('/api/v1/reflections/', {
            'week_start': MONDAY, 'mood': 4, 'proud_of': 'Сдала лабу'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_only_one_reflection_per_week(self):
        WeeklyReflection.objects.create(user=self.alice, week_start=MONDAY, mood=3)
        response = self.client.post('/api/v1/reflections/', {'week_start': MONDAY, 'mood': 5})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_updating_own_reflection_is_not_a_duplicate(self):
        reflection = WeeklyReflection.objects.create(user=self.alice, week_start=MONDAY, mood=3)
        response = self.client.put(f'/api/v1/reflections/{reflection.id}/', {
            'week_start': MONDAY, 'mood': 5})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_week_must_start_on_monday(self):
        response = self.client.post('/api/v1/reflections/', {'week_start': date(2026, 11, 4), 'mood': 3})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mood_between_1_and_5(self):
        response = self.client.post('/api/v1/reflections/', {'week_start': MONDAY, 'mood': 6})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reflections_are_private(self):
        bob = User.objects.create_user('bob')
        reflection = WeeklyReflection.objects.create(
            user=bob, week_start=MONDAY, mood=1, failed='секрет')
        url = f'/api/v1/reflections/{reflection.id}/'
        self.assertEqual(self.client.get('/api/v1/reflections/').data['count'], 0)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.patch(url, {'mood': 5}).status_code, 404)
