from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Profile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_profile_for_new_user(sender, instance, created, raw=False, **kwargs):
    """Every user gets a Profile: via the site, the API, the admin or createsuperuser.

    raw=True means the user comes from a fixture (loaddata);
    the fixture contains its own profiles, so nothing is created here.
    """
    if created and not raw:
        Profile.objects.get_or_create(user=instance)
