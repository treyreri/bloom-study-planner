/* My Month (/month/?year=2026&month=11): plan, calendar with hearts, flower, day tasks */
(() => {
  const { el, api, $ } = Bloom;
  const params = new URLSearchParams(location.search);
  const today = Bloom.today();
  let year = Number(params.get('year')) || today.getFullYear();
  let month = Number(params.get('month')) || today.getMonth() + 1;   // 1–12
  let plan = null;
  let selected = null;     // 'YYYY-MM-DD'
  let dayTasks = [];

  const calendar = $('#calendar');
  const planView = $('#plan-view');
  const planForm = $('#plan-form');
  const flowerBox = $('#flower');
  const dayList = $('#day-tasks');

  // ---------- plan -------------------------------------------------------

  async function loadPlan() {
    const data = await api(`months/?year=${year}&month=${month}`);
    plan = data.results[0] || null;
  }

  function renderPlan() {
    planForm.hidden = Boolean(plan);
    planView.hidden = !plan;
    if (!plan) {
      planForm.reset();
      planForm.elements.title.value = `${Bloom.MONTHS[month - 1]} ${year}`;
      $('#plan-title').textContent = 'Создать план месяца';
      $('#plan-cancel').hidden = true;
      Bloom.renderFlower(flowerBox, { total: 0, done: 0, percent: 0, stage: 'seedling' });
      return;
    }
    const goals = plan.focus_goals.length
      ? el('ul', { style: 'margin:4px 0 0;padding-left:20px' }, plan.focus_goals.map((g) => el('li', {}, g)))
      : el('p', { class: 'muted small' }, 'Фокус-целей пока нет.');
    planView.replaceChildren(...[
      el('div', { class: 'panel-head' },
        el('h2', {}, plan.title),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Редактировать план', onclick: editPlan }, '✎')),
      plan.main_goal ? el('p', {}, '🎯 ', plan.main_goal) : el('p', { class: 'muted' }, 'Главная цель не задана.'),
      el('strong', { class: 'small' }, 'Фокус-цели'), goals,
      plan.final_stage ? el('p', { class: 'small muted', style: 'margin-top:8px' }, 'Месяц закончился — букет сохранён в саду 💐') : null,
    ].filter(Boolean));
    Bloom.renderFlower(flowerBox, plan.progress, flowerBox.dataset.stage);
  }

  function editPlan() {
    planForm.elements.title.value = plan.title;
    planForm.elements.main_goal.value = plan.main_goal;
    [1, 2, 3].forEach((n) => { planForm.elements[`focus_${n}`].value = plan.focus_goals[n - 1] || ''; });
    $('#plan-title').textContent = 'Редактировать план';
    $('#plan-cancel').hidden = false;
    planView.hidden = true;
    planForm.hidden = false;
    planForm.elements.title.focus();
  }
  $('#plan-cancel').addEventListener('click', renderPlan);

  planForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Bloom.formValues(planForm);
    const body = {
      title: values.title || '',
      main_goal: values.main_goal || '',
      focus_goals: [values.focus_1, values.focus_2, values.focus_3].filter(Boolean),
    };
    Bloom.busy(planForm, async () => {
      plan = plan
        ? await api(`months/${plan.id}/`, { method: 'PATCH', body })
        : await api('months/', { method: 'POST', body: { ...body, year, month } });
      Bloom.toast('План сохранён 🗓️');
      renderPlan();
    });
  });

  // ---------- calendar ---------------------------------------------------

  async function renderCalendar() {
    const counts = {};
    if (plan) {
      const data = await api(`months/${plan.id}/calendar/`);
      data.days.forEach((d) => { counts[d.date] = d; });
    }
    const first = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const offset = (first.getDay() + 6) % 7;               // Monday first
    const cells = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => el('div', { class: 'dow', 'aria-hidden': 'true' }, d));
    for (let i = 0; i < offset; i++) cells.push(el('div', { class: 'day empty', 'aria-hidden': 'true' }));

    for (let day = 1; day <= daysInMonth; day++) {
      const date = Bloom.iso(new Date(year, month - 1, day));
      const info = counts[date] || { total: 0, done: 0 };
      const dots = el('span', { class: 'dots', 'aria-hidden': 'true' });
      const shown = Math.min(info.total, 6);
      for (let i = 0; i < shown; i++) {
        dots.append(i < info.done ? el('span', { class: 'done' }, '♥') : el('span', {}, '♡'));
      }
      if (info.total > 6) dots.append(el('span', {}, `+${info.total - 6}`));
      cells.push(el('button', {
        type: 'button',
        class: 'day' + (date === Bloom.iso(today) ? ' today' : ''),
        'aria-pressed': String(date === selected),
        'aria-label': `${Bloom.formatDate(date)}: ${info.total} задач, выполнено ${info.done}`,
        onclick: () => selectDay(date),
      }, el('span', { class: 'n' }, day), dots));
    }
    calendar.replaceChildren(...cells);
  }

  // ---------- selected day ----------------------------------------------

  async function selectDay(date) {
    selected = date;
    calendar.querySelectorAll('.day:not(.empty)').forEach((button, index) => {
      button.setAttribute('aria-pressed', String(Bloom.iso(new Date(year, month - 1, index + 1)) === date));
    });
    $('#day-title').textContent = `Задачи на ${Bloom.formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}`;
    Bloom.loading(dayList);
    try {
      dayTasks = await Bloom.getAll(`tasks/?date=${date}`);
      renderDayTasks();
    } catch (error) { Bloom.failed(dayList, error); }
  }

  function renderDayTasks() {
    if (!dayTasks.length) { Bloom.empty(dayList, '🌱', 'На этот день задач нет.'); return; }
    dayList.replaceChildren(...dayTasks.map((task) => BloomTasks.item(task, { onChange, showDate: false })));
  }

  async function onChange(kind, task) {
    if (kind !== 'toggled' && task.date !== selected) dayTasks = dayTasks.filter((t) => t.id !== task.id);
    if (kind === 'deleted') dayTasks = dayTasks.filter((t) => t.id !== task.id);
    renderDayTasks();
    if (kind === 'toggled' && task.is_done && selected === Bloom.iso(today)) BloomTasks.celebrateIfAllDone(dayTasks);
    await refresh();
  }

  BloomTasks.bindQuickAdd($('#day-add'), {
    defaults: () => ({ date: selected }),
    onCreated: async (task) => { dayTasks.push(task); renderDayTasks(); await refresh(); },
  });

  /** Reload plan progress + calendar after a task changed (a plan may have been created). */
  async function refresh() {
    try {
      await loadPlan();
      renderPlan();
      await renderCalendar();
    } catch (error) { Bloom.toast(error.message, 'error'); }
  }

  // ---------- month navigation -------------------------------------------

  async function show() {
    $('#month-label').textContent = `${Bloom.MONTHS[month - 1]} ${year}`;
    history.replaceState(null, '', `?year=${year}&month=${month}`);
    Bloom.loading(calendar);
    delete flowerBox.dataset.stage;
    try {
      await loadPlan();
      renderPlan();
      const isCurrent = year === today.getFullYear() && month === today.getMonth() + 1;
      selected = isCurrent ? Bloom.iso(today) : Bloom.iso(new Date(year, month - 1, 1));
      await renderCalendar();
      await selectDay(selected);
    } catch (error) { Bloom.failed(calendar, error); }
  }

  function shift(delta) {
    month += delta;
    if (month === 0) { month = 12; year -= 1; }
    if (month === 13) { month = 1; year += 1; }
    show();
  }
  $('#prev-month').addEventListener('click', () => shift(-1));
  $('#next-month').addEventListener('click', () => shift(1));

  show();
})();
