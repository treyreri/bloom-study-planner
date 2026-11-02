from django.core.management.base import BaseCommand

from planner.services import lock_finished_months


class Command(BaseCommand):
    help = 'Save the final flower stage (bouquet) of every month that has ended.'

    def handle(self, *args, **options):
        locked = lock_finished_months()
        self.stdout.write(self.style.SUCCESS(f'Locked {locked} finished month(s).'))
