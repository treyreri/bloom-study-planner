from django.urls import path
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("today/", views.today, name="today"),
    path("month/", views.month, name="month"),
    path("tasks/", views.tasks, name="tasks"),
    path("study/", views.study, name="study"),
    path("habits/", views.habits, name="habits"),
    path("focus/", views.focus, name="focus"),
    path("diary/", views.diary, name="diary"),
    path("garden/", views.garden, name="garden"),
]