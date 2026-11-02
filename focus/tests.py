from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from study.models import Subject
from .models import PomodoroSession

User = get_user_model()


class PomodoroApiTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user('alice')
        self.bob = User.objects.create_user('bob')
        self.sql = Subject.objects.create(user=self.alice, name='SQL', color='#FF0080')
        self.math = Subject.objects.create(user=self.alice, name='Math', color='#A8002E')
        self.client.force_authenticate(self.alice)

    def test_create_session_without_start_time(self):
        response = self.client.post('/api/v1/pomodoro/', {'subject': self.sql.id, 'duration_min': 25})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PomodoroSession.objects.get().user, self.alice)

    def test_duration_must_be_reasonable(self):
        for minutes in (0, 181):
            response = self.client.post('/api/v1/pomodoro/', {'duration_min': minutes})
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, minutes)

    def test_cannot_start_in_future(self):
        response = self.client.post('/api/v1/pomodoro/', {
            'duration_min': 25, 'started_at': timezone.now() + timedelta(days=1)})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_use_other_users_subject(self):
        bob_subject = Subject.objects.create(user=self.bob, name='Bob')
        response = self.client.post('/api/v1/pomodoro/', {
            'subject': bob_subject.id, 'duration_min': 25})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_stats_sum_minutes_per_subject_for_this_week(self):
        now = timezone.now()
        PomodoroSession.objects.create(user=self.alice, subject=self.sql, started_at=now, duration_min=25)
        PomodoroSession.objects.create(user=self.alice, subject=self.sql, started_at=now, duration_min=25)
        PomodoroSession.objects.create(user=self.alice, subject=self.math, started_at=now, duration_min=10)
        PomodoroSession.objects.create(user=self.alice, subject=None, started_at=now, duration_min=5)
        # not counted: another user, and a session three weeks ago
        PomodoroSession.objects.create(user=self.bob, started_at=now, duration_min=100)
        PomodoroSession.objects.create(user=self.alice, subject=self.sql,
                                       started_at=now - timedelta(days=21), duration_min=50)

        response = self.client.get('/api/v1/pomodoro/stats/?period=week')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_minutes'], 65)
        by_subject = {row['name']: row['minutes'] for row in response.data['by_subject']}
        self.assertEqual(by_subject, {'SQL': 50, 'Math': 10, 'Без предмета': 5})
        self.assertEqual(response.data['by_day'], [{'date': timezone.localdate(), 'minutes': 65}])

    def test_stats_rejects_unknown_period(self):
        response = self.client.get('/api/v1/pomodoro/stats/?period=year')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sessions_are_private(self):
        session = PomodoroSession.objects.create(user=self.bob, started_at=timezone.now(), duration_min=25)
        self.assertEqual(self.client.get('/api/v1/pomodoro/').data['count'], 0)
        self.assertEqual(self.client.delete(f'/api/v1/pomodoro/{session.id}/').status_code, 404)
