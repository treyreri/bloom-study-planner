from django.contrib import admin
from .models import Subject, Deadline, ScheduleSlot


@admin.register(Subject) #декоратор, который регистрирует SUBJECT в админке, связывая её с конкретным классом настроек
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "user", "teacher", "room", "color")
    list_filter = ("user",) #list_filter — правая боковая панель с фильтрами по выбранным полям
    search_fields = ("name", "teacher", "user__username")


@admin.register(Deadline)
class DeadlineAdmin(admin.ModelAdmin):
    list_display = ( #кортеж с именами полей, которые
        # будут отображаться в виде колонок в таблице со списком всех записей
        "id", "title",
        "user", "subject",
        "kind", "due_date",)
    list_filter = ("kind", "due_date")
    search_fields = ("title", "subject__name", "user__username")
    date_hierarchy = "due_date"
    ordering = ("due_date",)


@admin.register(ScheduleSlot)
class ScheduleSlotAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user",
        "subject", "weekday",
        "start_time", "end_time",)
    list_filter = ("weekday",)
    search_fields = ("subject__name", "user__username")
    ordering = ("weekday", "start_time")


#__username или __name — синтаксис связи
#  (Lookups) в Django ORM. Позволяет искать 
# или фильтровать данные через связанные 
# таблицы 
#(ForeignKey)