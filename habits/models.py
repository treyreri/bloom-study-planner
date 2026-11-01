from django.conf import settings
from django.db import models


class Habit(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,related_name="habits",)
    title = models.CharField(max_length=150)
    emoji = models.CharField(max_length=20, default="🌷")
    is_active = models.BooleanField(default=True)
    class Meta:
        ordering = ["id"]
    def __str__(self):
        return self.title


class HabitCheck(models.Model):
    habit = models.ForeignKey(
        Habit, on_delete=models.CASCADE, related_name="checks",)
    date = models.DateField()
    class Meta:
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["habit", "date"],
                name="unique_habit_check_per_day", ),]
    def __str__(self):
        return f"{self.habit.title} - {self.date}"
