
from django.conf import settings
from django.db import models


class Profile(models.Model):
    ACCENT_COLOR_CHOICES = [ ("pink", "Pink"), ("lavender", "Lavender"), ("peach", "Peach"), ]
    user = models.OneToOneField( settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile",)
    avatar = models.ImageField( upload_to="avatars/", blank=True, null=True, )
    accent_color = models.CharField(
        max_length=20,
        choices=ACCENT_COLOR_CHOICES,
        default="pink",
    )
    semester_goal = models.TextField(blank=True)

    def __str__(self):
        return f"Profile of {self.user.username}"
