
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from planner.views import MonthPlanViewSet, TaskViewSet, QuoteViewSet
from study.views import SubjectViewSet, DeadlineViewSet, ScheduleSlotViewSet
from habits.views import HabitViewSet, HabitCheckViewSet
from focus.views import PomodoroSessionViewSet
from diary.views import WeeklyReflectionViewSet

router = DefaultRouter()

# planner
router.register('month-plans', MonthPlanViewSet, basename='month-plan')
router.register('tasks', TaskViewSet, basename='task')
router.register('quotes', QuoteViewSet, basename='quote')

# study
router.register('subjects', SubjectViewSet, basename='subject')
router.register('deadlines', DeadlineViewSet, basename='deadline')
router.register('schedule', ScheduleSlotViewSet, basename='schedule')

# habits
router.register('habits', HabitViewSet, basename='habit')
router.register('habit-checks', HabitCheckViewSet, basename='habit-check')

# focus
router.register('pomodoro', PomodoroSessionViewSet, basename='pomodoro')

# diary
router.register('reflections', WeeklyReflectionViewSet, basename='reflection')


urlpatterns = [
    path('', include(router.urls)),
]
