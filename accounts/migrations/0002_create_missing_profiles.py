from django.db import migrations


def create_missing_profiles(apps, schema_editor):
    """Users created before the post_save signal existed get an empty profile."""
    User = apps.get_model('auth', 'User')
    Profile = apps.get_model('accounts', 'Profile')
    for user in User.objects.filter(profile__isnull=True):
        Profile.objects.create(user=user)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(create_missing_profiles, migrations.RunPython.noop),
    ]
