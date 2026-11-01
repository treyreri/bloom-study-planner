from django.contrib import admin
from .models import WeeklyReflection


@admin.register(WeeklyReflection)
class WeeklyReflectionAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user", "week_start", "mood",)
    list_filter = ("mood", "week_start")
    search_fields = (
        "user__username", "proud_of",
     "failed",  "carry_over",)
    date_hierarchy = "week_start"
    ordering = ("-week_start",)