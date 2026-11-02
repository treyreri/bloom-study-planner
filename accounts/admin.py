from django.contrib import admin
from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "accent_color")
    list_filter = ("accent_color",)
    search_fields = ("user__username", "user__email")
