"""
Website pages (Django MVT).

The pages are rendered by Django, then JavaScript in static/js/ loads and
saves the data through the REST API (/api/v1/) using the same login session.
"""
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render

from .forms import RegisterForm


def home(request):
    if request.user.is_authenticated:
        return redirect("today")
    return render(request, "web/home.html")


def register(request):
    if request.user.is_authenticated:
        return redirect("today")
    form = RegisterForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.save()  # the Profile is created by accounts/signals.py
        login(request, user)
        return redirect("today")
    return render(request, "web/register.html", {"form": form})


@login_required
def today(request):
    return render(request, "web/today.html")


@login_required
def month(request):
    return render(request, "web/month.html")


@login_required
def tasks(request):
    return render(request, "web/tasks.html")


@login_required
def study(request):
    return render(request, "web/study.html")


@login_required
def habits(request):
    return render(request, "web/habits.html")


@login_required
def focus(request):
    return render(request, "web/focus.html")


@login_required
def diary(request):
    return render(request, "web/diary.html")


@login_required
def garden(request):
    return render(request, "web/garden.html")


@login_required
def profile(request):
    return render(request, "web/profile.html")
