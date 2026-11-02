/* Study (/study/): subjects, deadlines with countdown, weekly schedule */
(() => {
  const { el, api, $, toast } = Bloom;
  const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  let subjects = [];

  /**
   * A form that creates items, or edits one item after startEdit(item).
   * Used for subjects and deadlines.
   */
  function editableForm(form, { endpoint, addLabel, toValues, fill, afterSave }) {
    const submit = form.querySelector('[type="submit"]');
    const cancel = form.querySelector('[data-cancel]');
    let editingId = null;

    function stopEdit() {
      editingId = null;
      form.reset();
      submit.textContent = addLabel;
      cancel.hidden = true;
      Bloom.clearFormError(form);
    }
    cancel.addEventListener('click', stopEdit);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      Bloom.busy(form, async () => {
        const body = toValues(Bloom.formValues(form));
        if (editingId) await api(`${endpoint}${editingId}/`, { method: 'PATCH', body });
        else await api(endpoint, { method: 'POST', body });
        toast(editingId ? 'Сохранено 💗' : 'Добавлено 🌷');
        stopEdit();
        await afterSave();
      });
    });

    return {
      startEdit(item) {
        editingId = item.id;
        fill(item);
        submit.textContent = 'Сохранить';
        cancel.hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        form.querySelector('input').focus();
      },
    };
  }

  function deleteButton(label, url, after) {
    return Bloom.confirmClick(
      el('button', { type: 'button', class: 'icon-btn delete', 'aria-label': `Удалить: ${label}`, title: 'Удалить' }, '✕'),
      async () => { await api(url, { method: 'DELETE' }); toast('Удалено'); await after(); });
  }

  // ---------- subjects ---------------------------------------------------

  const subjectForm = $('#subject-form');
  const subjectEditor = editableForm(subjectForm, {
    endpoint: 'subjects/',
    addLabel: 'Добавить предмет',
    toValues: (v) => ({ name: v.name || '', color: v.color, teacher: v.teacher || '', room: v.room || '' }),
    fill: (s) => {
      subjectForm.elements.name.value = s.name;
      subjectForm.elements.color.value = s.color;
      subjectForm.elements.teacher.value = s.teacher;
      subjectForm.elements.room.value = s.room;
    },
    afterSave: loadAll,
  });

  function renderSubjects() {
    const list = $('#subject-list');
    if (!subjects.length) { Bloom.empty(list, '📚', 'Добавь свои предметы — они понадобятся для задач, дедлайнов и помодоро.'); return; }
    list.replaceChildren(...subjects.map((s) => el('li', {},
      el('span', { class: 'swatch', style: `--dot:${s.color}` }),
      el('div', { class: 'grow' },
        el('div', {}, s.name),
        el('div', { class: 'small muted' }, [s.teacher, s.room && `каб. ${s.room}`].filter(Boolean).join(' · '))),
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Редактировать: ${s.name}`, onclick: () => subjectEditor.startEdit(s) }, '✎'),
      deleteButton(s.name, `subjects/${s.id}/`, loadAll))));
  }

  // ---------- deadlines --------------------------------------------------

  const deadlineForm = $('#deadline-form');
  const deadlineEditor = editableForm(deadlineForm, {
    endpoint: 'deadlines/',
    addLabel: 'Добавить дедлайн',
    toValues: (v) => v,
    fill: (d) => {
      deadlineForm.elements.title.value = d.title;
      deadlineForm.elements.kind.value = d.kind;
      deadlineForm.elements.due_date.value = d.due_date;
      deadlineForm.elements.subject.value = d.subject;
    },
    afterSave: loadDeadlines,
  });

  function countdownText(d) {
    if (d.days_left < 0) return `прошло ${-d.days_left} ${Bloom.daysWord(-d.days_left)} назад`;
    if (d.days_left === 0) return 'сегодня! 🌹';
    return `осталось ${d.days_left} ${Bloom.daysWord(d.days_left)}`;
  }

  async function loadDeadlines() {
    const list = $('#deadline-list');
    try {
      const [upcoming, all] = await Promise.all([api('deadlines/upcoming/'), Bloom.getAll('deadlines/')]);
      const upcomingBox = $('#upcoming');
      upcomingBox.replaceChildren(...upcoming.map((d) => el('p', { class: 'countdown', style: 'margin:0 0 4px' },
        `До ${Bloom.KINDS_GENITIVE[d.kind]} по ${d.subject_name} `,
        d.days_left === 0 ? 'сегодня! 🌹' : ['осталось ', el('span', { class: 'num', style: 'color:var(--accent);font-weight:700' }, d.days_left), ` ${Bloom.daysWord(d.days_left)} 🌷`])));

      if (!all.length) { Bloom.empty(list, '🎈', 'Дедлайнов нет.'); return; }
      list.replaceChildren(...all.map((d) => el('li', { style: d.days_left < 0 ? 'opacity:.5' : '' },
        el('span', { class: 'swatch', style: `--dot:${d.subject_color}` }),
        el('div', { class: 'grow' },
          el('div', {}, d.title),
          el('div', { class: 'task-meta' },
            el('span', { class: 'badge' + (d.kind === 'exam' ? ' high' : '') }, Bloom.KINDS[d.kind]),
            el('span', { class: 'badge' }, d.subject_name),
            el('span', { class: 'small muted' }, `${Bloom.formatDate(d.due_date)} · ${countdownText(d)}`))),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': `Редактировать: ${d.title}`, onclick: () => deadlineEditor.startEdit(d) }, '✎'),
        deleteButton(d.title, `deadlines/${d.id}/`, loadDeadlines))));
    } catch (error) { Bloom.failed(list, error); }
  }

  // ---------- schedule ---------------------------------------------------

  const slotForm = $('#slot-form');
  slotForm.addEventListener('submit', (event) => {
    event.preventDefault();
    Bloom.busy(slotForm, async () => {
      await api('schedule/', { method: 'POST', body: Bloom.formValues(slotForm) });
      toast('Пара добавлена 📚');
      await loadSchedule();
    });
  });

  async function loadSchedule() {
    const grid = $('#week-grid');
    try {
      const slots = await Bloom.getAll('schedule/');
      const todayIndex = (Bloom.today().getDay() + 6) % 7;
      grid.replaceChildren(...WEEKDAYS.map((name, weekday) => {
        const daySlots = slots.filter((s) => s.weekday === weekday);
        return el('div', { class: 'week-day' + (weekday === todayIndex ? ' today' : '') },
          el('h3', {}, name),
          daySlots.length ? daySlots.map((s) => el('div', { class: 'slot', style: `--dot:${s.subject_color}` },
            el('div', { class: 'grow' },
              el('div', { class: 'num small' }, `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`),
              el('div', {}, s.subject_name),
              s.subject_room ? el('div', { class: 'small muted' }, `каб. ${s.subject_room}`) : null),
            deleteButton(s.subject_name, `schedule/${s.id}/`, loadSchedule)))
            : el('p', { class: 'small muted', style: 'text-align:center' }, 'свободно 🌿'));
      }));
    } catch (error) { Bloom.failed(grid, error); }
  }

  // ---------- load -------------------------------------------------------

  async function loadAll() {
    try {
      subjects = await Bloom.getAll('subjects/');
      renderSubjects();
      for (const select of [deadlineForm.elements.subject, slotForm.elements.subject]) {
        const previous = select.value;
        await Bloom.fillSubjectSelect(select, { subjects, emptyLabel: subjects.length ? 'Выбери предмет' : 'Сначала добавь предмет' });
        select.value = previous;
      }
    } catch (error) { Bloom.failed($('#subject-list'), error); }
    await Promise.all([loadDeadlines(), loadSchedule()]);
  }

  loadAll();
})();
