"""
Demo data for presenting Bloom.

    python manage.py seed_demo                 # create/refresh the "demo" user with dates around today
    python manage.py seed_demo --fixture planner/fixtures/demo.json
                                               # write the same data as a fixture (database unchanged)

All demo objects use primary keys from 9001, so they never overwrite real data.
"""
import calendar
import random
from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.core import serializers
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import Profile
from diary.models import WeeklyReflection
from focus.models import PomodoroSession
from habits.models import Habit, HabitCheck
from planner.models import MonthPlan, Quote, Task
from planner.services import completion_percent, default_month_title, stage_for_percent
from study.models import Deadline, ScheduleSlot, Subject

User = get_user_model()

DEMO_USERNAME = 'demo'
DEMO_PASSWORD = 'bloom-demo-2026'
FIRST_PK = 9001

QUOTES = [
    ('Маленькие шаги каждый день превращаются в большой сад.', 'Bloom'),
    ('Успех — это сумма небольших усилий, повторяющихся изо дня в день.', 'Роберт Кольер'),
    ('Не бойся медленно идти, бойся стоять на месте.', 'Китайская пословица'),
    ('Учиться — всё равно что грести против течения: перестанешь — и тебя отнесёт назад.', 'Бенджамин Бриттен'),
    ('Дисциплина — это мост между целями и достижениями.', 'Джим Рон'),
    ('Каждый эксперт когда-то был новичком.', 'Хелен Хейз'),
    ('Цветы не сравнивают себя с соседними — они просто цветут.', 'Дзен-мудрость'),
]

SUBJECTS = [
    ('SQL', '#FF0080', 'Иванова А. П.', '214'),
    ('Python', '#A8002E', 'Петров С. Н.', '301'),
    ('Английский', '#F48FA0', 'Smith J.', '105'),
    ('Математика', '#C77DFF', 'Соколова Е. В.', '220'),
]

TASK_TITLES = [
    'Конспект лекции', 'Решить задачи', 'Подготовить доклад', 'Повторить теорию',
    'Лабораторная работа', 'Прочитать главу', 'Выучить 20 слов', 'Сделать презентацию',
    'Написать эссе', 'Разобрать ошибки', 'Сходить в библиотеку', 'Тест по теме',
]


