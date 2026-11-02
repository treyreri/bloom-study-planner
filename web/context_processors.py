# One list of pages used by both the desktop sidebar and the mobile menu.
# (url name, label, icon, shown in the mobile bottom bar?)
NAV_ITEMS = [
    ('today', 'Сегодня', '🏠', True),
    ('month', 'Мой месяц', '🗓️', True),
    ('tasks', 'Задачи', '💗', True),
    ('study', 'Учёба', '📚', False),
    ('habits', 'Привычки', '✨', False),
    ('focus', 'Помодоро', '⏳', True),
    ('diary', 'Дневник', '💌', False),
    ('garden', 'Мой сад', '🌸', False),
    ('profile', 'Профиль', '🎀', False),
]


def navigation(request):
    items = [
        {'name': name, 'label': label, 'icon': icon, 'in_bar': in_bar}
        for name, label, icon, in_bar in NAV_ITEMS
    ]
    return {'nav_items': items}
