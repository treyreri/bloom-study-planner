/* My Month (/month/?year=2026&month=11): plan, calendar with hearts, flower, day tasks */
import { useEffect, useRef, useState } from 'react';
import { api, getAll } from '../api/client.js';
import { MONTHS, celebrateIfAllDone, formValues, formatDate, iso, pageTitle, toast, today } from '../lib/bloom.js';
import { Empty, Failed, Flower, FormError, Loading, useBusy, useFlower } from '../components/ui.jsx';
import { TaskDialog, TaskItem, useQuickAdd } from '../components/tasks.jsx';

const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const EMPTY_PROGRESS = { total: 0, done: 0, percent: 0, stage: 'seedling' };

export default function Month() {
  const start = today();
  const params = new URLSearchParams(window.location.search);
  const ym = useRef({
    year: Number(params.get('year')) || start.getFullYear(),
    month: Number(params.get('month')) || start.getMonth() + 1,   // 1–12
  });
  const [label, setLabel] = useState('');
  const [plan, setPlan] = useState(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formRound, setFormRound] = useState(0);   // a new round = a freshly reset form
  const [calendar, setCalendar] = useState({ state: 'loading' });
  const [selected, setSelected] = useState(null);   // 'YYYY-MM-DD'
  const [day, setDay] = useState({ state: 'idle', tasks: [], round: 0 });
  const [flower, showFlower] = useFlower();
  const selectedRef = useRef(null);
  const dayTasks = useRef([]);
  const planRef = useRef(null);
  const formRef = useRef(null);
  const dialog = useRef(null);
  const planBusy = useBusy();

  useEffect(() => { document.title = pageTitle('Мой месяц'); }, []);

  // ---------- plan -------------------------------------------------------

  async function loadPlan() {
    const { year, month } = ym.current;
    const data = await api(`months/?year=${year}&month=${month}`);
    planRef.current = data.results[0] || null;
    return planRef.current;
  }

  function renderPlan(current, { animate }) {
    setPlan(current);
    setPlanLoaded(true);
    setEditing(false);
    if (!current) {
      setFormRound((r) => r + 1);
      showFlower(EMPTY_PROGRESS, { animate: false });
      return;
    }
    showFlower(current.progress, { animate });
  }

  function editPlan() {
    const form = formRef.current;
    form.elements.title.value = plan.title;
    form.elements.main_goal.value = plan.main_goal;
    [1, 2, 3].forEach((n) => { form.elements[`focus_${n}`].value = plan.focus_goals[n - 1] || ''; });
    setEditing(true);
  }

  useEffect(() => {
    if (editing) formRef.current.elements.title.focus();
  }, [editing]);

  function savePlan(event) {
    event.preventDefault();
    const values = formValues(formRef.current);
    const body = {
      title: values.title || '',
      main_goal: values.main_goal || '',
      focus_goals: [values.focus_1, values.focus_2, values.focus_3].filter(Boolean),
    };
    const { year, month } = ym.current;
    planBusy.run(async () => {
      const saved = planRef.current
        ? await api(`months/${planRef.current.id}/`, { method: 'PATCH', body })
        : await api('months/', { method: 'POST', body: { ...body, year, month } });
      planRef.current = saved;
      toast('План сохранён 🗓️');
      renderPlan(saved, { animate: true });
    });
  }

  // ---------- calendar ---------------------------------------------------

  async function renderCalendar() {
    const counts = {};
    if (planRef.current) {
      const data = await api(`months/${planRef.current.id}/calendar/`);
      data.days.forEach((d) => { counts[d.date] = d; });
    }
    setCalendar({ state: 'ready', counts, ...ym.current });
  }

  // ---------- selected day ----------------------------------------------

  function renderDayTasks() {
    setDay((old) => ({ state: 'ready', tasks: [...dayTasks.current], round: old.round + 1 }));
  }

  async function selectDay(date) {
    selectedRef.current = date;
    setSelected(date);
    setDay((old) => ({ ...old, state: 'loading' }));
    try {
      dayTasks.current = await getAll(`tasks/?date=${date}`);
      renderDayTasks();
    } catch (error) { setDay((old) => ({ ...old, state: 'error', error })); }
  }

  async function onChange(kind, task) {
    const current = selectedRef.current;
    if (kind !== 'toggled' && task.date !== current) dayTasks.current = dayTasks.current.filter((t) => t.id !== task.id);
    if (kind === 'deleted') dayTasks.current = dayTasks.current.filter((t) => t.id !== task.id);
    renderDayTasks();
    if (kind === 'toggled' && task.is_done && current === iso(today())) celebrateIfAllDone(dayTasks.current);
    await refresh();
  }

  const quickAdd = useQuickAdd({
    defaults: () => ({ date: selectedRef.current }),
    onCreated: async (task) => { dayTasks.current.push(task); renderDayTasks(); await refresh(); },
  });

  /** Reload plan progress + calendar after a task changed (a plan may have been created). */
  async function refresh() {
    try {
      renderPlan(await loadPlan(), { animate: true });
      await renderCalendar();
    } catch (error) { toast(error.message, 'error'); }
  }

  // ---------- month navigation -------------------------------------------

  async function show() {
    const { year, month } = ym.current;
    setLabel(`${MONTHS[month - 1]} ${year}`);
    window.history.replaceState(window.history.state, '', `?year=${year}&month=${month}`);
    setCalendar({ state: 'loading' });
    try {
      renderPlan(await loadPlan(), { animate: false });
      const now = today();
      const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
      const first = isCurrent ? iso(now) : iso(new Date(year, month - 1, 1));
      selectedRef.current = first;
      setSelected(first);
      await renderCalendar();
      await selectDay(first);
    } catch (error) { setCalendar({ state: 'failed', error }); }
  }

  function shift(delta) {
    let { year, month } = ym.current;
    month += delta;
    if (month === 0) { month = 12; year -= 1; }
    if (month === 13) { month = 1; year += 1; }
    ym.current = { year, month };
    show();
  }

  useEffect(() => {
    show();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- render -------------------------------------------------------

  let cells;
  if (calendar.state === 'loading') cells = <Loading />;
  else if (calendar.state === 'failed') cells = <Failed error={calendar.error} />;
  else {
    const { year, month, counts } = calendar;
    const first = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const offset = (first.getDay() + 6) % 7;               // Monday first
    const todayIso = iso(today());
    cells = [
      ...DOW.map((d) => <div key={d} className="dow" aria-hidden="true">{d}</div>),
      ...Array.from({ length: offset }, (_, i) => <div key={`e${i}`} className="day empty" aria-hidden="true" />),
      ...Array.from({ length: daysInMonth }, (_, i) => {
        const date = iso(new Date(year, month - 1, i + 1));
        const info = counts[date] || { total: 0, done: 0 };
        const shown = Math.min(info.total, 6);
        return (
          <button
            key={date} type="button" className={'day' + (date === todayIso ? ' today' : '')}
            aria-pressed={String(date === selected)}
            aria-label={`${formatDate(date)}: ${info.total} задач, выполнено ${info.done}`}
            onClick={() => selectDay(date)}
          >
            <span className="n">{i + 1}</span>
            <span className="dots" aria-hidden="true">
              {Array.from({ length: shown }, (_, n) => (n < info.done
                ? <span key={n} className="done">♥</span>
                : <span key={n}>♡</span>))}
              {info.total > 6 && <span>{`+${info.total - 6}`}</span>}
            </span>
          </button>
        );
      }),
    ];
  }

  let dayContent = null;
  if (day.state === 'loading') dayContent = <Loading />;
  else if (day.state === 'error') dayContent = <Failed error={day.error} />;
  else if (day.state === 'ready') {
    dayContent = day.tasks.length
      ? day.tasks.map((task) => (
        <TaskItem key={`${day.round}-${task.id}`} task={task} isDone={task.is_done} onChange={onChange} showDate={false}
          onEdit={(t, cb) => dialog.current.open(t, cb)} />
      ))
      : <Empty icon="🌱">На этот день задач нет.</Empty>;
  }

  const formVisible = planLoaded && (!plan || editing);
  const { year, month } = ym.current;

  return (
    <>
      <div className="page-head">
        <h1>My Month 🗓️</h1>
        <div className="chips" role="group" aria-label="Выбор месяца">
          <button type="button" className="chip" id="prev-month" aria-label="Предыдущий месяц" onClick={() => shift(-1)}>←</button>
          <strong id="month-label" aria-live="polite" style={{ minWidth: '9em', textAlign: 'center', alignSelf: 'center' }}>{label}</strong>
          <button type="button" className="chip" id="next-month" aria-label="Следующий месяц" onClick={() => shift(1)}>→</button>
        </div>
      </div>

      <div className="grid-3">
        <section className="panel span-2" aria-labelledby="calendar-title">
          <h2 id="calendar-title" className="visually-hidden">Календарь</h2>
          <div className="calendar" id="calendar">{cells}</div>
          <p className="small muted" style={{ margin: '8px 0 0' }}>♥ — выполнено, ♡ — запланировано. Нажми на день, чтобы увидеть задачи.</p>
        </section>

        <div className="grid">
          <section className="card" aria-labelledby="plan-title">
            <div id="plan-view" hidden={planLoaded && (!plan || editing)}>
              {plan && (
                <>
                  <div className="panel-head">
                    <h2>{plan.title}</h2>
                    <button type="button" className="icon-btn" aria-label="Редактировать план" onClick={editPlan}>✎</button>
                  </div>
                  {plan.main_goal ? <p>🎯 {plan.main_goal}</p> : <p className="muted">Главная цель не задана.</p>}
                  <strong className="small">Фокус-цели</strong>
                  {plan.focus_goals.length
                    ? <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>{plan.focus_goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
                    : <p className="muted small">Фокус-целей пока нет.</p>}
                  {plan.final_stage && <p className="small muted" style={{ marginTop: '8px' }}>Месяц закончился — букет сохранён в саду 💐</p>}
                </>
              )}
            </div>
            <form id="plan-form" hidden={!formVisible} noValidate ref={formRef} onSubmit={savePlan} key={formRound}>
              <h2 id="plan-title">{!planLoaded ? 'План месяца' : editing ? 'Редактировать план' : 'Создать план месяца'}</h2>
              <div className="field">
                <label htmlFor="plan-title-input">Название</label>
                <input type="text" id="plan-title-input" name="title" maxLength="150" required placeholder="Ноябрь — сессия!"
                  defaultValue={planLoaded && !plan ? `${MONTHS[month - 1]} ${year}` : ''} />
              </div>
              <div className="field">
                <label htmlFor="plan-goal">Главная цель месяца</label>
                <textarea id="plan-goal" name="main_goal" rows="2"></textarea>
              </div>
              <fieldset style={{ border: 0, padding: 0, margin: '0 0 8px' }}>
                <legend className="muted small">Фокус-цели (до 3)</legend>
                <input type="text" name="focus_1" maxLength="200" aria-label="Фокус-цель 1" style={{ marginBottom: '6px' }} />
                <input type="text" name="focus_2" maxLength="200" aria-label="Фокус-цель 2" style={{ marginBottom: '6px' }} />
                <input type="text" name="focus_3" maxLength="200" aria-label="Фокус-цель 3" />
              </fieldset>
              <FormError error={planBusy.error} />
              <div className="dialog-actions">
                <button type="button" className="btn ghost" id="plan-cancel" hidden={!editing}
                  onClick={() => renderPlan(planRef.current, { animate: true })}>Отмена</button>
                <button type="submit" className="btn" disabled={planBusy.busy}>Сохранить</button>
              </div>
            </form>
          </section>

          <section className="panel" aria-labelledby="month-flower-title">
            <h2 id="month-flower-title">Цветок месяца</h2>
            <div id="flower">{flower && <Flower key={flower.round} {...flower} />}</div>
          </section>
        </div>

        <section className="panel span-2" aria-labelledby="day-title">
          <div className="panel-head">
            <h2 id="day-title">
              {selected && day.state !== 'idle'
                ? `Задачи на ${formatDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}`
                : 'Задачи дня'}
            </h2>
          </div>
          <form id="day-add" noValidate onSubmit={quickAdd.onSubmit}>
            <div className="capsule">
              <label htmlFor="day-add-title" className="visually-hidden">Новая задача на выбранный день</label>
              <input type="text" id="day-add-title" name="title" maxLength="200" placeholder="Добавить задачу на этот день" autoComplete="off" />
              <button type="submit" className="btn" disabled={quickAdd.busy}>+</button>
            </div>
            <FormError error={quickAdd.error} />
          </form>
          <ul className="task-list" id="day-tasks" style={{ marginTop: '8px' }}>{dayContent}</ul>
        </section>
      </div>
      <TaskDialog ref={dialog} />
    </>
  );
}
