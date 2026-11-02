"""
Business rules of the planner, kept in one place so that the API,
the dashboard and the management command all use the same logic.
"""
from django.db.models import Count, Q
from django.utils import timezone

from .models import MonthPlan, Quote

MONTH_NAMES = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

# Flower stages from the specification (section 3.8).
# Each pair is (minimum percent, stage); checked from the top.
STAGE_THRESHOLDS = [
    (80, 'bouquet'),
    (50, 'bud'),
    (25, 'stem'),
    (0, 'seedling'),
]
STAGE_EMOJI = {
    'seedling': '🌱',
    'stem': '🌿',
    'bud': '🌷',
    'bouquet': '💐',
}

FALLBACK_QUOTE = {'text': 'Маленькие шаги каждый день превращаются в большой сад.', 'author': 'Bloom'}


def completion_percent(done, total):
    """Percent of finished tasks as a float (0 when there are no tasks)."""
    if not total:
        return 0.0
    return done * 100 / total


def stage_for_percent(percent):
    """0–24% seedling, 25–49% stem, 50–79% bud, 80–100% bouquet."""
    for minimum, stage in STAGE_THRESHOLDS:
        if percent >= minimum:
            return stage
    return 'seedling'


def with_progress(queryset):
    """Add total_tasks and done_tasks to every MonthPlan, counted in the database."""
    return queryset.annotate(
        total_tasks=Count('tasks'),
        done_tasks=Count('tasks', filter=Q(tasks__is_done=True)),
    )


def month_progress(plan):
    """Progress dict for one MonthPlan (uses annotations when they are present)."""
    total = getattr(plan, 'total_tasks', None)
    done = getattr(plan, 'done_tasks', None)
    if total is None or done is None:
        counts = plan.tasks.aggregate(
            total=Count('id'), done=Count('id', filter=Q(is_done=True)))
        total, done = counts['total'], counts['done']

    percent = completion_percent(done, total)
    stage = plan.final_stage or stage_for_percent(percent)
    return {
        'total': total,
        'done': done,
        'percent': round(percent),
        'stage': stage,
        'emoji': STAGE_EMOJI[stage],
        'is_final': plan.final_stage is not None,
    }


def is_month_finished(year, month, today=None):
    today = today or timezone.localdate()
    return (year, month) < (today.year, today.month)


def default_month_title(year, month):
    return f'{MONTH_NAMES[month - 1]} {year}'


def get_or_create_month_plan(user, day):
    """MonthPlan that contains `day`; created with a default title when missing."""
    plan, _ = MonthPlan.objects.get_or_create(
        user=user, year=day.year, month=day.month,
        defaults={'title': default_month_title(day.year, day.month)},
    )
    return plan


def lock_finished_months(user=None, today=None):
    """
    Save the final flower stage of every month that has already ended.
    After this the bouquet no longer changes, even if old tasks are edited.
    Returns the number of months that were locked.
    """
    today = today or timezone.localdate()
    plans = MonthPlan.objects.filter(final_stage__isnull=True).filter(
        Q(year__lt=today.year) | Q(year=today.year, month__lt=today.month))
    if user is not None:
        plans = plans.filter(user=user)

    locked = 0
    for plan in with_progress(plans):
        plan.final_stage = stage_for_percent(
            completion_percent(plan.done_tasks, plan.total_tasks))
        plan.save(update_fields=['final_stage'])
        locked += 1
    return locked


def quote_of_the_day(today=None):
    """The same quote for the whole day, a different one the next day."""
    today = today or timezone.localdate()
    count = Quote.objects.count()
    if count == 0:
        return FALLBACK_QUOTE
    quote = Quote.objects.order_by('id')[today.toordinal() % count]
    return {'text': quote.text, 'author': quote.author}
