/* ==========================================================================
   Tasks: shared task components (used on Today, Month and Tasks pages)
   and the To-do List page itself.
   ========================================================================== */
const BloomTasks = (() => {
  const { el, api, toast, PRIORITY } = Bloom;

  /**
   * One task row: heart checkbox, title, date/subject/priority, "→ завтра", ✕.
   * onChange(kind, task) is called after every successful change:
   * kind is 'toggled', 'updated', 'moved' or 'deleted'.
   */
  function item(task, { onChange = () => {}, showDate = true } = {}) {
    const li = el('li', { class: 'task' + (task.is_done ? ' done' : ''), dataset: { id: task.id } });

    const heart = Bloom.heartButton({
      checked: task.is_done,
      label: `Выполнено: ${task.title}`,
      onToggle: async () => {
        const updated = await api(`tasks/${task.id}/toggle/`, { method: 'POST' });
        Object.assign(task, updated);
        li.classList.toggle('done', task.is_done);
        onChange('toggled', task);
      },
    });

    const priority = PRIORITY[task.priority];
    const meta = el('div', { class: 'task-meta' },
      showDate ? el('span', { class: 'badge' }, Bloom.formatDate(task.date, { day: 'numeric', month: 'short' })) : null,
      task.subject_name ? el('span', { class: 'badge dot', style: `--dot:${task.subject_color}` }, task.subject_name) : null,
      el('span', { class: 'badge' + (task.priority === 'high' ? ' high' : ''), title: `Приоритет: ${priority.label}` },
        priority.emoji, ' ', priority.label),
    );
    const body = el('div', {
      class: 'task-body', tabindex: '0', role: 'button', 'aria-label': `Редактировать: ${task.title}`,
      onclick: () => openEditor(task, { onChange }),
      onkeydown: (event) => { if (event.key === 'Enter') openEditor(task, { onChange }); },
    }, el('div', { class: 'task-title' }, task.title), meta);

    const actions = el('div', { class: 'actions' });
    if (!task.is_done) {
      actions.append(el('button', {
        type: 'button', class: 'icon-btn', title: 'Перенести на завтра', 'aria-label': `Перенести на завтра: ${task.title}`,
        onclick: async (event) => {
          event.currentTarget.disabled = true;
          try {
            const moved = await api(`tasks/${task.id}/move-tomorrow/`, { method: 'POST' });
            Object.assign(task, moved);
            toast(`Перенесено на ${Bloom.formatDate(task.date)} 🌙`);
            onChange('moved', task);
          } catch (error) {
            toast(error.message, 'error');
            event.currentTarget.disabled = false;
          }
        },
      }, '→'));
    }
    actions.append(el('button', {
      type: 'button', class: 'icon-btn delete', title: 'Удалить', 'aria-label': `Удалить: ${task.title}`,
      onclick: async (event) => {
        event.currentTarget.disabled = true;
        try {
          await api(`tasks/${task.id}/`, { method: 'DELETE' });
          li.remove();
          onChange('deleted', task);
        } catch (error) {
          toast(error.message, 'error');
          event.currentTarget.disabled = false;
        }
      },
    }, '✕'));

    li.append(heart, body, actions);
    return li;
  }

  // ---------- edit dialog -------------------------------------------------

  let subjectsCache = null;
  async function subjects() {
    if (!subjectsCache) subjectsCache = await Bloom.getAll('subjects/');
    return subjectsCache;
  }

  async function openEditor(task, { onChange = () => {} } = {}) {
    const dialog = document.getElementById('task-dialog');
    if (!dialog) return;
    const form = dialog.querySelector('form');
    Bloom.clearFormError(form);
    await Bloom.fillSubjectSelect(form.elements.subject, { subjects: await subjects() });
    form.elements.title.value = task.title;
    form.elements.description.value = task.description || '';
    form.elements.date.value = task.date;
    form.elements.priority.value = task.priority;
    form.elements.subject.value = task.subject || '';

    form.onsubmit = (event) => {
      event.preventDefault();
      Bloom.busy(form, async () => {
        const values = Bloom.formValues(form);
        values.description = values.description || '';
        const updated = await api(`tasks/${task.id}/`, { method: 'PATCH', body: values });
        Object.assign(task, updated);
        dialog.close();
        toast('Сохранено 💗');
        onChange('updated', task);
      });
    };
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.showModal();
    form.elements.title.focus();
  }

  // ---------- quick add ---------------------------------------------------

  /**
   * Hook up a form with a "title" input (and optional date/priority/subject).
   * defaults() returns extra fields, e.g. {date: '2026-11-02'}.
   */
  function bindQuickAdd(form, { defaults = () => ({}), onCreated = () => {} }) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = { ...defaults(), ...Bloom.formValues(form) };
      if (!values.title || !values.title.trim()) {
        form.elements.title.focus();
        return;
      }
      if (!values.date) values.date = Bloom.iso(Bloom.today());
      Bloom.busy(form, async () => {
        const task = await api('tasks/', { method: 'POST', body: values });
        form.elements.title.value = '';
        form.elements.title.focus();
        onCreated(task);
      });
    });
  }

  /** Confetti when every task of a non-empty list is done. */
  function celebrateIfAllDone(tasks) {
    if (tasks.length && tasks.every((task) => task.is_done)) {
      Bloom.confetti();
      toast('Все задачи на сегодня сделаны! 🌷');
    }
  }

  return { item, openEditor, bindQuickAdd, celebrateIfAllDone, subjects };
})();


