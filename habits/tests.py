from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Habit, HabitCheck
from .services import current_streak

User = get_user_model()


class StreakTests(TestCase):
    def setUp(self):
        self.habit = Habit.objects.create(user=User.objects.create_user('alice'), title='Вода')
        self.today = date(2026, 11, 20)

    def check_days_ago(self, *days):
        for days_ago in days:
            HabitCheck.objects.create(habit=self.habit, date=self.today - timedelta(days=days_ago))

    def test_no_checks(self):
        self.assertEqual(current_streak(self.habit, self.today), 0)

    def test_consecutive_days_including_today(self):
        self.check_days_ago(0, 1, 2)
        self.assertEqual(current_streak(self.habit, self.today), 3)

    def test_skipped_day_breaks_the_streak(self):
        # today, yesterday, (skip), 3 and 4 days ago -> only 2 in a row
        self.check_days_ago(0, 1, 3, 4)
        self.assertEqual(current_streak(self.habit, self.today), 2)

    def test_today_not_checked_yet_keeps_yesterdays_streak(self):
        self.check_days_ago(1, 2, 3)
        self.assertEqual(current_streak(self.habit, self.today), 3)

    def test_two_days_without_checks_resets_to_zero(self):
        self.check_days_ago(2, 3)
        self.assertEqual(current_streak(self.habit, self.today), 0)


class HabitApiTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user('alice')
        self.bob = User.objects.create_user('bob')
        self.habit = Habit.objects.create(user=self.alice, title='Зал')
        self.bob_habit = Habit.objects.create(user=self.bob, title='Чтение')
        self.client.force_authenticate(self.alice)

    def test_check_endpoint_toggles(self):
        url = f'/api/v1/habits/{self.habit.id}/check/'
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['checked'])
        self.assertEqual(response.data['streak'], 1)

        response = self.client.post(url)
        self.assertFalse(response.data['checked'])
        self.assertFalse(HabitCheck.objects.filter(habit=self.habit).exists())

    def test_check_specific_past_date_but_not_future(self):
        url = f'/api/v1/habits/{self.habit.id}/check/'
        yesterday = timezone.localdate() - timedelta(days=1)
        self.assertTrue(self.client.post(url, {'date': yesterday}).data['checked'])
        response = self.client.post(url, {'date': timezone.localdate() + timedelta(days=1)})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_check_other_users_habit(self):
        response = self.client.post(f'/api/v1/habits/{self.bob_habit.id}/check/')
        self.assertEqual(response.status_code, 404)
        response = self.client.post('/api/v1/habit-checks/', {
            'habit': self.bob_habit.id, 'date': timezone.localdate()})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(HabitCheck.objects.filter(habit=self.bob_habit).exists())

    def test_duplicate_habit_check_is_400(self):
        data = {'habit': self.habit.id, 'date': timezone.localdate()}
        self.assertEqual(self.client.post('/api/v1/habit-checks/', data).status_code, 201)
        response = self.client.post('/api/v1/habit-checks/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(HabitCheck.objects.count(), 1)

    def test_habit_checks_are_private(self):
        HabitCheck.objects.create(habit=self.bob_habit, date=timezone.localdate())
        self.assertEqual(self.client.get('/api/v1/habit-checks/').data['count'], 0)

    def test_streak_endpoint(self):
        today = timezone.localdate()
        for days_ago in (0, 1):
            HabitCheck.objects.create(habit=self.habit, date=today - timedelta(days=days_ago))
        response = self.client.get(f'/api/v1/habits/{self.habit.id}/streak/')
        self.assertEqual(response.data['streak'], 2)
        response = self.client.get(f'/api/v1/habits/{self.bob_habit.id}/streak/')
        self.assertEqual(response.status_code, 404)

    def test_grid_returns_only_own_habits_and_month_checks(self):
        today = timezone.localdate()
        HabitCheck.objects.create(habit=self.habit, date=today)
        HabitCheck.objects.create(habit=self.habit, date=today.replace(day=1) - timedelta(days=1))
        response = self.client.get(f'/api/v1/habits/grid/?year={today.year}&month={today.month}')
        self.assertEqual([h['title'] for h in response.data['habits']], ['Зал'])
        self.assertEqual(response.data['habits'][0]['checked_dates'], [today])

    def test_grid_rejects_bad_month(self):
        response = self.client.get('/api/v1/habits/grid/?year=2026&month=13')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
