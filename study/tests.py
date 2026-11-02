from datetime import time, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Deadline, ScheduleSlot, Subject

User = get_user_model()


class StudyApiTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user('alice')
        self.bob = User.objects.create_user('bob')
        self.subject = Subject.objects.create(user=self.alice, name='SQL')
        self.bob_subject = Subject.objects.create(user=self.bob, name='Python')
        self.client.force_authenticate(self.alice)

    def test_subjects_are_private(self):
        response = self.client.get('/api/v1/subjects/')
        self.assertEqual([s['name'] for s in response.data['results']], ['SQL'])
        url = f'/api/v1/subjects/{self.bob_subject.id}/'
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)
        self.assertTrue(Subject.objects.filter(id=self.bob_subject.id).exists())

    def test_duplicate_subject_name_is_400(self):
        response = self.client.post('/api/v1/subjects/', {'name': 'sql'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_color(self):
        response = self.client.post('/api/v1/subjects/', {'name': 'Math', 'color': 'pink'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_deadline_cannot_use_other_users_subject(self):
        response = self.client.post('/api/v1/deadlines/', {
            'subject': self.bob_subject.id, 'title': 'Экзамен', 'kind': 'exam',
            'due_date': timezone.localdate()})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_schedule_cannot_use_other_users_subject(self):
        response = self.client.post('/api/v1/schedule/', {
            'subject': self.bob_subject.id, 'weekday': 0,
            'start_time': '09:00', 'end_time': '10:30'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_schedule_end_must_be_after_start(self):
        response = self.client.post('/api/v1/schedule/', {
            'subject': self.subject.id, 'weekday': 0,
            'start_time': '10:30', 'end_time': '09:00'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        slot = ScheduleSlot.objects.create(
            user=self.alice, subject=self.subject, weekday=1,
            start_time=time(9), end_time=time(10))
        response = self.client.patch(f'/api/v1/schedule/{slot.id}/', {'start_time': '11:00'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sunday_is_not_allowed(self):
        response = self.client.post('/api/v1/schedule/', {
            'subject': self.subject.id, 'weekday': 6,
            'start_time': '09:00', 'end_time': '10:00'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upcoming_returns_next_three_with_days_left(self):
        today = timezone.localdate()
        for days in (-1, 12, 3, 30, 7):
            Deadline.objects.create(
                user=self.alice, subject=self.subject, title=f'd{days}',
                kind='exam', due_date=today + timedelta(days=days))
        Deadline.objects.create(user=self.bob, subject=self.bob_subject, title='bob',
                                kind='exam', due_date=today)
        response = self.client.get('/api/v1/deadlines/upcoming/')
        self.assertEqual([d['days_left'] for d in response.data], [3, 7, 12])

    def test_deadlines_sorted_by_date(self):
        today = timezone.localdate()
        for days in (5, 1, 3):
            Deadline.objects.create(user=self.alice, subject=self.subject, title=str(days),
                                    kind='homework', due_date=today + timedelta(days=days))
        response = self.client.get('/api/v1/deadlines/')
        self.assertEqual([d['title'] for d in response.data['results']], ['1', '3', '5'])
