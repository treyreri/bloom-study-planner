from django.contrib import admin
from .models import Habit, HabitCheck

class HabitCheckInline(admin.TabularInline):
    model = HabitCheck
    extra = 0


@admin.register(Habit)
class HabitAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "user", "emoji", "is_active")
    list_filter = ("is_active",)
    search_fields = ("title", "user__username")
    inlines = [HabitCheckInline]


@admin.register(HabitCheck)
class HabitCheckAdmin(admin.ModelAdmin):
    list_display = ("id", "habit", "date")
    list_filter = ("date",)
    search_fields = ("habit__title", "habit__user__username")
    date_hierarchy = "date"
    ordering = ("-date",)


#TabularInline позволяет просматривать и добавлять 
# ежедневные
#отметки привычки прямо внутри страницы самой привычки