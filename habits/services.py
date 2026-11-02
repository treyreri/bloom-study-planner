from datetime import timedelta

from django.utils import timezone

ONE_DAY = timedelta(days=1)


def current_streak(habit, today=None):
    """
    Number of days in a row the habit was checked, ending today.
    If today is not checked yet, the streak ending yesterday still counts,
    so it does not "break" in the morning before the user ticks the habit.
    """
    today = today or timezone.localdate()
    dates = (habit.checks.filter(date__lte=today)
             .order_by('-date').values_list('date', flat=True))

    streak = 0
    expected = today
    for checked_date in dates.iterator():
        if checked_date == expected:
            streak += 1
        elif streak == 0 and checked_date == today - ONE_DAY:
            streak = 1
        else:
            break  # a missed day ends the streak
        expected = checked_date - ONE_DAY
    return streak