/* ---------- To-do List page (/tasks/) -------------------------------- */
(() => {
  const page = document.getElementById('tasks-page');
  if (!page) return;
  const { el, api, $ } = Bloom;

  const list = $('#task-list');
  const moreButton = $('#load-more');
  const summary = $('#tasks-summary');
  const filtersForm = $('#task-filters');
  const addForm = $('#task-add');
  let nextUrl = null;
  let view = 'today';
  let shownTasks = [];

  function query() {
    const params = new URLSearchParams();
    const today = Bloom.today();
    if (view === 'today') params.set('date', Bloom.iso(today));
    if (view === 'week') {
      const monday = Bloom.monday(today);
      params.set('date_from', Bloom.iso(monday));
      params.set('date_to', Bloom.iso(Bloom.addDays(monday, 6)));
    }
    if (view === 'overdue') params.set('overdue', 'true');
    const values = Bloom.formValues(filtersForm);
    for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
    return 'tasks/?' + params.toString();
  }

  async function load(append = false) {
    if (!append) { Bloom.loading(list); shownTasks = []; }
    moreButton.hidden = true;
    try {
      const data = await api(append ? nextUrl : query());
      if (!append) list.replaceChildren();
      shownTasks.push(...data.results);
      data.results.forEach((task) => list.append(BloomTasks.item(task, { onChange })));
      nextUrl = data.next ? new URL(data.next).pathname + new URL(data.next).search : null;
      moreButton.hidden = !nextUrl;
      summary.textContent = `${data.count} ${Bloom.plural(data.count, ['задача', 'задачи', 'задач'])}`;
      if (!data.count) {
        Bloom.empty(list, view === 'overdue' ? '🎉' : '🌱',
          view === 'overdue' ? 'Просроченных задач нет!' : 'Здесь пока пусто. Добавь первую задачу!');
      }
    } catch (error) {
      Bloom.failed(list, error);
    }
  }

  function onChange(kind, task) {
    if (kind === 'toggled' && view === 'today') BloomTasks.celebrateIfAllDone(shownTasks);
    if (kind === 'moved' || kind === 'updated' || kind === 'deleted') load();
  }

  page.querySelectorAll('[data-view]').forEach((chip) => {
    chip.addEventListener('click', () => {
      view = chip.dataset.view;
      page.querySelectorAll('[data-view]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      load();
    });
  });

  let searchTimer;
  filtersForm.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => load(), 300); });
  filtersForm.addEventListener('submit', (event) => { event.preventDefault(); load(); });
  moreButton.addEventListener('click', () => load(true));

  BloomTasks.bindQuickAdd(addForm, { onCreated: () => { Bloom.toast('Задача добавлена 🌷'); load(); } });

  (async () => {
    addForm.elements.date.value = Bloom.iso(Bloom.today());
    try {
      const subjects = await BloomTasks.subjects();
      await Bloom.fillSubjectSelect(addForm.elements.subject, { subjects });
      await Bloom.fillSubjectSelect(filtersForm.elements.subject, { subjects, emptyLabel: 'Все предметы' });
    } catch (error) { Bloom.toast(error.message, 'error'); }
    load();
  })();
})();
