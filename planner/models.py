
from django.conf import settings
from django.db import models

class MonthPlan(models.Model):
    FLOWER_STAGE_CHOICES = [
        ("seedling", "Seedling"), ("stem", "Stem"),
        ("bud", "Bud"), ("bouquet", "Bouquet"), ]

    user = models.ForeignKey( settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE, related_name="month_plans",)
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=150)
    main_goal = models.TextField(blank=True)
    focus_goals = models.JSONField(default=list, blank=True)
    final_stage = models.CharField(
        max_length=20, choices=FLOWER_STAGE_CHOICES,
        null=True, blank=True, )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "year", "month"],
                name="unique_month_plan_per_user",),
            models.CheckConstraint(
                condition=models.Q(month__gte=1, month__lte=12),
                name="month_plan_month_between_1_and_12", ), ]
        ordering = ["-year", "-month"]
    def __str__(self):
        return f"{self.title} ({self.month}/{self.year})"


class Task(models.Model):
    PRIORITY_CHOICES = [
        ("low", "Low"), ("mid", "Medium"), ("high", "High"),]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="tasks", )
    month_plan = models.ForeignKey(  MonthPlan,
        on_delete=models.CASCADE, related_name="tasks",)
    subject = models.ForeignKey(
        "study.Subject", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="tasks",)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date = models.DateField()
    priority = models.CharField( max_length=10,
        choices=PRIORITY_CHOICES, default="mid",)
    is_done = models.BooleanField(default=False)
    done_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date", "-priority", "created_at"]
        indexes = [
            models.Index(fields=["user", "date"]),
            models.Index(fields=["user", "is_done"]), ]
    def __str__(self):
        return self.title


class Quote(models.Model):
    text = models.TextField()
    author = models.CharField(max_length=150, blank=True)
    def __str__(self):
        return self.author or self.text[:50]
