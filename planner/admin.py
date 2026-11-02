from django.contrib import admin
from .models import MonthPlan, Task, Quote


@admin.register(MonthPlan)
class MonthPlanAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "user", "year", "month", "final_stage")
    list_filter = ("year", "month", "final_stage")
    search_fields = ("title", "user__username")


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "user", "date", "priority", "is_done", "subject")
    list_filter = ("is_done", "priority", "date")
    search_fields = ("title", "user__username")
    date_hierarchy = "date"
    readonly_fields = ("done_at", "created_at")


@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = ("id", "text", "author")
    search_fields = ("text", "author")
