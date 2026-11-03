from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from focus.models import PomodoroSession
from habits.models import Habit, HabitCheck
from planner.models import MonthPlan, Quote, Task
from planner.services import get_or_create_month_plan
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


class NotificationsTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user('alice')
        self.bob = User.objects.create_user('bob')
        self.today = timezone.localdate()
        self.client.force_authenticate(self.alice)

    def deadline(self, user, days, title):
        subject, _ = Subject.objects.get_or_create(user=user, name='SQL')
        return Deadline.objects.create(user=user, subject=subject, title=title, kind='test',
                                       due_date=self.today + timedelta(days=days))

    def task(self, user, days, title, done=False):
        day = self.today + timedelta(days=days)
        return Task.objects.create(user=user, title=title, is_done=done, date=day,
                                   month_plan=get_or_create_month_plan(user, day))

    def test_requires_login(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/notifications/').status_code, 401)

    def test_empty(self):
        data = self.client.get('/api/v1/notifications/').data
        self.assertEqual(data['date'], self.today)
        for key in ('upcoming_deadlines', 'overdue_deadlines', 'overdue_tasks', 'today_tasks'):
            self.assertEqual(data[key], [])
        self.assertEqual(data['overdue_tasks_count'], 0)

    def test_groups(self):
        self.deadline(self.alice, 2, 'Зачёт скоро')
        self.deadline(self.alice, 0, 'Сегодня')
        self.deadline(self.alice, 30, 'Далеко')            # beyond 14 days: not shown
        self.deadline(self.alice, -3, 'Прошёл')
        self.deadline(self.alice, -10, 'Давно прошёл')     # older than a week: not shown
        self.task(self.alice, -2, 'Просрочена')
        self.task(self.alice, -1, 'Сделана', done=True)
        self.task(self.alice, 0, 'Сегодня открыта')
        self.task(self.alice, 0, 'Сегодня сделана', done=True)
        self.task(self.alice, 1, 'Завтра')

        data = self.client.get('/api/v1/notifications/').data
        titles = lambda key: [item['title'] for item in data[key]]
        self.assertEqual(titles('upcoming_deadlines'), ['Сегодня', 'Зачёт скоро'])
        self.assertEqual([d['days_left'] for d in data['upcoming_deadlines']], [0, 2])
        self.assertEqual(titles('overdue_deadlines'), ['Прошёл'])
        self.assertEqual(titles('overdue_tasks'), ['Просрочена'])
        self.assertEqual(data['overdue_tasks_count'], 1)
        self.assertEqual(titles('today_tasks'), ['Сегодня открыта'])

    def test_user_a_does_not_see_user_b(self):
        self.deadline(self.bob, 1, 'Дедлайн Боба')
        self.deadline(self.bob, -1, 'Прошедший Боба')
        self.task(self.bob, -1, 'Просрочка Боба')
        self.task(self.bob, 0, 'Задача Боба')
        self.deadline(self.alice, 1, 'Дедлайн Алисы')

        data = self.client.get('/api/v1/notifications/').data
        self.assertEqual([d['title'] for d in data['upcoming_deadlines']], ['Дедлайн Алисы'])
        self.assertEqual(data['overdue_deadlines'], [])
        self.assertEqual(data['overdue_tasks'], [])
        self.assertEqual(data['overdue_tasks_count'], 0)
        self.assertEqual(data['today_tasks'], [])

    def test_read_only(self):
        self.assertEqual(self.client.post('/api/v1/notifications/', {}).status_code, 405)