class Command(BaseCommand):
    help = 'Create demo data for the "demo" user (or write it to a fixture file).'

    def add_arguments(self, parser):
        parser.add_argument('--fixture', help='Write a fixture to this path instead of keeping the data.')

    def handle(self, *args, **options):
        fixture_path = options.get('fixture')
        with transaction.atomic():
            objects = self.build()
            if fixture_path:
                with open(fixture_path, 'w', encoding='utf-8') as file:
                    serializers.serialize('json', objects, indent=2, stream=file, ensure_ascii=False)
                transaction.set_rollback(True)   # leave the database untouched
                self.stdout.write(self.style.SUCCESS(f'Fixture written to {fixture_path}'))
                return
        self.stdout.write(self.style.SUCCESS(
            f'Demo data ready. Log in as "{DEMO_USERNAME}" / "{DEMO_PASSWORD}".'))

    # ------------------------------------------------------------------

    def build(self):
        rng = random.Random(42)                  # same demo data every time
        today = timezone.localdate()
        pk = iter(range(FIRST_PK, FIRST_PK + 100000))
        objects = []

        def keep(obj):
            objects.append(obj)
            return obj

        existing = User.objects.filter(username=DEMO_USERNAME).first()
        if existing and existing.pk != FIRST_PK:
            raise CommandError(f'A real user called "{DEMO_USERNAME}" already exists; it will not be touched.')
        if existing:
            existing.delete()                     # cascades to all old demo data
        Quote.objects.filter(pk__gte=FIRST_PK).delete()

        user = User(pk=FIRST_PK, username=DEMO_USERNAME, first_name='Алиса', email='demo@example.com')
        user.set_password(DEMO_PASSWORD)
        user.save()
        keep(user)
        # replace the profile made by the signal so it also gets a demo primary key
        Profile.objects.filter(user=user).delete()
        keep(Profile.objects.create(
            pk=next(pk), user=user, accent_color='pink',
            semester_goal='Закрыть сессию без троек и не забывать отдыхать 🌷'))

        for text, author in QUOTES:
            keep(Quote.objects.create(pk=next(pk), text=text, author=author))

        subjects = [keep(Subject.objects.create(pk=next(pk), user=user, name=name, color=color,
                                                teacher=teacher, room=room))
                    for name, color, teacher, room in SUBJECTS]
        sql, python, english, math = subjects

        # weekly schedule (Mon–Sat)
        pairs = [(0, sql, 9), (0, python, 10.75), (1, english, 9), (2, math, 12.5),
                 (2, sql, 14.25), (3, python, 9), (4, english, 10.75), (5, math, 10.75)]
        for weekday, subject, hour in pairs:
            start = time(int(hour), int(hour % 1 * 60))
            end = (datetime.combine(today, start) + timedelta(minutes=90)).time()
            keep(ScheduleSlot.objects.create(pk=next(pk), user=user, subject=subject,
                                             weekday=weekday, start_time=start, end_time=end))

        # deadlines
        for subject, title, kind, days in [
            (sql, 'Экзамен по SQL', 'exam', 12), (python, 'Курсовая: Django REST API', 'coursework', 20),
            (english, 'Эссе о путешествиях', 'homework', 3), (math, 'Зачёт по матанализу', 'test', 8),
            (english, 'Устный экзамен', 'exam', 30),
        ]:
            keep(Deadline.objects.create(pk=next(pk), user=user, subject=subject, title=title,
                                         kind=kind, due_date=today + timedelta(days=days)))

        # three finished months with different bouquets + the current month
        first_of_month = today.replace(day=1)
        for months_ago, done_share, title in [(3, .9, 'Старт семестра'), (2, .6, 'Октябрь — лабораторные'),
                                              (1, .35, 'Месяц коллоквиумов')]:
            day = first_of_month
            for _ in range(months_ago):
                day = (day - timedelta(days=1)).replace(day=1)
            plan = keep(MonthPlan.objects.create(
                pk=next(pk), user=user, year=day.year, month=day.month, title=title,
                main_goal='Не отставать от программы', focus_goals=['Сдавать лабы вовремя', 'Спорт 3 раза в неделю']))
            days_in_month = calendar.monthrange(day.year, day.month)[1]
            total = 20
            done = round(total * done_share)
            for i in range(total):
                task_day = day.replace(day=rng.randint(1, days_in_month))
                keep(self.task(pk, user, plan, rng, task_day, is_done=i < done, subjects=subjects))
            plan.final_stage = stage_for_percent(completion_percent(done, total))
            plan.save()

        plan = keep(MonthPlan.objects.create(
            pk=next(pk), user=user, year=today.year, month=today.month,
            title=f'{default_month_title(today.year, today.month).split()[0]} — сессия!',
            main_goal='Подготовиться к экзамену по SQL и сдать курсовую',
            focus_goals=['Каждый день 1 помодоро по SQL', '20 французских слов в день', 'Спать 8 часов']))
        days_in_month = calendar.monthrange(today.year, today.month)[1]
        for day_number in range(1, days_in_month + 1):
            task_day = today.replace(day=day_number)
            if task_day == today:
                continue
            for _ in range(rng.choice([0, 1, 1, 2, 3])):
                keep(self.task(pk, user, plan, rng, task_day, is_done=task_day < today and rng.random() < .8,
                               subjects=subjects))
        for title, subject, priority, done in [
            ('Повторить JOIN и GROUP BY', sql, 'high', True), ('Выучить 20 французских слов', None, 'mid', True),
            ('Дописать главу курсовой', python, 'high', False), ('Сходить в зал', None, 'low', False),
        ]:
            keep(Task.objects.create(pk=next(pk), user=user, month_plan=plan, subject=subject, title=title,
                                     date=today, priority=priority, is_done=done))

        # habits with a 7-day streak for water
        for title, emoji, chance in [('Выпить 8 стаканов воды', '💧', 1.0), ('20 французских слов', '🇫🇷', .7),
                                     ('Зал', '🏃‍♀️', .4)]:
            habit = keep(Habit.objects.create(pk=next(pk), user=user, title=title, emoji=emoji))
            for days_ago in range(1, 40):
                if (chance == 1.0 and days_ago <= 7) or (chance < 1.0 and rng.random() < chance):
                    keep(HabitCheck.objects.create(pk=next(pk), habit=habit,
                                                   date=today - timedelta(days=days_ago)))

        # pomodoro sessions over the last 10 days
        now = timezone.now()
        for days_ago in range(0, 10):
            for _ in range(rng.randint(1, 3)):
                started = now - timedelta(days=days_ago, hours=rng.randint(1, 8))
                keep(PomodoroSession.objects.create(pk=next(pk), user=user, subject=rng.choice(subjects),
                                                    started_at=started, duration_min=rng.choice([25, 25, 50])))

        # weekly reflections for the last 3 weeks
        monday = today - timedelta(days=today.weekday())
        for weeks_ago, mood, proud, failed, carry in [
            (1, 4, 'Сдала лабораторную по Python на отлично', 'Пропустила две тренировки', 'Подготовка к SQL'),
            (2, 3, 'Каждый день учила слова', 'Мало спала', 'Глава курсовой'),
            (3, 5, 'Закрыла все долги за месяц!', '', 'Начать курсовую'),
        ]:
            keep(WeeklyReflection.objects.create(
                pk=next(pk), user=user, week_start=monday - timedelta(weeks=weeks_ago), mood=mood,
                proud_of=proud, failed=failed, carry_over=carry))
        return objects

    def task(self, pk, user, plan, rng, day, is_done, subjects):
        done_at = timezone.make_aware(datetime.combine(day, time(18))) if is_done else None
        return Task.objects.create(
            pk=next(pk), user=user, month_plan=plan, title=rng.choice(TASK_TITLES),
            subject=rng.choice(subjects + [None]), date=day,
            priority=rng.choice(['low', 'mid', 'mid', 'high']), is_done=is_done, done_at=done_at)
