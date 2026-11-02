from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from focus.models import PomodoroSession
from habits.models import Habit, HabitCheck
from planner.models import MonthPlan, Quote, Task
from study.models import Deadline, Subject

User = get_user_model()


class DashboardTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user('alice', first_name='Алиса')
        self.bob = User.objects.create_user('bob')
        self.today = timezone.localdate()
        self.client.force_authenticate(self.alice)

    def test_requires_login(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/dashboard/').status_code, 401)

    def test_empty_dashboard(self):
        response = self.client.get('/api/v1/dashboard/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Алиса')
        self.assertEqual(response.data['tasks_today'], [])
        self.assertIsNone(response.data['next_deadline'])
        self.assertEqual(response.data['month']['progress']['stage'], 'seedling')
        self.assertTrue(response.data['quote']['text'])

    def test_dashboard_numbers(self):
        plan = MonthPlan.objects.create(user=self.alice, year=self.today.year,
                                        month=self.today.month, title='Месяц')
        for done in (True, True, True, False):
            Task.objects.create(user=self.alice, month_plan=plan, title='t',
                                date=self.today, is_done=done)
        subject = Subject.objects.create(user=self.alice, name='SQL')
        Deadline.objects.create(user=self.alice, subject=subject, title='Экзамен SQL',
                                kind='exam', due_date=self.today + timedelta(days=12))
        Deadline.objects.create(user=self.alice, subject=subject, title='Позже',
                                kind='exam', due_date=self.today + timedelta(days=40))
        habit = Habit.objects.create(user=self.alice, title='Вода')
        HabitCheck.objects.create(habit=habit, date=self.today)
        Habit.objects.create(user=self.alice, title='Старая', is_active=False)
        PomodoroSession.objects.create(user=self.alice, subject=subject,
                                       started_at=timezone.now(), duration_min=25)
        Quote.objects.create(text='Цветы растут медленно', author='Bloom')

        # another user's data must never appear
        bob_plan = MonthPlan.objects.create(user=self.bob, year=self.today.year,
                                            month=self.today.month, title='Боб')
        Task.objects.create(user=self.bob, month_plan=bob_plan, title='bob', date=self.today)

        data = self.client.get('/api/v1/dashboard/').data
        self.assertEqual(len(data['tasks_today']), 4)
        self.assertEqual(data['tasks_done'], 3)
        self.assertEqual(data['month']['progress']['percent'], 75)
        self.assertEqual(data['month']['progress']['stage'], 'bud')
        self.assertEqual(data['next_deadline']['title'], 'Экзамен SQL')
        self.assertEqual(data['next_deadline']['days_left'], 12)
        self.assertEqual([h['title'] for h in data['habits_today']], ['Вода'])
        self.assertTrue(data['habits_today'][0]['checked'])
        self.assertEqual(data['habits_today'][0]['streak'], 1)
        self.assertEqual(data['focus_minutes_today'], 25)
        self.assertEqual(data['quote']['text'], 'Цветы растут медленно')


class QuoteTests(APITestCase):
    def test_quotes_are_read_only(self):
        self.client.force_authenticate(User.objects.create_user('alice'))
        self.assertEqual(self.client.get('/api/v1/quotes/').status_code, 200)
        self.assertEqual(self.client.post('/api/v1/quotes/', {'text': 'x'}).status_code, 405)


class SwaggerTests(APITestCase):
    def test_schema_and_docs_are_available(self):
        self.assertEqual(self.client.get('/api/schema/').status_code, 200)
        self.assertEqual(self.client.get('/api/docs/').status_code, 200)


class ServerDateTests(APITestCase):
    def test_server_date_is_local_today(self):
        self.client.force_authenticate(User.objects.create_user('alice'))
        response = self.client.get('/api/v1/server-date/')
        self.assertEqual(response.data, {'date': timezone.localdate()})

    def test_requires_login(self):
        self.assertEqual(self.client.get('/api/v1/server-date/').status_code, 401)
