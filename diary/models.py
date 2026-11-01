from django.conf import settings
from django.db import models


class WeeklyReflection(models.Model):
    MOOD_CHOICES = [
        (1, "Very sad"),(2, "Sad"),
        (3, "Okay"),(4, "Happy"),
        (5, "Very happy"),]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,on_delete=models.CASCADE,
        related_name="weekly_reflections", )
    week_start = models.DateField()
    mood = models.PositiveSmallIntegerField( choices=MOOD_CHOICES,)
    proud_of = models.TextField(blank=True)
    failed = models.TextField(blank=True)
    carry_over = models.TextField(blank=True)

    class Meta:
        ordering = ["-week_start"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "week_start"],
                name="unique_reflection_per_user_per_week", ),
            models.CheckConstraint(
                condition=models.Q(mood__gte=1, mood__lte=5),
                name="reflection_mood_between_1_and_5", ), ]
    def __str__(self):
        return f"{self.user.username} - {self.week_start}"
