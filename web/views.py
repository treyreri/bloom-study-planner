from django.shortcuts import render

def home(request):
    return render(request, "web/home.html")

def today(request):
    return render(request, "web/today.html")

def month(request):
    return render(request, "web/month.html")

def tasks(request):
    return render(request, "web/tasks.html")

def study(request):
    return render(request, "web/study.html")

def habits(request):
    return render(request, "web/habits.html")

def focus(request):
    return render(request, "web/focus.html")

def diary(request):
    return render(request, "web/diary.html")

def garden(request):
    return render(request, "web/garden.html")