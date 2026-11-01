from django.contrib import admin
from .models import MonthPlan, Task, Quote


admin.site.register(MonthPlan)
admin.site.register(Task)
admin.site.register(Quote)
