
from django.conf import settings
from django.db import models


class Subject(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="subjects", )
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=20, default="#FF0080")
    teacher = models.CharField(max_length=150, blank=True)
    room = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "name"],
                name="unique_subject_name_per_user",), ]
    def __str__(self):
        return self.name


class Deadline(models.Model):
    KIND_CHOICES = [
        ("exam", "Exam"), ("test", "Test"),
        ("coursework", "Coursework"), ("homework", "Homework"),]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="deadlines", )
    subject = models.ForeignKey( Subject,
        on_delete=models.CASCADE, related_name="deadlines",
    )
    title = models.CharField(max_length=200)
    kind = models.CharField(
        max_length=20,
        choices=KIND_CHOICES,
    )
    due_date = models.DateField()

    class Meta:
        ordering = ["due_date"]

    def __str__(self):
        return f"{self.title} - {self.subject.name}"


class ScheduleSlot(models.Model):
    WEEKDAY_CHOICES = [
        (0, "Monday"),
        (1, "Tuesday"),
        (2, "Wednesday"),
        (3, "Thursday"),
        (4, "Friday"),
        (5, "Saturday"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="schedule_slots",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="schedule_slots",
    )
    weekday = models.PositiveSmallIntegerField(
        choices=WEEKDAY_CHOICES,
    )
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        ordering = ["weekday", "start_time"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(weekday__lte=5),
                name="schedule_weekday_between_0_and_5",
            ),
            models.CheckConstraint(
                condition=models.Q(start_time__lt=models.F("end_time")),
                name="schedule_start_before_end",
            ),
        ]

    def __str__(self):
        return f"{self.subject.name} - {self.get_weekday_display()}"
