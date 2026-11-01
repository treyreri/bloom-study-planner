from django.contrib import admin
from .models import PomodoroSession


@admin.register(PomodoroSession)
class PomodoroSessionAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user", "subject",
        "started_at", "duration_min", )
    list_filter = ("started_at", "subject")
    search_fields = ("user__username", "subject__name")
    date_hierarchy = "started_at"
    ordering = ("-started_at",)