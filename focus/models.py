from django.conf import settings
from django.db import models


class PomodoroSession(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="pomodoro_sessions", )
    subject = models.ForeignKey(
        "study.Subject", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="pomodoro_sessions",)
    started_at = models.DateTimeField()
    duration_min = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["-started_at"]
        indexes = [ models.Index(fields=["user", "started_at"]), ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(duration_min__gt=0),
                name="pomodoro_duration_positive", ), ]
    def __str__(self):
        return f"{self.user.username} - {self.duration_min} min"
