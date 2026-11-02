/* Today dashboard (/today/): everything comes from GET /api/v1/dashboard/ */
(() => {
  const { el, api, $ } = Bloom;
  const flowerBox = $('#flower');
  const taskList = $('#today-tasks');
  let tasks = [];

  function renderGreeting(data) {
    const hour = new Date().getHours();
    const hello = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Привет' : 'Добрый вечер';
    $('#greeting').textContent = `${hello}, ${data.name}! 🌷`;
    $('#today-date').textContent = Bloom.formatDate(data.date, { weekday: 'long', day: 'numeric', month: 'long' });
    $('#quote').replaceChildren(...[
      el('p', {}, `«${data.quote.text}»`),
      data.quote.author ? el('footer', {}, '— ', data.quote.author) : null,
    ].filter(Boolean));
  }

  function renderTasks() {
    const done = tasks.filter((t) => t.is_done).length;
    $('#tasks-count').textContent = tasks.length ? `${done} из ${tasks.length}` : '';
    if (!tasks.length) {
      Bloom.empty(taskList, '🌱', 'На сегодня задач нет. Добавь первую!');
      return;
    }
    taskList.replaceChildren(...tasks.map((task) => BloomTasks.item(task, { onChange, showDate: false })));
  }

  async function onChange(kind, task) {
    if (kind === 'deleted' || kind === 'moved' || (kind === 'updated' && task.date !== Bloom.iso(Bloom.today()))) {
      tasks = tasks.filter((t) => t.id !== task.id);
    }
    renderTasks();
    if (kind === 'toggled' && task.is_done) BloomTasks.celebrateIfAllDone(tasks);
    refreshFlower();
  }

  async function refreshFlower() {
    try {
      const data = await api('dashboard/');
      Bloom.renderFlower(flowerBox, data.month.progress, flowerBox.dataset.stage);
    } catch (error) { /* the flower will update on the next page load */ }
  }

  function renderDeadline(deadline) {
    const box = $('#deadline');
    if (!deadline) {
      Bloom.empty(box, '🎈', 'Дедлайнов не видно — можно выдохнуть.');
      return;
    }
    const kind = Bloom.KINDS_GENITIVE[deadline.kind];
    const text = deadline.days_left === 0
      ? el('p', { class: 'countdown' }, `Сегодня ${Bloom.KINDS[deadline.kind]} по ${deadline.subject_name}! 🌹`)
      : el('p', { class: 'countdown' },
          `До ${kind} по ${deadline.subject_name} осталось `,
          el('span', { class: 'big' }, deadline.days_left), ' ',
          Bloom.daysWord(deadline.days_left), ' 🌷');
    box.replaceChildren(text,
      el('span', { class: 'badge dot', style: `--dot:${deadline.subject_color}` }, deadline.title),
      ' ', el('span', { class: 'muted small' }, Bloom.formatDate(deadline.due_date)));
  }

  function renderHabits(habits) {
    const list = $('#today-habits');
    if (!habits.length) {
      list.replaceChildren(el('li', { class: 'muted' }, 'Привычек пока нет. ',
        el('a', { href: '/habits/' }, 'Создать')));
      return;
    }
    list.replaceChildren(...habits.map((habit) => {
      const streak = el('span', { class: 'streak small' }, habit.streak ? `🔥 ${habit.streak}` : '');
      return el('li', {},
        Bloom.heartButton({
          checked: habit.checked,
          label: `Отметить привычку: ${habit.title}`,
          onToggle: async () => {
            const result = await api(`habits/${habit.id}/check/`, { method: 'POST' });
            streak.textContent = result.streak ? `🔥 ${result.streak}` : '';
          },
        }),
        el('span', { class: 'grow' }, habit.emoji, ' ', habit.title),
        streak);
    }));
  }

  BloomTasks.bindQuickAdd($('#today-add'), {
    onCreated: (task) => { tasks.push(task); renderTasks(); refreshFlower(); },
  });

  (async () => {
    Bloom.loading(taskList);
    try {
      const data = await api('dashboard/');
      renderGreeting(data);
      tasks = data.tasks_today;
      renderTasks();
      Bloom.renderFlower(flowerBox, data.month.progress);
      renderDeadline(data.next_deadline);
      renderHabits(data.habits_today);
      $('#focus-today').textContent = data.focus_minutes_today;
      $('#focus-week').textContent = data.focus_minutes_week;
    } catch (error) {
      Bloom.failed(taskList, error);
    }
  })();
})();
