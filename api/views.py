from datetime import timedelta

from django.db.models import Exists, OuterRef, Sum
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from focus.models import PomodoroSession
from habits.models import Habit, HabitCheck
from habits.services import current_streak
from planner import services as planner_services
from planner.models import MonthPlan
from planner.serializers import TaskSerializer
from study.models import Deadline
from study.serializers import DeadlineSerializer


class DashboardStatsView(APIView):
    """Everything the "Today" page needs, in one request."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        user = request.user
        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())

        tasks_today = (user.tasks.filter(date=today)
                       .select_related('subject').order_by('is_done', 'created_at'))
        next_deadline = (Deadline.objects.filter(user=user, due_date__gte=today)
                         .select_related('subject').order_by('due_date').first())

        checked_today = HabitCheck.objects.filter(habit=OuterRef('pk'), date=today)
        habits = (Habit.objects.filter(user=user, is_active=True)
                  .annotate(checked_today=Exists(checked_today)))

        plan = planner_services.with_progress(
            MonthPlan.objects.filter(user=user, year=today.year, month=today.month)).first()
        if plan:
            month = {'id': plan.id, 'title': plan.title, 'main_goal': plan.main_goal,
                     'progress': planner_services.month_progress(plan)}
        else:
            month = {'id': None,
                     'title': planner_services.default_month_title(today.year, today.month),
                     'main_goal': '',
                     'progress': {'total': 0, 'done': 0, 'percent': 0, 'stage': 'seedling',
                                  'emoji': planner_services.STAGE_EMOJI['seedling'],
                                  'is_final': False}}

        sessions = PomodoroSession.objects.filter(user=user)
        focus_today = sessions.filter(started_at__date=today).aggregate(
            total=Sum('duration_min'))['total'] or 0
        focus_week = sessions.filter(started_at__date__gte=week_start).aggregate(
            total=Sum('duration_min'))['total'] or 0

        context = {'request': request}
        tasks_data = TaskSerializer(tasks_today, many=True, context=context).data
        return Response({
            'date': today,
            'name': user.first_name or user.username,
            'quote': planner_services.quote_of_the_day(today),
            'tasks_today': tasks_data,
            'tasks_done': sum(1 for task in tasks_data if task['is_done']),
            'next_deadline': (DeadlineSerializer(next_deadline, context=context).data
                              if next_deadline else None),
            'habits_today': [
                {'id': habit.id, 'title': habit.title, 'emoji': habit.emoji,
                 'checked': habit.checked_today, 'streak': current_streak(habit, today)}
                for habit in habits
            ],
            'month': month,
            'focus_minutes_today': focus_today,
            'focus_minutes_week': focus_week,
        })
