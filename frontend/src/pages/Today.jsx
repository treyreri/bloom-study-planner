/* Today dashboard (/today/): everything comes from GET /api/v1/dashboard/ */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import {
  KINDS, KINDS_GENITIVE, celebrateIfAllDone, daysWord, formatDate, iso, pageTitle, today,
} from '../lib/bloom.js';
import { Empty, Failed, Flower, FormError, HeartButton, Loading, useFlower } from '../components/ui.jsx';
import { TaskDialog, TaskItem, useQuickAdd } from '../components/tasks.jsx';

function greetingFor(data) {
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Привет' : 'Добрый вечер';
  return `${hello}, ${data.name}! 🌷`;
}

function Deadline({ deadline }) {
  if (!deadline) return <Empty icon="🎈">Дедлайнов не видно — можно выдохнуть.</Empty>;
  const kind = KINDS_GENITIVE[deadline.kind];
  return (
    <>
      {deadline.days_left === 0
        ? <p className="countdown">{`Сегодня ${KINDS[deadline.kind]} по ${deadline.subject_name}! 🌹`}</p>
        : (
          <p className="countdown">
            {`До ${kind} по ${deadline.subject_name} осталось `}
            <span className="big">{deadline.days_left}</span>{' '}
            {daysWord(deadline.days_left)}{' 🌷'}
          </p>
        )}
      <span className="badge dot" style={{ '--dot': deadline.subject_color }}>{deadline.title}</span>
      {' '}
      <span className="muted small">{formatDate(deadline.due_date)}</span>
    </>
  );
}

function HabitRow({ habit }) {
  const [streak, setStreak] = useState(habit.streak);
  return (
    <li>
      <HeartButton
        checked={habit.checked}
        label={`Отметить привычку: ${habit.title}`}
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
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [flower, showFlower] = useFlower();
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const dialog = useRef(null);

  useEffect(() => { document.title = pageTitle('Сегодня'); }, []);

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
  else if (!tasks.length) taskList = <Empty icon="🌱">На сегодня задач нет. Добавь первую!</Empty>;
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
          <h1 id="greeting">{data ? greetingFor(data) : 'Привет! 🌷'}</h1>
          <p className="muted" id="today-date">
            {data ? formatDate(data.date, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
          </p>
        </div>
        <Link className="btn" to="/focus/?start=1">Начать помодоро 🍅</Link>
      </div>

      {/* Order follows TZ 3.9: quote, today's tasks, deadline, habits, flower, pomodoro */}
      <div className="dashboard">
        <div className="grid">
          <section className="panel" aria-label="Цитата дня">
            <blockquote className="quote" id="quote">
              {data ? (
                <>
                  <p>{`«${data.quote.text}»`}</p>
                  {data.quote.author && <footer>— {data.quote.author}</footer>}
                </>
              ) : <p className="loading">Загружаем</p>}
            </blockquote>
          </section>

          <section className="card" aria-labelledby="tasks-title">
            <div className="panel-head">
              <h2 id="tasks-title">Задачи на сегодня 💗</h2>
              <span className="muted small" id="tasks-count">{tasks.length ? `${done} из ${tasks.length}` : ''}</span>
            </div>
            <form id="today-add" noValidate onSubmit={quickAdd.onSubmit}>
              <div className="capsule">
                <label htmlFor="today-add-title" className="visually-hidden">Новая задача на сегодня</label>
                <input type="text" id="today-add-title" name="title" maxLength="200" placeholder="Новая задача на сегодня" autoComplete="off" />
                <button type="submit" className="btn" aria-label="Добавить задачу" disabled={quickAdd.busy}>+</button>
              </div>
              <FormError error={quickAdd.error} />
            </form>
            <ul className="task-list" id="today-tasks" style={{ marginTop: '8px' }}>{taskList}</ul>
          </section>
        </div>

        <div className="grid">
          <section className="panel" aria-labelledby="deadline-title">
            <div className="panel-head">
              <h2 id="deadline-title">Ближайший дедлайн</h2>
              <Link className="small" to="/study/#deadlines">все →</Link>
            </div>
            <div id="deadline">{data && <Deadline deadline={data.next_deadline} />}</div>
          </section>

          <section className="panel" aria-labelledby="habits-title">
            <div className="panel-head">
              <h2 id="habits-title">Привычки ✨</h2>
              <Link className="small" to="/habits/">трекер →</Link>
            </div>
            <ul className="list" id="today-habits">
              {data && (data.habits_today.length
                ? data.habits_today.map((habit) => <HabitRow key={habit.id} habit={habit} />)
                : <li className="muted">Привычек пока нет. <Link to="/habits/">Создать</Link></li>)}
            </ul>
          </section>

          <section className="panel" aria-labelledby="flower-title">
            <div className="panel-head">
              <h2 id="flower-title">Цветок месяца</h2>
              <Link className="small" to="/month/">месяц →</Link>
            </div>
            <div id="flower">{flower && <Flower key={flower.round} {...flower} />}</div>
          </section>

          <section className="panel" aria-labelledby="focus-title">
            <h2 id="focus-title">Фокус ⏳</h2>
            <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '12px' }}>
              <div className="stat"><strong id="focus-today">{data ? data.focus_minutes_today : 0}</strong><span className="muted small">мин сегодня</span></div>
              <div className="stat"><strong id="focus-week">{data ? data.focus_minutes_week : 0}</strong><span className="muted small">мин за неделю</span></div>
            </div>
            <Link className="btn" style={{ width: '100%' }} to="/focus/?start=1">Начать помодоро 🍅</Link>
          </section>
        </div>
      </div>
      <TaskDialog ref={dialog} />
    </>
  );
}
