from django.contrib.auth import views as auth_views
from django.urls import path
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("login/", auth_views.LoginView.as_view(
        template_name="web/login.html", redirect_authenticated_user=True), name="login"),
    path("register/", views.register, name="register"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),  # POST only
    path("today/", views.today, name="today"),
    path("month/", views.month, name="month"),
    path("tasks/", views.tasks, name="tasks"),
    path("study/", views.study, name="study"),
    path("habits/", views.habits, name="habits"),
    path("focus/", views.focus, name="focus"),
    path("diary/", views.diary, name="diary"),
    path("garden/", views.garden, name="garden"),
    path("profile/", views.profile, name="profile"),
]
