from django.urls import path, include
from rest_framework.routers import DefaultRouter

from accounts.views import ProfileView
from .views import DashboardStatsView, NotificationsView, ServerDateView
from planner.views import MonthPlanViewSet, TaskViewSet, QuoteViewSet
from study.views import SubjectViewSet, DeadlineViewSet, ScheduleSlotViewSet
from habits.views import HabitViewSet, HabitCheckViewSet
from focus.views import PomodoroSessionViewSet
from diary.views import WeeklyReflectionViewSet

# Mounted at /api/v1/
router = DefaultRouter()

# planner
router.register('months', MonthPlanViewSet, basename='month')
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
    path("profile/", ProfileView.as_view(), name="profile"),
    path("dashboard/", DashboardStatsView.as_view(), name="dashboard"),
    path("server-date/", ServerDateView.as_view(), name="server-date"),
    path("notifications/", NotificationsView.as_view(), name="notifications"),
    path('', include(router.urls)),
]
