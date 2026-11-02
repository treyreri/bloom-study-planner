/* Weekly reflection diary (/diary/): one entry per week (week starts on Monday) */
(() => {
  const { el, api, $, toast } = Bloom;
  const MOODS = { 1: '😢', 2: '😕', 3: '😐', 4: '🙂', 5: '🥰' };
  const form = $('#reflection-form');
  const feed = $('#reflection-feed');
  let reflections = [];

  const current = () => reflections.find((r) => r.week_start === form.elements.week_start.value);

  /** Snap any chosen date to the Monday of its week and show the existing entry. */
  function selectWeek(value) {
    const monday = Bloom.monday(value ? Bloom.parseDate(value) : Bloom.today());
    form.elements.week_start.value = Bloom.iso(monday);
    $('#week-range').textContent =
      `${Bloom.formatDate(monday)} — ${Bloom.formatDate(Bloom.addDays(monday, 6))}`;

    const entry = current();
    form.querySelectorAll('input[name="mood"]').forEach((radio) => {
      radio.checked = entry ? Number(radio.value) === entry.mood : false;
    });
    form.elements.proud_of.value = entry ? entry.proud_of : '';
    form.elements.failed.value = entry ? entry.failed : '';
    form.elements.carry_over.value = entry ? entry.carry_over : '';
    $('#reflection-submit').textContent = entry ? 'Обновить запись' : 'Сохранить';
    Bloom.clearFormError(form);
  }

  form.elements.week_start.addEventListener('change', (event) => selectWeek(event.target.value));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Bloom.formValues(form);
    if (!values.mood) {
      Bloom.showFormError(form, new Error('Выбери настроение недели.'));
      return;
    }
    const body = {
      week_start: values.week_start,
      mood: Number(values.mood),
      proud_of: values.proud_of || '',
      failed: values.failed || '',
      carry_over: values.carry_over || '',
    };
    const entry = current();
    Bloom.busy(form, async () => {
      if (entry) await api(`reflections/${entry.id}/`, { method: 'PATCH', body });
      else await api('reflections/', { method: 'POST', body });
      toast('Запись сохранена 💌');
      await load(body.week_start);
    });
  });

  function renderFeed() {
    if (!reflections.length) {
      Bloom.empty(feed, '💌', 'Здесь появятся твои рефлексии. Начни с этой недели!');
      return;
    }
    feed.replaceChildren(...reflections.map((r) => {
      const monday = Bloom.parseDate(r.week_start);
      const parts = [
        ['Чем горжусь', r.proud_of], ['Что не получилось', r.failed], ['Что переношу', r.carry_over],
      ].filter(([, text]) => text);
      return el('article', { class: 'diary-entry' },
        el('h3', {},
          el('span', {}, `${Bloom.formatDate(monday)} — ${Bloom.formatDate(Bloom.addDays(monday, 6))}`),
          el('span', { 'aria-label': `Настроение ${r.mood} из 5` }, MOODS[r.mood])),
        parts.length
          ? el('dl', {}, parts.map(([title, text]) => [el('dt', {}, title), el('dd', {}, text)]))
          : el('p', { class: 'muted' }, 'Без заметок.'),
        el('div', { class: 'dialog-actions' },
          el('button', {
            type: 'button', class: 'btn ghost small',
            onclick: () => { selectWeek(r.week_start); form.scrollIntoView({ behavior: 'smooth' }); },
          }, 'Редактировать'),
          Bloom.confirmClick(el('button', { type: 'button', class: 'btn ghost small' }, 'Удалить'),
            async () => { await api(`reflections/${r.id}/`, { method: 'DELETE' }); toast('Запись удалена'); load(); })));
    }));
  }

  async function load(week) {
    try {
      reflections = await Bloom.getAll('reflections/');
      renderFeed();
    } catch (error) { Bloom.failed(feed, error); }
    selectWeek(week || form.elements.week_start.value || null);
  }

  load();
})();
