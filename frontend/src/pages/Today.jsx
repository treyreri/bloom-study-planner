/* Today dashboard (/today/): everything comes from GET /api/v1/dashboard/ */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { celebrateIfAllDone, formatDate, iso, pageTitle, today } from '../lib/bloom.js';
import { Empty, Failed, Flower, FormError, HeartButton, Loading, useFlower } from '../components/ui.jsx';
import { TaskDialog, TaskItem, useQuickAdd } from '../components/tasks.jsx';

function greetingFor(data, t) {
  const hour = new Date().getHours();
  const hello = t(hour < 12 ? 'today.morning' : hour < 18 ? 'today.afternoon' : 'today.evening');
  return t('today.greeting', { hello, name: data.name });
}

function Deadline({ deadline }) {
  const { t } = useTranslation();
  if (!deadline) return <Empty icon="🎈">{t('today.noDeadlines')}</Empty>;
  const subject = deadline.subject_name;
  return (
    <>
      {deadline.days_left === 0
        ? <p className="countdown">{t('today.deadlineToday', { kind: t(`kinds.${deadline.kind}`), subject })}</p>
        : (
          <p className="countdown">
            {t('today.countdownBefore', { kind: t(`kindsGenitive.${deadline.kind}`), subject })}
            <span className="big">{deadline.days_left}</span>
            {t('today.countdownAfter', { count: deadline.days_left, kind: t(`kinds.${deadline.kind}`), subject })}
          </p>
        )}
      <span className="badge dot" style={{ '--dot': deadline.subject_color }}>{deadline.title}</span>
      {' '}
      <span className="muted small">{formatDate(deadline.due_date)}</span>
    </>
  );
}

function HabitRow({ habit }) {
  const { t } = useTranslation();
  const [streak, setStreak] = useState(habit.streak);
  return (
    <li>
      <HeartButton
        checked={habit.checked}
        label={t('today.checkHabit', { title: habit.title })}
        onToggle={async () => {
          const result = await api(`habits/${habit.id}/check/`, { method: 'POST' });
          setStreak(result.streak);
        }}
      />
      <span className="grow">{habit.emoji} {habit.title}</span>
      <span className="streak small">{streak ? `🔥 ${streak}` : ''}</span>
    </li>
  );
}

export default function Today() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [flower, showFlower] = useFlower();
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const dialog = useRef(null);

  useEffect(() => { document.title = pageTitle(t('today.title')); }, [t]);

  useEffect(() => {
    let cancelled = false;
    api('dashboard/')
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setTasks(result.tasks_today);
        showFlower(result.month.progress, { animate: false });
      })
      .catch((err) => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshFlower() {
    try {
      const result = await api('dashboard/');
      showFlower(result.month.progress);
    } catch { /* the flower will update on the next page load */ }
  }

  function onChange(kind, task) {
    let list = tasksRef.current;
    if (kind === 'deleted' || kind === 'moved' || (kind === 'updated' && task.date !== iso(today()))) {
      list = list.filter((t) => t.id !== task.id);
    }
    setTasks([...list]);
    if (kind === 'toggled' && task.is_done) celebrateIfAllDone(list);
    refreshFlower();
  }

  const quickAdd = useQuickAdd({
    onCreated: (task) => { setTasks([...tasksRef.current, task]); refreshFlower(); },
  });

  const done = tasks.filter((t) => t.is_done).length;

  let taskList;
  if (error) taskList = <Failed error={error} />;
  else if (!data) taskList = <Loading />;
  else if (!tasks.length) taskList = <Empty icon="🌱">{t('today.noTasks')}</Empty>;
  else {
    taskList = tasks.map((task) => (
      <TaskItem key={task.id} task={task} isDone={task.is_done} onChange={onChange} showDate={false}
        onEdit={(t, cb) => dialog.current.open(t, cb)} />
    ));
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 id="greeting">{data ? greetingFor(data, t) : t('today.hello')}</h1>
          <p className="muted" id="today-date">
            {data ? formatDate(data.date, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
          </p>
        </div>
        <Link className="btn" to="/focus/?start=1">{t('today.startPomodoro')}</Link>
      </div>

      {/* Order follows TZ 3.9: quote, today's tasks, deadline, habits, flower, pomodoro */}
      <div className="dashboard">
        <div className="grid">
          <section className="panel" aria-label={t('today.quote')}>
            <blockquote className="quote" id="quote">
              {data ? (
                <>
                  <p>{`«${data.quote.text}»`}</p>
                  {data.quote.author && <footer>— {data.quote.author}</footer>}
                </>
              ) : <p className="loading">{t('common.loading')}</p>}
            </blockquote>
          </section>

          <section className="card" aria-labelledby="tasks-title">
            <div className="panel-head">
              <h2 id="tasks-title">{t('today.tasksTitle')}</h2>
              <span className="muted small" id="tasks-count">{tasks.length ? t('today.tasksCount', { done, total: tasks.length }) : ''}</span>
            </div>
            <form id="today-add" noValidate onSubmit={quickAdd.onSubmit}>
              <div className="capsule">
                <label htmlFor="today-add-title" className="visually-hidden">{t('today.newTask')}</label>
                <input type="text" id="today-add-title" name="title" maxLength="200" placeholder={t('today.newTask')} autoComplete="off" />
                <button type="submit" className="btn" aria-label={t('today.addTask')} disabled={quickAdd.busy}>+</button>
              </div>
              <FormError error={quickAdd.error} />
            </form>
            <ul className="task-list" id="today-tasks" style={{ marginTop: '8px' }}>{taskList}</ul>
          </section>
        </div>

        <div className="grid">
          <section className="panel" aria-labelledby="deadline-title">
            <div className="panel-head">
              <h2 id="deadline-title">{t('today.deadlineTitle')}</h2>
              <Link className="small" to="/study/#deadlines">{t('today.all')}</Link>
            </div>
            <div id="deadline">{data && <Deadline deadline={data.next_deadline} />}</div>
          </section>

          <section className="panel" aria-labelledby="habits-title">
            <div className="panel-head">
              <h2 id="habits-title">{t('today.habitsTitle')}</h2>
              <Link className="small" to="/habits/">{t('today.tracker')}</Link>
            </div>
            <ul className="list" id="today-habits">
              {data && (data.habits_today.length
                ? data.habits_today.map((habit) => <HabitRow key={habit.id} habit={habit} />)
                : <li className="muted">{t('today.noHabits')} <Link to="/habits/">{t('today.create')}</Link></li>)}
            </ul>
          </section>

          <section className="panel" aria-labelledby="flower-title">
            <div className="panel-head">
              <h2 id="flower-title">{t('today.flowerTitle')}</h2>
              <Link className="small" to="/month/">{t('today.monthLink')}</Link>
            </div>
            <div id="flower">{flower && <Flower key={flower.round} {...flower} />}</div>
          </section>

          <section className="panel" aria-labelledby="focus-title">
            <h2 id="focus-title">{t('today.focusTitle')}</h2>
            <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '12px' }}>
              <div className="stat"><strong id="focus-today">{data ? data.focus_minutes_today : 0}</strong><span className="muted small">{t('today.minToday')}</span></div>
              <div className="stat"><strong id="focus-week">{data ? data.focus_minutes_week : 0}</strong><span className="muted small">{t('today.minWeek')}</span></div>
            </div>
            <Link className="btn" style={{ width: '100%' }} to="/focus/?start=1">{t('today.startPomodoro')}</Link>
          </section>
        </div>
      </div>
      <TaskDialog ref={dialog} />
    </>
  );
}
