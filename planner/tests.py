from datetime import date, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from study.models import Subject
from .models import MonthPlan, Task
from . import services

User = get_user_model()


def make_plan(user, day=None, **extra):
    day = day or timezone.localdate()
    return MonthPlan.objects.create(
        user=user, year=day.year, month=day.month, title='План', **extra)


def make_task(user, plan, day=None, **extra):
    return Task.objects.create(
        user=user, month_plan=plan, title=extra.pop('title', 'Задача'),
        date=day or timezone.localdate(), **extra)


class GardenStageTests(TestCase):
    """Boundaries from the specification: 24/25, 49/50, 79/80 percent."""

    def test_stage_boundaries(self):
        cases = [
            (0, 'seedling'), (24, 'seedling'), (25, 'stem'), (49, 'stem'),
            (50, 'bud'), (79, 'bud'), (80, 'bouquet'), (100, 'bouquet'),
        ]
        for percent, stage in cases:
            with self.subTest(percent=percent):
                self.assertEqual(services.stage_for_percent(percent), stage)

    def test_stage_from_real_task_counts(self):
        # 100 tasks so that "done" equals the percent exactly
        user = User.objects.create_user('alice')
        plan = make_plan(user)
        for done in (24, 25, 49, 50, 79, 80):
            with self.subTest(done=done):
                Task.objects.filter(month_plan=plan).delete()
                Task.objects.bulk_create([
                    Task(user=user, month_plan=plan, title=f't{i}',
                         date=timezone.localdate(), is_done=i < done)
                    for i in range(100)
                ])
                progress = services.month_progress(plan)
                self.assertEqual(progress['percent'], done)
                self.assertEqual(
                    progress['stage'], services.stage_for_percent(done))

    def test_just_under_a_boundary_stays_on_lower_stage(self):
        # 1 of 3 = 33.3% -> stem; 2 of 3 = 66.7% -> bud; 49.9% must stay "stem"
        self.assertEqual(services.stage_for_percent(services.completion_percent(499, 1000)), 'stem')
        self.assertEqual(services.stage_for_percent(services.completion_percent(799, 1000)), 'bud')

    def test_month_without_tasks_is_seedling(self):
        user = User.objects.create_user('alice')
        progress = services.month_progress(make_plan(user))
        self.assertEqual((progress['percent'], progress['stage']), (0, 'seedling'))

    def test_finished_month_is_locked(self):
        user = User.objects.create_user('alice')
        old = make_plan(user, date(2025, 1, 1))
        for i in range(4):
            make_task(user, old, date(2025, 1, 10), is_done=i < 3)  # 75% -> bud
        current = make_plan(user)

        services.lock_finished_months(user)
        old.refresh_from_db()
        current.refresh_from_db()
        self.assertEqual(old.final_stage, 'bud')
        self.assertIsNone(current.final_stage)

        # editing old tasks afterwards does not change the saved bouquet
        old.tasks.update(is_done=True)
        self.assertEqual(services.month_progress(old)['stage'], 'bud')


class MonthPlanApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('alice')
        self.client.force_authenticate(self.user)

    def test_cannot_create_two_plans_for_same_month(self):
        data = {'year': 2026, 'month': 11, 'title': 'Ноябрь — сессия!'}
        self.assertEqual(self.client.post('/api/v1/months/', data).status_code, 201)
        response = self.client.post('/api/v1/months/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MonthPlan.objects.filter(user=self.user).count(), 1)

    def test_other_user_can_have_same_month(self):
        other = User.objects.create_user('bob')
        MonthPlan.objects.create(user=other, year=2026, month=11, title='x')
        response = self.client.post('/api/v1/months/', {'year': 2026, 'month': 11, 'title': 'y'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_invalid_month_and_too_many_focus_goals(self):
        response = self.client.post('/api/v1/months/', {'year': 2026, 'month': 13, 'title': 'x'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.post('/api/v1/months/', {
            'year': 2026, 'month': 10, 'title': 'x', 'focus_goals': ['a', 'b', 'c', 'd']},
            format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_final_stage_is_read_only(self):
        response = self.client.post('/api/v1/months/', {
            'year': 2026, 'month': 10, 'title': 'x', 'final_stage': 'bouquet'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data['final_stage'])

    def test_calendar_and_garden(self):
        plan = make_plan(self.user)
        today = timezone.localdate()
        make_task(self.user, plan, today, is_done=True)
        make_task(self.user, plan, today)
        response = self.client.get(f'/api/v1/months/{plan.id}/calendar/')
        self.assertEqual(response.data['days'], [{'date': today, 'total': 2, 'done': 1}])

        response = self.client.get(f'/api/v1/months/{plan.id}/garden/')
        self.assertEqual(response.data['percent'], 50)
        self.assertEqual(response.data['stage'], 'bud')


class TaskApiTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user('alice')
        self.bob = User.objects.create_user('bob')
        self.today = timezone.localdate()
        self.alice_plan = make_plan(self.alice)
        self.bob_plan = make_plan(self.bob)
        self.bob_task = make_task(self.bob, self.bob_plan, title='Секрет Боба')
        self.client.force_authenticate(self.alice)

    # --- user isolation (IDOR) ---

    def test_user_a_does_not_see_tasks_of_user_b(self):
        make_task(self.alice, self.alice_plan, title='Моя задача')
        response = self.client.get('/api/v1/tasks/')
        titles = [task['title'] for task in response.data['results']]
        self.assertEqual(titles, ['Моя задача'])

    def test_cannot_read_change_or_delete_other_users_task(self):
        url = f'/api/v1/tasks/{self.bob_task.id}/'
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.patch(url, {'title': 'x'}).status_code, 404)
        self.assertEqual(self.client.post(url + 'toggle/').status_code, 404)
        self.assertEqual(self.client.post(url + 'move-tomorrow/').status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)
        self.bob_task.refresh_from_db()
        self.assertEqual(self.bob_task.title, 'Секрет Боба')
        self.assertFalse(self.bob_task.is_done)

    def test_cannot_link_task_to_other_users_month_or_subject(self):
        bob_subject = Subject.objects.create(user=self.bob, name='SQL')
        response = self.client.post('/api/v1/tasks/', {
            'title': 'x', 'date': self.today, 'month_plan': self.bob_plan.id})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.post('/api/v1/tasks/', {
            'title': 'x', 'date': self.today, 'subject': bob_subject.id})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Task.objects.filter(user=self.alice).exists())

    def test_user_field_cannot_be_set_by_client(self):
        response = self.client.post('/api/v1/tasks/', {
            'title': 'x', 'date': self.today, 'user': self.bob.id})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Task.objects.get(id=response.data['id']).user, self.alice)

    # --- creating tasks ---

    def test_month_plan_is_chosen_from_date_when_omitted(self):
        next_month = (self.today.replace(day=1) + timedelta(days=32)).replace(day=5)
        response = self.client.post('/api/v1/tasks/', {'title': 'x', 'date': next_month})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        plan = MonthPlan.objects.get(id=response.data['month_plan'])
        self.assertEqual((plan.user, plan.year, plan.month),
                         (self.alice, next_month.year, next_month.month))

    def test_date_must_be_inside_month_plan(self):
        other_month = self.today.replace(day=1) - timedelta(days=1)
        response = self.client.post('/api/v1/tasks/', {
            'title': 'x', 'date': other_month, 'month_plan': self.alice_plan.id})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_title_and_bad_priority(self):
        response = self.client.post('/api/v1/tasks/', {'date': self.today, 'priority': 'urgent'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('title', response.data)
        self.assertIn('priority', response.data)

    # --- toggle and done_at ---

    def test_toggle_changes_is_done_and_done_at(self):
        task = make_task(self.alice, self.alice_plan)
        response = self.client.post(f'/api/v1/tasks/{task.id}/toggle/')
        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertTrue(task.is_done)
        self.assertIsNotNone(task.done_at)

        self.client.post(f'/api/v1/tasks/{task.id}/toggle/')
        task.refresh_from_db()
        self.assertFalse(task.is_done)
        self.assertIsNone(task.done_at)

    def test_patch_is_done_also_sets_done_at(self):
        task = make_task(self.alice, self.alice_plan)
        self.client.patch(f'/api/v1/tasks/{task.id}/', {'is_done': True})
        task.refresh_from_db()
        self.assertIsNotNone(task.done_at)

    def test_done_at_is_read_only(self):
        task = make_task(self.alice, self.alice_plan)
        self.client.patch(f'/api/v1/tasks/{task.id}/', {'done_at': '2020-01-01T00:00:00Z'})
        task.refresh_from_db()
        self.assertIsNone(task.done_at)

    # --- move to tomorrow ---

    def test_move_tomorrow(self):
        task = make_task(self.alice, self.alice_plan)
        response = self.client.post(f'/api/v1/tasks/{task.id}/move-tomorrow/')
        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        tomorrow = self.today + timedelta(days=1)
        self.assertEqual(task.date, tomorrow)
        self.assertEqual((task.month_plan.year, task.month_plan.month),
                         (tomorrow.year, tomorrow.month))

    def test_overdue_task_moves_to_tomorrow(self):
        old_day = self.today - timedelta(days=40)
        old_plan = services.get_or_create_month_plan(self.alice, old_day)
        task = make_task(self.alice, old_plan, old_day)
        self.client.post(f'/api/v1/tasks/{task.id}/move-tomorrow/')
        task.refresh_from_db()
        self.assertEqual(task.date, self.today + timedelta(days=1))

    def test_move_tomorrow_across_month_end(self):
        last_day = date(2026, 11, 30)
        plan = services.get_or_create_month_plan(self.alice, last_day)
        task = make_task(self.alice, plan, last_day)
        with mock.patch('django.utils.timezone.localdate', return_value=last_day):
            self.client.post(f'/api/v1/tasks/{task.id}/move-tomorrow/')
        task.refresh_from_db()
        self.assertEqual(task.date, date(2026, 12, 1))
        self.assertEqual((task.month_plan.year, task.month_plan.month), (2026, 12))

    def test_finished_task_is_not_moved(self):
        task = make_task(self.alice, self.alice_plan, is_done=True)
        response = self.client.post(f'/api/v1/tasks/{task.id}/move-tomorrow/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # --- lists, filters, ordering ---

    def test_today_endpoint(self):
        make_task(self.alice, self.alice_plan, self.today, title='сегодня')
        make_task(self.alice, self.alice_plan, self.today + timedelta(days=1), title='завтра')
        response = self.client.get('/api/v1/tasks/today/')
        # the plan may not contain "tomorrow"; today's task is what matters
        self.assertEqual([task['title'] for task in response.data], ['сегодня'])

    def test_overdue_filter(self):
        yesterday = self.today - timedelta(days=1)
        plan = services.get_or_create_month_plan(self.alice, yesterday)
        make_task(self.alice, plan, yesterday, title='просрочена')
        make_task(self.alice, plan, yesterday, title='сделана', is_done=True)
        make_task(self.alice, self.alice_plan, self.today, title='сегодня')
        response = self.client.get('/api/v1/tasks/?overdue=true')
        self.assertEqual([task['title'] for task in response.data['results']], ['просрочена'])

    def test_ordering_by_priority_is_not_alphabetical(self):
        for priority in ('mid', 'high', 'low'):
            make_task(self.alice, self.alice_plan, priority=priority, title=priority)
        response = self.client.get('/api/v1/tasks/?ordering=priority')
        self.assertEqual([t['title'] for t in response.data['results']], ['low', 'mid', 'high'])
        response = self.client.get('/api/v1/tasks/?ordering=-priority')
        self.assertEqual([t['title'] for t in response.data['results']], ['high', 'mid', 'low'])

    def test_search_by_title(self):
        make_task(self.alice, self.alice_plan, title='Учить SQL')
        make_task(self.alice, self.alice_plan, title='Спорт')
        response = self.client.get('/api/v1/tasks/?search=sql')
        self.assertEqual(response.data['count'], 1)

    def test_pagination_is_20_per_page(self):
        Task.objects.bulk_create([
            Task(user=self.alice, month_plan=self.alice_plan, title=str(i), date=self.today)
            for i in range(25)
        ])
        response = self.client.get('/api/v1/tasks/')
        self.assertEqual(response.data['count'], 25)
        self.assertEqual(len(response.data['results']), 20)
        self.assertIsNotNone(response.data['next'])


class DemoDataTests(TestCase):
    def test_demo_fixture_loads(self):
        from django.core.management import call_command
        call_command('loaddata', 'demo.json', verbosity=0)
        demo = User.objects.get(username='demo')
        self.assertTrue(hasattr(demo, 'profile'))
        self.assertTrue(demo.tasks.exists())
        self.assertEqual(MonthPlan.objects.filter(user=demo).count(), 4)

    def test_seed_demo_creates_fresh_data_and_can_rerun(self):
        from django.core.management import call_command
        call_command('seed_demo', verbosity=0)
        call_command('seed_demo', verbosity=0)
        demo = User.objects.get(username='demo')
        self.assertTrue(demo.check_password('bloom-demo-2026'))
        self.assertEqual(demo.tasks.filter(date=timezone.localdate()).count(), 4)
        current = MonthPlan.objects.get(user=demo, year=timezone.localdate().year,
                                        month=timezone.localdate().month)
        self.assertIsNone(current.final_stage)
