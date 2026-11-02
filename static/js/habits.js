/* Habit tracker (/habits/): month grid of heart checkboxes + streaks */
(() => {
  const { el, api, $, toast } = Bloom;
  const today = Bloom.today();
  const todayIso = Bloom.iso(today);
  let year = today.getFullYear();
  let month = today.getMonth() + 1;
  const box = $('#habit-grid');

  function streakText(n) {
    return n ? `🔥 ${n} ${Bloom.plural(n, ['день', 'дня', 'дней'])} подряд!` : '';
  }

  async function load() {
    $('#month-label').textContent = `${Bloom.MONTHS[month - 1]} ${year}`;
    Bloom.loading(box);
    try {
      render(await api(`habits/grid/?year=${year}&month=${month}`));
    } catch (error) { Bloom.failed(box, error); }
  }

  function render(data) {
    if (!data.habits.length) {
      Bloom.empty(box, '✨', 'Создай первую привычку: вода, спорт, чтение, слова на иностранном…');
      return;
    }
    const days = Array.from({ length: data.days_in_month }, (_, i) => Bloom.iso(new Date(year, month - 1, i + 1)));
    const head = el('tr', {},
      el('th', { class: 'name', scope: 'col' }, 'Привычка'),
      days.map((d, i) => el('th', { scope: 'col', class: d === todayIso ? 'today-col' : '' }, i + 1)),
      el('th', { scope: 'col' }, ''));

    const rows = data.habits.map((habit) => {
      const checked = new Set(habit.checked_dates);
      const streak = el('div', { class: 'streak small' }, streakText(habit.streak));
      const cells = days.map((d) => el('td', {}, Bloom.heartButton({
        checked: checked.has(d),
        disabled: d > todayIso,
        label: `${habit.title}, ${Bloom.formatDate(d)}`,
        onToggle: async () => {
          const result = await api(`habits/${habit.id}/check/`, { method: 'POST', body: { date: d } });
          streak.textContent = streakText(result.streak);
        },
      })));

      const archive = el('button', {
        type: 'button', class: 'icon-btn small',
        title: habit.is_active ? 'В архив' : 'Вернуть из архива',
        'aria-label': `${habit.is_active ? 'В архив' : 'Вернуть'}: ${habit.title}`,
        onclick: async () => {
          try {
            await api(`habits/${habit.id}/`, { method: 'PATCH', body: { is_active: !habit.is_active } });
            load();
          } catch (error) { toast(error.message, 'error'); }
        },
      }, habit.is_active ? '🗄' : '↺');
      const remove = Bloom.confirmClick(
        el('button', { type: 'button', class: 'icon-btn delete', title: 'Удалить', 'aria-label': `Удалить: ${habit.title}` }, '✕'),
        async () => { await api(`habits/${habit.id}/`, { method: 'DELETE' }); toast('Привычка удалена'); load(); });

      return el('tr', { class: habit.is_active ? '' : 'inactive' },
        el('th', { class: 'name', scope: 'row' }, el('div', {}, habit.emoji, ' ', habit.title), streak),
        cells,
        el('td', { style: 'white-space:nowrap' }, archive, remove));
    });

    box.replaceChildren(el('table', { class: 'habit-grid' }, el('thead', {}, head), el('tbody', {}, rows)));
    const todayHeader = box.querySelector('.today-col');
    if (todayHeader) todayHeader.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  const form = $('#habit-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Bloom.formValues(form);
    if (!values.title) { form.elements.title.focus(); return; }
    Bloom.busy(form, async () => {
      await api('habits/', { method: 'POST', body: values });
      form.elements.title.value = '';
      toast('Привычка добавлена ✨');
      load();
    });
  });

  function shift(delta) {
    month += delta;
    if (month === 0) { month = 12; year -= 1; }
    if (month === 13) { month = 1; year += 1; }
    load();
  }
  $('#prev-month').addEventListener('click', () => shift(-1));
  $('#next-month').addEventListener('click', () => shift(1));

  load();
})();
